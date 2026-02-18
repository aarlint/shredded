import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './assets/styles/variables.css'
import './assets/styles/base.css'
import './assets/styles/components.css'
import './assets/styles/layout.css'
import './assets/styles/utilities.css'
import './assets/styles/animations.css'
import './assets/styles/responsive.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
