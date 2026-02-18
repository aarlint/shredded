<script setup>
import { computed } from 'vue'
import { ThumbsUp, ThumbsDown } from 'lucide-vue-next'

const props = defineProps({
  lift: Object,
  currentUser: Object,
})

const emit = defineEmits(['vote'])

const isOwn = computed(() => props.lift.user_id === props.currentUser.id)
const hype = computed(() => props.lift.hype_count || 0)
const down = computed(() => props.lift.vote_count || 0)
</script>

<template>
  <span
    class="react-btns"
    v-if="isOwn ? hype > 0 || down > 0 : true"
  >
    <template v-if="isOwn">
      <span
        v-if="hype > 0"
        class="react-btn up"
        style="cursor: default; pointer-events: none"
      >
        <ThumbsUp :size="16" />
        <span class="react-count">{{ hype }}</span>
      </span>
      <span
        v-if="down > 0"
        class="react-btn down"
        style="cursor: default; pointer-events: none"
      >
        <ThumbsDown :size="16" />
        <span class="react-count">{{ down }}</span>
      </span>
    </template>
    <template v-else>
      <button
        class="react-btn up"
        :class="{ active: lift.user_vote === 1 }"
        @click.stop="emit('vote', lift.id, 1)"
        title="Hype this lift"
      >
        <ThumbsUp :size="16" />
        <span class="react-count">{{ hype > 0 ? hype : '' }}</span>
      </button>
      <button
        class="react-btn down"
        :class="{ active: lift.user_vote === -1 }"
        @click.stop="emit('vote', lift.id, -1)"
        title="Call BS on this lift"
      >
        <ThumbsDown :size="16" />
        <span class="react-count">{{ down > 0 ? down : '' }}</span>
      </button>
    </template>
  </span>
</template>
