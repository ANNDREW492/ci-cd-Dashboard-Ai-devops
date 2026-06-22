const mongoose = require('mongoose');

const mlConfigSchema = new mongoose.Schema({
  dataset_mode: { type: String, enum: ['manual', 'automatic'], default: 'automatic' },
  manual_dataset_path: { type: String, default: 'backend-api/dataset_telemetria_ci_cd_v3.csv' },
  enabled_auto_train: { type: Boolean, default: false },
  train_interval_days: { type: Number, default: 3 },
  min_new_records: { type: Number, default: 30 },
  promotion_metric: { type: String, default: 'f1' },
  min_improvement: { type: Number, default: 0.01 },
  allow_auto_promotion: { type: Boolean, default: false },
  export_only_new: { type: Boolean, default: true },
  storage: {
    type: { type: String, enum: ['s3', 'release'], default: 's3' },
    bucket: { type: String, default: '' },
    region: { type: String, default: '' }
  },
  github: {
    owner: { type: String, default: 'senatibuho' },
    repo: { type: String, default: 'pro8' },
    branch: { type: String, default: 'ci/cd-proyecto' },
    workflow_file: { type: String, default: 'retrain.yml' }
  },
  last_exported_at: { type: Date, default: null },
  last_export_batch_id: { type: String, default: null },
  last_export_row_count: { type: Number, default: 0 },
  last_export_s3_url: { type: String, default: null },
  last_trained_at: { type: Date, default: null },
  last_training_status: { type: String, default: null },
  last_training_run_url: { type: String, default: null },
  last_promoted_version: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('MlConfig', mlConfigSchema);
