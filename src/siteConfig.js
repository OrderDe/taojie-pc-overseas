import { reactive } from 'vue'

// Runtime site configuration for the overseas PC showcase.
// Managed in the overseas admin site configuration. pc-config.json supplies
// fallback defaults when the backend is unavailable.
export const siteConfig = reactive({
  defaultTheme: 'h', // one of a–h, selected by the admin for all visitors
  heroTitle: '', // overrides the theme headline when set
  heroSubtitle: '', // overrides the theme sub-line when set
  announcement: '', // thin notice shown in the top bar when set
  showRfq: true, // RFQ panel + section visibility
  showCart: false, // cart buttons/drawer + orders link; hidden unless the admin turns it on (inquiry-site default)
  showDealer: false, // hero "become a dealer" card; hidden unless the admin turns it on
  showContact: true, // hero contact card (hotline / WhatsApp / email, no dealer wording); shown unless the admin turns it off
  whatsapp: '', // shown in the footer when set
  email: '', // shown in the footer when set
  currency: 'USD', // legacy label, shown in the top bar only in demo mode
  baseCurrency: 'CNY', // currency the stored prices are in; the storefront converts for display (utils/currency.js)
  logo: '', // header logo image URL (also used as favicon); empty = text store name
  defaultLanguage: 'en', // one of en/zh/es/fr/pt; a visitor's own choice wins
  // Homepage content blocks (admin-editable). Empty string / empty array
  // means "use the built-in theme/i18n default" on the storefront.
  navItems: [], // top navigation [{label, link, type?, categoryId?}]; empty = i18n zone labels
  heroEyebrow: '', // overrides the theme label above the headline
  dealerTitle: '', // dealer (distributor) card title
  dealerText: '', // dealer card body text
  dealerButton: '', // dealer card button label
  hotline: '', // export hotline phone shown on the dealer card
  storyTitle: '', // brand story title (theme F section)
  storyText: '', // brand story body text
  profileUrl: 'https://williscarpaint.com/', // company profile page: embedded full-page in an iframe when set; empty = text version (storyTitle/storyText)
  // "Start Chat with" floating panel (SocialWidget): full profile URLs;
  // empty = that icon is hidden. wechat is an account ID (tap copies it).
  // whatsapp / email / hotline above are reused as panel icons too.
  tiktok: '', // TikTok profile URL
  instagram: '', // Instagram profile URL
  facebook: '', // Facebook page URL
  youtube: '', // YouTube channel URL
  wechat: '' // WeChat account ID
})

function mergeConfig(data) {
  if (!data || typeof data !== 'object') return
  for (const k of Object.keys(siteConfig)) {
    // navItems is an array: any array value wins, including an empty one
    // (the admin may deliberately clear the navigation).
    if (k === 'navItems') {
      if (Array.isArray(data[k])) {
        siteConfig.navItems = data[k]
          .filter((i) => i && typeof i === 'object')
          .map((i) => {
            const item = { label: String(i.label || ''), link: String(i.link || '') }
            const type = String(i.type || '')
            if (type === 'category' || type === 'anchor' || type === 'external') item.type = type
            if (i.categoryId !== undefined && i.categoryId !== null && String(i.categoryId) !== '') {
              item.categoryId = String(i.categoryId)
            }
            return item
          })
      }
      continue
    }
    // profileUrl is the exception to the "empty = keep default" rule
    // below: an explicitly cleared value ('') must win over the built-in
    // default, because clearing it in the admin is how the profile page
    // switches back to the text version. Only undefined/null (field not
    // sent at all) keeps the default.
    if (k === 'profileUrl') {
      if (typeof data[k] === 'string') siteConfig.profileUrl = data[k]
      continue
    }
    if (data[k] === undefined || data[k] === null || data[k] === '') continue
    if (k === 'defaultTheme') {
      const theme = String(data[k]).toLowerCase()
      if (/^[a-h]$/.test(theme)) siteConfig.defaultTheme = theme
    } else {
      siteConfig[k] = data[k]
    }
  }
}

async function fetchJsonWithTimeout(url, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json()
    if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
      return body.code === 200 ? body.data : null
    }
    return body
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function loadSiteConfig() {
  // 1) Static file next to the built site (plat export flow).
  mergeConfig(await fetchJsonWithTimeout('pc-config.json', 2500))
  // 2) Overseas backend config endpoint — wins when reachable, so the
  //    admin can later switch to API-managed config without a rebuild.
  const base = (import.meta.env?.VITE_API_BASE || '/api').replace(/\/$/, '')
  mergeConfig(await fetchJsonWithTimeout(`${base}/site-config`, 2500))
}
