<script setup>
import { computed } from 'vue'
import { t, tx } from '../i18n.js'
import { formatPrice } from '../utils/currency.js'
import { pricesOff } from '../utils/pricing.js'
const props = defineProps({ open: { type: Boolean, default: false }, items: { type: Array, default: () => [] } })
defineEmits(['close', 'remove', 'clear'])
const total = computed(() => props.items.reduce((s, i) => s + i.price * i.qty, 0))
// Global price switch off: items already in the drawer (added while
// prices were on) show the 面议 label instead of amounts and totals.
const hidePrices = computed(() => pricesOff())
</script>

<template>
  <div v-if="open" class="drawer-backdrop" @click="$emit('close')">
    <aside class="drawer" @click.stop>
      <header class="drawer-head">
        <h2>{{ t('cartTitle') }}</h2>
        <button class="icon-btn" @click="$emit('close')" aria-label="Close cart">×</button>
      </header>
      <p class="drawer-note">{{ t('cartNote') }}</p>
      <div v-if="!items.length" class="drawer-empty">{{ t('cartEmpty') }}</div>
      <ul v-else class="drawer-list">
        <li v-for="item in items" :key="item.id">
          <span class="drawer-thumb" :style="{ background: `linear-gradient(135deg, ${item.visual[0]}, ${item.visual[1]})` }">{{ item.visual[2] }}</span>
          <span class="drawer-info"><b>{{ tx(item.name) }}</b><small v-if="!hidePrices">{{ formatPrice(item.price) }} × {{ item.qty }} {{ tx(item.unit) }}</small><small v-else>{{ t('negotiable') }} × {{ item.qty }} {{ tx(item.unit) }}</small></span>
          <span v-if="!hidePrices" class="drawer-sum">{{ formatPrice(item.price * item.qty) }}</span>
          <button class="icon-btn" @click="$emit('remove', item.id)" aria-label="Remove">×</button>
        </li>
      </ul>
      <footer v-if="items.length" class="drawer-foot">
        <p v-if="!hidePrices">{{ t('total') }} <b>{{ formatPrice(total) }}</b></p>
        <p v-else>{{ t('negotiable') }}</p>
        <button class="btn btn-ghost btn-sm" @click="$emit('clear')">{{ t('clearCart') }}</button>
      </footer>
    </aside>
  </div>
</template>
