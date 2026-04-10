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

// 2. Ruta POST: Recibe el webhook de GitHub y lo guarda en la base de datos
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
            timestamp: logData.timestamp || new Date()
        });

        //Se guarda en MongoDB
        await newDeployment.save();
        console.log('Log guardado en MongoDB');
        
        res.status(200).json({ message: 'Log recibido y guardado correctamente' });
    } catch (error) {
        console.error('Error al guardar el webhook:', error);
        res.status(500).json({ error: 'Hubo un error guardando el log en la BD' });
    }
});

// Ruta GET para los logs y mostrar en las tablas/gráficas
app.get('/api/logs', async (req, res) => {
    try {
        // orden descendente por fecha
        const logs = await Deployment.find().sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        console.error('Error al obtener los logs:', error);
        res.status(500).json({ error: 'Hubo un error obteniendo los datos' });
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