<script setup>
import { reactive, ref, watch } from 'vue'
import { t } from '../i18n.js'
import { submitRfq } from '../api.js'
const props = defineProps({ productName: { type: String, default: '' }, compact: { type: Boolean, default: false } })
const emit = defineEmits(['submitted'])
const form = reactive({ name: '', contact: '', product: '', qty: '', message: '' })
const done = ref(false)
const sentToServer = ref(false)
const sending = ref(false)

watch(() => props.productName, (v) => { if (v) form.product = v }, { immediate: true })

async function submit() {
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
  done.value = false
  sentToServer.value = false
}
</script>

<template>
  <div class="rfq" :class="{ compact }">
    <h3>{{ t('rfqTitle') }}</h3>
    <p class="rfq-sub">{{ t('rfqSub') }}</p>
    <form v-if="!done" @submit.prevent="submit">
      <input v-model="form.name" required :placeholder="t('rfqName')" />
      <input v-model="form.contact" required :placeholder="t('rfqContact')" />
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
