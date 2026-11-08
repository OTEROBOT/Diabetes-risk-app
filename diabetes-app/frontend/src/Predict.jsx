import React, { useEffect, useState } from 'react'
import { api, pct } from './api.js'
import { Msg } from './App.jsx'

// กลุ่มอายุ 13 ระดับตามรหัส Age (_AGEG5YR) ของชุดข้อมูล BRFSS 2015 (1 = 18-24 ปี ... 13 = 80 ปีขึ้นไป)
const AGES = [['18-24 ปี', 1], ['25-29 ปี', 2], ['30-34 ปี', 3], ['35-39 ปี', 4], ['40-44 ปี', 5], ['45-49 ปี', 6], ['50-54 ปี', 7], ['55-59 ปี', 8], ['60-64 ปี', 9], ['65-69 ปี', 10], ['70-74 ปี', 11], ['75-79 ปี', 12], ['80 ปีขึ้นไป', 13]]
const GEN = [[5, '5 - แย่มาก (Poor)'], [4, '4 - ไม่ค่อยดี (Fair)'], [3, '3 - ปานกลาง (Good)'], [2, '2 - ดีมาก (Very good)'], [1, '1 - ดีเยี่ยม (Excellent)']]
const YN = [['HighBP', 'ความดันโลหิตสูง / High Blood Pressure'], ['CholCheck', 'ตรวจคอเลสเตอรอลใน 5 ปี / Cholesterol Check'], ['HighChol', 'คอเลสเตอรอลสูง / High Cholesterol']]
const YN2 = [['Stroke', 'เคยเป็นโรคหลอดเลือดสมอง / Stroke'], ['HeartDiseaseorAttack', 'โรคหัวใจหรือหัวใจวาย / Heart Disease or Attack'], ['PhysActivity', 'การออกกำลังกาย / Physical Activity (30 วันที่ผ่านมา)']]
const bmiCat = b => (b < 18.5 ? 'น้ำหนักน้อย' : b < 23 ? 'ปกติ' : b < 25 ? 'น้ำหนักเกิน' : b < 30 ? 'อ้วนระดับ 1' : 'อ้วนระดับ 2')

const Yn = ({ v, on }) => <div className="choice">{[[1, 'ใช่ / Yes'], [0, 'ไม่ใช่ / No']].map(([k, t]) => <button type="button" key={k} className={v === k ? 'on' : ''} onClick={() => on(k)}>{t}</button>)}</div>
const init = { HighBP: null, CholCheck: null, HighChol: null, Stroke: null, HeartDiseaseorAttack: null, PhysActivity: null, DiffWalk: null, GenHlth: '', PhysHlth: '', Age: '', h: '', w: '' }

