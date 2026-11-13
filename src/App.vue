<script setup>
import { navigationItems } from './utils/navigation'
import { computed, onMounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CartDrawer from './components/CartDrawer.vue'
import RfqPanel from './components/RfqPanel.vue'
import ChatWidget from './components/ChatWidget.vue'
import SocialWidget from './components/SocialWidget.vue'
import { fetchCategories, fetchKeywords, fetchProducts, fetchProductDetail, fetchBrands, demoBrands, fetchFormulaBrands, fetchFormulaModels, fetchFormulaSearch, fetchFormulaDetail, fetchCustomPage } from './api.js'
import { siteConfig } from './siteConfig.js'
import { LANGS, locale, setLocale, t, tx, themeText } from './i18n.js'
import { CURRENCIES, displayCode, baseCode, isConverted, formatPrice, initFx, setDisplay, currencyForLocale } from './utils/currency.js'
import { startTracking, trackView, trackClick } from './utils/track.js'
import { buildChatProduct, saveChatProduct } from './utils/chatProduct.js'
import { showAsNegotiable } from './utils/pricing.js'

const THEMES = {
  a: { label: 'A · Classic Mall' },
  b: { label: 'B · Cross-Border Pro' },
  c: { label: 'C · Minimal Modern' },
  d: { label: 'D · Dark Industrial' },
  e: { label: 'E · Orange Pulse' },
  f: { label: 'F · Editorial Wholesale' },
  g: { label: 'G · Port Trade' },
  h: { label: 'H · Colour Field' }
}
// All visitors use the theme selected in the admin site configuration.
const theme = computed(() => {
  const key = String(siteConfig.defaultTheme || 'h').toLowerCase()
  return THEMES[key] ? key : 'h'
})

const view = ref('home') // 'home' | 'detail' | 'formula' | 'profile' | 'page'
const categories = ref([])
const products = ref([])
const keywords = ref([])
const brands = ref(demoBrands())
const demoMode = ref(false)
const loading = ref(true)
const query = ref('')
const searchedQuery = ref('')
const activeCategory = ref('')
const activeBrand = ref('')
const selected = ref(null)
// Detail page renders as 面议 when the product is negotiable OR the
// admin's global price switch (showPrices) is off.
const selectedNegotiable = computed(() => showAsNegotiable(selected.value))
const expandedCategoryIds = ref(new Set())
const navigationCategories = computed(() => {
  const result = []
  const walk = (parentId) => {
    for (const c of categories.value.filter(row => String(row.parentId || '') === parentId)) {
      result.push({ ...c, hasChildren: categories.value.some(row => String(row.parentId || '') === String(c.id)) })
      if (expandedCategoryIds.value.has(String(c.id))) walk(String(c.id))
    }
  }
  walk('')
  return result
})
const cart = ref([])
const cartOpen = ref(false)
const rfqProduct = ref('')
// RFQ form lives in a global modal (no in-flow section any more);
// rfqNonce remounts the panel per open so its form/done state resets
// and the product prefill applies afresh.
const rfqOpen = ref(false)
const rfqNonce = ref(0)
const toast = ref('')
// Label of the page the visitor is currently on, for the statistics
// beacon: heartbeats report it, trackView updates it at each stop.
const currentPageLabel = ref('home')

// A configured logo doubles as the browser tab favicon; an empty logo
// leaves the built-in favicon untouched.
watch(() => siteConfig.logo, (logo) => {
  if (!logo) return
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = logo
}, { immediate: true })

const langOpen = ref(false)
const currentLang = computed(() => LANGS.find((l) => l.code === locale.value) || LANGS[0])
// Soft link: changing the language also brings its default currency
// along (see LANG_CURRENCY in utils/currency.js). The currency pill
// stays independently clickable afterwards — a manual pickCurrency is
// honoured until the next language change. Demo mode has no currency
// switcher, so the link is skipped there.
function pickLang(code) {
  setLocale(code)
  if (!demoMode.value) {
    const linked = currencyForLocale(code)
    if (linked) setDisplay(linked)
  }
  langOpen.value = false
}

const curOpen = ref(false)
function pickCurrency(code) { setDisplay(code); curOpen.value = false }

const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0))
const meta = computed(() => THEMES[theme.value])
const heroTitle = computed(() => siteConfig.heroTitle || themeText(theme.value).headline)
const heroSub = computed(() => siteConfig.heroSubtitle || themeText(theme.value).sub)
// Hero side column: the contact card (showContact, default on — contact
// details only, no dealer wording), falling back to the dealer card only
// when the contact card is off and the dealer card is on. (The RFQ form
// used to sit here for theme G; it is a global modal now.) The column
// exists only when one of them is enabled, so hiding them all leaves
// no empty grid track.
const heroSideVisible = computed(() => siteConfig.showContact || siteConfig.showDealer)
// Top navigation: admin-configured navItems win; empty = i18n defaults
// (label-only items with no click action).
const zones = computed(() => navigationItems(siteConfig,t))

