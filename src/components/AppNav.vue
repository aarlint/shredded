<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { getInitials, avatarStyle, avatarUrl } from '../composables/useHelpers'
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  unreadCount: { type: Number, default: 0 },
})

const { currentUser } = useAuth()
const router = useRouter()
const route = useRoute()
const mobileNavOpen = ref(false)

function isActive(name) {
  return route.name === name
}

function navigate(name) {
  mobileNavOpen.value = false
  router.push({ name })
}
</script>

<template>
  <nav>
    <div class="nav-inner">
      <div class="nav-brand">1000LB CLUB</div>
      <button
        class="hamburger"
        @click="mobileNavOpen = !mobileNavOpen"
        aria-label="Menu"
      >
        &#9776;
      </button>
      <div class="nav-links" :class="{ open: mobileNavOpen }">
        <a
          @click.prevent="navigate('dashboard')"
          href="#/"
          :class="{ active: isActive('dashboard') }"
          >Dashboard</a
        >
        <a
          @click.prevent="navigate('log')"
          href="#/log"
          :class="{ active: isActive('log') }"
          >Log Lift</a
        >
        <a
          @click.prevent="navigate('history')"
          href="#/history"
          :class="{ active: isActive('history') }"
          >History</a
        >
        <a
          @click.prevent="navigate('notifications')"
          href="#/notifications"
          :class="{ active: isActive('notifications') }"
          class="notif-badge"
          >Alerts<span v-if="unreadCount > 0" class="badge-count">{{
            unreadCount > 9 ? '9+' : unreadCount
          }}</span></a
        >
        <a
          @click.prevent="navigate('challenges')"
          href="#/challenges"
          :class="{ active: isActive('challenges') }"
          >H2H</a
        >
        <a
          @click.prevent="navigate('profile')"
          href="#/profile"
          :class="{ active: isActive('profile') }"
          >Profile</a
        >
      </div>
      <div class="nav-user" v-if="currentUser">
        <span class="user-name-text">{{ currentUser.display_name }}</span>
        <div class="avatar" :style="avatarStyle(currentUser.avatar_color)">
          <img
            v-if="currentUser.avatar_url"
            :src="avatarUrl(currentUser.avatar_url)"
          />
          <template v-else>{{
            getInitials(currentUser.display_name)
          }}</template>
        </div>
      </div>
    </div>
  </nav>
</template>
