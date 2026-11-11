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

## Data: overseas backend with demo fallback

`src/api.js` calls the **overseas mall backend** (`taojie-overseas-server`,
a separate lightweight project — see `docs/设计需求文档.md`). The domestic
`tjmall` front API is **not** called at runtime: it is the mini-program's
login-based API (anonymous calls return 401), so product data reaches the
overseas backend by import/sync from tjmall instead.

| Purpose    | Endpoint |
|------------|----------|
| Categories | `GET categories?lang=` |
| Products   | `GET products?keyword=&categoryId=&page=&limit=&lang=` |
| Detail     | `GET products/<id>?lang=` |
| Hot words  | `GET keywords` |
| RFQ        | `POST rfq` (falls back to browser-local storage when unreachable) |
| Site config | `GET site-config` (merged over `pc-config.json` at startup) |

Base URL comes from `VITE_API_BASE` (see `.env.example`), default `/api`
(same origin in production; in dev, Vite proxies `/api` to
`http://localhost:3100`).

Responses are normalized defensively (`name`, `image`, `price`, `otPrice`,
`sales`, `unit`, …). **On any failure — offline, timeout (6 s), unexpected
shape — the site falls back to bundled sample data**
(`src/data/sample.js`: the 8 prototype products plus real store paints)
and the footer shows “Demo data”.

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
- The **RFQ form is submitted to the overseas backend** (`POST rfq`) when
  it is reachable; otherwise it is kept in `localStorage` as a fallback.
  Sales notification runs through the backend (webhook hook).
- Sign In / Orders links in the top bar are placeholders.

## Deploy

`npm run build` produces a static `dist/` — host it on any static server /
CDN / the mall's Nginx next to the overseas backend, with `/api/`
reverse-proxied to the backend:

```bash
npm run build   # VITE_API_BASE defaults to /api (same origin)
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
    RfqPanel.vue        # RFQ form (posts to backend, localStorage fallback)
```

## Admin configuration (plat → pc-config.json)

The site reads runtime config at startup: first an optional `pc-config.json`
file from the same directory as the built site (`dist/pc-config.json`, a
default copy ships in `public/`), then the overseas backend's
`GET site-config`, which wins when reachable. The file flow is edited in the
platform admin repo `OrderDe/plat` under 系统设置 → PC商城设置 → 海外PC站配置,
which exports exactly this file; the backend copy is managed through its
admin endpoint (`PUT /api/admin/site-config`).
Fields (all optional): `defaultTheme` (a–h), `heroTitle`, `heroSubtitle`,
`announcement`, `showRfq`, `whatsapp`, `email`, `currency` (label only),
`defaultLanguage` (en/zh/es/fr/pt), `allowThemeSwitch` (false hides the
top-bar theme select and forces `defaultTheme` for every visitor).
A visitor's own theme choice in the top bar overrides `defaultTheme`.
