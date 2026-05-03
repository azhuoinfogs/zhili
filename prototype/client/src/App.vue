<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';

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
const toastMsg = ref('');
let toastTimer = null;
let io = null;

function showToast(msg) {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg.value = '';
  }, 2000);
}

/** 列表页筛选（PRD F2），与画像默认值同步后可独立修改 */
const listFilters = reactive({
  occasion: 'birthday',
  budget: '100-300',
  style: 'practical'
});
let debounceTimer = null;

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
  else showToast('兴趣最多选 3 个');
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

function shelfQueryString() {
  const q = new URLSearchParams();
  if (listFilters.occasion) q.set('occasion', listFilters.occasion);
  if (listFilters.budget) q.set('budget', listFilters.budget);
  if (listFilters.style) q.set('style', listFilters.style);
  return q.toString();
}

async function fetchRecommendations() {
  loading.value = true;
  try {
    const shelf = {
      occasion: listFilters.occasion || '',
      budget: listFilters.budget || '',
      style: listFilters.style || ''
    };
    if (group.value === 'A') {
      const qs = shelfQueryString();
      const r = await fetch('/api/hot' + (qs ? '?' + qs : ''));
      products.value = await r.json();
    } else {
      const r = await fetch('/api/personalized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profilePayload.value, shelf })
      });
      products.value = await r.json();
    }
    setupImpressionObserver();
  } finally {
    loading.value = false;
  }
}

function scheduleRefetch() {
  if (step.value !== 1) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchRecommendations();
  }, 500);
}

watch(
  listFilters,
  () => {
    scheduleRefetch();
  },
  { deep: true }
);

async function submitForm() {
  track('form_submit', { ...profilePayload.value });
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profilePayload.value));
  listFilters.occasion = form.occasion;
  listFilters.budget = form.budget;
  listFilters.style = form.style;
  step.value = 1;
  await fetchRecommendations();
}

function clearListFilters() {
  listFilters.occasion = '';
  listFilters.budget = '';
  listFilters.style = '';
}

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
  showToast('已记录收藏');
}

function onPurchase(p) {
  track('purchase_click', { product_id: p.id });
  showToast('已记录去购买（验证环境）');
}

onMounted(() => {
  userId.value = getOrCreateUserId();
  group.value = getOrCreateGroup();
  track('page_view', {});
});

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer);
  if (io) io.disconnect();
});
</script>

