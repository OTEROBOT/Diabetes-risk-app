import React, { useEffect, useState, useCallback } from 'react'
import { api, pct } from './api.js'
import { Msg } from './App.jsx'

const DEFAULT11 = ['GenHlth', 'HighBP', 'BMI', 'HighChol', 'Age', 'DiffWalk', 'PhysHlth', 'HeartDiseaseorAttack', 'Stroke', 'CholCheck', 'PhysActivity']

export function Dashboard() {
  const [d, setD] = useState(null)
  useEffect(() => { api('/dashboard').then(setD) }, [])
  if (!d) return <div className="page">กำลังโหลด...</div>
  const c = [['จำนวนสมาชิก', d.members], ['จำนวนชุดข้อมูล (ไฟล์)', d.datasets], ['จำนวนระเบียนข้อมูลรวม', d.records.toLocaleString()], ['จำนวนแบบจำลอง', d.models], ['จำนวนประวัติการทำนาย', d.predictions]]
  return <div className="page"><h3>Dashboard</h3><div className="grid">{c.map(([a, b]) => <div className="card" key={a}><h4>{a}</h4><div className="big">{b}</div></div>)}</div></div>
}

export function Users({ me }) {
  const blankUser = { username: '', fullname: '', email: '', birthdate: '', gender: '', diabetes_history: '', role: 'user', password: '' }
  const [list, setList] = useState([]), [s, setS] = useState(''), [ed, setEd] = useState(null), [e, setE] = useState(''), [ok, setOk] = useState('')
  const load = useCallback(() => api('/users?q=' + encodeURIComponent(s)).then(setList), [s])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  const save = async () => {
    try {
      if (ed.id) {
        await api('/users/' + ed.id, 'PUT', ed)
        setOk('บันทึกข้อมูลสำเร็จ')
      } else {
        await api('/users', 'POST', ed)
        setOk('เพิ่มผู้ใช้งานสำเร็จ')
      }
      setEd(null); setE(''); load()
    } catch (x) { setE(x.message) }
  }
  const del = async u => { if (!confirm(`ยืนยันการลบผู้ใช้ ${u.username}?`)) return; try { await api('/users/' + u.id, 'DELETE'); setOk('ลบข้อมูลสำเร็จ'); setE(''); load() } catch (x) { setE(x.message) } }
  return (<div className="page"><div className="bar"><b>จัดการข้อมูลผู้ใช้งาน</b>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input style={{ maxWidth: 280 }} placeholder="ค้นหา username / ชื่อ / รหัส" value={s} onChange={x => setS(x.target.value)} />
      <button className="btn sm" onClick={() => { setEd({ ...blankUser }); setOk(''); setE('') }}>+ เพิ่มผู้ใช้งาน</button>
    </div></div><Msg e={e} ok={ok} />
    {ed && <div className="card" style={{ marginBottom: 14 }}><h4>{ed.id ? `แก้ไขผู้ใช้ ${ed.username}` : 'เพิ่มผู้ใช้งานใหม่'}</h4><div className="row">
      <div><label>ชื่อผู้ใช้งาน (Username)</label><input disabled={!!ed.id} value={ed.username || ''} onChange={x => setEd({ ...ed, username: x.target.value })} /></div>
      <div><label>ชื่อ-นามสกุล</label><input value={ed.fullname || ''} onChange={x => setEd({ ...ed, fullname: x.target.value })} /></div>
      <div><label>อีเมล</label><input value={ed.email || ''} onChange={x => setEd({ ...ed, email: x.target.value })} /></div>
      <div><label>วันเกิด</label><input type="date" value={ed.birthdate || ''} onChange={x => setEd({ ...ed, birthdate: x.target.value })} /></div>
      <div><label>เพศ</label><select value={ed.gender || ''} onChange={x => setEd({ ...ed, gender: x.target.value })}><option value="">-</option>{['ชาย', 'หญิง', 'อื่นๆ'].map(o => <option key={o}>{o}</option>)}</select></div>
      <div><label>ประวัติโรคเบาหวาน</label><select value={ed.diabetes_history || ''} onChange={x => setEd({ ...ed, diabetes_history: x.target.value })}><option value="">-</option>{['ไม่เคยเป็น', 'เคยเป็นภาวะก่อนเบาหวาน', 'เคยเป็นเบาหวาน'].map(o => <option key={o}>{o}</option>)}</select></div>
      <div><label>สิทธิ์</label><select value={ed.role} onChange={x => setEd({ ...ed, role: x.target.value })}><option value="user">สมาชิก (User)</option><option value="admin">ผู้ดูแลระบบ (Admin)</option></select></div>
      <div><label>{ed.id ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)'}</label><input type="password" value={ed.password || ''} onChange={x => setEd({ ...ed, password: x.target.value })} /></div></div>
      <div className="row" style={{ marginTop: 12, maxWidth: 320 }}><button className="btn" onClick={save}>บันทึก</button><button className="btn sec2" onClick={() => setEd(null)}>ยกเลิก</button></div></div>}
    {!list.length ? <div className="err">ไม่พบข้อมูล</div> : <table><thead><tr><th>ID</th><th>Username</th><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>วันเกิด</th><th>เพศ</th><th>ประวัติเบาหวาน</th><th>สิทธิ์</th><th>สมัครเมื่อ</th><th></th></tr></thead><tbody>{list.map(u => <tr key={u.id}><td>{u.id}</td><td>{u.username}</td><td>{u.fullname}</td><td>{u.email}</td><td>{u.birthdate}</td><td>{u.gender}</td><td>{u.diabetes_history}</td><td>{u.role}</td><td>{u.createdate}</td>
      <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => { setEd({ ...u, password: '' }); setOk(''); setE('') }}>แก้ไข</button> <button className="btn sm red" disabled={u.id === me?.id} onClick={() => del(u)}>ลบ</button></td></tr>)}</tbody></table>}</div>)
}

