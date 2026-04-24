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

    // Lógica aprendizaje automático simple para simular fallos:
    let status = 'success';
    let failProbability = 0.05; // 5% base de fallo

    // Reglas más estrictas y deterministas
    if (linesChanged > 300) failProbability += 0.45;
    if (branch === 'hotfix/urgente') failProbability += 0.40;
    if (actor === 'junior_juan') failProbability += 0.35;
    if (diaSemana >= 5 && horaDia >= 16) failProbability += 0.30;

    
    if (failProbability >= 0.85) {
        status = 'failure';
    } else if (failProbability <= 0.10) {
        status = 'success';
    } else {
        // La "suerte" solo se aplica en los casos dudosos intermedios
        if (Math.random() < failProbability) {
            status = 'failure';
        }
    }

    const hash = Math.random().toString(16).substring(2, 10);
    
    csvContent += `${hash},${actor},${branch},${message},${linesChanged},${execTime},${diaSemana},${horaDia},${status}\n`;
}

// Generar el archivo físico
fs.writeFileSync('dataset_telemetria_ci_cd.csv', csvContent);
console.log(' Dataset de Machine Learning creado con éxito: dataset_telemetria_ci_cd.csv (2000 registros)');