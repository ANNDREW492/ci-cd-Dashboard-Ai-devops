const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('./config/db');
const Deployment = require('./models/Deployment');
const {
  EARLY_FEATURE_DEFAULTS,
  MODEL_UI_PROFILE,
  buildCatboostPayload,
  buildDeploymentRecord,
  inferCommitAction,
  inferCommitScope,
  inferEventType,
  inferTemporalFields,
  normalizeString,
  toNumber
} = require('./services/featureExtractor');

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

const JWT_SECRET = process.env.JWT_SECRET || 'secret-cambiar-produccion';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Credenciales demo internas (migrar a DB/SSO cuando empresa lo autorice)
const VALID_USERS = [
  { email: 'admin@example.com', password: 'admin123' },
  { email: 'developer@example.com', password: 'dev123' }
];

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

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

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = VALID_USERS.find((u) => u.email === email && u.password === password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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

// Ruta pública para recibir webhooks de CI/CD
app.post('/api/webhooks/ci-logs', async (req, res) => {
  try {
    const logData = req.body || {};
    const deploymentRecord = buildDeploymentRecord(logData);
    const newDeployment = new Deployment(deploymentRecord);
    await newDeployment.save();

    let prediction = null;
    const predictionPayload = buildCatboostPayload({
      ...logData,
      branch: deploymentRecord.branch,
      commit_message: deploymentRecord.commit_message,
      event_type: deploymentRecord.event_type,
      dia_semana: deploymentRecord.dia_semana,
      hora_dia: deploymentRecord.hora_dia,
      is_weekend: deploymentRecord.is_weekend,
      is_hotfix_branch: deploymentRecord.is_hotfix_branch,
      is_feature_branch: deploymentRecord.is_feature_branch,
      is_main_branch: deploymentRecord.is_main_branch,
      has_docker_change: deploymentRecord.has_docker_change,
      has_db_change: deploymentRecord.has_db_change,
      has_api_change: deploymentRecord.has_api_change,
      has_frontend_change: deploymentRecord.has_frontend_change,
      has_login_change: deploymentRecord.has_login_change,
      has_dependency_change: deploymentRecord.has_dependency_change,
      has_env_change: deploymentRecord.has_env_change,
      has_migration_change: deploymentRecord.has_migration_change,
      files_changed: deploymentRecord.files_changed,
      lines_added: deploymentRecord.lines_added,
      lines_deleted: deploymentRecord.lines_deleted,
      lines_changed: deploymentRecord.lines_changed,
      timestamp: deploymentRecord.timestamp
    });

    try {
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/predict-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictionPayload)
      });

      if (aiResponse.ok) {
        prediction = await aiResponse.json();
      }
    } catch (predictionError) {
      console.warn('No se pudo consultar la predicción temprana:', predictionError.message);
    }

    if (prediction) {
      await Deployment.findByIdAndUpdate(newDeployment._id, {
        risk_probability: prediction.risk_probability,
        risk_level: prediction.risk_level,
        risk_decision: prediction.risk_decision,
        model_version: prediction.model_version,
        prediction_threshold: prediction.prediction_threshold,
        prediction_timestamp: new Date(),
        prediction_status: 'available'
      });
    } else {
      await Deployment.findByIdAndUpdate(newDeployment._id, {
        prediction_status: 'unavailable'
      });
    }

    res.status(200).json({
      message: 'Log recibido y guardado correctamente',
      deploymentId: newDeployment._id,
      prediction_status: prediction ? 'available' : 'unavailable',
      prediction
    });
  } catch (error) {
    console.error('Error al guardar el webhook:', error);
    res.status(500).json({ error: 'Hubo un error guardando el log en la BD' });
  }
});

app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await Deployment.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    console.error('Error al obtener los logs:', error);
    res.status(500).json({ error: 'Hubo un error obteniendo los datos' });
  }
});

app.get('/api/logs/:id', authenticateToken, async (req, res) => {
  try {
    const log = await Deployment.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ error: 'Despliegue no encontrado' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error al buscar el log específico:', error);
    res.status(500).json({ error: 'Error en el servidor al consultar la base de datos' });
  }
});

