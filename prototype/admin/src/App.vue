<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getToken, setToken } from './api.js';

const route = useRoute();
const router = useRouter();
const showNav = computed(() => route.name !== 'login' && getToken());

function logout() {
  setToken(null);
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="app">
    <header v-if="showNav" class="top">
      <strong>知礼运营后台</strong>
      <nav>
        <router-link to="/products">商品</router-link>
        <router-link to="/users">用户管理</router-link>
        <router-link to="/import">联盟导入</router-link>
        <router-link to="/dashboard">数据看板</router-link>
        <button type="button" class="link" @click="logout">退出</button>
      </nav>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style>
:root {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #1a1a1a;
  background: #f4f5f7;
}
body {
  margin: 0;
}
.app {
  min-height: 100vh;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #111;
  color: #fff;
}
.top nav {
  display: flex;
  gap: 16px;
  align-items: center;
}
.top a {
  color: #9cf;
  text-decoration: none;
}
.top a.router-link-active {
  color: #fff;
  font-weight: 600;
}
.top .link {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
}
.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 12px;
}
label {
  min-width: 100px;
  font-size: 14px;
}
input[type='text'],
input[type='number'],
input[type='password'],
select,
textarea {
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  min-width: 200px;
}
button.primary {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}
button.danger {
  background: #b91c1c;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
button.ghost {
  background: #fff;
  border: 1px solid #ccc;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.err {
  color: #b91c1c;
  font-size: 14px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th,
td {
  border-bottom: 1px solid #eee;
  padding: 10px 8px;
  text-align: left;
}
th {
  background: #fafafa;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.badge.on {
  background: #dcfce7;
  color: #166534;
}
.badge.off {
  background: #fee2e2;
  color: #991b1b;
}
</style>
