<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { X, Paperclip, CheckCircle, XCircle } from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { onWS, offWS } from '../composables/useWebSocket'
import { addToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import { formatDate, getInitials, avatarStyle, avatarUrl } from '../composables/useHelpers'
import ReactButtons from '../components/ReactButtons.vue'
import MediaThumb from '../components/MediaThumb.vue'
import EmojiReactions from '../components/EmojiReactions.vue'
import LiftHeatmap from '../components/LiftHeatmap.vue'

const props = defineProps({
  userId: Number,
})

const route = useRoute()
const router = useRouter()
const { currentUser } = useAuth()

const resolvedUserId = computed(() => {
  if (props.userId) return props.userId
  if (route.name === 'user') return Number(route.params.id)
  return currentUser.value?.id
})

const isOwn = computed(() => {
  return route.name !== 'user'
})

const loading = ref(true)
const prs = ref({ squat: 0, bench: 0, deadlift: 0 })
const lifts = ref([])
const userName = ref('')
const userBio = ref('')
const filterType = ref('')
const chartCanvas = ref(null)
let chartInstance = null

const tabs = [
  { label: 'All', value: '' },
  { label: 'Squat', value: 'squat' },
  { label: 'Bench', value: 'bench' },
  { label: 'Deadlift', value: 'deadlift' },
]

const filteredLifts = computed(() => {
  if (!filterType.value) return lifts.value
  return lifts.value.filter((l) => l.lift_type === filterType.value)
})

async function loadData() {
  const uid = resolvedUserId.value
  if (!uid) return
  const [prData, liftData, userData] = await Promise.all([
    api.get(`/lifts/prs/${uid}`),
    api.get(`/lifts?user_id=${uid}&limit=200`),
    isOwn.value
      ? Promise.resolve(currentUser.value)
      : api
          .get('/leaderboard')
          .then((lb) => lb.find((u) => u.id === uid)),
  ])
  prs.value = prData
  lifts.value = liftData
  userName.value = userData
    ? userData.display_name || userData.email
    : 'Unknown'
  userBio.value = userData ? userData.bio || '' : ''
  loading.value = false
  await nextTick()
  renderChart()
}

async function renderChart() {
  if (!chartCanvas.value || lifts.value.length === 0) return
  if (chartInstance) chartInstance.destroy()

  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  const sorted = [...lifts.value].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  const byType = { squat: [], bench: [], deadlift: [] }
  sorted.forEach((l) => {
    if (byType[l.lift_type])
      byType[l.lift_type].push({ x: l.date, y: l.weight })
  })

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Squat',
          data: byType.squat,
          borderColor: '#4e8cff',
          backgroundColor: 'rgba(78,140,255,0.1)',
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: 'Bench',
          data: byType.bench,
          borderColor: '#e54545',
          backgroundColor: 'rgba(229,69,69,0.1)',
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: 'Deadlift',
          data: byType.deadlift,
          borderColor: '#c8a44e',
          backgroundColor: 'rgba(200,164,78,0.1)',
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          labels: {
            color: '#8b8a95',
            font: { family: 'Inter', size: 12 },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          grid: { color: 'rgba(35,35,47,0.5)' },
          ticks: {
            color: '#4a4955',
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: 'rgba(35,35,47,0.5)' },
          ticks: { color: '#4a4955', font: { size: 11 } },
          beginAtZero: false,
        },
      },
    },
  })
}

async function onVote(liftId, voteType) {
  try {
    const result = await api.post(`/lifts/${liftId}/vote`, {
      vote_type: voteType,
    })
    const lift = lifts.value.find((l) => l.id === liftId)
    if (lift && result) {
      lift.vote_count = result.vote_count
      lift.hype_count = result.hype_count
      lift.user_vote = result.user_vote
    }
  } catch (err) {
    addToast('', 'Error', err.message)
  }
}

async function deleteLift(id) {
  if (!confirm('Delete this lift?')) return
  await api.del(`/lifts/${id}`)
  lifts.value = lifts.value.filter((l) => l.id !== id)
  prs.value = await api.get(`/lifts/prs/${resolvedUserId.value}`)
  await nextTick()
  renderChart()
}

async function addMedia(e, liftId) {
  const file = e.target.files[0]
  if (!file) return
  const fd = new FormData()
  fd.append('media', file)
  try {
    const result = await api.upload(`/lifts/${liftId}/media`, fd)
    const lift = lifts.value.find((l) => l.id === liftId)
    if (lift) lift.media_filename = result.media_filename
    addToast('', 'Media added')
  } catch (err) {
    addToast('', 'Upload failed', err.message)
  }
}

async function removeMedia(liftId) {
  if (!confirm('Remove media?')) return
  try {
    await api.del(`/lifts/${liftId}/media`)
    const lift = lifts.value.find((l) => l.id === liftId)
    if (lift) lift.media_filename = null
    addToast('', 'Media removed')
  } catch (err) {
    addToast('', 'Error', err.message)
  }
}

