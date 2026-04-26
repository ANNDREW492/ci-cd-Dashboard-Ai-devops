import { createRouter, createWebHistory } from 'vue-router';
import { getToken, clearAuth } from '../services/apiClient';
import DashboardOverview from '../views/DashboardOverview.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardOverview,
    meta: { requiresAuth: true }
  },
  {
    path: '/pipelines',
    name: 'Pipelines',
    component: () => import('../views/PipelineLogs.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ai-analysis',
    name: 'AiAnalysis',
    component: () => import('../views/AiAnalysis.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  },
  // Catch-all: redirige a login
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

/**
 * Auth Guard - Protege rutas que requieren autenticación
 */
router.beforeEach((to, from, next) => {
  const token = getToken();
  const requiresAuth = to.meta.requiresAuth !== false;

  console.log(`[Router] Navegando a ${to.path}, token: ${token ? '✓' : '✗'}`);

  // Si la ruta requiere autenticación y no hay token, ir a login
  if (requiresAuth && !token) {
    console.log('[Router] ⚠ Sin token, redirigiendo a login');
    next('/login');
  }
  // Si estamos en login y ya hay token, ir a dashboard
  else if (to.path === '/login' && token) {
    console.log('[Router] ✓ Ya autenticado, redirigiendo a dashboard');
    next('/');
  }
  // Si no, continuar con la navegación
  else {
    next();
  }
});

export default router;