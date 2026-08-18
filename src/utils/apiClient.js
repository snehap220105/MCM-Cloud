const API_BASE = 'http://localhost:5000/api/account-settings'

async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
  } catch {
    throw new Error('Cannot reach the backend — is it running on port 5000?')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const apiGet = (path) => request(path)
export const apiPost = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })
export const apiPatch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) })
