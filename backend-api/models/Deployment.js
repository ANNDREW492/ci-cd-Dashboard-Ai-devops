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
  branch: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    required: true // Ej: 'success', 'failure'
  },
  actor: {
    type: String,
    required: true
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