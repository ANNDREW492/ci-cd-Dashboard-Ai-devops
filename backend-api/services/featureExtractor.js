const fs = require('fs');
const path = require('path');

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

const MODEL_UI_PROFILE_PATH = path.join(__dirname, '..', 'model_ui_profile.json');

function normalizeBranchFamily(branch) {
  const normalized = normalizeString(branch, '').toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized === 'main') {
    return 'main';
  }

  if (normalized.includes('/')) {
    return normalized.split('/')[0];
  }

  return normalized;
}

function loadModelUiProfile() {
  const fallback = {
    branches: [],
    branchFamilies: [],
    componentOptions: [],
    eventTypes: [],
    commitActions: [],
    commitScopes: [],
    limits: {},
  };

  try {
    if (!fs.existsSync(MODEL_UI_PROFILE_PATH)) {
      return fallback;
    }

    const rawJson = fs.readFileSync(MODEL_UI_PROFILE_PATH, 'utf8').trim();
    if (!rawJson) {
      return fallback;
    }

    const parsedProfile = JSON.parse(rawJson);
    const branchFamilies = Array.isArray(parsedProfile.branchFamilies) ? parsedProfile.branchFamilies : fallback.branchFamilies;
    const familyOrder = new Map(branchFamilies.map((family, index) => [family, index]));
    const compareFamilies = (left, right) => {
      const leftOrder = familyOrder.has(left) ? familyOrder.get(left) : Number.MAX_SAFE_INTEGER;
      const rightOrder = familyOrder.has(right) ? familyOrder.get(right) : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.localeCompare(right);
    };

    const commitActions = Array.isArray(parsedProfile.commitActions) ? parsedProfile.commitActions : fallback.commitActions;
    const commitScopes = Array.isArray(parsedProfile.commitScopes) ? parsedProfile.commitScopes : fallback.commitScopes;
    const eventTypes = Array.isArray(parsedProfile.eventTypes) ? parsedProfile.eventTypes : fallback.eventTypes;
    const branches = Array.isArray(parsedProfile.branches) ? parsedProfile.branches : fallback.branches;
    const componentOptions = Array.isArray(parsedProfile.componentOptions) ? parsedProfile.componentOptions : fallback.componentOptions;

    return {
      branches: branches.sort((left, right) => {
        const leftFamily = normalizeBranchFamily(left);
        const rightFamily = normalizeBranchFamily(right);

        if (leftFamily !== rightFamily) {
          return compareFamilies(leftFamily, rightFamily);
        }

        return left.localeCompare(right);
      }),
      branchFamilies: branchFamilies.slice(),
      componentOptions: componentOptions.slice(),
      eventTypes: eventTypes.slice(),
      commitActions: commitActions.slice(),
      commitScopes: commitScopes.slice(),
      limits: parsedProfile.limits && typeof parsedProfile.limits === 'object' ? parsedProfile.limits : fallback.limits,
    };
  } catch {
    return fallback;
  }
}

const MODEL_UI_PROFILE = loadModelUiProfile();

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

const TRAINING_DATASET_COLUMNS = [
  'commit_hash',
  'actor',
  'branch',
  'commit_message',
  'event_type',
  'files_changed',
  'lines_added',
  'lines_deleted',
  'lines_changed',
  'execution_time_seg',
  'test_duration_sec',
  'build_duration_sec',
  'failed_job_name',
  'failed_steps_count',
  'log_category',
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
  'commit_action',
  'commit_scope',
  'risk_score_synthetic',
  'status'
];

const COMPONENT_FLAG_COLUMNS = [
  'has_docker_change',
  'has_db_change',
  'has_api_change',
  'has_frontend_change',
  'has_login_change',
  'has_dependency_change',
  'has_env_change',
  'has_migration_change'
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
  const explicitDay = payload.dia_semana ?? payload.day_of_week;
  const explicitHour = payload.hora_dia ?? payload.hour_of_day;

  if (explicitDay !== undefined || explicitHour !== undefined) {
    const dia_semana = Math.min(7, Math.max(1, toNumber(explicitDay, EARLY_FEATURE_DEFAULTS.dia_semana)));
    const hora_dia = Math.min(23, Math.max(0, toNumber(explicitHour, EARLY_FEATURE_DEFAULTS.hora_dia)));
    const explicitWeekend = payload.is_weekend;

    return {
      dia_semana,
      hora_dia,
      is_weekend: explicitWeekend !== undefined && explicitWeekend !== null ? toFlag(explicitWeekend) : (dia_semana >= 6 ? 1 : 0)
    };
  }

  const timestampSource = payload.timestamp || payload.created_at || payload.pushed_at || new Date().toISOString();
  const timestamp = new Date(timestampSource);
  const jsDay = Number.isNaN(timestamp.getTime()) ? null : timestamp.getDay();
  const dia_semana = jsDay === null ? EARLY_FEATURE_DEFAULTS.dia_semana : (jsDay === 0 ? 7 : jsDay);
  const hora_dia = Number.isNaN(timestamp.getTime()) ? EARLY_FEATURE_DEFAULTS.hora_dia : timestamp.getHours();

  return {
    dia_semana,
    hora_dia,
    is_weekend: dia_semana >= 6 ? 1 : 0
  };
}

