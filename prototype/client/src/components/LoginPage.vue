<script setup>
import { ref, reactive } from 'vue';
import { login } from '../utils/auth.js';

const emit = defineEmits(['login-success', 'go-register']);

const loading = ref(false);
const errorMsg = ref('');

const form = reactive({
  phone: '',
  password: ''
});

async function handleSubmit() {
  errorMsg.value = '';
  
  if (!form.phone) {
    errorMsg.value = '请输入手机号';
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    errorMsg.value = '请输入正确的手机号';
    return;
  }
  
  if (!form.password) {
    errorMsg.value = '请输入密码';
    return;
  }
  
  loading.value = true;
  try {
    const result = await login(form.phone, form.password);
    if (result.ok) {
      emit('login-success');
    } else {
      errorMsg.value = result.message || '登录失败';
    }
  } catch (err) {
    errorMsg.value = '网络异常，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true" />
    
    <div class="login-container glass">
      <header class="login-header">
        <h1 class="login-title font-serif">知礼</h1>
        <p class="login-sub">懂礼更懂你</p>
      </header>
      
      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="phone" class="form-label">手机号</label>
          <input
            id="phone"
            v-model="form.phone"
            type="tel"
            maxlength="11"
            placeholder="请输入手机号"
            class="form-input"
            :disabled="loading"
          />
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            class="form-input"
            :disabled="loading"
          />
        </div>
        
        <div v-if="errorMsg" class="error-message">{{ errorMsg }}</div>
        
        <button type="submit" class="cta-gold" :disabled="loading">
          <span v-if="loading" class="btn-spinner" aria-hidden="true" />
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>
      
      <footer class="login-footer">
        <p class="register-link">
          还没有账号？
          <button type="button" class="link-gold" @click="emit('go-register')">立即注册</button>
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.font-serif {
  font-family: 'Cormorant Garamond', 'Times New Roman', serif;
}

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(202, 138, 4, 0.15), transparent 55%),
    radial-gradient(ellipse 80% 50% at 100% 60%, rgba(202, 138, 4, 0.05), transparent 45%),
    linear-gradient(180deg, #1c1917 0%, #0c0a09 55%);
  pointer-events: none;
}

.login-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  padding: 32px;
  border-radius: 4px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-title {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 500;
  letter-spacing: 0.15em;
}

.login-sub {
  margin: 8px 0 0;
  font-size: 1rem;
  color: #a8a29e;
  letter-spacing: 0.15em;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #a8a29e;
  margin-bottom: 8px;
}

.form-input {
  padding: 14px 16px;
  font-family: inherit;
  font-size: 14px;
  color: #fafaf9;
  background: rgba(12, 10, 9, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: rgba(202, 138, 4, 0.6);
}

.form-input::placeholder {
  color: #57534e;
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #dc2626;
  font-size: 12px;
  padding: 8px 0;
  text-align: center;
}

.cta-gold {
  margin-top: 8px;
  padding: 14px 24px;
  font-family: 'Montserrat', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #0c0a09;
  background: #ca8a04;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition:
    background 0.35s ease,
    box-shadow 0.35s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.cta-gold:hover:not(:disabled) {
  background: #eab308;
  box-shadow: 0 0 30px rgba(202, 138, 4, 0.3);
}

.cta-gold:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(12, 10, 9, 0.3);
  border-top-color: #0c0a09;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

.register-link {
  margin: 0;
  font-size: 13px;
  color: #a8a29e;
}

.link-gold {
  background: none;
  border: none;
  color: #ca8a04;
  font-size: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.link-gold:hover {
  color: #eab308;
}

.glass {
  background: rgba(28, 25, 23, 0.6);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}
</style>