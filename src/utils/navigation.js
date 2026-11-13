export function navigationItems(config,t) {
 const configured=Array.isArray(config.navItems)?config.navItems.filter(item=>item&&item.label):[]
 const extras=[{label:t('formulaSearch'),type:'anchor',link:'#formula'},{label:t('companyProfile'),type:'anchor',link:'#profile'}]
 const source=config.navigationConfigured===true?configured:(configured.length?configured:t('zones').map(label=>({label}))).concat(extras.filter(extra=>!configured.some(item=>item.link===extra.link)))
 return source.filter(item=>item.enabled!==false).map(item=>{
  let label=item.label
  if(/^zones\.[0-5]$/.test(item.labelKey||'')) label=t('zones')[Number(item.labelKey.split('.')[1])]||label
  else if(['formulaSearch','companyProfile'].includes(item.labelKey)) label=t(item.labelKey)
  return {...item,label}
 })
}
