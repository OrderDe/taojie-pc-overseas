// Data layer for the Taojie shop "front" API (CRMEB-style public endpoints,
// the same ones the uniapp mini-program uses without login).
//
// Every call is defensive: any network error, timeout, CORS failure or
// unexpected payload shape falls back to the bundled sample data, and the
// caller learns via `meta.demo === true` that demo mode is active.

import { sampleCategories, sampleProducts, sampleKeywords, sampleBrands } from './data/sample.js'

export const API_BASE = (import.meta.env.VITE_API_BASE || 'https://mall.taojieyph.com/front').replace(/\/$/, '')

const TIMEOUT_MS = 6000

async function getJson(path, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  })
  const url = `${API_BASE}/${path}${qs.toString() ? `?${qs}` : ''}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    // CRMEB wraps payloads as { status, msg, data }
    if (body && typeof body === 'object' && 'data' in body) {
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
    price: Number(pick(raw, ['price', 'vipPrice'], 0)) || 0,
    otPrice: Number(pick(raw, ['otPrice', 'marketPrice', 'originalPrice'], 0)) || 0,
    sales: Number(pick(raw, ['sales', 'ficti', 'sold'], 0)) || 0,
    unit: String(pick(raw, ['unitName', 'unit'], 'pc')),
    moq: Number(pick(raw, ['minQty', 'moq'], 0)) || 0,
    image: String(pick(raw, ['image', 'pic', 'picUrl', 'sliderImage'], '')),
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
    const data = await getJson('product/category/get/tree/IntegrateCategory')
    const flat = []
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return
      nodes.forEach((n) => {
        flat.push({
          id: String(pick(n, ['id', 'value'], flat.length + 1)),
          name: String(pick(n, ['name', 'label', 'title'], 'Category')),
          count: Number(pick(n, ['count', 'productCount'], 0)) || 0
        })
        walk(n.child || n.children || n.list)
      })
    }
    walk(Array.isArray(data) ? data : listFrom(data))
    if (!flat.length) throw new Error('empty categories')
    return { items: flat.slice(0, 12), demo: false }
  } catch {
    return { items: sampleCategories, demo: true }
  }
}

export async function fetchProducts({ keyword = '', categoryId = '' } = {}) {
  const attempts = [
    () => getJson('product/list', { keyword, cateId: categoryId, page: 1, limit: 48 }),
    () => getJson('index/product/list', { keyword, page: 1, limit: 48 }),
    () => getJson('index/product', { keyword })
  ]
  for (const attempt of attempts) {
    try {
      const data = await attempt()
      const items = listFrom(data).map(normalizeProduct).filter(Boolean)
      if (items.length) return { items, demo: false }
    } catch { /* try next endpoint */ }
  }
  let items = sampleProducts
  if (categoryId) items = items.filter((p) => p.categoryId === categoryId)
  if (keyword) {
    const q = keyword.toLowerCase()
    items = items.filter((p) => (p.name + ' ' + p.category).toLowerCase().includes(q))
  }
  return { items, demo: true }
}

export async function fetchProductDetail(id) {
  try {
    const data = await getJson('product/detail', { textOriginalId: id, id })
    const raw = (data && (data.storeInfo || data.product || data.detail)) || data
    const normalized = normalizeProduct(raw)
    if (normalized && normalized.name !== 'Untitled product') return { item: normalized, demo: false }
    throw new Error('unexpected detail payload')
  } catch {
    const item = sampleProducts.find((p) => String(p.id) === String(id)) || sampleProducts[0]
    return { item, demo: true }
  }
}

export async function fetchKeywords() {
  try {
    const data = await getJson('index/search/keyword')
    const items = listFrom(data).map((k) => String(typeof k === 'string' ? k : pick(k, ['title', 'name', 'keyword'], ''))).filter(Boolean)
    if (items.length) return { items: items.slice(0, 8), demo: false }
    throw new Error('empty keywords')
  } catch {
    return { items: sampleKeywords, demo: true }
  }
}

export function demoBrands() { return sampleBrands }
