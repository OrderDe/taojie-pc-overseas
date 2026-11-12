<script setup>
import { computed } from 'vue'
import { t, tx } from '../i18n.js'
const props = defineProps({ product: { type: Object, required: true }, theme: { type: String, default: 'h' } })
defineEmits(['open', 'add', 'quote'])
// Real data often has an empty unit or the literal '无' — show just the price then.
const unitLabel = computed(() => {
  const u = String(props.product.unit ?? '').trim()
  return u && u !== '无' ? u : ''
})
</script>

<template>
  <article class="card" @click="$emit('open', product)">
    <div class="card-media" :style="{ background: `linear-gradient(135deg, ${product.visual[0]}, ${product.visual[1]})` }">
      <img v-if="product.image" :src="product.image" :alt="product.name" loading="lazy" @error="$event.target.remove()" />
      <span v-else class="card-glyph">{{ product.visual[2] }}</span>
      <span v-if="product.tag" class="card-tag">{{ tx(product.tag) }}</span>
      <span v-if="product.video" class="card-video-badge" aria-hidden="true">▶</span>
      <span class="card-spectrum"></span>
    </div>
    <div class="card-body">
      <p class="card-cat">{{ tx(product.category) }}</p>
      <h3 class="card-name">{{ tx(product.name) }}</h3>

      <!-- Theme D: spec rows on the card -->
      <ul v-if="theme === 'd' && product.specs && Object.keys(product.specs).length" class="card-specs">
        <li v-for="(v, k) in Object.entries(product.specs).slice(0, 2)" :key="k"><span>{{ tx(k) }}</span><b>{{ tx(v) }}</b></li>
      </ul>

      <!-- Theme G: tiered pricing -->
      <div v-if="theme === 'g' && product.moq" class="card-tiers">
        <span>{{ product.moq }}+ · ${{ product.price.toFixed(2) }}</span>
        <span>{{ product.moq * 5 }}+ · ${{ (product.price * 0.92).toFixed(2) }}</span>
        <span>{{ product.moq * 20 }}+ · ${{ (product.price * 0.85).toFixed(2) }}</span>
      </div>

      <p class="card-price">
        <b>${{ product.price.toFixed(2) }}</b>
        <s v-if="product.otPrice > product.price">${{ product.otPrice.toFixed(2) }}</s>
        <small v-if="unitLabel">/ {{ tx(unitLabel) }}</small>
      </p>
      <p class="card-meta">
        <span v-if="product.sales">{{ t('sold', { n: product.sales }) }}</span>
        <span v-if="product.moq">{{ t('moqLabel', { n: product.moq }) }}</span>
      </p>
      <div class="card-actions" @click.stop>
        <button class="btn btn-primary btn-sm" @click="$emit('add', product)">{{ t('addToCart') }}</button>
        <button class="btn btn-ghost btn-sm" @click="$emit('quote', product)">{{ t('requestQuote') }}</button>
      </div>
    </div>
  </article>
</template>
