<script setup>
import { ref, reactive, computed } from 'vue';
import { getUser, updateUserInfo, changePassword, removeAuth } from '../utils/auth.js';

const emit = defineEmits(['logout']);

const user = ref(getUser());
const activeTab = ref('profile'); // profile, password
const loading = ref(false);
const toastMsg = ref('');

const profileForm = reactive({
  nickname: user.value?.nickname || ''
});

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const profileSubTab = ref('favorites'); // favorites, portrait
const favorites = ref([]);
const favoritesLoading = ref(false);

function showToast(msg) {
  toastMsg.value = msg;
  setTimeout(() => {
    toastMsg.value = '';
  }, 2000);
}

const phoneDisplay = computed(() => {
  if (!user.value?.phone) return '';
  const phone = user.value.phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
});

async function saveProfile() {
  loading.value = true;
  try {
    const result = await updateUserInfo(profileForm.nickname, null);
    if (result.ok) {
      user.value = result.user;
      showToast('保存成功');
    } else {
      showToast(result.message || '保存失败');
    }
  } catch (err) {
    showToast('网络异常');
  } finally {
    loading.value = false;
  }
}

async function savePassword() {
  if (!passwordForm.oldPassword) {
    showToast('请输入旧密码');
    return;
  }
  if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
    showToast('新密码至少6位');
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次输入的密码不一致');
    return;
  }
  
  loading.value = true;
  try {
    const result = await changePassword(passwordForm.oldPassword, passwordForm.newPassword);
    if (result.ok) {
      showToast('密码修改成功');
      passwordForm.oldPassword = '';
      passwordForm.newPassword = '';
      passwordForm.confirmPassword = '';
    } else {
      showToast(result.message || '修改失败');
    }
  } catch (err) {
    showToast('网络异常');
  } finally {
    loading.value = false;
  }
}

function handleLogout() {
  removeAuth();
  emit('logout');
}

