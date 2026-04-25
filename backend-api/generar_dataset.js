const fs = require('fs');

// Datos base para simular
const actors = ['ANNDREW492', 'carlos_dev', 'maria_backend', 'junior_juan'];
const branches = ['main', 'ci/cd-proyecto', 'feature/pagos', 'hotfix/urgente'];
const verbos = ['Fix', 'Update', 'Add', 'Refactor', 'Remove'];
const modulos = ['login', 'multi-tenant DB', 'Docker config', 'frontend UI', 'API routes'];

let csvContent = 'commit_hash,actor,branch,commit_message,lines_changed,execution_time_seg,dia_semana,hora_dia,status\n';

for (let i = 0; i < 2000; i++) {
    const actor = actors[Math.floor(Math.random() * actors.length)];
    const branch = branches[Math.floor(Math.random() * branches.length)];
    const message = `${verbos[Math.floor(Math.random() * verbos.length)]} ${modulos[Math.floor(Math.random() * modulos.length)]}`;
    const linesChanged = Math.floor(Math.random() * 500) + 1;
    const execTime = Math.floor(Math.random() * 120) + 10;
    
    // Variables de tiempo: dia_semana (1-7) y hora_dia (0-23)
    const diaSemana = Math.floor(Math.random() * 7) + 1; 
    const horaDia = Math.floor(Math.random() * 24);

    // Lógica probabilística más orgánica para simular fallos.
    // Escala de riesgo base y ajustes por contexto (sin reglas totalmente rígidas).
    let failProbability = 0.12;

    // Riesgo por actor
    if (actor === 'junior_juan') failProbability += 0.18;
    if (actor === 'carlos_dev') failProbability += 0.05;
    if (actor === 'maria_backend') failProbability -= 0.03;
    if (actor === 'ANNDREW492') failProbability -= 0.05;

    // Riesgo por rama
    if (branch === 'hotfix/urgente') failProbability += 0.22;
    if (branch === 'feature/pagos') failProbability += 0.07;
    if (branch === 'ci/cd-proyecto') failProbability += 0.10;
    if (branch === 'main') failProbability -= 0.02;

    // Riesgo continuo por tamaño y duración de ejecución
    failProbability += Math.min(linesChanged / 900, 0.28);
    failProbability += Math.min(execTime / 500, 0.15);

    // Ventana de despliegue (6,7 = fin de semana en este dataset)
    const isWeekend = diaSemana >= 6;
    const isNight = horaDia >= 20 || horaDia <= 5;
    if (isWeekend) failProbability += 0.12;
    if (isNight) failProbability += 0.10;
    if (isWeekend && isNight) failProbability += 0.08;

    // Interacciones para casos más realistas
    if (branch === 'hotfix/urgente' && linesChanged > 350) failProbability += 0.12;
    if (actor === 'junior_juan' && branch === 'hotfix/urgente') failProbability += 0.10;
    if (actor === 'ANNDREW492' && branch === 'main' && linesChanged < 120 && !isNight) failProbability -= 0.10;

    // Ruido moderado para evitar dataset demasiado perfecto
    failProbability += (Math.random() - 0.5) * 0.08;

    // Limitar probabilidad a un rango válido
    failProbability = Math.max(0.01, Math.min(0.99, failProbability));

    const status = Math.random() < failProbability ? 'failure' : 'success';

    const hash = Math.random().toString(16).substring(2, 10);
    
    csvContent += `${hash},${actor},${branch},${message},${linesChanged},${execTime},${diaSemana},${horaDia},${status}\n`;
}

// Generar el archivo físico
fs.writeFileSync('dataset_telemetria_ci_cd.csv', csvContent);
console.log(' Dataset de Machine Learning creado con éxito: dataset_telemetria_ci_cd.csv (2000 registros)');