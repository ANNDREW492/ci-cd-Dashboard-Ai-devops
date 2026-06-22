const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  repository: {
    type: String,
    required: true,
    trim: true
  },
  commit: {
    type: String,
    required: true,
    trim: true
  },
  commit_message: {
    type: String,
    default: null,
    trim: true
  },
  branch: {
    type: String,
    required: true,
    trim: true
  },
  event_type: {
    type: String,
    default: 'push',
    trim: true
  },
  status: {
    type: String,
    required: true
  },
  actor: {
    type: String,
    default: null,
    trim: true
  },
  commit_action: {
    type: String,
    default: null,
    trim: true
  },
  commit_scope: {
    type: String,
    default: null,
    trim: true
  },
  files_changed: {
    type: Number,
    default: 0
  },
  lines_added: {
    type: Number,
    default: 0
  },
  lines_deleted: {
    type: Number,
    default: 0
  },
  lines_changed: {
    type: Number,
    default: 0
  },
  dia_semana: {
    type: Number,
    default: null
  },
  hora_dia: {
    type: Number,
    default: null
  },
  is_weekend: {
    type: Number,
    default: null
  },
  is_hotfix_branch: {
    type: Number,
    default: null
  },
  is_feature_branch: {
    type: Number,
    default: null
  },
  is_main_branch: {
    type: Number,
    default: null
  },
  has_docker_change: {
    type: Number,
    default: null
  },
  has_db_change: {
    type: Number,
    default: null
  },
  has_api_change: {
    type: Number,
    default: null
  },
  has_frontend_change: {
    type: Number,
    default: null
  },
  has_login_change: {
    type: Number,
    default: null
  },
  has_dependency_change: {
    type: Number,
    default: null
  },
  has_env_change: {
    type: Number,
    default: null
  },
  has_migration_change: {
    type: Number,
    default: null
  },
  execution_time_seg: {
    type: Number,
    default: null
  },
  test_duration_sec: {
    type: Number,
    default: null
  },
  build_duration_sec: {
    type: Number,
    default: null
  },
  failed_job_name: {
    type: String,
    default: null,
    trim: true
  },
  failed_steps_count: {
    type: Number,
    default: null
  },
  log_category: {
    type: String,
    default: null,
    trim: true
  },
  error_log: {
    type: String,
    default: null
  },
  log_source: {
    type: String,
    default: null,
    trim: true
  },
  failed_steps: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  risk_probability: {
    type: Number,
    default: null
  },
  risk_level: {
    type: String,
    default: null,
    trim: true
  },
  risk_decision: {
    type: String,
    default: null,
    trim: true
  },
  model_version: {
    type: String,
    default: null,
    trim: true
  },
  prediction_threshold: {
    type: Number,
    default: null
  },
  prediction_timestamp: {
    type: Date,
    default: null
  },
  prediction_status: {
    type: String,
    default: 'unavailable',
    trim: true
  },
  exported: {
    type: Boolean,
    default: false
  },
  export_batch_id: {
    type: String,
    default: null,
    trim: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  errorLog: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Deployment', deploymentSchema);