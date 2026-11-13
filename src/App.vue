<script setup>
import { navigationItems } from './utils/navigation'
import { computed, onMounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CartDrawer from './components/CartDrawer.vue'
import RfqPanel from './components/RfqPanel.vue'
import ChatWidget from './components/ChatWidget.vue'
import SocialWidget from './components/SocialWidget.vue'
import { fetchCategories, fetchKeywords, fetchProducts, fetchProductDetail, fetchBrands, demoBrands, fetchFormulaBrands, fetchFormulaModels, fetchFormulaSearch, fetchFormulaDetail } from './api.js'
import { siteConfig } from './siteConfig.js'
import { LANGS, locale, setLocale, t, tx, themeText } from './i18n.js'
import { CURRENCIES, displayCode, baseCode, isConverted, formatPrice, initFx, setDisplay, currencyForLocale } from './utils/currency.js'
import { startTracking, trackView, trackClick } from './utils/track.js'

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

const view = ref('home') // 'home' | 'detail' | 'formula' | 'profile'
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
// Hero side column: theme G shows the compact RFQ panel there; every theme
// otherwise shows the contact card (showContact, default on — contact
// details only, no dealer wording), falling back to the dealer card only
// when the contact card is off and the dealer card is on. The column
// exists only when one of them is enabled, so hiding them all leaves
// no empty grid track.
const heroSideVisible = computed(() => (theme.value === 'g' && siteConfig.showRfq) || siteConfig.showContact || siteConfig.showDealer)
// Top navigation: admin-configured navItems win; empty = i18n defaults
// (label-only items with no click action).
const zones = computed(() => navigationItems(siteConfig,t))

// Nav click dispatch. Items saved by the current admin carry an explicit
// type; older items have none, so infer from link — http(s) → external,
// #… → anchor, anything else (or empty) → no action, as before.
function navType(item) {
  const type = String(item.type || '')
  if (type === 'category' || type === 'anchor' || type === 'external') return type
  const link = String(item.link || '')
  if (/^https?:\/\//i.test(link)) return 'external'
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
  if (type === 'category') {
    await pickCategory(String(item.categoryId || ''))
    scrollToAnchor('catalogue')
  } else if (type === 'anchor') {
    // The formula library and company profile are app views, reachable
    // from admin-configured nav items via the #formula / #profile links.
    if (item.link === '#formula') { openFormula(); return }
    if (item.link === '#profile') { openProfile(); return }
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
function requestQuote(p) {
  trackClick('点联系销售/询价')
  rfqProduct.value = p ? tx(p.name) : ''
  view.value = 'home'
  setTimeout(() => document.getElementById('rfq')?.scrollIntoView({ behavior: 'smooth' }), 60)
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
            <RfqPanel v-if="theme === 'g' && siteConfig.showRfq" :product-name="rfqProduct" compact />
            <div v-else-if="siteConfig.showContact" id="dealer" class="promo">
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
        </div>
        <div v-if="brands.length" class="brands">
          <button type="button" :class="{ active: !activeBrand }" @click="pickBrand('')">{{ t('allProducts') }}</button>
          <button v-for="b in brands" :key="b.id" type="button" :class="{ active: activeBrand === String(b.id) }" @click="pickBrand(String(b.id))">{{ b.name }}</button>
        </div>
        <div v-if="!loading && !products.length" class="empty">{{ t('empty') }}</div>
        <div class="grid">
          <ProductCard v-for="p in products" :key="p.id" :product="p" :theme="theme"
            @open="openProduct" @add="addToCart" @quote="requestQuote" />
        </div>
      </section>

      <!-- RFQ -->
      <section v-if="siteConfig.showRfq" id="rfq" class="wrap rfq-section">
        <RfqPanel :product-name="rfqProduct" />
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
          <p class="detail-price"><b v-if="selected.negotiable" class="price-negotiable">{{ t('negotiable') }}</b>
            <template v-else>
              <b>{{ formatPrice(selected.price) }}</b>
              <s v-if="selected.otPrice > selected.price">{{ formatPrice(selected.otPrice) }}</s>
              <small v-if="selected.unit && String(selected.unit).trim() && String(selected.unit).trim() !== '无'">/ {{ tx(selected.unit) }}</small>
            </template></p>
          <p v-if="isConverted && !selected.negotiable" class="fx-note">{{ t('fxNote', { base: baseCode }) }}</p>
          <p v-if="selected.blurb" class="detail-blurb">{{ tx(selected.blurb) }}</p>

          <div v-if="selected.moq" class="detail-tiers">
            <h3>{{ t('tiersTitle') }}</h3>
            <p>{{ t('tiersText', { moq: selected.moq, unit: tx(selected.unit), moq5: selected.moq * 5, moq20: selected.moq * 20 }) }}</p>
          </div>

          <table v-if="selected.specs && Object.keys(selected.specs).length" class="spec-table">
            <tr v-for="(v, k) in selected.specs" :key="k"><th>{{ tx(k) }}</th><td>{{ tx(v) }}</td></tr>
          </table>
          <p v-else class="detail-blurb">{{ t('tdsNote') }}</p>

          <div class="detail-actions" :class="{ 'actions-solo': !siteConfig.showCart }">
            <button v-if="siteConfig.showCart && !selected.negotiable" class="btn btn-primary" @click="addToCart(selected)">{{ t('addToCart') }}</button>
            <button class="btn btn-ghost" @click="requestQuote(selected)">{{ t('requestQuote') }}</button>
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

    <!-- Company profile view: full-page embed when an embed URL is
         configured (mirrors the original site, whose profile page is a
         borderless iframe of the company homepage). -->
    <main v-else-if="view === 'profile' && siteConfig.profileUrl" class="profile-embed-page">
      <iframe class="profile-embed" :src="siteConfig.profileUrl" :title="t('companyProfile')" frameborder="0"></iframe>
    </main>

    <!-- Company profile view, text fallback (embed URL cleared in admin) -->
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

    <CartDrawer :open="cartOpen" :items="cart" @close="cartOpen = false" @remove="removeFromCart" @clear="cart = []" />
    <SocialWidget />
    <ChatWidget />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
