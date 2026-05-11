<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { getUser, updateUserInfo, changePassword, removeAuth } from '../utils/auth.js';

const emit = defineEmits(['logout']);

const user = ref(getUser());
const activeTab = ref('profile'); // profile, password, orders, addresses
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

const favorites = ref([]);
const favoritesLoading = ref(false);

const orders = ref([]);
const ordersLoading = ref(false);

const addresses = ref([]);
const addressesLoading = ref(false);
const editingAddress = ref(null);

const addressForm = reactive({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: ''
});

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
  if (confirm('确定要退出登录吗？')) {
    removeAuth();
    emit('logout');
  }
}

async function fetchFavorites() {
  favoritesLoading.value = true;
  try {
    const token = localStorage.getItem('zhili_token');
    const res = await fetch('/api/favorite', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
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

async function fetchOrders() {
  ordersLoading.value = true;
  try {
    const token = localStorage.getItem('zhili_token');
    const res = await fetch('/api/order', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      orders.value = data.list || [];
    }
  } catch {
    orders.value = [];
  } finally {
    ordersLoading.value = false;
  }
}

async function fetchAddresses() {
  addressesLoading.value = true;
  try {
    const token = localStorage.getItem('zhili_token');
    const res = await fetch('/api/address', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      addresses.value = data.list || [];
    }
  } catch {
    addresses.value = [];
  } finally {
    addressesLoading.value = false;
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

async function saveAddress() {
  if (!addressForm.name || !addressForm.phone || !addressForm.detail) {
    showToast('请填写完整信息');
    return;
  }
  
  const token = localStorage.getItem('zhili_token');
  const method = editingAddress.value ? 'PUT' : 'POST';
  const url = editingAddress.value ? `/api/address/${editingAddress.value.id}` : '/api/address';
  
  try {
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: addressForm.name,
        phone: addressForm.phone,
        province: addressForm.province || '',
        city: addressForm.city || '',
        district: addressForm.district || '',
        detail: addressForm.detail
      })
    });
    if (res.ok) {
      showToast(editingAddress.value ? '修改成功' : '添加成功');
      resetAddressForm();
      await fetchAddresses();
    } else {
      showToast('操作失败');
    }
  } catch {
    showToast('网络异常');
  }
}

function resetAddressForm() {
  addressForm.name = '';
  addressForm.phone = '';
  addressForm.province = '';
  addressForm.city = '';
  addressForm.district = '';
  addressForm.detail = '';
  editingAddress.value = null;
}

function editAddress(addr) {
  editingAddress.value = addr;
  addressForm.name = addr.name;
  addressForm.phone = addr.phone;
  addressForm.province = addr.province || '';
  addressForm.city = addr.city || '';
  addressForm.district = addr.district || '';
  addressForm.detail = addr.detail;
}

async function deleteAddress(id) {
  if (!confirm('确定要删除这个地址吗？')) return;
  
  const token = localStorage.getItem('zhili_token');
  try {
    const res = await fetch(`/api/address/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      addresses.value = addresses.value.filter(a => a.id !== id);
      showToast('删除成功');
    }
  } catch {
    showToast('操作失败');
  }
}

const menuItems = [
  { icon: '📦', title: '我的订单', subtitle: '查看全部订单', key: 'orders' },
  { icon: '❤️', title: '我的收藏', subtitle: '收藏的礼品', key: 'favorites' },
  { icon: '🕐', title: '浏览历史', subtitle: '最近浏览', key: 'history' },
  { icon: '📍', title: '收货地址', subtitle: '管理收货地址', key: 'addresses' },
  { icon: '🔔', title: '消息通知', subtitle: '系统消息', key: 'notifications' },
  { icon: '⚙️', title: '设置', subtitle: '账号与安全', key: 'settings' }
];

const orderStats = [
  { label: '待付款', count: 0 },
  { label: '待发货', count: 0 },
  { label: '待收货', count: 0 },
  { label: '待评价', count: 0 }
];

onMounted(() => {
  fetchFavorites();
});
</script>

<template>
  <div class="profile-page">
    <div v-if="toastMsg" class="toast" role="status" aria-live="polite">{{ toastMsg }}</div>
    
    <!-- 主页面内容 -->
    <template v-if="activeTab === 'profile'">
      <!-- 用户信息头部 -->
      <section class="profile-header">
        <div class="profile-bg" aria-hidden="true"></div>
        <div class="profile-info">
          <div class="avatar-wrap">
            <div class="avatar">{{ user?.nickname?.charAt(0) || 'U' }}</div>
          </div>
          <div class="user-info">
            <h2 class="username font-serif">{{ user?.nickname || '用户' }}</h2>
            <p class="user-phone">{{ phoneDisplay || '未绑定手机' }}</p>
          </div>
          <button class="edit-btn" @click="activeTab = 'settings'">编辑</button>
        </div>
        
        <!-- 订单统计 -->
        <div class="order-stats">
          <div v-for="stat in orderStats" :key="stat.label" class="stat-item">
            <span class="stat-count">{{ stat.count }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </section>
      
      <!-- 菜单项 -->
      <section class="menu-section glass">
        <div 
          v-for="(item, index) in menuItems" 
          :key="item.key"
          class="menu-item"
          :class="{ 'menu-divider': index === 3 }"
          @click="activeTab = item.key"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <div class="menu-content">
            <span class="menu-title">{{ item.title }}</span>
            <span class="menu-subtitle">{{ item.subtitle }}</span>
          </div>
          <span class="menu-arrow">›</span>
        </div>
      </section>
      
      <footer class="profile-foot">知礼遇 · 懂礼更懂你</footer>
    </template>
    
    <!-- 二级页面内容 -->
    <template v-else>
      <!-- 我的订单 -->
      <section v-if="activeTab === 'orders'" class="content glass full-page">
      <header class="section-header">
        <button class="back-btn" @click="activeTab = 'profile'">← 返回</button>
        <h3 class="font-serif">我的订单</h3>
        <div class="placeholder"></div>
      </header>
      <div v-if="ordersLoading" class="loading-text">加载中…</div>
      <div v-else-if="orders.length === 0" class="empty-state">
        <p>暂无订单</p>
      </div>
      <div v-else class="orders-list">
        <div v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-header">
            <span class="order-id">订单号: {{ order.id }}</span>
            <span class="order-status">{{ order.status }}</span>
          </div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.product_id" class="order-item">
              <img :src="item.image" class="order-item-img" />
              <div class="order-item-info">
                <span class="order-item-name">{{ item.name }}</span>
                <span class="order-item-price">¥{{ item.price }}</span>
              </div>
            </div>
          </div>
          <div class="order-footer">
            <span class="order-total">合计: ¥{{ order.total }}</span>
            <button class="order-btn">去支付</button>
          </div>
        </div>
      </div>
    </section>
    
    <!-- 我的收藏 -->
    <section v-if="activeTab === 'favorites'" class="content glass full-page">
      <header class="section-header">
        <button class="back-btn" @click="activeTab = 'profile'">← 返回</button>
        <h3 class="font-serif">我的收藏</h3>
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
    </section>
    
    <!-- 浏览历史 -->
    <section v-if="activeTab === 'history'" class="content glass full-page">
      <header class="section-header">
        <button class="back-btn" @click="activeTab = 'profile'">← 返回</button>
        <h3 class="font-serif">浏览历史</h3>
        <div class="placeholder"></div>
      </header>
      <div class="empty-state">
        <p>暂无浏览记录</p>
      </div>
    </section>
    
    <!-- 收货地址 -->
    <section v-if="activeTab === 'addresses'" class="content glass full-page">
      <header class="section-header">
        <button class="back-btn" @click="activeTab = 'profile'">← 返回</button>
        <h3 class="font-serif">收货地址</h3>
        <button class="add-btn" @click="resetAddressForm()">+ 新增</button>
      </header>
      
      <!-- 地址表单 -->
      <div v-if="addressForm.name || addressForm.phone || addressForm.detail" class="address-form">
        <div class="form-group">
          <label class="form-label">收货人</label>
          <input v-model="addressForm.name" type="text" placeholder="请输入收货人姓名" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input v-model="addressForm.phone" type="tel" placeholder="请输入手机号" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">详细地址</label>
          <textarea v-model="addressForm.detail" placeholder="请输入详细地址" class="form-textarea"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-outline" @click="resetAddressForm()">取消</button>
          <button class="btn-primary" @click="saveAddress()">{{ editingAddress ? '保存修改' : '添加地址' }}</button>
        </div>
      </div>
      
      <div v-if="addressesLoading" class="loading-text">加载中…</div>
      <div v-else-if="addresses.length === 0 && !addressForm.name" class="empty-state">
        <p>暂无收货地址</p>
      </div>
      <div v-else class="addresses-list">
        <div v-for="addr in addresses" :key="addr.id" class="address-item">
          <div class="address-header">
            <span class="address-name">{{ addr.name }}</span>
            <span class="address-phone">{{ addr.phone }}</span>
          </div>
          <p class="address-detail">{{ addr.detail }}</p>
          <div class="address-actions">
            <button class="addr-btn" @click="editAddress(addr)">编辑</button>
            <button class="addr-btn delete" @click="deleteAddress(addr.id)">删除</button>
          </div>
        </div>
      </div>
    </section>
    
    <!-- 消息通知 -->
    <section v-if="activeTab === 'notifications'" class="content glass full-page">
      <header class="section-header">
        <button class="back-btn" @click="activeTab = 'profile'">← 返回</button>
        <h3 class="font-serif">消息通知</h3>
        <div class="placeholder"></div>
      </header>
      <div class="empty-state">
        <p>暂无消息</p>
      </div>
    </section>
    
    <!-- 设置 -->
    <section v-if="activeTab === 'settings'" class="content glass full-page">
      <header class="section-header">
        <button class="back-btn" @click="activeTab = 'profile'">← 返回</button>
        <h3 class="font-serif">账号与安全</h3>
        <div class="placeholder"></div>
      </header>
      
      <div class="settings-section">
        <h4 class="settings-title">个人信息</h4>
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
          <button type="submit" class="btn-primary" :disabled="loading">
            <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
            {{ loading ? '保存中…' : '保存' }}
          </button>
        </form>
      </div>
      
      <div class="settings-section">
        <h4 class="settings-title">密码安全</h4>
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
          <button type="submit" class="btn-primary" :disabled="loading">
            <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
            {{ loading ? '修改中…' : '修改密码' }}
          </button>
        </form>
      </div>
      
      <button class="logout-btn" @click="handleLogout">
        <span class="logout-icon">↩️</span>
        <span>退出登录</span>
      </button>
    </section>
    
    </template>
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
  background: #0c0a09;
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

.profile-header {
  position: relative;
  padding: 24px 16px 16px;
}

.profile-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #ca8a04 0%, #a16207 100%);
  pointer-events: none;
}

.profile-info {
  position: relative;
  z-index: 1;
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
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  font-weight: 600;
}

.user-info {
  flex: 1;
}

.username {
  margin: 0;
  font-size: 1.25rem;
  letter-spacing: 0.08em;
  color: #fff;
}

.user-phone {
  margin: 4px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.edit-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.edit-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.order-stats {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-around;
  margin-top: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border-radius: 12px;
}

.stat-item {
  text-align: center;
}

.stat-count {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}

.glass {
  background: rgba(28, 25, 23, 0.55);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  margin: 12px 16px;
}

.menu-section {
  padding: 8px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.menu-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.menu-icon {
  font-size: 1.25rem;
  margin-right: 12px;
}

.menu-content {
  flex: 1;
}

.menu-title {
  display: block;
  font-size: 14px;
  color: #fafaf9;
}

.menu-subtitle {
  display: block;
  font-size: 11px;
  color: #78716c;
  margin-top: 2px;
}

.menu-arrow {
  font-size: 18px;
  color: #78716c;
}

.content {
  padding: 0;
}

.content.full-page {
  min-height: calc(100vh - 56px);
  margin-top: 0;
  border-radius: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.back-btn {
  background: none;
  border: none;
  color: #ca8a04;
  font-size: 13px;
  cursor: pointer;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: #fafaf9;
}

.placeholder {
  width: 60px;
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

.add-btn {
  background: rgba(202, 138, 4, 0.15);
  border: 1px solid rgba(202, 138, 4, 0.3);
  border-radius: 999px;
  color: #ca8a04;
  font-size: 12px;
  padding: 6px 14px;
  cursor: pointer;
}

.loading-text {
  text-align: center;
  color: #a8a29e;
  padding: 24px;
}

.empty-state {
  text-align: center;
  color: #78716c;
  padding: 48px 24px;
}

.empty-state p {
  margin: 0;
}

.favorites-list {
  padding: 12px;
}

.favorite-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(12, 10, 9, 0.4);
  border-radius: 4px;
  margin-bottom: 8px;
}

.favorite-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.favorite-name {
  font-size: 14px;
  color: #fafaf9;
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
  border-radius: 4px;
  cursor: pointer;
}

.favorite-remove:hover {
  border-color: #dc2626;
  color: #dc2626;
}

.settings-section {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-section:last-of-type {
  border-bottom: none;
}

.settings-title {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #a8a29e;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  margin-bottom: 6px;
}

.form-input {
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14px;
  color: #fafaf9;
  background: rgba(12, 10, 9, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.form-input:focus {
  outline: none;
  border-color: rgba(202, 138, 4, 0.6);
}

.form-input::placeholder {
  color: #57534e;
}

.form-textarea {
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14px;
  color: #fafaf9;
  background: rgba(12, 10, 9, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  min-height: 80px;
  resize: vertical;
}

.form-textarea:focus {
  outline: none;
  border-color: rgba(202, 138, 4, 0.6);
}

.form-value {
  margin: 0;
  padding: 12px 14px;
  background: rgba(12, 10, 9, 0.4);
  border-radius: 4px;
  color: #fafaf9;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.btn-outline {
  flex: 1;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #a8a29e;
  font-size: 13px;
  cursor: pointer;
}

.btn-primary {
  flex: 2;
  padding: 12px;
  background: #ca8a04;
  border: none;
  border-radius: 4px;
  color: #0c0a09;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover:not(:disabled) {
  background: #eab308;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(12, 10, 9, 0.3);
  border-top-color: #0c0a09;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 32px);
  margin: 16px;
  padding: 14px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 4px;
  color: #dc2626;
  font-size: 14px;
  cursor: pointer;
}

.logout-btn:hover {
  background: rgba(220, 38, 38, 0.15);
}

.logout-icon {
  font-size: 16px;
}

.addresses-list {
  padding: 12px;
}

.address-item {
  padding: 14px;
  background: rgba(12, 10, 9, 0.4);
  border-radius: 4px;
  margin-bottom: 10px;
}

.address-header {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
}

.address-name {
  font-size: 14px;
  font-weight: 500;
  color: #fafaf9;
}

.address-phone {
  font-size: 13px;
  color: #a8a29e;
}

.address-detail {
  margin: 0;
  font-size: 13px;
  color: #a8a29e;
  line-height: 1.5;
}

.address-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}

.addr-btn {
  padding: 6px 14px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #a8a29e;
  font-size: 12px;
  cursor: pointer;
}

.addr-btn:hover {
  border-color: #ca8a04;
  color: #ca8a04;
}

.addr-btn.delete:hover {
  border-color: #dc2626;
  color: #dc2626;
}

.orders-list {
  padding: 12px;
}

.order-card {
  background: rgba(12, 10, 9, 0.4);
  border-radius: 4px;
  padding: 14px;
  margin-bottom: 12px;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-id {
  font-size: 11px;
  color: #78716c;
}

.order-status {
  font-size: 12px;
  color: #ca8a04;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-item {
  display: flex;
  gap: 12px;
}

.order-item-img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
}

.order-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.order-item-name {
  font-size: 13px;
  color: #fafaf9;
}

.order-item-price {
  font-size: 14px;
  font-weight: 500;
  color: #ca8a04;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.order-total {
  font-size: 13px;
  color: #fafaf9;
}

.order-btn {
  padding: 8px 20px;
  background: #ca8a04;
  border: none;
  border-radius: 999px;
  color: #0c0a09;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.order-btn:hover {
  background: #eab308;
}

.address-form {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.profile-foot {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: #57534e;
  margin-top: 24px;
}
</style>
