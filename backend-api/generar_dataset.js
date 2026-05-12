const fs = require('fs');
const seedrandom = require('seedrandom');

const rng = seedrandom('tesis-cicd-catboost-v3-2026');

function random() {
  return rng();
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function int(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const actors = [
  'anndrew492',
  'carlos_dev',
  'maria_backend',
  'junior_juan'
];

const branches = [
  'main',
  'ci/cd-proyecto',
  'feature/pagos',
  'feature/dashboard',
  'feature/api',
  'hotfix/urgente',
  'release/v1'
];

const eventTypes = ['push', 'pull_request'];

const commitActions = [
  'fix',
  'update',
  'add',
  'refactor',
  'remove',
  'merge',
  'rollback'
];

const commitScopes = [
  'login',
  'auth',
  'api',
  'frontend',
  'dashboard',
  'docker',
  'database',
  'migration',
  'dependencies',
  'environment',
  'tests',
  'security',
  'billing'
];

const logCategories = [
  'none',
  'test',
  'dependency',
  'docker',
  'database',
  'security',
  'syntax',
  'timeout',
  'runtime',
  'env'
];

const failedJobs = [
  'none',
  'quality-and-testing',
  'security-and-build',
  'telemetry-dispatch'
];

const header = [
  'commit_hash',
  'actor',
  'branch',
  'commit_message',
  'event_type',
  'files_changed',
  'lines_added',
  'lines_deleted',
  'lines_changed',
  'execution_time_seg',
  'test_duration_sec',
  'build_duration_sec',
  'failed_job_name',
  'failed_steps_count',
  'log_category',
  'dia_semana',
  'hora_dia',
  'is_weekend',
  'is_hotfix_branch',
  'is_feature_branch',
  'is_main_branch',
  'has_docker_change',
  'has_db_change',
  'has_api_change',
  'has_frontend_change',
  'has_login_change',
  'has_dependency_change',
  'has_env_change',
  'has_migration_change',
  'commit_action',
  'commit_scope',
  'risk_score_synthetic',
  'status'
];

let csvContent = `${header.join(',')}\n`;

for (let i = 0; i < 3000; i++) {
  const actor = pick(actors);
  const branch = pick(branches);
  const eventType = pick(eventTypes);
  const commitAction = pick(commitActions);
  const commitScope = pick(commitScopes);

  const isHotfixBranch = branch.includes('hotfix') ? 1 : 0;
  const isFeatureBranch = branch.includes('feature') ? 1 : 0;
  const isMainBranch = branch === 'main' ? 1 : 0;

  const diaSemana = int(1, 7);
  const horaDia = int(0, 23);
  const isWeekend = diaSemana >= 6 ? 1 : 0;
  const isNight = horaDia >= 20 || horaDia <= 5;

  let filesChanged = int(1, 18);

  if (isHotfixBranch) filesChanged += int(1, 5);
  if (commitScope === 'database' || commitScope === 'migration') filesChanged += int(1, 6);
  if (commitScope === 'dependencies') filesChanged += int(1, 5);
  if (commitScope === 'frontend' || commitScope === 'dashboard') filesChanged += int(0, 4);

  const linesAdded = int(5, 650);
  const linesDeleted = int(0, 360);
  const linesChanged = linesAdded + linesDeleted;

  let testDuration = int(15, 220);
  let buildDuration = int(20, 260);

  if (linesChanged > 500) {
    testDuration += int(30, 130);
    buildDuration += int(25, 110);
  }

  if (commitScope === 'docker' || commitScope === 'dependencies') {
    buildDuration += int(35, 150);
  }

  if (commitScope === 'database' || commitScope === 'migration') {
    testDuration += int(35, 140);
  }

  const executionTime = testDuration + buildDuration + int(5, 90);

  const hasDockerChange = commitScope === 'docker' ? 1 : 0;
  const hasDbChange = commitScope === 'database' ? 1 : 0;
  const hasApiChange = commitScope === 'api' ? 1 : 0;
  const hasFrontendChange = commitScope === 'frontend' || commitScope === 'dashboard' ? 1 : 0;
  const hasLoginChange = commitScope === 'login' || commitScope === 'auth' ? 1 : 0;
  const hasDependencyChange = commitScope === 'dependencies' ? 1 : 0;
  const hasEnvChange = commitScope === 'environment' ? 1 : 0;
  const hasMigrationChange = commitScope === 'migration' ? 1 : 0;

  const criticalComponents = [
    hasDockerChange,
    hasDbChange,
    hasMigrationChange,
    hasDependencyChange,
    hasEnvChange,
    hasLoginChange,
    hasApiChange
  ];

  const criticalCount = criticalComponents.reduce((sum, value) => sum + value, 0);

  /*
   * Risk score sintético:
   * Se usa solo para generar el status del dataset artificial.
   * NO debe usarse como variable de entrenamiento del modelo.
   */
  let risk = 0.08;

  // Tipo de evento
  if (eventType === 'push') risk += 0.05;
  if (eventType === 'pull_request') risk -= 0.05;

  // Riesgo por rama
  if (isHotfixBranch) risk += 0.18;
  if (isMainBranch && eventType === 'push') risk += 0.12;
  if (isFeatureBranch) risk -= 0.05;

  // Tamaño del cambio
  if (filesChanged >= 8) risk += 0.05;
  if (filesChanged >= 14) risk += 0.08;

  if (linesChanged >= 300) risk += 0.07;
  if (linesChanged >= 600) risk += 0.10;
  if (linesChanged >= 900) risk += 0.12;

  // Componentes críticos
  if (criticalCount >= 1) risk += 0.10;
  if (criticalCount >= 2) risk += 0.12;

  // Riesgo específico por tipo de componente
  if (hasDockerChange) risk += 0.10;
  if (hasDependencyChange) risk += 0.12;
  if (hasMigrationChange) risk += 0.12;
  if (hasEnvChange) risk += 0.10;
  if (hasDbChange) risk += 0.08;
  if (hasLoginChange) risk += 0.07;
  if (hasApiChange) risk += 0.05;

  // Acción del commit
  if (commitAction === 'rollback') risk += 0.15;
  if (commitAction === 'fix' && isHotfixBranch) risk += 0.10;
  if (commitAction === 'merge' && isMainBranch) risk += 0.08;
  if (commitAction === 'refactor' && linesChanged >= 500) risk += 0.08;
  if (commitAction === 'remove' && criticalCount >= 1) risk += 0.07;

  // Horario operativo
  if (isWeekend) risk += 0.06;
  if (isNight) risk += 0.05;
  if (isWeekend && isNight) risk += 0.06;

  // Interacciones de riesgo
  if (isHotfixBranch && linesChanged >= 300) risk += 0.10;
  if (isMainBranch && eventType === 'push' && criticalCount >= 1) risk += 0.12;
  if (criticalCount >= 1 && linesChanged >= 600) risk += 0.12;
  if (hasMigrationChange && hasDbChange) risk += 0.08;
  if (hasDockerChange && hasEnvChange) risk += 0.08;
  if (hasDependencyChange && eventType === 'push') risk += 0.07;

  // Factores protectores
  if (eventType === 'pull_request' && !isHotfixBranch && criticalCount === 0) risk -= 0.10;
  if (isFeatureBranch && linesChanged < 250 && criticalCount === 0) risk -= 0.12;
  if (filesChanged <= 3 && linesChanged < 120 && criticalCount === 0) risk -= 0.10;
  if (commitAction === 'add' && commitScope === 'frontend' && criticalCount === 0) risk -= 0.06;
  if (commitAction === 'update' && commitScope === 'dashboard' && linesChanged < 300) risk -= 0.05;

  // Ruido controlado para evitar reglas perfectas
  risk += (random() - 0.5) * 0.18;

  risk = clamp(risk, 0.03, 0.92);

  const status = risk >= 0.45 ? 'failure' : 'success';

  /*
   * Las siguientes columnas se generan para diagnóstico posterior,
   * dashboard y análisis semántico. No deben usarse en el modelo
   * de predicción temprana.
   */
  let logCategory = 'none';
  let failedJobName = 'none';
  let failedStepsCount = 0;

  if (status === 'failure') {
    if (hasDependencyChange) logCategory = 'dependency';
    else if (hasDockerChange) logCategory = 'docker';
    else if (hasDbChange || hasMigrationChange) logCategory = 'database';
    else if (commitScope === 'security') logCategory = 'security';
    else if (executionTime > 520) logCategory = 'timeout';
    else if (commitScope === 'tests') logCategory = 'test';
    else logCategory = pick(logCategories.filter(c => c !== 'none'));

    if (['test', 'database', 'syntax', 'runtime'].includes(logCategory)) {
      failedJobName = 'quality-and-testing';
    } else if (['docker', 'dependency', 'security'].includes(logCategory)) {
      failedJobName = 'security-and-build';
    } else {
      failedJobName = pick(failedJobs.filter(j => j !== 'none'));
    }

    failedStepsCount = int(1, 5);
  }

  const commitMessage = `${commitAction} ${commitScope} module`;
  const commitHash = Math.random().toString(16).substring(2, 10);

  const row = [
    commitHash,
    actor,
    branch,
    commitMessage,
    eventType,
    filesChanged,
    linesAdded,
    linesDeleted,
    linesChanged,
    executionTime,
    testDuration,
    buildDuration,
    failedJobName,
    failedStepsCount,
    logCategory,
    diaSemana,
    horaDia,
    isWeekend,
    isHotfixBranch,
    isFeatureBranch,
    isMainBranch,
    hasDockerChange,
    hasDbChange,
    hasApiChange,
    hasFrontendChange,
    hasLoginChange,
    hasDependencyChange,
    hasEnvChange,
    hasMigrationChange,
    commitAction,
    commitScope,
    risk.toFixed(4),
    status
  ];

  csvContent += `${row.join(',')}\n`;
}

fs.writeFileSync('dataset_telemetria_ci_cd_v3.csv', csvContent);

console.log('Dataset v3 generado correctamente: dataset_telemetria_ci_cd_v3.csv');
console.log('Total de registros: 3000');