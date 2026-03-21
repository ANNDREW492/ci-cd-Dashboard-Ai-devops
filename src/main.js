import { createApp } from 'vue'
import App from './App.vue'
import router from './router' 

const app = createApp(App)
app.use(router) // Conecta el enrutador a la instancia de Vue
app.mount('#app')