const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
 //array temporal
 let pipelineLogs = [];
app.post('/api/webhooks/ci-logs', (req, res) => {
    const logData = req.body;
    console.log('Nuevo webhook recibido desde GitHub:', logData.commit);
    pipelineLogs.unshift(logData);
    
    res.status(200).json({ message: 'Log recibido correctamente' });
});

// Ruta para que el Dashboard consuma los datos y los dibuje
app.get('/api/logs', (req, res) => {
    res.json(pipelineLogs);
});

app.get('/', (req, res) => {
  res.send('funcionando');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API Backend ejecutándose en http://localhost:${PORT}`);
});