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

function mergeConfig(data) {
  if (!data || typeof data !== 'object') return
  for (const k of Object.keys(siteConfig)) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') siteConfig[k] = data[k]
  }
}

async function fetchJsonWithTimeout(url, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
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
  const base = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
  mergeConfig(await fetchJsonWithTimeout(`${base}/site-config`, 2500))
}