function handleWS(event, data) {
  if (event === 'new_lift' && data.user_id === resolvedUserId.value) {
    loadData()
  }
  if (event === 'delete_lift') {
    lifts.value = lifts.value.filter((l) => l.id !== data.lift_id)
  }
  if (event === 'vote') {
    const lift = lifts.value.find((l) => l.id === data.lift_id)
    if (lift) {
      lift.vote_count = data.vote_count
      lift.hype_count = data.hype_count
    }
  }
  if (event === 'reaction') {
    const lift = lifts.value.find((l) => l.id === data.lift_id)
    if (lift) {
      lift.reactions = data.reactions
    }
  }
}

let wsHandler
onMounted(() => {
  loadData()
  wsHandler = (event, data) => handleWS(event, data)
  onWS(wsHandler)
})

onUnmounted(() => {
  if (wsHandler) offWS(wsHandler)
  if (chartInstance) chartInstance.destroy()
})

watch(
  () => resolvedUserId.value,
  () => {
    loading.value = true
    loadData()
  }
)
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
    <div v-if="!isOwn" class="flex-between mb-1">
      <div>
        <h2 style="font-family: 'Space Grotesk'; font-size: 1.5rem">
          {{ userName }}
        </h2>
        <div
          v-if="userBio"
          class="bio-field"
          style="margin-top: 0.25rem"
        >
          {{ userBio }}
        </div>
      </div>
      <router-link to="/" class="btn btn-secondary btn-sm"
        >&larr; Back</router-link
      >
    </div>

    <div class="grid-3 mb-1">
      <div class="card text-center">
        <div class="stat-big" style="color: var(--blue)">
          {{ prs.squat || 0 }}
        </div>
        <div class="stat-label">Squat PR</div>
      </div>
      <div class="card text-center">
        <div class="stat-big" style="color: var(--red)">
          {{ prs.bench || 0 }}
        </div>
        <div class="stat-label">Bench PR</div>
      </div>
      <div class="card text-center">
        <div class="stat-big" style="color: var(--gold)">
          {{ prs.deadlift || 0 }}
        </div>
        <div class="stat-label">Deadlift PR</div>
      </div>
    </div>

    <div class="card mb-1">
      <div class="card-header">Training Frequency</div>
      <LiftHeatmap :user-id="resolvedUserId" />
    </div>

    <div class="card mb-1">
      <div class="card-header">Progression</div>
      <div class="chart-wrap"><canvas ref="chartCanvas"></canvas></div>
    </div>

    <div class="card">
      <div class="flex-between mb-05">
        <div class="card-header" style="margin-bottom: 0">Lift Log</div>
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.value"
            class="tab"
            :class="{ active: filterType === t.value }"
            @click="filterType = t.value"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
      <div
        v-if="filteredLifts.length === 0"
        class="text-center text-dim"
        style="padding: 2rem"
      >
        No lifts logged yet
      </div>
      <div
        v-for="l in filteredLifts"
        :key="l.id"
        class="lift-log-item"
      >
        <span class="text-secondary">{{ formatDate(l.date) }}</span>
        <span class="lift-badge" :class="l.lift_type">{{
          l.lift_type
        }}</span>
        <span>
          <span
            style="
              font-family: 'Space Grotesk';
              font-size: 1.1rem;
              font-weight: 600;
            "
            >{{ l.weight }} lbs<template v-if="l.reps > 1">
              x{{ l.reps }}</template
            ></span
          >
          <span
            v-if="l.reps > 1 && l.e1rm"
            style="font-size: 0.7rem; color: var(--text-dim)"
            >e1RM: {{ l.e1rm }}</span
          >
          <span v-if="l.is_pr" class="pr-badge">PR</span>
          <span v-if="l.is_sus" class="sus-badge">SUS</span>
          <span v-if="l.vote_count >= 3" class="fng-badge"
            >FAKE AND GAY</span
          >
          <span v-if="l.notes" class="text-sm text-dim">
            &mdash; {{ l.notes }}</span
          >
          <div
            v-if="l.media_filename"
            style="position: relative; display: inline-block"
          >
            <MediaThumb
              :filename="l.media_filename"
              :small="true"
              :can-remove="isOwn"
              :lift-id="l.id"
              @remove="removeMedia"
            />
          </div>
          <div v-else-if="isOwn" class="add-media-wrap">
            <label class="add-media-btn">
              <Paperclip
                :size="14"
                style="display: inline-flex; vertical-align: middle"
              />
              Add<input
                type="file"
                accept="image/*,video/*"
                @change="addMedia($event, l.id)"
                style="
                  position: absolute;
                  inset: 0;
                  opacity: 0;
                  cursor: pointer;
                  width: 100%;
                  height: 100%;
                "
              />
            </label>
          </div>
        </span>
        <span style="display: flex; align-items: center; gap: 0.25rem">
          <ReactButtons
            :lift="l"
            :current-user="currentUser"
            @vote="onVote"
          />
          <button
            v-if="isOwn"
            class="btn btn-ghost btn-sm"
            @click="deleteLift(l.id)"
            title="Delete"
          >
            <X :size="16" />
          </button>
        </span>
        <EmojiReactions
          v-if="
            (l.reactions && Object.keys(l.reactions).length > 0) || !isOwn
          "
          :lift="l"
          :current-user="currentUser"
          style="grid-column: 1/-1"
        />
      </div>
    </div>
  </div>
</template>
