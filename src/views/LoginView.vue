<template>
  <div class="login-container">
    <!-- Fondo animado con formas -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
      <div class="shape shape-5"></div>
    </div>

    <!-- Contenido del login -->
    <div class="login-content">
      <h1 class="login-title">AI-DevOps</h1>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <input 
            v-model="email" 
            type="email" 
            placeholder="hello@example.co" 
            class="form-input"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <input 
            v-model="password" 
            type="password" 
            placeholder="PASSWORD" 
            class="form-input"
            required
            :disabled="loading"
          />
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="!loading">LOG IN</span>
          <span v-else>LOGGING IN...</span>
        </button>
      </form>

      <a href="#" class="forgot-password">FORGOT YOUR PASSWORD?</a>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { setToken, setUser } from '../services/apiClient';

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Invalid credentials');
    }

    const data = await response.json();
    
    // Guardar token y usuario usando el apiClient
    setToken(data.token);
    setUser(data.user);
    
    console.log('✓ Login exitoso, token guardado:', data.token.slice(0, 20) + '...');
    
    // Redirigir al dashboard
    router.push('/');
  } catch (err) {
    error.value = err.message;
    console.error('✗ Error en login:', err);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1b3a 0%, #2d2e5f 50%, #3d3e7a 100%);
  position: relative;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.background-shapes {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.shape {
  position: absolute;
  opacity: 0.15;
  border-radius: 50%;
}

.shape-1 {
  width: 300px;
  height: 300px;
  background: #7c7dff;
  top: -100px;
  left: -100px;
}

.shape-2 {
  width: 250px;
  height: 250px;
  background: #9b9bff;
  top: 20%;
  right: -50px;
  border-radius: 30% 70% 70% 30%;
}

.shape-3 {
  width: 200px;
  height: 200px;
  background: #7c7dff;
  bottom: -50px;
  left: 10%;
  border-radius: 60% 40% 30% 70%;
}

.shape-4 {
  width: 150px;
  height: 150px;
  background: #9b9bff;
  bottom: 20%;
  right: 5%;
}

.shape-5 {
  width: 100px;
  height: 100px;
  background: #7c7dff;
  top: 50%;
  left: 50%;
  border-radius: 40% 60% 70% 30%;
}

.login-content {
  position: relative;
  z-index: 10;
  text-align: center;
  background: rgba(30, 31, 50, 0.7);
  backdrop-filter: blur(10px);
  padding: 60px 50px;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 480px;
}

.login-title {
  font-size: 42px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 50px;
  letter-spacing: 0.5px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.form-group {
  position: relative;
}

.form-input {
  width: 100%;
  padding: 15px 20px;
  background: rgba(60, 60, 100, 0.5);
  border: 1px solid rgba(150, 150, 200, 0.3);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.3s ease;
}

.form-input::placeholder {
  color: rgba(200, 200, 220, 0.6);
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.form-input:focus {
  outline: none;
  background: rgba(80, 80, 140, 0.7);
  border-color: rgba(150, 150, 200, 0.6);
  box-shadow: 0 0 20px rgba(123, 125, 255, 0.3);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-btn {
  width: 100%;
  padding: 15px 30px;
  background: #ffffff;
  color: #1a1b3a;
  border: none;
  border-radius: 25px;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px rgba(255, 255, 255, 0.3);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.forgot-password {
  display: block;
  color: rgba(200, 200, 220, 0.8);
  text-decoration: none;
  font-size: 12px;
  transition: color 0.3s ease;
  margin-top: 20px;
}

.forgot-password:hover {
  color: #ffffff;
  text-decoration: underline;
}

.error-message {
  margin-top: 20px;
  padding: 12px 16px;
  background: rgba(255, 100, 100, 0.2);
  border: 1px solid rgba(255, 100, 100, 0.5);
  border-radius: 8px;
  color: #ffb3b3;
  font-size: 13px;
}
</style>
