<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  data: Array,
  color: String,
})

const cvs = ref(null)

function draw() {
  const c = cvs.value
  if (!c || !props.data || props.data.length < 2) return
  const ctx = c.getContext('2d')
  const w = c.width
  const h = c.height
  ctx.clearRect(0, 0, w, h)
  const vals = props.data
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const step = w / (vals.length - 1)
  ctx.beginPath()
  ctx.strokeStyle = props.color || '#c8a44e'
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  vals.forEach((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * (h - 4) - 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.lineTo((vals.length - 1) * step, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = (props.color || '#c8a44e') + '15'
  ctx.fill()
}

onMounted(() => nextTick(draw))
watch(() => props.data, () => nextTick(draw))
</script>

<template>
  <canvas ref="cvs" class="sparkline-wrap" width="60" height="24"></canvas>
</template>
