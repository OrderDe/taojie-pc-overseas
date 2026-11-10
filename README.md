# TAOJIE — Overseas PC Showcase

A standalone PC storefront for the Taojie mall, built from the approved
prototype page (8 themes, A–H). It is a **new, separate project** — it does
not modify the existing backend (`tjmall`), the admin frontends (`plat-copy`,
`mer`) or the mini-program (`uniapp`). It only *reads* the same shop API the
mini-program uses.

## Run

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # outputs dist/
npm run preview  # serve the production build
```

Requires Node 18+ (developed on Node 24 / npm 10).

## Data: live API with demo fallback

`src/api.js` calls the shop's public front API (CRMEB-style, no login):

| Purpose    | Endpoint |
|------------|----------|
| Categories | `GET product/category/get/tree/IntegrateCategory` |
| Products   | `GET product/list`, falling back to `GET index/product/list`, then `GET index/product` |
| Detail     | `GET product/detail?textOriginalId=<id>` |
| Hot words  | `GET index/search/keyword` |

Base URL comes from `VITE_API_BASE` (see `.env.example`), default
`https://mall.taojieyph.com/front`.

Responses are normalized defensively (`storeName`, `image`, `price`,
`otPrice`, `sales`, `unitName`, …). **On any failure — offline, timeout
(6 s), unexpected shape, or CORS — the site falls back to bundled sample
data** (`src/data/sample.js`: the 8 prototype products plus real store
paints) and the footer shows “Demo data — connect the shop API”.

> ⚠️ Live mode from a new domain is **not yet verified**: the backend must
> allow cross-origin requests from wherever this site is deployed (CORS),
> and the endpoints above must be enabled for that origin. Until then the
> site runs in demo mode, which is fully browsable.

## Themes

Switch in the top bar; the choice persists in `localStorage`. Default: **H**.

| Key | Theme | Notes |
|-----|-------|-------|
| A | Classic Mall | White/red, dense promo layout, closest to 7dingdong |
| B | Cross-Border Pro | Deep blue, trust badges, Request Quote |
| C | Minimal Modern | Big whitespace/type, category rail hidden, no promo badges |
| D | Dark Industrial | Black/orange, spec rows (mix ratio, drying time) on cards |
| E | Orange Pulse | Saturated orange, rounded promo cards, huge prices |
| F | Editorial Wholesale | Serif, cream, brand-story section |
| G | Port Trade | Port/container hero, RFQ form inside hero, tiered pricing |
| H | Colour Field *(default)* | Fluid-paint hero, spectrum strip on cards, colour is the brand |

All themes share the approved formula: full-bleed hero, huge white headline,
white search capsule straddling the hero's bottom edge, large cards/prices,
few fragmented labels. Hero visuals are pure CSS gradients (no external
images that can break).

## Languages

Five UI languages, switched in the top bar and persisted in `localStorage`:
English (default), 中文， Español, Français, Português. `src/i18n.js` holds
the dictionaries — `t()` for fixed UI strings and per-theme hero copy, `tx()`
for the bundled demo catalogue (product names, categories, units, tags,
blurbs, spec keys/values, keyed by the English source text). Live API
strings pass through unchanged. The admin can set the default language for
first-time visitors via `defaultLanguage` in `pc-config.json`; a visitor's
own choice always wins.

## Scope (showcase only)

- The **cart is local-only** (in-memory): no checkout, no payment.
- The **RFQ form is stored in `localStorage` only** and never sent anywhere;
  wiring it to sales (email/WhatsApp/CRM) is a production follow-up.
- Sign In / Orders links in the top bar are placeholders.

## Deploy

`npm run build` produces a static `dist/` — host it on any static server /
CDN / the shop's Nginx, and set `VITE_API_BASE` at build time to point at
the shop backend:

```bash
VITE_API_BASE=https://mall.taojieyph.com/front npm run build
```

## Layout

```
src/
  App.vue               # page shell, routing (home/detail), cart, theme state
  api.js                # API client + normalization + demo fallback
  style.css             # base layout + all 8 themes (CSS variables)
  data/sample.js        # bundled demo products/categories
  components/
    ProductCard.vue     # incl. theme-D spec rows and theme-G tiered pricing
    CartDrawer.vue      # local showcase cart
    RfqPanel.vue        # RFQ form (localStorage only)
```

## Admin configuration (plat → pc-config.json)

The site reads an optional runtime config file, `pc-config.json`, from the
same directory as the built site (`dist/pc-config.json`, a default copy
ships in `public/`). It is edited in the platform admin repo `OrderDe/plat`
under 系统设置 → PC商城设置 → 海外PC站配置, which exports exactly this file.
Fields (all optional): `defaultTheme` (a–h), `heroTitle`, `heroSubtitle`,
`announcement`, `showRfq`, `whatsapp`, `email`, `currency` (label only),
`defaultLanguage` (en/zh/es/fr/pt).
A visitor's own theme choice in the top bar overrides `defaultTheme`.
