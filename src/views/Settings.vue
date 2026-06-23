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
        <div :class="['mode-banner', config.dataset_mode === 'manual' ? 'manual' : 'automatic']">
          <strong>{{ config.dataset_mode === 'manual' ? 'Modo CSV manual activo' : 'Modo automatico activo' }}</strong>
          <span>{{ config.dataset_mode === 'manual' ? 'Se entrenara con el CSV cargado.' : 'Se exportaran registros guardados desde MongoDB.' }}</span>
        </div>

        <div class="field">
          <label>Fuente del dataset</label>
          <div class="segmented-control">
            <button
              type="button"
              :class="['segment-option', config.dataset_mode === 'automatic' ? 'active' : '']"
              @click="config.dataset_mode = 'automatic'"
            >
              Automatico
            </button>
            <button
              type="button"
              :class="['segment-option', config.dataset_mode === 'manual' ? 'active' : '']"
              @click="config.dataset_mode = 'manual'"
            >
              CSV manual
            </button>
          </div>
        </div>

        <div class="field">
          <label>Nombre del CSV</label>
          <input v-model="config.dataset_export_name" type="text" placeholder="dataset_entrenamiento_pro8">
          <p class="muted-note inline">Se usara para guardar el archivo en S3. Si lo dejas vacio, se genera uno automatico.</p>
        </div>

        <div v-if="config.dataset_mode === 'manual'" class="field">
          <label>Subir CSV de entrenamiento</label>
          <label class="upload-box">
            <input type="file" accept=".csv,text/csv" @change="handleDatasetFile">
            <span>{{ selectedDatasetName || 'Seleccionar archivo CSV' }}</span>
          </label>
          <p class="muted-note inline">El CSV se guarda en el backend y luego se publica como dataset activo para entrenamiento.</p>
          <div v-if="config.manual_dataset_path" class="static-value compact">{{ config.manual_dataset_path }}</div>
        </div>

        <label v-if="config.dataset_mode === 'automatic'" class="check-row">
          <input v-model="config.export_only_new" type="checkbox">
          <span>Exportar solo registros nuevos</span>
        </label>
      </div>

      <div class="panel">
        <h3>Entrenamiento</h3>
        <div class="model-status">
          <span :class="['status-dot', modelStatus.model_source === 's3' ? 'auto' : 'manual']"></span>
          <div>
            <strong>Modelo actual activo: {{ modelStatus.model_source === 's3' ? 'Automatico desde S3' : 'Manual/local' }}</strong>
            <small>{{ modelStatus.model_version || modelStatus.ml_status || 'Sin estado disponible' }}</small>
          </div>
        </div>

        <div class="field">
          <label>Usar modelo para prediccion</label>
          <div class="segmented-control">
            <button
              type="button"
              :class="['segment-option', config.active_model_mode === 'manual' ? 'active' : '']"
              @click="config.active_model_mode = 'manual'"
            >
              Manual/local
            </button>
            <button
              type="button"
              :class="['segment-option', config.active_model_mode === 'automatic' ? 'active' : '']"
              @click="config.active_model_mode = 'automatic'"
            >
              Automatico/S3
            </button>
          </div>
          <p class="muted-note inline">En automatico usa el ultimo modelo promovido en S3.</p>
        </div>

        <div v-if="config.active_model_mode === 'manual'" class="manual-model-note">
          <strong>Entrenamiento automatico en pausa</strong>
          <span>El widget usara el modelo local cargado por el servicio de IA. Puedes seguir exportando datasets sin cambiar el modelo activo.</span>
        </div>

        <template v-else>
        <div class="field-row">
          <div class="field">
            <label>Reentrenar cada</label>
            <div class="inline-number">
              <input v-model.number="config.train_interval_days" type="number" min="1">
              <span>dias</span>
            </div>
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
          <span>Entrenamiento automatico activo</span>
        </label>

        <label class="check-row">
          <input v-model="config.allow_auto_promotion" type="checkbox">
          <span>Permitir promocion automatica si supera validacion</span>
        </label>
        </template>
      </div>

      <div class="panel">
        <h3>S3</h3>
        <div class="field">
          <label>Bucket</label>
          <div class="static-value">{{ config.storage.bucket || 'No configurado' }}</div>
        </div>
        <div class="field">
          <label>Region</label>
          <div class="static-value">{{ config.storage.region || 'No configurada' }}</div>
        </div>
        <p class="muted-note">Estos valores vienen de backend-api/.env.</p>
        <button class="btn-secondary" :disabled="busyAction" @click="testS3">Probar S3</button>
      </div>

      <div class="panel">
        <h3>GitHub Actions</h3>
        <div class="integration-summary">
          <strong>{{ config.github.owner || 'owner' }}/{{ config.github.repo || 'repo' }}</strong>
          <span>{{ config.github.branch || 'branch' }} · {{ config.github.workflow_file || 'workflow' }}</span>
        </div>
        <p class="muted-note">Destino del entrenamiento configurado en el backend.</p>
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
  manual_dataset_path: '',
  dataset_export_name: '',
  active_model_mode: 'manual',
  enabled_auto_train: false,
  train_interval_days: 3,
  min_new_records: 30,
  promotion_metric: 'f1',
  min_improvement: 0.01,
  allow_auto_promotion: false,
  export_only_new: true,
  storage: { type: 's3', bucket: '', region: '' },
  github: { owner: '', repo: '', branch: '', workflow_file: '' },
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
const selectedDatasetName = ref('');
const modelStatus = reactive({
  model_source: '',
  model_version: '',
  ml_status: ''
});

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

