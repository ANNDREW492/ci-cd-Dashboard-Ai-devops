<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">AI-DevOps</div>

      <ul class="sidebar-menu">
        <li>
          <router-link to="/" class="menu-link menu-dashboard">
            <span class="menu-icon icon-dashboard" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
                <rect x="13" y="3" width="8" height="5" rx="1.5" fill="currentColor" />
                <rect x="13" y="10" width="8" height="11" rx="1.5" fill="currentColor" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
              </svg>
            </span>
            <span>Dashboard General</span>
          </router-link>
        </li>
        <li>
          <router-link to="/pipelines" class="menu-link menu-pipeline">
            <span class="menu-icon icon-pipeline" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 5h10M7 12h10M7 19h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <circle cx="5" cy="5" r="1.6" fill="currentColor" />
                <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                <circle cx="5" cy="19" r="1.6" fill="currentColor" />
              </svg>
            </span>
            <span>Logs del Pipeline</span>
          </router-link>
        </li>
        <li>
          <router-link to="/ai-analysis" class="menu-link menu-ai">
            <span class="menu-icon icon-ai" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="currentColor" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </span>
            <span>Análisis Semántico (IA)</span>
          </router-link>
        </li>
        <li>
          <router-link to="/settings" class="menu-link menu-settings">
            <span class="menu-icon icon-settings" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M20 13.2v-2.4l-2-.5a6.3 6.3 0 0 0-.5-1.2l1.2-1.7-1.7-1.7-1.7 1.2a6.3 6.3 0 0 0-1.2-.5L13.2 4h-2.4l-.5 2a6.3 6.3 0 0 0-1.2.5L7.4 5.3 5.7 7l1.2 1.7a6.3 6.3 0 0 0-.5 1.2l-2 .5v2.4l2 .5c.1.4.3.8.5 1.2L5.7 17l1.7 1.7 1.7-1.2c.4.2.8.4 1.2.5l.5 2h2.4l.5-2c.4-.1.8-.3 1.2-.5l1.7 1.2 1.7-1.7-1.2-1.7c.2-.4.4-.8.5-1.2l2-.5Z" stroke="currentColor" stroke-width="1.4" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
              </svg>
            </span>
            <span>Configuración</span>
          </router-link>
        </li>
      </ul>
    </aside>

    <main class="content-area">
      <router-view></router-view>
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #f0f0f0;
}

.sidebar {
  width: 300px;
  min-width: 300px;
  border-right: 1px solid #d2d2d2;
  background: #ececec;
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2f44;
  padding: 24px 22px;
  border-bottom: 1px solid #d9d9d9;
}

.sidebar-menu {
  list-style: none;
  margin: 0;
  padding: 10px 0;
}

.sidebar-menu li {
  border-top: 1px solid #e2e2e2;
}

.sidebar-menu li:first-child {
  border-top: 0;
}

.menu-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-left: 3px solid transparent;
  text-decoration: none;
  color: #1f1f1f;
  font-size: 1.04rem;
  font-weight: 500;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.menu-link:hover {
  background: #e1e1e1;
}

.menu-link.router-link-active {
  background: #d7d7d7;
  border-left-color: #0078d4;
  font-weight: 700;
}

.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  color: #1f2937;
}

.menu-icon svg {
  width: 17px;
  height: 17px;
}

.icon-dashboard {
  color: #0ea5a8;
  background: #ddf7f4;
}

.icon-pipeline {
  color: #2563eb;
  background: #dbeafe;
}

.icon-ai {
  color: #7c3aed;
  background: #ede9fe;
}

.icon-settings {
  color: #ea580c;
  background: #ffedd5;
}

.content-area {
  flex: 1;
  padding: 30px;
  background: #f4f7f6;
  overflow-y: auto;
}

@media (max-width: 980px) {
  .layout {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }

  .sidebar {
    width: 100%;
    min-width: 0;
  }

  .content-area {
    padding: 18px;
  }
}
</style>