// Data layer for the overseas mall backend (taojie-overseas-server):
// public catalogue endpoints — categories / products / detail / keywords —
// plus RFQ submission. The tjmall "front" API is NOT used at runtime: it is
// the mini-program's login-based API (anonymous calls get 401); product data
// reaches this backend by sync/import from tjmall instead.
//
// Every call is defensive: any network error, timeout or unexpected payload
// shape falls back to the bundled sample data, and the caller learns via
// `meta.demo === true` that demo mode is active.

import { locale } from './i18n.js'

export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

const TIMEOUT_MS = 6000

async function getJson(path, params = {}, timeoutMs = TIMEOUT_MS) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  })
  const url = `${API_BASE}/${path}${qs.toString() ? `?${qs}` : ''}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    // CRMEB wraps payloads as { status, msg, data }
    if (body && typeof body === 'object' && 'data' in body) {
      if (body.code !== undefined && body.code !== 200) throw new Error(body.message || 'API error')
      if (body.status && body.status !== 200 && body.status !== 'success') throw new Error(body.msg || 'API error')
      return body.data
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

function pick(obj, keys, fallback = '') {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  return fallback
}

const PALETTES = [
  ['#ffd76e', '#ff9d1c'], ['#cfd8e3', '#7d8fa8'], ['#ff7ad9', '#7a5cff'],
  ['#8be0d4', '#2b7a6e'], ['#ff4b33', '#a30f00'], ['#aee3ff', '#4a90d9'],
  ['#b8f1cc', '#3d9e63'], ['#ffd9c2', '#e07b39']
]

export function normalizeProduct(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(pick(raw, ['storeName', 'store_name', 'name', 'title'], 'Untitled product'))
  const glyphSource = String(pick(raw, ['cateName', 'code', 'id'], name))
  const [c1, c2] = PALETTES[idx % PALETTES.length]
  const specs = {}
  const attr = pick(raw, ['attrInfo', 'productAttr', 'specs'], null)
  if (attr && typeof attr === 'object' && !Array.isArray(attr)) {
    Object.entries(attr).slice(0, 6).forEach(([k, v]) => { if (typeof v !== 'object') specs[k] = String(v) })
  }
  return {
    id: pick(raw, ['id', 'productId', 'textOriginalId'], idx + 1),
    name,
    categoryId: String(pick(raw, ['cateId', 'categoryId', 'cid'], '')),
    category: String(pick(raw, ['cateName', 'categoryName', 'category'], 'Products')),
    brandId: String(pick(raw, ['brandId', 'brand_id'], '')),
    brand: String(pick(raw, ['brand', 'brandName'], '')),
    price: Number(pick(raw, ['price', 'vipPrice'], 0)) || 0,
    otPrice: Number(pick(raw, ['otPrice', 'marketPrice', 'originalPrice'], 0)) || 0,
    sales: Number(pick(raw, ['sales', 'ficti', 'sold'], 0)) || 0,
    unit: String(pick(raw, ['unitName', 'unit'], 'pc')),
    moq: Number(pick(raw, ['minQty', 'moq'], 0)) || 0,
    image: String(pick(raw, ['image', 'pic', 'picUrl', 'sliderImage'], '')),
    video: String(pick(raw, ['video', 'videoUrl'], '')),
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [String(pick(raw,['image','pic','picUrl','sliderImage'],''))].filter(Boolean),
    videos: Array.isArray(raw.videos) ? raw.videos.filter(Boolean) : [String(pick(raw,['video','videoUrl'],''))].filter(Boolean),
    visual: [c1, c2, glyphSource.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'TJ'],
    tag: '',
    blurb: String(pick(raw, ['storeInfo', 'description', 'intro', 'keyword'], '')).replace(/<[^>]*>/g, '').slice(0, 160),
    specs,
    _raw: raw
  }
}

function listFrom(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  if (data && Array.isArray(data.records)) return data.records
  if (data && Array.isArray(data.content)) return data.content
  return []
}

export async function fetchCategories() {
  try {
    const data = await getJson('categories', { lang: locale.value })
    const flat = []
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return
      nodes.forEach((n) => {
        flat.push({
          id: String(pick(n, ['id', 'value'], flat.length + 1)),
          name: String(pick(n, ['name', 'label', 'title'], 'Category')),
          parentId: String(n.parentId || ''),
          level: Number(n.level || 1),
          pathName: String(n.pathName || n.name || ''),
          count: Number(pick(n, ['count', 'productCount'], 0)) || 0
        })
        walk(n.child || n.children || n.list)
      })
    }
    walk(Array.isArray(data) ? data : listFrom(data))
    return { items: flat.filter(category => category.count > 0), demo: false }
  } catch {
    return { items: [], demo: false, error: true }
  }
}

export async function fetchProducts({ keyword = '', categoryId = '', brandId = '' } = {}) {
  try {
    const data = await getJson('products', { keyword, categoryId, brandId, page: 1, limit: 48, lang: locale.value })
    const items = listFrom(data).map(normalizeProduct).filter(Boolean)
    return { items, demo: false }
  } catch {
    return { items: [], demo: false, error: true }
  }
}

export async function fetchProductDetail(id) {
  try {
    const data = await getJson(`products/${encodeURIComponent(id)}`, { lang: locale.value })
    const raw = (data && (data.storeInfo || data.product || data.detail)) || data
    const normalized = normalizeProduct(raw)
    if (normalized && normalized.name !== 'Untitled product') return { item: normalized, demo: false }
    throw new Error('unexpected detail payload')
  } catch {
    return { item: null, demo: false, error: true }
  }
}

export async function fetchKeywords() {
  try {
    const data = await getJson('keywords', { lang: locale.value })
    const items = listFrom(data).map((k) => String(typeof k === 'string' ? k : pick(k, ['title', 'name', 'keyword'], ''))).filter(Boolean)
    return { items: items.slice(0, 8), demo: false }
  } catch {
    return { items: [], demo: false, error: true }
  }
}

// Submit an RFQ to the overseas backend. Returns true when the backend
// stored it; false means the caller should keep its local fallback copy.
export async function submitRfq(payload) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${API_BASE}/rfq`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, lang: locale.value })
      })
      return res.ok
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

