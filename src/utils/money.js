import { siteConfig } from '../siteConfig.js'

export function formatMoney(value, currency = siteConfig.currency) {
  const amount = Number(value) || 0
  const code = String(currency || 'CNY').trim().toUpperCase()
  const symbol = ['CNY', 'RMB', '人民币', '¥', '￥'].includes(code) ? '¥' : ['USD', '$'].includes(code) ? '$' : code + ' '
  return symbol + amount.toFixed(2)
}
