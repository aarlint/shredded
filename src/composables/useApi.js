export const api = {
  async get(url) {
    const r = await fetch('/api' + url)
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  },
  async post(url, body) {
    const r = await fetch('/api' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  },
  async patch(url, body) {
    const r = await fetch('/api' + url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  },
  async del(url) {
    const r = await fetch('/api' + url, { method: 'DELETE' })
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  },
  async upload(url, formData) {
    const r = await fetch('/api' + url, { method: 'POST', body: formData })
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  },
}

export function useApi() {
  return api
}
