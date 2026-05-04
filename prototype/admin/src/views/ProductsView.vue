<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiJson } from '../api.js';

const router = useRouter();
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const listed = ref('all');
const keyword = ref('');
const err = ref('');

async function load() {
  err.value = '';
  try {
    const offset = (page.value - 1) * pageSize;
    const q = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    if (listed.value !== 'all') q.set('listed', listed.value === 'on' ? '1' : '0');
    if (keyword.value.trim()) q.set('keyword', keyword.value.trim());
    const data = await apiJson(`/admin/products?${q}`);
    list.value = data.list || [];
    total.value = data.total ?? 0;
  } catch (e) {
    err.value = e.message;
  }
}

onMounted(load);
watch([page, listed], load);

function search() {
  page.value = 1;
  load();
}

async function toggleListed(p) {
  await apiJson(`/admin/products/${encodeURIComponent(p.productId)}`, {
    method: 'PUT',
    body: JSON.stringify({ listed: !p.listed }),
  });
  await load();
}

function confirmDelete(p) {
  if (!confirm(`确定删除商品「${p.title}」（${p.productId}）？此操作不可恢复。`)) return;
  deleteProduct(p);
}

async function deleteProduct(p) {
  await apiJson(`/admin/products/${encodeURIComponent(p.productId)}`, { method: 'DELETE' });
  await load();
}
</script>

<template>
  <div>
    <div class="toolbar card">
      <div class="row">
        <label>上架状态</label>
        <select v-model="listed">
          <option value="all">全部</option>
          <option value="on">仅上架</option>
          <option value="off">仅下架</option>
        </select>
        <label>关键词</label>
        <input v-model="keyword" type="text" placeholder="商品名称" @keyup.enter="search" />
        <button type="button" class="primary" @click="search">筛选</button>
        <button type="button" class="ghost" @click="router.push({ name: 'product-new' })">新增商品</button>
      </div>
      <p v-if="err" class="err">{{ err }}</p>
    </div>
    <div class="card" style="margin-top: 16px">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>价格</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in list" :key="p.productId">
            <td>{{ p.productId }}</td>
            <td>{{ p.title }}</td>
            <td>{{ p.price }}</td>
            <td>
              <span :class="['badge', p.listed ? 'on' : 'off']">{{ p.listed ? '上架' : '下架' }}</span>
            </td>
            <td>
              <button type="button" class="ghost" @click="router.push({ name: 'product-edit', params: { id: p.productId } })">编辑</button>
              <button type="button" class="ghost" @click="toggleListed(p)">{{ p.listed ? '下架' : '上架' }}</button>
              <button type="button" class="danger" @click="confirmDelete(p)">删除</button>
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
</style>
