import { locale } from '../i18n.js'

// Resolve one nav item's display label. Admin-authored multi-language
// names win (names[locale] → names.en → names.zh); items carrying a
// built-in labelKey fall back to the i18n default for that key; plain
// items use their label.
function navLabel(item, t) {
  const names = item.names && typeof item.names === 'object' ? item.names : null
  if (names) {
    const v = names[locale.value] || names.en || names.zh
    if (typeof v === 'string' && v) return v
  }
  if (/^zones\.[0-5]$/.test(item.labelKey || '')) return t('zones')[Number(item.labelKey.split('.')[1])] || item.label
  if (['formulaSearch', 'companyProfile'].includes(item.labelKey)) return t(item.labelKey)
  return item.label
}

export function navigationItems(config, t) {
  const configured = Array.isArray(config.navItems) ? config.navItems.filter(item => item && item.label) : []
  const extras = [{ label: t('formulaSearch'), type: 'anchor', link: '#formula' }, { label: t('companyProfile'), type: 'anchor', link: '#profile' }]
  const source = config.navigationConfigured === true ? configured : (configured.length ? configured : t('zones').map(label => ({ label }))).concat(extras.filter(extra => !configured.some(item => item.link === extra.link)))
  return source.filter(item => item.enabled !== false).map(item => ({ ...item, label: navLabel(item, t) }))
}
