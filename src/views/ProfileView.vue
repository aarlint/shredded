<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { X, CheckCircle, XCircle } from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { addToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import {
  today,
  formatDate,
  formatDateFull,
  getInitials,
  avatarStyle,
  avatarUrl,
} from '../composables/useHelpers'

const { currentUser, fetchUser } = useAuth()

const loading = ref(true)
const me = ref({})
const achievements = ref([])
const allDefs = ref([])
const bodyweight = ref([])
const displayName = ref('')
const goalTotal = ref(1000)
const goalSquat = ref(null)
const goalBench = ref(null)
const goalDeadlift = ref(null)
const bio = ref('')
const bwWeight = ref(null)
const bwDate = ref(today())
const bwChartCanvas = ref(null)
const prTimeline = ref([])
const achTimeline = ref([])
let bwChartInstance = null

const combinedTimeline = computed(() => {
  const items = []
  prTimeline.value.forEach((p) => {
    items.push({
      key: 'pr-' + p.id,
      isAchievement: false,
      lift_type: p.lift_type,
      weight: p.weight,
      reps: p.reps,
      e1rm: p.e1rm,
      dateStr: p.date,
      sortDate: p.date,
    })
  })
  achTimeline.value.forEach((a) => {
    items.push({
      key: 'ach-' + a.achievement_key,
      isAchievement: true,
      icon: a.icon,
      label: a.label,
      desc: a.desc,
      dateStr: a.unlocked_at.split('T')[0] || a.unlocked_at.split(' ')[0],
      sortDate: a.unlocked_at,
    })
  })
  items.sort((a, b) => b.sortDate.localeCompare(a.sortDate))
  return items.slice(0, 30)
})

const unlockedKeys = computed(
  () => new Set(achievements.value.map((a) => a.achievement_key))
)

async function loadData() {
  const [meData, achData, defData, bwData, timeline] = await Promise.all([
    api.get('/me'),
    api.get('/achievements'),
    api.get('/achievements/defs'),
    api.get('/bodyweight?limit=60'),
    api.get('/timeline'),
  ])
  prTimeline.value = timeline.prs || []
  achTimeline.value = timeline.achievements || []
  me.value = meData
  achievements.value = achData
  allDefs.value = defData
  bodyweight.value = bwData
  displayName.value = meData.display_name
  goalTotal.value = meData.total_goal
  goalSquat.value = meData.squat_goal || null
  goalBench.value = meData.bench_goal || null
  goalDeadlift.value = meData.deadlift_goal || null
  bio.value = meData.bio || ''
  loading.value = false
  currentUser.value = meData
  await nextTick()
  renderBwChart()
}

async function renderBwChart() {
  if (!bwChartCanvas.value || bodyweight.value.length === 0) return
  if (bwChartInstance) bwChartInstance.destroy()

  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  const bwSorted = [...bodyweight.value].reverse()
  bwChartInstance = new Chart(bwChartCanvas.value, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Body Weight',
          data: bwSorted.map((b) => ({ x: b.date, y: b.weight })),
          borderColor: '#3ec97a',
          backgroundColor: 'rgba(62,201,122,0.1)',
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: 'category',
          grid: { color: 'rgba(35,35,47,0.5)' },
          ticks: { color: '#4a4955', maxTicksLimit: 6 },
        },
        y: {
          grid: { color: 'rgba(35,35,47,0.5)' },
          ticks: { color: '#4a4955' },
        },
      },
    },
  })
}

async function saveBio() {
  const updated = await api.patch('/me', { bio: bio.value || '' })
  currentUser.value = updated
  addToast('', 'Bio updated')
}

async function saveName() {
  const name = displayName.value.trim()
  if (!name) return
  const updated = await api.patch('/me', { display_name: name })
  currentUser.value = updated
  addToast('', 'Name updated')
}

async function saveGoals() {
  const updated = await api.patch('/me', {
    total_goal: goalTotal.value || 1000,
    squat_goal: goalSquat.value || null,
    bench_goal: goalBench.value || null,
    deadlift_goal: goalDeadlift.value || null,
  })
  currentUser.value = updated
  addToast('', 'Goals updated')
}

