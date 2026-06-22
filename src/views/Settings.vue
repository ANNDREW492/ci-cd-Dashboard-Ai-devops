<template>
  <div class="settings-page">
    <header class="page-header">
      <div>
        <h1 class="title">Configuracion ML</h1>
        <p class="subtitle">Control operativo de dataset, S3 y entrenamiento del modelo activo.</p>
      </div>
      <button class="btn-secondary" :disabled="loading" @click="loadConfig">
        {{ loading ? 'Actualizando...' : 'Refrescar' }}
      </button>
    </header>

    <div v-if="message" class="alert success">{{ message }}</div>
    <div v-if="error" class="alert error">{{ error }}</div>

    <section class="settings-grid">
      <div class="panel">
        <h3>Dataset</h3>
        <div class="field">
          <label>Fuente del dataset</label>
          <select v-model="config.dataset_mode">
            <option value="automatic">Automatico desde MongoDB</option>
            <option value="manual">Manual del repositorio</option>
          </select>
        </div>

        <div class="field">
          <label>Ruta dataset manual</label>
          <input v-model="config.manual_dataset_path" type="text">
        </div>

        <label class="check-row">
          <input v-model="config.export_only_new" type="checkbox">
          <span>Exportar solo registros nuevos</span>
        </label>
      </div>

      <div class="panel">
        <h3>Entrenamiento</h3>
        <div class="field-row">
          <div class="field">
            <label>Intervalo dias</label>
            <input v-model.number="config.train_interval_days" type="number" min="1">
          </div>
          <div class="field">
            <label>Minimo registros</label>
            <input v-model.number="config.min_new_records" type="number" min="1">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Metrica promocion</label>
            <select v-model="config.promotion_metric">
              <option value="f1">F1 fallo</option>
              <option value="recall">Recall fallo</option>
              <option value="precision">Precision fallo</option>
              <option value="auc">AUC ROC</option>
            </select>
          </div>
          <div class="field">
            <label>Mejora minima</label>
            <input v-model.number="config.min_improvement" type="number" min="0" step="0.001">
          </div>
        </div>

        <label class="check-row">
          <input v-model="config.enabled_auto_train" type="checkbox">
          <span>Habilitar entrenamiento programado</span>
        </label>

        <label class="check-row">
          <input v-model="config.allow_auto_promotion" type="checkbox">
          <span>Permitir promocion automatica si supera validacion</span>
        </label>
      </div>

      <div class="panel">
        <h3>S3</h3>
        <div class="field">
          <label>Bucket</label>
          <input v-model="config.storage.bucket" type="text" placeholder="pro8-model-artifacts-anndrew">
        </div>
        <div class="field">
          <label>Region</label>
          <input v-model="config.storage.region" type="text" placeholder="us-east-1">
        </div>
        <button class="btn-secondary" :disabled="busyAction" @click="testS3">Probar S3</button>
      </div>

      <div class="panel">
        <h3>GitHub Actions</h3>
        <div class="field-row">
          <div class="field">
            <label>Owner</label>
            <input v-model="config.github.owner" type="text">
          </div>
          <div class="field">
            <label>Repo</label>
            <input v-model="config.github.repo" type="text">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Branch</label>
            <input v-model="config.github.branch" type="text">
          </div>
          <div class="field">
            <label>Workflow</label>
            <input v-model="config.github.workflow_file" type="text">
          </div>
        </div>
      </div>
    </section>

    <section class="actions-panel">
      <button class="btn-primary" :disabled="saving" @click="saveConfig">
        {{ saving ? 'Guardando...' : 'Guardar configuracion' }}
      </button>
      <button class="btn-primary" :disabled="busyAction" @click="exportDataset">
        Exportar dataset
      </button>
      <button class="btn-primary dark" :disabled="busyAction" @click="triggerTraining">
        Disparar entrenamiento
      </button>
    </section>

    <section class="panel status-panel">
      <h3>Estado</h3>
      <div class="status-grid">
        <div><strong>Ultimo export:</strong> {{ formatDate(config.last_exported_at) }}</div>
        <div><strong>Batch:</strong> {{ config.last_export_batch_id || 'N/A' }}</div>
        <div><strong>Filas:</strong> {{ config.last_export_row_count || 0 }}</div>
        <div><strong>S3:</strong> {{ config.last_export_s3_url || 'Sin subida registrada' }}</div>
        <div><strong>Ultimo entrenamiento:</strong> {{ formatDate(config.last_trained_at) }}</div>
        <div><strong>Estado entrenamiento:</strong> {{ config.last_training_status || 'N/A' }}</div>
        <div><strong>Modelo promovido:</strong> {{ config.last_promoted_version || 'N/A' }}</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../services/apiClient';

