const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db'); //conexión a MongoDB
const Deployment = require('./models/Deployment'); // Importa el modelo de datos

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

//MongoDB Atlas
connectDB();

// Recibir webhook de GitHub y guardarlo en base de datos
app.post('/api/webhooks/ci-logs', async (req, res) => {
    try {
        const logData = req.body;
        console.log('Nuevo webhook recibido desde GitHub, commit:', logData.commit);
        
        //pipeline del job3
        const newDeployment = new Deployment({
            repository: logData.repository,
            commit: logData.commit,
            branch: logData.branch,
            status: logData.status,
            actor: logData.actor,
            timestamp: logData.timestamp || new Date(),
            //se guarda el log, Si fue exitoso, llegará null o vacío.
            errorLog: logData.error_log 
        });

        //MongoDB
        await newDeployment.save();
        console.log('Log guardado en MongoDB exitosamente.');
        
        res.status(200).json({ message: 'Log recibido y guardado correctamente' });
    } catch (error) {
        console.error('Error al guardar el webhook:', error);
        res.status(500).json({ error: 'Hubo un error guardando el log en la BD' });
    }
});

//mostrar en las tablas/gráficas
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await Deployment.find().sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        console.error('Error al obtener los logs:', error);
        res.status(500).json({ error: 'Hubo un error obteniendo los datos' });
    }
});

// despliegue específico ID de Mongo (vista de IA)
app.get('/api/logs/:id', async (req, res) => {
    try {
        const logId = req.params.id;
        const log = await Deployment.findById(logId);
        
        if (!log) {
            return res.status(404).json({ error: 'Despliegue no encontrado' });
        }
        
        res.json(log);
    } catch (error) {
        console.error('Error al buscar el log específico:', error);
        res.status(500).json({ error: 'Error en el servidor al consultar la base de datos' });
    }
});

// Ruta de prueba base
app.get('/', (req, res) => {
  res.send('Backend de CI/CD Dashboard funcionando y conectado');
});

//servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Backend ejecutándose en http://localhost:${PORT}`);
});