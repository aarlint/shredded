<script setup>
import {
  House,
  Plus,
  MessageCircle,
  BarChart3,
  Bell,
  User,
} from 'lucide-vue-next'
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  unreadCount: { type: Number, default: 0 },
})

const router = useRouter()
const route = useRoute()

function isActive(name) {
  return route.name === name
}

function navigate(name) {
  router.push({ name })
}
</script>

<template>
  <nav class="bottom-nav">
    <div class="bottom-nav-inner">
      <a
        @click.prevent="navigate('dashboard')"
        href="#/"
        class="bottom-nav-item"
        :class="{ active: isActive('dashboard') }"
      >
        <span class="nav-icon"><House :size="20" /></span>Home
      </a>
      <a
        @click.prevent="navigate('log')"
        href="#/log"
        class="bottom-nav-item"
        :class="{ active: isActive('log') }"
      >
        <span class="nav-icon"><Plus :size="20" /></span>Log
      </a>
      <a
        @click.prevent="navigate('chat')"
        href="#/chat"
        class="bottom-nav-item"
        :class="{ active: isActive('chat') }"
      >
        <span class="nav-icon"><MessageCircle :size="20" /></span>Chat
      </a>
      <a
        @click.prevent="navigate('history')"
        href="#/history"
        class="bottom-nav-item"
        :class="{ active: isActive('history') }"
      >
        <span class="nav-icon"><BarChart3 :size="20" /></span>History
      </a>
      <a
        @click.prevent="navigate('notifications')"
        href="#/notifications"
        class="bottom-nav-item"
        :class="{ active: isActive('notifications') }"
      >
        <span class="nav-icon"><Bell :size="20" /></span>Alerts
        <span v-if="unreadCount > 0" class="badge-count">{{
          unreadCount > 9 ? '9+' : unreadCount
        }}</span>
      </a>
      <a
        @click.prevent="navigate('profile')"
        href="#/profile"
        class="bottom-nav-item"
        :class="{ active: isActive('profile') }"
      >
        <span class="nav-icon"><User :size="20" /></span>Profile
      </a>
    </div>
  </nav>
</template>
