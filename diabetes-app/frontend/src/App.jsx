import React, { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from './api.js'
import Predict, { History } from './Predict.jsx'
import { Dashboard, Users, ArticleAdmin, Datasets, TrainModel, TestModel } from './Admin.jsx'
import logoImg from './logo.png'

export const Msg = ({ e, ok }) => (e ? <div className="err">{e}</div> : ok ? <div className="ok">{ok}</div> : null)

function Home({ user }) {
  const items = [['ตัวแปรสุขภาพที่ใช้ประเมิน', '11 ตัวแปร'], ['อัลกอริทึม', 'Logistic Regression'], ['ชุดข้อมูลฝึกโมเดล', 'BRFSS 2015 (70,692 ระเบียน)'], ['เกณฑ์ตัดสิน (Threshold)', 'P ≥ 0.50'], ['ผลการประเมิน', '2 ระดับ: ปกติ / มีความเสี่ยง'], ['การตรวจสอบโมเดล', '5-Fold Cross-validation'], ['แบ่งข้อมูล', 'Train 80% / Test 20%']]
  return (<div className="page"><div className="grid">{items.map(([a, b]) => <div className="card" key={a}><h4>{a}</h4><div style={{ fontWeight: 700, fontSize: 20 }}>{b}</div></div>)}</div>
    <div style={{ textAlign: 'center', marginTop: 28 }}>{user ? <Link to="/predict"><button className="btn">เริ่มทำแบบฟอร์มประเมินความเสี่ยงโรคเบาหวาน</button></Link> : <Link to="/login"><button className="btn">เข้าสู่ระบบเพื่อประเมินความเสี่ยง</button></Link>}</div></div>)
}

function Articles() {
  const [list, setList] = useState([]), [s, setS] = useState(''), [loaded, setLoaded] = useState(false), nav = useNavigate()
  useEffect(() => { const t = setTimeout(() => api('/articles?q=' + encodeURIComponent(s)).then(d => { setList(d); setLoaded(true) }), 250); return () => clearTimeout(t) }, [s])
  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="bar" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, color: '#1e293b' }}>บทความความรู้เกี่ยวกับโรคเบาหวาน</h2>
          <span className="muted">รวมความรู้ สาระสุขภาพ ปัจจัยเสี่ยง และแนวทางป้องกันโรคเบาหวาน</span>
        </div>
        <input style={{ maxWidth: 320 }} placeholder="🔍 ค้นหาตามหัวข้อ / หมวดหมู่..." value={s} onChange={e => setS(e.target.value)} />
      </div>
      {loaded && !list.length && <div className="err">ไม่พบข้อมูลบทความที่ตรงกับการค้นหา</div>}
      <div className="art-grid">
        {list.map(a => (
          <div className="art-card" key={a.article_id} onClick={() => nav('/articles/' + a.article_id)}>
            {a.imagepath ? (
              <div className="art-card-img-wrap">
                <img
                  src={a.imagepath}
                  alt={a.title}
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.style.height = '160px'
                      e.currentTarget.parentElement.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;color:#64748b;font-size:14px"><span style="font-size:36px;margin-bottom:4px">📄</span><span>บทความให้ความรู้</span></div>'
                    }
                  }}
                />
              </div>
            ) : (
              <div className="art-card-placeholder">
                <span style={{ fontSize: 38 }}>🏥</span>
                <span style={{ fontWeight: 600 }}>สาระความรู้สุขภาพ</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="badge normal" style={{ fontSize: 13, padding: '2px 10px' }}>{a.category || 'ทั่วไป'}</span>
              <span className="muted" style={{ fontSize: 13 }}>{a.createdate?.slice(0, 10)}</span>
            </div>
            <h3 style={{ color: '#1e293b', fontSize: 18, margin: '6px 0 10px', lineHeight: 1.4 }}>{a.title}</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.6 }}>
              {a.content}
            </p>
            <div style={{ marginTop: 'auto', paddingTop: 8, color: '#2563eb', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
              อ่านบทความฉบับเต็ม →
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ArticleView() {
  const { id } = useParams(), [a, setA] = useState(null), [e, setE] = useState(''), [zoom, setZoom] = useState(false)
  useEffect(() => { api('/articles/' + id).then(setA).catch(x => setE(x.message)) }, [id])
  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 14 }}>
        <Link to="/articles" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ← กลับไปหน้ารวมบทความ
        </Link>
      </div>
      <Msg e={e} />
      {a && (
        <div className="card" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <span className="badge normal">{a.category || 'บทความความรู้'}</span>
            <span className="muted">วันที่เผยแพร่: {a.createdate}</span>
          </div>
          <h1 style={{ margin: '4px 0 18px', fontSize: 26, lineHeight: 1.4, color: '#1e293b' }}>{a.title}</h1>

          {a.imagepath && (
            <div style={{ textAlign: 'center', marginBottom: 24, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <img
                src={a.imagepath}
                alt={a.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '850px',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: 10,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  display: 'block',
                  margin: '0 auto',
                  cursor: 'zoom-in',
                  background: '#fff'
                }}
                onClick={() => setZoom(true)}
                title="คลิกเพื่อขยายภาพขนาดใหญ่"
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn sec2 sm" onClick={() => setZoom(true)}>
                  🔍 คลิกดูภาพขยายเต็มจอ (Full Size)
                </button>
                <a href={a.imagepath} target="_blank" rel="noopener noreferrer">
                  <button className="btn sec2 sm">↗ เปิดภาพต้นฉบับในแท็บใหม่</button>
                </a>
              </div>
            </div>
          )}

          <div style={{ fontSize: 17, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#334155' }}>
            {a.content}
          </div>
        </div>
      )}

      {zoom && a?.imagepath && (
        <div
          onClick={() => setZoom(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10000 }}>
            <button
              onClick={() => setZoom(false)}
              className="btn red"
              style={{ fontSize: 16, padding: '8px 16px', cursor: 'pointer' }}
            >
              ✕ ปิดหน้าต่างขยาย
            </button>
          </div>
          <img
            src={a.imagepath}
            alt={a.title}
            style={{
              maxWidth: '94vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              background: '#fff'
            }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ color: '#fff', marginTop: 12, fontSize: 14 }}>
            คลิกที่ว่างด้านนอกหรือกดปุ่ม [✕ ปิด] เพื่อกลับ
          </div>
        </div>
      )}
    </div>
  )
}
function Guide() {
  const steps = [
    'สมัครสมาชิกและเข้าสู่ระบบ (หรือผู้เยี่ยมชมสามารถเข้าอ่านบทความความรู้ได้โดยไม่ต้องล็อกอิน)',
    'เลือกเมนู "ประเมินความเสี่ยง" แล้วกรอกข้อมูลสุขภาพ 11 รายการ (ส่วนสูง/น้ำหนักระบบคำนวณ BMI ให้อัตโนมัติ)',
    'กด "ประเมินความเสี่ยงโรคเบาหวาน" เพื่อดูผล ค่าความน่าจะเป็น (Probability Score: 0.00–1.00) และคำแนะนำสุขภาพ',
    'ดูผลย้อนหลัง ค้นหาประวัติอย่างละเอียด และดูข้อมูล 11 ตัวแปรที่เคยกรอกได้ที่เมนู "ประวัติการประเมิน"',
    'อ่านความรู้เพิ่มเติมได้ที่เมนู "บทความความรู้"',
    'ผู้ดูแลระบบ (Admin) สามารถจัดการสมาชิก, บทความ, อัปโหลดชุดข้อมูล และฝึก/ทดสอบโมเดลได้ที่เมนูผู้ดูแลระบบ',
    'หมายเหตุ: ผลการประเมินเบื้องต้นด้วยแบบจำลองทางสถิติ ไม่ใช่การวินิจฉัยทางการแพทย์'
  ]
  const topics = [
    '1. บทนำและภาพรวมของระบบ', '2. การเริ่มต้นใช้งานและส่วนประกอบของหน้าจอ',
    '3. สำหรับผู้เยี่ยมชม: หน้าหลัก บทความ และคู่มือ', '4. การสมัครสมาชิกและการตั้งค่า',
    '5. การเข้าสู่ระบบ ออกจากระบบ และลืมรหัสผ่าน', '6. การประเมินความเสี่ยงโรคเบาหวาน (11 ตัวแปร)',
    '7. การอ่านและทำความเข้าใจผลการประเมิน', '8. ประวัติการประเมินและค้นหาข้อมูล',
    '9. สำหรับผู้ดูแลระบบ: Dashboard', '10. จัดการข้อมูลผู้ใช้งาน (เพิ่ม/แก้ไข/ลบ)',
    '11. จัดการข้อมูลความรู้โรคเบาหวาน', '12. Upload Dataset (BRFSS 2015)',
    '13. Train Model (Logistic Regression)', '14. Test Model และการเปิดใช้งานโมเดล',
    '15. ข้อความแจ้งเตือนและการแก้ไขปัญหาเบื้องต้น', '16. ภาคผนวก: ความหมายของตัวแปรและตัวชี้วัด'
  ]
  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>คู่มือแนะนำการใช้งานเบื้องต้น</h3>
        <ol style={{ lineHeight: 2 }}>{steps.map(s => <li key={s}>{s}</li>)}</ol>
      </div>

      <div className="card">
        <div className="bar">
          <div>
            <h3 style={{ margin: '0 0 4px' }}>📖 เอกสารคู่มือการใช้งานฉบับสมบูรณ์ (PDF 18 หน้า)</h3>
            <span className="muted">เอกสารคู่มือการใช้งานเว็บแอปทำนายความเสี่ยงโรคเบาหวาน ด้วยการถดถอยโลจิสติก (Logistic Regression) ฉบับเต็ม</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/manual.pdf" target="_blank" rel="noopener noreferrer">
              <button className="btn">↗ เปิดอ่านในแท็บใหม่</button>
            </a>
            <a href="/manual.pdf" download="คู่มือการใช้งาน_เว็บแอปทำนายความเสี่ยงโรคเบาหวาน.pdf">
              <button className="btn sec2">⬇ ดาวน์โหลด PDF</button>
            </a>
          </div>
        </div>

        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <details style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}>
            <summary style={{ fontWeight: 600, color: '#1e293b' }}>
              📑 สารบัญเนื้อหาในเล่มคู่มือ (คลิกเพื่อดูหัวข้อทั้ง 16 บท)
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6, marginTop: 10, fontSize: 14 }}>
              {topics.map(t => (
                <div key={t} style={{ color: '#475569', padding: '3px 0' }}>• {t}</div>
              ))}
            </div>
          </details>
        </div>

        <div style={{ border: '1px solid #cfd8e3', borderRadius: 8, overflow: 'hidden', background: '#525659' }}>
          <iframe
            src="/manual.pdf"
            title="คู่มือการใช้งานฉบับสมบูรณ์"
            style={{ width: '100%', height: '800px', border: 'none', display: 'block' }}
          />
        </div>
      </div>
    </div>
  )
}

