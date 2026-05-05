<script setup>
import { ref, watch, onMounted } from 'vue';
import { apiJson } from '../api.js';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const keyword = ref('');
const err = ref('');
const selectedUser = ref(null);

async function load() {
  err.value = '';
  try {
    const offset = (page.value - 1) * pageSize;
    const q = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    if (keyword.value.trim()) q.set('keyword', keyword.value.trim());
    const data = await apiJson(`/admin/users?${q}`);
    list.value = data.list || [];
    total.value = data.total ?? 0;
  } catch (e) {
    err.value = e.message;
  }
}

onMounted(load);
watch([page], load);

function search() {
  page.value = 1;
  load();
}

async function viewUser(u) {
  try {
    const data = await apiJson(`/admin/users/${u.id}`);
    selectedUser.value = data;
  } catch (e) {
    err.value = e.message;
  }
}

function closeModal() {
  selectedUser.value = null;
}

async function confirmDelete(u) {
  if (!confirm(`确定删除用户 ID: ${u.id}？此操作不可恢复。`)) return;
  try {
    await apiJson(`/admin/users/${u.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    err.value = e.message;
  }
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('zh-CN');
}

function formatJSON(obj) {
  if (!obj) return '-';
  if (typeof obj === 'string') {
    try {
      return JSON.stringify(JSON.parse(obj), null, 2);
    } catch {
      return obj;
    }
  }
  return JSON.stringify(obj, null, 2);
}

function getRelationLabel(r) {
  const map = {
    friend: '朋友',
    partner: '伴侣',
    family: '家人',
    colleague: '同事',
    elder: '长辈',
    teacher: '老师',
    client: '客户',
    other: '其他',
  };
  return map[r] || r;
}

function getGenderLabel(g) {
  const map = { male: '男', female: '女', unknown: '未知' };
  return map[g] || g;
}

function getAgeBandLabel(a) {
  const map = {
    under18: '18岁以下',
    '18-25': '18-25岁',
    '26-35': '26-35岁',
    '36-45': '36-45岁',
    '46plus': '46岁以上',
  };
  return map[a] || a;
}

function getBudgetLabel(b) {
  const map = {
    lt100: '100元以下',
    '100-300': '100-300元',
    '300-500': '300-500元',
    '500-1000': '500-1000元',
    '1000+': '1000元以上',
  };
  return map[b] || b;
}
</script>

<template>
  <div>
    <div class="toolbar card">
      <div class="row">
        <label>关键词</label>
        <input v-model="keyword" type="text" placeholder="用户ID、openid或匿名ID" @keyup.enter="search" />
        <button type="button" class="primary" @click="search">筛选</button>
      </div>
      <p v-if="err" class="err">{{ err }}</p>
    </div>
    <div class="card" style="margin-top: 16px">
      <table>
        <thead>
          <tr>
            <th>用户ID</th>
            <th>OpenID</th>
            <th>匿名ID</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.openid || '-' }}</td>
            <td>{{ u.anon_id || '-' }}</td>
            <td>{{ formatDate(u.created_at) }}</td>
            <td>
              <button type="button" class="ghost" @click="viewUser(u)">查看详情</button>
              <button type="button" class="danger" @click="confirmDelete(u)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!list.length" style="color: #888">暂无数据</p>
      <div class="pager">
        <button type="button" class="ghost" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} 页 / 共 {{ Math.max(1, Math.ceil(total / pageSize)) }} 页（{{ total }} 条）</span>
        <button type="button" class="ghost" :disabled="page * pageSize >= total" @click="page++; load()">下一页</button>
      </div>
    </div>

    <div v-if="selectedUser" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>用户详情 - ID: {{ selectedUser.user.id }}</h3>
          <button type="button" class="close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-row"><span class="label">OpenID:</span> <span>{{ selectedUser.user.openid || '-' }}</span></div>
            <div class="detail-row"><span class="label">匿名ID:</span> <span>{{ selectedUser.user.anon_id || '-' }}</span></div>
            <div class="detail-row"><span class="label">创建时间:</span> <span>{{ formatDate(selectedUser.user.created_at) }}</span></div>
            <div class="detail-row"><span class="label">更新时间:</span> <span>{{ formatDate(selectedUser.user.updated_at) }}</span></div>
          </div>
          
          <div class="detail-section">
            <h4>用户画像列表</h4>
            <div v-if="!selectedUser.profiles || selectedUser.profiles.length === 0" class="empty">暂无画像</div>
            <div v-for="p in selectedUser.profiles" :key="p.id" class="profile-card">
              <div class="profile-header">
                <span>{{ p.name || '未命名画像' }}</span>
                <span v-if="p.is_default" class="badge on">默认</span>
              </div>
              <div class="profile-body">
                <div class="profile-row"><span class="label">关系:</span> <span>{{ getRelationLabel(p.relation) }}</span></div>
                <div class="profile-row"><span class="label">性别:</span> <span>{{ getGenderLabel(p.gender) }}</span></div>
                <div class="profile-row"><span class="label">年龄:</span> <span>{{ getAgeBandLabel(p.age_band) }}</span></div>
                <div class="profile-row"><span class="label">预算:</span> <span>{{ getBudgetLabel(p.budget) }}</span></div>
                <div class="profile-row"><span class="label">场合:</span> <span>{{ p.occasion || '-' }}</span></div>
                <div class="profile-row"><span class="label">风格:</span> <span>{{ p.style || '-' }}</span></div>
                <div class="profile-row"><span class="label">兴趣:</span> <span>{{ formatJSON(p.interests) }}</span></div>
                <div class="profile-row"><span class="label">禁忌:</span> <span>{{ formatJSON(p.taboos) }}</span></div>
                <div class="profile-row"><span class="label">创建时间:</span> <span>{{ formatDate(p.created_at) }}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="ghost" @click="closeModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 0;
}
.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  font-size: 14px;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 10px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background: #f8fafc;
}
.modal-header h3 {
  margin: 0;
}
.modal-header .close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0 8px;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
}
.detail-section {
  margin-bottom: 20px;
}
.detail-section h4 {
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  color: #333;
}
.detail-row {
  display: flex;
  padding: 6px 0;
}
.detail-row .label {
  min-width: 100px;
  color: #666;
  font-size: 14px;
}
.empty {
  color: #888;
  padding: 20px;
  text-align: center;
}
.profile-card {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
}
.profile-body {
  background: #fafafa;
  padding: 8px;
  border-radius: 4px;
}
.profile-row {
  display: flex;
  padding: 4px 0;
  font-size: 13px;
}
.profile-row .label {
  min-width: 70px;
  color: #666;
}
pre {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-size: 12px;
}
</style>