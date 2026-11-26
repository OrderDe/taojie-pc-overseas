<script setup>
import { ref } from 'vue'

// One showcase film: a poster card that only turns into a player on
// tap, so a grid of 9:16 clips never preloads a single byte of video
// (the storefront is served over a 5 Mbps link). Once playing, the
// native controls take over; there is no autoplay anywhere.
defineProps({ video: { type: Object, required: true } })
const playing = ref(false)
</script>

<template>
  <figure class="video-card">
    <div class="video-frame">
      <video v-if="playing" :src="video.src" :poster="video.poster" controls autoplay playsinline preload="metadata"></video>
      <button v-else type="button" class="video-poster" :aria-label="`Play video: ${video.title}`" @click="playing = true">
        <img :src="video.poster" :alt="video.title" loading="lazy" />
        <span class="video-play" aria-hidden="true">▶</span>
      </button>
    </div>
    <figcaption class="video-title">{{ video.title }}</figcaption>
  </figure>
</template>
