<script setup>
import { ref, onMounted } from 'vue'
import { Download, X } from 'lucide-vue-next'

const showInstallPrompt = ref(false)
let deferredPrompt = null

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then(() => {
      showInstallPrompt.value = false
      deferredPrompt = null
    })
  }
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    showInstallPrompt.value = true
  })
})
</script>

<template>
  <div v-if="showInstallPrompt" class="pwa-install-banner">
    <span style="font-size: 1.5rem; display: flex"><Download :size="24" /></span>
    <div style="flex: 1">
      <div style="font-weight: 600; font-size: 0.85rem">Install App</div>
      <div style="font-size: 0.7rem; color: var(--text-secondary)">
        Add to home screen for the best experience
      </div>
    </div>
    <button class="btn btn-primary btn-sm" @click="installPWA">
      Install
    </button>
    <button
      class="btn btn-ghost btn-sm"
      @click="showInstallPrompt = false"
      style="padding: 0.25rem"
    >
      <X :size="16" />
    </button>
  </div>
</template>
