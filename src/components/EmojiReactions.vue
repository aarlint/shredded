<script setup>
import { ref } from 'vue'
import { api } from '../composables/useApi'

const props = defineProps({
  lift: Object,
  currentUser: Object,
})

const pickerOpen = ref(false)
const emojis = ['🍆', '🧱', '💦', '🔥']

async function react(emoji) {
  try {
    const result = await api.post('/lifts/' + props.lift.id + '/react', {
      emoji,
    })
    props.lift.reactions = result.reactions
    props.lift.user_reactions = result.user_reactions
  } catch (e) {}
  pickerOpen.value = false
}
</script>

<template>
  <div class="reaction-bar">
    <button
      v-for="(count, emoji) in lift.reactions"
      :key="emoji"
      class="reaction-btn"
      :class="{
        active: (lift.user_reactions || []).includes(emoji),
      }"
      @click.stop="react(emoji)"
    >
      {{ emoji }} <span class="reaction-count">{{ count }}</span>
    </button>
    <div
      class="reaction-add"
      @click.stop="pickerOpen = !pickerOpen"
      v-if="lift.user_id !== currentUser.id"
    >
      +
      <div v-if="pickerOpen" class="reaction-picker" @click.stop>
        <button
          v-for="e in emojis"
          :key="e"
          @click.stop="react(e)"
        >
          {{ e }}
        </button>
      </div>
    </div>
  </div>
</template>