export default function Predict() {
  const [f, setF] = useState(init), [e, setE] = useState(''), [res, setRes] = useState(null), [busy, setBusy] = useState(false)
  const bmi = f.h > 0 && f.w > 0 ? +(f.w / (f.h / 100) ** 2).toFixed(1) : null
  const set = (k, v) => setF({ ...f, [k]: v })
  const submit = async () => {
    setE('')
    const miss = [...YN, ...YN2, ['DiffWalk']].some(([k]) => f[k] === null) || !bmi || f.GenHlth === '' || f.PhysHlth === '' || f.Age === ''
    if (miss || f.PhysHlth < 0 || f.PhysHlth > 30 || bmi < 12 || bmi > 98) return setE('กรุณากรอกข้อมูลให้ครบและถูกต้อง')
    setBusy(true)
    try { const { h, w, ...rest } = f; setRes(await api('/predict', 'POST', { ...rest, BMI: bmi, GenHlth: +f.GenHlth, PhysHlth: +f.PhysHlth, Age: +f.Age })) } catch (x) { setE(x.message) }
    setBusy(false)
  }
  if (res) return (<div className="page"><div className="card"><h3>ผลการประเมินความเสี่ยง</h3>
    <div className="row muted"><div>รหัสผลลัพธ์ #{String(res.id).padStart(7, '0')}</div><div>เวลาประเมิน {res.createdate}</div></div>
    <div className="row" style={{ marginTop: 14 }}><div className="card"><h4>โมเดลที่ใช้</h4><b>{res.model}</b></div><div className="card"><h4>ระดับความเสี่ยง</h4><span className={'badge ' + (res.result === 'ปกติ' ? 'normal' : 'risk')}>{res.result}</span> <span className="muted">({res.label})</span></div></div>
    <div className="row" style={{ marginTop: 12 }}><div className="card"><h4>ค่าความน่าจะเป็น / Probability Score (0.00 – 1.00)</h4><div className="big">{Number(res.probability).toFixed(4)} <span style={{ fontSize: 20, color: '#4b5563', fontWeight: 600 }}>({pct(res.probability)})</span></div><span className="muted">โอกาสที่โมเดลทำนายว่ามีภาวะเบาหวาน/ก่อนเบาหวาน (เกณฑ์ตัดสิน Threshold P ≥ 0.50)</span></div><div className="card"><h4>คะแนนความเสี่ยง / Risk Score</h4><div className="big">{res.risk_score}%</div><span className="muted">ความเสี่ยงสูงกว่าผู้ตอบแบบสอบถาม BRFSS 2015 ประมาณ {res.risk_score}% (กลุ่มตัวอย่างมีผู้เป็นเบาหวานครึ่งหนึ่ง)</span></div></div>
    <h4 style={{ marginTop: 18 }}>คำแนะนำด้านสุขภาพ / Recommendation</h4><ul style={{ lineHeight: 1.9 }}>{res.advice.map(a => <li key={a}>{a}</li>)}</ul>
    <button className="btn sec2" onClick={() => { setRes(null); setF(init) }}>ประเมินใหม่</button></div></div>)
  const Q = ([k, t]) => <div key={k}><label>{t}</label><Yn v={f[k]} on={v => set(k, v)} /></div>
  return (<div className="page"><div className="card"><h3>ประเมินความเสี่ยงโรคเบาหวาน <span className="muted">/ ข้อมูลสำหรับทำนาย (Prediction Inputs)</span></h3><Msg e={e} />
    {YN.map(Q)}
    <label>ดัชนีมวลกาย / BMI <span className="muted">(คำนวณอัตโนมัติจากส่วนสูงและน้ำหนัก)</span></label>
    <div className="row"><input type="number" placeholder="ส่วนสูง / Height (cm)" value={f.h} onChange={x => set('h', x.target.value)} /><input type="number" placeholder="น้ำหนัก / Weight (kg)" value={f.w} onChange={x => set('w', x.target.value)} /></div>
    <div className="row" style={{ marginTop: 8 }}><div className="card"><h4>BMI ที่คำนวณได้</h4><b>{bmi ?? '-'}</b></div><div className="card"><h4>หมวดหมู่</h4><b>{bmi ? bmiCat(bmi) : '-'}</b></div></div>
    {YN2.map(Q)}
    <label>สุขภาพโดยรวม / General Health</label><select value={f.GenHlth} onChange={x => set('GenHlth', x.target.value)}><option value="">-- เลือก --</option>{GEN.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    <label style={{ marginTop: 16 }}><b>จำนวนวันที่เจ็บป่วยหรือไม่สบายกายใน 30 วันที่ผ่านมา (Physical Health Days: 0 – 30 วัน)</b></label>
    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 14px', marginBottom: 10, fontSize: 14, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
        💡 คำอธิบายสำหรับผู้ประเมิน:
      </div>
      <div style={{ color: '#475569' }}>
        หมายถึง <b>"ในรอบ 1 เดือน (30 วัน) ที่ผ่านมา มีกี่วันที่ท่านรู้สึกไม่สบาย เจ็บป่วยทางกาย มีอาการปวด หรือได้รับบาดเจ็บ จนส่งผลต่อการใช้ชีวิตประจำวัน"</b>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px', marginTop: 8, fontSize: 13, color: '#334155' }}>
        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          🟢 <b>0 วัน:</b> สุขภาพแข็งแรงดีตลอดเดือน <i>(หากปกติดีให้ระบุ 0)</i>
        </div>
        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          🟡 <b>1 – 5 วัน:</b> มีอาการป่วยเล็กน้อย เช่น เป็นหวัด ปวดกล้ามเนื้อ
        </div>
        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          🟠 <b>6 – 14 วัน:</b> มีอาการเจ็บป่วยหรือปวดเมื่อยเป็นระยะ
        </div>
        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          🔴 <b>15 – 30 วัน:</b> มีอาการเจ็บป่วยเรื้อรังหรือไม่สบายกายบ่อยครั้ง
        </div>
      </div>
    </div>
    <div className="row" style={{ alignItems: 'center' }}>
      <div style={{ flex: '1 1 200px' }}>
        <input type="number" min="0" max="30" placeholder="กรอกตัวเลข 0 – 30 วัน (สุขภาพปกติดีให้ใส่ 0)" value={f.PhysHlth} onChange={x => set('PhysHlth', x.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className={`btn sm ${(f.PhysHlth === 0 || f.PhysHlth === '0') ? '' : 'sec2'}`} onClick={() => set('PhysHlth', 0)}>0 วัน (แข็งแรงดี)</button>
        <button type="button" className={`btn sm ${(f.PhysHlth === 3 || f.PhysHlth === '3') ? '' : 'sec2'}`} onClick={() => set('PhysHlth', 3)}>3 วัน</button>
        <button type="button" className={`btn sm ${(f.PhysHlth === 7 || f.PhysHlth === '7') ? '' : 'sec2'}`} onClick={() => set('PhysHlth', 7)}>7 วัน</button>
        <button type="button" className={`btn sm ${(f.PhysHlth === 14 || f.PhysHlth === '14') ? '' : 'sec2'}`} onClick={() => set('PhysHlth', 14)}>14 วัน</button>
        <button type="button" className={`btn sm ${(f.PhysHlth === 30 || f.PhysHlth === '30') ? '' : 'sec2'}`} onClick={() => set('PhysHlth', 30)}>30 วัน (ทุกวัน)</button>
      </div>
    </div>
    {Q(['DiffWalk', 'เดินหรือขึ้นบันไดลำบาก / Difficulty Walking'])}
    <label>กลุ่มอายุ / Age Group</label><select value={f.Age} onChange={x => set('Age', x.target.value)}><option value="">-- เลือก --</option>{AGES.map(([t, v]) => <option key={v} value={v}>{t}</option>)}</select>
    <div className="row" style={{ marginTop: 20 }}><button className="btn" disabled={busy} onClick={submit}>{busy ? 'กำลังประเมิน...' : 'ประเมินความเสี่ยงโรคเบาหวาน'}</button><button className="btn sec2" onClick={() => { setF(init); setE('') }}>รีเซ็ตฟอร์ม / Reset Form</button></div>
  </div></div>)
}

// Smart Fuzzy & Multi-field search helpers
const stripThai = (str) =>
  (str || '')
    .toLowerCase()
    .replace(/[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/g, '')
    .replace(/\s+/g, '')

const levenshtein = (a, b) => {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1
      row[j - 1] = prev
      prev = val
    }
    row[b.length] = prev
  }
  return row[b.length]
}

const buildSearchIndex = (x, inp, getAgeText, getGenText) => {
  const probPct = Math.round((x.probability || 0) * 100)
  const probPct2 = ((x.probability || 0) * 100).toFixed(2)
  const d = new Date((x.createdate || '').replace(' ', 'T'))
  const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const thaiMonthsFull = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const engMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const m = isNaN(d.getMonth()) ? -1 : d.getMonth()
  const thaiYear = isNaN(d.getFullYear()) ? '' : `${d.getFullYear() + 543}`

  const terms = [
    `#${x.id}`,
    String(x.id),
    x.createdate || '',
    m >= 0 ? `${d.getDate()} ${thaiMonthsShort[m]} ${thaiMonthsFull[m]} ${engMonths[m]} ${thaiYear}` : '',
    x.result || '',
    x.result === 'มีความเสี่ยง'
      ? 'เสี่ยง มีความเสี่ยง เป็นเบาหวาน เสี่ยงเบาหวาน risk danger prediabetes diabetes high แดง'
      : 'ปกติ ไม่เสี่ยง ไม่เป็นเบาหวาน normal ok safe no diabetes healthy เขียว',
    `${Number(x.probability).toFixed(4)}`,
    `${probPct}%`,
    `${probPct2}%`,
    `${probPct}`,
    probPct >= 50 ? 'เสี่ยงสูง probabilityสูง p>=50' : 'เสี่ยงต่ำ probabilityต่ำ p<50',
    x.model_name || '',
    inp.HighBP ? 'ความดันโลหิตสูง ความดันสูง highbp bp' : 'ความดันปกติ',
    inp.HighChol ? 'คอเลสเตอรอลสูง ไขมันสูง highchol chol' : 'คอเลสเตอรอลปกติ',
    inp.CholCheck ? 'ตรวจคอเลสเตอรอล cholcheck' : 'ไม่ตรวจคอเลสเตอรอล',
    inp.BMI ? `bmi ${inp.BMI} ${bmiCat(inp.BMI)}` : '',
    inp.Stroke ? 'โรคหลอดเลือดสมอง stroke อัมพฤกษ์ อัมพาต' : '',
    inp.HeartDiseaseorAttack ? 'โรคหัวใจ หัวใจวาย heart disease attack' : '',
    inp.PhysActivity ? 'ออกกำลังกาย physical activity active' : 'ไม่ออกกำลังกาย',
    inp.DiffWalk ? 'เดินลำบาก ขึ้นบันไดลำบาก diffwalk walking' : 'เดินปกติ',
    inp.PhysHlth ? `ไม่สบายกาย ${inp.PhysHlth} วัน` : 'สุขภาพกายดี',
    getAgeText(inp.Age),
    getGenText(inp.GenHlth)
  ]
  return terms.join(' ').toLowerCase()
}

const smartMatch = (targetText, query) => {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (targetText.includes(q)) return true

  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    return words.every(w => smartMatch(targetText, w))
  }

  const normTarget = stripThai(targetText)
  const normQ = stripThai(q)
  if (normQ && normTarget.includes(normQ)) return true

  const targetTokens = targetText.split(/[\s,()\/#]+/).filter(t => t.length >= 2)
  for (const token of targetTokens) {
    if (token.startsWith(q) || (q.length >= 2 && token.includes(q))) return true
    const nToken = stripThai(token)
    if (normQ.length >= 3 && Math.abs(nToken.length - normQ.length) <= 2) {
      if (levenshtein(nToken, normQ) <= 1) return true
    }
  }
  return false
}

export function History() {
  const [list, setList] = useState(null), [s, setS] = useState(''), [detail, setDetail] = useState(null), [e, setE] = useState(''), [ok, setOk] = useState('')
  const load = () => api('/predictions').then(setList).catch(err => setE(err.message))
  useEffect(() => { load() }, [])

  const del = async (id) => {
    if (!confirm('ยืนยันการลบประวัติการประเมินนี้?')) return
    try {
      await api('/predictions/' + id, 'DELETE')
      setOk('ลบประวัติการประเมินสำเร็จ')
      setE('')
      if (detail?.id === id) setDetail(null)
      load()
    } catch (err) { setE(err.message) }
  }

  const clearAll = async () => {
    if (!confirm('ยืนยันการล้างประวัติการประเมินทั้งหมดของท่าน?')) return
    try {
      await api('/predictions/clear-all', 'DELETE')
      setOk('ล้างประวัติทั้งหมดสำเร็จ')
      setE('')
      setDetail(null)
      load()
    } catch (err) { setE(err.message) }
  }

  if (!list) return <div className="page">กำลังโหลด...</div>

  const getAgeText = v => (AGES.find(a => a[1] === Number(v))?.[0]) || `${v}`
  const getGenText = v => (GEN.find(g => g[0] === Number(v))?.[1]) || `${v}`
  const parseInputs = (inp) => {
    try { return typeof inp === 'string' ? JSON.parse(inp) : inp || {} }
    catch { return {} }
  }

  const filtered = list.filter(x => {
    if (!s.trim()) return true
    const inp = parseInputs(x.inputs)
    const indexText = buildSearchIndex(x, inp, getAgeText, getGenText)
    return smartMatch(indexText, s)
  })

  return (
    <div className="page">
      <div className="bar">
        <div>
          <h3>ประวัติการประเมินความเสี่ยงโรคเบาหวาน</h3>
          <span className="muted" style={{ fontSize: 13 }}>ค้นหาอัจฉริยะ: พิมพ์บางส่วน, คำใกล้เคียง, ผลลัพธ์, วันที่, หรือปัจจัยสุขภาพ เช่น เสี่ยง, ปกติ, ความดัน, ไขมัน, 50%</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ maxWidth: 300 }}
            placeholder="🔍 ค้นหาอัจฉริยะ (พิมพ์นิดเดียวก็เจอ)..."
            value={s}
            onChange={x => setS(x.target.value)}
          />
          {list.length > 0 && (
            <button className="btn sm red" onClick={clearAll}>ล้างประวัติทั้งหมด</button>
          )}
        </div>
      </div>

      {/* Quick Search Chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>แท็กค้นหาด่วน:</span>
        {[
          ['ทั้งหมด', ''],
          ['🔴 มีความเสี่ยง', 'เสี่ยง'],
          ['🟢 ปกติ', 'ปกติ'],
          ['🩺 ความดันสูง', 'ความดัน'],
          ['🧪 คอเลสเตอรอลสูง', 'คอเลส'],
          ['⚠️ P ≥ 50%', 'p>=50'],
          ['🚶 เดินลำบาก', 'เดินลำบาก'],
          ['🏋️ ออกกำลังกาย', 'ออกกำลังกาย']
        ].map(([label, val]) => (
          <button
            key={label}
            type="button"
            className={`btn sm ${s === val ? '' : 'sec2'}`}
            style={{ padding: '3px 9px', fontSize: 12, borderRadius: 14 }}
            onClick={() => setS(val)}
          >
            {label}
          </button>
        ))}
        {s && (
          <button
            type="button"
            className="btn sm"
            style={{ padding: '3px 9px', fontSize: 12, background: '#64748b', borderRadius: 14 }}
            onClick={() => setS('')}
          >
            ✕ ล้างคำค้นหา
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
          พบ <b>{filtered.length}</b> จากประวัติทั้งหมด {list.length} รายการ {s && <span>(ตรงกับคำค้นหา: "<b>{s}</b>")</span>}
        </div>
      )}

      <Msg e={e} ok={ok} />

      {detail && (() => {
        const inp = parseInputs(detail.inputs)
        const isRisk = detail.result === 'มีความเสี่ยง'
        const factors = [
          ['1. สุขภาพโดยรวม (GenHlth)', getGenText(inp.GenHlth)],
          ['2. ภาวะความดันโลหิตสูง (HighBP)', inp.HighBP ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['3. ภาวะคอเลสเตอรอลสูง (HighChol)', inp.HighChol ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['4. การตรวจคอเลสเตอรอลใน 5 ปี (CholCheck)', inp.CholCheck ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['5. ดัชนีมวลกาย (BMI)', inp.BMI ? `${inp.BMI} (${bmiCat(inp.BMI)})` : '-'],
          ['6. โรคหลอดเลือดสมอง (Stroke)', inp.Stroke ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['7. โรคหัวใจ / หัวใจวาย (Heart Disease or Attack)', inp.HeartDiseaseorAttack ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['8. การออกกำลังกาย (PhysActivity ใน 30 วัน)', inp.PhysActivity ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['9. วันสุขภาพกายไม่ดี (PhysHlth ใน 30 วัน)', `${inp.PhysHlth ?? '-'} วัน`],
          ['10. เดินหรือขึ้นบันไดลำบาก (DiffWalk)', inp.DiffWalk ? 'ใช่ / Yes' : 'ไม่ใช่ / No'],
          ['11. ช่วงอายุ (Age)', getAgeText(inp.Age)]
        ]
        return (
          <div className="card" style={{ marginBottom: 18, border: '2px solid #2563eb', background: '#f8fafc' }}>
            <div className="bar">
              <h4>📋 รายละเอียดข้อมูล 11 ตัวแปรที่ใช้ประเมิน (รหัส #{String(detail.id).padStart(7, '0')})</h4>
              <button className="btn sm sec2" onClick={() => setDetail(null)}>✕ ปิด</button>
            </div>
            <div className="row muted" style={{ marginBottom: 10 }}>
              <div>วันที่ประเมิน: <b>{detail.createdate}</b></div>
              <div>โมเดล: <b>{detail.model_name || 'Logistic Regression'}</b></div>
              <div>ผลลัพธ์: <span className={'badge ' + (isRisk ? 'risk' : 'normal')}>{detail.result}</span></div>
              <div>Probability Score: <b>{Number(detail.probability).toFixed(4)} ({pct(detail.probability)})</b></div>
            </div>
            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 10, marginBottom: 8 }}>
              ข้อมูลสุขภาพ 11 ตัวแปรที่ท่านได้กรอกไว้ในครั้งนี้:
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {factors.map(([name, val]) => (
                <div key={name} style={{ background: '#fff', border: '1px solid #d5dde8', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{name}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginTop: 4 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button className="btn sm red" style={{ marginRight: 8 }} onClick={() => del(detail.id)}>ลบประวัตินี้</button>
              <button className="btn sm sec2" onClick={() => setDetail(null)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        )
      })()}

      {!filtered.length ? (
        <div className="err">{s ? 'ไม่พบประวัติการทำนายที่ตรงกับคำค้นหา' : 'ไม่พบประวัติการทำนาย'}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>รหัส</th>
              <th>วันที่ทำนาย</th>
              <th>ผลความเสี่ยง</th>
              <th>ค่าความน่าจะเป็น (Probability Score)</th>
              <th style={{ textAlign: 'center' }}>จัดการข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(x => (
              <tr key={x.id}>
                <td>#{String(x.id).padStart(5, '0')}</td>
                <td>{x.createdate}</td>
                <td>
                  <span className={'badge ' + (x.result === 'ปกติ' ? 'normal' : 'risk')}>{x.result}</span>
                </td>
                <td>
                  <b>{Number(x.probability).toFixed(4)}</b> <span className="muted">({pct(x.probability)})</span>
                </td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                  <button className="btn sm" style={{ marginRight: 6 }} onClick={() => { setDetail(x); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    🔍 ดูข้อมูล 11 ตัวแปร
                  </button>
                  <button className="btn sm red" onClick={() => del(x.id)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

