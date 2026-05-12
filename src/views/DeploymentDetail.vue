<template>
  <div class="detail-page">
    <header class="page-header">
      <div>
        <h1 class="title">Detalle del Deployment</h1>
        <p class="subtitle">Separación explícita entre predicción temprana y diagnóstico posterior</p>
      </div>
      <button class="btn-secondary" @click="goToDiagnosis" :disabled="!deployment">Abrir diagnóstico IA</button>
    </header>

    <div v-if="loading" class="state-panel">Cargando deployment...</div>
    <div v-else-if="error" class="state-panel error">{{ error }}</div>
    <div v-else-if="deployment" class="detail-grid">
      <section class="panel risk-panel" :class="riskClass">
        <div class="risk-topline">Semáforo operativo</div>
        <div class="risk-score">{{ riskPercent }}%</div>
        <div class="risk-level">{{ deployment.risk_level || 'Sin predicción' }}</div>
        <div class="risk-decision">{{ deployment.risk_decision || 'Sin decisión disponible' }}</div>
        <p class="risk-note">La predicción usa solo variables tempranas. No es una evaluación del desarrollador.</p>
      </section>

      <section class="panel info-panel">
        <h3>Datos tempranos</h3>
        <dl>
          <div><dt>Branch</dt><dd>{{ deployment.branch || 'N/A' }}</dd></div>
          <div><dt>Event type</dt><dd>{{ deployment.event_type || 'N/A' }}</dd></div>
          <div><dt>Commit scope</dt><dd>{{ deployment.commit_scope || 'N/A' }}</dd></div>
          <div><dt>Commit action</dt><dd>{{ deployment.commit_action || 'N/A' }}</dd></div>
          <div><dt>Files changed</dt><dd>{{ safeNumber(deployment.files_changed) }}</dd></div>
          <div><dt>Lines changed</dt><dd>{{ safeNumber(deployment.lines_changed) }}</dd></div>
          <div><dt>Hora</dt><dd>{{ safeNumber(deployment.hora_dia) }}</dd></div>
          <div><dt>Día</dt><dd>{{ safeNumber(deployment.dia_semana) }}</dd></div>
        </dl>
      </section>

      <section class="panel info-panel">
        <h3>Resultados del modelo</h3>
        <dl>
          <div><dt>Risk probability</dt><dd>{{ riskPercent }}%</dd></div>
          <div><dt>Risk level</dt><dd>{{ deployment.risk_level || 'Sin predicción' }}</dd></div>
          <div><dt>Risk decision</dt><dd>{{ deployment.risk_decision || 'Sin predicción' }}</dd></div>
          <div><dt>Model version</dt><dd>{{ deployment.model_version || 'N/A' }}</dd></div>
          <div><dt>Threshold</dt><dd>{{ deployment.prediction_threshold ?? 'N/A' }}</dd></div>
          <div><dt>Prediction status</dt><dd>{{ deployment.prediction_status || 'unavailable' }}</dd></div>
        </dl>
      </section>

      <section class="panel info-panel">
        <h3>Telemetría posterior</h3>
        <dl>
          <div><dt>Failed job</dt><dd>{{ deployment.failed_job_name || 'N/A' }}</dd></div>
          <div><dt>Failed steps</dt><dd>{{ deployment.failed_steps_count ?? 'N/A' }}</dd></div>
          <div><dt>Log category</dt><dd>{{ deployment.log_category || 'N/A' }}</dd></div>
          <div><dt>Execution time</dt><dd>{{ deployment.execution_time_seg ?? 'N/A' }}</dd></div>
          <div><dt>Test duration</dt><dd>{{ deployment.test_duration_sec ?? 'N/A' }}</dd></div>
          <div><dt>Build duration</dt><dd>{{ deployment.build_duration_sec ?? 'N/A' }}</dd></div>
        </dl>
      </section>

      <section class="panel info-panel wide-panel">
        <h3>Logs y diagnóstico</h3>
        <p><strong>Repository:</strong> {{ deployment.repository || 'N/A' }}</p>
        <p><strong>Actor:</strong> {{ deployment.actor || 'N/A' }}</p>
        <p><strong>Error log:</strong></p>
        <pre>{{ deployment.error_log || deployment.errorLog || 'Sin log capturado' }}</pre>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../services/apiClient';

const route = useRoute();
const router = useRouter();

const deployment = ref(null);
const loading = ref(true);
const error = ref(null);

const safeNumber = (value) => (value === null || value === undefined ? 'N/A' : value);

const riskPercent = computed(() => {
  const probability = Number(deployment.value?.risk_probability ?? 0);
  return Math.round(probability * 100);
});

const riskClass = computed(() => {
  const probability = Number(deployment.value?.risk_probability ?? 0);
  if (probability >= 0.70) return 'risk-high';
  if (probability >= 0.40) return 'risk-medium';
  return 'risk-low';
});

const loadDeployment = async () => {
  loading.value = true;
  error.value = null;
  try {
    deployment.value = await api.getLog(route.params.id);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const goToDiagnosis = () => {
  if (!deployment.value?._id) return;
  router.push({ path: '/ai-analysis', query: { logId: deployment.value._id } });
};

onMounted(loadDeployment);
</script>

<style scoped>
.detail-page { max-width: 1200px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 16px; }
.title { margin: 0; font-size: 1.8rem; }
.subtitle { margin: 4px 0 0; color: #64748b; }
.btn-secondary { border: 1px solid #cbd5e1; background: white; color: #0f172a; padding: 10px 14px; border-radius: 10px; font-weight: 600; cursor: pointer; }
.state-panel { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
.state-panel.error { color: #b91c1c; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.panel { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.risk-panel { color: white; }
.risk-low { background: linear-gradient(180deg, #16a34a, #15803d); }
.risk-medium { background: linear-gradient(180deg, #f59e0b, #d97706); }
.risk-high { background: linear-gradient(180deg, #dc2626, #b91c1c); }
.risk-topline { text-transform: uppercase; letter-spacing: .08em; font-size: .75rem; opacity: .9; }
.risk-score { font-size: 3rem; font-weight: 800; line-height: 1; margin: 12px 0; }
.risk-level { font-size: 1.2rem; font-weight: 700; }
.risk-decision, .risk-note { margin-top: 8px; }
.info-panel h3 { margin-top: 0; }
dl { display: grid; gap: 10px; margin: 0; }
dl > div { display: grid; grid-template-columns: 160px 1fr; gap: 10px; }
dt { font-weight: 700; color: #475569; }
dd { margin: 0; color: #0f172a; }
.wide-panel { grid-column: 1 / -1; }
pre { white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; }
@media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } .page-header { flex-direction: column; align-items: flex-start; } }
</style>