<template>
  <div class="app">
    <header class="header hero">
      <p class="brand-mark" aria-hidden="true">礼</p>
      <div class="hero-text">
        <h1>知礼</h1>
        <p class="tagline">懂礼更懂你</p>
        <div class="hero-meta">
          <span class="pill" :class="group === 'A' ? 'pill-a' : 'pill-b'">{{ group === 'A' ? '对照组 · 热门' : '实验组 · 个性化' }}</span>
          <span class="anon">匿名 {{ userId.slice(-8) }}</span>
        </div>
      </div>
    </header>

    <div v-if="toastMsg" class="toast" role="status" aria-live="polite">{{ toastMsg }}</div>

    <main v-if="step === 0" class="card form-card">
      <h2 class="section-title">收礼人画像</h2>
      <p class="section-desc">先填关键信息，AI 按场合与预算帮你缩小选择范围。</p>
      <label for="fld-relation">关系</label>
      <select id="fld-relation" v-model="form.relation" class="input" autocomplete="off">
        <option v-for="(l, k) in relationLabels" :key="k" :value="k">{{ l }}</option>
      </select>

      <label for="fld-age">年龄段</label>
      <select id="fld-age" v-model="form.ageBand" class="input" autocomplete="off">
        <option value="under18">&lt;18</option>
        <option value="18-25">18–25</option>
        <option value="26-35">26–35</option>
        <option value="36-45">36–45</option>
        <option value="46plus">46+</option>
      </select>

      <label for="fld-gender">收礼人性别</label>
      <select id="fld-gender" v-model="form.gender" class="input" autocomplete="off">
        <option value="unknown">未知 / 通用</option>
        <option value="female">女</option>
        <option value="male">男</option>
      </select>

      <label for="fld-occasion">场合</label>
      <select id="fld-occasion" v-model="form.occasion" class="input" autocomplete="off">
        <option value="birthday">生日</option>
        <option value="anniversary">纪念日</option>
        <option value="festival">节日</option>
        <option value="thanks">感谢</option>
        <option value="apology">道歉</option>
        <option value="casual">无理由</option>
      </select>

      <label for="fld-budget">预算</label>
      <select id="fld-budget" v-model="form.budget" class="input" autocomplete="off">
        <option value="lt100">&lt;100</option>
        <option value="100-300">100–300</option>
        <option value="300-500">300–500</option>
        <option value="500-1000">500–1000</option>
        <option value="1000+">1000+</option>
      </select>

      <label for="fld-style">风格</label>
      <select id="fld-style" v-model="form.style" class="input" autocomplete="off">
        <option value="practical">实用</option>
        <option value="ritual">仪式</option>
        <option value="quirky">搞怪</option>
        <option value="warm">温情</option>
      </select>

      <span id="interest-label" class="field-label">兴趣（最多3项，可不选）</span>
      <div class="chips" role="group" aria-labelledby="interest-label">
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

      <span id="taboo-label" class="field-label">禁忌（可选）</span>
      <div class="chips" role="group" aria-labelledby="taboo-label">
        <button type="button" class="chip" :class="{ on: form.taboos.includes('smell') }" @click="toggleTaboo('smell')">气味敏感</button>
        <button type="button" class="chip" :class="{ on: form.taboos.includes('religion') }" @click="toggleTaboo('religion')">宗教禁忌</button>
      </div>

      <button class="btn primary" :disabled="loading" @click="submitForm">
        <span v-if="loading" class="btn-spinner" aria-hidden="true" />
        {{ loading ? '加载中…' : '查看推荐' }}
      </button>
    </main>

    <main v-else class="list-wrap" :aria-busy="loading">
      <button type="button" class="link-back" @click="step = 0">← 修改画像</button>
      <div class="filter-bar card sticky-filters">
        <p class="filter-title">快速筛选</p>
        <div class="filter-row">
          <label class="filter-label" for="flt-occ">场合</label>
          <select id="flt-occ" v-model="listFilters.occasion" class="filter-select">
            <option value="">全部</option>
            <option value="birthday">生日</option>
            <option value="anniversary">纪念日</option>
            <option value="festival">节日</option>
            <option value="thanks">感谢</option>
            <option value="apology">道歉</option>
            <option value="casual">无理由</option>
          </select>
        </div>
        <div class="filter-row">
          <label class="filter-label" for="flt-bud">预算</label>
          <select id="flt-bud" v-model="listFilters.budget" class="filter-select">
            <option value="">全部</option>
            <option value="lt100">&lt;100</option>
            <option value="100-300">100–300</option>
            <option value="300-500">300–500</option>
            <option value="500-1000">500–1000</option>
            <option value="1000+">1000+</option>
          </select>
        </div>
        <div class="filter-row">
          <label class="filter-label" for="flt-style">风格</label>
          <select id="flt-style" v-model="listFilters.style" class="filter-select">
            <option value="">全部</option>
            <option value="practical">实用</option>
            <option value="ritual">仪式</option>
            <option value="quirky">搞怪</option>
            <option value="warm">温情</option>
          </select>
        </div>
        <button type="button" class="btn-text" @click="clearListFilters">清空筛选</button>
      </div>

      <div v-if="loading" class="skeleton-grid" aria-hidden="true">
        <div v-for="n in 6" :key="n" class="sk-card">
          <div class="sk-img" />
          <div class="sk-line sk-w90" />
          <div class="sk-line sk-w50" />
        </div>
      </div>

      <div v-else-if="products.length === 0" class="empty-state card">
        <div class="empty-art" aria-hidden="true">
          <span class="empty-gift">🎁</span>
        </div>
        <p class="empty-title">这里还空空的</p>
        <p class="empty-desc">试试清空筛选，或回到上一步微调画像。</p>
        <button type="button" class="btn-secondary" @click="clearListFilters">清空筛选</button>
      </div>

      <div v-else class="grid">
        <div
          v-for="(p, idx) in products"
          :key="p.id"
          class="card product-card"
          data-imp-card="1"
          :data-id="p.id"
          :data-pos="idx"
          @click="openDetail(p, idx)"
        >
          <img :src="p.image" :alt="p.title" class="thumb" loading="lazy" decoding="async" />
          <div class="info">
            <div class="title">{{ p.title }}</div>
            <div class="price">¥{{ p.price }}</div>
            <div class="reason" v-if="p.reasons && p.reasons[0]">{{ p.reasons[0].icon }} {{ p.reasons[0].text }}</div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="modalProduct" class="modal-mask" role="presentation" @click.self="closeDetail">
      <div class="modal card" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="modal-handle" aria-hidden="true" />
        <button type="button" class="modal-close" aria-label="关闭详情" @click="closeDetail">×</button>
        <img :src="modalProduct.image" class="modal-img" :alt="modalProduct.title" loading="lazy" />
        <h3 id="detail-title">{{ modalProduct.title }}</h3>
        <p class="price big">¥{{ modalProduct.price }}</p>
        <p class="detail-section-label">推荐理由</p>
        <div class="reason-cards">
          <div v-for="(r, i) in modalProduct.reasons" :key="i" class="reason-card">
            <span class="reason-ico" aria-hidden="true">{{ r.icon }}</span>
            <span class="reason-txt">{{ r.text }}</span>
          </div>
        </div>
        <div class="row modal-actions">
          <button type="button" class="btn ghost" @click="onCollect(modalProduct)">收藏</button>
          <button type="button" class="btn primary accent-outline" @click="onPurchase(modalProduct)">去购买</button>
        </div>
        <p class="leave-hint">正式版将提示跳转第三方完成交易（PRD 9.1）</p>
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
  padding: var(--page-pad) var(--page-pad) 52px;
  background: var(--zhili-bg);
}

