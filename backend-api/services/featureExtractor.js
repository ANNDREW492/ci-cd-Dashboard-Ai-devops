const EARLY_FEATURE_DEFAULTS = {
  branch: 'main',
  event_type: 'push',
  commit_action: 'update',
  commit_scope: 'general',
  files_changed: 1,
  lines_added: 0,
  lines_deleted: 0,
  lines_changed: 0,
  dia_semana: 1,
  hora_dia: 10,
  is_weekend: 0,
  is_hotfix_branch: 0,
  is_feature_branch: 0,
  is_main_branch: 1,
  has_docker_change: 0,
  has_db_change: 0,
  has_api_change: 0,
  has_frontend_change: 0,
  has_login_change: 0,
  has_dependency_change: 0,
  has_env_change: 0,
  has_migration_change: 0
};

const MODEL_COLUMNS = [
  'branch',
  'event_type',
  'commit_action',
  'commit_scope',
  'files_changed',
  'lines_added',
  'lines_deleted',
  'lines_changed',
  'dia_semana',
  'hora_dia',
  'is_weekend',
  'is_hotfix_branch',
  'is_feature_branch',
  'is_main_branch',
  'has_docker_change',
  'has_db_change',
  'has_api_change',
  'has_frontend_change',
  'has_login_change',
  'has_dependency_change',
  'has_env_change',
  'has_migration_change',
  'lines_per_file',
  'lines_changed_log',
  'files_changed_log',
  'after_hours',
  'work_hours',
  'high_change',
  'very_high_change',
  'many_files_changed',
  'critical_component_change',
  'critical_high_change',
  'hotfix_high_change',
  'main_push',
  'weekend_after_hours'
];

