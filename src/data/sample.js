// Bundled demo data. Used whenever the live shop API cannot be reached
// (offline, timeout, CORS blocked, empty response). Products 1–8 are the
// prototype set; 9–14 mirror real paints observed live in the Taojie store
// (prices in USD are showcase conversions for display only).

export const sampleCategories = [
  { id: 'paint', name: 'Automotive Paint', count: 6 },
  { id: 'primers', name: 'Primers', count: 3 },
  { id: 'clear', name: 'Clear Coats', count: 2 },
  { id: 'pearls', name: 'Pearls & Effects', count: 2 },
  { id: 'home', name: 'Home & Living', count: 2 },
  { id: 'appliances', name: 'Appliances', count: 2 },
  { id: 'paper', name: 'Paper & Tissue', count: 1 },
  { id: 'cleaning', name: 'Cleaning', count: 1 }
]

// visual: [gradientStart, gradientEnd, glyph] — rendered as CSS, no external images.
export const sampleProducts = [
  {
    id: 1, name: '2K High-Gloss Clear Coat', categoryId: 'clear', category: 'Clear Coats',
    price: 9.9, otPrice: 14.5, sales: 1280, unit: '1L tin', moq: 100,
    visual: ['#ffd76e', '#ff9d1c', '2K'], tag: 'Best seller',
    blurb: 'Mirror gloss, fast cure, excellent weather resistance for refinish systems.',
    specs: { 'Mix ratio': '2 : 1 with hardener', 'Drying time': '30 min @ 25°C (touch dry)', 'Coverage': '8–10 m² / L', 'Shelf life': '24 months' }
  },
  {
    id: 2, name: '1K Metallic Basecoat — Silver', categoryId: 'paint', category: 'Automotive Paint',
    price: 7.4, otPrice: 10.2, sales: 860, unit: '1L tin', moq: 100,
    visual: ['#cfd8e3', '#7d8fa8', '1K'], tag: '',
    blurb: 'Fine aluminium effect, strong hiding power, blends easily into OEM finishes.',
    specs: { 'Mix ratio': 'Ready to use / 1 : 0.8 thinner', 'Drying time': '15 min flash-off', 'Coverage': '9–11 m² / L', 'Shelf life': '24 months' }
  },
  {
    id: 3, name: 'Epoxy Primer — Grey', categoryId: 'primers', category: 'Primers',
    price: 8.6, otPrice: 11.9, sales: 640, unit: '1L set', moq: 100,
    visual: ['#9aa3ad', '#565f68', 'EP'], tag: '',
    blurb: 'Anti-rust epoxy barrier for bare metal, fibreglass and old paint films.',
    specs: { 'Mix ratio': '4 : 1 with epoxy hardener', 'Drying time': '2 h sandable @ 25°C', 'Coverage': '6–8 m² / L', 'Shelf life': '18 months' }
  },
  {
    id: 4, name: 'Pearl Pigment Set — 12 Colours', categoryId: 'pearls', category: 'Pearls & Effects',
    price: 18.9, otPrice: 26.0, sales: 430, unit: 'set', moq: 50,
    visual: ['#ff7ad9', '#7a5cff', 'PL'], tag: 'New',
    blurb: 'Gold, copper, interference and crystal pearls for custom colour effects.',
    specs: { 'Contents': '12 × 100 g jars', 'Particle size': '10–60 µm', 'Dosage': '3–8% of basecoat', 'Shelf life': '36 months' }
  },
  {
    id: 5, name: 'F23 — 1K Grey Primer', categoryId: 'primers', category: 'Primers',
    price: 8.5, otPrice: 12.0, sales: 210, unit: '1L tin', moq: 100,
    visual: ['#b7bec7', '#6e7780', 'F23'], tag: '',
    blurb: 'Fast-sanding 1K primer surfacer, the workhorse under any Taojie basecoat.',
    specs: { 'Mix ratio': 'Ready to use', 'Drying time': '20 min sandable', 'Coverage': '7–9 m² / L', 'Shelf life': '24 months' }
  },
  {
    id: 6, name: '1K176 — Golden Pearl (Green Phase)', categoryId: 'pearls', category: 'Pearls & Effects',
    price: 4.6, otPrice: 6.8, sales: 150, unit: '100g jar', moq: 200,
    visual: ['#ffe259', '#c99612', '176'], tag: '',
    blurb: 'Warm gold flop with a green phase shift — a signature Taojie effect pearl.',
    specs: { 'Particle size': '10–40 µm', 'Dosage': '3–6% of basecoat', 'Heat resistance': '180°C', 'Shelf life': '36 months' }
  },
  {
    id: 7, name: '2K278 — Bright Red Basecoat', categoryId: 'paint', category: 'Automotive Paint',
    price: 4.0, otPrice: 5.9, sales: 175, unit: '1L tin', moq: 100,
    visual: ['#ff4b33', '#a30f00', '278'], tag: '',
    blurb: 'High-chroma solid red for 2K systems, strong coverage in two coats.',
    specs: { 'Mix ratio': '2 : 1 with hardener', 'Drying time': '25 min @ 25°C', 'Coverage': '8–10 m² / L', 'Shelf life': '24 months' }
  },
  {
    id: 8, name: 'F25 — 1K White Primer', categoryId: 'primers', category: 'Primers',
    price: 9.9, otPrice: 13.5, sales: 130, unit: '1L tin', moq: 100,
    visual: ['#ffffff', '#cfd4da', 'F25'], tag: '',
    blurb: 'Bright white ground coat that makes light and pearl colours pop.',
    specs: { 'Mix ratio': 'Ready to use', 'Drying time': '20 min sandable', 'Coverage': '7–9 m² / L', 'Shelf life': '24 months' }
  },
  {
    id: 9, name: '2K801 — High-Gloss Clear Coat', categoryId: 'clear', category: 'Clear Coats',
    price: 2.4, otPrice: 3.6, sales: 320, unit: '0.5L tin', moq: 200,
    visual: ['#ffe9a8', '#e8a812', '801'], tag: '',
    blurb: 'Compact-tin version of the flagship 2K clear — ideal sample and trial orders.',
    specs: { 'Mix ratio': '2 : 1 with hardener', 'Drying time': '30 min @ 25°C', 'Coverage': '8–10 m² / L', 'Shelf life': '24 months' }
  },
  {
    id: 10, name: 'F2 — Plastic Primer', categoryId: 'paint', category: 'Automotive Paint',
    price: 2.7, otPrice: 4.1, sales: 95, unit: '1L tin', moq: 100,
    visual: ['#8be0d4', '#2b7a6e', 'F2'], tag: '',
    blurb: 'Adhesion promoter for PP/ABS bumpers and trim — no sanding needed on new parts.',
    specs: { 'Mix ratio': 'Ready to use', 'Drying time': '10 min flash-off', 'Coverage': '10–12 m² / L', 'Shelf life': '18 months' }
  },
  {
    id: 11, name: 'Premium Facial Tissue — 6 Large Packs', categoryId: 'paper', category: 'Paper & Tissue',
    price: 1.8, otPrice: 2.4, sales: 5200, unit: '6-pack', moq: 500,
    visual: ['#aee3ff', '#4a90d9', 'TS'], tag: 'High volume',
    blurb: '5-ply virgin wood pulp, no fluorescent agents — the store\u2019s daily-goods best seller.',
    specs: { 'Ply': '5', 'Sheets': '420 / pack', 'Material': 'Virgin wood pulp', 'Packaging': '6 packs / bag' }
  },
  {
    id: 12, name: 'Electric Kettle — 1.8L Stainless', categoryId: 'appliances', category: 'Appliances',
    price: 6.9, otPrice: 9.9, sales: 940, unit: 'pc', moq: 200,
    visual: ['#dfe6ee', '#8b98a8', 'KT'], tag: '',
    blurb: '1500W fast boil, dry-boil protection, food-grade 304 stainless interior.',
    specs: { 'Capacity': '1.8 L', 'Power': '1500 W', 'Voltage': '220–240 V', 'Plug': 'EU / UK / US on request' }
  },
  {
    id: 13, name: 'Mini Rice Cooker — 1.6L', categoryId: 'appliances', category: 'Appliances',
    price: 11.5, otPrice: 16.0, sales: 610, unit: 'pc', moq: 200,
    visual: ['#ffd9c2', '#e07b39', 'RC'], tag: '',
    blurb: 'Compact cooker for dorms and small kitchens, non-stick inner pot.',
    specs: { 'Capacity': '1.6 L', 'Power': '400 W', 'Voltage': '220–240 V', 'Functions': 'Cook / Keep warm' }
  },
  {
    id: 14, name: 'Microfibre Cloths — 12 Pack', categoryId: 'cleaning', category: 'Cleaning',
    price: 1.5, otPrice: 2.2, sales: 3100, unit: '12-pack', moq: 500,
    visual: ['#b8f1cc', '#3d9e63', 'MF'], tag: '',
    blurb: 'Lint-free detailing cloths — the same ones body shops use with Taojie coatings.',
    specs: { 'Size': '30 × 30 cm', 'Weight': '300 GSM', 'Blend': '80% polyester / 20% polyamide', 'Colours': 'Assorted' }
  }
]

export const sampleKeywords = ['clear coat', 'primer', 'pearl', 'basecoat', 'tissue', 'kettle']

export const sampleBrands = ['TAOJIE Paint', 'CHICAI', 'ColourLab', 'HomeDaily', 'ProFinish', 'AsiaExport']
