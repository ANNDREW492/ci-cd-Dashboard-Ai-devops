// Base URL configurable por environment
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

/**
 * Limpia localStorage al cargar la app si hay token corrupto
 */
function validateToken() {
  const token = localStorage.getItem('token');
  
  if (token && typeof token !== 'string') {
    console.warn('[API] Token corrupto detectado, limpiando...');
    clearAuth();
  }
}

validateToken();

/**
 * Obtiene el token JWT del localStorage
 */
export function getToken() {
  return localStorage.getItem('token');
}

/**
 * Guarda el token JWT en localStorage
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

/**
 * Obtiene los datos del usuario guardados
 */
export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

/**
 * Guarda los datos del usuario en localStorage
 */
export function setUser(user) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

/**
 * Limpia toda la información de autenticación
 */
export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Cliente API con autenticación automática
 * Inyecta el JWT en los headers de todas las peticiones
 */
export async function apiCall(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    console.log(`[API] Enviando request con token a ${endpoint}`);
  } else {
    console.warn(`[API] ⚠ No hay token para ${endpoint}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si se recibe el error 401, limpiar auth y redirigir al login
    if (response.status === 401) {
      console.error('[API] 401 - Token inválido o expirado');
      clearAuth();
      window.location.href = '/login';
      throw new Error('Unauthorized - Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[API] Error ${response.status}:`, error);
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[API] ✓ Respuesta ${response.status} de ${endpoint}`);
    return data;
  } catch (error) {
    console.error(`[API] Error en ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * API Methods - métodos específicos para cada endpoint
 */
export const api = {
  // autenticación
  
  /**
   * Login sin autenticación previa (público)
   */
  login: (email, password) =>
    fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  /**
   * Logout - limpia tokens locales
   */
  logout: () => {
    clearAuth();
  },

  /**
   * Verifica que el token sea válido (debug)
   */
  verifyToken: () => apiCall('/api/auth/verify'),

  // ========== LOGS (Protegidos) ==========
  
  /**
   * Obtener todos los logs
   */
  getLogs: () => apiCall('/api/logs'),

  /**
   * Obtener un log específico por ID
   */
  getLog: (id) => apiCall(`/api/logs/${id}`),

  // AI ANALYSIS (Protegido) 
  
  /**
   * Analizar log con IA semántica
   */
  analyzeLog: ({ error_log, repository }) =>
    apiCall('/api/analyze-log', {
      method: 'POST',
      body: JSON.stringify({ error_log, repository }),
    }),

  // RISK PREDICTION (Protegido)
  
  /**
   * Predecir riesgo de despliegue con modelo ML
   */
  predictRisk: (data) =>
    apiCall('/api/predict-risk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Opciones dinámicas para formularios ML
  getMlOptions: () => apiCall('/api/ml/options'),
};

export default api;
