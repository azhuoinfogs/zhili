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
/** landing 首页 → tags 标签选择 → browse 推荐列表 */
const phase = ref('landing');
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
    page_name: 'zhili_luxury',
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
  if (phase.value !== 'browse') return;
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

function goExplore() {
  track('explore_click', {});
  phase.value = 'tags';
}

function backToHome() {
  phase.value = 'landing';
}

function backToTags() {
  phase.value = 'tags';
}

async function submitTags() {
  track('form_submit', { ...profilePayload.value });
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profilePayload.value));
  listFilters.occasion = form.occasion;
  listFilters.budget = form.budget;
  listFilters.style = form.style;
  phase.value = 'browse';
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
  showToast('已收录至礼遇单');
}

function onPurchase(p) {
  track('purchase_click', { product_id: p.id });
  showToast('已记录礼遇意向');
}

onMounted(() => {
  userId.value = getOrCreateUserId();
  group.value = getOrCreateGroup();
  track('page_view', { phase: 'landing' });
});

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer);
  if (io) io.disconnect();
});
</script>

<template>
  <div class="app">
    <div v-if="toastMsg" class="toast" role="status" aria-live="polite">{{ toastMsg }}</div>

    <!-- 1. 奢侈品电商风首页 -->
    <section v-if="phase === 'landing'" class="landing">
      <div class="landing-bg" aria-hidden="true" />
      <div class="landing-top">
        <span class="pill-ab">{{ group === 'A' ? 'COLLECTION A' : 'ATELIER B' }}</span>
        <span class="landing-refine">Ref. {{ userId.slice(-8) }}</span>
      </div>
      <div class="landing-center">
        <p class="landing-eyebrow">Curated Gifting</p>
        <h1 class="landing-title font-serif">知礼</h1>
        <p class="landing-sub font-serif">懂礼更懂你</p>
        <p class="landing-lead">
          为重要的人甄选一份得体之礼。<br />以品味与场景为引，开启您的私人推荐。
        </p>
        <button type="button" class="cta-explore" @click="goExplore">探索商品</button>
        <p class="landing-hint">轻触即进入偏好标签，由算法为您呈献候选名录。</p>
      </div>
      <footer class="landing-foot">匿名礼遇数据 · 不采集姓名与电话</footer>
    </section>

    <!-- 2. 标签 / 画像选择 -->
    <section v-else-if="phase === 'tags'" class="tags-screen">
      <header class="tags-head glass">
        <button type="button" class="link-ghost" @click="backToHome">← 返回首页</button>
        <h2 class="tags-title font-serif">偏好与场景</h2>
        <p class="tags-sub">请选择收礼人标签，我们将据此匹配礼遇清单。</p>
      </header>

      <main class="tags-body glass">
        <label for="fld-relation" class="lx-label">关系</label>
        <select id="fld-relation" v-model="form.relation" class="lx-input" autocomplete="off">
          <option v-for="(l, k) in relationLabels" :key="k" :value="k">{{ l }}</option>
        </select>

        <label for="fld-age" class="lx-label">年龄段</label>
        <select id="fld-age" v-model="form.ageBand" class="lx-input" autocomplete="off">
          <option value="under18">&lt;18</option>
          <option value="18-25">18–25</option>
          <option value="26-35">26–35</option>
          <option value="36-45">36–45</option>
          <option value="46plus">46+</option>
        </select>

        <label for="fld-gender" class="lx-label">收礼人性别</label>
        <select id="fld-gender" v-model="form.gender" class="lx-input" autocomplete="off">
          <option value="unknown">未知 / 通用</option>
          <option value="female">女</option>
          <option value="male">男</option>
        </select>

        <label for="fld-occasion" class="lx-label">场合</label>
        <select id="fld-occasion" v-model="form.occasion" class="lx-input" autocomplete="off">
          <option value="birthday">生日</option>
          <option value="anniversary">纪念日</option>
          <option value="festival">节日</option>
          <option value="thanks">感谢</option>
          <option value="apology">道歉</option>
          <option value="casual">无理由</option>
        </select>

        <label for="fld-budget" class="lx-label">预算</label>
        <select id="fld-budget" v-model="form.budget" class="lx-input" autocomplete="off">
          <option value="lt100">&lt;100</option>
          <option value="100-300">100–300</option>
          <option value="300-500">300–500</option>
          <option value="500-1000">500–1000</option>
          <option value="1000+">1000+</option>
        </select>

        <label for="fld-style" class="lx-label">风格</label>
        <select id="fld-style" v-model="form.style" class="lx-input" autocomplete="off">
          <option value="practical">实用</option>
          <option value="ritual">仪式</option>
          <option value="quirky">搞怪</option>
          <option value="warm">温情</option>
        </select>

        <span id="interest-label" class="lx-label">兴趣圈层（最多 3 项，可跳过）</span>
        <div class="lx-chips" role="group" aria-labelledby="interest-label">
          <button
            v-for="o in interestOptions"
            :key="o.v"
            type="button"
            class="lx-chip"
            :class="{ on: form.interests.includes(o.v) }"
            @click="toggleInterest(o.v)"
          >
            {{ o.l }}
          </button>
        </div>

        <span id="taboo-label" class="lx-label">禁忌（可选）</span>
        <div class="lx-chips" role="group" aria-labelledby="taboo-label">
          <button type="button" class="lx-chip" :class="{ on: form.taboos.includes('smell') }" @click="toggleTaboo('smell')">气味敏感</button>
          <button type="button" class="lx-chip" :class="{ on: form.taboos.includes('religion') }" @click="toggleTaboo('religion')">宗教禁忌</button>
        </div>

        <button type="button" class="cta-gold" :disabled="loading" @click="submitTags">
          <span v-if="loading" class="btn-spinner" aria-hidden="true" />
          {{ loading ? '正在遴选…' : '呈献推荐' }}
        </button>
      </main>
    </section>

    <!-- 3. 推荐列表 -->
    <section v-else class="browse-screen" :aria-busy="loading">
      <header class="browse-head glass">
        <button type="button" class="link-ghost" @click="backToTags">← 调整标签</button>
        <h2 class="browse-title font-serif">礼遇名录</h2>
        <p class="browse-meta">{{ group === 'A' ? '典藏热门序列' : '个性化策展序列' }}</p>
      </header>

      <div class="filter-bar glass">
        <p class="filter-eyebrow">Refine</p>
        <div class="filter-row">
          <label class="filter-label" for="flt-occ">场合</label>
          <select id="flt-occ" v-model="listFilters.occasion" class="lx-input sm">
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
          <select id="flt-bud" v-model="listFilters.budget" class="lx-input sm">
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
          <select id="flt-style" v-model="listFilters.style" class="lx-input sm">
            <option value="">全部</option>
            <option value="practical">实用</option>
            <option value="ritual">仪式</option>
            <option value="quirky">搞怪</option>
            <option value="warm">温情</option>
          </select>
        </div>
        <button type="button" class="filter-clear" @click="clearListFilters">清空筛选</button>
      </div>

      <div v-if="loading" class="skeleton-grid" aria-hidden="true">
        <div v-for="n in 6" :key="n" class="sk-card glass">
          <div class="sk-img" />
          <div class="sk-line sk-w90" />
          <div class="sk-line sk-w50" />
        </div>
      </div>

      <div v-else-if="products.length === 0" class="empty-state glass">
        <p class="empty-title font-serif">暂无契合之选</p>
        <p class="empty-desc">请尝试放宽筛选，或返回调整标签。</p>
        <button type="button" class="cta-outline" @click="clearListFilters">清空筛选</button>
      </div>

      <div v-else class="grid">
        <article
          v-for="(p, idx) in products"
          :key="p.id"
          class="product-card glass"
          data-imp-card="1"
          :data-id="p.id"
          :data-pos="idx"
          @click="openDetail(p, idx)"
        >
          <div class="thumb-wrap">
            <img :src="p.image" :alt="p.title" class="thumb" loading="lazy" decoding="async" />
          </div>
          <div class="info">
            <h3 class="p-title">{{ p.title }}</h3>
            <p class="p-price">¥{{ p.price }}</p>
            <p v-if="p.reasons && p.reasons[0]" class="p-reason">{{ p.reasons[0].icon }} {{ p.reasons[0].text }}</p>
          </div>
        </article>
      </div>

      <footer class="browse-foot">匿名数据仅用于礼遇算法优化</footer>
    </section>

    <!-- 详情抽屉 -->
    <div v-if="modalProduct" class="modal-mask" role="presentation" @click.self="closeDetail">
      <div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="modal-handle" aria-hidden="true" />
        <button type="button" class="modal-close" aria-label="关闭" @click="closeDetail">×</button>
        <div class="modal-hero">
          <img :src="modalProduct.image" class="modal-img" :alt="modalProduct.title" loading="lazy" />
        </div>
        <h3 id="detail-title" class="detail-name font-serif">{{ modalProduct.title }}</h3>
        <p class="detail-price">¥{{ modalProduct.price }}</p>
        <p class="detail-label">推荐理由</p>
        <div class="reason-stack">
          <div v-for="(r, i) in modalProduct.reasons" :key="i" class="reason-glass">
            <span class="reason-ico" aria-hidden="true">{{ r.icon }}</span>
            <span>{{ r.text }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-outline" @click="onCollect(modalProduct)">收藏</button>
          <button type="button" class="cta-gold sm" @click="onPurchase(modalProduct)">去购买</button>
        </div>
        <p class="modal-legal">正式版将提示离开礼遇馆前往第三方完成交易</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-serif {
  font-family: 'Cormorant Garamond', 'Times New Roman', serif;
}

.app {
  max-width: 520px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  background: #0c0a09;
  color: #fafaf9;
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

.glass {
  background: rgba(28, 25, 23, 0.55);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}

/* —— Landing —— */
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  padding: 20px 20px 24px;
}
.landing-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(202, 138, 4, 0.18), transparent 55%),
    radial-gradient(ellipse 80% 50% at 100% 60%, rgba(202, 138, 4, 0.06), transparent 45%),
    linear-gradient(180deg, #1c1917 0%, #0c0a09 55%);
  pointer-events: none;
}
.landing-top {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #a8a29e;
}
.pill-ab {
  border: 1px solid rgba(202, 138, 4, 0.45);
  color: #eab308;
  padding: 6px 12px;
  border-radius: 999px;
}
.landing-refine {
  opacity: 0.75;
}
.landing-center {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 24px 8px 32px;
}
.landing-eyebrow {
  margin: 0 0 12px;
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #ca8a04;
}
.landing-title {
  margin: 0;
  font-size: clamp(3rem, 14vw, 4.5rem);
  font-weight: 500;
  letter-spacing: 0.2em;
  line-height: 1.05;
}
.landing-sub {
  margin: 8px 0 0;
  font-size: clamp(1.25rem, 5vw, 1.65rem);
  font-weight: 400;
  color: #d6d3d1;
  letter-spacing: 0.25em;
}
.landing-lead {
  margin: 28px 0 0;
  max-width: 300px;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.75;
  color: #a8a29e;
}
.cta-explore {
  margin-top: 40px;
  padding: 16px 48px;
  font-family: 'Montserrat', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #fafaf9;
  background: transparent;
  border: 1px solid #ca8a04;
  border-radius: 0;
  cursor: pointer;
  transition:
    background 0.35s ease,
    color 0.35s ease,
    box-shadow 0.35s ease;
}
.cta-explore:hover {
  background: rgba(202, 138, 4, 0.15);
  box-shadow: 0 0 40px rgba(202, 138, 4, 0.12);
}
.landing-hint {
  margin-top: 20px;
  font-size: 11px;
  color: #78716c;
  max-width: 260px;
  line-height: 1.6;
}
.landing-foot {
  position: relative;
  z-index: 1;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: #57534e;
}

