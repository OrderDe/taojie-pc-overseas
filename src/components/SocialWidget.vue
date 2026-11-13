<script setup>
// Floating "Start Chat with" panel (bottom-right, stacked above the chat
// widget). Each icon jumps straight to the shop's own account: email /
// phone / WhatsApp reuse the site-config contact fields; TikTok,
// Instagram, Facebook, YouTube take full profile URLs from the admin
// config; WeChat has no web jump, so a tap shows the ID and copies it.
// An icon renders only when its field is filled in the admin; with no
// channels configured at all the whole widget stays hidden.
import { computed, ref } from 'vue'
import { siteConfig } from '../siteConfig.js'
import { t } from '../i18n.js'
import { trackClick } from '../utils/track.js'

const ICONS = {
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9.8 8.2c.1-.3.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.4.5c.5.9 1.4 1.8 2.4 2.3l.5-.5c.2-.1.4-.2.6-.1l1.7.8c.3.2.4.3.4.6v.5c0 .2-.1.5-.6.6-.5.2-1.2.2-2.4-.2-2.7-.9-4.9-3.2-5.7-5.6-.3-1-.2-1.8 0-2.1z" fill="currentColor" stroke="none"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37a4 4 0 1 1-7.94 1.26 4 4 0 0 1 7.94-1.26z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
  tiktok: '<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 1.88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  youtube: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none"/>',
  wechat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><circle cx="8.5" cy="10.5" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r=".8" fill="currentColor" stroke="none"/>'
}

const open = ref(false)
const wxCopied = ref(false)

const channels = computed(() => {
  const c = []
  const cfg = siteConfig
  if (cfg.email) c.push({ key: 'email', label: 'Email', color: '#2563eb', href: `mailto:${cfg.email}` })
  if (cfg.hotline) c.push({ key: 'phone', label: 'Phone', color: '#7c3aed', href: `tel:${String(cfg.hotline).replace(/[\s()-]/g, '')}` })
  if (cfg.whatsapp) {
    const digits = String(cfg.whatsapp).replace(/\D/g, '')
    if (digits) c.push({ key: 'whatsapp', label: 'WhatsApp', color: '#25d366', href: `https://wa.me/${digits}` })
  }
  if (cfg.instagram) c.push({ key: 'instagram', label: 'Instagram', color: '#d62976', href: cfg.instagram })
  if (cfg.tiktok) c.push({ key: 'tiktok', label: 'TikTok', color: '#111111', href: cfg.tiktok })
  if (cfg.facebook) c.push({ key: 'facebook', label: 'Facebook', color: '#1877f2', href: cfg.facebook })
  if (cfg.youtube) c.push({ key: 'youtube', label: 'YouTube', color: '#ff0000', href: cfg.youtube })
  if (cfg.wechat) c.push({ key: 'wechat', label: 'WeChat', color: '#07c160', wechat: cfg.wechat })
  return c
})

function onJump(ch) {
  trackClick(`社交:${ch.label}`)
}

async function onWeChat(ch) {
  trackClick('社交:WeChat')
  wxCopied.value = false
  try {
    await navigator.clipboard.writeText(ch.wechat)
    wxCopied.value = true
  } catch {
    // Clipboard unavailable (permissions/insecure context): the ID is
    // still shown below so the visitor can copy it by hand.
  }
}
</script>

<template>
  <div v-if="channels.length" class="social-widget">
    <div v-if="open" class="social-panel">
      <div class="social-title">{{ t('startChatWith') }}</div>
      <div class="social-grid">
        <template v-for="ch in channels" :key="ch.key">
          <a v-if="ch.href" class="social-item" :href="ch.href" target="_blank" rel="noopener" @click="onJump(ch)">
            <span class="social-icon" :style="{ background: ch.color }">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[ch.key]" />
            </span>
            <span class="social-label">{{ ch.label }}</span>
          </a>
          <button v-else type="button" class="social-item" @click="onWeChat(ch)">
            <span class="social-icon" :style="{ background: ch.color }">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[ch.key]" />
            </span>
            <span class="social-label">{{ ch.label }}</span>
          </button>
        </template>
      </div>
      <div v-if="siteConfig.wechat" class="social-wechat">
        WeChat: <b>{{ siteConfig.wechat }}</b><span v-if="wxCopied"> · {{ t('copied') }}</span>
      </div>
    </div>
    <button type="button" class="social-fab" :aria-label="t('startChatWith')" @click="open = !open">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="10.7" x2="15.4" y2="6.3" /><line x1="8.6" y1="13.3" x2="15.4" y2="17.7" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.social-widget {
  position: fixed; inset-inline-end: 22px; bottom: 86px; z-index: 60;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
  font-size: 14px;
}
.social-fab {
  width: 46px; height: 46px; border-radius: 50%; border: 0; cursor: pointer;
  background: #1f2430; color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(15, 20, 35, .3);
}
.social-panel {
  background: #fff; border-radius: 16px; box-shadow: 0 12px 34px rgba(15, 20, 35, .22);
  padding: 16px 18px 12px; width: 300px; max-width: calc(100vw - 44px);
}
.social-title { font-weight: 700; text-align: center; color: #1f2430; margin-bottom: 12px; }
.social-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 6px;
}
.social-item {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none;
}
.social-icon {
  width: 46px; height: 46px; border-radius: 50%; color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.social-label { font-size: 11px; color: #4b5563; line-height: 1; }
.social-wechat { margin-top: 12px; text-align: center; font-size: 12.5px; color: #374151; word-break: break-all; }
</style>