async function fetchFavorites() {
  favoritesLoading.value = true;
  try {
    const token = localStorage.getItem('zhili_token');
    const res = await fetch('/api/favorite', {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      favorites.value = data.list || [];
    }
  } catch {
    favorites.value = [];
  } finally {
    favoritesLoading.value = false;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

async function removeFavorite(productId) {
  const token = localStorage.getItem('zhili_token');
  try {
    const res = await fetch(`/api/favorite/${productId}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const idx = favorites.value.findIndex(f => f.product_id === productId);
      if (idx >= 0) favorites.value.splice(idx, 1);
      showToast('已取消收藏');
    }
  } catch {
    showToast('操作失败');
  }
}

if (activeTab.value === 'profile' && profileSubTab.value === 'favorites') {
  fetchFavorites();
}
</script>

<template>
  <div class="profile-page">
    <div v-if="toastMsg" class="toast" role="status" aria-live="polite">{{ toastMsg }}</div>
    
    <div class="profile-bg" aria-hidden="true" />
    
    <!-- 用户信息头部 -->
    <section class="profile-header glass">
      <div class="avatar-wrap">
        <div class="avatar">👤</div>
      </div>
      <div class="user-info">
        <h2 class="username font-serif">{{ user?.nickname || '用户' }}</h2>
        <p class="user-phone">{{ phoneDisplay }}</p>
        <p class="user-id">ID: {{ user?.id?.toString().slice(-8) }}</p>
      </div>
      <button class="logout-btn" @click="handleLogout" aria-label="退出登录">退出</button>
    </section>
    
    <!-- 主选项卡 -->
    <section class="main-tabs glass">
      <button 
        class="tab-item" 
        :class="{ active: activeTab === 'profile' }"
        @click="activeTab = 'profile'"
      >
        个人信息
      </button>
      <button 
        class="tab-item" 
        :class="{ active: activeTab === 'password' }"
        @click="activeTab = 'password'"
      >
        修改密码
      </button>
    </section>
    
    <!-- 个人信息内容 -->
    <section v-if="activeTab === 'profile'" class="content glass">
      <!-- 二级导航 -->
      <section class="sub-nav">
        <button 
          class="sub-nav-item" 
          :class="{ active: profileSubTab === 'favorites' }"
          @click="profileSubTab = 'favorites'; fetchFavorites()"
        >
          <span class="sub-nav-icon">♥</span>
          <span class="sub-nav-text">我的收藏</span>
          <span v-if="favorites.length > 0" class="sub-nav-badge">{{ favorites.length }}</span>
        </button>
        <button 
          class="sub-nav-item" 
          :class="{ active: profileSubTab === 'portrait' }"
          @click="profileSubTab = 'portrait'"
        >
          <span class="sub-nav-icon">👤</span>
          <span class="sub-nav-text">编辑资料</span>
        </button>
      </section>
      
      <!-- 收藏列表 -->
      <div v-if="profileSubTab === 'favorites'" class="section-content">
        <header class="section-header">
          <h3 class="font-serif">我的礼遇单</h3>
          <button class="link-ghost" @click="fetchFavorites">刷新</button>
        </header>
        <div v-if="favoritesLoading" class="loading-text">加载中…</div>
        <div v-else-if="favorites.length === 0" class="empty-state">
          <p>暂无收藏</p>
        </div>
        <div v-else class="favorites-list">
          <div v-for="item in favorites" :key="item.product_id" class="favorite-row">
            <div class="favorite-info">
              <span class="favorite-name">{{ item.product_id }}</span>
              <span class="favorite-date">{{ formatDate(item.created_at) }}</span>
            </div>
            <button class="favorite-remove" @click="removeFavorite(item.product_id)">移除</button>
          </div>
        </div>
      </div>
      
      <!-- 编辑资料 -->
      <div v-else-if="profileSubTab === 'portrait'" class="section-content">
        <header class="section-header">
          <h3 class="font-serif">编辑资料</h3>
        </header>
        <form class="edit-form" @submit.prevent="saveProfile">
          <div class="form-group">
            <label for="nickname" class="form-label">昵称</label>
            <input
              id="nickname"
              v-model="profileForm.nickname"
              type="text"
              maxlength="20"
              placeholder="请输入昵称"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <p class="form-value">{{ phoneDisplay }}</p>
          </div>
          <button type="submit" class="cta-gold" :disabled="loading">
            <span v-if="loading" class="btn-spinner" aria-hidden="true" />
            {{ loading ? '保存中…' : '保存' }}
          </button>
        </form>
      </div>
    </section>
    
    <!-- 修改密码内容 -->
    <section v-if="activeTab === 'password'" class="content glass">
      <header class="section-header">
        <h3 class="font-serif">修改密码</h3>
      </header>
      <form class="edit-form" @submit.prevent="savePassword">
        <div class="form-group">
          <label for="oldPassword" class="form-label">旧密码</label>
          <input
            id="oldPassword"
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="请输入旧密码"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="newPassword" class="form-label">新密码</label>
          <input
            id="newPassword"
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="confirmPassword" class="form-label">确认密码</label>
          <input
            id="confirmPassword"
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            class="form-input"
          />
        </div>
        <button type="submit" class="cta-gold" :disabled="loading">
          <span v-if="loading" class="btn-spinner" aria-hidden="true" />
          {{ loading ? '修改中…' : '修改密码' }}
        </button>
      </form>
    </section>
    
    <footer class="profile-foot">知礼遇 · 懂礼更懂你</footer>
  </div>
</template>

<style scoped>
.font-serif {
  font-family: 'Cormorant Garamond', 'Times New Roman', serif;
}

.profile-page {
  min-height: 100vh;
  max-width: 520px;
  margin: 0 auto;
  position: relative;
  padding-bottom: 24px;
}

.toast {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  padding: 11px 22px;
  background: rgba(28, 25, 23, 0.95);
  border: 1px solid rgba(202, 138, 4, 0.35);
  color: #fafaf9;
  font-size: 13px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

.profile-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 60% at 50% -10%, rgba(202, 138, 4, 0.12), transparent 50%),
    linear-gradient(180deg, #1c1917 0%, #0c0a09 40%);
  pointer-events: none;
}

.glass {
  background: rgba(28, 25, 23, 0.55);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  margin: 16px;
}

.profile-header {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-wrap {
  flex-shrink: 0;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(202, 138, 4, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.user-info {
  flex: 1;
}

.username {
  margin: 0;
  font-size: 1.25rem;
  letter-spacing: 0.08em;
}

.user-phone {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a8a29e;
}

.user-id {
  margin: 4px 0 0;
  font-size: 11px;
  color: #78716c;
}

.logout-btn {
  padding: 8px 16px;
  background: none;
  border: 1px solid rgba(220, 38, 38, 0.6);
  color: #dc2626;
  font-size: 12px;
  letter-spacing: 0.08em;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(220, 38, 38, 0.1);
}

.main-tabs {
  display: flex;
  padding: 4px;
  gap: 4px;
}

.tab-item {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  color: #a8a29e;
  font-size: 13px;
  letter-spacing: 0.08em;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-item.active {
  background: rgba(202, 138, 4, 0.15);
  color: #ca8a04;
}

.content {
  padding: 0;
}

.sub-nav {
  display: flex;
  padding: 4px;
  gap: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sub-nav-item {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  color: #a8a29e;
  font-size: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.sub-nav-item.active {
  background: rgba(202, 138, 4, 0.1);
  color: #ca8a04;
}

.sub-nav-icon {
  font-size: 14px;
}

.sub-nav-badge {
  background: #ca8a04;
  color: #0c0a09;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
}

.section-content {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 0.08em;
}

.link-ghost {
  background: none;
  border: none;
  color: #a8a29e;
  font-size: 12px;
  cursor: pointer;
}

.link-ghost:hover {
  color: #ca8a04;
}

.loading-text {
  text-align: center;
  color: #a8a29e;
  padding: 24px;
}

.empty-state {
  text-align: center;
  color: #78716c;
  padding: 32px;
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.favorite-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(12, 10, 9, 0.4);
  border-radius: 2px;
}

.favorite-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.favorite-name {
  font-size: 14px;
}

.favorite-date {
  font-size: 11px;
  color: #78716c;
}

.favorite-remove {
  padding: 6px 12px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a8a29e;
  font-size: 11px;
  border-radius: 2px;
  cursor: pointer;
}

.favorite-remove:hover {
  border-color: #dc2626;
  color: #dc2626;
}

.edit-form {
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
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14px;
  color: #fafaf9;
  background: rgba(12, 10, 9, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.form-input:focus {
  outline: none;
  border-color: rgba(202, 138, 4, 0.6);
}

.form-input::placeholder {
  color: #57534e;
}

.form-value {
  margin: 0;
  padding: 12px 14px;
  background: rgba(12, 10, 9, 0.4);
  border-radius: 2px;
  color: #fafaf9;
  font-size: 14px;
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

.profile-foot {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: #57534e;
  margin-top: 24px;
}
</style>