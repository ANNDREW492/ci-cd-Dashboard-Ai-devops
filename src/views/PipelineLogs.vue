<script setup>
import { onMounted, ref } from 'vue';

const pipelineLogs = ref([]);

const getRepository = (log) => {
  return log?.repository?.name || log?.repository || 'N/A';
};

const getCommit = (log) => {
  const commit = log?.head_commit?.id || log?.commit || '';
  return commit ? String(commit).slice(0, 7) : 'N/A';
};

const getBranch = (log) => {
  const refValue = log?.ref || '';
  return refValue ? refValue.replace('refs/heads/', '') : 'N/A';
};

const getActor = (log) => {
  return log?.sender?.login || log?.pusher?.name || log?.actor || 'N/A';
};

const getStatus = (log) => {
  return log?.status || log?.conclusion || 'unknown';
};

onMounted(async () => {
  try {
    const response = await fetch('http://localhost:3000/api/logs');
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    pipelineLogs.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error al obtener logs del pipeline:', error);
    pipelineLogs.value = [];
  }
});
</script>

<template>
  <section class="pipeline-logs">
    <h1>Historial de Despliegues</h1>

    <p v-if="pipelineLogs.length === 0" class="empty-message">
      Esperando eventos del pipeline CI/CD...
    </p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Repositorio</th>
            <th>Commit</th>
            <th>Rama</th>
            <th>Actor</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(log, index) in pipelineLogs" :key="index">
            <td>{{ getRepository(log) }}</td>
            <td>{{ getCommit(log) }}</td>
            <td>{{ getBranch(log) }}</td>
            <td>{{ getActor(log) }}</td>
            <td>
              <span
                :class="[
                  'status',
                  {
                    success: getStatus(log).toLowerCase() === 'success',
                    failure: getStatus(log).toLowerCase() === 'failure'
                  }
                ]"
              >
                {{ getStatus(log) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.pipeline-logs {
  padding: 1.25rem;
}

.empty-message {
  margin-top: 1rem;
  color: #6b7280;
}

.table-wrap {
  margin-top: 1rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}

th {
  font-weight: 600;
}

.status {
  font-weight: 600;
  text-transform: lowercase;
}

.status.success {
  color: #16a34a;
}

.status.failure {
  color: #dc2626;
}
</style>