<template>
  <div class="dashboard-container">
    <header class="page-header">
      <div>
        <h1 class="title">Resumen Operativo</h1>
        <p class="subtitle">Métricas de integración continua para {{ tenantName }}</p>
      </div>
      
      <div class="header-actions">
        <select v-model="selectedBranch" class="branch-selector" :disabled="loading">
          <option value="all">Todas las ramas</option>
          <option v-for="branch in availableBranches" :key="branch" :value="branch">
            Rama: {{ branch }}
          </option>
        </select>
        
        <button class="btn-refresh" @click="fetchMetrics" :disabled="loading">
          <span v-if="loading">Actualizando...</span>
          <span v-else>↻ Refrescar Datos</span>
        </button>
      </div>
    </header>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-header">Total Despliegues</div>
        <div class="kpi-value">{{ totalDeployments }}</div>
      </div>
      <div class="kpi-card success-card">
        <div class="kpi-header">Exitosos</div>
        <div class="kpi-value">{{ successDeployments }}</div>
      </div>
      <div class="kpi-card danger-card">
        <div class="kpi-header">Fallidos</div>
        <div class="kpi-value">{{ failedDeployments }}</div>
      </div>
      
      <div class="kpi-card gauge-card">
        <div class="kpi-header">Tasa de Éxito</div>
        <div class="gauge-wrapper">
          <v-chart class="chart" :option="gaugeOption" autoresize />
        </div>
        <div class="gauge-value">{{ successRate }}%</div>
      </div>
    </section>

    <section class="main-content-grid">
      
      <div class="chart-section panel">
        <div class="panel-header-with-actions">
          <h3 class="panel-title">Tendencia de Despliegues</h3>
          <select v-model="timeRange" class="time-selector">
            <option :value="7">Últimos 7 días</option>
            <option :value="30">Últimos 30 días</option>
            <option :value="90">Últimos 3 meses</option>
          </select>
        </div>
        <div class="chart-wrapper">
          <Line v-if="!loading && chartData.labels.length > 0" :data="chartData" :options="chartOptions" />
          <div v-else class="empty-chart">
            <span v-if="loading">Cargando gráfico...</span>
            <span v-else>No hay datos suficientes en este rango.</span>
          </div>
        </div>
      </div>

      <div class="side-section">
        
        <div class="ai-widget panel">
          <div class="ai-header">
            <div class="ai-indicator"></div>
            <h3 class="panel-title">Análisis Predictivo</h3>
          </div>
          <p class="ai-text">
            El modelo estima un <strong>riesgo bajo</strong> para los próximos despliegues en la rama <code>{{ selectedBranch === 'all' ? 'general' : selectedBranch }}</code> basado en la estabilidad reciente.
          </p>
          <router-link to="/ai-analysis" class="ai-link">Ver detalles del modelo →</router-link>
        </div>

        <div class="recent-activity panel">
          <h3 class="panel-title">Actividad Reciente</h3>
          <ul class="activity-list">
            <li v-for="log in recentLogs" :key="log._id" class="activity-item">
              <div :class="['status-indicator', log.status.toLowerCase()]"></div>
              <div class="activity-details">
                <span class="commit-hash">{{ log.commit.substring(0, 7) }}</span>
                <span class="branch-name">{{ log.branch }}</span>
                <span class="time-ago">{{ formatTime(log.timestamp) }}</span>
              </div>
            </li>
            <li v-if="recentLogs.length === 0 && !loading" class="empty-state">
              No hay despliegues recientes.
            </li>
          </ul>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';

/* Inyección de ECharts y Chart.js */
use([GaugeChart, CanvasRenderer]);
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const tenantName = ref('Digital Buho S.A.C.');

const logs = ref([]);
const loading = ref(true);
const error = ref(null);

/* --- NUEVO: LÓGICA DE RAMAS --- */
const selectedBranch = ref('all');

const availableBranches = computed(() => {
  const branches = logs.value.map(log => log.branch);
  return [...new Set(branches)]; // Elimina nombres duplicados
});

const filteredLogsByBranch = computed(() => {
  if (selectedBranch.value === 'all') return logs.value;
  return logs.value.filter(log => log.branch === selectedBranch.value);
});
/* ------------------------------ */

