<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { isVideoFile, mediaUrl, showLightbox } from '../composables/useHelpers'

const props = defineProps({
  filename: String,
  small: Boolean,
  canRemove: Boolean,
  liftId: Number,
})

const emit = defineEmits(['remove'])

const isVideo = computed(() => isVideoFile(props.filename))
const url = computed(() => mediaUrl(props.filename))

function openLightbox() {
  showLightbox(url.value, isVideo.value)
}
</script>

<template>
  <div
    v-if="filename"
    :class="['media-thumb', small ? 'media-thumb-sm' : '']"
    @click="openLightbox"
  >
    <video v-if="isVideo" :src="url" preload="metadata" muted></video>
    <img v-else :src="url" alt="Lift media" loading="lazy" />
    <div v-if="isVideo" class="video-play-overlay">&#9654;</div>
    <button
      v-if="canRemove"
      class="remove-media-btn"
      @click.stop="emit('remove', liftId)"
      title="Remove media"
    >
      <X :size="14" />
    </button>
  </div>
</template>
