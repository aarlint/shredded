<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  ThumbsUp,
  MessageCircle,
  Trophy,
  Swords,
  Medal,
  Bell,
} from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'
import {
  timeAgo,
  getInitials,
  avatarStyle,
  avatarUrl,
} from '../composables/useHelpers'

const emit = defineEmits(['read'])
const { currentUser } = useAuth()

const notifications = ref([])
const filter = ref('')

const filtered = computed(() => {
  if (!filter.value) return notifications.value
  return notifications.value.filter((n) => n.type === filter.value)
})

const typeIcons = {
  reaction: ThumbsUp,
  mention: MessageCircle,
  achievement: Trophy,
  challenge: Swords,
  pr: Medal,
}

function typeIcon(type) {
  return typeIcons[type] || Bell
}

async function load() {
  const data = await api.get('/notifications?limit=50')
  notifications.value = data.notifications || []
}

async function markRead(n) {
  if (!n.read) {
    n.read = 1
    await api.post('/notifications/read/' + n.id)
    emit('read')
  }
}

async function markAllRead() {
  await api.post('/notifications/read-all')
  notifications.value.forEach((n) => {
    n.read = 1
  })
  emit('read')
}

onMounted(load)
</script>

<template>
  <div>
    <div class="card">
      <div
        class="card-header"
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <span>Notifications</span>
        <button
          v-if="notifications.length > 0"
          class="btn btn-ghost btn-sm"
          @click="markAllRead"
        >
          Mark all read
        </button>
      </div>
      <div class="notif-filter-row">
        <div class="tabs">
          <button
            class="tab"
            :class="{ active: filter === '' }"
            @click="filter = ''"
          >
            All
          </button>
          <button
            class="tab"
            :class="{ active: filter === 'reaction' }"
            @click="filter = 'reaction'"
          >
            Reactions
          </button>
          <button
            class="tab"
            :class="{ active: filter === 'mention' }"
            @click="filter = 'mention'"
          >
            Mentions
          </button>
          <button
            class="tab"
            :class="{ active: filter === 'achievement' }"
            @click="filter = 'achievement'"
          >
            Achievements
          </button>
          <button
            class="tab"
            :class="{ active: filter === 'challenge' }"
            @click="filter = 'challenge'"
          >
            Challenges
          </button>
        </div>
      </div>
      <div
        v-if="filtered.length === 0"
        class="text-center text-dim"
        style="padding: 2rem"
      >
        No notifications yet
      </div>
      <div
        v-for="n in filtered"
        :key="n.id"
        class="notif-item"
        :class="{ unread: !n.read }"
        @click="markRead(n)"
      >
        <div class="notif-icon">
          <component :is="typeIcon(n.type)" :size="20" />
        </div>
        <div class="notif-body">
          <div class="notif-title">{{ n.title }}</div>
          <div v-if="n.body" class="notif-text">{{ n.body }}</div>
          <div class="notif-time">{{ timeAgo(n.created_at) }}</div>
        </div>
        <div
          v-if="n.from_display_name"
          class="avatar"
          style="width: 24px; height: 24px; font-size: 0.5rem"
          :style="avatarStyle(n.from_avatar_color)"
        >
          <img
            v-if="n.from_avatar_url"
            :src="avatarUrl(n.from_avatar_url)"
          />
          <template v-else>{{
            getInitials(n.from_display_name)
          }}</template>
        </div>
      </div>
    </div>
  </div>
</template>
