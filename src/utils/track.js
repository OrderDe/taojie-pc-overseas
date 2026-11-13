// Visitor-statistics beacon for the overseas backend (POST /api/track).
//
// Every storefront visitor is reported — not only the ones who open
// the chat widget — so the admin 访客统计 page can show who is on the
// site, from where, on which page, and what they clicked. Identity is
// a random token in localStorage ('tj-visitor'), no account.
//
// Failure behaviour: strictly fire-and-forget. Any network error,
// timeout or backend absence is swallowed — tracking must never affect
// the page. That also means demo mode still reports (whether the shop
// data fell back to samples has nothing to do with the beacon).
//
// Page labels are short strings the admin timeline shows verbatim:
// 'home', 'catalogue', 'detail:<product name>'…

import { locale } from '../i18n.js'

const API_BASE = (import.meta.env?.VITE_API_BASE || '/api').replace(/\/$/, '')
const STORAGE_KEY = 'tj-visitor'

function newToken() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID()
  } catch { /* fall through to the manual random string */ }
  let s = ''
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `v-${Date.now().toString(36)}-${s}`
}

let token = ''
try { token = localStorage.getItem(STORAGE_KEY) || '' } catch { /* storage unavailable */ }
if (!token) {
  token = newToken()
  try { localStorage.setItem(STORAGE_KEY, token) } catch { /* storage unavailable */ }
}

let currentLabel = 'home'
let started = false
let getLabelFn = null

function post(type, extra = {}) {
  try {
    fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        type,
        page: currentLabel,
        referrer: document.referrer || '',
        lang: locale.value || 'en',
        ...extra
      }),
      keepalive: true
    }).then((res) => {
      // The server replaces a missing/malformed token with a fresh
      // one; adopt whatever it returns (Node answers bare JSON, the
      // Java backend wraps in {code, data}).
      return res.ok ? res.json() : null
    }).then((body) => {
      if (!body) return
      const data = body && typeof body === 'object' && 'code' in body && 'data' in body ? body.data : body
      if (data && data.token && data.token !== token) {
        token = data.token
        try { localStorage.setItem(STORAGE_KEY, token) } catch { /* storage unavailable */ }
      }
    }).catch(() => { /* silent by design */ })
  } catch { /* silent by design */ }
}

/** Report a page view under `label` (also becomes the heartbeat label). */
export function trackView(label) {
  if (label) currentLabel = String(label)
  post('view')
}

/** Report a click; never counts as a page view on the backend. */
export function trackClick(action) {
  post('click', { action: String(action || '') })
}

function heartbeat() {
  if (getLabelFn) {
    const label = getLabelFn()
    if (label) currentLabel = String(label)
  }
  post('heartbeat')
}

/**
 * Start the 30-second heartbeat. `getLabel` is called before every
 * heartbeat so the backend always learns the page the visitor is on
 * (App.vue passes a getter over its currentPageLabel ref). Calling
 * startTracking twice is a no-op.
 */
export function startTracking(getLabel) {
  if (started) return
  started = true
  getLabelFn = typeof getLabel === 'function' ? getLabel : null
  setInterval(heartbeat, 30000)
}
