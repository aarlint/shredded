<script setup>
import { ref, computed } from 'vue'
import { api } from '../composables/useApi'
import { addToast } from '../composables/useToast'
import { today, confetti } from '../composables/useHelpers'

const activityType = ref('run')
const distance = ref(3.1)
const hours = ref(0)
const minutes = ref(25)
const seconds = ref(0)
const date = ref(today())
const notes = ref('')
const submitting = ref(false)

const activityTypes = [
  { value: 'run', label: 'Run' },
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half_marathon', label: 'Half Marathon' },
  { value: 'marathon', label: 'Marathon' },
]

const presetDistances = {
  run: null,
  '5k': 3.11,
  '10k': 6.21,
  half_marathon: 13.11,
  marathon: 26.22,
}

const durationSeconds = computed(() => {
  return (hours.value * 3600) + (minutes.value * 60) + seconds.value
})

const pace = computed(() => {
  if (!distance.value || !durationSeconds.value) return null
  const paceSecsPerMile = durationSeconds.value / distance.value
  const m = Math.floor(paceSecsPerMile / 60)
  const s = Math.floor(paceSecsPerMile % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
})

const formattedDuration = computed(() => {
  const h = hours.value
  const m = minutes.value
  const s = seconds.value
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
})

function onActivityChange() {
  const preset = presetDistances[activityType.value]
  if (preset) distance.value = preset
}

async function submitRun() {
  if (!durationSeconds.value || !distance.value) return
  submitting.value = true
  try {
    const result = await api.post('/runs', {
      activity_type: activityType.value,
      distance_miles: parseFloat(distance.value),
      duration_seconds: durationSeconds.value,
      date: date.value,
      notes: notes.value || '',
    })

    const typeLabel = activityTypes.find(t => t.value === activityType.value)?.label || 'Run'
    addToast('🏃', 'Run logged!', `${typeLabel} — ${distance.value} mi @ ${pace.value}/mi`)

    if (result.newAchievements && result.newAchievements.length > 0) {
      confetti()
      setTimeout(() => {
        result.newAchievements.forEach(a => {
          addToast(a.icon, 'Achievement Unlocked!', `${a.label}: ${a.desc}`, 'achievement')
        })
      }, 500)
    }

    notes.value = ''
  } catch (e) {
    addToast('', 'Error', e.message)
  }
  submitting.value = false
}
</script>

<template>
  <div class="card" style="max-width: 500px; margin: 0 auto">
    <div class="card-header text-center">Log a Run</div>

    <div class="mb-1">
      <label>Activity Type</label>
      <select v-model="activityType" @change="onActivityChange" class="run-select">
        <option v-for="t in activityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
    </div>

    <div class="mb-1">
      <label>Distance (miles)</label>
      <input type="number" v-model.number="distance" min="0.1" max="100" step="0.01" />
    </div>

    <div class="mb-1">
      <label>Duration</label>
      <div class="duration-input">
        <div class="duration-field">
          <input type="number" v-model.number="hours" min="0" max="23" />
          <span class="duration-label">hr</span>
        </div>
        <span class="duration-sep">:</span>
        <div class="duration-field">
          <input type="number" v-model.number="minutes" min="0" max="59" />
          <span class="duration-label">min</span>
        </div>
        <span class="duration-sep">:</span>
        <div class="duration-field">
          <input type="number" v-model.number="seconds" min="0" max="59" />
          <span class="duration-label">sec</span>
        </div>
      </div>
    </div>

    <div v-if="pace" class="pace-display mb-1">
      <div class="pace-value">{{ pace }} <span class="pace-unit">/mi</span></div>
      <div class="pace-label">Pace</div>
    </div>

    <div class="grid-2 mb-1">
      <div>
        <label>Date</label>
        <input type="date" v-model="date" />
      </div>
      <div>
        <label>Notes (optional)</label>
        <input type="text" v-model="notes" placeholder="e.g. easy pace" />
      </div>
    </div>

    <button
      class="btn btn-primary btn-block btn-lg mt-1"
      :disabled="!distance || !durationSeconds || submitting"
      @click="submitRun"
    >
      {{ submitting ? 'LOGGING...' : 'LOG RUN' }}
    </button>
  </div>
</template>

<style scoped>
.run-select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 0.95rem;
}
.duration-input {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.duration-field {
  flex: 1;
  text-align: center;
}
.duration-field input {
  text-align: center;
  width: 100%;
}
.duration-label {
  display: block;
  font-size: 0.65rem;
  color: var(--text-dim);
  margin-top: 0.15rem;
}
.duration-sep {
  font-size: 1.2rem;
  color: var(--text-dim);
  padding-bottom: 1rem;
}
.pace-display {
  text-align: center;
  padding: 0.75rem;
  background: rgba(78, 200, 120, 0.08);
  border-radius: var(--radius);
  border: 1px solid rgba(78, 200, 120, 0.2);
}
.pace-value {
  font-family: 'Space Grotesk', monospace;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--green);
}
.pace-unit {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--text-dim);
}
.pace-label {
  font-size: 0.7rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