async function logBodyweight() {
  if (!bwWeight.value || !bwDate.value) return
  await api.post('/bodyweight', {
    weight: bwWeight.value,
    date: bwDate.value,
  })
  addToast('', 'Body weight logged')
  bwWeight.value = null
  bodyweight.value = await api.get('/bodyweight?limit=60')
  await nextTick()
  renderBwChart()
}

async function deleteBodyweight(id) {
  if (!confirm('Delete this entry?')) return
  await api.del(`/bodyweight/${id}`)
  bodyweight.value = bodyweight.value.filter((b) => b.id !== id)
  await nextTick()
  renderBwChart()
}

async function uploadAvatar(e) {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('avatar', file)
  try {
    const updated = await api.upload('/me/avatar', formData)
    me.value = updated
    currentUser.value = updated
    addToast('', 'Photo updated')
  } catch (err) {
    addToast('', 'Upload failed', err.message)
  }
  e.target.value = ''
}

async function removeAvatar() {
  try {
    const updated = await api.del('/me/avatar')
    me.value = updated
    currentUser.value = updated
    addToast('', 'Photo removed')
  } catch (err) {
    addToast('', 'Error', err.message)
  }
}

onMounted(() => {
  loadData()
})
onUnmounted(() => {
  if (bwChartInstance) bwChartInstance.destroy()
})
</script>

