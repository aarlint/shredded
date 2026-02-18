<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  pct: Number,
  total: Number,
  goal: Number,
})

const circumference = 2 * Math.PI * 68
const animatedOffset = ref(circumference)

const targetOffset = computed(
  () => circumference - (Math.min(props.pct, 100) / 100) * circumference
)

onMounted(() => {
  requestAnimationFrame(() => {
    animatedOffset.value = targetOffset.value
  })
})

watch(
  () => props.pct,
  () => {
    requestAnimationFrame(() => {
      animatedOffset.value = targetOffset.value
    })
  }
)
</script>

<template>
  <div
    class="circle-progress"
    :style="pct >= 85 ? 'filter: drop-shadow(0 0 8px rgba(62,201,122,0.2))' : ''"
  >
    <svg width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%">
          <stop offset="0%" stop-color="var(--blue)" />
          <stop offset="50%" stop-color="var(--gold)" />
          <stop offset="100%" stop-color="var(--red)" />
        </linearGradient>
        <linearGradient id="grad-complete" x1="0%" y1="0%" x2="100%">
          <stop offset="0%" stop-color="var(--green)" />
          <stop offset="100%" stop-color="#5edb90" />
        </linearGradient>
      </defs>
      <circle class="track" cx="80" cy="80" r="68" />
      <circle
        class="fill-ring"
        cx="80"
        cy="80"
        r="68"
        :stroke="pct >= 100 ? 'url(#grad-complete)' : 'url(#grad)'"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="animatedOffset"
      />
    </svg>
    <div class="center-text">
      <div class="stat-big">{{ total }}</div>
      <div class="stat-label">/ {{ goal }} LBS</div>
    </div>
  </div>
</template>
