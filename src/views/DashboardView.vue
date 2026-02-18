<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Dumbbell,
  Flame,
  Calendar,
  Crown,
  Trophy,
  Gem,
  Zap,
  Wrench,
  Mountain,
  Tag,
} from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { onWS, offWS } from '../composables/useWebSocket'
import { addToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import {
  getInitials,
  timeAgo,
  avatarStyle,
  avatarUrl,
} from '../composables/useHelpers'
import {
  computeXP,
  getTier,
  xpToNextTier,
  getWeeklyChallenge,
  TIER_THRESHOLDS,
} from '../composables/useTiers'

import CircleProgress from '../components/CircleProgress.vue'
import SparkLine from '../components/SparkLine.vue'
import ReactButtons from '../components/ReactButtons.vue'
import MediaThumb from '../components/MediaThumb.vue'
import EmojiReactions from '../components/EmojiReactions.vue'

const tierIcons = { Crown, Gem, Zap, Wrench, Mountain, Tag }

const { currentUser } = useAuth()
const router = useRouter()

const loading = ref(true)
const leaderboard = ref([])
const activity = ref([])
const stats = ref(null)
const sparklines = reactive({})
const showDOTS = ref(false)
const showDotsInfo = ref(false)

const me = computed(() =>
  leaderboard.value.find((u) => u.id === currentUser.value.id)
)
const myTotal = computed(() => (me.value ? me.value.total : 0))
const myGoal = computed(() => (me.value ? me.value.total_goal : 1000))
const myPct = computed(() =>
  Math.min(100, Math.round((myTotal.value / myGoal.value) * 100))
)

const myTier = computed(() =>
  stats.value ? getTier(stats.value.xp) : getTier(0)
)
const myXpProgress = computed(() =>
  stats.value ? xpToNextTier(stats.value.xp) : { pct: 0 }
)

const weeklyChallenge = computed(() => getWeeklyChallenge())
const challengeProgress = computed(() => {
  if (!stats.value || !weeklyChallenge.value)
    return { current: 0, target: 1, pct: 0 }
  const s = {
    weekLifts: stats.value.weekLifts || 0,
    weekSquats: stats.value.weekSquats || 0,
    weekBench: stats.value.weekBench || 0,
    weekDeadlifts: stats.value.weekDeadlifts || 0,
    weekPRs: stats.value.weekPRs || 0,
    weekDays: stats.value.weekDays || 0,
  }
  const result = weeklyChallenge.value.check(s)
  return {
    ...result,
    pct: Math.min(
      100,
      Math.round((result.current / result.target) * 100)
    ),
  }
})

function userTier(u) {
  return getTier(computeXP(u))
}

function getTierIcon(tier) {
  return tierIcons[tier.icon] || Tag
}

async function loadData() {
  const [lb, act, st] = await Promise.all([
    api.get('/leaderboard'),
    api.get('/activity?limit=15'),
    api.get('/stats'),
  ])
  leaderboard.value = lb
  activity.value = act
  stats.value = st
  loading.value = false
  lb.forEach((u) => {
    api
      .get('/lifts/sparkline/' + u.id)
      .then((data) => {
        sparklines[u.id] = data
      })
      .catch(() => {})
  })
}

async function onVote(liftId, voteType) {
  try {
    const result = await api.post(`/lifts/${liftId}/vote`, {
      vote_type: voteType,
    })
    const lift = activity.value.find((a) => a.id === liftId)
    if (lift && result) {
      lift.vote_count = result.vote_count
      lift.hype_count = result.hype_count
      lift.user_vote = result.user_vote
    }
  } catch (err) {
    addToast('', 'Error', err.message)
  }
}

function handleWS(event, data) {
  if (event === 'new_lift' || event === 'delete_lift') {
    loadData()
  }
  if (event === 'vote') {
    const lift = activity.value.find((a) => a.id === data.lift_id)
    if (lift) {
      lift.vote_count = data.vote_count
      lift.hype_count = data.hype_count
    }
  }
  if (event === 'reaction') {
    const lift = activity.value.find((a) => a.id === data.lift_id)
    if (lift) {
      lift.reactions = data.reactions
    }
  }
}

function goToUser(u) {
  if (u.id === currentUser.value.id) {
    router.push({ name: 'history' })
  } else {
    router.push({ name: 'user', params: { id: u.id } })
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
})
</script>

<template>
  <div v-if="loading" style="padding: 1.5rem">
    <div class="grid-2 mb-1">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>
    <div
      class="skeleton skeleton-card"
      style="height: 200px; margin-bottom: 1rem"
    ></div>
    <div class="skeleton skeleton-card" style="height: 160px"></div>
  </div>
  <div v-else>
    <div class="grid-2 mb-1" style="align-items: start">
      <div class="card text-center">
        <div class="card-header">Your Total</div>
        <CircleProgress
          :pct="myPct"
          :total="myTotal"
          :goal="myGoal"
        />
        <div style="margin-top: 0.75rem">
          <span v-if="myPct >= 100" class="club-badge"
            >&#9733; 1000LB CLUB MEMBER</span
          >
          <span v-else class="text-sm text-secondary"
            >{{ myGoal - myTotal }} lbs to go</span
          >
        </div>
      </div>
      <div class="card">
        <div class="card-header">Your PRs</div>
        <div class="grid-3" style="text-align: center">
          <div>
            <div class="stat-big" style="color: var(--blue)">
              {{ me ? me.squat : 0 }}
            </div>
            <div class="stat-label">Squat</div>
          </div>
          <div>
            <div class="stat-big" style="color: var(--red)">
              {{ me ? me.bench : 0 }}
            </div>
            <div class="stat-label">Bench</div>
          </div>
          <div>
            <div class="stat-big" style="color: var(--gold)">
              {{ me ? me.deadlift : 0 }}
            </div>
            <div class="stat-label">Deadlift</div>
          </div>
        </div>
        <div style="margin-top: 1.25rem">
          <router-link
            to="/log"
            class="btn btn-primary btn-block btn-lg"
            >Log a Lift</router-link
          >
        </div>
      </div>
    </div>

    <div v-if="stats" class="stats-grid mb-1">
      <div class="stat-card">
        <div class="stat-card-icon"><Dumbbell :size="24" /></div>
        <div class="stat-card-value">{{ stats.totalLifts }}</div>
        <div class="stat-card-label">Total Lifts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon"><Flame :size="24" /></div>
        <div class="stat-card-value">{{ stats.streak }}</div>
        <div class="stat-card-label">Day Streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon"><Calendar :size="24" /></div>
        <div class="stat-card-value">{{ stats.weekLifts }}</div>
        <div class="stat-card-label">This Week</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">
          <component :is="getTierIcon(myTier)" :size="24" />
        </div>
        <div class="stat-card-value" style="font-size: 1.1rem">
          {{ myTier.tier }}
        </div>
        <div class="stat-card-label">{{ stats.xp }} XP</div>
        <div class="xp-bar">
          <div
            class="xp-fill"
            :style="{ width: myXpProgress.pct + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="weeklyChallenge" class="challenge-card mb-1">
      <div class="challenge-title">Weekly Challenge</div>
      <div class="challenge-desc">{{ weeklyChallenge.desc }}</div>
      <div class="challenge-progress">
        <div class="challenge-progress-bar">
          <div
            class="challenge-progress-fill"
            :style="{ width: challengeProgress.pct + '%' }"
          ></div>
        </div>
        <div class="challenge-progress-text">
          {{ challengeProgress.current }} / {{ challengeProgress.target }}
        </div>
      </div>
    </div>

    <div class="card mb-1">
      <div
        class="card-header"
        style="display: flex; justify-content: space-between; align-items: center"
      >
        <span>Leaderboard</span>
        <label
          class="dots-toggle"
          v-if="leaderboard.some((u) => u.dots > 0)"
        >
          <input type="checkbox" v-model="showDOTS" />
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          DOTS
          <span
            class="dots-info-btn"
            @click.prevent.stop="showDotsInfo = true"
            title="What is DOTS?"
            >?</span
          >
        </label>

        <Teleport to="body">
          <div
            v-if="showDotsInfo"
            class="dots-modal-overlay"
            @click.self="showDotsInfo = false"
          >
            <div class="dots-modal">
              <button
                class="dots-modal-close"
                @click="showDotsInfo = false"
              >
                &times;
              </button>
              <h3>&#x2696;&#xFE0F; DOTS Score</h3>
              <p>
                DOTS is a relative strength formula that levels the playing
                field across different bodyweights. A heavier lifter needs a
                bigger total to match a lighter lifter's score.
              </p>
              <div class="dots-formula">
                DOTS = Total (kg) &times; 500 / coefficient(bodyweight)
              </div>
              <p>
                The coefficient is a 4th-degree polynomial fitted to
                competitive powerlifting data. This means a 150 lb lifter
                totaling 1000 lbs and a 220 lb lifter totaling 1300 lbs can
                be compared fairly.
              </p>
              <p
                style="
                  margin-bottom: 0.4rem;
                  color: var(--text-primary);
                  font-weight: 600;
                  font-size: 0.75rem;
                "
              >
                Rough benchmarks (male):
              </p>
              <div class="dots-tiers">
                <span class="tier-score">300+</span
                ><span class="tier-label">Beginner</span>
                <span class="tier-score">350+</span
                ><span class="tier-label">Intermediate</span>
                <span class="tier-score">400+</span
                ><span class="tier-label">Advanced</span>
                <span class="tier-score">450+</span
                ><span class="tier-label">Elite</span>
                <span class="tier-score">500+</span
                ><span class="tier-label">World Class</span>
              </div>
              <p style="font-size: 0.7rem; margin-top: 0.5rem">
                Log your bodyweight in the Profile tab to enable DOTS
                calculation.
              </p>
            </div>
          </div>
        </Teleport>
      </div>
      <div class="lb-header">
        <span>#</span><span>Lifter</span><span>Squat</span
        ><span>Bench</span><span>Dead</span
        ><span class="desktop-only">Progress</span
        ><span>{{ showDOTS ? 'DOTS' : 'Total' }}</span>
      </div>
      <div
        v-for="(u, i) in leaderboard"
        :key="u.id"
        class="lb-row"
        @click="goToUser(u)"
      >
        <div
          class="rank"
          :class="
            i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
          "
        >
          {{ i + 1 }}
        </div>
        <div class="user-info">
          <div class="avatar" :style="avatarStyle(u.avatar_color)">
            <img
              v-if="u.avatar_url"
              :src="avatarUrl(u.avatar_url)"
            />
            <template v-else>{{
              getInitials(u.display_name)
            }}</template>
          </div>
          <div>
            <div
              style="
                font-weight: 600;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
              "
            >
              {{ u.display_name
              }}<Crown
                v-if="i === 0"
                :size="16"
                style="color: var(--gold)"
              />
            </div>
            <span :class="['tier-badge', userTier(u).cls]">
              <component
                :is="getTierIcon(userTier(u))"
                :size="14"
                style="display: inline-flex; vertical-align: middle"
              />
              {{ userTier(u).tier }}</span
            >
            <span
              v-if="u.total >= u.total_goal"
              class="club-badge"
              style="margin-left: 0.25rem"
              >&#9733; MEMBER</span
            >
          </div>
        </div>
        <div class="lift-val" style="color: var(--blue)">
          {{ u.squat
          }}<br v-if="sparklines[u.id]" /><SparkLine
            v-if="
              sparklines[u.id] && sparklines[u.id].squat.length > 1
            "
            :data="sparklines[u.id].squat"
            color="#4e8cff"
          />
        </div>
        <div class="lift-val" style="color: var(--red)">
          {{ u.bench
          }}<br v-if="sparklines[u.id]" /><SparkLine
            v-if="
              sparklines[u.id] && sparklines[u.id].bench.length > 1
            "
            :data="sparklines[u.id].bench"
            color="#e54545"
          />
        </div>
        <div class="lift-val" style="color: var(--gold)">
          {{ u.deadlift
          }}<br v-if="sparklines[u.id]" /><SparkLine
            v-if="
              sparklines[u.id] &&
              sparklines[u.id].deadlift.length > 1
            "
            :data="sparklines[u.id].deadlift"
            color="#c8a44e"
          />
        </div>
        <div class="desktop-only">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ complete: u.total >= u.total_goal }"
              :style="{ width: u.progress + '%' }"
            ></div>
          </div>
          <div
            style="
              font-size: 0.65rem;
              color: var(--text-dim);
              margin-top: 0.2rem;
            "
          >
            {{ u.progress }}%
          </div>
        </div>
        <div class="total-col">
          <div class="total-num">
            {{ showDOTS ? u.dots || '\u2014' : u.total }}
          </div>
          <div class="stat-label">{{ showDOTS ? 'DOTS' : 'LBS' }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Recent Activity</div>
      <div
        v-if="activity.length === 0"
        class="text-center text-dim"
        style="padding: 2rem"
      >
        No lifts logged yet. Be the first!
      </div>
      <div
        v-for="a in activity"
        :key="a.id"
        class="activity-item"
      >
        <div
          class="avatar"
          style="width: 32px; height: 32px; font-size: 0.6rem"
          :style="avatarStyle(a.avatar_color)"
        >
          <img
            v-if="a.avatar_url"
            :src="avatarUrl(a.avatar_url)"
          />
          <template v-else>{{
            getInitials(a.display_name)
          }}</template>
        </div>
        <div class="activity-body">
          <div class="activity-header">
            <span class="activity-name">{{ a.display_name }}</span>
            <span class="lift-badge" :class="a.lift_type">{{
              a.lift_type
            }}</span>
            <span class="activity-badges">
              <span v-if="a.is_pr" class="pr-badge">PR</span>
              <span v-if="a.is_sus" class="sus-badge">SUS</span>
              <span v-if="a.vote_count >= 3" class="fng-badge"
                >FAKE AND GAY</span
              >
            </span>
            <span class="activity-time">{{
              timeAgo(a.created_at)
            }}</span>
          </div>
          <div class="activity-lift">
            <span class="activity-weight"
              >{{ a.weight }} lbs<template v-if="a.reps > 1">
                x{{ a.reps }}</template
              ></span
            >
            <span
              v-if="a.reps > 1 && a.e1rm"
              class="activity-e1rm"
              >e1RM: {{ a.e1rm }}</span
            >
          </div>
          <div v-if="a.notes" class="activity-notes">
            {{ a.notes }}
          </div>
          <div v-if="a.media_filename" style="margin-top: 0.35rem">
            <MediaThumb :filename="a.media_filename" :small="true" />
          </div>
          <div class="activity-footer">
            <ReactButtons
              :lift="a"
              :current-user="currentUser"
              @vote="onVote"
            />
            <EmojiReactions
              v-if="
                (a.reactions && Object.keys(a.reactions).length > 0) ||
                a.user_id !== currentUser.id
              "
              :lift="a"
              :current-user="currentUser"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
