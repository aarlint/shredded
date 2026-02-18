<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { api } from '../composables/useApi'
import { onWS, offWS } from '../composables/useWebSocket'
import {
  getInitials,
  timeAgo,
  avatarStyle,
  avatarUrl,
  showLightbox,
} from '../composables/useHelpers'
import { useAuth } from '../composables/useAuth'

const { currentUser } = useAuth()

const messages = ref([])
const draft = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)
const allUsers = ref([])
const showMentions = ref(false)
const mentionQuery = ref('')
const mentionIdx = ref(0)
const mentionStart = ref(-1)

const filteredUsers = computed(() => {
  if (!mentionQuery.value) return allUsers.value.slice(0, 8)
  const q = mentionQuery.value.toLowerCase()
  return allUsers.value
    .filter((u) => u.display_name.toLowerCase().includes(q))
    .slice(0, 8)
})

async function loadMessages() {
  messages.value = await api.get('/chat')
  await nextTick()
  scrollToBottom()
}

async function loadUsers() {
  allUsers.value = await api.get('/users')
}

function scrollToBottom() {
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

function onInput() {
  const el = inputEl.value
  if (!el) return
  const pos = el.selectionStart
  const text = draft.value.slice(0, pos)
  const atIdx = text.lastIndexOf('@')
  if (atIdx >= 0 && (atIdx === 0 || text[atIdx - 1] === ' ')) {
    mentionStart.value = atIdx
    mentionQuery.value = text.slice(atIdx + 1)
    showMentions.value = true
    mentionIdx.value = 0
  } else {
    showMentions.value = false
  }
}

function onKeydown(e) {
  if (showMentions.value && filteredUsers.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionIdx.value =
        (mentionIdx.value + 1) % filteredUsers.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionIdx.value =
        (mentionIdx.value - 1 + filteredUsers.value.length) %
        filteredUsers.value.length
      return
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && showMentions.value)) {
      e.preventDefault()
      pickMention(filteredUsers.value[mentionIdx.value])
      return
    }
    if (e.key === 'Escape') {
      showMentions.value = false
      return
    }
  }
  if (e.key === 'Enter' && !showMentions.value) {
    send()
  }
}

function pickMention(user) {
  const before = draft.value.slice(0, mentionStart.value)
  const after = draft.value.slice(inputEl.value.selectionStart)
  draft.value = before + '@' + user.display_name + ' ' + after
  showMentions.value = false
  nextTick(() => {
    const newPos = before.length + 1 + user.display_name.length + 1
    inputEl.value.focus()
    inputEl.value.setSelectionRange(newPos, newPos)
  })
}

function highlightMentions(text) {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  for (const u of allUsers.value) {
    const mention = '@' + u.display_name
    const escapedMention = mention
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    escaped = escaped
      .split(escapedMention)
      .join('<span class="chat-mention">' + escapedMention + '</span>')
  }
  escaped = escaped.replace(
    /(https?:\/\/\S+\.(?:gif|jpg|jpeg|png|webp)(?:\?\S*)?)/gi,
    '<br><img src="$1" class="chat-inline-img" loading="lazy" onerror="this.style.display=\'none\'">'
  )
  return escaped
}

async function send() {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  showMentions.value = false
  try {
    await api.post('/chat', { message: text })
  } catch (err) {
    draft.value = text
  }
}

function handleWS(event, data) {
  if (event === 'chat') {
    messages.value.push(data)
    nextTick(scrollToBottom)
  }
}

let wsHandler
onMounted(() => {
  loadMessages()
  loadUsers()
  wsHandler = (event, data) => handleWS(event, data)
  onWS(wsHandler)
})

onUnmounted(() => {
  if (wsHandler) offWS(wsHandler)
})
</script>

<template>
  <div>
    <div class="chat-header">
      <span>Chat</span>
      <span class="chat-expire">messages expire after 24h</span>
    </div>
    <div class="chat-messages" ref="messagesEl">
      <div v-if="messages.length === 0" class="chat-empty">
        No messages yet. Say something.
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        class="chat-msg"
        :class="{ own: m.user_id === currentUser.id }"
      >
        <div class="avatar" :style="avatarStyle(m.avatar_color)">
          <img v-if="m.avatar_url" :src="avatarUrl(m.avatar_url)" />
          <template v-else>{{ getInitials(m.display_name) }}</template>
        </div>
        <div class="chat-msg-body">
          <div class="chat-msg-name">
            {{ m.display_name
            }}<span class="chat-msg-time">{{ timeAgo(m.created_at) }}</span>
          </div>
          <div
            class="chat-msg-text"
            v-html="highlightMentions(m.message)"
          ></div>
        </div>
      </div>
    </div>
    <div class="chat-input-wrap">
      <div class="chat-input-container">
        <div
          v-if="showMentions && filteredUsers.length"
          class="mention-dropdown"
        >
          <div
            v-for="(u, i) in filteredUsers"
            :key="u.id"
            class="mention-option"
            :class="{ active: i === mentionIdx }"
            @mousedown.prevent="pickMention(u)"
          >
            <div class="avatar" :style="avatarStyle(u.avatar_color)">
              <img v-if="u.avatar_url" :src="avatarUrl(u.avatar_url)" />
              <template v-else>{{ getInitials(u.display_name) }}</template>
            </div>
            <span>{{ u.display_name }}</span>
          </div>
        </div>
        <input
          ref="inputEl"
          v-model="draft"
          @keydown="onKeydown"
          @input="onInput"
          placeholder="Type a message... (@mention)"
          maxlength="500"
        />
      </div>
      <button @click="send" :disabled="!draft.trim()">Send</button>
    </div>
  </div>
</template>
