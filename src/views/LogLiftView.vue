<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ArrowDownUp, Dumbbell, Skull, Paperclip, X } from 'lucide-vue-next'
import { api } from '../composables/useApi'
import { addToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import { today, confetti } from '../composables/useHelpers'

const { currentUser, fetchUser } = useAuth()

const selectedType = ref(localStorage.getItem('lastLiftType') || null)
const weight = ref(135)
const reps = ref(1)
const date = ref(today())
const notes = ref('')
const selectedFile = ref(null)
const previewUrl = ref(null)
const previewIsVideo = ref(false)
const submitting = ref(false)
const dragOver = ref(false)
const fileInput = ref(null)
const currentPR = ref(0)

const liftTypes = [
  { type: 'squat', icon: ArrowDownUp },
  { type: 'bench', icon: Dumbbell },
  { type: 'deadlift', icon: Skull },
]

const estimatedMax = computed(() => {
  if (reps.value <= 1) return weight.value
  return Math.round(weight.value * (1 + reps.value / 30))
})

watch(
  () => selectedType.value,
  async (type) => {
    if (!type) return
    localStorage.setItem('lastLiftType', type)
    try {
      const data = await api.get('/lifts/last/' + type)
      currentPR.value = data.pr || 0
      if (data.last) {
        weight.value = data.last.weight + 5
      }
    } catch (e) {}
  }
)

onMounted(async () => {
  if (selectedType.value) {
    try {
      const data = await api.get('/lifts/last/' + selectedType.value)
      currentPR.value = data.pr || 0
      if (data.last) weight.value = data.last.weight + 5
    } catch (e) {}
  }
})

function onFileSelect(e) {
  if (e.target.files.length > 0) showPreview(e.target.files[0])
}
function onDrop(e) {
  dragOver.value = false
  if (e.dataTransfer.files.length > 0) showPreview(e.dataTransfer.files[0])
}
function showPreview(file) {
  selectedFile.value = file
  previewIsVideo.value = file.type.startsWith('video/')
  previewUrl.value = URL.createObjectURL(file)
}
function clearMedia() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  selectedFile.value = null
  previewUrl.value = null
  previewIsVideo.value = false
  if (fileInput.value) fileInput.value.value = ''
}

async function submitLift() {
  if (!selectedType.value) return
  submitting.value = true
  try {
    const formData = new FormData()
    formData.append('lift_type', selectedType.value)
    formData.append('weight', weight.value)
    formData.append('reps', reps.value)
    formData.append('date', date.value)
    formData.append('notes', notes.value || '')
    if (selectedFile.value) formData.append('media', selectedFile.value)

    const result = await api.upload('/lifts', formData)

    const repText =
      reps.value > 1 ? ` x${reps.value} (e1RM: ${estimatedMax.value})` : ''
    if (result.isPR) {
      confetti()
      addToast(
        '',
        'NEW PR!',
        `${selectedType.value.toUpperCase()} \u2014 ${weight.value} lbs${repText}`,
        'pr'
      )
    } else {
      addToast(
        '',
        'Lift logged!',
        `${selectedType.value.toUpperCase()} \u2014 ${weight.value} lbs${repText}`
      )
    }

    if (result.isSus) {
      setTimeout(
        () =>
          addToast(
            '',
            'SUS',
            "That's a big jump... flagged as suspicious"
          ),
        800
      )
    }

    if (result.newAchievements && result.newAchievements.length > 0) {
      setTimeout(
        () => {
          result.newAchievements.forEach((a) => {
            addToast(
              a.icon,
              'Achievement Unlocked!',
              `${a.label}: ${a.desc}`,
              'achievement'
            )
          })
          if (!result.isPR) confetti()
        },
        result.isPR ? 1500 : 0
      )
    }

    fetchUser()
    reps.value = 1
    clearMedia()
  } catch (e) {
    addToast('', 'Error', e.message)
  }
  submitting.value = false
}
</script>

<template>
  <div class="card" style="max-width: 500px; margin: 0 auto">
    <div class="card-header text-center">Log a Max</div>
    <div class="lift-selector">
      <div
        v-for="t in liftTypes"
        :key="t.type"
        class="lift-option"
        :class="[t.type, { selected: selectedType === t.type }]"
        @click="selectedType = t.type"
      >
        <div class="lift-option-icon">
          <component :is="t.icon" :size="28" />
        </div>
        <div class="lift-option-label">{{ t.type }}</div>
      </div>
    </div>

    <div v-if="selectedType && currentPR" class="pr-hint">
      Current {{ selectedType }} PR:
      <strong>{{ currentPR }} lbs</strong>
    </div>

    <div class="weight-input-wrap">
      <button @click="weight = Math.max(1, weight - 5)" title="-5 lbs">
        &minus;
      </button>
      <input
        type="number"
        v-model.number="weight"
        min="1"
        max="2000"
        step="5"
      />
      <span class="weight-unit">LBS</span>
      <button @click="weight += 5" title="+5 lbs">+</button>
    </div>

    <div class="reps-wrap">
      <button @click="reps = Math.max(1, reps - 1)">&minus;</button>
      <div style="text-align: center">
        <div class="reps-value">{{ reps }}</div>
        <div class="reps-label">Reps</div>
      </div>
      <button @click="reps = Math.min(20, reps + 1)">+</button>
    </div>

    <div v-if="reps > 1" class="e1rm-display">
      <div class="e1rm-value">Est. 1RM: {{ estimatedMax }} lbs</div>
      <div class="e1rm-label">Epley Formula</div>
    </div>

    <div class="grid-2 mb-1">
      <div>
        <label>Date</label>
        <input type="date" v-model="date" />
      </div>
      <div>
        <label>Notes (optional)</label>
        <input type="text" v-model="notes" placeholder="e.g. felt easy" />
      </div>
    </div>

    <div
      v-if="!previewUrl"
      class="media-upload"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      :class="{ 'drag-over': dragOver }"
    >
      <div class="media-upload-icon"><Paperclip :size="24" /></div>
      <div class="media-upload-text">Add photo or video (optional)</div>
      <input
        type="file"
        accept="image/*,video/*"
        @change="onFileSelect"
        ref="fileInput"
      />
    </div>
    <div v-else class="media-preview">
      <button
        class="media-preview-remove"
        type="button"
        @click="clearMedia"
      >
        <X :size="16" />
      </button>
      <video v-if="previewIsVideo" :src="previewUrl" controls muted></video>
      <img v-else :src="previewUrl" alt="Preview" />
    </div>

    <button
      class="btn btn-primary btn-block btn-lg mt-1"
      :disabled="!selectedType || submitting"
      @click="submitLift"
    >
      {{
        submitting
          ? 'LOGGING...'
          : selectedType
            ? 'LOG IT'
            : 'Select a lift type'
      }}
    </button>
  </div>
</template>
