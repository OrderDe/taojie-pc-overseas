<script setup>
import { reactive, ref, watch } from 'vue'
import { t } from '../i18n.js'
import { submitRfq } from '../api.js'
const props = defineProps({ productName: { type: String, default: '' }, compact: { type: Boolean, default: false } })
const emit = defineEmits(['submitted'])
const form = reactive({ name: '', contact: '', product: '', qty: '', message: '' })
// Validation messages are stored as i18n KEYS and rendered through t(),
// so they always follow the site language. (The browser's native
// `required` bubbles follow the browser UI language instead — on a
// Chinese Chrome they stayed Chinese whatever language the visitor
// picked, which is the bug this replaces.)
const errors = reactive({ name: '', contact: '' })
const done = ref(false)
const sentToServer = ref(false)
const sending = ref(false)

watch(() => props.productName, (v) => { if (v) form.product = v }, { immediate: true })

async function submit() {
  errors.name = form.name.trim() ? '' : 'rfqNameRequired'
  errors.contact = form.contact.trim() ? '' : 'rfqContactRequired'
  if (errors.name || errors.contact) return
  sending.value = true
  // Primary path: the overseas backend stores the RFQ for the sales team.
  sentToServer.value = await submitRfq({ ...form })
  if (!sentToServer.value) {
    // Fallback only (backend unreachable): keep a local copy on this device.
    try {
      const prev = JSON.parse(localStorage.getItem('taojie-rfq') || '[]')
      prev.push({ ...form, at: new Date().toISOString() })
      localStorage.setItem('taojie-rfq', JSON.stringify(prev))
    } catch { /* storage unavailable */ }
  }
  sending.value = false
  done.value = true
  emit('submitted', { ...form })
}
function reset() {
  Object.assign(form, { name: '', contact: '', product: props.productName || '', qty: '', message: '' })
  errors.name = ''
  errors.contact = ''
  done.value = false
  sentToServer.value = false
}
</script>

<template>
  <div class="rfq" :class="{ compact }">
    <h3>{{ t('rfqTitle') }}</h3>
    <form v-if="!done" novalidate @submit.prevent="submit">
      <div class="rfq-field">
        <input v-model="form.name" required :placeholder="t('rfqName')" @input="errors.name = ''" />
        <p v-if="errors.name" class="rfq-error" role="alert">{{ t(errors.name) }}</p>
      </div>
      <div class="rfq-field">
        <input v-model="form.contact" required :placeholder="t('rfqContact')" @input="errors.contact = ''" />
        <p v-if="errors.contact" class="rfq-error" role="alert">{{ t(errors.contact) }}</p>
      </div>
      <input v-model="form.product" :placeholder="t('rfqProduct')" />
      <input v-model="form.qty" inputmode="numeric" :placeholder="t('rfqQty')" />
      <textarea v-if="!compact" v-model="form.message" rows="3" :placeholder="t('rfqMsg')"></textarea>
      <button class="btn btn-primary btn-block" type="submit" :disabled="sending">{{ t('sendRfq') }}</button>
    </form>
    <div v-else class="rfq-done">
      <p><b>{{ t('rfqDoneTitle') }}</b></p>
      <p>{{ sentToServer ? t('rfqDoneServer') : t('rfqDoneText') }}</p>
      <button class="btn btn-ghost btn-sm" @click="reset">{{ t('writeAnother') }}</button>
    </div>
  </div>
</template>
