<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CartDrawer from './components/CartDrawer.vue'
import RfqPanel from './components/RfqPanel.vue'
import ChatWidget from './components/ChatWidget.vue'
import { fetchCategories, fetchKeywords, fetchProducts, fetchProductDetail, fetchBrands, demoBrands } from './api.js'
import { siteConfig } from './siteConfig.js'
import { LANGS, locale, setLocale, t, tx, themeText } from './i18n.js'
import { CURRENCIES, displayCode, baseCode, isConverted, formatPrice, initFx, setDisplay } from './utils/currency.js'

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

const view = ref('home') // 'home' | 'detail'
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
const cart = ref([])
const cartOpen = ref(false)
const rfqProduct = ref('')
const toast = ref('')

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
function pickLang(code) { setLocale(code); langOpen.value = false }

const curOpen = ref(false)
function pickCurrency(code) { setDisplay(code); curOpen.value = false }

const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0))
const meta = computed(() => THEMES[theme.value])
const heroTitle = computed(() => siteConfig.heroTitle || themeText(theme.value).headline)
const heroSub = computed(() => siteConfig.heroSubtitle || themeText(theme.value).sub)
// Hero side column: theme G shows the compact RFQ panel there; every theme
// otherwise shows the dealer card. The column exists only when one of the
// two is enabled, so hiding the dealer card leaves no empty grid track.
const heroSideVisible = computed(() => (theme.value === 'g' && siteConfig.showRfq) || siteConfig.showDealer)
// Top navigation: admin-configured navItems win; empty = i18n defaults
// (label-only items with no click action).
const zones = computed(() => {
  const items = (siteConfig.navItems || []).filter((i) => i && i.label)
  return items.length ? items : t('zones').map((label) => ({ label }))
})

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
  const type = navType(item)
  if (type === 'category') {
    await pickCategory(String(item.categoryId || ''))
    scrollToAnchor('catalogue')
  } else if (type === 'anchor') {
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
    return c ? leafName(tx(c.name)) : t('categoryTitle')
  }
  return t('featured')
})

function noteDemo(d) { if (d) demoMode.value = true }
function showToast(msg) { toast.value = msg; setTimeout(() => { toast.value = '' }, 2200) }

async function loadProducts() {
  loading.value = true
  const { items, demo } = await fetchProducts({ keyword: query.value, categoryId: activeCategory.value, brandId: activeBrand.value })
  products.value = items
  noteDemo(demo)
  loading.value = false
}

async function onSearch() { view.value = 'home'; searchedQuery.value = query.value.trim(); activeBrand.value = ''; await loadProducts() }
async function pickCategory(id) { activeCategory.value = id; searchedQuery.value = ''; activeBrand.value = ''; view.value = 'home'; await loadProducts() }
// Brand chip toggle: clicking the selected brand (or the "all" chip) clears it.
async function pickBrand(id) { activeBrand.value = activeBrand.value === id ? '' : id; await loadProducts() }

async function openProduct(p) {
  const { item, demo } = await fetchProductDetail(p.id)
  selected.value = { ...p, ...item, specs: { ...(p.specs || {}), ...(item.specs || {}) } }
  noteDemo(demo)
  view.value = 'detail'
  window.scrollTo({ top: 0 })
}

function addToCart(p) {
  const found = cart.value.find((i) => String(i.id) === String(p.id))
  if (found) found.qty += 1
  else cart.value.push({ id: p.id, name: p.name, price: p.price, unit: p.unit, visual: p.visual, qty: 1 })
  showToast(t('added', { name: tx(p.name) }))
}
function removeFromCart(id) { cart.value = cart.value.filter((i) => String(i.id) !== String(id)) }
function requestQuote(p) {
  rfqProduct.value = p ? tx(p.name) : ''
  view.value = 'home'
  setTimeout(() => document.getElementById('rfq')?.scrollIntoView({ behavior: 'smooth' }), 60)
}

onMounted(async () => {
  const [cats, kws, brs] = await Promise.all([fetchCategories(), fetchKeywords(), fetchBrands()])
  categories.value = cats.items
  keywords.value = kws.items
  brands.value = brs.items
  noteDemo(cats.demo || kws.demo)
  await loadProducts()
  // Real shop: load FX rates for the configured base currency so the
  // top-bar currency switcher can convert prices. Demo mode never
  // fetches rates — its prices keep the built-in "$" rendering.
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
          <a href="#" @click.prevent>{{ t('signIn') }}</a>
          <a v-if="siteConfig.showCart" href="#" @click.prevent>{{ t('orders') }}</a>
          <a href="#" @click.prevent>{{ t('help') }}</a>
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
      <div class="wrap hotwords" v-if="keywords.length">
        <button v-for="k in keywords" :key="k" @click="query = k; onSearch()">{{ k }}</button>
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
            <button v-for="c in categories" :key="c.id" :class="{ active: activeCategory === String(c.id) }" :title="tx(c.name)" @click="pickCategory(String(c.id))">
              {{ leafName(tx(c.name)) }} <span v-if="c.count">›</span>
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
          <p class="detail-price"><b>{{ formatPrice(selected.price) }}</b>
            <s v-if="selected.otPrice > selected.price">{{ formatPrice(selected.otPrice) }}</s>
            <small v-if="selected.unit && String(selected.unit).trim() && String(selected.unit).trim() !== '无'">/ {{ tx(selected.unit) }}</small></p>
          <p v-if="isConverted" class="fx-note">{{ t('fxNote', { base: baseCode }) }}</p>
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
            <button v-if="siteConfig.showCart" class="btn btn-primary" @click="addToCart(selected)">{{ t('addToCart') }}</button>
            <button class="btn btn-ghost" @click="requestQuote(selected)">{{ t('requestQuote') }}</button>
          </div>
          <p class="trust" v-if="theme === 'b'">{{ t('trustText') }}</p>
        </div>
      </div>
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
    <ChatWidget />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