function explicitComponentFlag(input, key, fallback) {
  if (input && input[key] !== undefined && input[key] !== null) {
    return toFlag(input[key]);
  }

  return fallback;
}

function inferComponentFlags(commitMessage, commitScope, input = {}) {
  const combined = `${normalizeString(commitMessage, '')} ${normalizeString(commitScope, '')}`.toLowerCase();
  return {
    has_docker_change: explicitComponentFlag(input, 'has_docker_change', combined.includes('docker') ? 1 : 0),
    has_db_change: explicitComponentFlag(input, 'has_db_change', combined.includes('db') || combined.includes('database') ? 1 : 0),
    has_api_change: explicitComponentFlag(input, 'has_api_change', combined.includes('api') ? 1 : 0),
    has_frontend_change: explicitComponentFlag(input, 'has_frontend_change', combined.includes('frontend') || combined.includes('ui') || combined.includes('dashboard') ? 1 : 0),
    has_login_change: explicitComponentFlag(input, 'has_login_change', combined.includes('login') || combined.includes('signin') || combined.includes('auth') ? 1 : 0),
    has_dependency_change: explicitComponentFlag(input, 'has_dependency_change', combined.includes('dependency') || combined.includes('dependencies') || combined.includes('package') ? 1 : 0),
    has_env_change: explicitComponentFlag(input, 'has_env_change', combined.includes('env') || combined.includes('environment') ? 1 : 0),
    has_migration_change: explicitComponentFlag(input, 'has_migration_change', combined.includes('migration') || combined.includes('migrate') ? 1 : 0)
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
  const componentFlags = inferComponentFlags(commit_message, commit_scope, raw);
  const files_changed = Math.max(0, toNumber(raw.files_changed ?? raw.changed_files ?? raw.filesChanged, EARLY_FEATURE_DEFAULTS.files_changed));
  const lines_added = Math.max(0, toNumber(raw.lines_added ?? raw.additions, EARLY_FEATURE_DEFAULTS.lines_added));
  const lines_deleted = Math.max(0, toNumber(raw.lines_deleted ?? raw.deletions, EARLY_FEATURE_DEFAULTS.lines_deleted));
  const lines_changed = Math.max(0, toNumber(raw.lines_changed ?? raw.changes ?? raw.total_changes, lines_added + lines_deleted));
  const after_hours = temporal.hora_dia < 8 || temporal.hora_dia >= 20 ? 1 : 0;
  const work_hours = temporal.hora_dia >= 9 && temporal.hora_dia <= 18 ? 1 : 0;
  const high_change = lines_changed >= 300 ? 1 : 0;
  const very_high_change = lines_changed >= 700 ? 1 : 0;
  const many_files_changed = files_changed >= 10 ? 1 : 0;
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
  const critical_high_change = critical_component_change * high_change;
  const hotfix_high_change = branchFlags.is_hotfix_branch * high_change;
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
  const componentFlags = inferComponentFlags(commit_message, commit_scope, raw);
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

function buildTrainingDatasetRow(raw = {}) {
  const record = buildDeploymentRecord(raw);

  return {
    commit_hash: record.commit,
    actor: record.actor || '',
    branch: record.branch,
    commit_message: record.commit_message || '',
    event_type: record.event_type,
    files_changed: record.files_changed,
    lines_added: record.lines_added,
    lines_deleted: record.lines_deleted,
    lines_changed: record.lines_changed,
    execution_time_seg: record.execution_time_seg ?? '',
    test_duration_sec: record.test_duration_sec ?? '',
    build_duration_sec: record.build_duration_sec ?? '',
    failed_job_name: record.failed_job_name || 'none',
    failed_steps_count: record.failed_steps_count ?? 0,
    log_category: record.log_category || (record.status === 'failure' ? 'runtime' : 'none'),
    dia_semana: record.dia_semana,
    hora_dia: record.hora_dia,
    is_weekend: record.is_weekend,
    is_hotfix_branch: record.is_hotfix_branch,
    is_feature_branch: record.is_feature_branch,
    is_main_branch: record.is_main_branch,
    has_docker_change: record.has_docker_change,
    has_db_change: record.has_db_change,
    has_api_change: record.has_api_change,
    has_frontend_change: record.has_frontend_change,
    has_login_change: record.has_login_change,
    has_dependency_change: record.has_dependency_change,
    has_env_change: record.has_env_change,
    has_migration_change: record.has_migration_change,
    commit_action: record.commit_action,
    commit_scope: record.commit_scope,
    risk_score_synthetic: raw.risk_score_synthetic ?? '',
    status: record.status
  };
}

module.exports = {
  EARLY_FEATURE_DEFAULTS,
  MODEL_UI_PROFILE,
  MODEL_COLUMNS,
  TRAINING_DATASET_COLUMNS,
  COMPONENT_FLAG_COLUMNS,
  buildCatboostPayload,
  buildDeploymentRecord,
  buildTrainingDatasetRow,
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
