// Product snapshot attached to the online-chat session.
//
// Tapping 询价 on a product card / detail page opens the chat with the
// product attached, so both the visitor (a small card pinned above the
// messages) and the agents in the admin console know what the enquiry is
// about. The snapshot holds display values exactly as the visitor saw
// them: the localised name and the formatted price label (or the
// negotiable flag for 面议 goods, which have no numeric price).
//
// The snapshot persists in localStorage so it survives navigation and
// reloads; the ChatWidget syncs it to the backend session via
// POST /api/chat/start (product = set, clearProduct = remove). In demo
// mode (backend unreachable) the local copy alone drives the card.
import { tx } from '../i18n.js'
import { formatPrice } from './currency.js'

const LS_KEY = 'taojie-chat-product'

// Assemble the snapshot for a catalogue product object (App/ProductCard
// shape: id, name (map|string), image, price, negotiable).
export function buildChatProduct(p) {
  if (!p) return null
  const name = tx(p.name) || ''
  if (!name) return null
  const negotiable = !!p.negotiable
  return {
    id: String(p.id ?? ''),
    name: String(name),
    image: p.image ? String(p.image) : '',
    priceLabel: negotiable ? '' : formatPrice(p.price),
    negotiable
  }
}

export function loadChatProduct() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && v.name ? v : null
  } catch { return null }
}

export function saveChatProduct(product) {
  try {
    if (product) localStorage.setItem(LS_KEY, JSON.stringify(product))
    else localStorage.removeItem(LS_KEY)
  } catch { /* storage unavailable */ }
}