const defaultConfig = () => ({
  dataset_mode: 'automatic',
  manual_dataset_path: 'backend-api/dataset_telemetria_ci_cd_v3.csv',
  enabled_auto_train: false,
  train_interval_days: 3,
  min_new_records: 30,
  promotion_metric: 'f1',
  min_improvement: 0.01,
  allow_auto_promotion: false,
  export_only_new: true,
  storage: { type: 's3', bucket: 'pro8-model-artifacts-anndrew', region: 'us-east-1' },
  github: { owner: 'senatibuho', repo: 'pro8', branch: 'ci/cd-proyecto', workflow_file: 'retrain.yml' },
  last_exported_at: null,
  last_export_batch_id: null,
  last_export_row_count: 0,
  last_export_s3_url: null,
  last_trained_at: null,
  last_training_status: null,
  last_promoted_version: null
});

const config = reactive(defaultConfig());
const loading = ref(false);
const saving = ref(false);
const busyAction = ref(false);
const message = ref('');
const error = ref('');

const applyConfig = (payload = {}) => {
  Object.assign(config, defaultConfig(), payload);
  config.storage = { ...defaultConfig().storage, ...(payload.storage || {}) };
  config.github = { ...defaultConfig().github, ...(payload.github || {}) };
};

const clearNotices = () => {
  message.value = '';
  error.value = '';
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('es-PE');
};

const loadConfig = async () => {
  loading.value = true;
  clearNotices();
  try {
    applyConfig(await api.getMlConfig());
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const saveConfig = async () => {
  saving.value = true;
  clearNotices();
  try {
    applyConfig(await api.saveMlConfig(config));
    message.value = 'Configuracion guardada.';
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
};

const exportDataset = async () => {
  busyAction.value = true;
  clearNotices();
  try {
    const result = await api.exportMlDataset({ only_new: config.export_only_new });
    message.value = `Dataset exportado: ${result.row_count} filas${result.s3 ? ` -> ${result.s3}` : ' (local)'}.`;
    await loadConfig();
  } catch (err) {
    error.value = err.message;
  } finally {
    busyAction.value = false;
  }
};

const testS3 = async () => {
  busyAction.value = true;
  clearNotices();
  try {
    const result = await api.testS3();
    message.value = `S3 OK: ${result.s3}`;
  } catch (err) {
    error.value = err.message;
  } finally {
    busyAction.value = false;
  }
};

const triggerTraining = async () => {
  busyAction.value = true;
  clearNotices();
  try {
    const result = await api.triggerTraining(config.github);
    message.value = `Workflow solicitado en ${result.owner}/${result.repo} (${result.branch}).`;
    await loadConfig();
  } catch (err) {
    error.value = err.message;
  } finally {
    busyAction.value = false;
  }
};

onMounted(loadConfig);
</script>

<style scoped>
.settings-page { max-width: 1200px; margin: 0 auto; color: #0f172a; }
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.title { margin: 0; font-size: 1.75rem; font-weight: 700; }
.subtitle { margin: 4px 0 0; color: #64748b; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
.panel h3 { margin: 0 0 16px; font-size: 1rem; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
label { font-size: 0.85rem; font-weight: 700; color: #475569; }
input, select { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 0.92rem; background: #ffffff; box-sizing: border-box; width: 100%; }
.check-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; color: #0f172a; }
.check-row input { width: auto; }
.actions-panel { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }
.btn-primary, .btn-secondary { border: 0; border-radius: 6px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
.btn-primary { background: #2563eb; color: white; }
.btn-primary.dark { background: #0f172a; }
.btn-secondary { border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
.alert { padding: 12px 14px; border-radius: 8px; margin-bottom: 14px; font-weight: 600; }
.alert.success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.alert.error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.status-panel { margin-top: 20px; }
.status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; color: #334155; font-size: 0.92rem; overflow-wrap: anywhere; }
@media (max-width: 800px) {
  .settings-grid, .field-row, .status-grid { grid-template-columns: 1fr; }
  .page-header { align-items: flex-start; flex-direction: column; }
}
</style>