const editableConfigPayload = () => ({
  dataset_mode: config.dataset_mode,
  manual_dataset_path: config.manual_dataset_path,
  dataset_export_name: config.dataset_export_name,
  active_model_mode: config.active_model_mode,
  enabled_auto_train: config.enabled_auto_train,
  export_only_new: config.export_only_new,
  train_interval_days: config.train_interval_days,
  min_new_records: config.min_new_records,
  promotion_metric: config.promotion_metric,
  min_improvement: config.min_improvement,
  allow_auto_promotion: config.allow_auto_promotion
});

const loadConfig = async ({ clear = true } = {}) => {
  loading.value = true;
  if (clear) clearNotices();
  try {
    applyConfig(await api.getMlConfig());
    try {
      Object.assign(modelStatus, await api.getModelStatus());
    } catch (statusError) {
      Object.assign(modelStatus, {
        model_source: '',
        model_version: '',
        ml_status: statusError.message
      });
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const handleDatasetFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  busyAction.value = true;
  clearNotices();
  selectedDatasetName.value = file.name;

  try {
    const content = await file.text();
    const result = await api.uploadManualDataset({
      filename: file.name,
      content
    });
    await loadConfig({ clear: false });
    message.value = `Dataset manual cargado: ${result.row_count} filas (${result.file_name}).`;
  } catch (err) {
    error.value = err.message;
    selectedDatasetName.value = '';
  } finally {
    busyAction.value = false;
    event.target.value = '';
  }
};

const saveConfig = async () => {
  saving.value = true;
  clearNotices();
  try {
    const result = await api.saveMlConfig(editableConfigPayload());
    applyConfig(result);
    if (result.model_sync_error) {
      error.value = `Configuracion guardada, pero no se pudo activar el modelo: ${JSON.stringify(result.model_sync_error)}`;
    } else {
      message.value = 'Configuracion guardada y modelo sincronizado.';
    }
    await loadConfig({ clear: false });
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
    const result = await api.exportMlDataset({
      only_new: config.export_only_new,
      export_name: config.dataset_export_name
    });
    await loadConfig({ clear: false });
    message.value = `Dataset exportado (${result.csv_file_name}): ${result.row_count} filas${result.s3 ? ` -> ${result.s3}` : ' (local)'}.`;
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
    const result = await api.triggerTraining();
    message.value = `Workflow solicitado en ${result.owner}/${result.repo} (${result.branch}).`;
    await loadConfig({ clear: false });
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
.panel { background: #ffffff; border: 1px solid #d9d9e8; border-radius: 8px; padding: 20px; }
.panel h3 { margin: 0 0 16px; font-size: 1rem; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
label { font-size: 0.85rem; font-weight: 700; color: #2c5998; }
input, select { border: 1px solid #bbd2ef; border-radius: 6px; padding: 10px; font-size: 0.92rem; background: #ffffff; box-sizing: border-box; width: 100%; }
.static-value { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 0.92rem; background: #f8fafc; color: #0f172a; min-height: 41px; box-sizing: border-box; overflow-wrap: anywhere; }
.static-value.compact { min-height: auto; padding: 8px 10px; font-size: 0.82rem; color: #475569; }
.muted-note { margin: -4px 0 14px; color: #64748b; font-size: 0.82rem; line-height: 1.4; }
.muted-note.inline { margin: 0; }
.mode-banner { border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px; border: 1px solid; }
.mode-banner strong { font-size: 0.92rem; }
.mode-banner span { font-size: 0.82rem; }
.mode-banner.automatic { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
.mode-banner.manual { background: #f0fdf4; border-color: #86efac; color: #166534; }
.model-status { border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 12px; margin-bottom: 16px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; }
.model-status strong { display: block; font-size: 0.92rem; color: #0f172a; }
.model-status small { display: block; margin-top: 2px; color: #64748b; overflow-wrap: anywhere; }
.manual-model-note { border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.manual-model-note strong { font-size: 0.92rem; }
.manual-model-note span { font-size: 0.82rem; line-height: 1.4; }
.status-dot { width: 11px; height: 11px; border-radius: 999px; display: inline-block; }
.status-dot.manual { background: #22c55e; box-shadow: 0 0 0 4px #dcfce7; }
.status-dot.auto { background: #2563eb; box-shadow: 0 0 0 4px #dbeafe; }
.segmented-control { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px; background: #f8fafc; gap: 4px; }
.segment-option { border: 0; border-radius: 6px; padding: 10px; background: transparent; color: #475569; font-weight: 800; cursor: pointer; }
.segment-option.active { background: #0f172a; color: #ffffff; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.16); }
.upload-box { border: 1px dashed #94a3b8; border-radius: 8px; background: #f8fafc; color: #0f172a; padding: 16px; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.upload-box:hover { border-color: #2563eb; background: #eff6ff; }
.upload-box input { display: none; }
.inline-number { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.inline-number span { color: #64748b; font-weight: 700; }
.integration-summary { border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 12px; display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
.integration-summary span { color: #64748b; font-size: 0.86rem; }
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
