<template>
  <div class="ai-container">
    <header class="page-header">
      <div>
        <h1 class="title">Análisis Semántico (IA)</h1>
        <p class="subtitle">Resolución de errores de CI/CD asistida por Inteligencia Artificial</p>
      </div>
    </header>

    <div class="analysis-grid">
      <div class="panel input-panel">
        <div class="panel-header-flex">
          <h3 class="panel-title">Contexto de Telemetría</h3>
          <div v-if="commitHash" class="badges">
            <span class="badge branch">{{ branchName }}</span>
            <span class="badge commit">📄 {{ commitHash.substring(0, 7) }}</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>Repositorio Afectado</label>
          <select 
            v-model="repository" 
            class="form-control" 
            :disabled="fetchLoading"
          >
            <option value="" disabled>Selecciona un repositorio...</option>
            <option v-for="repo in availableRepositories" :key="repo" :value="repo">
              {{ repo }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Log de Error (Consola)</label>
          <div v-if="fetchLoading" class="log-loader">Obteniendo error desde la base de datos...</div>
          <textarea 
            v-else
            v-model="errorLog" 
            class="form-control log-textarea" 
            placeholder="Pega aquí todo el texto rojo o el error de compilación que arrojó el pipeline..."
          ></textarea>
        </div>

        <button 
          class="btn-primary" 
          @click="analyzeWithAI" 
          :disabled="loading || fetchLoading || !errorLog || !repository"
        >
          <span v-if="loading" class="spinner">Consultando al modelo...</span>
          <span v-else>Analizar Error con IA</span>
        </button>

        <div v-if="error" class="alert-error">
          {{ error }}
        </div>
      </div>

      <div class="panel result-panel">
        <h3 class="panel-title">Diagnóstico</h3>
        
        <div v-if="loading || fetchLoading" class="skeleton-loader">
          <div class="line"></div>
          <div class="line"></div>
          <div class="line short"></div>
        </div>

        <div v-else-if="aiResult" class="ai-response">
          <p class="response-text">{{ aiResult }}</p>
        </div>

        <div v-else class="empty-state">
          Selecciona un repositorio y proporciona un log para comenzar.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Variables de estado
const repository = ref('');
const availableRepositories = ref([]); // Lista dinámica
const errorLog = ref('');
const commitHash = ref('');
const branchName = ref('');

const loading = ref(false);
const fetchLoading = ref(false); 
const aiResult = ref('');
const error = ref(null);

onMounted(async () => {
  await loadAvailableRepositories();
  const logId = route.query.logId;
  if (logId) {
    await loadLogFromDatabase(logId);
  } else if (availableRepositories.value.length > 0) {
    repository.value = availableRepositories.value[0];
  }
});

// Función pextraer repositorios únicos de la BD
const loadAvailableRepositories = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/logs');
    if (response.ok) {
      const data = await response.json();
      const repos = data.map(log => log.repository);
      availableRepositories.value = [...new Set(repos)];
    }
  } catch (err) {
    console.error("Error al cargar la lista de repositorios:", err);
  }
};

const loadLogFromDatabase = async (id) => {
  fetchLoading.value = true;
  try {
    const response = await fetch(`http://localhost:3000/api/logs/${id}`);
    if (!response.ok) throw new Error('No se pudo recuperar el log de la base de datos.');
    
    const data = await response.json();
    
    // Al setear el value aquí, el <select> se actualiza automáticamente a la opción correcta
    repository.value = data.repository;
    commitHash.value = data.commit;
    branchName.value = data.branch;
    
    if (data.errorLog) {
      errorLog.value = data.errorLog;
      await analyzeWithAI();
    } else {
      errorLog.value = "El pipeline falló, pero no se capturó texto de error en la base de datos para este despliegue. Posible fallo interno de GitHub Actions (ej. Set up job).";
    }

  } catch (err) {
    error.value = err.message;
  } finally {
    fetchLoading.value = false;
  }
};

const analyzeWithAI = async () => {
  if (!errorLog.value || !repository.value) return;
  
  loading.value = true;
  error.value = null;
  aiResult.value = '';

  try {
    const response = await fetch('http://127.0.0.1:8000/api/analyze-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error_log: errorLog.value,
        repository: repository.value
      })
    });

    if (!response.ok) throw new Error('Error al comunicarse con el Cerebro de IA.');

    const data = await response.json();
    aiResult.value = data.analysis;
    
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>

.ai-container {
  --color-primary: #3b82f6;
  --color-ai: #6366f1;
  --color-text-main: #0f172a;
  --color-text-muted: #64748b;
  --color-bg-card: #ffffff;
  --color-border: #e2e8f0;
  
  max-width: 1200px;
  margin: 0 auto;
  color: var(--color-text-main);
}

.page-header { margin-bottom: 32px; }
.title { font-size: 1.75rem; font-weight: 700; margin: 0; }
.subtitle { color: var(--color-text-muted); font-size: 0.95rem; margin: 4px 0 0 0; }

.analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 768px) { .analysis-grid { grid-template-columns: 1fr; } }

.panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  display: flex;
  flex-direction: column;
}

.panel-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 12px;
  margin-bottom: 20px;
}

.panel-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.badges { display: flex; gap: 8px; }
.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: #f1f5f9;
  color: var(--color-text-muted);
}
.badge.branch { color: #3b82f6; background-color: #eff6ff; }

.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: var(--color-text-muted); }

.form-control { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 6px; font-family: inherit; font-size: 0.95rem; transition: border-color 0.2s; box-sizing: border-box; background-color: white;}
select.form-control { cursor: pointer; appearance: auto; }
.form-control:focus { outline: none; border-color: var(--color-ai); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
.form-control:disabled { background-color: #f1f5f9; cursor: not-allowed; }

.log-textarea { min-height: 200px; font-family: ui-monospace, monospace; font-size: 0.85rem; resize: vertical; background-color: #f8fafc; }
.log-loader { padding: 20px; text-align: center; color: var(--color-text-muted); font-size: 0.9rem; background-color: #f8fafc; border-radius: 6px; border: 1px dashed var(--color-border); }

.btn-primary { background-color: var(--color-ai); color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background-color 0.2s; display: flex; justify-content: center; align-items: center; }
.btn-primary:hover:not(:disabled) { background-color: #4f46e5; }
.btn-primary:disabled { background-color: #a5b4fc; cursor: not-allowed; }

.alert-error { margin-top: 16px; padding: 12px; background-color: #fef2f2; color: #ef4444; border: 1px solid #f87171; border-radius: 6px; font-size: 0.9rem; }

.result-panel { background-color: #f8fafc; }
.empty-state { flex-grow: 1; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-size: 0.95rem; text-align: center; padding: 40px; border: 2px dashed var(--color-border); border-radius: 8px; }

.ai-response { background-color: white; padding: 20px; border-radius: 8px; border: 1px solid var(--color-border); border-left: 4px solid var(--color-ai); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.response-text { white-space: pre-line; line-height: 1.6; margin: 0; font-size: 0.95rem; color: #334155; }

.skeleton-loader { display: flex; flex-direction: column; gap: 12px; }
.line { height: 16px; background: linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; border-radius: 4px; }
.line.short { width: 60%; }
@keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

</style>