const GENDERS = ['ชาย', 'หญิง', 'อื่นๆ'], HISTORY = ['ไม่เคยเป็น', 'เคยเป็นภาวะก่อนเบาหวาน', 'เคยเป็นเบาหวาน']
function Login({ setUser }) {
  const [tab, setTab] = useState('login'), [f, setF] = useState({}), [e, setE] = useState(''), [ok, setOk] = useState(''), [fg, setFg] = useState(false), [busy, setBusy] = useState(false), nav = useNavigate()
  const set = k => ev => setF({ ...f, [k]: ev.target.value })
  const go = async () => {
    setE(''); setOk(''); setBusy(true)
    try {
      if (fg) {
        const r = await api('/forgot', 'POST', { email: f.email })
        if (r.dev_link) {
          setOk(
            <div>
              <div>{r.message}</div>
              <div style={{ marginTop: 8 }}>
                <a href={r.dev_link} style={{ color: '#15803d', fontWeight: 'bold', textDecoration: 'underline' }}>
                  👉 คลิกที่นี่เพื่อไปหน้าตั้งรหัสผ่านใหม่ทันที
                </a>
              </div>
            </div>
          )
        } else {
          setOk(r.message)
        }
      }
      else if (tab === 'login') {
        const r = await api('/login', 'POST', f)
        setUser(r.user)
        nav(r.user.role === 'admin' ? '/admin' : '/')
      } else {
        const r = await api('/register', 'POST', f)
        if (r.user) {
          setUser(r.user)
          nav(r.user.role === 'admin' ? '/admin' : '/predict')
        } else {
          setOk(r.message)
          setTab('login')
        }
      }
    } catch (x) { setE(x.message) }
    setBusy(false)
  }
  const T = (k, label, type = 'text') => <div key={k}><label>{label}</label><input type={type} value={f[k] || ''} onChange={set(k)} /></div>
  const S = (k, label, opts) => <div key={k}><label>{label}</label><select value={f[k] || ''} onChange={set(k)}><option value="">-- เลือก --</option>{opts.map(o => <option key={o}>{o}</option>)}</select></div>
  return (<div className="page" style={{ maxWidth: 560 }}><div className="card">
    {!fg && <div className="tabs"><button className={tab === 'login' ? 'on' : ''} onClick={() => { setTab('login'); setE('') }}>เข้าสู่ระบบ</button><button className={tab === 'reg' ? 'on' : ''} onClick={() => { setTab('reg'); setE('') }}>สมัครสมาชิก</button></div>}
    <Msg e={e} ok={ok} />
    {fg ? <><h3>ลืมรหัสผ่าน</h3><p className="muted">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ (ลิงก์ใช้ได้ 30 นาที)</p>{T('email', 'อีเมล', 'email')}</>
      : tab === 'login' ? <>{T('username', 'ชื่อผู้ใช้งาน (Username)')}<label>รหัสผ่าน (Password)</label><input type="password" value={f.password || ''} onChange={set('password')} onKeyDown={x => x.key === 'Enter' && go()} /></>
      : <>{T('fullname', 'ชื่อ - นามสกุลจริง (Full Name)')}{T('username', 'ชื่อผู้ใช้งาน (Username)')}{T('email', 'อีเมล (Email)', 'email')}{T('birthdate', 'วันเกิด (Birthdate)', 'date')}
        <div className="row">{S('gender', 'เพศ (Gender)', GENDERS)}{S('diabetes_history', 'ประวัติโรคเบาหวาน', HISTORY)}</div>
        {T('password', 'รหัสผ่าน (Password)', 'password')}{T('confirm', 'ยืนยันรหัสผ่าน (Confirm Password)', 'password')}</>}
    <div style={{ textAlign: 'center', marginTop: 18 }}><button className="btn" disabled={busy} onClick={go}>{busy ? 'กำลังดำเนินการ...' : fg ? 'ส่งอีเมลรีเซ็ตรหัสผ่าน' : tab === 'login' ? 'เข้าสู่ระบบ' : 'ยืนยันการสมัครสมาชิก'}</button></div>
    {tab === 'login' && <p style={{ textAlign: 'center' }}><a href="#" onClick={x => { x.preventDefault(); setFg(!fg); setE(''); setOk('') }}>{fg ? 'กลับไปเข้าสู่ระบบ' : 'ลืมรหัสผ่าน?'}</a></p>}
  </div></div>)
}
function Reset() {
  const [sp] = useSearchParams(), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [e, setE] = useState(''), [ok, setOk] = useState('')
  const go = async () => {
    setE(''); if (pw !== pw2) return setE('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน')
    try { const r = await api('/reset', 'POST', { email: sp.get('email'), token: sp.get('token'), password: pw }); setOk(r.message) } catch (x) { setE(x.message) }
  }
  return (<div className="page" style={{ maxWidth: 480 }}><div className="card"><h3>ตั้งรหัสผ่านใหม่</h3><Msg e={e} ok={ok} />{ok ? <Link to="/login"><button className="btn">ไปหน้าเข้าสู่ระบบ</button></Link> : <>
    <label>รหัสผ่านใหม่</label><input type="password" value={pw} onChange={x => setPw(x.target.value)} /><label>ยืนยันรหัสผ่านใหม่</label><input type="password" value={pw2} onChange={x => setPw2(x.target.value)} />
    <div style={{ textAlign: 'center', marginTop: 18 }}><button className="btn" onClick={go}>บันทึกรหัสผ่านใหม่</button></div></>}</div></div>)
}

