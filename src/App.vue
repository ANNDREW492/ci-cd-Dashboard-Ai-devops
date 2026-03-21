<template>
  <div class="layout">
    <nav style="width: 250px; background: #2c3e50; color: white; height: 100vh; padding: 20px;">
      <h2>AI-DevOps</h2>
      <ul style="list-style: none; padding: 0; margin-top: 30px;">
        <li style="margin-bottom: 15px;">
          <router-link to="/" style="color: #ecf0f1; text-decoration: none;">Dashboard General</router-link>
        </li>
        <li style="margin-bottom: 15px;">
          <router-link to="/pipelines" style="color: #ecf0f1; text-decoration: none;">Logs del Pipeline</router-link>
        </li>
        <li style="margin-bottom: 15px;">
          <router-link to="/ai-analysis" style="color: #ecf0f1; text-decoration: none;">Análisis Semántico (IA)</router-link>
        </li>
        <li style="margin-bottom: 15px;">
          <router-link to="/settings" style="color: #ecf0f1; text-decoration: none;">Configuración</router-link>
        </li>
      </ul>
    </nav>

    <main style="flex: 1; padding: 30px; background: #f4f7f6; overflow-y: auto;">
      <router-view></router-view>
    </main>
  </div>
</template>

<style>
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
.layout { display: flex; height: 100vh; overflow: hidden; }
</style>