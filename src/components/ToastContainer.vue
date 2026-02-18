<script setup>
import { useToast } from '../composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <div class="toast-container">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="t.cls || ''"
    >
      <span class="toast-icon" v-html="t.icon"></span>
      <div>
        <div class="toast-text">{{ t.text }}</div>
        <div v-if="t.sub" class="toast-sub">{{ t.sub }}</div>
      </div>
    </div>
  </div>
</template>