export function ArticleAdmin() {
  const blank = { title: '', category: '', imagepath: '', content: '' }
  const [list, setList] = useState([]), [f, setF] = useState(null), [e, setE] = useState(''), [ok, setOk] = useState('')
  const load = () => api('/articles').then(setList)
  useEffect(() => { load() }, [])
  const save = async () => {
    if (!confirm('ยืนยันการบันทึกข้อมูล?')) return
    try { f.article_id ? await api('/articles/' + f.article_id, 'PUT', f) : await api('/articles', 'POST', f); setOk(f.article_id ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มความรู้สำเร็จ'); setE(''); setF(null); load() } catch (x) { setE(x.message) }
  }
  const del = async a => { if (!confirm(`ยืนยันการลบ "${a.title}"?`)) return; await api('/articles/' + a.article_id, 'DELETE'); setOk('ลบข้อมูลสำเร็จ'); load() }
  const S = k => x => setF({ ...f, [k]: x.target.value })
  const upImg = async x => {
    const file = x.target.files[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try { const r = await api('/upload-image', 'POST', fd); setF(v => ({ ...v, imagepath: r.url })); setE('') } catch (err) { setE(err.message) }
  }
  return (<div className="page"><div className="bar"><b>จัดการข้อมูลความรู้โรคเบาหวาน</b><button className="btn" onClick={() => { setF(blank); setOk('') }}>+ เพิ่มข้อมูลความรู้</button></div><Msg e={e} ok={ok} />
    {f && <div className="card" style={{ marginBottom: 14 }}><label>หัวข้อเรื่อง (title)</label><input value={f.title} onChange={S('title')} /><div className="row"><div><label>หมวดหมู่</label><input value={f.category || ''} onChange={S('category')} /></div><div><label>รูปประกอบ (imagepath) — วางลิงก์ URL หรืออัปโหลดไฟล์</label><input placeholder="https://..." value={f.imagepath || ''} onChange={S('imagepath')} /><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{ marginTop: 6 }} onChange={upImg} /></div></div>
      {f.imagepath && (
        <div style={{ marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', display: 'inline-block' }}>
          <img src={f.imagepath} alt="" style={{ maxHeight: 260, maxWidth: '100%', objectFit: 'contain', borderRadius: 6, display: 'block' }} />
        </div>
      )}
      <label>เนื้อหา (content)</label><textarea rows="8" value={f.content || ''} onChange={S('content')} /><div className="row" style={{ marginTop: 12, maxWidth: 320 }}><button className="btn" onClick={save}>บันทึก</button><button className="btn sec2" onClick={() => setF(null)}>ยกเลิก</button></div></div>}
    <table><thead><tr><th>ID</th><th>หัวข้อ</th><th>หมวดหมู่</th><th>วันที่เผยแพร่</th><th></th></tr></thead><tbody>{list.map(a => <tr key={a.article_id}><td>{a.article_id}</td><td>{a.title}</td><td>{a.category}</td><td>{a.createdate}</td><td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => { setF(a); setOk('') }}>แก้ไข</button> <button className="btn sm red" onClick={() => del(a)}>ลบ</button></td></tr>)}</tbody></table></div>)
}

export function Datasets() {
  const [list, setList] = useState([]), [file, setFile] = useState(null), [e, setE] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false)
  const load = () => api('/datasets').then(setList)
  useEffect(() => { load() }, [])
  const up = async () => {
    if (!file) return setE('กรุณาเลือกไฟล์ CSV'); setBusy(true); setE(''); setOk('')
    const fd = new FormData(); fd.append('file', file)
    try { await api('/datasets', 'POST', fd); setOk('อัปโหลดสำเร็จ'); setFile(null); load() } catch (x) { setE(x.message) }
    setBusy(false)
  }
  const del = async d => { if (confirm(`ลบ ${d.filename}?`)) { await api('/datasets/' + d.id, 'DELETE'); load() } }
  return (<div className="page"><h3>Upload Dataset</h3><div className="card"><input type="file" accept=".csv" onChange={x => setFile(x.target.files[0])} /><p className="muted">ไฟล์ CSV ต้องมีคอลัมน์ Diabetes_binary (0/1) เช่น diabetes_binary_5050split2.csv</p><button className="btn" disabled={busy} onClick={up}>{busy ? 'กำลังอัปโหลด...' : 'Upload Dataset'}</button><Msg e={e} ok={ok} /></div>
    <table style={{ marginTop: 16 }}><thead><tr><th>ID</th><th>Filename</th><th>Rows</th><th>Column</th><th>Action</th></tr></thead><tbody>{list.map(d => <tr key={d.id}><td>{d.id}</td><td>{d.filename}</td><td>{d.rows.toLocaleString()}</td><td>{d.cols}</td><td><button className="btn sm red" onClick={() => del(d)}>ลบ</button></td></tr>)}</tbody></table></div>)
}

export function TrainModel() {
  const [ds, setDs] = useState([]), [id, setId] = useState(''), [sel, setSel] = useState(DEFAULT11), [split, setSplit] = useState(0.2), [k, setK] = useState(5), [sm, setSm] = useState(false), [e, setE] = useState(''), [r, setR] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => { api('/datasets').then(d => { setDs(d); if (d[0]) setId(d[0].id) }) }, [])
  const cur = ds.find(d => d.id === +id), cols = cur ? JSON.parse(cur.columns).filter(c => c !== 'Diabetes_binary') : []
  const tog = c => setSel(sel.includes(c) ? sel.filter(x => x !== c) : [...sel, c])
  const train = async () => {
    setE(''); setR(null); setBusy(true)
    try { setR(await api('/models/train', 'POST', { dataset_id: +id, features: sel, test_size: split, k, smote: sm })) } catch (x) { setE(x.message) }
    setBusy(false)
  }
  return (<div className="page"><h3>Train Model</h3><div className="card"><Msg e={e} />
    <label>Select Dataset</label><select value={id} onChange={x => { setId(x.target.value); setSel(DEFAULT11) }}>{!ds.length && <option>ยังไม่มีชุดข้อมูล (ไปที่ Upload Dataset)</option>}{ds.map(d => <option key={d.id} value={d.id}>#{d.id} {d.filename} ({d.rows.toLocaleString()} แถว)</option>)}</select>
    <label>Algorithm</label><select><option>Logistic Regression</option></select>
    <div className="row"><div><label>Train / Test Split</label><select value={split} onChange={x => setSplit(+x.target.value)}><option value="0.2">80 / 20</option><option value="0.3">70 / 30</option><option value="0.1">90 / 10</option></select></div>
      <div><label>K-Fold Cross Validation</label><select value={k} onChange={x => setK(+x.target.value)}>{[3, 5, 10].map(v => <option key={v}>{v}</option>)}</select></div></div>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input style={{ width: 'auto' }} type="checkbox" checked={sm} onChange={x => setSm(x.target.checked)} />Enable SMOTE (จัดการข้อมูลที่ไม่สมดุล)</label>
    <div className="bar" style={{ marginTop: 16 }}><b>Select Features <span className="muted">เลือกตัวแปรที่ใช้ฝึกโมเดล – เลือกแล้ว {sel.length}/{cols.length} ตัว</span></b>
      <span><button className="btn sm sec2" onClick={() => setSel(cols)}>Select All</button> <button className="btn sm sec2" onClick={() => setSel(DEFAULT11.filter(c => cols.includes(c)))}>Default {DEFAULT11.length}</button></span></div>
    <div className="feat">{cols.map(c => <label key={c}><input type="checkbox" checked={sel.includes(c)} onChange={() => tog(c)} />{c}</label>)}</div>
    <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn" disabled={busy || !cur} onClick={train}>{busy ? 'กำลังฝึกโมเดล...' : `Train Model (${sel.length} features)`}</button></div>
    {r && <div className="ok">ฝึกโมเดลสำเร็จ (Model #{r.id}) — Accuracy {pct(r.accuracy)} · Precision {pct(r.precision)} · Recall {pct(r.recall)} · F1 {pct(r.f1)} · AUC {pct(r.auc)} · CV({k}-fold) {pct(r.cv)} · ไปที่เมนู Test Model เพื่อดูและเปิดใช้งาน</div>}
  </div></div>)
}

export function TestModel() {
  const [ms, setMs] = useState([]), [e, setE] = useState(''), [ok, setOk] = useState(''), [t, setT] = useState(null)
  const load = () => api('/models').then(setMs)
  useEffect(() => { load() }, [])
  const best = ms.length ? ms.reduce((a, b) => (b.accuracy > a.accuracy ? b : a)) : null
  const act = async m => { try { await api(`/models/${m.id}/activate`, 'POST'); setOk(`เปิดใช้งาน ${m.name} สำหรับการทำนายแล้ว`); setE(''); load() } catch (x) { setE(x.message); setOk('') } }
  const test = async m => setT({ m, ...(await api(`/models/${m.id}/test`, 'POST')) })
  const del = async m => { if (confirm('ลบโมเดลนี้ (และประวัติการทำนายที่ใช้โมเดลนี้)?')) { await api('/models/' + m.id, 'DELETE'); setT(null); load() } }
  const M = ([a, v]) => <div className="card" key={a}><h4>{a}</h4><div className="big">{pct(v)}</div></div>
  return (<div className="page"><h3>Machine Learning Models</h3><p className="muted">ตารางเรียงจากโมเดลใหม่ไปเก่า (Model ID มากไปน้อย) ค่าทั้งหมดวัดจากชุดทดสอบ (Test Set) ยกเว้น CV ซึ่งเป็นค่าเฉลี่ย Accuracy จาก K-Fold บนชุดฝึก · โมเดลที่เปิดใช้งาน (Active) คือโมเดลที่ใช้ทำนายให้สมาชิก</p><Msg e={e} ok={ok} />
    {best && <><div className="card" style={{ marginBottom: 12 }}><h4>Best Model (Highest Accuracy)</h4><b style={{ fontSize: 20 }}>{best.name}</b></div>
      <div className="grid" style={{ marginBottom: 16 }}>{[['Accuracy', best.accuracy], ['Precision', best.precision], ['Recall', best.recall], ['F1-Score', best.f1], ['AUC', best.auc], ['CV', best.cv]].map(M)}</div></>}
    {!ms.length && <div className="err">ยังไม่มีโมเดล — ไปที่เมนู Train Model</div>}
    {!!ms.length && <table><thead><tr><th>Model</th><th>Features</th><th>Acc</th><th>Pre</th><th>Rec</th><th>F1</th><th>AUC</th><th>CV</th><th>สถานะ</th><th></th></tr></thead><tbody>{ms.map(m => <tr key={m.id}><td>{m.name}</td><td>{JSON.parse(m.features).length}</td><td>{pct(m.accuracy)}</td><td>{pct(m.precision)}</td><td>{pct(m.recall)}</td><td>{pct(m.f1)}</td><td>{pct(m.auc)}</td><td>{pct(m.cv)}</td><td>{m.is_active ? <b style={{ color: '#166534' }}>Active</b> : '-'}</td>
      <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => test(m)}>ทดสอบ</button> <button className="btn sm sec2" onClick={() => act(m)}>ใช้งาน</button> <button className="btn sm red" onClick={() => del(m)}>ลบ</button></td></tr>)}</tbody></table>}
    {t && <div className="card" style={{ marginTop: 16 }}><h4>ผลทดสอบ {t.m.name} (Test Set {t.n_test.toLocaleString()} แถว)</h4><div className="grid">{[['Accuracy', t.accuracy], ['Precision', t.precision], ['Recall', t.recall], ['F1-Score', t.f1], ['AUC', t.auc]].map(M)}</div>
      <p>Confusion Matrix: TP = {t.tp} · TN = {t.tn} · FP = {t.fp} · FN = {t.fn}</p></div>}</div>)
}
