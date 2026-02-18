<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Trophy, CheckCircle, XCircle, Swords } from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { addToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import {
  formatDate,
  getInitials,
  avatarStyle,
  avatarUrl,
} from '../composables/useHelpers'

const { currentUser } = useAuth()

const challenges = ref([])
const users = ref([])
const tab = ref('active')
const showCreate = ref(false)
const newChallenge = reactive({
  opponent_id: null,
  type: 'most_weight',
  metric: 'any',
  duration: 7,
})

const filteredChallenges = computed(() => {
  return challenges.value.filter((c) => c.status === tab.value)
})

function typeLabel(type) {
  switch (type) {
    case 'most_weight':
      return 'Most Weight'
    case 'most_lifts':
      return 'Most Lifts'
    case 'highest_single':
      return 'Highest Single'
    default:
      return type
  }
}

function scoreValue(c, userId) {
  if (!c.scores || !c.scores[userId]) return 0
  const s = c.scores[userId]
  if (c.type === 'most_weight') return s.total_weight + ' lbs'
  if (c.type === 'most_lifts') return s.lift_count + ' lifts'
  if (c.type === 'highest_single') return s.max_weight + ' lbs'
  return 0
}

function scorePercent(c, userId) {
  if (!c.scores) return 50
  const s1 = c.scores[c.challenger_id] || {}
  const s2 = c.scores[c.opponent_id] || {}
  let v1, v2
  if (c.type === 'most_weight') {
    v1 = s1.total_weight || 0
    v2 = s2.total_weight || 0
  } else if (c.type === 'most_lifts') {
    v1 = s1.lift_count || 0
    v2 = s2.lift_count || 0
  } else {
    v1 = s1.max_weight || 0
    v2 = s2.max_weight || 0
  }
  const total = v1 + v2
  if (total === 0) return 50
  return userId === c.challenger_id
    ? Math.round((v1 / total) * 100)
    : Math.round((v2 / total) * 100)
}

async function load() {
  const [chData, uData] = await Promise.all([
    api.get('/challenges'),
    api.get('/users'),
  ])
  challenges.value = chData
  users.value = uData
}

async function createChallenge() {
  try {
    await api.post('/challenges', {
      opponent_id: newChallenge.opponent_id,
      type: newChallenge.type,
      metric: newChallenge.metric,
      duration_days: newChallenge.duration,
    })
    addToast('', 'Challenge sent!')
    showCreate.value = false
    newChallenge.opponent_id = null
    load()
  } catch (e) {
    addToast('', 'Error', e.message)
  }
}

async function respond(id, accept) {
  try {
    await api.post('/challenges/' + id + '/respond', { accept })
    addToast('', accept ? 'Challenge accepted!' : 'Challenge declined')
    load()
  } catch (e) {
    addToast('', 'Error', e.message)
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="card mb-1">
      <div
        class="card-header"
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <span>Head-to-Head Challenges</span>
        <button
          class="btn btn-primary btn-sm"
          @click="showCreate = !showCreate"
        >
          {{ showCreate ? 'Cancel' : '+ New Challenge' }}
        </button>
      </div>

      <div
        v-if="showCreate"
        class="challenge-create-form"
        style="
          margin-bottom: 1.25rem;
          padding: 1rem;
          background: rgba(22, 22, 29, 0.5);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        "
      >
        <div>
          <label>Opponent</label>
          <select v-model="newChallenge.opponent_id">
            <option :value="null" disabled>Select a lifter</option>
            <option
              v-for="u in users.filter(
                (u) => u.id !== currentUser.id
              )"
              :key="u.id"
              :value="u.id"
            >
              {{ u.display_name }}
            </option>
          </select>
        </div>
        <div class="grid-2">
          <div>
            <label>Challenge Type</label>
            <select v-model="newChallenge.type">
              <option value="most_weight">Most Total Weight</option>
              <option value="most_lifts">Most Lifts Logged</option>
              <option value="highest_single">
                Highest Single Lift
              </option>
            </select>
          </div>
          <div>
            <label>Lift Type</label>
            <select v-model="newChallenge.metric">
              <option value="any">Any Lift</option>
              <option value="squat">Squat Only</option>
              <option value="bench">Bench Only</option>
              <option value="deadlift">Deadlift Only</option>
            </select>
          </div>
        </div>
        <div>
          <label>Duration (days)</label>
          <input
            type="number"
            v-model.number="newChallenge.duration"
            min="1"
            max="30"
            placeholder="7"
          />
        </div>
        <button
          class="btn btn-primary btn-block"
          @click="createChallenge"
          :disabled="!newChallenge.opponent_id"
        >
          Send Challenge
        </button>
      </div>

      <div class="tabs mb-05">
        <button
          class="tab"
          :class="{ active: tab === 'active' }"
          @click="tab = 'active'"
        >
          Active
        </button>
        <button
          class="tab"
          :class="{ active: tab === 'pending' }"
          @click="tab = 'pending'"
        >
          Pending
        </button>
        <button
          class="tab"
          :class="{ active: tab === 'completed' }"
          @click="tab = 'completed'"
        >
          Completed
        </button>
      </div>

      <div
        v-if="filteredChallenges.length === 0"
        class="text-center text-dim"
        style="padding: 2rem"
      >
        No {{ tab }} challenges
      </div>

      <div
        v-for="c in filteredChallenges"
        :key="c.id"
        class="challenge-item"
        :class="c.status"
      >
        <div class="challenge-vs">
          <div
            class="avatar"
            style="width: 28px; height: 28px; font-size: 0.6rem"
            :style="avatarStyle(c.challenger_avatar_color)"
          >
            <img
              v-if="c.challenger_avatar_url"
              :src="avatarUrl(c.challenger_avatar_url)"
            />
            <template v-else>{{
              getInitials(c.challenger_name)
            }}</template>
          </div>
          <div>
            <span style="font-weight: 600; font-size: 0.85rem">{{
              c.challenger_name
            }}</span>
            <span
              v-if="c.winner_id === c.challenger_id"
              class="challenge-winner-badge"
            >
              <Trophy
                :size="14"
                style="display: inline-flex; vertical-align: middle"
              />
              Winner</span
            >
          </div>
          <span class="challenge-vs-text">VS</span>
          <div
            class="avatar"
            style="width: 28px; height: 28px; font-size: 0.6rem"
            :style="avatarStyle(c.opponent_avatar_color)"
          >
            <img
              v-if="c.opponent_avatar_url"
              :src="avatarUrl(c.opponent_avatar_url)"
            />
            <template v-else>{{
              getInitials(c.opponent_name)
            }}</template>
          </div>
          <div>
            <span style="font-weight: 600; font-size: 0.85rem">{{
              c.opponent_name
            }}</span>
            <span
              v-if="c.winner_id === c.opponent_id"
              class="challenge-winner-badge"
            >
              <Trophy
                :size="14"
                style="display: inline-flex; vertical-align: middle"
              />
              Winner</span
            >
          </div>
        </div>

        <div
          style="
            display: flex;
            gap: 0.5rem;
            align-items: center;
            margin-bottom: 0.5rem;
          "
        >
          <span class="challenge-type-badge">{{
            typeLabel(c.type)
          }}</span>
          <span
            v-if="c.metric && c.metric !== 'any'"
            class="lift-badge"
            :class="c.metric"
            >{{ c.metric }}</span
          >
          <span
            class="text-sm text-dim"
            style="margin-left: auto"
            >{{ formatDate(c.start_date) }} &mdash;
            {{ formatDate(c.end_date) }}</span
          >
        </div>

        <div
          v-if="c.scores && c.status === 'active'"
          style="margin-bottom: 0.5rem"
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              font-size: 0.75rem;
              margin-bottom: 0.25rem;
            "
          >
            <span style="font-weight: 600">{{
              scoreValue(c, c.challenger_id)
            }}</span>
            <span style="font-weight: 600">{{
              scoreValue(c, c.opponent_id)
            }}</span>
          </div>
          <div class="challenge-score-bar">
            <div
              class="challenge-score-fill"
              :style="{
                width: scorePercent(c, c.challenger_id) + '%',
                background: 'var(--blue)',
              }"
            ></div>
            <div
              class="challenge-score-fill"
              :style="{
                width: scorePercent(c, c.opponent_id) + '%',
                background: 'var(--red)',
              }"
            ></div>
          </div>
        </div>

        <div
          v-if="
            c.status === 'pending' &&
            c.opponent_id === currentUser.id
          "
          style="display: flex; gap: 0.5rem; margin-top: 0.5rem"
        >
          <button
            class="btn btn-primary btn-sm"
            @click="respond(c.id, true)"
          >
            Accept
          </button>
          <button
            class="btn btn-danger btn-sm"
            @click="respond(c.id, false)"
          >
            Decline
          </button>
        </div>
        <div
          v-if="
            c.status === 'pending' &&
            c.challenger_id === currentUser.id
          "
          class="text-sm text-dim"
          style="margin-top: 0.25rem"
        >
          Waiting for {{ c.opponent_name }} to accept...
        </div>
      </div>
    </div>
  </div>
</template>
