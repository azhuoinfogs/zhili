<script setup>
import { ref, reactive, onMounted, computed } from 'vue';

const STORAGE_KEYS = { uid: 'zhili_vid', group: 'zhili_group', profile: 'zhili_profile' };

function getOrCreateUserId() {
  let id = localStorage.getItem(STORAGE_KEYS.uid);
  if (!id) {
    id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(STORAGE_KEYS.uid, id);
  }
  return id;
}

function getOrCreateGroup() {
  let g = localStorage.getItem(STORAGE_KEYS.group);
  if (g !== 'A' && g !== 'B') {
    g = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(STORAGE_KEYS.group, g);
  }
  return g;
}

const userId = ref('');
const group = ref('');
const step = ref(0);
const loading = ref(false);
const products = ref([]);
const modalProduct = ref(null);
const seenImp = new Set();

const form = reactive({
  relation: 'friend',
  ageBand: '26-35',
  interests: [],
  occasion: 'birthday',
  budget: '100-300',
  gender: 'unknown',
  taboos: [],
  style: 'practical'
});

const interestOptions = [
  { v: 'tech', l: '科技数码' },
  { v: 'art', l: '文艺生活' },
  { v: 'outdoor', l: '户外运动' },
  { v: 'beauty', l: '美妆护肤' },
  { v: 'home', l: '居家宅人' },
  { v: 'fashion', l: '时尚穿搭' },
  { v: 'food', l: '美食美酒' },
  { v: 'health', l: '健康养生' },
  { v: 'office', l: '职场办公' },
  { v: 'parent', l: '母婴亲子' }
];

const relationLabels = {
  partner: '伴侣',
  family: '家人',
  friend: '朋友',
  colleague: '同事',
  elder: '长辈',
  teacher: '老师',
  client: '客户',
  other: '其他'
};

function track(event, extra = {}) {
  const payload = JSON.stringify({
    event,
    user_id: userId.value,
    group: group.value,
    page_name: 'validate_h5',
    timestamp: Date.now(),
    ...extra
  });
  try {
    fetch('/api/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
}

function toggleInterest(v) {
  const i = form.interests.indexOf(v);
  if (i >= 0) form.interests.splice(i, 1);
  else if (form.interests.length < 3) form.interests.push(v);
  else alert('兴趣最多选3个');
}

function toggleTaboo(v) {
  const i = form.taboos.indexOf(v);
  if (i >= 0) form.taboos.splice(i, 1);
  else form.taboos.push(v);
}

const profilePayload = computed(() => ({
  relation: form.relation,
  ageBand: form.ageBand,
  interests: [...form.interests],
  occasion: form.occasion,
  budget: form.budget,
  gender: form.gender,
  style: form.style || undefined,
  taboos: form.taboos.length ? [...form.taboos] : []
}));

async function submitForm() {
  track('form_submit', { ...profilePayload.value });
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profilePayload.value));
  loading.value = true;
  try {
    if (group.value === 'A') {
      const r = await fetch('/api/hot');
      products.value = await r.json();
    } else {
      const r = await fetch('/api/personalized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload.value)
      });
      products.value = await r.json();
    }
    step.value = 1;
    setupImpressionObserver();
  } finally {
    loading.value = false;
  }
}

let io;
function setupImpressionObserver() {
  seenImp.clear();
  if (io) io.disconnect();
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const id = el.dataset.id;
        const pos = el.dataset.pos;
        if (!id || seenImp.has(id)) return;
        seenImp.add(id);
        track('impression', { product_id: id, position: Number(pos) });
      });
    },
    { root: null, threshold: 0.4 }
  );
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-imp-card]').forEach((el) => io.observe(el));
  });
}

function openDetail(p, pos) {
  track('click', { product_id: p.id, position: pos });
  modalProduct.value = { ...p, _pos: pos };
}

function closeDetail() {
  modalProduct.value = null;
}

function onCollect(p) {
  track('collect', { product_id: p.id });
  alert('已记录收藏（验证环境无账号同步）');
}

function onPurchase(p) {
  track('purchase_click', { product_id: p.id });
  alert('已记录「去购买」点击');
}

