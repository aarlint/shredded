<script setup>
import { ref, onMounted, watch } from 'vue'
import { api } from '../composables/useApi'

const props = defineProps({
  userId: Number,
})

const cells = ref([])
const months = ref([])
const cols = ref(12)

async function load() {
  const data = await api.get('/lifts/heatmap/' + props.userId)
  const map = {}
  data.forEach((d) => {
    map[d.date] = d.count
  })

  const today = new Date()
  const grid = []
  const totalDays = 84
  const seenMonths = []

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = map[dateStr] || 0
    let cls = ''
    if (count >= 4) cls = 'lvl-4'
    else if (count >= 3) cls = 'lvl-3'
    else if (count >= 2) cls = 'lvl-2'
    else if (count >= 1) cls = 'lvl-1'
    grid.push({ date: dateStr, count, cls })

    const monthLabel = d.toLocaleDateString('en-US', { month: 'short' })
    if (d.getDate() <= 7 && !seenMonths.includes(monthLabel)) {
      seenMonths.push(monthLabel)
    }
  }
  cells.value = grid
  cols.value = Math.ceil(totalDays / 7)
  months.value = seenMonths.slice(0, cols.value)
}

onMounted(load)
watch(() => props.userId, load)
</script>

<template>
  <div v-if="cells.length">
    <div class="heatmap-months">
      <div v-for="m in months" :key="m" class="heatmap-month">{{ m }}</div>
    </div>
    <div
      class="heatmap-grid"
      :style="{ gridTemplateColumns: 'repeat(' + cols + ', 1fr)' }"
    >
      <div
        v-for="(c, i) in cells"
        :key="i"
        class="heatmap-cell"
        :class="c.cls"
        :title="c.date + ': ' + c.count + ' lifts'"
      ></div>
    </div>
  </div>
  <div v-else class="text-center text-dim" style="padding: 1rem">
    No data for heatmap yet
  </div>
</template>
