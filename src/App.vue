<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import CartDrawer from './components/CartDrawer.vue'
import RfqPanel from './components/RfqPanel.vue'
import { fetchCategories, fetchKeywords, fetchProducts, fetchProductDetail, demoBrands } from './api.js'
import { siteConfig } from './siteConfig.js'
import { LANGS, locale, setLocale, t, tx, themeText } from './i18n.js'

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
const themeKeys = Object.keys(THEMES)

// Visitor's own pick (top-bar select). Only honoured while the admin allows
// theme switching; otherwise everyone gets the admin's defaultTheme.
const chosenTheme = ref(localStorage.getItem('taojie-theme') || siteConfig.defaultTheme || 'h')
watch(chosenTheme, (v) => localStorage.setItem('taojie-theme', v))
const theme = computed(() => {
  const k = siteConfig.allowThemeSwitch ? chosenTheme.value : siteConfig.defaultTheme
  return THEMES[k] ? k : 'h'
})

const view = ref('home') // 'home' | 'detail'
const categories = ref([])
const products = ref([])
const keywords = ref([])
const brands = demoBrands()
const demoMode = ref(false)
const loading = ref(true)
const query = ref('')
const activeCategory = ref('')
const selected = ref(null)
const cart = ref([])
const cartOpen = ref(false)
const rfqProduct = ref('')
const toast = ref('')

const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0))
const meta = computed(() => THEMES[theme.value])
const heroTitle = computed(() => siteConfig.heroTitle || themeText(theme.value).headline)
const heroSub = computed(() => siteConfig.heroSubtitle || themeText(theme.value).sub)
const zones = computed(() => t('zones'))

function noteDemo(d) { if (d) demoMode.value = true }
function showToast(msg) { toast.value = msg; setTimeout(() => { toast.value = '' }, 2200) }

async function loadProducts() {
  loading.value = true
  const { items, demo } = await fetchProducts({ keyword: query.value, categoryId: activeCategory.value })
  products.value = items
  noteDemo(demo)
  loading.value = false
}

async function onSearch() { view.value = 'home'; await loadProducts() }
async function pickCategory(id) { activeCategory.value = id; view.value = 'home'; await loadProducts() }

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
  const [cats, kws] = await Promise.all([fetchCategories(), fetchKeywords()])
  categories.value = cats.items
  keywords.value = kws.items
  noteDemo(cats.demo || kws.demo)
  await loadProducts()
})
</script>