<template>
  <div
    v-if="loading"
    class="text-center text-secondary"
    style="padding: 3rem"
  >
    Loading...
  </div>
  <div v-else>
    <div class="grid-2 mb-1" style="align-items: start">
      <div class="card profile-section">
        <div class="card-header">Profile</div>
        <div style="text-align: center; margin-bottom: 1rem">
          <div
            class="avatar-upload"
            :style="avatarStyle(me.avatar_color)"
          >
            <img
              v-if="me.avatar_url"
              :src="avatarUrl(me.avatar_url)"
            />
            <template v-else
              ><div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 100%;
                  height: 100%;
                  font-size: 1.75rem;
                  font-weight: 700;
                  color: #fff;
                "
              >
                {{ getInitials(me.display_name) }}
              </div></template
            >
            <div class="avatar-overlay">Change</div>
            <input type="file" accept="image/*" @change="uploadAvatar" />
          </div>
          <button
            v-if="me.avatar_url"
            class="btn btn-ghost btn-sm"
            @click="removeAvatar"
            style="font-size: 0.7rem"
          >
            Remove photo
          </button>
        </div>
        <div class="mb-1">
          <label>Display Name</label>
          <div class="inline-edit">
            <input v-model="displayName" style="flex: 1" />
            <button class="btn btn-secondary btn-sm" @click="saveName">
              Save
            </button>
          </div>
        </div>
        <div class="mb-1">
          <label>Email</label>
          <div class="text-secondary text-sm">{{ me.email }}</div>
        </div>
        <div class="mb-1">
          <label>Bio</label>
          <div class="bio-edit">
            <textarea
              v-model="bio"
              maxlength="160"
              placeholder="Tell us about yourself..."
            ></textarea>
          </div>
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 0.25rem;
            "
          >
            <span class="text-dim text-sm"
              >{{ (bio || '').length }}/160</span
            >
            <button class="btn btn-secondary btn-sm" @click="saveBio">
              Save Bio
            </button>
          </div>
        </div>
        <div class="mb-1">
          <label>Member Since</label>
          <div class="text-secondary text-sm">
            {{ formatDateFull(me.created_at.split('T')[0]) }}
          </div>
        </div>
      </div>

      <div class="card profile-section">
        <div class="card-header">Goals</div>
        <div class="grid-2 mb-1">
          <div>
            <label>Total Goal (lbs)</label>
            <input
              type="number"
              v-model.number="goalTotal"
              min="100"
              step="50"
            />
          </div>
          <div>
            <label>Squat Goal</label>
            <input
              type="number"
              v-model.number="goalSquat"
              placeholder="Optional"
              min="0"
              step="5"
            />
          </div>
          <div>
            <label>Bench Goal</label>
            <input
              type="number"
              v-model.number="goalBench"
              placeholder="Optional"
              min="0"
              step="5"
            />
          </div>
          <div>
            <label>Deadlift Goal</label>
            <input
              type="number"
              v-model.number="goalDeadlift"
              placeholder="Optional"
              min="0"
              step="5"
            />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" @click="saveGoals">
          Save Goals
        </button>
      </div>
    </div>

    <div class="card mb-1 profile-section">
      <div class="card-header">Body Weight</div>
      <div class="grid-2 mb-1" style="max-width: 400px">
        <div>
          <label>Weight (lbs)</label>
          <input
            type="number"
            v-model.number="bwWeight"
            placeholder="185"
            min="1"
            step="0.5"
          />
        </div>
        <div>
          <label>Date</label>
          <input type="date" v-model="bwDate" />
        </div>
      </div>
      <button class="btn btn-secondary btn-sm mb-1" @click="logBodyweight">
        Log Weight
      </button>
      <div
        v-if="bodyweight.length > 0"
        class="chart-wrap"
        style="height: 200px"
      >
        <canvas ref="bwChartCanvas"></canvas>
      </div>
      <div style="margin-top: 0.75rem">
        <div
          v-for="bw in bodyweight.slice(0, 10)"
          :key="bw.id"
          class="activity-item"
        >
          <span style="font-family: 'Space Grotesk'; font-weight: 600"
            >{{ bw.weight }} lbs</span
          >
          <span class="text-secondary text-sm" style="flex: 1">{{
            formatDate(bw.date)
          }}</span>
          <button
            class="btn btn-ghost btn-sm"
            @click="deleteBodyweight(bw.id)"
            title="Delete"
          >
            <X :size="16" />
          </button>
        </div>
      </div>
    </div>

    <div class="card profile-section">
      <div class="card-header">
        Achievements ({{ achievements.length }}/{{ allDefs.length }})
      </div>
      <div class="achievement-grid">
        <div
          v-for="def in allDefs"
          :key="def.key"
          class="achievement-card"
          :class="unlockedKeys.has(def.key) ? 'unlocked' : 'locked'"
        >
          <div class="achievement-icon">{{ def.icon }}</div>
          <div class="achievement-label">{{ def.label }}</div>
          <div class="achievement-desc">{{ def.desc }}</div>
        </div>
      </div>
    </div>

    <div
      class="card profile-section"
      v-if="prTimeline.length > 0 || achTimeline.length > 0"
    >
      <div class="card-header">PR Timeline</div>
      <div class="pr-timeline">
        <div
          v-for="item in combinedTimeline"
          :key="item.key"
          class="timeline-item"
        >
          <div
            class="timeline-dot"
            :class="{ achievement: item.isAchievement }"
          ></div>
          <div class="timeline-content">
            <template v-if="item.isAchievement">
              <div style="font-weight: 600; font-size: 0.85rem">
                {{ item.icon }} {{ item.label }}
              </div>
              <div class="text-sm text-dim">{{ item.desc }}</div>
            </template>
            <template v-else>
              <div
                style="
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  flex-wrap: wrap;
                "
              >
                <span class="lift-badge" :class="item.lift_type">{{
                  item.lift_type
                }}</span>
                <span
                  style="
                    font-family: 'Space Grotesk';
                    font-weight: 700;
                    font-size: 1.1rem;
                  "
                  >{{ item.weight }} lbs</span
                >
                <span
                  v-if="item.reps > 1"
                  style="font-size: 0.75rem; color: var(--text-dim)"
                  >x{{ item.reps }} (e1RM: {{ item.e1rm }})</span
                >
                <span class="pr-badge">PR</span>
              </div>
            </template>
            <div class="timeline-date" style="margin-top: 0.35rem">
              {{ formatDateFull(item.dateStr) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
