"""สร้างข้อมูลเริ่มต้น: ผู้ดูแลระบบ, บทความ, และ (ถ้าระบุ --demo) ชุดข้อมูลจำลอง + โมเดลตัวอย่าง
ชุดข้อมูลจริง (diabetes_binary_5050split2.csv) ให้อัปโหลดผ่านหน้า Upload Dataset ของผู้ดูแลระบบ"""
import sys, os, numpy as np, pandas as pd
from werkzeug.security import generate_password_hash
import app as A

ARTS = [
 ("โรคเบาหวานคืออะไร", "ความรู้ทั่วไป", "โรคเบาหวานเป็นโรคไม่ติดต่อเรื้อรัง เกิดจากร่างกายผลิตหรือใช้ฮอร์โมนอินซูลินได้ไม่เพียงพอ ทำให้ระดับน้ำตาลในเลือดสูงเป็นเวลานาน และอาจนำไปสู่ภาวะแทรกซ้อนต่อหัวใจ ไต ตา และเส้นประสาท"),
 ("ประเภทของโรคเบาหวาน", "ความรู้ทั่วไป", "แบ่งเป็น 3 ประเภทหลัก ได้แก่ ชนิดที่ 1 (ภูมิคุ้มกันทำลายเซลล์ตับอ่อน) ชนิดที่ 2 (ดื้อต่ออินซูลิน พบมากที่สุดมากกว่าร้อยละ 90) และเบาหวานขณะตั้งครรภ์"),
 ("อาการเตือนของโรคเบาหวาน", "อาการ", "ปัสสาวะบ่อย หิวน้ำบ่อย อ่อนเพลีย น้ำหนักลดโดยไม่ทราบสาเหตุ สายตาพร่ามัว แผลหายช้า และชาปลายมือปลายเท้า ในระยะเริ่มต้นอาจไม่มีอาการชัดเจน"),
 ("ปัจจัยเสี่ยงของโรคเบาหวาน", "ปัจจัยเสี่ยง", "น้ำหนักเกิน ความดันโลหิตสูง คอเลสเตอรอลสูง ขาดการออกกำลังกาย อายุที่เพิ่มขึ้น และประวัติโรคหัวใจหรือหลอดเลือดสมอง เป็นปัจจัยที่เพิ่มโอกาสเกิดโรคเบาหวาน"),
 ("แนวทางดูแลสุขภาพเพื่อลดความเสี่ยง", "การดูแลสุขภาพ", "ควบคุมน้ำหนัก ออกกำลังกายสม่ำเสมออย่างน้อย 150 นาทีต่อสัปดาห์ เลือกรับประทานอาหารที่มีน้ำตาลและไขมันต่ำ และตรวจสุขภาพประจำปี"),
]

def demo_csv(path, n=3000, seed=1):
    r = np.random.default_rng(seed); N = n * 8
    b = lambda p: (r.random(N) < p).astype(int)
    age = r.integers(1, 14, N); bmi = np.clip(r.normal(28, 6, N), 14, 70).round()
    d = pd.DataFrame(dict(HighBP=b(.43)|(age > 9)&b(.3), HighChol=b(.42), CholCheck=b(.96), BMI=bmi, Smoker=b(.44), Stroke=b(.05), HeartDiseaseorAttack=b(.09),
        PhysActivity=b(.75), Fruits=b(.63), Veggies=b(.81), HvyAlcoholConsump=b(.06), AnyHealthcare=b(.95), NoDocbcCost=b(.09),
        GenHlth=r.integers(1, 6, N), MentHlth=r.integers(0, 31, N), PhysHlth=np.minimum(30, r.poisson(4, N)), DiffWalk=b(.17), Sex=b(.45), Age=age,
        Education=r.integers(1, 7, N), Income=r.integers(1, 9, N)))
    z = -7.2 + .75*d.HighBP + .55*d.HighChol + .06*d.BMI + .17*d.GenHlth + .13*d.Age + .25*d.DiffWalk + .01*d.PhysHlth + .3*d.HeartDiseaseorAttack + .2*d.Stroke + .8*d.CholCheck - .25*d.PhysActivity
    d[TARGET] = (r.random(N) < 1/(1+np.exp(-z))).astype(int)
    out = pd.concat([d[d[TARGET]==1].head(n), d[d[TARGET]==0].head(n)]).sample(frac=1, random_state=1)
    out = out[[TARGET] + A.ALL21].astype(float); out.to_csv(path, index=False); return out
TARGET = A.TARGET

if __name__ == "__main__":
    with A.app.app_context():
        if not A.q("SELECT 1 FROM users WHERE username='admin'", one=True):
            A.ex("INSERT INTO users(username,fullname,password,email,role,createdate) VALUES(?,?,?,?,?,?)", ("admin", "ผู้ดูแลระบบ", generate_password_hash(os.environ.get("ADMIN_PASSWORD", "admin1234")), "admin@example.com", "admin", A.now()))
        if not A.q("SELECT 1 FROM articles", one=True):
            for t, c, b in ARTS: A.ex("INSERT INTO articles(imagepath,title,category,content,createdate) VALUES(?,?,?,?,?)", ("", t, c, b, A.now()))
        SRC = os.path.join(A.BASE, "seed_data", "diabetes_binary_5050split_health_indicators_BRFSS2015.csv")
        REAL = os.path.join(A.DATA, os.path.basename(SRC))
        if os.path.exists(SRC) and not os.path.exists(REAL): __import__("shutil").copy(SRC, REAL)
        if "--demo" in sys.argv or os.path.exists(REAL):
            if "--demo" in sys.argv or not os.path.exists(REAL):
                p = os.path.join(A.DATA, "DEMO_synthetic_diabetes.csv"); df = demo_csv(p); name = "DEMO_synthetic_diabetes.csv (ข้อมูลจำลอง)"
            else:
                p, name = REAL, os.path.basename(REAL); df = pd.read_csv(p)
            if not A.q("SELECT 1 FROM datasets WHERE path=? OR filename=?", (p, name), one=True):
                i = A.ex("INSERT INTO datasets(filename,path,rows,cols,columns,createdate) VALUES(?,?,?,?,?,?)", (name, p, len(df), df.shape[1], __import__("json").dumps(list(df.columns)), A.now()))
                c = A.app.test_client()
                with c.session_transaction() as s: s["uid"] = A.q("SELECT id FROM users WHERE username='admin'", one=True)["id"]
                r = c.post("/api/models/train", json=dict(dataset_id=i, features=A.FEATURES11, test_size=.2, k=5, smote=False)).json
                c.post(f"/api/models/{r['id']}/activate")
                print("dataset", name, len(df), "rows | model", r["id"], "acc", round(r["accuracy"], 4), "recall", round(r["recall"], 4), "auc", round(r["auc"], 4), "cv", round(r["cv"], 4))
    print("seed เสร็จ: admin / admin1234")
