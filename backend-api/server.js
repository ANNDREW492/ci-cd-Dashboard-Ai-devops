const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('./config/db');
const Deployment = require('./models/Deployment');
const {
  EARLY_FEATURE_DEFAULTS,
  COMPONENT_FLAG_COLUMNS,
  MODEL_UI_PROFILE,
  TRAINING_DATASET_COLUMNS,
  buildCatboostPayload,
  buildDeploymentRecord,
  buildTrainingDatasetRow
} = require('./services/featureExtractor');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const MlConfig = require('./models/MlConfig');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

connectDB();

const JWT_SECRET = process.env.JWT_SECRET || 'secret-cambiar-produccion';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Credenciales demo internas (migrar a DB/SSO cuando empresa lo autorice)
const VALID_USERS = [
  { email: 'admin@example.com', password: 'admin123' },
  { email: 'developer@example.com', password: 'dev123' }
];

function csvEscape(value) {
  const normalized = value === undefined || value === null ? '' : String(value).replace(/"/g, '""');
  return normalized.includes(',') || normalized.includes('\n') || normalized.includes('\r') ? `"${normalized}"` : normalized;
}

function buildCsvContent(rows) {
  const header = TRAINING_DATASET_COLUMNS.join(',');
  const lines = rows.map((row) => TRAINING_DATASET_COLUMNS.map((column) => csvEscape(row[column])).join(','));
  return [header, ...lines].join('\n');
}

function sanitizeFileBaseName(value, fallback = `export_${Date.now()}`) {
  const normalized = String(value || '')
    .trim()
    .replace(/\.csv$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}

function toCsvFileName(value, fallback) {
  return `${sanitizeFileBaseName(value, fallback)}.csv`;
}

function countCsvRows(csvContent) {
  const lines = String(csvContent || '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return Math.max(0, lines.length - 1);
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getS3Config(cfg = null) {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || cfg?.storage?.region || 'us-east-1',
    bucket: process.env.S3_BUCKET || cfg?.storage?.bucket || ''
  };
}

function isS3Configured(s3Config) {
  return Boolean(s3Config.accessKeyId && s3Config.secretAccessKey && s3Config.bucket);
}

async function putObjectToS3({ key, body, contentType = 'text/csv', cfg = null }) {
  const s3Config = getS3Config(cfg);
  if (!isS3Configured(s3Config)) {
    return null;
  }

  const s3 = new AWS.S3({
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
    region: s3Config.region
  });

  await s3.putObject({
    Bucket: s3Config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }).promise();

  return `s3://${s3Config.bucket}/${key}`;
}

function applyEnvironmentDefaults(cfg) {
  if (!cfg.storage) {
    cfg.storage = {};
  }

  if (!cfg.github) {
    cfg.github = {};
  }

  if (process.env.S3_BUCKET) {
    cfg.storage.bucket = process.env.S3_BUCKET;
  }

  if (process.env.AWS_REGION) {
    cfg.storage.region = process.env.AWS_REGION;
  }

  if (process.env.GITHUB_OWNER) cfg.github.owner = process.env.GITHUB_OWNER;
  if (process.env.GITHUB_REPO) cfg.github.repo = process.env.GITHUB_REPO;
  if (process.env.GITHUB_BRANCH) cfg.github.branch = process.env.GITHUB_BRANCH;
  if (process.env.GITHUB_WORKFLOW_FILE) cfg.github.workflow_file = process.env.GITHUB_WORKFLOW_FILE;
}

async function getOrCreateMlConfig() {
  let cfg = await MlConfig.findOne();
  if (!cfg) {
    cfg = new MlConfig();
  }
  applyEnvironmentDefaults(cfg);
  await cfg.save();
  return cfg;
}

function mergeMlConfig(cfg, body = {}) {
  const allowedTopLevel = [
    'dataset_mode',
    'manual_dataset_path',
    'dataset_export_name',
    'active_model_mode',
    'enabled_auto_train',
    'train_interval_days',
    'min_new_records',
    'promotion_metric',
    'min_improvement',
    'allow_auto_promotion',
    'export_only_new'
  ];

  for (const key of allowedTopLevel) {
    if (body[key] !== undefined) {
      cfg[key] = body[key];
    }
  }

  if (body.storage && typeof body.storage === 'object') {
    const currentStorage = cfg.storage?.toObject?.() || cfg.storage || {};
    cfg.storage = {
      ...currentStorage,
      ...body.storage
    };
  }

  if (body.github && typeof body.github === 'object') {
    const currentGithub = cfg.github?.toObject?.() || cfg.github || {};
    cfg.github = {
      ...currentGithub,
      ...body.github
    };
  }
}

function authenticateAutomationOrJwt(req, res, next) {
  const automationToken = process.env.ML_WEBHOOK_TOKEN;
  if (automationToken && req.headers['x-ml-webhook-token'] === automationToken) {
    req.user = { automation: 'ml-workflow' };
    return next();
  }

  return authenticateToken(req, res, next);
}

function uniqueOptionValues(...sources) {
  const seen = new Set();
  const values = [];

  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const value of source) {
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      values.push(normalized);
    }
  }

  return values;
}

function inferBranchFamilyName(branch) {
  const normalized = String(branch || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'main') return 'main';
  if (normalized.includes('/')) return normalized.split('/')[0];
  return normalized;
}

function buildBranchFamilies(branches) {
  const profileOrder = MODEL_UI_PROFILE.branchFamilies || [];
  const families = uniqueOptionValues(profileOrder, branches.map(inferBranchFamilyName));
  const order = new Map(profileOrder.map((family, index) => [family, index]));

  return families.sort((left, right) => {
    const leftOrder = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.localeCompare(right);
  });
}

function labelFromFeatureKey(key) {
  const labelFromProfile = (MODEL_UI_PROFILE.componentOptions || []).find((option) => option.key === key)?.label;
  if (labelFromProfile) {
    return labelFromProfile;
  }

  return key
    .replace(/^has_/, '')
    .replace(/_change$/, '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildComponentOptions() {
  const profileKeys = (MODEL_UI_PROFILE.componentOptions || []).map((option) => option.key);
  return uniqueOptionValues(COMPONENT_FLAG_COLUMNS, profileKeys).map((key) => ({
    key,
    label: labelFromFeatureKey(key)
  }));
}

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

async function dispatchTrainingWorkflow(cfg) {
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN;

  if (!token) {
    const error = new Error('Falta GH_PAT o GITHUB_TOKEN en el entorno del backend');
    error.statusCode = 400;
    throw error;
  }

  const owner = cfg.github.owner;
  const repo = cfg.github.repo;
  const workflowFile = cfg.github.workflow_file;
  const branch = cfg.github.branch;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      ref: branch,
      inputs: {
        dataset_mode: cfg.dataset_mode,
        allow_auto_promotion: String(cfg.allow_auto_promotion),
        train_interval_days: String(cfg.train_interval_days),
        min_new_records: String(cfg.min_new_records),
        promotion_metric: cfg.promotion_metric,
        min_improvement: String(cfg.min_improvement)
      }
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error('GitHub workflow_dispatch falló');
    error.statusCode = response.status;
    error.detail = payload;
    throw error;
  }

  return { owner, repo, workflow_file: workflowFile, branch };
}

async function syncAiModelSource(activeModelMode) {
  const modelSource = activeModelMode === 'automatic' ? 's3' : 'local';
  const response = await fetch(`${AI_SERVICE_URL}/api/model/source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_source: modelSource })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('No se pudo activar el modelo solicitado en AI service');
    error.statusCode = response.status;
    error.detail = payload;
    throw error;
  }

  return payload;
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

// GET / POST - ML configuration
app.get('/api/ml/config', authenticateToken, async (req, res) => {
  try {
    const cfg = await getOrCreateMlConfig();
    res.json(cfg);
  } catch (error) {
    console.error('Error getting ml config:', error);
    res.status(500).json({ error: 'Error obteniendo configuración ML' });
  }
});

app.post('/api/ml/config', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const cfg = await getOrCreateMlConfig();
    mergeMlConfig(cfg, body);
    await cfg.save();
    const responsePayload = cfg.toObject();

    if (body.active_model_mode !== undefined) {
      try {
        responsePayload.model_sync = await syncAiModelSource(cfg.active_model_mode);
      } catch (syncError) {
        responsePayload.model_sync_error = syncError.detail || syncError.message;
      }
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Error updating ml config:', error);
    res.status(500).json({ error: 'Error guardando configuración ML' });
  }
});

app.post('/api/ml/manual-dataset', authenticateToken, async (req, res) => {
  try {
    const { filename, content } = req.body || {};
    const csvContent = typeof content === 'string' ? content.trim() : '';

    if (!csvContent) {
      return res.status(400).json({ error: 'Debes subir un CSV con contenido' });
    }

    const firstLine = csvContent.split(/\r?\n/)[0] || '';
    if (!firstLine.toLowerCase().includes('status')) {
      return res.status(400).json({ error: 'El CSV debe incluir una columna status para entrenar el modelo' });
    }

    const uploadDir = path.join(__dirname, 'datasets', 'uploads');
    ensureDirectory(uploadDir);

    const safeFileName = toCsvFileName(filename, `manual_dataset_${Date.now()}`);
    const filePath = path.join(uploadDir, safeFileName);
    fs.writeFileSync(filePath, `${csvContent}\n`, 'utf8');

    const cfg = await getOrCreateMlConfig();
    cfg.dataset_mode = 'manual';
    cfg.manual_dataset_path = path.relative(__dirname, filePath).replace(/\\/g, '/');
    cfg.dataset_export_name = sanitizeFileBaseName(filename, cfg.dataset_export_name || 'manual_dataset');
    await cfg.save();

    res.json({
      message: 'Dataset manual cargado',
      file_name: safeFileName,
      manual_dataset_path: cfg.manual_dataset_path,
      row_count: countCsvRows(csvContent)
    });
  } catch (error) {
    console.error('Error uploading manual dataset:', error);
    res.status(500).json({ error: 'No se pudo cargar el dataset manual', detail: error.message });
  }
});

// POST /api/ml/export - export deployments to CSV and upload to S3 if configured
app.post('/api/ml/export', authenticateToken, async (req, res) => {
  try {
    const cfg = await getOrCreateMlConfig();
    const requestedName = req.body?.export_name || cfg.dataset_export_name;
    const batchId = sanitizeFileBaseName(requestedName, `export_${Date.now()}`);
    const csvFileName = `${batchId}.csv`;
    const tmpDir = path.join(__dirname, 'tmp');
    ensureDirectory(tmpDir);
    const filePath = path.join(tmpDir, csvFileName);
    let csvContent = '';
    let rowCount = 0;
    let rows = [];

    if (cfg.dataset_mode === 'manual') {
      if (!cfg.manual_dataset_path) {
        return res.status(400).json({ error: 'No hay dataset manual cargado' });
      }

      const manualPath = path.resolve(__dirname, cfg.manual_dataset_path);
      const allowedRoot = path.resolve(__dirname, 'datasets');
      if (!manualPath.startsWith(allowedRoot) || !fs.existsSync(manualPath)) {
        return res.status(400).json({ error: 'El dataset manual no existe o esta fuera de la carpeta permitida' });
      }

      csvContent = fs.readFileSync(manualPath, 'utf8');
      rowCount = countCsvRows(csvContent);
    } else {
      const onlyNew = req.body?.only_new ?? cfg.export_only_new ?? true;
      const filter = onlyNew ? { exported: { $ne: true } } : {};

      rows = await Deployment.find(filter).sort({ timestamp: 1 }).lean().exec();

      if (!rows || rows.length === 0) {
        return res.status(200).json({ message: 'No hay registros para exportar', row_count: 0 });
      }

      const datasetRows = rows.map((row) => buildTrainingDatasetRow(row));
      csvContent = buildCsvContent(datasetRows);
      rowCount = rows.length;
    }

    fs.writeFileSync(filePath, csvContent, 'utf8');

    let s3Url = null;
    const s3Config = getS3Config(cfg);

    if (isS3Configured(s3Config)) {
      const key = `datasets/${csvFileName}`;
      s3Url = await putObjectToS3({ key, body: csvContent, cfg });
      await putObjectToS3({ key: 'datasets/latest.csv', body: csvContent, cfg });
    }

    if (cfg.dataset_mode !== 'manual') {
      await Deployment.updateMany(
        { _id: { $in: rows.map((row) => row._id) } },
        { $set: { exported: true, export_batch_id: batchId } }
      );
    }

    cfg.last_exported_at = new Date();
    cfg.last_export_batch_id = batchId;
    cfg.last_export_row_count = rowCount;
    cfg.last_export_s3_url = s3Url;
    cfg.dataset_export_name = requestedName || cfg.dataset_export_name;
    await cfg.save();

    res.json({
      message: 'Export completo',
      row_count: rowCount,
      file: filePath,
      s3: s3Url,
      s3_configured: isS3Configured(s3Config),
      batch_id: batchId,
      csv_file_name: csvFileName,
      columns: TRAINING_DATASET_COLUMNS
    });
  } catch (error) {
    console.error('Error exporting ML dataset:', error);
    res.status(500).json({ error: 'Error exportando dataset', detail: error.message });
  }
});

app.post('/api/ml/s3/test', authenticateToken, async (req, res) => {
  try {
    const cfg = await getOrCreateMlConfig();
    const s3Config = getS3Config(cfg);

    if (!isS3Configured(s3Config)) {
      return res.status(400).json({
        error: 'S3 no configurado en este backend',
        required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET', 'AWS_REGION']
      });
    }

    const key = `healthchecks/backend-${Date.now()}.json`;
    const s3Url = await putObjectToS3({
      key,
      body: JSON.stringify({ ok: true, timestamp: new Date().toISOString() }, null, 2),
      contentType: 'application/json',
      cfg
    });

    res.json({ message: 'S3 disponible', s3: s3Url, bucket: s3Config.bucket, region: s3Config.region });
  } catch (error) {
    console.error('Error testing S3:', error);
    res.status(500).json({ error: 'No se pudo escribir en S3', detail: error.message });
  }
});

app.post('/api/ml/trigger-train', authenticateToken, async (req, res) => {
  try {
    const cfg = await getOrCreateMlConfig();
    const workflow = await dispatchTrainingWorkflow(cfg);

    cfg.last_training_status = 'dispatched';
    cfg.last_training_dispatched_at = new Date();
    await cfg.save();

    res.json({ message: 'Entrenamiento solicitado', ...workflow });
  } catch (error) {
    console.error('Error triggering training:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'No se pudo disparar el entrenamiento',
      detail: error.detail || error.message
    });
  }
});

app.get('/api/ml/model-status', authenticateToken, async (req, res) => {
  try {
    const aiResponse = await fetch(`${AI_SERVICE_URL}/`);
    const payload = await aiResponse.json();

    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json(payload);
    }

    res.json(payload);
  } catch (error) {
    res.status(502).json({ error: 'No se pudo consultar el estado del modelo activo', detail: error.message });
  }
});

app.post('/api/ml/mark-promoted', authenticateAutomationOrJwt, async (req, res) => {
  try {
    const cfg = await getOrCreateMlConfig();
    const body = req.body || {};

    cfg.last_trained_at = body.trained_at ? new Date(body.trained_at) : new Date();
    cfg.last_training_status = body.status || 'completed';
    cfg.last_training_run_url = body.run_url || cfg.last_training_run_url;

    if (body.promoted_version) {
      cfg.last_promoted_version = body.promoted_version;
    }

    let modelSync = null;
    if (cfg.active_model_mode === 'automatic') {
      try {
        modelSync = await syncAiModelSource('automatic');
      } catch (syncError) {
        cfg.last_training_status = 'completed_model_reload_failed';
      }
    }

    await cfg.save();
    const responsePayload = cfg.toObject();
    if (modelSync) responsePayload.model_sync = modelSync;
    res.json(responsePayload);
  } catch (error) {
    console.error('Error marking ML promotion:', error);
    res.status(500).json({ error: 'No se pudo registrar la promoción del modelo' });
  }
});

// Opciones dinámicas para el widget de riesgo 
app.get('/api/ml/options', authenticateToken, async (req, res) => {
  try {
    const branchesFromDb = await Deployment.distinct('branch');
    const eventTypesFromDb = await Deployment.distinct('event_type');
    const commitActionsFromDb = await Deployment.distinct('commit_action');
    const commitScopesFromDb = await Deployment.distinct('commit_scope');
    const branches = uniqueOptionValues(MODEL_UI_PROFILE.branches, branchesFromDb, [EARLY_FEATURE_DEFAULTS.branch]);
    const eventTypes = uniqueOptionValues(MODEL_UI_PROFILE.eventTypes, eventTypesFromDb, [EARLY_FEATURE_DEFAULTS.event_type]);
    const commitActions = uniqueOptionValues(MODEL_UI_PROFILE.commitActions, commitActionsFromDb, [EARLY_FEATURE_DEFAULTS.commit_action]);
    const commitScopes = uniqueOptionValues(MODEL_UI_PROFILE.commitScopes, commitScopesFromDb, [EARLY_FEATURE_DEFAULTS.commit_scope]);
    const branchFamilies = buildBranchFamilies(branches);
    const componentOptions = buildComponentOptions();

    res.json({
      branches,
      branchFamilies,
      componentOptions,
      eventTypes,
      commitActions,
      commitScopes,
      limits: MODEL_UI_PROFILE.limits,
      defaults: {
        branch: branches[0],
        event_type: eventTypes[0],
        commit_action: commitActions[0],
        commit_scope: commitScopes[0],
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

async function runScheduledTrainingCheck() {
  try {
    const cfg = await getOrCreateMlConfig();
    if (!cfg.enabled_auto_train) {
      return;
    }

    const intervalDays = Math.max(1, Number(cfg.train_interval_days || 3));
    const lastDispatch = cfg.last_training_dispatched_at || cfg.last_trained_at;
    const nextAllowedAt = lastDispatch
      ? new Date(lastDispatch).getTime() + intervalDays * 24 * 60 * 60 * 1000
      : 0;

    if (Date.now() < nextAllowedAt) {
      return;
    }

    await dispatchTrainingWorkflow(cfg);
    cfg.last_training_status = 'scheduled_dispatched';
    cfg.last_training_dispatched_at = new Date();
    await cfg.save();
    console.log(`Entrenamiento automatico solicitado cada ${intervalDays} dia(s)`);
  } catch (error) {
    console.warn('No se pudo ejecutar el chequeo de entrenamiento automatico:', error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Backend ejecutándose en http://localhost:${PORT}`);
  setTimeout(runScheduledTrainingCheck, 10000);
  setInterval(runScheduledTrainingCheck, 60 * 60 * 1000);
});
