import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function addToast(icon, text, sub, cls) {
  const id = ++toastId
  toasts.value.push({ id, icon, text, sub, cls })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 4000)
}

export function useToast() {
  return { toasts, addToast }
}
