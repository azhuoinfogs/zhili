<script setup>
import { ref, reactive } from 'vue';
import { register, sendCode } from '../utils/auth.js';

const emit = defineEmits(['register-success', 'go-login']);
const loading = ref(false);
const codeLoading = ref(false);
const errorMsg = ref('');
const codeCountdown = ref(0);
let countdownTimer = null;

const form = reactive({
  phone: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  code: ''
});

function startCountdown() {
  codeCountdown.value = 60;
  countdownTimer = setInterval(() => {
    codeCountdown.value--;
    if (codeCountdown.value <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

async function handleSendCode() {
  if (!form.phone) {
    errorMsg.value = '请输入手机号';
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    errorMsg.value = '请输入正确的手机号';
    return;
  }
  
  codeLoading.value = true;
  try {
    const result = await sendCode(form.phone);
    if (result.ok) {
      startCountdown();
      errorMsg.value = '';
    } else {
      errorMsg.value = result.message || '发送失败';
    }
  } catch (err) {
    errorMsg.value = '网络异常，请稍后重试';
  } finally {
    codeLoading.value = false;
  }
}

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
  if (!form.code || form.code.length !== 6) {
    errorMsg.value = '请输入6位验证码';
    return;
  }
  if (!form.password) {
    errorMsg.value = '请输入密码';
    return;
  }
  if (form.password.length < 6) {
    errorMsg.value = '密码长度不能少于6位';
    return;
  }
  if (form.password !== form.confirmPassword) {
    errorMsg.value = '两次输入的密码不一致';
    return;
  }
  
  loading.value = true;
  try {
    const result = await register(form.phone, form.password, form.nickname, form.code);
    if (result.ok) {
      emit('register-success');
    } else {
      errorMsg.value = result.message || '注册失败';
    }
  } catch (err) {
    errorMsg.value = '网络异常，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="register-page">
    <div class="register-bg" aria-hidden="true"></div>
    
    <div class="register-container glass">
      <header class="register-header">
        <h1 class="register-title font-serif">知礼</h1>
        <p class="register-sub">开启礼遇之旅</p>
      </header>
      
      <form class="register-form" @submit.prevent="handleSubmit">
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
          <label for="code" class="form-label">验证码</label>
          <div class="code-input-group">
            <input
              id="code"
              v-model="form.code"
              type="tel"
              maxlength="6"
              placeholder="请输入验证码"
              class="form-input code-input"
              :disabled="loading"
            />
            <button
              type="button"
              class="code-btn"
              :disabled="loading || codeLoading || codeCountdown > 0"
              @click="handleSendCode"
            >
              {{ codeCountdown > 0 ? `${codeCountdown}s` : (codeLoading ? '发送中…' : '获取验证码') }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="nickname" class="form-label">昵称</label>
          <input
            id="nickname"
            v-model="form.nickname"
            type="text"
            maxlength="20"
            placeholder="请输入昵称（选填）"
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
            placeholder="请输入密码（至少6位）"
            class="form-input"
            :disabled="loading"
          />
        </div>
        
        <div class="form-group">
          <label for="confirmPassword" class="form-label">确认密码</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            class="form-input"
            :disabled="loading"
          />
        </div>
        
        <div v-if="errorMsg" class="error-message">{{ errorMsg }}</div>
        
        <button type="submit" class="cta-gold" :disabled="loading">
          <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
          {{ loading ? '注册中…' : '注册' }}
        </button>
      </form>
      
      <footer class="register-footer">
        <p class="login-link">
          已有账号？
          <button type="button" class="link-gold" @click="emit('go-login')">立即登录</button>
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.font-serif {
  font-family: 'Cormorant Garamond', 'Times New Roman', serif;
}

.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.register-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(202, 138, 4, 0.15), transparent 55%),
    radial-gradient(ellipse 80% 50% at 100% 60%, rgba(202, 138, 4, 0.05), transparent 45%),
    linear-gradient(180deg, #1c1917 0%, #0c0a09 55%);
  pointer-events: none;
}

.register-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  padding: 32px;
  border-radius: 4px;
}

.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-title {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 500;
  letter-spacing: 0.15em;
}

.register-sub {
  margin: 8px 0 0;
  font-size: 1rem;
  color: #a8a29e;
  letter-spacing: 0.15em;
}

.register-form {
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

.code-input-group {
  display: flex;
  gap: 10px;
}

.code-input {
  flex: 1;
}

.code-btn {
  padding: 14px 16px;
  background: rgba(202, 138, 4, 0.15);
  border: 1px solid rgba(202, 138, 4, 0.3);
  border-radius: 2px;
  color: #ca8a04;
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.code-btn:hover:not(:disabled) {
  background: rgba(202, 138, 4, 0.25);
  border-color: rgba(202, 138, 4, 0.5);
}

.code-btn:disabled {
  opacity: 0.5;
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

.register-footer {
  margin-top: 24px;
  text-align: center;
}

.login-link {
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
