import { reactive } from 'vue'

// Runtime site configuration for the overseas PC showcase.
// Edited in the platform admin (plat: 系统设置 → PC商城设置 → 海外PC站配置),
// exported there as pc-config.json and placed next to the built site
// (dist/pc-config.json). Every field is optional; missing fields keep
// the defaults below, and a missing file changes nothing.
export const siteConfig = reactive({
  defaultTheme: 'h', // one of a–h; a visitor's own theme choice (localStorage) wins
  heroTitle: '', // overrides the theme headline when set
  heroSubtitle: '', // overrides the theme sub-line when set
  announcement: '', // thin notice shown in the top bar when set
  showRfq: true, // RFQ panel + section visibility
  whatsapp: '', // shown in the footer when set
  email: '', // shown in the footer when set
  currency: 'USD', // label only; prices come from the shop API as returned
  defaultLanguage: 'en', // one of en/zh/es/fr/pt; a visitor's own choice wins
})

export async function loadSiteConfig() {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch('pc-config.json', { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return
    const data = await res.json()
    if (data && typeof data === 'object') {
      for (const k of Object.keys(siteConfig)) {
        if (data[k] !== undefined && data[k] !== null && data[k] !== '') siteConfig[k] = data[k]
      }
    }
  } catch {
    // No config file (or unreadable): keep defaults silently.
  }
}
