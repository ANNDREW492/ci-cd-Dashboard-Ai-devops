<template>
  <div class="predictor-card">
    <div class="header-section">
      <div class="icon-pulse"></div>
      <h3 class="titulo-panel">Motor de Riesgo Predictivo</h3>
    </div>
    <p class="subtitle">Evaluación de parámetros de despliegue mediante Random Forest</p>
    
    <div class="formulario-grid">
      
      <div class="form-group">
        <label> Perfil del Desarrollador</label>
        <select v-model="form.actor" class="custom-select">
          <option value="ANNDREW492">ANNDREW492 (Historial: Senior / Alta Tasa Éxito)</option>
          <option value="maria_backend">maria_backend (Historial: Senior / Backend)</option>
          <option value="carlos_dev">carlos_dev (Historial: Mid / Fullstack)</option>
          <option value="junior_juan">junior_juan (Historial: Junior / Riesgo Moderado)</option>
        </select>
      </div>

      <div class="form-group">
        <label> Rama de Destino</label>
        <select v-model="form.branch" class="custom-select">
          <option value="main">main (Entorno de Producción)</option>
          <option value="feature/pagos">feature/pagos (Aislamiento)</option>
          <option value="ci/cd-proyecto">ci/cd-proyecto (Infraestructura)</option>
          <option value="hotfix/urgente">hotfix/urgente (Alta Prioridad)</option>
        </select>
      </div>

      <div class="form-group slider-group">
        <div class="label-row">
          <label>Volumen de Modificación</label>
          <span class="badge" :class="form.lines_changed > 300 ? 'badge-danger' : 'badge-safe'">
            {{ form.lines_changed }} líneas
          </span>
        </div>
        <input type="range" v-model="form.lines_changed" min="1" max="1000" class="custom-slider">
        <div class="slider-markers">
          <span>Trivial</span>
          <span>Complejo</span>
          <span>Masivo</span>
        </div>
      </div>

      <div class="form-group">
        <label> Ventana de Despliegue (Día)</label>
        <div class="days-container">
          <button v-for="(day, index) in diasSemana" :key="index" 
                  @click="form.dia_semana = day.value"
                  :class="['day-pill', form.dia_semana === day.value ? 'active' : '']">
            {{ day.label }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label> Hora del Despliegue</label>
        <input type="time" v-model="horaFormateada" class="custom-time">
      </div>

      <button @click="evaluarRiesgo" :disabled="cargando" class="btn-evaluar">
        <span v-if="cargando" class="loader"></span>
        <span v-else>Ejecutar Inferencia ML</span>
      </button>
    </div>

    <div v-if="resultado" class="resultado-panel" :class="claseAlerta">
      <div class="resultado-header">
        <h4>Veredicto: {{ resultado.veredicto }}</h4>
      </div>
      
      <div class="resultado-body">
        <div class="score-circle">
          <h1 class="porcentaje-texto">{{ Math.round(resultado.riesgo_porcentaje) }}<span class="percent">%</span></h1>
          <span class="score-label">Riesgo</span>
        </div>
        
        <div class="factores-analisis">
          <h5>Factores Detectados por la IA:</h5>
          <ul>
            <li v-if="form.lines_changed > 300"> Volumen masivo de código aumenta inestabilidad.</li>
            <li v-if="form.dia_semana >= 5 && form.hora_dia >= 16"> Riesgo extremo: Despliegue en fin de semana/noche.</li>
            <li v-if="form.branch === 'hotfix/urgente'"> Despliegue rápido en rama crítica.</li>
            <li v-if="form.actor === 'junior_juan'"> El historial del autor requiere revisión por pares.</li>
            <li v-if="form.lines_changed <= 50 && form.dia_semana < 5"> Ventana de tiempo y volumen óptimos.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const diasSemana = [
  { label: 'Lu', value: 1 }, { label: 'Ma', value: 2 }, { label: 'Mi', value: 3 },
  { label: 'Ju', value: 4 }, { label: 'Vi', value: 5 }, { label: 'Sa', value: 6 }, { label: 'Do', value: 7 }
];

const form = ref({
  actor: 'ANNDREW492',
  branch: 'main',
  lines_changed: 120,
  execution_time_seg: 35, 
  dia_semana: 3, 
  hora_dia: 10 
});

// Manejo visual de la hora
const horaFormateada = computed({
  get: () => `${form.value.hora_dia.toString().padStart(2, '0')}:00`,
  set: (val) => { form.value.hora_dia = parseInt(val.split(':')[0]); }
});

const resultado = ref(null);
const cargando = ref(false);

const evaluarRiesgo = async () => {
  cargando.value = true;
  resultado.value = null;

  try {
    const response = await fetch('http://localhost:8000/api/predict-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });

    if (!response.ok) throw new Error('Fallo al conectar');
    resultado.value = await response.json();
    
  } catch (error) {
    console.error(error);
    alert('Error conectando con la IA de FastAPI.');
  } finally {
    cargando.value = false;
  }
};

const claseAlerta = computed(() => {
  if (!resultado.value) return '';
  if (resultado.value.riesgo_porcentaje >= 75) return 'alerta-roja';
  if (resultado.value.riesgo_porcentaje >= 40) return 'alerta-amarilla';
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
  width: 100%;
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

/* Slider Styling */
.label-row { display: flex; justify-content: space-between; align-items: center; }
.badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 700; }
.badge-safe { background: #e0f2fe; color: #0369a1; }
.badge-danger { background: #fee2e2; color: #b91c1c; }
.custom-slider { width: 100%; accent-color: var(--color-primary); cursor: pointer; }
.slider-markers { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--color-text-muted); margin-top: -4px;}

/* Days Pills */
.days-container { display: flex; gap: 6px; justify-content: space-between; }
.day-pill { flex: 1; padding: 8px 0; border: 1px solid var(--color-border); background: #f8fafc; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); transition: all 0.2s; }
.day-pill:hover { border-color: var(--color-primary); }
.day-pill.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.btn-evaluar { background-color: var(--color-text-main); color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: 0.2s; margin-top: 10px; display: flex; justify-content: center;}
.btn-evaluar:hover:not(:disabled) { background-color: #1e293b; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

/* Results */
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