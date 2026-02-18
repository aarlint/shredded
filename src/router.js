import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import LogLiftView from './views/LogLiftView.vue'
import HistoryView from './views/HistoryView.vue'
import NotificationsView from './views/NotificationsView.vue'
import ChallengesView from './views/ChallengesView.vue'
import ProfileView from './views/ProfileView.vue'
import ChatView from './views/ChatView.vue'
import LogRunView from './views/LogRunView.vue'
import RunHistoryView from './views/RunHistoryView.vue'

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/dashboard', redirect: '/' },
  { path: '/log', name: 'log', component: LogLiftView },
  { path: '/log-run', name: 'log-run', component: LogRunView },
  { path: '/run-history', name: 'run-history', component: RunHistoryView },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/user/:id', name: 'user', component: HistoryView, props: route => ({ userId: Number(route.params.id) }) },
  { path: '/notifications', name: 'notifications', component: NotificationsView },
  { path: '/challenges', name: 'challenges', component: ChallengesView },
  { path: '/profile', name: 'profile', component: ProfileView },
  { path: '/chat', name: 'chat', component: ChatView },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
