export async function api(path, method = 'GET', body) {
  const o = { method, credentials: 'same-origin', headers: {} }
  if (body instanceof FormData) o.body = body
  else if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body) }
  const r = await fetch('/api' + path, o)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'เกิดข้อผิดพลาด')
  return d
}
export const pct = (v) => (v == null ? '-' : (v * 100).toFixed(2) + '%')