onMounted(() => {
  userId.value = getOrCreateUserId();
  group.value = getOrCreateGroup();
  track('page_view', {});
});
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>知礼 · 推荐验证</h1>
      <p class="sub">分组：{{ group === 'A' ? 'A 热门对照' : 'B 个性化' }} · 匿名编号 {{ userId.slice(-8) }}</p>
    </header>

    <main v-if="step === 0" class="card form-card">
      <h2>收礼人画像</h2>
      <label>关系</label>
      <select v-model="form.relation" class="input">
        <option v-for="(l, k) in relationLabels" :key="k" :value="k">{{ l }}</option>
      </select>

      <label>年龄段</label>
      <select v-model="form.ageBand" class="input">
        <option value="under18">&lt;18</option>
        <option value="18-25">18–25</option>
        <option value="26-35">26–35</option>
        <option value="36-45">36–45</option>
        <option value="46plus">46+</option>
      </select>

      <label>收礼人性别</label>
      <select v-model="form.gender" class="input">
        <option value="unknown">未知 / 通用</option>
        <option value="female">女</option>
        <option value="male">男</option>
      </select>

      <label>场合</label>
      <select v-model="form.occasion" class="input">
        <option value="birthday">生日</option>
        <option value="anniversary">纪念日</option>
        <option value="festival">节日</option>
        <option value="thanks">感谢</option>
        <option value="apology">道歉</option>
        <option value="casual">无理由</option>
      </select>

      <label>预算</label>
      <select v-model="form.budget" class="input">
        <option value="lt100">&lt;100</option>
        <option value="100-300">100–300</option>
        <option value="300-500">300–500</option>
        <option value="500-1000">500–1000</option>
        <option value="1000+">1000+</option>
      </select>

      <label>风格</label>
      <select v-model="form.style" class="input">
        <option value="practical">实用</option>
        <option value="ritual">仪式</option>
        <option value="quirky">搞怪</option>
        <option value="warm">温情</option>
      </select>

      <label>兴趣（最多3项，可不选）</label>
      <div class="chips">
        <button
          v-for="o in interestOptions"
          :key="o.v"
          type="button"
          class="chip"
          :class="{ on: form.interests.includes(o.v) }"
          @click="toggleInterest(o.v)"
        >
          {{ o.l }}
        </button>
      </div>

      <label>禁忌（可选）</label>
      <div class="chips">
        <button type="button" class="chip" :class="{ on: form.taboos.includes('smell') }" @click="toggleTaboo('smell')">气味敏感</button>
        <button type="button" class="chip" :class="{ on: form.taboos.includes('religion') }" @click="toggleTaboo('religion')">宗教禁忌</button>
      </div>

      <button class="btn primary" :disabled="loading" @click="submitForm">{{ loading ? '加载中…' : '查看推荐' }}</button>
    </main>

    <main v-else class="list-wrap">
      <button type="button" class="link-back" @click="step = 0">← 修改画像</button>
      <div class="grid">
        <div
          v-for="(p, idx) in products"
          :key="p.id"
          class="card product-card"
          data-imp-card="1"
          :data-id="p.id"
          :data-pos="idx"
          @click="openDetail(p, idx)"
        >
          <img :src="p.image" :alt="p.title" class="thumb" />
          <div class="info">
            <div class="title">{{ p.title }}</div>
            <div class="price">¥{{ p.price }}</div>
            <div class="reason" v-if="p.reasons && p.reasons[0]">{{ p.reasons[0].icon }} {{ p.reasons[0].text }}</div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="modalProduct" class="modal-mask" @click.self="closeDetail">
      <div class="modal card">
        <button type="button" class="modal-close" @click="closeDetail">×</button>
        <img :src="modalProduct.image" class="modal-img" />
        <h3>{{ modalProduct.title }}</h3>
        <p class="price big">¥{{ modalProduct.price }}</p>
        <ul class="reasons">
          <li v-for="(r, i) in modalProduct.reasons" :key="i">{{ r.icon }} {{ r.text }}</li>
        </ul>
        <div class="row">
          <button type="button" class="btn ghost" @click="onCollect(modalProduct)">收藏</button>
          <button type="button" class="btn primary" @click="onPurchase(modalProduct)">去购买</button>
        </div>
      </div>
    </div>

    <footer class="footer">匿名数据仅用于产品优化，不收集姓名与电话。</footer>
  </div>
</template>

<style scoped>
.app {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 16px 16px 48px;
  background: #f8f8f8;
}
.header h1 {
  font-size: 1.25rem;
  color: #1a1a1a;
  margin: 0;
}
.sub {
  font-size: 12px;
  color: #808080;
  margin: 6px 0 16px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.form-card h2 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}
.form-card label {
  display: block;
  margin-top: 12px;
  font-size: 13px;
  color: #555;
}
.input {
  width: 100%;
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 15px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.chip {
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 13px;
}
.chip.on {
  border-color: #ff6b6b;
  color: #ff6b6b;
  background: #fff5f5;
}
.btn {
  width: 100%;
  margin-top: 20px;
  height: 48px;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  cursor: pointer;
}
.btn.primary {
  background: #ff6b6b;
  color: #fff;
}
.btn.ghost {
  background: #fff;
  color: #ff6b6b;
  border: 1px solid #ff6b6b;
}
.row {
  display: flex;
  gap: 12px;
}
.row .btn {
  flex: 1;
}
.link-back {
  background: none;
  border: none;
  color: #ff6b6b;
  margin-bottom: 12px;
  cursor: pointer;
  font-size: 14px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.product-card {
  cursor: pointer;
  padding: 0;
  overflow: hidden;
}
.thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}
.info {
  padding: 8px;
}
.title {
  font-size: 13px;
  color: #1a1a1a;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.price {
  color: #ff6b6b;
  font-weight: 600;
  margin-top: 4px;
  font-size: 14px;
}
.reason {
  font-size: 11px;
  color: #808080;
  margin-top: 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}
.modal {
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  overflow-y: auto;
  position: relative;
  border-radius: 16px 16px 0 0;
}
.modal-close {
  position: absolute;
  right: 12px;
  top: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.modal-img {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
}
.reasons {
  padding-left: 18px;
  color: #444;
  font-size: 14px;
}
.big {
  font-size: 20px;
}
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  color: #aaa;
  padding: 8px;
  background: #f8f8f8;
}
</style>
