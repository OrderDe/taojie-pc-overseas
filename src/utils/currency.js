import { ref, computed } from 'vue'

// Display-currency conversion for storefront prices.
//
// Stored product prices are in the site's base currency (site-config
// `baseCurrency` — CNY for the shop's imported data). A visitor can pick
// a display currency in the top bar; prices then convert at the day's
// rate, fetched once from the backend's public FX endpoint (which shares
// the 12h cache with the admin price calculator). Conversion is
// display-only: nothing here changes stored prices or RFQ amounts.
//
// Failure behaviour: if rates never load (offline backend, FX source
// down), formatPrice renders the amount in the base currency unchanged —
// never a wrong number. In demo mode initFx is never called and the base
// stays USD, so demo prices keep their original "$x.xx" rendering.

export const CURRENCIES = [
  { code: 'CNY', symbol: '¥', decimals: 2 },
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'ZAR', symbol: 'R', decimals: 2 },
  { code: 'AED', symbol: 'AED ', decimals: 2 },
  { code: 'SAR', symbol: 'SAR ', decimals: 2 },
  { code: 'IDR', symbol: 'Rp', decimals: 0 },
  { code: 'VND', symbol: '₫', decimals: 0 },
  { code: 'THB', symbol: '฿', decimals: 2 },
  { code: 'MYR', symbol: 'RM', decimals: 2 },
  { code: 'SGD', symbol: 'S$', decimals: 2 },
  { code: 'PHP', symbol: '₱', decimals: 2 },
  { code: 'INR', symbol: '₹', decimals: 2 },
  { code: 'RUB', symbol: '₽', decimals: 2 },
  { code: 'BRL', symbol: 'R$', decimals: 2 },
  { code: 'MXN', symbol: 'MX$', decimals: 2 },
  { code: 'AUD', symbol: 'A$', decimals: 2 },
  { code: 'JPY', symbol: '¥', decimals: 0 },
  { code: 'KRW', symbol: '₩', decimals: 0 },
  { code: 'TRY', symbol: '₺', decimals: 2 },
  { code: 'NGN', symbol: '₦', decimals: 2 },
  { code: 'KES', symbol: 'KSh ', decimals: 2 },
  { code: 'EGP', symbol: 'E£', decimals: 2 }
]
const META = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]))

// Same API base expression as siteConfig.js (optional-chained
// import.meta.env keeps this module importable outside Vite too).
const API_BASE = (import.meta.env?.VITE_API_BASE || '/api').replace(/\/$/, '')

let savedChoice = ''
try { savedChoice = localStorage.getItem('tj-currency') || '' } catch { /* storage unavailable */ }

export const baseCode = ref('USD') // demo-mode assumption until initFx runs
export const rates = ref({})
export const fxLoaded = ref(false)
export const displayCode = ref(META[savedChoice] ? savedChoice : 'USD')

// True only when prices on screen are actually being converted (drives
// the "converted at today's rate" note on the detail page).
export const isConverted = computed(() =>
  fxLoaded.value && displayCode.value !== baseCode.value && Number(rates.value[displayCode.value]) > 0)

export function setDisplay(code) {
  if (!META[code]) return
  displayCode.value = code
  savedChoice = code
  try { localStorage.setItem('tj-currency', code) } catch { /* storage unavailable */ }
}

// Load the rate table for the site's base currency. First-visit display
// default: Chinese UI → CNY, anything else → USD; a saved choice wins.
// Failures are silent by design (see header comment).
export async function initFx(base, uiLocale) {
  const b = String(base || '').toUpperCase()
  baseCode.value = META[b] ? b : 'CNY'
  if (!savedChoice) displayCode.value = uiLocale === 'zh' ? 'CNY' : 'USD'
  try {
    const res = await fetch(`${API_BASE}/fx/rates?base=${baseCode.value}`, {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return
    const body = await res.json()
    // Node returns the bare object; the Java backend wraps in {code, data}.
    const data = body && typeof body === 'object' && 'code' in body && 'data' in body
      ? (body.code === 200 ? body.data : null)
      : body
    if (data && data.rates && typeof data.rates === 'object') {
      rates.value = data.rates
      fxLoaded.value = true
    }
  } catch { /* silent fallback to base-currency rendering */ }
}

// Format an amount stored in the base currency for display.
export function formatPrice(amount) {
  const n = Number(amount) || 0
  let code = displayCode.value
  let value = n
  if (code !== baseCode.value) {
    const rate = fxLoaded.value ? Number(rates.value[code]) : NaN
    if (rate > 0) value = n * rate
    else code = baseCode.value // no usable rate: show the base amount as-is
  }
  const meta = META[code] || META.USD
  return meta.symbol + value.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals
  })
}