function Profile({ user, setUser }) {
  const [f, setF] = useState({ ...user }), [e, setE] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (user) setF({ ...user, password: '', confirm: '' }) }, [user])
  const set = k => ev => setF({ ...f, [k]: ev.target.value })
  const save = async () => {
    setE(''); setOk(''); setBusy(true)
    try {
      const r = await api('/me', 'PUT', f)
      setOk(r.message || 'บันทึกข้อมูลส่วนตัวสำเร็จ')
      if (r.user) setUser(r.user)
    } catch (x) { setE(x.message) }
    setBusy(false)
  }
  return (<div className="page" style={{ maxWidth: 640 }}><div className="card">
    <div className="bar">
      <h3>ข้อมูลส่วนตัวและแก้ไขข้อมูลผู้ใช้งาน</h3>
      <span className={'badge ' + (user.role === 'admin' ? 'risk' : 'normal')}>{user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'สมาชิก (Member)'}</span>
    </div>
    <Msg e={e} ok={ok} />
    <div className="row">
      <div><label>ชื่อผู้ใช้งาน (Username)</label><input disabled value={user.username || ''} style={{ background: '#f3f4f6' }} /></div>
      <div><label>สมัครสมาชิกเมื่อ</label><input disabled value={user.createdate || ''} style={{ background: '#f3f4f6' }} /></div>
    </div>
    <label>ชื่อ - นามสกุลจริง (Full Name)</label><input value={f.fullname || ''} onChange={set('fullname')} />
    <label>อีเมล (Email)</label><input type="email" value={f.email || ''} onChange={set('email')} />
    <div className="row">
      <div><label>วันเกิด (Birthdate)</label><input type="date" value={f.birthdate || ''} onChange={set('birthdate')} /></div>
      <div><label>เพศ (Gender)</label><select value={f.gender || ''} onChange={set('gender')}><option value="">-- เลือก --</option>{GENDERS.map(o => <option key={o}>{o}</option>)}</select></div>
    </div>
    <label>ประวัติโรคเบาหวาน</label><select value={f.diabetes_history || ''} onChange={set('diabetes_history')}><option value="">-- เลือก --</option>{HISTORY.map(o => <option key={o}>{o}</option>)}</select>
    <h4 style={{ marginTop: 20 }}>เปลี่ยนรหัสผ่าน (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</h4>
    <div className="row">
      <div><label>รหัสผ่านใหม่</label><input type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={f.password || ''} onChange={set('password')} /></div>
      <div><label>ยืนยันรหัสผ่านใหม่</label><input type="password" value={f.confirm || ''} onChange={set('confirm')} /></div>
    </div>
    <div style={{ textAlign: 'center', marginTop: 22 }}>
      <button className="btn" disabled={busy} onClick={save}>{busy ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}</button>
    </div>
  </div></div>)
}

