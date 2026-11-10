import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { loadSiteConfig } from './siteConfig.js'
import { initLocaleFromConfig } from './i18n.js'

// Load the admin-edited runtime config (pc-config.json) before first paint;
// it resolves silently with defaults when the file is absent.
loadSiteConfig().finally(() => {
  initLocaleFromConfig()
  createApp(App).mount('#app')
})
