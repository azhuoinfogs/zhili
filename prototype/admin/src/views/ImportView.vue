<script setup>
import { ref, onMounted } from 'vue';
import { apiJson } from '../api.js';

const url = ref('');
const platform = ref('jd');
const batchUrls = ref('');
const loading = ref(false);
const batchLoading = ref(false);
const importHistory = ref([]);
const toastMsg = ref('');
const showBatchPanel = ref(false);

const platforms = [
  { value: 'jd', label: '京东' },
  { value: 'taobao', label: '淘宝' },
  { value: 'tmall', label: '天猫' },
];

function showToast(msg) {
  toastMsg.value = msg;
  setTimeout(() => {
    toastMsg.value = '';
  }, 3000);
}

async function doImport() {
  if (!url.value.trim()) {
    showToast('请输入联盟链接');
    return;
  }
  loading.value = true;
  try {
    const result = await apiJson('/import/product', {
      method: 'POST',
      body: JSON.stringify({ url: url.value.trim(), platform: platform.value }),
    });
    if (result.success) {
      showToast('导入成功！');
      url.value = '';
      await fetchHistory();
    } else {
      showToast(result.message || '导入失败');
    }
  } catch (e) {
    showToast('导入失败: ' + e.message);
  } finally {
    loading.value = false;
  }
}

async function doBatchImport() {
  const urls = batchUrls.value
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u);
  if (urls.length === 0) {
    showToast('请输入联盟链接');
    return;
  }
  batchLoading.value = true;
  try {
    const result = await apiJson('/import/products', {
      method: 'POST',
      body: JSON.stringify({ urls, platform: platform.value }),
    });
    if (result.success) {
      showToast(`批量导入完成！成功: ${result.created + result.updated}, 失败: ${result.failed}`);
      batchUrls.value = '';
      await fetchHistory();
    } else {
      showToast(result.message || '批量导入失败');
    }
  } catch (e) {
    showToast('批量导入失败: ' + e.message);
  } finally {
    batchLoading.value = false;
  }
}

async function fetchHistory() {
  try {
    const result = await apiJson('/import/history');
    importHistory.value = result.data || [];
  } catch (e) {
    console.error('获取导入历史失败:', e.message);
  }
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('zh-CN');
}

onMounted(() => {
  fetchHistory();
});
</script>

<template>
  <div class="import-page">
    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    
    <h1>联盟转链商品导入</h1>
    
    <div class="card">
      <h2>单条导入</h2>
      <div class="form-row">
        <label>平台</label>
        <select v-model="platform">
          <option v-for="p in platforms" :key="p.value" :value="p.value">
            {{ p.label }}
          </option>
        </select>
      </div>
      <div class="form-row">
        <label>联盟链接</label>
        <input
          type="text"
          v-model="url"
          placeholder="请输入京东/淘宝/天猫联盟链接"
          @keyup.enter="doImport"
        />
      </div>
      <button class="primary" :disabled="loading" @click="doImport">
        {{ loading ? '导入中...' : '导入商品' }}
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>批量导入</h2>
        <button class="ghost" @click="showBatchPanel = !showBatchPanel">
          {{ showBatchPanel ? '收起' : '展开' }}
        </button>
      </div>
      <div v-if="showBatchPanel">
        <div class="form-row">
          <label>平台</label>
          <select v-model="platform">
            <option v-for="p in platforms" :key="p.value" :value="p.value">
              {{ p.label }}
            </option>
          </select>
        </div>
        <div class="form-row">
          <label>联盟链接列表</label>
          <textarea
            v-model="batchUrls"
            placeholder="每行一个联盟链接&#10;例如：https://union.jd.com/xxx"
            rows="6"
          />
        </div>
        <button class="primary" :disabled="batchLoading" @click="doBatchImport">
          {{ batchLoading ? '导入中...' : '批量导入' }}
        </button>
      </div>
    </div>

    <div class="card">
      <h2>导入历史</h2>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>平台</th>
            <th>原始链接</th>
            <th>商品ID</th>
            <th>状态</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in importHistory" :key="item.id">
            <td>{{ formatDate(item.created_at) }}</td>
            <td>{{ platforms.find(p => p.value === item.platform)?.label || item.platform }}</td>
            <td class="url-cell">{{ item.source_url }}</td>
            <td>{{ item.product_id || '-' }}</td>
            <td>
              <span class="badge" :class="item.status === 'success' ? 'on' : 'off'">
                {{ item.status === 'success' ? '成功' : '失败' }}
              </span>
            </td>
            <td>{{ item.message || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="importHistory.length === 0" class="empty">
        暂无导入记录
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-page {
  max-width: 100%;
}

.toast {
  position: fixed;
  top: 80px;
  right: 20px;
  background: #166534;
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h2 {
  margin: 0;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.form-row label {
  min-width: 100px;
  font-size: 14px;
  padding-top: 8px;
  flex-shrink: 0;
}

.form-row input,
.form-row select,
.form-row textarea {
  flex: 1;
  min-width: 300px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-row textarea {
  resize: vertical;
}

button.primary {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

button.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button.ghost {
  background: #fff;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td {
  border-bottom: 1px solid #eee;
  padding: 10px 12px;
  text-align: left;
}

th {
  background: #f8f9fa;
  font-weight: 600;
}

.url-cell {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  display: inline-block;
  padding: 4px 12px;
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

.empty {
  text-align: center;
  color: #999;
  padding: 40px;
}
</style>
