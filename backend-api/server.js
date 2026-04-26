const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('./config/db'); //conexión a MongoDB
const Deployment = require('./models/Deployment'); // Importa el modelo de datos

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

//MongoDB Atlas
connectDB();

//JWT Configuracion
const JWT_SECRET = process.env.JWT_SECRET || 'tu-super-secreto-cambiar-en-produccion';
const JWT_EXPIRY = '24h';

// Credenciales por defecto (cambiar en producción o usar base de datos)
const VALID_USERS = [
  { email: 'admin@example.com', password: 'admin123' },
  { email: 'developer@example.com', password: 'dev123' }
];

//Middleware de Autenticación 
/**
 * Verifica que el JWT sea válido en el header Authorization
 * Formato: Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

//Auth Endpoints

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { token: string, user: { email, expiresIn } }
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validar credenciales (en producción, usar base de datos con contraseñas hasheadas)
    const user = VALID_USERS.find(u => u.email === email && u.password === password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generar JWT
    const token = jwt.sign(
      { email: user.email, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      token,
      user: {
        email: user.email,
        expiresIn: JWT_EXPIRY
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Protected Routes

// Recibir webhook de GitHub y guardarlo en base de datos
// (Esta ruta NO requiere autenticación, recibe webhooks directamente de GitHub)
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

// Protected: Get all logs 
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const logs = await Deployment.find().sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        console.error('Error al obtener los logs:', error);
        res.status(500).json({ error: 'Hubo un error obteniendo los datos' });
    }
});

// Protected: Get specific log by ID
app.get('/api/logs/:id', authenticateToken, async (req, res) => {
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

//  Health Check 
app.get('/', (req, res) => {
  res.json({ 
    message: 'Backend de CI/CD Dashboard funcionando y conectado',
    auth: 'JWT required for /api/logs endpoints',
    demo_credentials: {
      email: 'admin@example.com',
      password: 'admin123'
    }
  });
});

//  Debug: Verify authentication 
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Token válido',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

//servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Backend ejecutándose en http://localhost:${PORT}`);
});