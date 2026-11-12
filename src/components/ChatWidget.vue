<script setup>
// Floating online-chat widget (bottom-right). The visitor is identified by
// a random session token stored in localStorage — no account needed.
// Messages are polled incrementally every 3 seconds (afterId). When the
// backend is unreachable the widget shows a friendly offline note instead
// of failing (same defensive pattern as the catalogue API).
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { chatStart, chatSend, chatPull } from '../api.js'
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
const listEl = ref(null)
let lastId = 0
let timer = null

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
    const r = await chatStart({ name, token: token.value })
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

function toggle() {
  open.value = !open.value
  if (open.value) {
    unread.value = 0
    if (token.value) pull()
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
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
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
            <p>{{ m.body }}</p>
          </div>
        </div>
        <p v-if="offline" class="chat-offline">{{ t('chatOffline') }}</p>
        <form class="chat-form" @submit.prevent="send">
          <input v-model="draft" :placeholder="t('chatInputPh')" />
          <button class="btn btn-primary" type="submit" :disabled="sending || !draft.trim()">{{ t('chatSend') }}</button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.chat-widget { position: fixed; right: 22px; bottom: 22px; z-index: 60; font-size: 14px; }
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
.chat-close { border: none; background: transparent; color: #fff; font-size: 15px; cursor: pointer; }
.chat-start { padding: 18px 16px; display: flex; flex-direction: column; gap: 10px; }
.chat-start p { margin: 0; opacity: .75; }
.chat-start input {
  border: 1px solid rgba(0, 0, 0, .18); border-radius: 10px; padding: 11px 12px; font: inherit;
  background: var(--surface); color: inherit;
}
.chat-skip { border: none; background: transparent; cursor: pointer; color: var(--brand); font: inherit; }
.chat-list { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.chat-msg { max-width: 82%; }
.chat-msg p {
  margin: 2px 0 0; padding: 9px 12px; border-radius: 14px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; background: rgba(0, 0, 0, .06);
}
.chat-msg.visitor { align-self: flex-end; text-align: right; }
.chat-msg.visitor p { background: var(--brand); color: #fff; text-align: left; }
.chat-who { font-size: 11px; opacity: .55; }
.chat-offline { margin: 0; padding: 8px 14px; font-size: 12px; color: #b3261e; }
.chat-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(0, 0, 0, .08); }
.chat-form input {
  flex: 1; min-width: 0; border: 1px solid rgba(0, 0, 0, .18); border-radius: 999px;
  padding: 10px 14px; font: inherit; background: var(--surface); color: inherit;
}
.chat-form .btn { padding: 10px 18px; }
</style>
