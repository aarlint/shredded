<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { X, MessageCircle, Bell } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth'
import { connectWS, onWS } from './composables/useWebSocket'
import { addToast } from './composables/useToast'
import { api } from './composables/useApi'

import AppNav from './components/AppNav.vue'
import BottomNav from './components/BottomNav.vue'
import ToastContainer from './components/ToastContainer.vue'
import ChatPanel from './components/ChatPanel.vue'
import PwaInstallBanner from './components/PwaInstallBanner.vue'

const { currentUser, fetchUser } = useAuth()
const route = useRoute()

const initError = ref(false)
const chatOpen = ref(false)
const unreadCount = ref(0)

async function fetchUnreadCount() {
  try {
    const data = await api.get('/notifications/unread')
    unreadCount.value = data.count
  } catch (e) {}
}

function handleGlobalWS(event, data) {
  if (
    event === 'new_lift' &&
    currentUser.value &&
    data.user_id !== currentUser.value.id
  ) {
    const prText = data.is_pr ? ' (NEW PR!)' : ''
    addToast(
      '',
      `${data.display_name} logged ${data.lift_type}`,
      `${data.weight} lbs${prText}`
    )
  }
  if (
    event === 'achievement' &&
    currentUser.value &&
    data.user_id !== currentUser.value.id
  ) {
    data.achievements.forEach((a) => {
      addToast(
        a.icon,
        `${data.display_name} unlocked`,
        `${a.label}: ${a.desc}`,
        'achievement'
      )
    })
  }
  if (
    event === 'mention' &&
    currentUser.value &&
    data.mentioned_user_ids.includes(currentUser.value.id)
  ) {
    addToast(
      '',
      `${data.from_display_name} mentioned you`,
      data.message.length > 60
        ? data.message.slice(0, 60) + '...'
        : data.message,
      'mention'
    )
  }
}

onMounted(async () => {
  try {
    await fetchUser()
    connectWS()
    onWS(handleGlobalWS)
    fetchUnreadCount()
    setInterval(fetchUnreadCount, 60000)
  } catch (e) {
    initError.value = true
  }
})
</script>

<template>
  <template v-if="initError">
    <nav>
      <div class="nav-inner">
        <div class="nav-brand">1000LB CLUB</div>
      </div>
    </nav>
    <main>
      <div
        class="card text-center"
        style="margin-top: 4rem; padding: 3rem"
      >
        <h2>Unable to connect</h2>
        <p class="text-secondary mt-1">
          Make sure you are authenticated through Cloudflare Access.
        </p>
      </div>
    </main>
  </template>

  <template v-else-if="!currentUser">
    <nav>
      <div class="nav-inner">
        <div class="nav-brand">1000LB CLUB</div>
      </div>
    </nav>
    <main>
      <div
        class="text-center text-secondary"
        style="padding: 3rem"
      >
        Loading...
      </div>
    </main>
  </template>

  <template v-else>
    <AppNav :unread-count="unreadCount" />
    <ToastContainer />

    <div class="app-layout">
      <div class="app-main">
        <main>
          <router-view
            v-slot="{ Component, route: viewRoute }"
          >
            <div
              :key="viewRoute.fullPath"
              class="page-enter"
            >
              <component
                :is="Component"
                @read="fetchUnreadCount"
              />
            </div>
          </router-view>
        </main>
      </div>
      <ChatPanel
        v-if="route.name !== 'chat'"
        :class="{ 'mobile-open': chatOpen }"
        class="chat-sidebar"
      />
      <button
        class="chat-toggle-btn"
        @click="chatOpen = !chatOpen"
        :title="chatOpen ? 'Close chat' : 'Open chat'"
      >
        <X v-if="chatOpen" :size="22" />
        <MessageCircle v-else :size="22" />
      </button>
    </div>

    <BottomNav :unread-count="unreadCount" />
    <PwaInstallBanner />
  </template>
</template>
