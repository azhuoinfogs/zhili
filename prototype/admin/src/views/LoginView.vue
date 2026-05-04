<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { setToken } from '../api.js';

const password = ref('');
const err = ref('');
const router = useRouter();

async function submit() {
  err.value = '';
  try {
    const r = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      err.value = j.message || '登录失败';
      return;
    }
    setToken(j.token);
    router.replace('/products');
  } catch (e) {
    err.value = e.message || '网络错误';
  }
}
</script>

<template>
  <div class="card" style="max-width: 400px; margin: 48px auto">
    <h1>运营登录</h1>
    <p class="hint">
      密码须与 <code>prototype/server/.env</code> 中的
      <code>ZHILI_ADMIN_CONSOLE_PASSWORD</code> 一致；修改后需<strong>重启</strong> API（<code>npm start</code>）。
    </p>
    <form @submit.prevent="submit">
      <div class="row">
        <label>密码</label>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </div>
      <p v-if="err" class="err">{{ err }}</p>
      <button type="submit" class="primary">进入后台</button>
    </form>
  </div>
</template>

<style scoped>
h1 {
  font-size: 1.25rem;
  margin-top: 0;
}
.hint {
  font-size: 13px;
  color: #666;
}
code {
  font-size: 12px;
}
</style>