// Nav click dispatch. Items saved by the current admin carry an explicit
// type; older items have none, so infer from link — http(s) → external,
// #… → anchor, anything else (or empty) → no action, as before.
function navType(item) {
  const type = String(item.type || '')
  if (type === 'category' || type === 'anchor' || type === 'external' || type === 'page') return type
  const link = String(item.link || '')
  if (/^https?:\/\//i.test(link)) return 'external'
  if (link.startsWith('#page/')) return 'page'
  if (link.startsWith('#')) return 'anchor'
  return ''
}
function scrollToAnchor(id) {
  // Same deferred scrollIntoView pattern as requestQuote: the home view
  // may need one render pass first when coming from the detail view.
  // A missing element (e.g. the dealer card is switched off) is a no-op.
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60)
}
async function onNav(item) {
  trackClick(`导航:${item.label}`)
  const type = navType(item)
  if (type === 'page') {
    const slug = pageSlugFromLink(item.link) || pageSlugFromLink(item.pageSlug)
    if (slug) { openCustomPage(slug); return }
  }
  clearPageHash()
  if (type === 'category') {
    await pickCategory(String(item.categoryId || ''))
    scrollToAnchor('catalogue')
  } else if (type === 'anchor') {
    // The formula library and company profile are app views, reachable
    // from admin-configured nav items via the #formula / #profile links.
    if (item.link === '#formula') { openFormula(); return }
    if (item.link === '#profile') { openProfile(); return }
    // The RFQ form is a modal now, not a page section: #rfq opens it
    // from whatever view the visitor is on.
    if (item.link === '#rfq') { openRfqModal(); return }
    const id = String(item.link || '').replace(/^#/, '')
    if (!id) return
    view.value = 'home'
    scrollToAnchor(id)
  } else if (type === 'external') {
    if (item.link) window.open(item.link, '_blank', 'noopener')
  }
}

// Real category names are full paths ("汽车油漆 / 1K银粉色母系列 / 1K银粉色母系列");
// compact UI spots show only the leaf segment.
function leafName(name) {
  const parts = String(name || '').split('/').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : String(name || '')
}
const resultsTitle = computed(() => {
  if (searchedQuery.value) return t('searchResults', { q: searchedQuery.value })
  if (activeCategory.value) {
    const c = categories.value.find((x) => String(x.id) === activeCategory.value)
    return c ? tx(c.name) : t('categoryTitle')
  }
  return t('featured')
})

function noteDemo(d) { if (d) demoMode.value = true }
function showToast(msg) { toast.value = msg; setTimeout(() => { toast.value = '' }, 2200) }

let productsRequest = 0
async function loadProducts() {
  const request = ++productsRequest
  loading.value = true
  const { items, demo, error } = await fetchProducts({ keyword: query.value, categoryId: activeCategory.value, brandId: activeBrand.value })
  if (request !== productsRequest) return
  if (error) showToast('商品加载失败，请稍后重试')
  products.value = items
  noteDemo(demo)
  loading.value = false
}

async function loadBrands() {
  const categoryId = activeCategory.value
  const lang = locale.value
  const { items } = await fetchBrands({ categoryId })
  if (categoryId !== activeCategory.value || lang !== locale.value) return
  brands.value = items
  if (!items.some((b) => String(b.id) === activeBrand.value)) activeBrand.value = ''
}

async function onSearch() {
  const q = query.value.trim()
  if (q) trackClick(`搜索:${q}`)
  view.value = 'home'; searchedQuery.value = q; activeBrand.value = ''; await loadProducts()
  currentPageLabel.value = 'catalogue'; trackView('catalogue')
}
async function pickCategory(id, toggleBranch = false) {
  const expanded = new Set(expandedCategoryIds.value)
  const wasExpanded = expanded.has(id)
  const visited = new Set()
  let ancestorId = id
  while (ancestorId && !visited.has(ancestorId)) {
    visited.add(ancestorId)
    expanded.add(ancestorId)
    ancestorId = String(categories.value.find(c => String(c.id) === ancestorId)?.parentId || '')
  }
  if (!id) expanded.clear()
  else if (toggleBranch && wasExpanded) expanded.delete(id)
  expandedCategoryIds.value = expanded
  const cat = categories.value.find((c) => String(c.id) === id)
  trackClick(`分类:${id ? (cat ? leafName(tx(cat.name)) : id) : '全部'}`)
  activeCategory.value = id
  query.value = ''
  searchedQuery.value = ''
  activeBrand.value = ''
  view.value = 'home'
  await Promise.all([loadProducts(), loadBrands()])
  currentPageLabel.value = 'catalogue'; trackView('catalogue')
}
// Brand chip toggle: clicking the selected brand (or the "all" chip) clears it.
async function pickBrand(id) {
  const brand = brands.value.find((b) => String(b.id) === id)
  trackClick(`品牌:${brand ? brand.name : '全部'}`)
  activeBrand.value = activeBrand.value === id ? '' : id; await loadProducts()
}

async function openProduct(p) {
  const name = tx(p.name)
  trackClick(`点商品:${name}`)
  const { item, demo } = await fetchProductDetail(p.id)
  if (!item) { showToast('商品详情加载失败，请稍后重试'); return }
  selected.value = { ...p, ...item, specs: { ...(p.specs || {}), ...(item.specs || {}) } }
  noteDemo(demo)
  view.value = 'detail'
  currentPageLabel.value = `detail:${name}`; trackView(currentPageLabel.value)
  window.scrollTo({ top: 0 })
}

// ---- Paint formula library + company profile ----
// Data comes only from /api/formula/*; with the backend down the page
// shows its empty state (no demo colours are invented).
const formulaBrands = ref([])
const formulaModels = ref([])
const fBrand = ref('')
const fModel = ref('')
const fKeyword = ref('')
const formulaRows = ref([])
const formulaTotal = ref(0)
const formulaPage = ref(1)
const FORMULA_PAGE_SIZE = 15
const formulaLoading = ref(false)
const formulaSearched = ref(false)
const formulaDetail = ref(null)
const recipeGrams = ref(1000)
const formulaPages = computed(() => Math.max(1, Math.ceil(formulaTotal.value / FORMULA_PAGE_SIZE)))

let formulaSearchRequest = 0
let formulaModelsRequest = 0
let formulaDetailRequest = 0
async function loadFormulaModels() {
  const request = ++formulaModelsRequest
  const lang = locale.value
  if (!fBrand.value) { formulaModels.value = []; fModel.value = ''; return }
  const { items } = await fetchFormulaModels(fBrand.value)
  if (request !== formulaModelsRequest || lang !== locale.value) return
  formulaModels.value = items
  if (!items.some((m) => m.id === fModel.value)) fModel.value = ''
}
async function runFormulaSearch(page = 1) {
  const request = ++formulaSearchRequest
  const lang = locale.value
  formulaLoading.value = true
  const { items, total } = await fetchFormulaSearch({
    brandId: fBrand.value, modelId: fModel.value, keyword: fKeyword.value.trim(),
    page, pageSize: FORMULA_PAGE_SIZE
  })
  if (request !== formulaSearchRequest || lang !== locale.value) return
  formulaRows.value = items
  formulaTotal.value = total
  formulaPage.value = page
  formulaSearched.value = true
  formulaLoading.value = false
}
async function onFormulaBrandChange() { fModel.value = ''; await loadFormulaModels() }
async function openFormula() {
  view.value = 'formula'
  formulaDetail.value = null
  currentPageLabel.value = 'formula'; trackView('formula')
  window.scrollTo({ top: 0 })
  if (!formulaBrands.value.length) {
    const [{ items }] = await Promise.all([fetchFormulaBrands(), loadFormulaModels()])
    formulaBrands.value = items
  }
  if (!formulaSearched.value) runFormulaSearch(1)
}
async function openFormulaDetail(row) {
  const request = ++formulaDetailRequest
  const lang = locale.value
  trackClick(`配方:${row.colorNum || row.carColor}`)
  const { item } = await fetchFormulaDetail(row.id)
  if (request !== formulaDetailRequest || lang !== locale.value) return
  if (!item) { showToast(t('formulaEmpty')); return }
  formulaDetail.value = item
  recipeGrams.value = 1000
  currentPageLabel.value = `formula:${item.colorNum || item.carColor}`; trackView(currentPageLabel.value)
  window.scrollTo({ top: 0 })
}
function openProfile() {
  view.value = 'profile'
  currentPageLabel.value = 'profile'; trackView('profile')
  window.scrollTo({ top: 0 })
  loadProfileShowcase()
}
// ---- Custom pages (admin-authored standalone pages) ----
// A nav item of type 'page' carries its target as link '#page/<slug>';
// the view also opens on a matching location.hash, so shared links and
// refreshes land on the page. Content comes from /api/pages/:slug; a
// hidden or unknown slug (or an unreachable backend without a bundled
// sample) lands on the pageNotFound empty state.
const PAGE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/
function pageSlugFromLink(link) {
  const raw = String(link || '').trim()
  const slug = raw.startsWith('#page/') ? raw.slice(6) : raw.startsWith('page/') ? raw.slice(5) : raw
  return PAGE_SLUG_RE.test(slug) ? slug : ''
}
function pageSlugFromHash(hash) {
  const raw = String(hash || '')
  return raw.startsWith('#page/') ? pageSlugFromLink(raw) : ''
}
function clearPageHash() {
  if (pageSlugFromHash(window.location.hash)) {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
const customPage = ref(null)
const customPageSlug = ref('')
const customPageLoading = ref(false)
let customPageRequest = 0
async function openCustomPage(slug) {
  if (!PAGE_SLUG_RE.test(String(slug || ''))) return
  const targetHash = `#page/${slug}`
  if (window.location.hash !== targetHash) history.replaceState(null, '', targetHash)
  view.value = 'page'
  customPageSlug.value = slug
  customPage.value = null
  customPageLoading.value = true
  currentPageLabel.value = `page:${slug}`; trackView(currentPageLabel.value)
  window.scrollTo({ top: 0 })
  const request = ++customPageRequest
  const { item, demo } = await fetchCustomPage(slug)
  if (request !== customPageRequest) return
  noteDemo(demo)
  customPage.value = item
  customPageLoading.value = false
}
// Sections that resolve to nothing in every language (and carry no
// image) are dropped, same rule as the profile page sections.
const customPageSections = computed(() => (customPage.value?.sections || [])
  .filter((s) => s && (tx(s.title) || sectionParas(s).length || sectionImage(s))))
// ---- Company profile (native page, prototype layout) ----
// profileContent is shape-guarded by the backend and normalised by
// mergeConfig; the filters here only drop unusable entries. Sections
// are matched to layout slots by title keywords — every stored
// language is searched, so a section keeps its slot whatever UI
// language the visitor picked; sections matched to no slot render in
// the two-column zone, so no stored content is ever lost. When no
// custom content exists at all, the profile view falls back to the
// storyTitle/storyText text version.
const profileGallery = computed(() => (siteConfig.profileContent?.gallery || []).filter((u) => typeof u === 'string' && u))
function sectionParas(s) {
  return String(tx(s?.body) || '').split(/\n+/).map((p) => p.trim()).filter(Boolean)
}
function sectionBullets(s) {
  return (s?.bullets || []).map((b) => tx(b)).filter(Boolean)
}
function sectionImage(s) {
  return typeof s?.image === 'string' && s.image ? s.image : ''
}
const customSections = computed(() => (siteConfig.profileContent?.sections || [])
  .filter((s) => s && (tx(s.title) || sectionParas(s).length || sectionBullets(s).length || sectionImage(s))))

// Banner: title/subtitle are {lang: text} maps and the image a plain
// URL. A missing banner title falls back to the story title, then to
// the page name, so the band is never blank.
const profileBanner = computed(() => {
  const b = siteConfig.profileContent?.banner
  const o = b && typeof b === 'object' && !Array.isArray(b) ? b : {}
  return {
    title: o.title && typeof o.title === 'object' && !Array.isArray(o.title) ? o.title : {},
    subtitle: o.subtitle && typeof o.subtitle === 'object' && !Array.isArray(o.subtitle) ? o.subtitle : {},
    image: typeof o.image === 'string' ? o.image : ''
  }
})
const bannerTitle = computed(() => tx(profileBanner.value.title) || siteConfig.storyTitle || t('companyProfile'))
const bannerSubtitle = computed(() => tx(profileBanner.value.subtitle))

// Section → layout-slot matching by title keywords. Order matters:
// "Technical Team & Support" contains "Support", so the tech matcher
// runs before the support one. There is deliberately no slot for the
// product-lineup section: the live category / featured blocks below
// replace it, and the section itself still renders via the
// unmatched-sections zone.
const SECTION_MATCHERS = [
  ['about', ['关于我们', 'about us', 'about']],
  ['tech', ['技术团队', 'technical', 'technology']],
  ['quality', ['质量', 'quality', 'certification']],
  ['factory', ['工厂', 'factory']],
  ['facts', ['企业概况', 'company facts', 'facts']],
  ['support', ['出口', 'support', 'service']]
]
function sectionRole(s) {
  const text = Object.values(s?.title || {}).filter((v) => typeof v === 'string').join(' ').toLowerCase()
  if (!text) return ''
  for (const [role, words] of SECTION_MATCHERS) {
    if (words.some((w) => text.includes(w))) return role
  }
  return ''
}
const profileBuckets = computed(() => {
  const list = customSections.value
  const assigned = new Map()
  for (const [role] of SECTION_MATCHERS) {
    const hit = list.find((s) => !assigned.has(s) && sectionRole(s) === role)
    if (hit) assigned.set(hit, role)
  }
  // About slot: the matched section, else the first unassigned one,
  // else simply the first section — the intro block never disappears.
  let about = list.find((s) => assigned.get(s) === 'about') || null
  if (!about) {
    about = list.find((s) => !assigned.has(s)) || list[0] || null
    if (about) assigned.set(about, 'about')
  }
  const get = (role) => list.find((s) => assigned.get(s) === role) || null
  return {
    about,
    support: get('support'),
    factory: get('factory'),
    facts: get('facts'),
    duo: [get('quality'), get('tech'), ...list.filter((s) => !assigned.has(s))].filter(Boolean)
  }
})
const aboutSection = computed(() => profileBuckets.value.about)
const supportSection = computed(() => profileBuckets.value.support)
const factorySection = computed(() => profileBuckets.value.factory)
const factsSection = computed(() => profileBuckets.value.facts)
const duoSections = computed(() => profileBuckets.value.duo)

// Testimonials / FAQs: entries that resolve to nothing in every
// language are dropped; both blocks render only when non-empty.
const profileTestimonials = computed(() => (siteConfig.profileContent?.testimonials || [])
  .filter((x) => x && tx(x.text)))
const profileFaqs = computed(() => (siteConfig.profileContent?.faqs || [])
  .filter((f) => f && tx(f.q)))
function faqParas(f) {
  return String(tx(f?.a) || '').split(/\n+/).map((p) => p.trim()).filter(Boolean)
}
const profileHasCustom = computed(() => customSections.value.length > 0 || profileGallery.value.length > 0
  || profileTestimonials.value.length > 0 || profileFaqs.value.length > 0
  || !!tx(profileBanner.value.title) || !!profileBanner.value.image)

// ---- Profile showcase: live catalogue linkage ----
// Category cards come from the real willis-* categories (card image =
// first product photo found in that category; a category with no
// photo anywhere is skipped), and the featured row is picked from the
// WILLIS brand by the prototype's model keywords, then filled from
// the rest of the brand pool. Loads lazily on the first profile
// visit; with no such data both blocks simply stay hidden.
// Prototype models for the featured row. Hardener / thinner are
// generic words (they match 100+ products via blurbs), so those two
// picks go straight to their dedicated willis categories instead of
// a keyword search.
const FEATURED_PICKS = [
  { kw: 'W990' },
  { kw: 'Hardener', categoryId: 'willis-hardener-curing-agent' },
  { kw: 'thinner', categoryId: 'willis-thinner' },
  { kw: '163A' },
  { kw: 'W-L97A' },
  { kw: 'W635' },
  { kw: '201' },
  { kw: '207' }
]
const willisCategories = computed(() => categories.value.filter((c) => String(c.id).startsWith('willis-')))
const profileCatImages = ref({})
const featuredProducts = ref([])
let showcaseRequested = false
function isWillisProduct(p) {
  return String(p?.brandId || '') === 'willis' || /willis/i.test(String(p?.brand || ''))
    || String(p?.categoryId || '').startsWith('willis-')
}
async function fillCategoryImages(cats) {
  const missing = (cats || []).filter((c) => !profileCatImages.value[String(c.id)])
  await Promise.all(missing.map(async (c) => {
    const { items } = await fetchProducts({ categoryId: String(c.id) })
    const hit = items.find((p) => p.image)
    if (hit) profileCatImages.value = { ...profileCatImages.value, [String(c.id)]: hit.image }
  }))
}
async function loadProfileShowcase() {
  if (showcaseRequested) return
  showcaseRequested = true
  const { items: pool } = await fetchProducts({ brandId: 'willis' })
  // One keyword search per prototype model; the backend matches
  // keywords against every stored language of a name, so the model
  // codes hit regardless of the visitor's UI language.
  const hits = await Promise.all(FEATURED_PICKS.map(async (pick) => {
    const { items } = pick.categoryId
      ? await fetchProducts({ categoryId: pick.categoryId })
      : await fetchProducts({ keyword: pick.kw })
    const willis = items.filter(isWillisProduct)
    // Prefer a name match: the backend also searches blurbs, so a
    // keyword can hit products that merely mention it in their copy
    // (every paint mentions "hardener"); the prototype models are the
    // ones carrying the code in their name.
    return willis.find((p) => String(p.name || '').toLowerCase().includes(pick.kw.toLowerCase())) || willis[0] || null
  }))
  const picked = []
  const seen = new Set()
  const pushUnique = (p) => { if (p && !seen.has(String(p.id))) { seen.add(String(p.id)); picked.push(p) } }
  hits.forEach(pushUnique)
  for (const p of pool) { if (picked.length >= 8) break; pushUnique(p) }
  featuredProducts.value = picked.slice(0, 8)
  // Category card images: brand pool + featured picks first, then a
  // per-category fetch for whatever is still missing a photo.
  const images = { ...profileCatImages.value }
  for (const p of [...pool, ...picked]) {
    const cid = String(p?.categoryId || '')
    if (cid && p.image && !images[cid]) images[cid] = p.image
  }
  profileCatImages.value = images
  await fillCategoryImages(willisCategories.value)
}
// Categories can land after the first profile visit (initial page
// load); top up any card images that are still missing then.
watch(willisCategories, (cats) => { if (view.value === 'profile') fillCategoryImages(cats) })
const willisCategoryCards = computed(() => willisCategories.value
  .map((c) => ({ ...c, image: profileCatImages.value[String(c.id)] || '' }))
  .filter((c) => c.image))
async function openProfileCategory(c) {
  await pickCategory(String(c.id))
  scrollToAnchor('catalogue')
}
// Recipe math for one colour number: share = dose / total dose of its
// lines; grams and running cumulative follow the visitor's total grams.
function recipeRows(lines) {
  const list = lines || []
  const total = list.reduce((s, l) => s + (Number(l.dose) || 0), 0)
  let acc = 0
  return list.map((l) => {
    const dose = Number(l.dose) || 0
    const grams = total > 0 ? (Number(recipeGrams.value) || 0) * dose / total : 0
    acc += grams
    return { ...l, share: total > 0 ? dose / total * 100 : 0, grams, cumulative: acc }
  })
}

function addToCart(p) {
  const found = cart.value.find((i) => String(i.id) === String(p.id))
  if (found) found.qty += 1
  else cart.value.push({ id: p.id, name: p.name, price: p.price, unit: p.unit, visual: p.visual, qty: 1 })
  showToast(t('added', { name: tx(p.name) }))
}
function removeFromCart(id) { cart.value = cart.value.filter((i) => String(i.id) !== String(id)) }
// Top-bar Help opens the online chat panel (ChatWidget listens for this).
function openHelpChat() { window.dispatchEvent(new Event('tj-open-chat')) }
// 索取报价 / 联系销售 entries open the RFQ modal (globally mounted, so
// it works from any view). showRfq stays the admin kill-switch: with it
// off, the entries are inert just like the old hidden section was.
function requestQuote(p) {
  trackClick('点联系销售/询价')
  rfqProduct.value = p ? tx(p.name) : ''
  openRfqModal()
}
function openRfqModal() {
  if (!siteConfig.showRfq) return
  rfqNonce.value += 1
  rfqOpen.value = true
}
function closeRfqModal() { rfqOpen.value = false }
// 询价 on a product (card / detail page): open the online chat with the
// product attached, instead of scrolling to the RFQ form. The ChatWidget
// owns the attachment state; it also persists locally so the widget
// still shows the product card when it mounts after this event.
function requestQuoteChat(p) {
  const snapshot = buildChatProduct(p)
  if (!snapshot) return
  trackClick('询价打开聊天')
  saveChatProduct(snapshot)
  window.dispatchEvent(new CustomEvent('tj-open-chat', { detail: { product: snapshot } }))
}

async function refreshCatalogue() {
  const lang = locale.value
  ++productsRequest
  loading.value = true
  const [cats, kws] = await Promise.all([fetchCategories(), fetchKeywords(), loadBrands()])
  if (lang !== locale.value) return
  categories.value = cats.items
  keywords.value = kws.items
  noteDemo(cats.demo || kws.demo)
  await loadProducts()
  if (view.value === 'detail' && selected.value) {
    const id = selected.value.id
    const { item } = await fetchProductDetail(id)
    if (lang === locale.value && selected.value?.id === id && item) selected.value = item
  }
}
async function refreshFormulaLanguage() {
  if (view.value !== 'formula') {
    formulaBrands.value = []
    formulaModels.value = []
    formulaRows.value = []
    formulaSearched.value = false
    formulaDetail.value = null
    return
  }
  const lang = locale.value
  const detailId = formulaDetail.value?.id
  ++formulaDetailRequest
  const requests = [runFormulaSearch(formulaPage.value), loadFormulaModels()]
  requests.push(fetchFormulaBrands().then(({ items }) => {
    if (lang === locale.value) formulaBrands.value = items
  }))
  if (detailId) requests.push(fetchFormulaDetail(detailId).then(({ item }) => {
    if (lang === locale.value && formulaDetail.value?.id === detailId && item) formulaDetail.value = item
  }))
  await Promise.all(requests)
}
watch(locale, () => { refreshCatalogue(); refreshFormulaLanguage() })
onMounted(async () => {
  // Visitor statistics: report this landing and start the heartbeat.
  // The beacon is fire-and-forget, so it runs in demo mode too.
  currentPageLabel.value = 'home'
  startTracking(() => currentPageLabel.value)
  trackView('home')
  await refreshCatalogue()
  if (!demoMode.value) initFx(siteConfig.baseCurrency, locale.value)
  // Direct link / refresh on a custom page: #page/<slug> opens that
  // page, and later hash edits to a page link do the same.
  const initialSlug = pageSlugFromHash(window.location.hash)
  if (initialSlug) openCustomPage(initialSlug)
  window.addEventListener('hashchange', () => {
    const slug = pageSlugFromHash(window.location.hash)
    if (slug && slug !== customPageSlug.value) openCustomPage(slug)
  })
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRfqModal() })
})
</script>

<template>
  <div id="top" class="site" :data-theme="theme">
    <!-- Top bar -->
    <div class="topbar">
      <div class="wrap topbar-in">
        <span class="topbar-left">{{ siteConfig.announcement || t('announcement') }}</span>
        <span class="topbar-right">
          <a v-if="siteConfig.showCart" href="#" @click.prevent>{{ t('orders') }}</a>
          <a href="#" @click.prevent="openHelpChat">{{ t('help') }}</a>
          <span class="lang-menu">
            <button type="button" class="lang-btn" aria-haspopup="listbox" :aria-expanded="langOpen" @click="langOpen = !langOpen; curOpen = false">
              {{ currentLang.label }}<span class="lang-caret">▾</span>
            </button>
            <span v-if="langOpen" class="lang-backdrop" @click="langOpen = false"></span>
            <span v-if="langOpen" class="lang-list" role="listbox">
              <button v-for="l in LANGS" :key="l.code" type="button" role="option" :aria-selected="l.code === locale"
                :class="{ active: l.code === locale }" @click="pickLang(l.code)">
                <span>{{ l.label }}</span><span v-if="l.code === locale" class="lang-check">✓</span>
              </button>
            </span>
          </span>
          <span v-if="!demoMode" class="lang-menu">
            <button type="button" class="lang-btn" aria-haspopup="listbox" :aria-expanded="curOpen" @click="curOpen = !curOpen; langOpen = false">
              {{ displayCode }}<span class="lang-caret">▾</span>
            </button>
            <span v-if="curOpen" class="lang-backdrop" @click="curOpen = false"></span>
            <span v-if="curOpen" class="lang-list tall" role="listbox">
              <button v-for="c in CURRENCIES" :key="c.code" type="button" role="option" :aria-selected="c.code === displayCode"
                :class="{ active: c.code === displayCode }" @click="pickCurrency(c.code)">
                <span>{{ c.code }} {{ c.symbol }}</span><span v-if="c.code === displayCode" class="lang-check">✓</span>
              </button>
            </span>
          </span>
          <span v-else class="topbar-cur">{{ siteConfig.currency }}</span>
        </span>
      </div>
    </div>

    <!-- Header -->
    <header class="header">
      <div class="wrap header-in">
        <a class="logo" href="#" @click.prevent="view = 'home'"><img v-if="siteConfig.logo" class="logo-img" :src="siteConfig.logo" alt="TAOJIE" /><template v-else>TAOJIE<span class="logo-dot">.</span></template></a>
        <form class="search" @submit.prevent="onSearch">
          <input v-model="query" :placeholder="t('searchPh')" />
          <button type="submit">{{ t('search') }}</button>
        </form>
        <button v-if="siteConfig.showCart" class="cart-btn" @click="cartOpen = true">{{ t('cart') }} <b>{{ cartCount }}</b></button>
      </div>
    </header>

    <!-- Zone nav -->
    <nav class="zones"><div class="wrap zones-in">
      <button v-for="(item, idx) in zones" :key="idx" @click="onNav(item)">{{ item.label }}</button>
    </div></nav>

    <main v-if="view === 'home'">
      <!-- Hero -->
      <section class="hero">
        <div class="wrap hero-in" :class="{ 'no-side': !heroSideVisible }">
          <aside class="rail">
            <h2>{{ t('allCategories') }}</h2>
            <button :class="{ active: !activeCategory }" @click="pickCategory('')">{{ t('allProducts') }}</button>
            <button v-for="c in navigationCategories" :key="c.id" :class="{ active: activeCategory === String(c.id) }"
              :style="{ paddingLeft: (12 + (c.level - 1) * 14) + 'px' }" :title="c.pathName"
              :aria-expanded="c.hasChildren ? expandedCategoryIds.has(String(c.id)) : undefined" @click="pickCategory(String(c.id), true)">
              {{ tx(c.name) }} <span v-if="c.hasChildren">{{ expandedCategoryIds.has(String(c.id)) ? '⌄' : '›' }}</span>
            </button>
          </aside>

          <div class="hero-main">
            <p class="hero-eyebrow">{{ siteConfig.heroEyebrow || meta.label }}</p>
            <h1>{{ heroTitle }}</h1>
            <p class="hero-sub">{{ heroSub }}</p>
            <p class="hero-stats" v-if="theme === 'b' || theme === 'h'"><b>1,038</b> {{ t('statFormulas') }} <b>128</b> {{ t('statToners') }} <b>50+</b> {{ t('statMarkets') }}</p>
          </div>

          <aside v-if="heroSideVisible" class="hero-side">
            <div v-if="siteConfig.showContact" id="dealer" class="promo">
              <h3>{{ t('contact') }}</h3>
              <p>{{ t('contactText') }}</p>
              <p v-if="siteConfig.hotline" class="promo-tel">{{ t('exportHotline') }}<br /><b>{{ siteConfig.hotline }}</b></p>
              <p v-if="siteConfig.whatsapp" class="promo-tel">{{ t('whatsappLabel') }}<br /><b>{{ siteConfig.whatsapp }}</b></p>
              <p v-if="siteConfig.email" class="promo-tel">{{ t('emailLabel') }}<br /><b>{{ siteConfig.email }}</b></p>
              <button class="btn btn-light" @click="requestQuote(null)">{{ t('talkToSales') }}</button>
            </div>
            <div v-else-if="siteConfig.showDealer" id="dealer" class="promo">
              <h3>{{ siteConfig.dealerTitle || t('distributorTitle') }}</h3>
              <p>{{ siteConfig.dealerText || t('distributorText') }}</p>
              <button class="btn btn-light" @click="requestQuote(null)">{{ siteConfig.dealerButton || t('talkToSales') }}</button>
              <p class="promo-tel">{{ t('exportHotline') }}<br /><b>{{ siteConfig.hotline || '+86 XXX XXXX XXXX' }}</b></p>
            </div>
          </aside>
        </div>
      </section>

      <!-- Brand story (theme F) -->
      <section v-if="theme === 'f'" id="story" class="wrap story">
        <h2>{{ siteConfig.storyTitle || t('storyTitle') }}</h2>
        <p>{{ siteConfig.storyText || t('storyText') }}</p>
      </section>

      <!-- Product grid -->
      <section id="catalogue" class="wrap catalogue">
        <div class="catalogue-head">
          <h2>{{ resultsTitle }}</h2>
          <span v-if="loading">{{ t('loading') }}</span>
          <span v-else>{{ t('productsCount', { n: products.length }) }}</span>
          <button v-if="siteConfig.showRfq" class="btn btn-primary btn-sm catalogue-rfq" @click="requestQuote(null)">{{ t('rfqTitle') }}</button>
        </div>
        <div v-if="brands.length" class="brands">
          <button type="button" :class="{ active: !activeBrand }" @click="pickBrand('')">{{ t('allProducts') }}</button>
          <button v-for="b in brands" :key="b.id" type="button" :class="{ active: activeBrand === String(b.id) }" @click="pickBrand(String(b.id))">{{ b.name }}</button>
        </div>
        <div v-if="!loading && !products.length" class="empty">{{ t('empty') }}</div>
        <div class="grid">
          <ProductCard v-for="p in products" :key="p.id" :product="p" :theme="theme"
            @open="openProduct" @add="addToCart" @quote="requestQuoteChat" />
        </div>
      </section>

    </main>

    <!-- Detail view -->
    <main v-else-if="view === 'detail' && selected" class="wrap detail">
      <button class="btn btn-ghost btn-sm" @click="view = 'home'">{{ t('back') }}</button>
      <div class="detail-grid">
        <div class="detail-media-col">
          <video v-if="selected.video" class="detail-video" :src="selected.video" :poster="selected.image || undefined" controls preload="metadata"></video>
          <div class="detail-media" :style="{ background: `linear-gradient(135deg, ${selected.visual[0]}, ${selected.visual[1]})` }">
            <img v-if="selected.image" :src="selected.image" :alt="selected.name" @error="$event.target.remove()" />
            <span v-else class="detail-glyph">{{ selected.visual[2] }}</span>
            <span class="card-spectrum"></span>
          </div>
        </div>
        <div class="detail-info">
          <p class="card-cat">{{ tx(selected.category) }}</p>
          <h1>{{ tx(selected.name) }}</h1>
          <p class="detail-price"><b v-if="selectedNegotiable" class="price-negotiable">{{ t('negotiable') }}</b>
            <template v-else>
              <b>{{ formatPrice(selected.price) }}</b>
              <s v-if="selected.otPrice > selected.price">{{ formatPrice(selected.otPrice) }}</s>
              <small v-if="selected.unit && String(selected.unit).trim() && String(selected.unit).trim() !== '无'">/ {{ tx(selected.unit) }}</small>
            </template></p>
          <p v-if="isConverted && !selectedNegotiable" class="fx-note">{{ t('fxNote', { base: baseCode }) }}</p>
          <p v-if="selected.blurb" class="detail-blurb">{{ tx(selected.blurb) }}</p>

          <div v-if="selected.moq && !selectedNegotiable" class="detail-tiers">
            <h3>{{ t('tiersTitle') }}</h3>
            <p>{{ t('tiersText', { moq: selected.moq, unit: tx(selected.unit), moq5: selected.moq * 5, moq20: selected.moq * 20 }) }}</p>
          </div>

          <table v-if="selected.specs && Object.keys(selected.specs).length" class="spec-table">
            <tr v-for="(v, k) in selected.specs" :key="k"><th>{{ tx(k) }}</th><td>{{ tx(v) }}</td></tr>
          </table>
          <p v-else class="detail-blurb">{{ t('tdsNote') }}</p>

          <div class="detail-actions" :class="{ 'actions-solo': !siteConfig.showCart }">
            <button v-if="siteConfig.showCart && !selectedNegotiable" class="btn btn-primary" @click="addToCart(selected)">{{ t('addToCart') }}</button>
            <button class="btn btn-ghost" @click="requestQuoteChat(selected)">{{ t('requestQuote') }}</button>
          </div>
          <p class="trust" v-if="theme === 'b'">{{ t('trustText') }}</p>
        </div>
      </div>
    </main>

    <!-- Formula search view -->
    <main v-else-if="view === 'formula'" class="wrap formula-page">
      <template v-if="!formulaDetail">
        <h1 class="page-title">{{ t('formulaSearch') }}</h1>
        <form class="formula-bar" @submit.prevent="runFormulaSearch(1)">
          <label>{{ t('formulaBrand') }}
            <select v-model="fBrand" @change="onFormulaBrandChange">
              <option value="">{{ t('formulaAllBrands') }}</option>
              <option v-for="b in formulaBrands" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </label>
          <label>{{ t('formulaModel') }}
            <select v-model="fModel">
              <option value="">{{ t('formulaAllModels') }}</option>
              <option v-for="m in formulaModels" :key="m.id" :value="m.id">{{ m.model }}</option>
            </select>
          </label>
          <input v-model="fKeyword" class="formula-kw" :placeholder="t('formulaKeywordPh')" />
          <button type="submit" class="btn btn-primary">{{ t('search') }}</button>
        </form>
        <p class="formula-count"><span v-if="formulaLoading">{{ t('loading') }}</span><span v-else>{{ t('formulaCount', { n: formulaTotal }) }}</span></p>
        <div v-if="!formulaLoading && formulaSearched && !formulaRows.length" class="empty">{{ t('formulaEmpty') }}</div>
        <table v-if="formulaRows.length" class="formula-table">
          <thead><tr><th></th><th>{{ t('colBrand') }}</th><th>{{ t('colModel') }}</th><th>{{ t('colColor') }}</th><th>{{ t('colCode') }}</th><th>{{ t('colUpdated') }}</th></tr></thead>
          <tbody>
            <tr v-for="row in formulaRows" :key="row.id" @click="openFormulaDetail(row)">
              <td><img v-if="row.carImage" class="formula-thumb" :src="row.carImage" alt="" @error="$event.target.remove()" /></td>
              <td>{{ row.brandName }}</td><td>{{ row.modelName }}</td><td>{{ row.carColor }}</td><td>{{ row.colorNum }}</td><td>{{ row.updateTime }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="formulaPages > 1" class="formula-pager">
          <button class="btn btn-ghost btn-sm" :disabled="formulaPage <= 1" @click="runFormulaSearch(formulaPage - 1)">‹</button>
          <span>{{ formulaPage }} / {{ formulaPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="formulaPage >= formulaPages" @click="runFormulaSearch(formulaPage + 1)">›</button>
        </div>
      </template>
      <template v-else>
        <button class="btn btn-ghost btn-sm" @click="formulaDetail = null">{{ t('back') }}</button>
        <h1 class="page-title">{{ formulaDetail.carColor }}</h1>
        <p class="formula-meta">{{ formulaDetail.brandName }} · {{ formulaDetail.modelName }} · {{ t('colCode') }}: {{ formulaDetail.colorNum }}<span v-if="formulaDetail.cardNum"> · {{ formulaDetail.cardNum }}</span></p>
        <img v-if="formulaDetail.carImage" class="formula-photo" :src="formulaDetail.carImage" alt="" @error="$event.target.remove()" />
        <div v-if="!formulaDetail.numbers.length" class="empty">{{ t('noFormula') }}</div>
        <section v-for="num in formulaDetail.numbers" :key="num.id" class="formula-num">
          <h3>{{ t('recipeTitle') }} · {{ num.name }} <small>{{ num.colorName }}</small></h3>
          <p v-if="num.labL !== null && num.labL !== undefined" class="formula-lab">{{ t('labLabel') }}: L {{ num.labL }} · a {{ num.labA }} · b {{ num.labB }}</p>
          <p v-if="!num.formula.length" class="formula-lab">{{ t('noFormula') }}</p>
          <template v-else>
            <label class="formula-grams">{{ t('gramsLabel') }} <input v-model.number="recipeGrams" type="number" min="0" step="any" /></label>
            <table class="formula-table">
              <thead><tr><th>{{ t('colToner') }}</th><th>{{ t('colShare') }}</th><th>{{ t('colGrams') }}</th><th>{{ t('colCumulative') }}</th></tr></thead>
              <tbody>
                <tr v-for="line in recipeRows(num.formula)" :key="line.id">
                  <td>{{ line.name || line.model }}<small v-if="line.name && line.model"> · {{ line.model }}</small></td>
                  <td>{{ line.share.toFixed(1) }}%</td>
                  <td>{{ line.grams.toFixed(1) }}</td>
                  <td>{{ line.cumulative.toFixed(1) }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </section>
      </template>
    </main>

    <!-- Company profile view: native page in the site's own theme,
         laid out after the approved prototype — full-width banner,
         live willis category + featured-product blocks, the
         admin-authored sections slotted by title (about split,
         services features, quality/tech duo, factory gallery),
         testimonials, FAQs, and a dark facts + contact band. -->
    <template v-else-if="view === 'profile' && profileHasCustom">
      <section class="profile-banner" :style="profileBanner.image ? { backgroundImage: `url(${profileBanner.image})` } : {}">
        <div class="profile-banner-shade">
          <div class="wrap profile-banner-in">
            <h1>{{ bannerTitle }}</h1>
            <p v-if="bannerSubtitle" class="profile-banner-sub">{{ bannerSubtitle }}</p>
            <div class="profile-banner-btns">
              <button type="button" class="btn btn-light" @click="scrollToAnchor('profile-categories')">{{ t('viewProducts') }}</button>
              <button type="button" class="btn btn-banner-ghost" @click="scrollToAnchor('profile-contact')">{{ t('contactUs') }}</button>
            </div>
          </div>
        </div>
      </section>
      <main class="wrap profile-page">
        <section v-if="willisCategoryCards.length" id="profile-categories" class="profile-block">
          <h2 class="profile-block-title">{{ t('productCategories') }}</h2>
          <div class="profile-cat-grid">
            <button v-for="c in willisCategoryCards" :key="c.id" type="button" class="profile-cat-card" @click="openProfileCategory(c)">
              <span class="profile-cat-media"><img :src="c.image" :alt="leafName(tx(c.name))" loading="lazy" @error="$event.target.remove()" /></span>
              <span class="profile-cat-name">{{ leafName(tx(c.name)) }}</span>
            </button>
          </div>
        </section>
        <section v-if="featuredProducts.length" class="profile-block">
          <h2 class="profile-block-title">{{ t('ourProducts') }}</h2>
          <div class="grid">
            <ProductCard v-for="p in featuredProducts" :key="p.id" :product="p" :theme="theme"
              @open="openProduct" @add="addToCart" @quote="requestQuoteChat" />
          </div>
        </section>
        <section v-if="aboutSection" class="profile-block profile-about" :class="{ 'no-img': !sectionImage(aboutSection) }">
          <div class="profile-about-text">
            <h2 v-if="tx(aboutSection.title)">{{ tx(aboutSection.title) }}</h2>
            <p v-for="(para, j) in sectionParas(aboutSection)" :key="j">{{ para }}</p>
            <ul v-if="sectionBullets(aboutSection).length">
              <li v-for="(b, j) in sectionBullets(aboutSection)" :key="j">{{ b }}</li>
            </ul>
          </div>
          <img v-if="sectionImage(aboutSection)" class="profile-about-img" :src="sectionImage(aboutSection)" :alt="tx(aboutSection.title) || t('companyProfile')" loading="lazy" />
        </section>
        <section v-if="supportSection" class="profile-block">
          <h2 v-if="tx(supportSection.title)" class="profile-block-title">{{ tx(supportSection.title) }}</h2>
          <p v-for="(para, j) in sectionParas(supportSection)" :key="j" class="profile-lead">{{ para }}</p>
          <img v-if="sectionImage(supportSection)" class="profile-section-img" :src="sectionImage(supportSection)" :alt="tx(supportSection.title) || t('companyProfile')" loading="lazy" />
          <div v-if="sectionBullets(supportSection).length" class="profile-features">
            <div v-for="(b, j) in sectionBullets(supportSection)" :key="j" class="profile-feature">
              <span class="profile-feature-ico" aria-hidden="true">{{ ['◎', '✦', '✓', '✚'][j % 4] }}</span>
              <span>{{ b }}</span>
            </div>
          </div>
        </section>
        <section v-if="duoSections.length" class="profile-block profile-duo">
          <div v-for="(s, i) in duoSections" :key="i" class="profile-duo-col">
            <h2 v-if="tx(s.title)">{{ tx(s.title) }}</h2>
            <img v-if="sectionImage(s)" class="profile-section-img" :src="sectionImage(s)" :alt="tx(s.title) || t('companyProfile')" loading="lazy" />
            <p v-for="(para, j) in sectionParas(s)" :key="j">{{ para }}</p>
            <ul v-if="sectionBullets(s).length">
              <li v-for="(b, j) in sectionBullets(s)" :key="j">{{ b }}</li>
            </ul>
          </div>
        </section>
        <section v-if="factorySection || profileGallery.length" class="profile-block">
          <h2 v-if="factorySection && tx(factorySection.title)" class="profile-block-title">{{ tx(factorySection.title) }}</h2>
          <template v-if="factorySection">
            <p v-for="(para, j) in sectionParas(factorySection)" :key="j" class="profile-lead">{{ para }}</p>
            <ul v-if="sectionBullets(factorySection).length">
              <li v-for="(b, j) in sectionBullets(factorySection)" :key="j">{{ b }}</li>
            </ul>
          </template>
          <div v-if="profileGallery.length" class="profile-factory-grid">
            <img v-for="(img, i) in profileGallery" :key="i" :src="img" :class="{ wide: i === 0 }" :alt="t('companyProfile')" loading="lazy" />
          </div>
        </section>
        <section v-if="profileTestimonials.length" class="profile-testimonials">
          <h2>{{ t('testimonials') }}</h2>
          <div class="testimonial-grid">
            <blockquote v-for="(x, i) in profileTestimonials" :key="i" class="testimonial-card">
              <p>{{ tx(x.text) }}</p>
              <cite v-if="x.name">— {{ x.name }}</cite>
            </blockquote>
          </div>
        </section>
        <section v-if="profileFaqs.length" class="profile-faqs">
          <h2>{{ t('faqs') }}</h2>
          <details v-for="(f, i) in profileFaqs" :key="i" class="faq-item">
            <summary>{{ tx(f.q) }}</summary>
            <p v-for="(para, j) in faqParas(f)" :key="j">{{ para }}</p>
          </details>
        </section>
        <section id="profile-contact" class="profile-contact-band">
          <div v-if="factsSection" class="profile-facts">
            <h2 v-if="tx(factsSection.title)">{{ tx(factsSection.title) }}</h2>
            <p v-for="(para, j) in sectionParas(factsSection)" :key="j" class="profile-facts-para">{{ para }}</p>
            <div v-if="sectionBullets(factsSection).length" class="profile-facts-row">
              <p v-for="(b, j) in sectionBullets(factsSection)" :key="j">{{ b }}</p>
            </div>
          </div>
          <div class="profile-promo">
          <h3>{{ t('contact') }}</h3>
          <p>{{ t('contactText') }}</p>
          <p v-if="siteConfig.hotline" class="promo-tel">{{ t('exportHotline') }}<br /><b>{{ siteConfig.hotline }}</b></p>
          <p v-if="siteConfig.whatsapp" class="promo-tel">{{ t('whatsappLabel') }}<br /><b>{{ siteConfig.whatsapp }}</b></p>
          <p v-if="siteConfig.email" class="promo-tel">{{ t('emailLabel') }}<br /><b>{{ siteConfig.email }}</b></p>
          <div v-if="siteConfig.tiktok || siteConfig.instagram || siteConfig.facebook || siteConfig.youtube || siteConfig.wechat" class="profile-social">
            <a v-if="siteConfig.tiktok" :href="siteConfig.tiktok" target="_blank" rel="noopener">TikTok</a>
            <a v-if="siteConfig.instagram" :href="siteConfig.instagram" target="_blank" rel="noopener">Instagram</a>
            <a v-if="siteConfig.facebook" :href="siteConfig.facebook" target="_blank" rel="noopener">Facebook</a>
            <a v-if="siteConfig.youtube" :href="siteConfig.youtube" target="_blank" rel="noopener">YouTube</a>
            <span v-if="siteConfig.wechat">WeChat: <b>{{ siteConfig.wechat }}</b></span>
          </div>
          <button class="btn btn-light" @click="requestQuote(null)">{{ t('talkToSales') }}</button>
          </div>
        </section>
      </main>
    </template>

    <!-- Company profile view, text fallback (no custom content yet) -->
    <main v-else-if="view === 'profile'" class="wrap profile-page">
      <div class="profile-head">
        <img v-if="siteConfig.logo" class="profile-logo" :src="siteConfig.logo" alt="TAOJIE" />
        <span v-else class="logo">TAOJIE<span class="logo-dot">.</span></span>
      </div>
      <h1 class="page-title">{{ siteConfig.storyTitle || t('storyTitle') }}</h1>
      <p class="profile-story">{{ siteConfig.storyText || t('storyText') }}</p>
      <div v-if="siteConfig.hotline || siteConfig.whatsapp || siteConfig.email" class="profile-contact">
        <p v-if="siteConfig.hotline">{{ t('exportHotline') }}: <b>{{ siteConfig.hotline }}</b></p>
        <p v-if="siteConfig.whatsapp">{{ t('whatsappLabel') }}: <b>{{ siteConfig.whatsapp }}</b></p>
        <p v-if="siteConfig.email">{{ t('emailLabel') }}: <b>{{ siteConfig.email }}</b></p>
      </div>
      <div v-if="siteConfig.tiktok || siteConfig.instagram || siteConfig.facebook || siteConfig.youtube || siteConfig.wechat" class="profile-social">
        <a v-if="siteConfig.tiktok" :href="siteConfig.tiktok" target="_blank" rel="noopener">TikTok</a>
        <a v-if="siteConfig.instagram" :href="siteConfig.instagram" target="_blank" rel="noopener">Instagram</a>
        <a v-if="siteConfig.facebook" :href="siteConfig.facebook" target="_blank" rel="noopener">Facebook</a>
        <a v-if="siteConfig.youtube" :href="siteConfig.youtube" target="_blank" rel="noopener">YouTube</a>
        <span v-if="siteConfig.wechat">WeChat: <b>{{ siteConfig.wechat }}</b></span>
      </div>
      <button class="btn btn-primary" @click="requestQuote(null)">{{ t('talkToSales') }}</button>
    </main>

    <!-- Custom page view (admin-authored standalone page): hero band
         with the page title, its sections and gallery, then the same
         contact card that closes the company-profile page. -->
    <template v-else-if="view === 'page'">
      <template v-if="customPage">
        <section class="page-band">
          <div class="wrap page-band-in">
            <h1>{{ tx(customPage.titles) }}</h1>
          </div>
        </section>
        <main class="wrap profile-page">
          <section v-for="(s, i) in customPageSections" :key="i" class="profile-block">
            <h2 v-if="tx(s.title)" class="profile-block-title">{{ tx(s.title) }}</h2>
            <img v-if="sectionImage(s)" class="profile-section-img" :src="sectionImage(s)" :alt="tx(s.title)" loading="lazy" />
            <p v-for="(para, j) in sectionParas(s)" :key="j">{{ para }}</p>
          </section>
          <div v-if="customPage.gallery.length" class="profile-factory-grid">
            <img v-for="(img, i) in customPage.gallery" :key="i" :src="img" :class="{ wide: i === 0 }" :alt="tx(customPage.titles)" loading="lazy" />
          </div>
          <section class="profile-contact-band">
            <div class="profile-promo">
              <h3>{{ t('contact') }}</h3>
              <p>{{ t('contactText') }}</p>
              <p v-if="siteConfig.hotline" class="promo-tel">{{ t('exportHotline') }}<br /><b>{{ siteConfig.hotline }}</b></p>
              <p v-if="siteConfig.whatsapp" class="promo-tel">{{ t('whatsappLabel') }}<br /><b>{{ siteConfig.whatsapp }}</b></p>
              <p v-if="siteConfig.email" class="promo-tel">{{ t('emailLabel') }}<br /><b>{{ siteConfig.email }}</b></p>
              <button class="btn btn-light" @click="requestQuote(null)">{{ t('talkToSales') }}</button>
            </div>
          </section>
        </main>
      </template>
      <main v-else class="wrap profile-page">
        <p v-if="customPageLoading" class="empty">{{ t('loading') }}</p>
        <div v-else class="empty">{{ t('pageNotFound') }}</div>
      </main>
    </template>

    <footer class="footer">
      <div class="wrap footer-in">
        <div>
          <p class="logo logo-foot">TAOJIE<span class="logo-dot">.</span></p>
          <p>{{ t('footerAbout') }}</p>
        </div>
        <div>
          <h4>{{ t('shop') }}</h4><p>{{ tx('Automotive Paint') }}<br />{{ tx('Primers & Clear Coats') }}<br />{{ tx('Home & Living') }}<br />{{ tx('Appliances') }}</p>
        </div>
        <div>
          <h4>{{ t('buyers') }}</h4><p>{{ t('rfqTitle') }}<br />{{ tx('Distributor Program') }}<br />{{ tx('Private Label') }}<br />{{ tx('Samples') }}</p>
        </div>
        <div v-if="siteConfig.whatsapp || siteConfig.email">
          <h4>{{ t('contact') }}</h4>
          <p><span v-if="siteConfig.whatsapp">{{ t('whatsappLabel') }}<br />{{ siteConfig.whatsapp }}<br /></span><span v-if="siteConfig.email">{{ t('emailLabel') }}<br />{{ siteConfig.email }}</span></p>
        </div>
        <div>
          <h4>{{ t('note') }}</h4>
          <p>{{ t('noteText') }}</p>
          <p v-if="demoMode" class="demo-flag">{{ t('demoFlag') }}</p>
        </div>
      </div>
      <p class="wrap copyright">{{ t('copyright', { theme: meta.label }) }}</p>
    </footer>

    <!-- RFQ modal: the 索取报价 form as a global overlay (replaces the
         old in-flow section at the bottom of the home view). -->
    <div v-if="rfqOpen" class="modal-backdrop" @click="closeRfqModal">
      <div class="modal-card" role="dialog" aria-modal="true" :aria-label="t('rfqTitle')" @click.stop>
        <button class="icon-btn modal-close" @click="closeRfqModal" aria-label="Close">×</button>
        <RfqPanel :key="rfqNonce" :product-name="rfqProduct" />
      </div>
    </div>
    <CartDrawer :open="cartOpen" :items="cart" @close="cartOpen = false" @remove="removeFromCart" @clear="cart = []" />
    <SocialWidget />
    <ChatWidget />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
