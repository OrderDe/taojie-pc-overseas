<script setup>
// Floating online-chat widget (bottom-right). The visitor is identified by
// a random session token stored in localStorage — no account needed.
// Messages are polled incrementally every 3 seconds (afterId). When the
// backend is unreachable the widget shows a friendly offline note instead
// of failing (same defensive pattern as the catalogue API).
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { chatStart, chatSend, chatPull, chatPing, chatTyping } from '../api.js'
import { EMOJIS, isEmojiOnlyMessage } from '../emojis.js'
import { t } from '../i18n.js'

const LS_TOKEN = 'taojie-chat-token'
const LS_NAME = 'taojie-chat-name'

const open = ref(false)
const token = ref('')
const visitorName = ref('')
const nameInput = ref('')
const messages = ref([])
const draft = ref('')
const sending = ref(false)
const offline = ref(false)
const unread = ref(0)
const agentTyping = ref(false)
const emojiOpen = ref(false)
const listEl = ref(null)
let lastId = 0
let timer = null
let pingTimer = null
let lastTypingAt = 0

// Where the visitor came from + the page they are on now; reported at
// start and on each heartbeat so the admin console can follow along.
function pageInfo() {
  return { page: window.location.pathname, pageTitle: document.title }
}
function referrer() {
  try { return document.referrer || '' } catch { return '' }
}

async function heartbeat() {
  if (!token.value) return
  try { await chatPing(token.value, pageInfo()) } catch { /* presence is best-effort */ }
}

function lsGet(key) { try { return localStorage.getItem(key) || '' } catch { return '' } }
function lsSet(key, value) { try { localStorage.setItem(key, value) } catch { /* ignore */ } }
function lsDel(key) { try { localStorage.removeItem(key) } catch { /* ignore */ } }

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function startChat() {
  const name = (nameInput.value || visitorName.value || '').trim()
  try {
    const r = await chatStart({ name, token: token.value, referrer: referrer(), ...pageInfo() })
    token.value = r.token
    visitorName.value = r.name || name
    lsSet(LS_TOKEN, token.value)
    if (visitorName.value) lsSet(LS_NAME, visitorName.value)
    offline.value = false
    await pull(true)
  } catch {
    offline.value = true
  }
}

async function pull(reset = false) {
  if (!token.value) return
  try {
    const r = await chatPull(token.value, reset ? 0 : lastId)
    offline.value = false
    agentTyping.value = !!(r && r.agentTyping)
    const incoming = (r && r.messages) || []
    if (reset) { messages.value = []; lastId = 0 }
    for (const m of incoming) {
      if (m.id > lastId) {
        messages.value.push(m)
        lastId = m.id
        if (m.sender === 'agent' && !open.value) unread.value += 1
      }
    }
    if (incoming.length && open.value) await scrollToBottom()
  } catch {
    // A 401 means the stored token no longer maps to a session (e.g. the
    // database was reset): forget it and offer a fresh start.
    offline.value = true
    if (token.value) { token.value = ''; lsDel(LS_TOKEN) }
  }
}

async function send() {
  const body = draft.value.trim()
  if (!body || sending.value) return
  sending.value = true
  try {
    if (!token.value) await startChat()
    const m = await chatSend(token.value, body)
    if (m && m.id > lastId) { messages.value.push(m); lastId = m.id }
    draft.value = ''
    offline.value = false
    await scrollToBottom()
  } catch {
    offline.value = true
  } finally {
    sending.value = false
  }
}

// Emoji palette: clicking appends to the draft (never sends directly).
function insertEmoji(e) {
  draft.value += e
}

// Typing signal, throttled to at most one call per 2 seconds.
function onDraftInput() {
  if (!token.value) return
  const now = Date.now()
  if (now - lastTypingAt < 2000) return
  lastTypingAt = now
  chatTyping(token.value).catch(() => { /* typing is best-effort */ })
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    unread.value = 0
    if (token.value) { pull(); heartbeat() }
    else if (visitorName.value || nameInput.value) startChat()
    scrollToBottom()
  }
}

