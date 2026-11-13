// Global price-display rules.
//
// The admin site config carries a master switch, showPrices (default on).
// Turning it off puts the whole storefront into inquiry mode: every
// product renders exactly like a per-product 面议 (negotiable) one — the
// 面议 label instead of any price, no tier pricing, no add-to-cart.
// showAsNegotiable() is the single predicate the templates use, so the
// per-product flag and the global switch can never drift apart.
import { siteConfig } from '../siteConfig.js'

export function pricesOff() {
  return siteConfig.showPrices === false
}

export function showAsNegotiable(product) {
  return pricesOff() || !!(product && product.negotiable)
}
