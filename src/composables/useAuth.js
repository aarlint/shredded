import { ref } from 'vue'
import { api } from './useApi'

const currentUser = ref(null)

export async function fetchUser() {
  currentUser.value = await api.get('/me')
}

export function useAuth() {
  return { currentUser, fetchUser }
}