/* —— Tags —— */
.tags-screen {
  padding: 16px 16px 100px;
}
.tags-head {
  padding: 18px 18px 14px;
  border-radius: 2px;
  margin-bottom: 14px;
}
.link-ghost {
  background: none;
  border: none;
  color: #a8a29e;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 0 0 12px;
}
.link-ghost:hover {
  color: #eab308;
}
.tags-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: 0.12em;
}
.tags-sub {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 300;
  color: #a8a29e;
  line-height: 1.55;
}
.tags-body {
  padding: 22px 18px 28px;
  border-radius: 2px;
}
.lx-label {
  display: block;
  margin-top: 18px;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #a8a29e;
}
.lx-label:first-of-type {
  margin-top: 0;
}
.lx-input {
  width: 100%;
  margin-top: 8px;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14px;
  color: #fafaf9;
  background: rgba(12, 10, 9, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23a8a29e' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}
.lx-input.sm {
  padding-top: 10px;
  padding-bottom: 10px;
  font-size: 13px;
}
.lx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.lx-chip {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 10, 9, 0.4);
  color: #d6d3d1;
  border-radius: 999px;
  padding: 9px 16px;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;
}
.lx-chip.on {
  border-color: #ca8a04;
  color: #fef3c7;
  background: rgba(202, 138, 4, 0.12);
}
.cta-gold {
  width: 100%;
  margin-top: 28px;
  min-height: 52px;
  border: none;
  border-radius: 2px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #1c1917;
  background: linear-gradient(105deg, #eab308 0%, #ca8a04 45%, #a16207 100%);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 12px 40px rgba(202, 138, 4, 0.22);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.cta-gold:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 48px rgba(202, 138, 4, 0.28);
}
.cta-gold:disabled {
  opacity: 0.6;
  cursor: wait;
}
.cta-gold.sm {
  margin-top: 0;
  min-height: 48px;
  flex: 1;
}
.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(28, 25, 23, 0.25);
  border-top-color: #1c1917;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* —— Browse —— */
.browse-screen {
  padding: 16px 16px 80px;
}
.browse-head {
  padding: 16px 18px;
  border-radius: 2px;
  margin-bottom: 12px;
}
.browse-title {
  margin: 8px 0 0;
  font-size: 1.6rem;
  font-weight: 500;
  letter-spacing: 0.15em;
}
.browse-meta {
  margin: 8px 0 0;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #ca8a04;
}
.filter-bar {
  position: sticky;
  top: 8px;
  z-index: 5;
  padding: 14px 16px 16px;
  border-radius: 2px;
  margin-bottom: 14px;
}
.filter-eyebrow {
  margin: 0 0 10px;
  font-size: 10px;
  letter-spacing: 0.25em;
  color: #78716c;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.filter-label {
  flex: 0 0 36px;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: #a8a29e;
}
.filter-clear {
  width: 100%;
  margin-top: 4px;
  border: none;
  background: none;
  color: #ca8a04;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-align: right;
  cursor: pointer;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.sk-card {
  border-radius: 2px;
  padding-bottom: 12px;
  overflow: hidden;
}
.sk-img {
  aspect-ratio: 1;
  background: linear-gradient(110deg, #292524 0%, #44403c 40%, #292524 80%);
  background-size: 200% 100%;
  animation: sk 1.2s ease-in-out infinite;
}
.sk-line {
  height: 8px;
  margin: 10px 12px 0;
  border-radius: 1px;
  background: #44403c;
  animation: sk 1.2s ease-in-out infinite;
}
.sk-w90 {
  width: 88%;
}
.sk-w50 {
  width: 50%;
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
  padding: 36px 20px;
  border-radius: 2px;
}
.empty-title {
  margin: 0;
  font-size: 1.4rem;
}
.empty-desc {
  margin: 12px 0 20px;
  font-size: 13px;
  color: #a8a29e;
}
.cta-outline {
  padding: 12px 28px;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fafaf9;
  background: transparent;
  border: 1px solid rgba(202, 138, 4, 0.5);
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 10px;
}
.product-card {
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}
.thumb-wrap {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}
.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}
.product-card:hover .thumb {
  transform: scale(1.04);
}
.info {
  padding: 12px 12px 14px;
}
.p-title {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  color: #e7e5e4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.p-price {
  margin: 8px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: #eab308;
  letter-spacing: 0.06em;
}
.p-reason {
  margin: 8px 0 0;
  font-size: 10px;
  line-height: 1.4;
  color: #78716c;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.browse-foot {
  margin-top: 28px;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #57534e;
}

/* —— Modal —— */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(12, 10, 9, 0.72);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(6px);
}
.modal {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 2px 2px 0 0;
  padding-bottom: 28px;
  animation: up 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.modal-handle {
  width: 40px;
  height: 3px;
  background: #57534e;
  margin: 12px auto 8px;
  border-radius: 2px;
}
.modal-close {
  position: absolute;
  right: 14px;
  top: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 10, 9, 0.6);
  color: #fafaf9;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.modal-hero {
  margin: 0 0 4px;
  max-height: 280px;
  overflow: hidden;
}
.modal-img {
  width: 100%;
  height: 100%;
  max-height: 280px;
  object-fit: cover;
  display: block;
}
.detail-name {
  margin: 16px 20px 0;
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: 0.08em;
}
.detail-price {
  margin: 6px 20px 0;
  font-size: 1.35rem;
  color: #eab308;
  font-weight: 600;
}
.detail-label {
  margin: 20px 20px 10px;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #78716c;
}
.reason-stack {
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reason-glass {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 14px;
  border: 1px solid rgba(202, 138, 4, 0.15);
  background: rgba(202, 138, 4, 0.06);
  border-radius: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: #d6d3d1;
}
.reason-ico {
  flex-shrink: 0;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin: 24px 20px 0;
}
.btn-outline {
  flex: 1;
  min-height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: #fafaf9;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 2px;
}
.modal-legal {
  margin: 16px 20px 0;
  font-size: 10px;
  color: #57534e;
  text-align: center;
  line-height: 1.5;
}
</style>
