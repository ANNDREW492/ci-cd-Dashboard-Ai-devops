const fs = require('fs');

// Datos base para simular
const actors = ['ANNDREW492', 'carlos_dev', 'maria_backend', 'junior_juan'];
const branches = ['main', 'ci/cd-proyecto', 'feature/pagos', 'hotfix/urgente'];
const verbos = ['Fix', 'Update', 'Add', 'Refactor', 'Remove'];
const modulos = ['login', 'multi-tenant DB', 'Docker config', 'frontend UI', 'API routes'];

// Cabecera del archivo CSV (Excel)
let csvContent = 'commit_hash,actor,branch,commit_message,lines_changed,execution_time_seg,status\n';

for (let i = 0; i < 1200; i++) {
    const actor = actors[Math.floor(Math.random() * actors.length)];
    const branch = branches[Math.floor(Math.random() * branches.length)];
    const message = `${verbos[Math.floor(Math.random() * verbos.length)]} ${modulos[Math.floor(Math.random() * modulos.length)]}`;
    const linesChanged = Math.floor(Math.random() * 500) + 1;
    const execTime = Math.floor(Math.random() * 120) + 10;
    
    // Lógica aprendizaje automático simple para simular fallos:
    let status = 'success';
    let failProbability = 0.1; // 10% base
    if (linesChanged > 300) failProbability += 0.4;
    if (branch === 'hotfix/urgente') failProbability += 0.3;
    if (actor === 'junior_juan') failProbability += 0.2;

    if (Math.random() < failProbability) {
        status = 'failure';
    }

    const hash = Math.random().toString(16).substring(2, 10);
    
    csvContent += `${hash},${actor},${branch},${message},${linesChanged},${execTime},${status}\n`;
}

//archivo físico
fs.writeFileSync('dataset_telemetria_ci_cd.csv', csvContent);
console.log('✅ Dataset creado con éxito: dataset_telemetria_ci_cd.csv (1200 registros)');