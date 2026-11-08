import os, re, json, sqlite3, secrets, hashlib, datetime as dt
import mailer
import numpy as np, pandas as pd
from functools import wraps
from flask import Flask, request, jsonify, session, g, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.neighbors import NearestNeighbors

BASE = os.path.dirname(os.path.abspath(__file__))
for _p in [os.path.join(BASE, ".env"), os.path.join(BASE, "..", ".env")]:
    if os.path.exists(_p):
        try:
            with open(_p, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        os.environ.setdefault(_k.strip(), _v.strip())
            break
        except Exception:
            pass
DATA = os.environ.get("DATA_DIR") or os.path.join(BASE, "data"); os.makedirs(os.path.join(DATA, "images"), exist_ok=True)
DB = os.path.join(DATA, "diabetes.db")
def resolve_data_path(p):
    if not p: return ""
    if os.path.exists(p): return p
    candidate = os.path.join(DATA, os.path.basename(p.replace("\\", "/")))
    return candidate if os.path.exists(candidate) else p

APP_URL = os.environ.get("APP_URL", "http://localhost:5173").rstrip("/")
DIST = os.path.join(BASE, "..", "frontend", "dist")
TARGET = "Diabetes_binary"
# 11 ตัวแปรตามรายงาน 1.3.2.3
FEATURES11 = ["GenHlth","HighBP","BMI","HighChol","Age","DiffWalk","PhysHlth","HeartDiseaseorAttack","Stroke","CholCheck","PhysActivity"]
ALL21 = ["HighBP","HighChol","CholCheck","BMI","Smoker","Stroke","HeartDiseaseorAttack","PhysActivity","Fruits","Veggies","HvyAlcoholConsump","AnyHealthcare","NoDocbcCost","GenHlth","MentHlth","PhysHlth","DiffWalk","Sex","Age","Education","Income"]

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get("SECRET_KEY", "change-me-in-production")
app.config.update(SESSION_COOKIE_SAMESITE="Lax", MAX_CONTENT_LENGTH=200*1024*1024)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, fullname TEXT NOT NULL, password TEXT NOT NULL, birthdate TEXT, email TEXT, gender TEXT, diabetes_history TEXT, role TEXT NOT NULL DEFAULT 'user', reset_token TEXT, reset_expires TEXT, createdate TEXT);
CREATE TABLE IF NOT EXISTS articles(article_id INTEGER PRIMARY KEY AUTOINCREMENT, imagepath TEXT, title TEXT NOT NULL, category TEXT, content TEXT, createdate TEXT);
CREATE TABLE IF NOT EXISTS datasets(id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, path TEXT, rows INTEGER, cols INTEGER, columns TEXT, createdate TEXT);
CREATE TABLE IF NOT EXISTS models(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, dataset_id INTEGER, algorithm TEXT, features TEXT, weights TEXT, intercept REAL, test_size REAL, k INTEGER, smote INTEGER, accuracy REAL, precision REAL, recall REAL, f1 REAL, auc REAL, cv REAL, risk_q TEXT, test_path TEXT, is_active INTEGER DEFAULT 0, createdate TEXT);
CREATE TABLE IF NOT EXISTS predictions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, model_id INTEGER, inputs TEXT, probability REAL, result TEXT, createdate TEXT);
"""
def now(): return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB); g.db.row_factory = sqlite3.Row
    return g.db
@app.teardown_appcontext
def close(_):
    d = g.pop("db", None)
    if d: d.close()
def init_db():
    c = sqlite3.connect(DB); c.executescript(SCHEMA)
    for t, col, typ in (("users", "reset_expires", "TEXT"), ("models", "risk_q", "TEXT")):  # ย้ายฐานข้อมูลเก่าอัตโนมัติ
        if col not in [r[1] for r in c.execute(f"PRAGMA table_info({t})")]: c.execute(f"ALTER TABLE {t} ADD COLUMN {col} {typ}")
    c.commit(); c.close()
def q(sql, a=(), one=False):
    r = db().execute(sql, a).fetchall(); return (r[0] if r else None) if one else r
def ex(sql, a=()):
    c = db().execute(sql, a); db().commit(); return c.lastrowid
def rows(r): return [dict(x) for x in r]
def err(m, c=400): return jsonify(error=m), c

def auth(role=None):
    def deco(f):
        @wraps(f)
        def w(*a, **k):
            if "uid" not in session: return err("กรุณาเข้าสู่ระบบ", 401)
            u = q("SELECT * FROM users WHERE id=?", (session["uid"],), one=True)
            if not u: session.clear(); return err("กรุณาเข้าสู่ระบบ", 401)
            if role and u["role"] != role: return err("ไม่มีสิทธิ์เข้าถึง", 403)
            g.user = u; return f(*a, **k)
        return w
    return deco
def pub(u): return {k: u[k] for k in ("id","username","fullname","email","birthdate","gender","diabetes_history","role","createdate")}

# ---------- Auth ----------
GENDERS = ("ชาย", "หญิง", "อื่นๆ"); HISTORY = ("ไม่เคยเป็น", "เคยเป็นภาวะก่อนเบาหวาน", "เคยเป็นเบาหวาน")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
@app.post("/api/register")
def register():  # ตารางที่ 3.6: username, fullname, password, birthdate, email, gender, diabetes_history, role, createdate
    d = request.json or {}
    fn, un, pw, em = (d.get("fullname") or "").strip(), (d.get("username") or "").strip(), d.get("password") or "", (d.get("email") or "").strip().lower()
    bd, gd, dh = (d.get("birthdate") or "").strip(), d.get("gender"), d.get("diabetes_history")
    if not (fn and un and em and bd and gd and dh) or len(pw) < 6: return err("กรุณากรอกข้อมูลให้ครบ (รหัสผ่านอย่างน้อย 6 ตัวอักษร)")
    if pw != d.get("confirm"): return err("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน")
    if not EMAIL_RE.match(em): return err("รูปแบบอีเมลไม่ถูกต้อง")
    try:
        if dt.date.fromisoformat(bd) > dt.date.today(): raise ValueError
    except ValueError: return err("วันเกิดไม่ถูกต้อง")
    if gd not in GENDERS or dh not in HISTORY: return err("กรุณาเลือกเพศและประวัติโรคเบาหวานให้ถูกต้อง")
    if q("SELECT 1 FROM users WHERE username=?", (un,), one=True): return err("username ซ้ำ")
    if q("SELECT 1 FROM users WHERE email=?", (em,), one=True): return err("อีเมลนี้ถูกใช้งานแล้ว")
    uid = ex("INSERT INTO users(username,fullname,password,birthdate,email,gender,diabetes_history,role,createdate) VALUES(?,?,?,?,?,?,?,?,?)",
       (un, fn, generate_password_hash(pw), bd, em, gd, dh, "user", now()))
    u = q("SELECT * FROM users WHERE id=?", (uid,), one=True)
    session["uid"] = uid
    return jsonify(ok=True, message="สมัครสมาชิกและเข้าสู่ระบบสำเร็จ", user=pub(u))
@app.post("/api/login")
def login():
    d = request.json or {}
    u = q("SELECT * FROM users WHERE username=?", ((d.get("username") or "").strip(),), one=True)
    if not u or not check_password_hash(u["password"], d.get("password") or ""): return err("Username หรือ Password ไม่ถูกต้อง", 401)
    session["uid"] = u["id"]; return jsonify(user=pub(u))
@app.post("/api/logout")
def logout(): session.clear(); return jsonify(ok=True)
@app.get("/api/me")
def me():
    u = q("SELECT * FROM users WHERE id=?", (session.get("uid"),), one=True)
    return jsonify(user=pub(u) if u else None)
@app.put("/api/me")
@auth()
def me_update():
    d = request.json or {}
    fn, em = (d.get("fullname") or "").strip(), (d.get("email") or "").strip().lower()
    bd, gd, dh = (d.get("birthdate") or "").strip(), d.get("gender"), d.get("diabetes_history")
    if not (fn and em and bd and gd and dh): return err("กรุณากรอกข้อมูลให้ครบ")
    if not EMAIL_RE.match(em): return err("รูปแบบอีเมลไม่ถูกต้อง")
    try:
        if dt.date.fromisoformat(bd) > dt.date.today(): raise ValueError
    except ValueError: return err("วันเกิดไม่ถูกต้อง")
    if gd not in GENDERS or dh not in HISTORY: return err("กรุณาเลือกเพศและประวัติโรคเบาหวานให้ถูกต้อง")
    dup = q("SELECT 1 FROM users WHERE email=? AND id!=?", (em, g.user["id"]), one=True)
    if dup: return err("อีเมลนี้ถูกใช้งานแล้ว")
    ex("UPDATE users SET fullname=?, email=?, birthdate=?, gender=?, diabetes_history=? WHERE id=?",
       (fn, em, bd, gd, dh, g.user["id"]))
    pw = d.get("password") or ""
    if pw:
        if len(pw) < 6: return err("รหัสผ่านอย่างน้อย 6 ตัวอักษร")
        if pw != d.get("confirm"): return err("รหัสผ่านใหม่และยืนยันไม่ตรงกัน")
        ex("UPDATE users SET password=? WHERE id=?", (generate_password_hash(pw), g.user["id"]))
    u = q("SELECT * FROM users WHERE id=?", (g.user["id"],), one=True)
    return jsonify(ok=True, message="บันทึกข้อมูลส่วนตัวสำเร็จ", user=pub(u))

def _h(t): return hashlib.sha256(t.encode()).hexdigest()
@app.post("/api/forgot")
def forgot():  # ตารางที่ 3.9: ไม่พบอีเมล -> แจ้ง / พบ -> ส่งอีเมลรีเซ็ต
    em = ((request.json or {}).get("email") or "").strip().lower()
    u = q("SELECT * FROM users WHERE email=?", (em,), one=True) if em else None
    if not u: return err("ไม่พบอีเมล", 404)
    t = secrets.token_urlsafe(24); exp = (dt.datetime.now() + dt.timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")
    ex("UPDATE users SET reset_token=?, reset_expires=? WHERE id=?", (_h(t), exp, u["id"]))
    link = f"{APP_URL}/reset?token={t}&email={em}"
    html = f"<p>สวัสดี {u['fullname']}</p><p>กดลิงก์เพื่อตั้งรหัสผ่านใหม่ (ลิงก์ใช้ได้ 30 นาที):</p><p><a href='{link}'>{link}</a></p><p>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ให้ละเว้นอีเมลนี้</p>"
    try:
        m = mailer.send_mail(em, "รีเซ็ตรหัสผ่าน - เว็บแอปทำนายความเสี่ยงโรคเบาหวาน", html, f"ลิงก์ตั้งรหัสผ่านใหม่ (30 นาที): {link}")
    except mailer.MailError as e:
        print("[MAIL ERROR]", e)
        return jsonify(ok=True, message=f"ส่งอีเมลจริงไม่สำเร็จ ({e}) แต่สร้างลิงก์สำหรับรีเซ็ตให้แล้ว", dev_link=link)
    return jsonify(ok=True, message="ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบกล่องจดหมาย", dev_link=link if m == "console" else None)
@app.post("/api/reset")
def reset():
    d = request.json or {}
    u = q("SELECT * FROM users WHERE email=?", ((d.get("email") or "").strip().lower(),), one=True)
    if not u or not u["reset_token"] or not d.get("token") or not secrets.compare_digest(u["reset_token"], _h(d["token"])) or (u["reset_expires"] or "") < now():
        return err("ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ")
    if len(d.get("password") or "") < 6: return err("รหัสผ่านอย่างน้อย 6 ตัวอักษร")
    ex("UPDATE users SET password=?, reset_token=NULL, reset_expires=NULL WHERE id=?", (generate_password_hash(d["password"]), u["id"]))
    return jsonify(ok=True, message="รีเซ็ตรหัสผ่านสำเร็จ")

# ---------- Articles ----------
@app.get("/api/articles")
def articles():
    s = f"%{request.args.get('q','').strip()}%"
    return jsonify(rows(q("SELECT * FROM articles WHERE title LIKE ? OR category LIKE ? ORDER BY article_id DESC", (s, s))))
@app.get("/api/articles/<int:i>")
def article(i):
    a = q("SELECT * FROM articles WHERE article_id=?", (i,), one=True); return jsonify(dict(a)) if a else err("ไม่พบข้อมูล", 404)
@app.post("/api/articles")
@auth("admin")
def art_add():
    d = request.json or {}
    if not (d.get("title") or "").strip(): return err("กรุณากรอกหัวข้อ")
    i = ex("INSERT INTO articles(imagepath,title,category,content,createdate) VALUES(?,?,?,?,?)", (d.get("imagepath"), d["title"], d.get("category"), d.get("content"), now()))
    return jsonify(ok=True, id=i)
@app.put("/api/articles/<int:i>")
@auth("admin")
def art_edit(i):
    d = request.json or {}
    ex("UPDATE articles SET imagepath=?,title=?,category=?,content=? WHERE article_id=?", (d.get("imagepath"), d.get("title"), d.get("category"), d.get("content"), i)); return jsonify(ok=True)
@app.delete("/api/articles/<int:i>")
@auth("admin")
def art_del(i): ex("DELETE FROM articles WHERE article_id=?", (i,)); return jsonify(ok=True)

MAGIC = ((b"\xff\xd8\xff", "jpg"), (b"\x89PNG\r\n\x1a\n", "png"), (b"GIF8", "gif"))
@app.post("/api/upload-image")
@auth("admin")
def upload_image():
    f = request.files.get("file"); raw = f.read(3 * 1024 * 1024 + 1) if f else b""
    if not raw or len(raw) > 3 * 1024 * 1024: return err("ไฟล์รูปต้องไม่เกิน 3 MB")
    ext = next((e for m, e in MAGIC if raw.startswith(m)), "webp" if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP" else None)
    if not ext: return err("รองรับเฉพาะไฟล์รูป JPG, PNG, GIF, WEBP")
    n = f"{secrets.token_hex(8)}.{ext}"; open(os.path.join(DATA, "images", n), "wb").write(raw)
    return jsonify(url=f"/api/images/{n}")
@app.get("/api/images/<name>")
def get_image(name): return send_from_directory(os.path.join(DATA, "images"), name)

# ---------- Users (admin) ----------
@app.get("/api/users")
@auth("admin")
def users():
    s = f"%{request.args.get('q','').strip()}%"
    return jsonify([pub(u) for u in q("SELECT * FROM users WHERE username LIKE ? OR fullname LIKE ? OR CAST(id AS TEXT) LIKE ? ORDER BY id", (s, s, s))])
@app.post("/api/users")
@auth("admin")
def user_add():
    d = request.json or {}
    fn, un, pw, em = (d.get("fullname") or "").strip(), (d.get("username") or "").strip(), d.get("password") or "", (d.get("email") or "").strip().lower()
    bd, gd, dh = (d.get("birthdate") or "").strip(), d.get("gender"), d.get("diabetes_history")
    role = "admin" if d.get("role") == "admin" else "user"
    if not (fn and un and em and bd and gd and dh) or len(pw) < 6: return err("กรุณากรอกข้อมูลให้ครบ (รหัสผ่านอย่างน้อย 6 ตัวอักษร)")
    if not EMAIL_RE.match(em): return err("รูปแบบอีเมลไม่ถูกต้อง")
    try:
        if dt.date.fromisoformat(bd) > dt.date.today(): raise ValueError
    except ValueError: return err("วันเกิดไม่ถูกต้อง")
    if gd not in GENDERS or dh not in HISTORY: return err("กรุณาเลือกเพศและประวัติโรคเบาหวานให้ถูกต้อง")
    if q("SELECT 1 FROM users WHERE username=?", (un,), one=True): return err("username ซ้ำ")
    if q("SELECT 1 FROM users WHERE email=?", (em,), one=True): return err("อีเมลนี้ถูกใช้งานแล้ว")
    i = ex("INSERT INTO users(username,fullname,password,birthdate,email,gender,diabetes_history,role,createdate) VALUES(?,?,?,?,?,?,?,?,?)",
           (un, fn, generate_password_hash(pw), bd, em, gd, dh, role, now()))
    return jsonify(ok=True, message="เพิ่มผู้ใช้งานสำเร็จ", id=i)

@app.put("/api/users/<int:i>")
@auth("admin")
def user_edit(i):
    d = request.json or {}
    ex("UPDATE users SET fullname=?,email=?,birthdate=?,gender=?,diabetes_history=?,role=? WHERE id=?", (d.get("fullname"), (d.get("email") or "").strip().lower() or None, d.get("birthdate"), d.get("gender"), d.get("diabetes_history"), "admin" if d.get("role") == "admin" else "user", i))
    if d.get("password"):
        if len(d["password"]) < 6: return err("รหัสผ่านอย่างน้อย 6 ตัวอักษร")
        ex("UPDATE users SET password=? WHERE id=?", (generate_password_hash(d["password"]), i))
    return jsonify(ok=True)
@app.delete("/api/users/<int:i>")
@auth("admin")
def user_del(i):
    if i == g.user["id"]: return err("ไม่สามารถลบบัญชีของตนเองได้")
    ex("DELETE FROM predictions WHERE user_id=?", (i,)); ex("DELETE FROM users WHERE id=?", (i,)); return jsonify(ok=True)

# ---------- Dashboard ----------
@app.get("/api/dashboard")
@auth("admin")
def dashboard():
    c = lambda t: q(f"SELECT COUNT(*) n FROM {t}", one=True)["n"]
    recs = q("SELECT COALESCE(SUM(rows),0) n FROM datasets", one=True)["n"]
    return jsonify(members=c("users"), datasets=c("datasets"), records=recs, models=c("models"), predictions=c("predictions"))

# ---------- Datasets ----------
@app.get("/api/datasets")
@auth("admin")
def ds_list(): return jsonify(rows(q("SELECT id,filename,rows,cols,columns,createdate FROM datasets ORDER BY id DESC")))
@app.post("/api/datasets")
@auth("admin")
def ds_up():
    f = request.files.get("file")
    if not f or not f.filename.lower().endswith(".csv"): return err("กรุณาเลือกไฟล์ .csv")
    p = os.path.join(DATA, f"{secrets.token_hex(4)}_{os.path.basename(f.filename)}"); f.save(p)
    try: df = pd.read_csv(p)
    except Exception: os.remove(p); return err("อ่านไฟล์ CSV ไม่ได้")
    if TARGET not in df.columns or len(df) < 100: os.remove(p); return err(f"ไฟล์ต้องมีคอลัมน์ {TARGET} และมีข้อมูลอย่างน้อย 100 แถว")
    i = ex("INSERT INTO datasets(filename,path,rows,cols,columns,createdate) VALUES(?,?,?,?,?,?)", (f.filename, p, len(df), df.shape[1], json.dumps(list(df.columns)), now()))
    return jsonify(ok=True, id=i)
@app.delete("/api/datasets/<int:i>")
@auth("admin")
def ds_del(i):
    d = q("SELECT path FROM datasets WHERE id=?", (i,), one=True)
    if d and d["path"]:
        p = resolve_data_path(d["path"])
        if p and os.path.exists(p): os.remove(p)
    ex("DELETE FROM datasets WHERE id=?", (i,)); return jsonify(ok=True)

# ---------- Model ----------
def sigmoid(z): return 1 / (1 + np.exp(-z))
def smote(X, y):
    y = np.asarray(y); mi = 1 if y.sum() < len(y) - y.sum() else 0
    Xm = X[y == mi]; need = int((y != mi).sum() - len(Xm))
    if need <= 0 or len(Xm) < 6: return X, y
    idx = NearestNeighbors(n_neighbors=6).fit(Xm).kneighbors(Xm, return_distance=False)[:, 1:]
    r = np.random.default_rng(42); i = r.integers(0, len(Xm), need); j = idx[i, r.integers(0, 5, need)]
    return np.vstack([X, Xm[i] + r.random((need, 1)) * (Xm[j] - Xm[i])]), np.concatenate([y, np.full(need, mi)])
def metrics(X, y, w, b):
    p = sigmoid(np.asarray(X, float) @ np.asarray(w) + b); yp = (p >= 0.5).astype(int); y = np.asarray(y)
    tp, tn, fp, fn = int(((yp==1)&(y==1)).sum()), int(((yp==0)&(y==0)).sum()), int(((yp==1)&(y==0)).sum()), int(((yp==0)&(y==1)).sum())
    return dict(accuracy=accuracy_score(y, yp), precision=precision_score(y, yp, zero_division=0), recall=recall_score(y, yp, zero_division=0),
                f1=f1_score(y, yp, zero_division=0), auc=roc_auc_score(y, p) if len(set(y)) > 1 else None, tp=tp, tn=tn, fp=fp, fn=fn)

@app.post("/api/models/train")
@auth("admin")
def train():
    d = request.json or {}
    ds = q("SELECT * FROM datasets WHERE id=?", (d.get("dataset_id"),), one=True)
    if not ds: return err("กรุณาเลือกชุดข้อมูล")
    feats = d.get("features") or []; k = int(d.get("k") or 5); ts = float(d.get("test_size") or 0.2); sm = bool(d.get("smote"))
    p = resolve_data_path(ds["path"])
    if not p or not os.path.exists(p): return err("ไม่พบไฟล์ชุดข้อมูล")
    df = pd.read_csv(p)
    miss = [f for f in feats if f not in df.columns]
    if not feats or miss: return err("เลือกตัวแปรไม่ถูกต้อง/ไม่มีในชุดข้อมูล: " + ", ".join(miss))
    if not 0.05 <= ts <= 0.5 or not 2 <= k <= 10: return err("ค่า Test Split ต้อง 5–50% และ K ต้อง 2–10")
    df = df[feats + [TARGET]].dropna(); X, y = df[feats].astype(float), df[TARGET].astype(int)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=ts, stratify=y, random_state=42)
    def fit(Xa, ya):
        sc = StandardScaler().fit(Xa); Xs, ys = sc.transform(Xa), np.asarray(ya)
        if sm: Xs, ys = smote(Xs, ys)
        return sc, LogisticRegression(max_iter=2000, tol=1e-4).fit(Xs, ys)
    def raw(sc, m):  # แปลงเป็นน้ำหนักบนค่าดิบ เพื่อใช้สูตร z = b + ΣWX ตามรายงาน
        w = m.coef_[0] / sc.scale_; return w, float(m.intercept_[0] - np.sum(w * sc.mean_))
    cv = []
    for a, b in StratifiedKFold(k, shuffle=True, random_state=42).split(Xtr, ytr):
        sc, m = fit(Xtr.iloc[a], ytr.iloc[a]); w, b0 = raw(sc, m); cv.append(metrics(Xtr.iloc[b], ytr.iloc[b], w, b0)["accuracy"])
    sc, m = fit(Xtr, ytr); w, b0 = raw(sc, m); mt = metrics(Xte, yte, w, b0)
    rq = np.percentile(sigmoid(X.to_numpy(float) @ w + b0), np.arange(101)).tolist()  # การกระจายความน่าจะเป็นของกลุ่มตัวอย่าง ใช้คำนวณ Risk Score
    mid = ex("INSERT INTO models(name,dataset_id,algorithm,features,weights,intercept,test_size,k,smote,accuracy,precision,recall,f1,auc,cv,risk_q,createdate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
             ("", ds["id"], "Logistic Regression", json.dumps(feats), json.dumps(list(map(float, w))), b0, ts, k, int(sm), mt["accuracy"], mt["precision"], mt["recall"], mt["f1"], mt["auc"], float(np.mean(cv)), json.dumps(rq), now()))
    tp = os.path.join(DATA, f"model_{mid}_test.csv"); pd.concat([Xte, yte], axis=1).to_csv(tp, index=False)
    ex("UPDATE models SET name=?, test_path=? WHERE id=?", (f"LogReg #{mid}" + (" +SMOTE" if sm else ""), tp, mid))
    return jsonify(ok=True, id=mid, **mt, cv=float(np.mean(cv)), cv_folds=cv)
@app.get("/api/models")
@auth("admin")
def models():
    return jsonify(rows(q("SELECT id,name,dataset_id,algorithm,features,test_size,k,smote,accuracy,precision,recall,f1,auc,cv,is_active,createdate FROM models ORDER BY id DESC")))
@app.post("/api/models/<int:i>/test")
@auth("admin")
def model_test(i):
    m = q("SELECT * FROM models WHERE id=?", (i,), one=True)
    tp = resolve_data_path(m["test_path"]) if m else ""
    if not m or not tp or not os.path.exists(tp): return err("ไม่พบโมเดลหรือชุดทดสอบ", 404)
    t = pd.read_csv(tp); f = json.loads(m["features"])
    return jsonify(metrics(t[f], t[TARGET], json.loads(m["weights"]), m["intercept"]) | {"n_test": len(t)})
@app.post("/api/models/<int:i>/activate")
@auth("admin")
def activate(i):
    m = q("SELECT features FROM models WHERE id=?", (i,), one=True)
    if not m: return err("ไม่พบโมเดล", 404)
    if not set(json.loads(m["features"])) <= set(FEATURES11): return err("โมเดลนี้ใช้ตัวแปรนอกเหนือจาก 11 ตัวแปรของแบบฟอร์มประเมิน จึงนำไปใช้ทำนายจริงไม่ได้")
    ex("UPDATE models SET is_active=0"); ex("UPDATE models SET is_active=1 WHERE id=?", (i,)); return jsonify(ok=True)
@app.delete("/api/models/<int:i>")
@auth("admin")
def model_del(i):
    m = q("SELECT test_path FROM models WHERE id=?", (i,), one=True)
    if m and m["test_path"]:
        tp = resolve_data_path(m["test_path"])
        if tp and os.path.exists(tp):
            try: os.remove(tp)
            except Exception: pass
    ex("DELETE FROM predictions WHERE model_id=?", (i,)); ex("DELETE FROM models WHERE id=?", (i,)); return jsonify(ok=True)

# ---------- Predict ----------
BIN = ["HighBP","HighChol","CholCheck","Stroke","HeartDiseaseorAttack","PhysActivity","DiffWalk"]
def advice(x, risk):
    t = []
    if risk: t.append("ผลประเมินอยู่ในกลุ่มมีความเสี่ยง ควรไปตรวจระดับน้ำตาลในเลือดกับสถานพยาบาลเพื่อยืนยันผล")
    else: t.append("ผลประเมินอยู่ในกลุ่มปกติ ควรรักษาพฤติกรรมสุขภาพที่ดีและตรวจสุขภาพประจำปี")
    if x["BMI"] >= 25: t.append("ดัชนีมวลกายสูงกว่าเกณฑ์ ควรควบคุมอาหารและลดน้ำหนักอย่างค่อยเป็นค่อยไป")
    if not x["PhysActivity"]: t.append("ควรออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์")
    if x["HighBP"]: t.append("ควบคุมความดันโลหิต ลดอาหารเค็ม และติดตามค่าความดันสม่ำเสมอ")
    if x["HighChol"] or not x["CholCheck"]: t.append("ควรตรวจและควบคุมระดับคอเลสเตอรอล ลดอาหารไขมันสูง")
    if x["GenHlth"] >= 4 or x["PhysHlth"] >= 10: t.append("สุขภาพโดยรวมไม่ดีนัก แนะนำให้ปรึกษาแพทย์เพื่อประเมินสุขภาพเพิ่มเติม")
    if x["HeartDiseaseorAttack"] or x["Stroke"]: t.append("มีประวัติโรคหัวใจ/หลอดเลือดสมอง ควรติดตามการรักษากับแพทย์อย่างต่อเนื่อง")
    t.append("ผลนี้เป็นการประเมินเบื้องต้นด้วยแบบจำลองทางสถิติ ไม่ใช่การวินิจฉัยทางการแพทย์")
    return t
@app.post("/api/predict")
@auth()
def predict():
    m = q("SELECT * FROM models WHERE is_active=1", one=True)
    if not m: return err("ยังไม่มีโมเดลที่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ", 503)
    d = request.json or {}; x = {}
    try:
        for f in FEATURES11: x[f] = float(d[f])
    except (KeyError, TypeError, ValueError): return err("กรุณากรอกข้อมูลให้ครบและถูกต้อง")
    ok = all(x[f] in (0, 1) for f in BIN) and 12 <= x["BMI"] <= 98 and 1 <= x["GenHlth"] <= 5 and 0 <= x["PhysHlth"] <= 30 and 1 <= x["Age"] <= 13
    if not ok: return err("กรุณากรอกข้อมูลให้ครบและถูกต้อง")
    feats, w = json.loads(m["features"]), json.loads(m["weights"])
    p = float(sigmoid(sum(wi * x[f] for wi, f in zip(w, feats)) + m["intercept"])); risk = p >= 0.5
    res = "มีความเสี่ยง" if risk else "ปกติ"
    rq = json.loads(m["risk_q"] or "[]")  # Risk Score = เปอร์เซ็นไทล์ของผู้ใช้เทียบกับกลุ่มตัวอย่าง (0-100)
    score = int(np.clip(np.searchsorted(rq, p, side="right") - 1, 0, 100)) if rq else round(p * 100)
    pid = ex("INSERT INTO predictions(user_id,model_id,inputs,probability,result,createdate) VALUES(?,?,?,?,?,?)", (g.user["id"], m["id"], json.dumps(x), p, res, now()))
    return jsonify(id=pid, createdate=now(), model=m["name"], probability=p, risk_score=score, result=res, label="Prediabetes / Diabetes" if risk else "No Diabetes", advice=advice(x, risk))
@app.get("/api/predictions")
@auth()
def history():
    q_str = f"%{request.args.get('q', '').strip()}%"
    sql = """
    SELECT p.id, p.model_id, COALESCE(m.name, 'Logistic Regression') AS model_name,
           p.inputs, p.probability, p.result, p.createdate
    FROM predictions p
    LEFT JOIN models m ON p.model_id = m.id
    WHERE p.user_id = ? AND (p.result LIKE ? OR p.createdate LIKE ? OR CAST(p.id AS TEXT) LIKE ?)
    ORDER BY p.id DESC
    """
    return jsonify(rows(q(sql, (g.user["id"], q_str, q_str, q_str))))

@app.delete("/api/predictions/<int:i>")
@auth()
def prediction_del(i):
    pred = q("SELECT * FROM predictions WHERE id=?", (i,), one=True)
    if not pred: return err("ไม่พบข้อมูลประวัติ", 404)
    if pred["user_id"] != g.user["id"] and g.user["role"] != "admin":
        return err("ไม่มีสิทธิ์ลบประวัตินี้", 403)
    ex("DELETE FROM predictions WHERE id=?", (i,))
    return jsonify(ok=True, message="ลบประวัติการประเมินสำเร็จ")

@app.delete("/api/predictions/clear-all")
@auth()
def predictions_clear():
    ex("DELETE FROM predictions WHERE user_id=?", (g.user["id"],))
    return jsonify(ok=True, message="ล้างประวัติการประเมินทั้งหมดสำเร็จ")


# ---------- Serve built frontend ----------
@app.route("/", defaults={"p": ""})
@app.route("/<path:p>")
def spa(p):
    if p.startswith("api/"): return err("ไม่พบ", 404)
    if p and os.path.exists(os.path.join(DIST, p)): return send_from_directory(DIST, p)
    if os.path.exists(os.path.join(DIST, "index.html")): return send_from_directory(DIST, "index.html")
    return "ยังไม่ได้ build frontend: รัน npm run dev ในโฟลเดอร์ frontend (ดู README)", 200

init_db()
if __name__ == "__main__": app.run(host="0.0.0.0", port=5000, debug=False)