const fetchMetrics = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('http://localhost:3000/api/logs');
    if (!response.ok) throw new Error('Error al conectar con el servidor de telemetría.');
    const data = await response.json();
    logs.value = Array.isArray(data) ? data : [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

/* Ahora los cálculos se basan en la rama filtrada, no en el total general */
const totalDeployments = computed(() => filteredLogsByBranch.value.length);
const successDeployments = computed(() => filteredLogsByBranch.value.filter(l => l.status === 'success').length);
const failedDeployments = computed(() => filteredLogsByBranch.value.filter(l => l.status !== 'success').length);

const successRate = computed(() => {
  if (totalDeployments.value === 0) return 0;
  return Math.round((successDeployments.value / totalDeployments.value) * 100);
});

/* --- NUEVO: CONFIGURACIÓN DEL GAUGE --- */
const gaugeOption = computed(() => {
  let color = '#10b981'; // Verde (Éxito alto)
  if (successRate.value < 70) color = '#ef4444'; // Rojo (Peligro)
  else if (successRate.value < 90) color = '#f59e0b'; // Naranja (Advertencia)

  return {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        center: ['50%', '75%'],
        radius: '100%',
        min: 0,
        max: 100,
        splitNumber: 2,
        axisLine: {
          lineStyle: {
            width: 15,
            color: [[1, '#e2e8f0']]
          }
        },
        progress: {
          show: true,
          width: 15,
          itemStyle: { color: color }
        },
        pointer: { show: false }, // Sin aguja para un look más minimalista
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 24,
          fontWeight: 'bold',
          offsetCenter: [0, '-10%'],
          color: 'var(--color-text-main)',
          formatter: (value) => `${Math.round(value)}%`
        },
        data: [{ value: successRate.value }]
      }
    ]
  };
});
/* -------------------------------------- */

const recentLogs = computed(() => filteredLogsByBranch.value.slice(0, 5));

const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const timeRange = ref(7);

const chartData = computed(() => {
  if (filteredLogsByBranch.value.length === 0) return { labels: [], datasets: [] };

  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - timeRange.value);

  const timeFilteredLogs = filteredLogsByBranch.value.filter(log => {
    return new Date(log.timestamp) >= limitDate;
  });

  const countsByDate = {};
  const reversedLogs = [...timeFilteredLogs].reverse(); 
  
  reversedLogs.forEach(log => {
    const d = new Date(log.timestamp).toLocaleDateString('es-PE', { month: 'short', day: 'numeric' });
    countsByDate[d] = (countsByDate[d] || 0) + 1;
  });

  return {
    labels: Object.keys(countsByDate),
    datasets: [
      {
        label: 'Despliegues',
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        data: Object.values(countsByDate),
        tension: 0.3,
        fill: false,
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
};

onMounted(() => {
  fetchMetrics();
});
</script>

<style scoped>
.dashboard-container {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-ai: #6366f1;
  --color-text-main: #0f172a;
  --color-text-muted: #64748b;
  --color-bg-card: #ffffff;
  --color-border: #e2e8f0;
  
  max-width: 1200px;
  margin: 0 auto;
  color: var(--color-text-main);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  margin: 4px 0 0 0;
}

/* Estilos Selector de Ramas */
.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.branch-selector {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-card);
  color: var(--color-text-main);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
}

.branch-selector:focus {
  border-color: var(--color-primary);
}

.btn-refresh {
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-main);
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-refresh:hover:not(:disabled) {
  background-color: #f8fafc;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.kpi-card {
  background: var(--color-bg-card);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}

.kpi-header {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.kpi-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-text-main);
  line-height: 1;
}

.success-card .kpi-value { color: var(--color-success); }
.danger-card .kpi-value { color: var(--color-danger); }

/* Ajustes Visuales para la Tarjeta Gauge */
.gauge-card {
  padding-bottom: 10px;
}

.gauge-wrapper {
  height: 110px;
  width: 100%;
  margin-top: -10px;
}

.chart {
  height: 100%;
  width: 100%;
}

.gauge-value {
  margin-top: -55px;
  text-align: center;
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-main);
}

.main-content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .main-content-grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.panel-header-with-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.time-selector {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-main);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
}

.time-selector:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.chart-wrapper {
  height: 300px;
  position: relative;
}

.empty-chart {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.side-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ai-widget {
  background: #f8fafc;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.ai-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-ai);
  box-shadow: 0 0 8px var(--color-ai);
}

.ai-header .panel-title { 
  margin: 0; 
  color: var(--color-text-main);
}

.ai-text {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.ai-link {
  font-size: 0.85rem;
  color: var(--color-ai);
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.2s;
}

.ai-link:hover { opacity: 0.8; }

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.activity-item:last-child { border-bottom: none; }

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  margin-right: 12px;
  flex-shrink: 0;
  background-color: var(--color-text-muted);
}

.status-indicator.success { background-color: var(--color-success); }
.status-indicator.failure { background-color: var(--color-danger); }

.activity-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.commit-hash { font-family: ui-monospace, monospace; font-weight: 600; font-size: 0.9rem; color: var(--color-text-main); }
.branch-name { font-size: 0.8rem; color: var(--color-text-muted); }
.time-ago { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
</style>