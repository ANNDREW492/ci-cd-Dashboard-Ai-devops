import { createRouter, createWebHistory } from 'vue-router';
import DashboardOverview from '../views/DashboardOverview.vue';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardOverview
  },
  {
    path: '/pipelines',
    name: 'Pipelines',
    component: () => import('../views/PipelineLogs.vue')
  },
  {
    path: '/ai-analysis',
    name: 'AiAnalysis',
    component: () => import('../views/AiAnalysis.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;