<template>
  <div class="site" :data-theme="theme">
    <!-- Top bar -->
    <div class="topbar">
      <div class="wrap topbar-in">
        <span class="topbar-left">{{ siteConfig.announcement || t('announcement') }}</span>
        <span class="topbar-right">
          <a href="#" @click.prevent>{{ t('signIn') }}</a>
          <a href="#" @click.prevent>{{ t('orders') }}</a>
          <a href="#" @click.prevent>{{ t('help') }}</a>
          <select class="lang-switch" :value="locale" aria-label="Language" @change="setLocale($event.target.value)">
            <option v-for="l in LANGS" :key="l.code" :value="l.code">{{ l.label }}</option>
          </select>
          <span class="topbar-cur">{{ siteConfig.currency }}</span>
          <label v-if="siteConfig.allowThemeSwitch" class="theme-switch">
            {{ t('theme') }}
            <select v-model="chosenTheme" aria-label="Switch theme">
              <option v-for="k in themeKeys" :key="k" :value="k">{{ THEMES[k].label }}</option>
            </select>
          </label>
        </span>
      </div>
    </div>

    <!-- Header -->
    <header class="header">
      <div class="wrap header-in">
        <a class="logo" href="#" @click.prevent="view = 'home'">TAOJIE<span class="logo-dot">.</span></a>
        <form class="search" @submit.prevent="onSearch">
          <input v-model="query" :placeholder="t('searchPh')" />
          <button type="submit">{{ t('search') }}</button>
        </form>
        <button class="cart-btn" @click="cartOpen = true">{{ t('cart') }} <b>{{ cartCount }}</b></button>
      </div>
      <div class="wrap hotwords" v-if="keywords.length">
        <button v-for="k in keywords" :key="k" @click="query = k; onSearch()">{{ k }}</button>
      </div>
    </header>

    <!-- Zone nav -->
    <nav class="zones"><div class="wrap zones-in">
      <button v-for="z in zones" :key="z" @click.prevent>{{ z }}</button>
    </div></nav>

    <main v-if="view === 'home'">
      <!-- Hero -->
      <section class="hero">
        <div class="wrap hero-in">
          <aside class="rail">
            <h2>{{ t('allCategories') }}</h2>
            <button :class="{ active: !activeCategory }" @click="pickCategory('')">{{ t('allProducts') }}</button>
            <button v-for="c in categories" :key="c.id" :class="{ active: activeCategory === String(c.id) }" @click="pickCategory(String(c.id))">
              {{ tx(c.name) }} <span v-if="c.count">›</span>
            </button>
          </aside>

          <div class="hero-main">
            <p class="hero-eyebrow">{{ meta.label }}</p>
            <h1>{{ heroTitle }}</h1>
            <p class="hero-sub">{{ heroSub }}</p>
            <p class="hero-stats" v-if="theme === 'b' || theme === 'h'"><b>1,038</b> {{ t('statFormulas') }} <b>128</b> {{ t('statToners') }} <b>50+</b> {{ t('statMarkets') }}</p>
          </div>

          <aside class="hero-side">
            <RfqPanel v-if="theme === 'g' && siteConfig.showRfq" :product-name="rfqProduct" compact />
            <div v-else class="promo">
              <h3>{{ t('distributorTitle') }}</h3>
              <p>{{ t('distributorText') }}</p>
              <button class="btn btn-light" @click="requestQuote(null)">{{ t('talkToSales') }}</button>
              <p class="promo-tel">{{ t('exportHotline') }}<br /><b>+86 XXX XXXX XXXX</b></p>
            </div>
          </aside>
        </div>
        <!-- Search capsule straddling the hero edge -->
        <form class="hero-search" @submit.prevent="onSearch">
          <input v-model="query" :placeholder="t('heroSearchPh')" />
          <button type="submit">{{ t('searchProducts') }}</button>
        </form>
      </section>

      <!-- Brand strip -->
      <section class="wrap brands">
        <span v-for="b in brands" :key="b">{{ b }}</span>
      </section>

      <!-- Brand story (theme F) -->
      <section v-if="theme === 'f'" class="wrap story">
        <h2>{{ t('storyTitle') }}</h2>
        <p>{{ t('storyText') }}</p>
      </section>

      <!-- Product grid -->
      <section class="wrap catalogue">
        <div class="catalogue-head">
          <h2>{{ activeCategory ? t('categoryTitle') : t('featured') }}</h2>
          <span v-if="loading">{{ t('loading') }}</span>
          <span v-else>{{ t('productsCount', { n: products.length }) }}</span>
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
        <div class="detail-media" :style="{ background: `linear-gradient(135deg, ${selected.visual[0]}, ${selected.visual[1]})` }">
          <img v-if="selected.image" :src="selected.image" :alt="selected.name" @error="$event.target.remove()" />
          <span v-else class="detail-glyph">{{ selected.visual[2] }}</span>
          <span class="card-spectrum"></span>
        </div>
        <div class="detail-info">
          <p class="card-cat">{{ tx(selected.category) }}</p>
          <h1>{{ tx(selected.name) }}</h1>
          <p class="detail-price"><b>${{ selected.price.toFixed(2) }}</b>
            <s v-if="selected.otPrice > selected.price">${{ selected.otPrice.toFixed(2) }}</s>
            <small>/ {{ tx(selected.unit) }}</small></p>
          <p v-if="selected.blurb" class="detail-blurb">{{ tx(selected.blurb) }}</p>

          <div v-if="selected.moq" class="detail-tiers">
            <h3>{{ t('tiersTitle') }}</h3>
            <p>{{ t('tiersText', { moq: selected.moq, unit: tx(selected.unit), moq5: selected.moq * 5, moq20: selected.moq * 20 }) }}</p>
          </div>

          <table v-if="selected.specs && Object.keys(selected.specs).length" class="spec-table">
            <tr v-for="(v, k) in selected.specs" :key="k"><th>{{ tx(k) }}</th><td>{{ tx(v) }}</td></tr>
          </table>
          <p v-else class="detail-blurb">{{ t('tdsNote') }}</p>

          <div class="detail-actions">
            <button class="btn btn-primary" @click="addToCart(selected)">{{ t('addToCart') }}</button>
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
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