// ---- Online chat (visitor side) ----
// Identity is a random session token kept in localStorage by the widget;
// the backend unwraps the same way as the rest of the API (Node returns
// plain JSON, Java wraps in CommonResult { code, message, data }).
async function chatFetch(path, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...opts
    })
    let body = null
    try { body = await res.json() } catch { /* empty body */ }
    if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
      if (body.code !== 200) throw new Error(body.message || 'chat request failed')
      return body.data
    }
    if (!res.ok) throw new Error((body && body.error) || `HTTP ${res.status}`)
    return body
  } finally {
    clearTimeout(timer)
  }
}

// Create a chat session, or reuse the existing one when `token` is known.
// The widget also reports where the visitor came from and which page they
// are on, so the admin console can show a small visitor profile.
// Product attachment: pass `product` (snapshot object) to set/replace the
// product the visitor is asking about, or `clearProduct: true` to remove
// it; omit both and the stored snapshot is left untouched.
export async function chatStart({ name = '', token = '', referrer = '', page = '', pageTitle = '', product, clearProduct = false } = {}) {
  const payload = { name, token, lang: locale.value, referrer, page, pageTitle }
  if (product !== undefined && product !== null) payload.product = product
  if (clearProduct) payload.clearProduct = true
  return chatFetch('chat/start', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

// Heartbeat: keeps the session "online" in the admin console and follows
// the visitor when they move to another page.
export async function chatPing(token, { page = '', pageTitle = '' } = {}) {
  return chatFetch('chat/ping', {
    method: 'POST',
    body: JSON.stringify({ token, page, pageTitle })
  })
}

// "Visitor is typing…" signal (callers throttle this).
export async function chatTyping(token) {
  return chatFetch('chat/typing', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
}

export async function chatSend(token, body) {
  return chatFetch('chat/messages', {
    method: 'POST',
    body: JSON.stringify({ token, body })
  })
}

// Pull this session's messages, incrementally when afterId is given.
export async function chatPull(token, afterId = 0) {
  return chatFetch(`chat/messages?token=${encodeURIComponent(token)}&afterId=${Math.max(0, afterId || 0)}`)
}

// Brand list from the backend's public brands endpoint, as [{id, name}]
// so the chips can filter by brandId; falls back to the bundled sample
// list (same shape) when the backend is unreachable or has none.
export async function fetchBrands({ categoryId = '' } = {}) {
  try {
    const data = await getJson('brands', { lang: locale.value, categoryId })
    const items = listFrom(data)
      .map((b) => (typeof b === 'string'
        ? { id: '', name: b }
        : { id: String(pick(b, ['id', 'value'], '')), name: String(pick(b, ['name', 'label', 'title'], '')) }))
      .filter((b) => b.name && b.id)
    return { items, demo: false }
  } catch {
    return { items: [], demo: false, error: true }
  }
}

export function demoBrands() { return [] }

// ---- Paint formula library (/api/formula/*) ----
// No demo fallback here by design: when the backend is unreachable the
// formula page shows its empty state rather than invented colours.
export async function fetchFormulaBrands() {
  try {
    const data = await getJson('formula/brands', { lang: locale.value }, 90000)
    const items = (Array.isArray(data) ? data : [])
      .map((b) => ({ id: String(b.id ?? ''), name: String(b.name ?? '') }))
      .filter((b) => b.id && b.name)
    return { items, error: false }
  } catch {
    return { items: [], error: true }
  }
}

export async function fetchFormulaModels(brandId = '') {
  try {
    const data = await getJson('formula/models', { brandId, lang: locale.value }, 90000)
    const items = (Array.isArray(data) ? data : [])
      .map((m) => ({ id: String(m.id ?? ''), brandId: String(m.brandId ?? ''), model: String(m.model ?? '') }))
      .filter((m) => m.id && m.model)
    return { items, error: false }
  } catch {
    return { items: [], error: true }
  }
}

export async function fetchFormulaSearch({ brandId = '', modelId = '', keyword = '', page = 1, pageSize = 15 } = {}) {
  try {
    const data = await getJson('formula/search', { brandId, modelId, keyword, page, pageSize, lang: locale.value }, 90000)
    const items = (data && Array.isArray(data.items) ? data.items : [])
      .map((c) => ({
        id: String(c.id ?? ''), brandId: String(c.brandId ?? ''), brandName: String(c.brandName ?? ''),
        modelId: String(c.modelId ?? ''), modelName: String(c.modelName ?? ''),
        carColor: String(c.carColor ?? ''), factoryColor: String(c.factoryColor ?? ''),
        colorNum: String(c.colorNum ?? ''), cardNum: String(c.cardNum ?? ''),
        carImage: String(c.carImage ?? ''), updateTime: String(c.updateTime ?? '')
      }))
      .filter((c) => c.id)
    return { items, total: Number(data?.total || 0), page: Number(data?.page || page), pageSize: Number(data?.pageSize || pageSize), error: false }
  } catch {
    return { items: [], total: 0, page, pageSize, error: true }
  }
}

export async function fetchFormulaDetail(id) {
  try {
    const data = await getJson(`formula/colors/${encodeURIComponent(id)}`, { lang: locale.value }, 90000)
    if (!data || !data.id) return { item: null, error: true }
    return { item: data, error: false }
  } catch {
    return { item: null, error: true }
  }
}

// ---- Custom pages (/api/pages/*) ----
// Admin-authored standalone pages the nav can point at. The payload is
// already multilingual ({lang: text} maps), so — unlike the catalogue —
// nothing is language-resolved here; the view resolves via tx().
// Demo fallback: with the backend unreachable, the bundled sample
// "cases" page (same content the backend seeds) still renders, so the
// feature is visible in demo mode; any other slug shows the not-found
// state.
const DEMO_CUSTOM_PAGES = {
  cases: {
    slug: 'cases',
    titles: { zh: '客户案例', en: 'Cases' },
    sections: [
      {
        title: { zh: '我们的工厂', en: 'Our Factory' },
        body: { zh: '我们拥有专业的生产设备与经验丰富的生产团队。\n\n产品质量有保障，发货速度快！', en: 'WE HAVE PROFESSIONAL PRODUCTION EQUIPMENT AND EXPERIENCED MANUFACTURERS.\n\nTHE QUALITY OF THE PRODUCT IS GUARANTEED, AND THE SHIPMENT SPEED IS FAST!' },
        image: 'https://youjia-oss.youjiakj.com/williscarpaint/Upload/20260524/1779626894357.jpg'
      },
      {
        title: { zh: '仓储与发货', en: 'Warehousing & Shipping' },
        body: { zh: '专业的生产设备与经验丰富的生产团队，产品质量有保障，发货速度快。', en: 'Professional production equipment and an experienced team — guaranteed product quality and fast shipment.' },
        image: 'https://youjia-oss.youjiakj.com/williscarpaint/Upload/20260524/1779626894649.jpg'
      }
    ],
    gallery: [
      'https://youjia-oss.youjiakj.com/williscarpaint/Upload/20260524/1779626894497.jpg',
      'https://youjia-oss.youjiakj.com/williscarpaint/Upload/20260524/1779626894850.jpg',
      'https://youjia-oss.youjiakj.com/williscarpaint/Upload/20260524/1779626894947.jpg'
    ]
  }
}

function normalizeCustomPage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const langMap = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
  return {
    slug: String(raw.slug || ''),
    titles: langMap(raw.titles),
    sections: (Array.isArray(raw.sections) ? raw.sections : [])
      .filter((s) => s && typeof s === 'object' && !Array.isArray(s))
      .map((s) => ({ title: langMap(s.title), body: langMap(s.body), image: typeof s.image === 'string' ? s.image : '' })),
    gallery: (Array.isArray(raw.gallery) ? raw.gallery : []).filter((u) => typeof u === 'string' && u)
  }
}

export async function fetchCustomPage(slug) {
  try {
    const data = await getJson(`pages/${encodeURIComponent(slug)}`, {}, 9000)
    const item = normalizeCustomPage(data)
    if (!item || !item.slug) return { item: null, demo: false, error: true }
    return { item, demo: false, error: false }
  } catch {
    const demo = DEMO_CUSTOM_PAGES[slug]
    if (demo) return { item: normalizeCustomPage(demo), demo: true, error: false }
    return { item: null, demo: false, error: true }
  }
}