export default function App() {
  const [user, setUser] = useState(undefined), nav = useNavigate()
  useEffect(() => { api('/me').then(r => setUser(r.user)).catch(() => setUser(null)) }, [])
  if (user === undefined) return <div className="page">กำลังโหลด...</div>
  const admin = user?.role === 'admin'
  const out = async () => { await api('/logout', 'POST'); setUser(null); nav('/') }
  const L = ({ to, children }) => <NavLink to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>{children}</NavLink>
  const guard = (el, ok = !!user) => (ok ? el : <Navigate to="/login" />)
  return (<div className="layout"><nav className="side"><div className="logo"><img src={logoImg} alt="กระทรวงสาธารณสุข" /></div>
    <div className="sec">เมนูทั่วไป</div><L to="/">หน้าหลัก</L><L to="/articles">บทความความรู้</L><L to="/guide">คู่มือการใช้งาน</L>
    {user && <><div className="sec">การประเมินความเสี่ยง</div><L to="/predict">ประเมินความเสี่ยง</L><L to="/history">ประวัติการประเมิน</L></>}
    {admin && <><div className="sec">ผู้ดูแลระบบ</div><L to="/admin">Dashboard</L><L to="/admin/users">จัดการผู้ใช้งาน</L><L to="/admin/articles">จัดการบทความ</L><L to="/admin/datasets">Upload Dataset</L><L to="/admin/train">Train Model</L><L to="/admin/models">Test Model</L></>}
    <div className="sec">บัญชี</div>{user ? <><L to="/profile">👤 {user.fullname}</L><a href="#" onClick={e => { e.preventDefault(); out() }}>ออกจากระบบ</a></> : <L to="/login">เข้าสู่ระบบ / สมัครสมาชิก</L>}
  </nav><div className="main"><div className="top">เว็บแอปทำนายความเสี่ยงโรคเบาหวาน</div>
    <Routes>
      <Route path="/" element={<Home user={user} />} />
      <Route path="/articles" element={<Articles />} /><Route path="/articles/:id" element={<ArticleView />} /><Route path="/guide" element={<Guide />} />
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login setUser={setUser} />} /><Route path="/reset" element={<Reset />} />
      <Route path="/profile" element={guard(<Profile user={user} setUser={setUser} />)} />
      <Route path="/predict" element={guard(<Predict />)} /><Route path="/history" element={guard(<History />)} />
      <Route path="/admin" element={guard(<Dashboard />, admin)} /><Route path="/admin/users" element={guard(<Users me={user} />, admin)} />
      <Route path="/admin/articles" element={guard(<ArticleAdmin />, admin)} /><Route path="/admin/datasets" element={guard(<Datasets />, admin)} />
      <Route path="/admin/train" element={guard(<TrainModel />, admin)} /><Route path="/admin/models" element={guard(<TestModel />, admin)} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes></div></div>)
}