// Opciones dinámicas para el widget de riesgo 
app.get('/api/ml/options', authenticateToken, async (req, res) => {
  try {
    const branchesFromDb = await Deployment.distinct('branch');
    const eventTypesFromDb = await Deployment.distinct('event_type');
    const commitActionsFromDb = await Deployment.distinct('commit_action');
    const commitScopesFromDb = await Deployment.distinct('commit_scope');

    res.json({
      branches: MODEL_UI_PROFILE.branches.length > 0 ? MODEL_UI_PROFILE.branches : branchesFromDb,
      branchFamilies: MODEL_UI_PROFILE.branchFamilies,
      eventTypes: MODEL_UI_PROFILE.eventTypes.length > 0 ? MODEL_UI_PROFILE.eventTypes : eventTypesFromDb,
      commitActions: MODEL_UI_PROFILE.commitActions.length > 0 ? MODEL_UI_PROFILE.commitActions : commitActionsFromDb,
      commitScopes: MODEL_UI_PROFILE.commitScopes.length > 0 ? MODEL_UI_PROFILE.commitScopes : commitScopesFromDb,
      limits: MODEL_UI_PROFILE.limits,
      defaults: {
        branch: MODEL_UI_PROFILE.branches[0] || branchesFromDb[0],
        event_type: MODEL_UI_PROFILE.eventTypes[0] || eventTypesFromDb[0],
        commit_action: MODEL_UI_PROFILE.commitActions[0] || commitActionsFromDb[0],
        commit_scope: MODEL_UI_PROFILE.commitScopes[0] || commitScopesFromDb[0],
        files_changed: EARLY_FEATURE_DEFAULTS.files_changed,
        lines_added: EARLY_FEATURE_DEFAULTS.lines_added,
        lines_deleted: EARLY_FEATURE_DEFAULTS.lines_deleted,
        lines_changed: EARLY_FEATURE_DEFAULTS.lines_changed,
        dia_semana: EARLY_FEATURE_DEFAULTS.dia_semana,
        hora_dia: EARLY_FEATURE_DEFAULTS.hora_dia,
        is_weekend: EARLY_FEATURE_DEFAULTS.is_weekend,
        is_hotfix_branch: EARLY_FEATURE_DEFAULTS.is_hotfix_branch,
        is_feature_branch: EARLY_FEATURE_DEFAULTS.is_feature_branch,
        is_main_branch: EARLY_FEATURE_DEFAULTS.is_main_branch,
        has_docker_change: EARLY_FEATURE_DEFAULTS.has_docker_change,
        has_db_change: EARLY_FEATURE_DEFAULTS.has_db_change,
        has_api_change: EARLY_FEATURE_DEFAULTS.has_api_change,
        has_frontend_change: EARLY_FEATURE_DEFAULTS.has_frontend_change,
        has_login_change: EARLY_FEATURE_DEFAULTS.has_login_change,
        has_dependency_change: EARLY_FEATURE_DEFAULTS.has_dependency_change,
        has_env_change: EARLY_FEATURE_DEFAULTS.has_env_change,
        has_migration_change: EARLY_FEATURE_DEFAULTS.has_migration_change
      }
    });
  } catch (error) {
    console.error('Error al obtener opciones de ML:', error);
    res.status(500).json({ error: 'No se pudieron obtener opciones de ML' });
  }
});

// Proxy protegido a FastAPI para diagnóstico IA
app.post('/api/analyze-log', authenticateToken, async (req, res) => {
  try {
    const { error_log, repository } = req.body;

    if (!error_log || !repository) {
      return res.status(400).json({ error: 'error_log y repository son obligatorios' });
    }

    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/analyze-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error_log, repository })
    });

    const payload = await aiResponse.json();
    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json(payload);
    }

    res.json(payload);
  } catch (error) {
    console.error('Error al contactar AI service (analyze-log):', error);
    res.status(502).json({ error: 'No se pudo contactar al servicio de IA' });
  }
});

// Proxy protegido a FastAPI para predicción ML
app.post('/api/predict-risk', authenticateToken, async (req, res) => {
  try {
    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/predict-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const payload = await aiResponse.json();
    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json(payload);
    }

    res.json(payload);
  } catch (error) {
    console.error('Error al contactar AI service (predict-risk):', error);
    res.status(502).json({ error: 'No se pudo contactar al servicio de IA' });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Backend de CI/CD Dashboard funcionando y conectado',
    auth: 'JWT required for /api/* excepto webhook/login',
    ai_service_url: AI_SERVICE_URL,
    demo_credentials: {
      email: 'admin@example.com',
      password: 'admin123'
    }
  });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    message: 'Token válido',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Backend ejecutándose en http://localhost:${PORT}`);
});
