<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { onWS, offWS } from '../composables/useWebSocket'
import { addToast } from '../composables/useToast'
import { formatDate } from '../composables/useHelpers'

const loading = ref(true)
const runs = ref([])
const stats = ref(null)

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(secs, miles) {
  if (!miles || !secs) return '—'
  const paceSecsPerMile = secs / miles
  const m = Math.floor(paceSecsPerMile / 60)
  const s = Math.floor(paceSecsPerMile % 60)
  return `${m}:${s.toString().padStart(2, '0')}/mi`
}

function formatBestPace(secsPerMile) {
  if (!secsPerMile) return '—'
  const m = Math.floor(secsPerMile / 60)
  const s = Math.floor(secsPerMile % 60)
  return `${m}:${s.toString().padStart(2, '0')}/mi`
}

const activityLabels = {
  run: 'Run',
  '5k': '5K',
  '10k': '10K',
  half_marathon: 'Half',
  marathon: 'Marathon',
}

async function loadData() {
  const [runData, statsData] = await Promise.all([
    api.get('/runs?limit=200'),
    api.get('/runs/stats'),
  ])
  runs.value = runData
  stats.value = statsData
  loading.value = false
}

async function deleteRun(id) {
  if (!confirm('Delete this run?')) return
  await api.del(`/runs/${id}`)
  runs.value = runs.value.filter(r => r.id !== id)
  stats.value = await api.get('/runs/stats')
  addToast('', 'Run deleted')
}

function handleWS(event) {
  if (event === 'new_run' || event === 'delete_run') loadData()
}

let wsHandler
onMounted(() => {
  loadData()
  wsHandler = (event) => handleWS(event)
  onWS(wsHandler)
})
onUnmounted(() => { if (wsHandler) offWS(wsHandler) })
</script>

<template>
  <div v-if="loading" class="text-center text-secondary" style="padding: 3rem">Loading...</div>
  <div v-else>
    <div v-if="stats" class="stats-grid mb-1">
      <div class="stat-card">
        <div class="stat-card-icon">🏃</div>
        <div class="stat-card-value">{{ stats.total_runs }}</div>
        <div class="stat-card-label">Total Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">🛣️</div>
        <div class="stat-card-value">{{ Math.round(stats.total_miles * 10) / 10 }}</div>
        <div class="stat-card-label">Total Miles</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">⚡</div>
        <div class="stat-card-value" style="font-size: 1.1rem">{{ formatBestPace(stats.best_pace_seconds_per_mile) }}</div>
        <div class="stat-card-label">Best Pace</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">📅</div>
        <div class="stat-card-value">{{ Math.round(stats.weekly_miles * 10) / 10 }}</div>
        <div class="stat-card-label">Miles This Week</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Run Log</div>
      <div v-if="runs.length === 0" class="text-center text-dim" style="padding: 2rem">
        No runs logged yet. Lace up those shoes!
      </div>
      <div v-for="r in runs" :key="r.id" class="run-log-item">
        <span class="text-secondary">{{ formatDate(r.date) }}</span>
        <span class="run-badge">{{ activityLabels[r.activity_type] || r.activity_type }}</span>
        <span>
          <span style="font-family: 'Space Grotesk'; font-size: 1.1rem; font-weight: 600">
            {{ Math.round(r.distance_miles * 100) / 100 }} mi
          </span>
          <span class="text-sm text-dim" style="margin-left: 0.5rem">
            {{ formatDuration(r.duration_seconds) }}
          </span>
          <span class="run-pace">
            {{ formatPace(r.duration_seconds, r.distance_miles) }}
          </span>
          <span v-if="r.notes" class="text-sm text-dim"> — {{ r.notes }}</span>
        </span>
        <button class="btn btn-ghost btn-sm" @click="deleteRun(r.id)" title="Delete">
          <X :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-log-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.run-log-item:last-child { border-bottom: none; }
.run-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(78, 200, 120, 0.15);
  color: var(--green);
}
.run-pace {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius);
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(78, 200, 120, 0.1);
  color: var(--green);
}
</style>