/* 顶栏：品牌主色渐变 + 块状识别（偏电商 feed 心智） */
.header.hero {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 20px 16px 18px;
  margin: 0 calc(-1 * var(--page-pad)) 16px;
  border-radius: 0 0 var(--radius-modal) var(--radius-modal);
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8585 45%, #ffa04d 100%);
  color: #fff;
  box-shadow: var(--shadow-card);
}
.brand-mark {
  width: 48px;
  height: 48px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.35);
}
.hero-text h1 {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: 0.04em;
}
.tagline {
  margin: 4px 0 0;
  font-size: 13px;
  opacity: 0.95;
}
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.pill {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.pill-b {
  background: rgba(255, 255, 255, 0.35);
}
.anon {
  font-size: 11px;
  opacity: 0.85;
}

.toast {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  padding: 10px 18px;
  background: rgba(26, 26, 26, 0.88);
  color: #fff;
  font-size: 14px;
  border-radius: 999px;
  max-width: 90%;
  text-align: center;
  animation: toast-in 0.22s ease-out;
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, -6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.card {
  background: var(--zhili-card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(255, 107, 107, 0.06);
}
.section-title {
  margin: 0 0 6px;
  font-size: 1.15rem;
  color: var(--zhili-text);
}
.section-desc {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--zhili-muted);
  line-height: 1.45;
}
.form-card label,
.field-label {
  display: block;
  margin-top: 14px;
  font-size: 13px;
  color: #555;
  font-weight: 500;
}
.field-label {
  margin-top: 16px;
}
.input {
  width: 100%;
  margin-top: 6px;
  padding: 11px 12px;
  border: 1px solid var(--zhili-border);
  border-radius: 10px;
  font-size: 15px;
  background: #fff;
  transition: border-color 0.15s ease;
}
.input:hover {
  border-color: #ffd0d0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.chip {
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.chip.on {
  border-color: var(--zhili-primary);
  color: var(--zhili-primary);
  background: var(--zhili-primary-soft);
  box-shadow: 0 0 0 1px rgba(255, 107, 107, 0.15);
}

.btn {
  width: 100%;
  margin-top: 22px;
  min-height: 48px;
  border: none;
  border-radius: var(--radius-btn);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.btn.primary {
  background: linear-gradient(180deg, #ff7a7a 0%, var(--zhili-primary) 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(255, 107, 107, 0.35);
}
.btn.primary:not(:disabled):active {
  transform: scale(0.98);
}
.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.btn.ghost {
  background: #fff;
  color: var(--zhili-primary);
  border: 2px solid var(--zhili-primary);
}
.btn.primary.accent-outline {
  border: 2px solid var(--zhili-accent);
  box-shadow: 0 4px 12px rgba(255, 165, 0, 0.2);
}
.row {
  display: flex;
  gap: 12px;
}
.row .btn {
  flex: 1;
}
.btn-secondary {
  margin-top: 12px;
  width: 100%;
  min-height: 44px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--zhili-primary);
  background: #fff;
  color: var(--zhili-primary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.link-back {
  background: none;
  border: none;
  color: var(--zhili-primary);
  margin-bottom: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  padding: 4px 0;
}

.sticky-filters {
  position: sticky;
  top: 0;
  z-index: 5;
  margin-bottom: 12px;
}
.filter-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--zhili-muted);
  letter-spacing: 0.02em;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.filter-label {
  flex: 0 0 40px;
  font-size: 12px;
  color: var(--zhili-muted);
}
.filter-select {
  flex: 1;
  padding: 9px 10px;
  border: 1px solid var(--zhili-border);
  border-radius: 10px;
  font-size: 14px;
  background: #fff;
}
.btn-text {
  margin-top: 6px;
  width: 100%;
  border: none;
  background: none;
  color: var(--zhili-accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: right;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sk-card {
  background: var(--zhili-card);
  border-radius: var(--radius-card);
  overflow: hidden;
  border: 1px solid var(--zhili-border);
  padding: 0 0 10px;
}
.sk-img {
  aspect-ratio: 1;
  background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: sk 1.1s ease-in-out infinite;
}
.sk-line {
  height: 10px;
  margin: 8px 10px 0;
  border-radius: 4px;
  background: #eee;
  animation: sk 1.1s ease-in-out infinite;
}
.sk-w90 {
  width: 90%;
}
.sk-w50 {
  width: 55%;
}
@keyframes sk {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.empty-state {
  text-align: center;
  padding: 28px 20px 24px;
}
.empty-art {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 8px;
}
.empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.empty-desc {
  margin: 8px 0 16px;
  font-size: 14px;
  color: var(--zhili-muted);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 8px;
}
.product-card {
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.product-card:active {
  transform: scale(0.98);
}
.thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}
.info {
  padding: 10px 10px 12px;
}
.title {
  font-size: 13px;
  color: var(--zhili-text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.price {
  color: var(--zhili-primary);
  font-weight: 700;
  margin-top: 6px;
  font-size: 15px;
}
.reason {
  font-size: 11px;
  color: var(--zhili-muted);
  margin-top: 6px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(2px);
}
.modal {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  border-radius: var(--radius-modal) var(--radius-modal) 0 0;
  padding-bottom: 20px;
  animation: sheet-up 0.2s ease-out;
}
@keyframes sheet-up {
  from {
    transform: translateY(12px);
    opacity: 0.9;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.modal-handle {
  width: 36px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 4px;
  margin: 10px auto 6px;
}
.modal-close {
  position: absolute;
  right: 12px;
  top: 14px;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.modal-img {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
}
.modal h3 {
  margin: 14px 16px 0;
  font-size: 1.1rem;
}
.big {
  font-size: 22px;
  margin: 4px 16px 0;
}
.detail-section-label {
  margin: 16px 16px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--zhili-muted);
}
.reason-cards {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reason-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 12px;
  background: var(--zhili-primary-soft);
  border-radius: 12px;
  border: 1px solid rgba(255, 107, 107, 0.12);
}
.reason-ico {
  flex-shrink: 0;
  font-size: 18px;
}
.reason-txt {
  font-size: 14px;
  line-height: 1.45;
  color: #444;
}
.modal-actions {
  margin: 20px 16px 0;
}
.leave-hint {
  margin: 12px 16px 0;
  font-size: 11px;
  color: var(--zhili-muted);
  text-align: center;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  color: #aaa;
  padding: 10px;
  background: linear-gradient(180deg, transparent, var(--zhili-bg) 40%);
}
</style>