onMounted(() => {
  token.value = lsGet(LS_TOKEN)
  visitorName.value = lsGet(LS_NAME)
  nameInput.value = visitorName.value
  if (token.value) pull(true)
  timer = setInterval(() => { if (token.value) pull() }, 3000)
  // Heartbeat only while the chat panel is open (20s cadence).
  pingTimer = setInterval(() => { if (open.value) heartbeat() }, 20000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (pingTimer) clearInterval(pingTimer)
})
</script>

<template>
  <div class="chat-widget">
    <button v-if="!open" class="chat-fab" type="button" @click="toggle">
      💬 {{ t('chatOpen') }}
      <span v-if="unread" class="chat-badge">{{ unread }}</span>
    </button>

    <div v-else class="chat-panel">
      <div class="chat-head">
        <b>{{ t('chatTitle') }}</b>
        <button class="chat-close" type="button" aria-label="Close" @click="toggle">✕</button>
      </div>

      <!-- First visit: ask for a name (skippable), then start the session. -->
      <div v-if="!token" class="chat-start">
        <p>{{ t('chatNameLabel') }}</p>
        <input v-model="nameInput" :placeholder="t('chatNamePh')" @keyup.enter="startChat" />
        <button class="btn btn-primary btn-block" type="button" @click="startChat">{{ t('chatStart') }}</button>
        <button class="chat-skip" type="button" @click="nameInput = ''; startChat()">{{ t('chatSkip') }}</button>
        <p v-if="offline" class="chat-offline">{{ t('chatOffline') }}</p>
      </div>

      <template v-else>
        <div ref="listEl" class="chat-list">
          <div class="chat-msg agent">
            <span class="chat-who">{{ t('chatAgent') }}</span>
            <p>{{ t('chatWelcome') }}</p>
          </div>
          <div v-for="m in messages" :key="m.id" class="chat-msg" :class="m.sender">
            <span class="chat-who">{{ m.sender === 'agent' ? t('chatAgent') : t('chatYou') }}</span>
            <p :class="{ 'emoji-only': isEmojiOnlyMessage(m.body) }">{{ m.body }}</p>
          </div>
          <div v-if="agentTyping" class="chat-msg agent">
            <span class="chat-who">{{ t('chatAgent') }}</span>
            <p class="chat-typing">{{ t('chatTyping') }}</p>
          </div>
        </div>
        <p v-if="offline" class="chat-offline">{{ t('chatOffline') }}</p>
        <div v-if="emojiOpen" class="emoji-panel">
          <button v-for="e in EMOJIS" :key="e" type="button" class="emoji-cell" @click="insertEmoji(e)">{{ e }}</button>
        </div>
        <form class="chat-form" @submit.prevent="send">
          <button class="emoji-btn" type="button" aria-label="Emoji" @click="emojiOpen = !emojiOpen">😊</button>
          <input v-model="draft" :placeholder="t('chatInputPh')" @input="onDraftInput" />
          <button class="btn btn-primary" type="submit" :disabled="sending || !draft.trim()">{{ t('chatSend') }}</button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* The chat uses its own sans-serif stack on purpose: several storefront
   themes (e.g. F) set a serif body font, which makes chat text look dated.
   Nothing here touches the site theme. */
.chat-widget {
  position: fixed; right: 22px; bottom: 22px; z-index: 60; font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: #1f2430;
}
.chat-fab {
  position: relative; border: none; cursor: pointer; border-radius: 999px;
  padding: 13px 20px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  box-shadow: 0 10px 28px rgba(0, 0, 0, .28);
}
.chat-badge {
  position: absolute; top: -7px; right: -5px; min-width: 20px; height: 20px;
  border-radius: 999px; background: #e1251b; color: #fff; font-size: 12px;
  line-height: 20px; text-align: center; padding: 0 5px;
}
.chat-panel {
  width: min(350px, calc(100vw - 32px)); height: 480px; max-height: calc(100vh - 110px);
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--surface); color: inherit; border-radius: 16px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .35); border: 1px solid rgba(0, 0, 0, .08);
}
.chat-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px; color: #fff;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
}
.chat-head b { font-size: 15px; font-weight: 600; }
.chat-close { border: none; background: transparent; color: #fff; font-size: 15px; cursor: pointer; }
.chat-start { padding: 18px 16px; display: flex; flex-direction: column; gap: 10px; }
.chat-start p { margin: 0; opacity: .75; }
.chat-start input {
  border: 1px solid rgba(0, 0, 0, .18); border-radius: 10px; padding: 11px 12px; font: inherit; font-size: 15px;
  background: var(--surface); color: inherit;
}
.chat-skip { border: none; background: transparent; cursor: pointer; color: var(--brand); font: inherit; }
.chat-list { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.chat-msg { max-width: 82%; }
.chat-msg p {
  margin: 2px 0 0; padding: 10px 12px; border-radius: 14px;
  font-size: 14.5px; line-height: 1.6; color: #1f2430;
  white-space: pre-wrap; word-break: break-word; background: rgba(0, 0, 0, .06);
}
.chat-msg.visitor { align-self: flex-end; text-align: right; }
.chat-msg.visitor p { background: var(--brand); color: #fff; text-align: left; }
.chat-who { font-size: 11px; color: #8a8fa3; }
.chat-typing { font-style: italic; opacity: .75; }
.chat-offline { margin: 0; padding: 8px 14px; font-size: 12px; color: #b3261e; }
.chat-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(0, 0, 0, .08); }
.chat-form input {
  flex: 1; min-width: 0; border: 1px solid rgba(0, 0, 0, .18); border-radius: 999px;
  padding: 10px 14px; font: inherit; font-size: 15px; background: var(--surface); color: inherit;
}
.chat-form .btn { padding: 10px 18px; }
/* Emoji palette + sticker-style rendering for emoji-only messages. */
.emoji-btn {
  border: none; background: transparent; cursor: pointer; flex-shrink: 0;
  font-size: 21px; line-height: 1; padding: 0 2px;
}
.emoji-panel {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
  padding: 10px 12px; border-top: 1px solid rgba(0, 0, 0, .08);
  max-height: 176px; overflow-y: auto; background: var(--surface);
}
.emoji-cell {
  border: none; background: transparent; cursor: pointer; border-radius: 8px;
  font-size: 21px; padding: 5px 0; line-height: 1.2;
}
.emoji-cell:hover { background: rgba(0, 0, 0, .06); }
.chat-msg p.emoji-only {
  font-size: 32px; line-height: 1.3; background: transparent; padding: 2px 4px;
}
</style>
