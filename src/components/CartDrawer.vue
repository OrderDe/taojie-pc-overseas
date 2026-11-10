<script setup>
import { computed } from 'vue'
import { t, tx } from '../i18n.js'
const props = defineProps({ open: { type: Boolean, default: false }, items: { type: Array, default: () => [] } })
defineEmits(['close', 'remove', 'clear'])
const total = computed(() => props.items.reduce((s, i) => s + i.price * i.qty, 0))
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
          <span class="drawer-info"><b>{{ tx(item.name) }}</b><small>${{ item.price.toFixed(2) }} × {{ item.qty }} {{ tx(item.unit) }}</small></span>
          <span class="drawer-sum">${{ (item.price * item.qty).toFixed(2) }}</span>
          <button class="icon-btn" @click="$emit('remove', item.id)" aria-label="Remove">×</button>
        </li>
      </ul>
      <footer v-if="items.length" class="drawer-foot">
        <p>{{ t('total') }} <b>${{ total.toFixed(2) }}</b></p>
        <button class="btn btn-ghost btn-sm" @click="$emit('clear')">{{ t('clearCart') }}</button>
      </footer>
    </aside>
  </div>
</template>