function normalizeString(value, fallback = '') {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim() || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFlag(value) {
  return toNumber(value, 0) > 0 ? 1 : 0;
}

function inferBranchFlags(input) {
  if (input && typeof input === 'object') {
    const explicitFlags = {
      is_hotfix_branch: input.is_hotfix_branch,
      is_feature_branch: input.is_feature_branch,
      is_main_branch: input.is_main_branch,
    };

    if (Object.values(explicitFlags).some((value) => value !== undefined && value !== null)) {
      return {
        is_hotfix_branch: toFlag(explicitFlags.is_hotfix_branch),
        is_feature_branch: toFlag(explicitFlags.is_feature_branch),
        is_main_branch: toFlag(explicitFlags.is_main_branch),
      };
    }
  }

  const branch = typeof input === 'string' ? input : input?.branch;
  const normalizedBranch = normalizeString(branch, EARLY_FEATURE_DEFAULTS.branch).toLowerCase();
  return {
    is_hotfix_branch: normalizedBranch.includes('hotfix') ? 1 : 0,
    is_feature_branch: normalizedBranch.includes('feature') ? 1 : 0,
    is_main_branch: normalizedBranch === 'main' ? 1 : 0,
  };
}

function inferCommitAction(commitMessage, fallback = EARLY_FEATURE_DEFAULTS.commit_action) {
  const text = normalizeString(commitMessage, '').toLowerCase();
  if (text.includes('rollback')) return 'rollback';
  if (text.includes('hotfix') || text.includes('fix')) return 'fix';
  if (text.includes('merge')) return 'merge';
  if (text.includes('refactor')) return 'refactor';
  if (text.includes('remove') || text.includes('delete')) return 'remove';
  if (text.includes('add') || text.includes('create')) return 'add';
  if (text.includes('update') || text.includes('change') || text.includes('chore')) return 'update';
  return fallback;
}

function inferCommitScope(payload = {}) {
  const candidates = [payload.commit_scope, payload.scope, payload.commitMessage, payload.commit_message, payload.branch]
    .map((value) => normalizeString(value, '').toLowerCase())
    .join(' ');

  const scopePatterns = [
    ['login', ['login', 'signin', 'auth']],
    ['auth', ['auth', 'authentication', 'authorization']],
    ['api', ['api', 'backend', 'service']],
    ['frontend', ['frontend', 'ui', 'vue', 'client']],
    ['dashboard', ['dashboard', 'panel', 'overview']],
    ['docker', ['docker', 'container', 'image']],
    ['database', ['database', 'db', 'mongo']],
    ['migration', ['migration', 'migrate', 'schema']],
    ['dependencies', ['dependency', 'dependencies', 'package', 'npm', 'pip']],
    ['environment', ['env', 'environment', 'secret', 'config']],
    ['tests', ['test', 'tests', 'qa', 'coverage']],
    ['security', ['security', 'vuln', 'cve']],
    ['billing', ['billing', 'payment', 'pagos']]
  ];

  for (const [scope, keywords] of scopePatterns) {
    if (keywords.some((keyword) => candidates.includes(keyword))) {
      return scope;
    }
  }

  return normalizeString(payload.commit_scope, EARLY_FEATURE_DEFAULTS.commit_scope);
}

function inferEventType(payload = {}) {
  const explicit = normalizeString(payload.event_type || payload.eventType || payload.event_name || payload.eventName, '');
  if (explicit) {
    return explicit.toLowerCase();
  }

  if (payload.pull_request || payload.pullRequest) {
    return 'pull_request';
  }

  return 'push';
}

function inferTemporalFields(payload = {}) {
  const timestampSource = payload.timestamp || payload.created_at || payload.pushed_at || new Date().toISOString();
  const timestamp = new Date(timestampSource);
  const dia_semana = Number.isNaN(timestamp.getTime()) ? EARLY_FEATURE_DEFAULTS.dia_semana : timestamp.getDay() + 1;
  const hora_dia = Number.isNaN(timestamp.getTime()) ? EARLY_FEATURE_DEFAULTS.hora_dia : timestamp.getHours();

  return {
    dia_semana,
    hora_dia,
    is_weekend: dia_semana >= 6 ? 1 : 0
  };
}

function inferComponentFlags(commitMessage, commitScope) {
  const combined = `${normalizeString(commitMessage, '')} ${normalizeString(commitScope, '')}`.toLowerCase();
  return {
    has_docker_change: combined.includes('docker') ? 1 : 0,
    has_db_change: combined.includes('db') || combined.includes('database') ? 1 : 0,
    has_api_change: combined.includes('api') ? 1 : 0,
    has_frontend_change: combined.includes('frontend') || combined.includes('ui') || combined.includes('dashboard') ? 1 : 0,
    has_login_change: combined.includes('login') || combined.includes('signin') || combined.includes('auth') ? 1 : 0,
    has_dependency_change: combined.includes('dependency') || combined.includes('dependencies') || combined.includes('package') ? 1 : 0,
    has_env_change: combined.includes('env') || combined.includes('environment') ? 1 : 0,
    has_migration_change: combined.includes('migration') || combined.includes('migrate') ? 1 : 0
  };
}

function buildCatboostPayload(raw = {}) {
  const branch = normalizeString(raw.branch || raw.ref || raw.target_branch, EARLY_FEATURE_DEFAULTS.branch).replace(/^refs\/heads\//i, '');
  const event_type = inferEventType(raw);
  const commit_message = normalizeString(raw.commit_message || raw.message || raw.head_commit?.message, '');
  const commit_action = normalizeString(raw.commit_action, inferCommitAction(commit_message));
  const commit_scope = inferCommitScope({ ...raw, commit_message, branch });
  const temporal = inferTemporalFields(raw);
  const branchFlags = inferBranchFlags({ ...raw, branch });
  const componentFlags = inferComponentFlags(commit_message, commit_scope);
  const files_changed = Math.max(0, toNumber(raw.files_changed ?? raw.changed_files ?? raw.filesChanged, EARLY_FEATURE_DEFAULTS.files_changed));
  const lines_added = Math.max(0, toNumber(raw.lines_added ?? raw.additions, EARLY_FEATURE_DEFAULTS.lines_added));
  const lines_deleted = Math.max(0, toNumber(raw.lines_deleted ?? raw.deletions, EARLY_FEATURE_DEFAULTS.lines_deleted));
  const lines_changed = Math.max(0, toNumber(raw.lines_changed ?? raw.changes ?? raw.total_changes, lines_added + lines_deleted));
  const after_hours = temporal.hora_dia < 8 || temporal.hora_dia >= 18 ? 1 : 0;
  const work_hours = after_hours ? 0 : 1;
  const high_change = lines_changed >= 250 ? 1 : 0;
  const very_high_change = lines_changed >= 600 ? 1 : 0;
  const many_files_changed = files_changed >= 8 ? 1 : 0;
  const critical_component_change = Math.max(
    componentFlags.has_docker_change,
    componentFlags.has_db_change,
    componentFlags.has_api_change,
    componentFlags.has_frontend_change,
    componentFlags.has_login_change,
    componentFlags.has_dependency_change,
    componentFlags.has_env_change,
    componentFlags.has_migration_change
  );
  const critical_high_change = critical_component_change && (high_change || very_high_change) ? 1 : 0;
  const hotfix_high_change = branchFlags.is_hotfix_branch && (high_change || very_high_change) ? 1 : 0;
  const main_push = branchFlags.is_main_branch && event_type === 'push' ? 1 : 0;
  const weekend_after_hours = temporal.is_weekend && after_hours ? 1 : 0;
  const lines_per_file = files_changed > 0 ? Number((lines_changed / files_changed).toFixed(4)) : 0;

  return {
    branch,
    event_type,
    commit_action,
    commit_scope,
    files_changed,
    lines_added,
    lines_deleted,
    lines_changed,
    dia_semana: temporal.dia_semana,
    hora_dia: temporal.hora_dia,
    is_weekend: temporal.is_weekend,
    is_hotfix_branch: branchFlags.is_hotfix_branch,
    is_feature_branch: branchFlags.is_feature_branch,
    is_main_branch: branchFlags.is_main_branch,
    has_docker_change: componentFlags.has_docker_change,
    has_db_change: componentFlags.has_db_change,
    has_api_change: componentFlags.has_api_change,
    has_frontend_change: componentFlags.has_frontend_change,
    has_login_change: componentFlags.has_login_change,
    has_dependency_change: componentFlags.has_dependency_change,
    has_env_change: componentFlags.has_env_change,
    has_migration_change: componentFlags.has_migration_change,
    lines_per_file,
    lines_changed_log: Math.log1p(lines_changed),
    files_changed_log: Math.log1p(files_changed),
    after_hours,
    work_hours,
    high_change,
    very_high_change,
    many_files_changed,
    critical_component_change,
    critical_high_change,
    hotfix_high_change,
    main_push,
    weekend_after_hours
  };
}

function buildDeploymentRecord(raw = {}, prediction = null) {
  const commit_message = normalizeString(raw.commit_message || raw.message || raw.head_commit?.message, null);
  const status = normalizeString(raw.status, raw.failed_job_name || raw.failed_steps_count ? 'failure' : 'success');
  const temporal = inferTemporalFields(raw);
  const commit_scope = inferCommitScope({ ...raw, commit_message });
  const commit_action = normalizeString(raw.commit_action, inferCommitAction(commit_message));
  const event_type = inferEventType(raw);
  const branch = normalizeString(raw.branch || raw.ref || raw.target_branch, EARLY_FEATURE_DEFAULTS.branch).replace(/^refs\/heads\//i, '');
  const componentFlags = inferComponentFlags(commit_message, commit_scope);
  const earlyPayload = buildCatboostPayload({ ...raw, commit_message, branch, commit_action, commit_scope, event_type, ...temporal });

  const errorLog = normalizeString(
    raw.error_log || raw.errorLog || raw.log || raw.logs || raw.stdout || raw.stderr || raw.trace || raw.failure_reason || raw.failureReason,
    null
  );

  return {
    repository: normalizeString(raw.repository?.name || raw.repository || raw.repo || raw.repository_name, 'unknown-repository'),
    commit: normalizeString(raw.commit || raw.commit_hash || raw.sha || raw.head_commit?.id, 'unknown-commit'),
    commit_message,
    branch,
    event_type,
    status,
    actor: normalizeString(raw.actor || raw.sender?.login || raw.pusher?.name || raw.user, null),
    commit_action,
    commit_scope,
    files_changed: earlyPayload.files_changed,
    lines_added: earlyPayload.lines_added,
    lines_deleted: earlyPayload.lines_deleted,
    lines_changed: earlyPayload.lines_changed,
    dia_semana: earlyPayload.dia_semana,
    hora_dia: earlyPayload.hora_dia,
    is_weekend: earlyPayload.is_weekend,
    is_hotfix_branch: earlyPayload.is_hotfix_branch,
    is_feature_branch: earlyPayload.is_feature_branch,
    is_main_branch: earlyPayload.is_main_branch,
    has_docker_change: componentFlags.has_docker_change,
    has_db_change: componentFlags.has_db_change,
    has_api_change: componentFlags.has_api_change,
    has_frontend_change: componentFlags.has_frontend_change,
    has_login_change: componentFlags.has_login_change,
    has_dependency_change: componentFlags.has_dependency_change,
    has_env_change: componentFlags.has_env_change,
    has_migration_change: componentFlags.has_migration_change,
    execution_time_seg: raw.execution_time_seg ?? raw.execution_time_sec ?? null,
    test_duration_sec: raw.test_duration_sec ?? null,
    build_duration_sec: raw.build_duration_sec ?? null,
    failed_job_name: normalizeString(raw.failed_job_name, null),
    failed_steps_count: raw.failed_steps_count ?? null,
    log_category: normalizeString(raw.log_category, null),
    error_log: errorLog,
    log_source: normalizeString(raw.log_source || raw.log_source_name || raw.stream, null),
    failed_steps: raw.failed_steps ?? null,
    risk_probability: prediction?.risk_probability ?? null,
    risk_level: prediction?.risk_level ?? null,
    risk_decision: prediction?.risk_decision ?? null,
    model_version: prediction?.model_version ?? null,
    prediction_threshold: prediction?.prediction_threshold ?? null,
    prediction_timestamp: prediction?.prediction_timestamp ?? null,
    prediction_status: prediction ? 'available' : 'unavailable',
    timestamp: raw.timestamp || new Date(),
    errorLog: errorLog
  };
}

module.exports = {
  EARLY_FEATURE_DEFAULTS,
  MODEL_COLUMNS,
  buildCatboostPayload,
  buildDeploymentRecord,
  inferCommitAction,
  inferCommitScope,
  inferEventType,
  inferTemporalFields,
  inferBranchFlags,
  inferComponentFlags,
  normalizeString,
  toNumber,
  toFlag
};