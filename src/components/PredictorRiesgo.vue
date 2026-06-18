<template>
  <div class="predictor-card">
    <div class="header-section">
      <div class="icon-pulse"></div>
      <h3 class="titulo-panel">Indicador de Riesgo Operativo</h3>
    </div>
    <p class="subtitle">CatBoost v3 usa solo señales tempranas del pipeline. No evalúa personas.</p>

    <div class="formulario-grid">
      <div class="form-group">
        <label>Rama activa</label>
        <div class="branch-display">{{ form.branch || 'Sin rama disponible' }}</div>
      </div>

      <div class="form-group">
        <label>Tipo de evento</label>
        <select v-model="form.event_type" class="custom-select">
          <option v-for="eventType in eventTypes" :key="eventType" :value="eventType">{{ eventType }}</option>
        </select>
      </div>

      <div class="form-group">
        <label>Acción del commit</label>
        <select v-model="form.commit_action" class="custom-select">
          <option v-for="action in commitActions" :key="action" :value="action">{{ action }}</option>
        </select>
      </div>

      <div class="form-group">
        <label>Alcance del commit</label>
        <select v-model="form.commit_scope" class="custom-select">
          <option v-for="scope in commitScopes" :key="scope" :value="scope">{{ scope }}</option>
        </select>
      </div>

      <div class="form-group slider-group">
        <div class="label-row">
          <label>Archivos modificados</label>
          <span class="badge" :class="form.files_changed > 8 ? 'badge-danger' : 'badge-safe'">{{ form.files_changed }} archivos</span>
        </div>
        <input type="range" v-model.number="form.files_changed" min="0" :max="sliderLimits.files_changed" :step="Math.max(1, Math.round(sliderLimits.files_changed / 25))" class="custom-slider">
      </div>

      <div class="form-group slider-group">
        <div class="label-row">
          <label>Líneas cambiadas</label>
          <span class="badge" :class="form.lines_changed > 300 ? 'badge-danger' : 'badge-safe'">{{ form.lines_changed }} líneas</span>
        </div>
        <input type="range" v-model.number="form.lines_changed" min="0" :max="sliderLimits.lines_changed" :step="Math.max(5, Math.round(sliderLimits.lines_changed / 40))" class="custom-slider">
        <div class="slider-markers">
          <span>Trivial</span>
          <span>Complejo</span>
          <span>Masivo</span>
        </div>
      </div>

      <div class="form-group">
        <label>Líneas añadidas / eliminadas</label>
        <div class="split-inputs">
          <input v-model.number="form.lines_added" type="number" min="0" class="custom-time" placeholder="Añadidas">
          <input v-model.number="form.lines_deleted" type="number" min="0" class="custom-time" placeholder="Eliminadas">
        </div>
      </div>

      <div class="form-group">
        <label>Día de despliegue</label>
        <div class="days-container">
          <button v-for="day in diasSemana" :key="day.value" @click="form.dia_semana = day.value" :class="['day-pill', form.dia_semana === day.value ? 'active' : '']">
            {{ day.label }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>Hora de despliegue</label>
        <input type="time" v-model="horaFormateada" class="custom-time">
      </div>

      <div class="form-group">
        <label>Familia de rama</label>
        <div class="branch-toggle-grid" role="radiogroup" aria-label="Tipo de rama">
          <button
            v-for="option in branchTypeOptions"
            :key="option.key"
            type="button"
            @click="selectBranchType(option.key)"
            :class="['branch-toggle', selectedBranchType === option.key ? 'active' : '']"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <button @click="evaluarRiesgo" :disabled="cargando" class="btn-evaluar">
        <span v-if="cargando" class="loader"></span>
        <span v-else>Ejecutar Inferencia ML</span>
      </button>
    </div>

    <div v-if="resultado" class="resultado-panel" :class="claseAlerta">
      <div class="resultado-header">
        <h4>{{ resultado.risk_level }} · {{ resultado.risk_decision }}</h4>
      </div>

      <div class="resultado-body">
        <div class="score-circle">
          <h1 class="porcentaje-texto">{{ Math.round((resultado.risk_probability || 0) * 100) }}<span class="percent">%</span></h1>
          <span class="score-label">Riesgo operativo</span>
        </div>

        <div class="factores-analisis">
          <h5>Mensaje clave</h5>
          <ul>
            <li>CatBoost v3 funciona como alerta temprana de despliegue.</li>
            <li>El umbral operativo es 0.45.</li>
            <li>Si el servicio no responde, el deployment sigue guardado y la predicción queda como no disponible.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../services/apiClient';

const diasSemana = [
  { label: 'Lu', value: 1 }, { label: 'Ma', value: 2 }, { label: 'Mi', value: 3 },
  { label: 'Ju', value: 4 }, { label: 'Vi', value: 5 }, { label: 'Sa', value: 6 }, { label: 'Do', value: 7 }
];

const branches = ref([]);
const eventTypes = ref([]);
const commitActions = ref([]);
const commitScopes = ref([]);
const sliderLimits = ref({ files_changed: 0, lines_changed: 0, lines_added: 0, lines_deleted: 0 });

const inferBranchFamily = (branch) => {
  const normalized = String(branch || '').toLowerCase();
  if (!normalized) return 'general';
  if (normalized === 'main') return 'main';
  if (normalized.includes('/')) return normalized.split('/')[0];
  return normalized;
};

const branchTypeOptions = computed(() => {
  const seen = new Set();
  const options = [];

  const formatLabel = (key) => {
    if (key === 'main') return 'Main';
    if (key === 'ci') return 'CI';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  for (const branch of branches.value) {
    const key = inferBranchFamily(branch);
    if (!seen.has(key)) {
      seen.add(key);
      options.push({ key, label: formatLabel(key) });
    }
  }

  return options.sort((left, right) => {
    const priority = { main: 0, hotfix: 1, feature: 2, release: 3, ci: 4 };
    const leftPriority = priority[left.key] ?? 99;
    const rightPriority = priority[right.key] ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.label.localeCompare(right.label);
  });
});

const branchForType = (type) => {
  const normalizedType = String(type || '').toLowerCase();
  const candidate = branches.value.find((branch) => inferBranchFamily(branch) === normalizedType);

  if (candidate) return candidate;

  const prefixedCandidate = branches.value.find((branch) => String(branch || '').toLowerCase().startsWith(`${normalizedType}/`));
  if (prefixedCandidate) return prefixedCandidate;

  return branches.value[0];
};

const form = ref({
  branch: branches.value[0],
  event_type: eventTypes.value[0],
  commit_action: commitActions.value[0],
  commit_scope: commitScopes.value[0],
  files_changed: 0,
  lines_added: 0,
  lines_deleted: 0,
  lines_changed: 0,
  dia_semana: 1,
  hora_dia: 0,
  is_hotfix_branch: false,
  is_feature_branch: false,
  is_main_branch: false
});

const selectedBranchType = ref(inferBranchFamily(form.value.branch));

const syncBranchFlags = (type) => {
  form.value.is_hotfix_branch = type === 'hotfix';
  form.value.is_feature_branch = type === 'feature';
  form.value.is_main_branch = type === 'main';
};

const selectBranchType = (type) => {
  selectedBranchType.value = type;
  form.value.branch = branchForType(type);
  syncBranchFlags(type);
};

const horaFormateada = computed({
  get: () => `${String(form.value.hora_dia).padStart(2, '0')}:00`,
  set: (val) => { form.value.hora_dia = parseInt(val.split(':')[0], 10); }
});

const resultado = ref(null);
const cargando = ref(false);

onMounted(async () => {
  try {
    const options = await api.getMlOptions();
    if (Array.isArray(options.branches) && options.branches.length > 0) branches.value = options.branches;
    if (Array.isArray(options.eventTypes) && options.eventTypes.length > 0) eventTypes.value = options.eventTypes;
    if (Array.isArray(options.commitActions) && options.commitActions.length > 0) commitActions.value = options.commitActions;
    if (Array.isArray(options.commitScopes) && options.commitScopes.length > 0) commitScopes.value = options.commitScopes;
    if (options.limits) sliderLimits.value = { ...sliderLimits.value, ...options.limits };

    if (options.defaults) {
      form.value = { ...form.value, ...options.defaults };
    }

    selectedBranchType.value = inferBranchFamily(form.value.branch);
    syncBranchFlags(selectedBranchType.value);
  } catch (error) {
    console.error('No se pudieron cargar opciones dinámicas de ML:', error);
  }
});

watch(
  () => form.value.branch,
  (branch) => {
    const nextType = inferBranchFamily(branch);
    selectedBranchType.value = nextType;
    syncBranchFlags(nextType);
  }
);

const evaluarRiesgo = async () => {
  cargando.value = true;
  resultado.value = null;

  try {
    resultado.value = await api.predictRisk(form.value);
  } catch (error) {
    console.error(error);
    alert('Error conectando con el servicio de predicción.');
  } finally {
    cargando.value = false;
  }
};

const claseAlerta = computed(() => {
  if (!resultado.value) return '';
  const probability = Number(resultado.value.risk_probability || 0);
  if (probability >= 0.70) return 'alerta-roja';
  if (probability >= 0.40) return 'alerta-amarilla';
  return 'alerta-verde';
});
</script>

<style scoped>
.predictor-card {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-text-main: #0f172a;
  --color-text-muted: #64748b;
  --color-bg-card: #ffffff;
  --color-border: #e2e8f0;

  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  color: var(--color-text-main);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  width: 94%;
}

.header-section { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.icon-pulse { width: 10px; height: 10px; background-color: var(--color-primary); border-radius: 50%; box-shadow: 0 0 10px var(--color-primary); animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }

.titulo-panel { margin: 0; font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; }
.subtitle { font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0; margin-bottom: 24px; }

.formulario-grid { display: flex; flex-direction: column; gap: 20px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
label { font-size: 0.85rem; color: var(--color-text-main); font-weight: 600; display: flex; align-items: center; gap: 6px;}

.custom-select, .custom-time { background-color: #f8fafc; border: 1px solid var(--color-border); color: var(--color-text-main); padding: 10px; border-radius: 8px; font-size: 0.9rem; outline: none; transition: all 0.2s; }
.custom-select:focus, .custom-time:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.branch-display { background-color: #f8fafc; border: 1px solid var(--color-border); color: var(--color-text-main); padding: 10px; border-radius: 8px; font-size: 0.9rem; min-height: 42px; display: flex; align-items: center; }

.split-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.label-row { display: flex; justify-content: space-between; align-items: center; }
.badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 700; }
.badge-safe { background: #e0f2fe; color: #0369a1; }
.badge-danger { background: #fee2e2; color: #b91c1c; }
.custom-slider { width: 100%; accent-color: var(--color-primary); cursor: pointer; }
.slider-markers { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--color-text-muted); margin-top: -4px;}
.days-container { display: flex; gap: 6px; justify-content: space-between; }
.day-pill { flex: 1; padding: 8px 0; border: 1px solid var(--color-border); background: #f8fafc; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); transition: all 0.2s; }
.day-pill:hover { border-color: var(--color-primary); }
.day-pill.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.branch-toggle-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.branch-toggle { border: 1px solid var(--color-border); background: #f8fafc; color: var(--color-text-muted); padding: 10px 8px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
.branch-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }
.branch-toggle.active { background: var(--color-primary); border-color: var(--color-primary); color: white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.btn-evaluar { background-color: var(--color-text-main); color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: 0.2s; margin-top: 10px; display: flex; justify-content: center;}
.btn-evaluar:hover:not(:disabled) { background-color: #1e293b; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

.resultado-panel { margin-top: 24px; border-radius: 12px; border: 2px solid var(--color-border); animation: slideDown 0.4s ease; overflow: hidden; }
.resultado-header { padding: 12px; text-align: center; font-weight: 800; font-size: 1.1rem;}
.resultado-body { padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; background: #fafafa;}
.score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 4px solid var(--color-border); }
.porcentaje-texto { margin: 0; font-size: 2.5rem; font-weight: 900; line-height: 1; }
.percent { font-size: 1.2rem; }
.score-label { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); }
.factores-analisis { width: 100%; background: white; padding: 16px; border-radius: 8px; border: 1px solid var(--color-border); }
.factores-analisis h5 { margin: 0 0 10px 0; font-size: 0.85rem; color: var(--color-text-muted); text-transform: uppercase; }
.factores-analisis ul { margin: 0; padding-left: 0; list-style: none; font-size: 0.85rem; display: flex; flex-direction: column; gap: 8px; }
.alerta-verde { border-color: var(--color-success); }
.alerta-verde .resultado-header { background-color: #d1fae5; color: #065f46; }
.alerta-verde .score-circle { border-color: var(--color-success); color: var(--color-success); }
.alerta-amarilla { border-color: var(--color-warning); }
.alerta-amarilla .resultado-header { background-color: #fef3c7; color: #92400e; }
.alerta-amarilla .score-circle { border-color: var(--color-warning); color: var(--color-warning); }
.alerta-roja { border-color: var(--color-danger); }
.alerta-roja .resultado-header { background-color: #fee2e2; color: #991b1b; }
.alerta-roja .score-circle { border-color: var(--color-danger); color: var(--color-danger); }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>