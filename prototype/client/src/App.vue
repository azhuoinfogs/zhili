<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue';
import { isLoggedIn, getUser, logout } from './utils/auth.js';
import LoginPage from './components/LoginPage.vue';
import RegisterPage from './components/RegisterPage.vue';
import ProfilePage from './components/ProfilePage.vue';

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
const user = ref(null);
const loggedIn = ref(false);
const currentPage = ref('landing');

const phase = ref('landing');
const loading = ref(false);
const loadingMore = ref(false);
const refreshing = ref(false);
const hasMore = ref(true);
const PAGE_SIZE = 20;
const products = ref([]);
const modalProduct = ref(null);
const modalSlideIndex = ref(0);
const relatedProducts = ref([]);
const browseScrollRef = ref(null);
const pullDistance = ref(0);
let pullArm = false;
let pullStartY = 0;
let loadMoreLock = false;
const seenImp = new Set();
const toastMsg = ref('');
let toastTimer = null;
let io = null;

const favorites = ref([]);
const favoritesLoading = ref(false);
const showProfile = ref(false);
const activeTab = ref('home');

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
  customer: '客户',
  leader: '长辈/上级'
};

function toggleInterest(v) {
  const idx = form.interests.indexOf(v);
  if (idx >= 0) {
    form.interests.splice(idx, 1);
  } else {
    form.interests.push(v);
  }
}

function toggleTaboo(v) {
  const idx = form.taboos.indexOf(v);
  if (idx >= 0) {
    form.taboos.splice(idx, 1);
  } else {
    form.taboos.push(v);
  }
}

const profilePayload = computed(() => ({
  relation: form.relation,
  age_band: form.ageBand,
  interests: form.interests,
  occasion: form.occasion,
  budget: form.budget,
  gender: form.gender,
  taboos: form.taboos,
  style: form.style
}));

function track(eventName, props = {}) {
  const data = {
    event: eventName,
    user_id: userId.value,
    group: group.value,
    timestamp: Date.now(),
    ...props
  };
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    console.log('Track failed:', eventName);
  }
}

async function fetchRecommendations(reset = false) {
  loading.value = reset;
  try {
    const q = encodeURIComponent(JSON.stringify(profilePayload.value));
    const offset = reset ? 0 : products.value.length;
    const r = await fetch(`/api/recommend?profile=${q}&offset=${offset}&limit=${PAGE_SIZE}`);
    if (r.ok) {
      const data = await r.json();
      if (reset) {
        products.value = data.list || [];
      } else {
        products.value.push(...(data.list || []));
      }
      hasMore.value = (data.list || []).length >= PAGE_SIZE;
    }
  } catch {
    console.log('Fetch recommendations failed');
  } finally {
    loading.value = false;
    loadingMore.value = false;
    refreshing.value = false;
    pullDistance.value = 0;
  }
}

function scheduleRefetch() {
  if (phase.value !== 'browse') return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchRecommendations(true);
  }, 500);
}

watch(listFilters, () => {
  scheduleRefetch();
}, { deep: true });

function goExplore() {
  track('explore_click', {});
  phase.value = 'tags';
}

function goToHome() {
  activeTab.value = 'home';
  phase.value = 'landing';
  track('navigate_home');
}

function goToBrowse() {
  activeTab.value = 'browse';
  if (phase.value === 'landing') {
    phase.value = 'tags';
  } else if (phase.value === 'tags' && products.value.length) {
    phase.value = 'browse';
  }
  track('navigate_browse');
}

function goToProfile() {
  activeTab.value = 'profile';
  currentPage.value = 'profile';
  fetchFavorites();
  track('navigate_profile');
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
  await fetchRecommendations(true);
}

function onBrowseScroll() {
  const el = browseScrollRef.value;
  if (!el || loading.value || loadingMore.value || !hasMore.value) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
    void loadMore();
  }
}

async function loadMore() {
  if (loadMoreLock || !hasMore.value || loadingMore.value || loading.value) return;
  loadMoreLock = true;
  try {
    await fetchRecommendations(false);
  } finally {
    loadMoreLock = false;
  }
}

function onPullStart(e) {
  const el = browseScrollRef.value;
  if (!el || loading.value) return;
  if (el.scrollTop <= 0) {
    pullArm = true;
    pullStartY = e.touches[0].clientY;
  }
}

function onPullMove(e) {
  if (!pullArm) return;
  const el = browseScrollRef.value;
  if (!el) return;
  const dy = e.touches[0].clientY - pullStartY;
  if (dy > 0 && el.scrollTop <= 0) {
    pullDistance.value = Math.min(dy * 0.45, 72);
  }
}

function onPullEnd() {
  if (!pullArm) return;
  pullArm = false;
  if (pullDistance.value > 40 && !loading.value) {
    refreshing.value = true;
    void fetchRecommendations(true);
  }
  pullDistance.value = 0;
}

function handleIntersection(entries) {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('data-imp-card');
      if (id && !seenImp.has(id)) {
        seenImp.add(id);
        track('impression', { product_id: id });
      }
    }
  });
}

function setupIntersectionObserver() {
  io = new IntersectionObserver(handleIntersection, { root: null, threshold: 0.4 });
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-imp-card]').forEach((el) => io.observe(el));
  });
}

async function openDetail(p, pos) {
  track('click', { product_id: p.id, position: pos });
  modalProduct.value = { ...p, _pos: pos };
  modalSlideIndex.value = 0;
  relatedProducts.value = [];
  try {
    const q = encodeURIComponent(JSON.stringify(profilePayload.value));
    const r = await fetch(`/api/related/${encodeURIComponent(p.id)}?profile=${q}`);
    if (r.ok) relatedProducts.value = await r.json();
  } catch {
    relatedProducts.value = [];
  }
}

function modalImages(p) {
  if (!p) return [];
  if (Array.isArray(p.images) && p.images.length) return p.images;
  return p.image ? [p.image] : [];
}

function prevModalSlide() {
  const imgs = modalImages(modalProduct.value);
  if (!imgs.length) return;
  modalSlideIndex.value = (modalSlideIndex.value - 1 + imgs.length) % imgs.length;
}

function nextModalSlide() {
  const imgs = modalImages(modalProduct.value);
  if (!imgs.length) return;
  modalSlideIndex.value = (modalSlideIndex.value + 1) % imgs.length;
}

function openRelatedFromModal(p) {
  const idx = products.value.findIndex((x) => x.id === p.id);
  closeDetail();
  requestAnimationFrame(() => {
    void openDetail(p, idx >= 0 ? idx : 0);
  });
}

function closeDetail() {
  modalProduct.value = null;
  relatedProducts.value = [];
  modalSlideIndex.value = 0;
}

async function onCollect(p) {
  track('collect', { product_id: p.id });
  try {
    const token = localStorage.getItem('zhili_token');
    const res = await fetch('/api/favorite', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ product_id: p.id })
    });
    if (res.ok) {
      showToast('已收藏');
      await fetchFavorites();
    } else {
      showToast('收藏失败');
    }
  } catch {
    showToast('收藏失败');
  }
}

async function fetchFavorites() {
  favoritesLoading.value = true;
  try {
    const token = localStorage.getItem('zhili_token');
    const res = await fetch('/api/favorite', {
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

async function removeFavorite(productId) {
  try {
    const token = localStorage.getItem('zhili_token');
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
    showToast('取消失败');
  }
}

function onPurchase(p) {
  track('purchase_click', { product_id: p.id });
  showToast('已记录礼遇意向');
}

function handleLoginSuccess() {
  user.value = getUser();
  loggedIn.value = true;
  currentPage.value = 'main';
  phase.value = 'landing';
  showToast('登录成功');
}

function handleRegisterSuccess() {
  user.value = getUser();
  loggedIn.value = true;
  currentPage.value = 'main';
  phase.value = 'landing';
  showToast('注册成功');
}

function handleLogout() {
  logout();
  loggedIn.value = false;
  user.value = null;
  currentPage.value = 'landing';
  showToast('已退出登录');
}

function goToLogin() {
  currentPage.value = 'login';
}

function goToRegister() {
  currentPage.value = 'register';
}

function goToMain() {
  currentPage.value = 'main';
}

function goBackFromProfile() {
  currentPage.value = 'main';
}

onMounted(() => {
  userId.value = getOrCreateUserId();
  group.value = getOrCreateGroup();
  loggedIn.value = isLoggedIn();
  user.value = getUser();
  
  if (!loggedIn.value) {
    currentPage.value = 'landing';
  } else {
    currentPage.value = 'main';
  }
  
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

    <div v-if="!loggedIn">
      <LoginPage 
        v-if="currentPage === 'login'" 
        @login-success="handleLoginSuccess"
        @go-register="goToRegister"
      />
      
      <RegisterPage 
        v-else-if="currentPage === 'register'" 
        @register-success="handleRegisterSuccess"
        @go-login="goToLogin"
      />
      
      <section v-else class="landing">
        <div class="landing-bg" aria-hidden="true"></div>
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
          <div class="landing-actions">
            <button type="button" class="action-btn" @click="goToLogin">
              <span class="action-icon">👤</span>
              <span>登录</span>
            </button>
            <button type="button" class="action-btn" @click="goToRegister">
              <span class="action-icon">✦</span>
              <span>注册</span>
            </button>
          </div>
          <button type="button" class="cta-explore" @click="goExplore">探索商品</button>
          <p class="landing-hint">轻触即进入偏好标签，由算法为您呈献候选名录。</p>
        </div>
        <footer class="landing-foot">匿名礼遇数据 · 不采集姓名与电话</footer>
      </section>
    </div>

    <div v-else>
      <div class="main-content">
        <ProfilePage 
          v-if="currentPage === 'profile'" 
          @logout="handleLogout"
          @back="goBackFromProfile"
        />
        
        <main v-else>
          <section v-if="phase === 'landing'" class="landing">
            <div class="landing-bg" aria-hidden="true"></div>
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
                <option value="0-100">0–100</option>
                <option value="100-300">100–300</option>
                <option value="300-500">300–500</option>
                <option value="500-1000">500–1000</option>
                <option value="1000plus">1000+</option>
              </select>

              <label for="fld-style" class="lx-label">风格偏好</label>
              <select id="fld-style" v-model="form.style" class="lx-input" autocomplete="off">
                <option value="practical">实用主义</option>
                <option value="creative">创意趣味</option>
                <option value="luxury">品质奢华</option>
                <option value="minimal">简约素雅</option>
                <option value="cultural">文化艺术</option>
              </select>

              <label class="lx-label">兴趣圈层</label>
              <div class="lx-chips">
                <button 
                  type="button" 
                  v-for="opt in interestOptions" 
                  :key="opt.v"
                  class="lx-chip"
                  :class="{ on: form.interests.includes(opt.v) }"
                  @click="toggleInterest(opt.v)"
                >{{ opt.l }}</button>
              </div>

              <label class="lx-label">禁忌偏好</label>
              <div class="lx-chips">
                <button type="button" class="lx-chip" :class="{ on: form.taboos.includes('smell') }" @click="toggleTaboo('smell')">气味敏感</button>
                <button type="button" class="lx-chip" :class="{ on: form.taboos.includes('religion') }" @click="toggleTaboo('religion')">宗教禁忌</button>
              </div>

              <button type="button" class="cta-gold" :disabled="loading" @click="submitTags">
                <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
                {{ loading ? '正在遴选…' : '呈献推荐' }}
              </button>
            </main>
          </section>

          <section v-else-if="phase === 'browse'" class="browse-screen">
            <header class="browse-head glass">
              <button type="button" class="link-ghost" @click="backToTags">← 返回标签</button>
              <button type="button" class="link-ghost" @click="showProfile = true">👤 我的画像</button>
            </header>

            <div class="filter-bar glass">
              <p class="filter-eyebrow">筛选条件</p>
              <div class="filter-row">
                <span class="filter-label">场合:</span>
                <select v-model="listFilters.occasion" class="filter-select">
                  <option value="birthday">生日</option>
                  <option value="anniversary">纪念日</option>
                  <option value="festival">节日</option>
                  <option value="thanks">感谢</option>
                  <option value="apology">道歉</option>
                  <option value="casual">无理由</option>
                </select>
              </div>
              <div class="filter-row">
                <span class="filter-label">预算:</span>
                <select v-model="listFilters.budget" class="filter-select">
                  <option value="0-100">0–100</option>
                  <option value="100-300">100–300</option>
                  <option value="300-500">300–500</option>
                  <option value="500-1000">500–1000</option>
                  <option value="1000plus">1000+</option>
                </select>
              </div>
              <div class="filter-row">
                <span class="filter-label">风格:</span>
                <select v-model="listFilters.style" class="filter-select">
                  <option value="practical">实用主义</option>
                  <option value="creative">创意趣味</option>
                  <option value="luxury">品质奢华</option>
                  <option value="minimal">简约素雅</option>
                  <option value="cultural">文化艺术</option>
                </select>
              </div>
              <button type="button" class="filter-clear" @click="listFilters.occasion='birthday'; listFilters.budget='100-300'; listFilters.style='practical'">重置筛选</button>
            </div>

            <div 
              ref="browseScrollRef"
              class="browse-scroll"
              @scroll="onBrowseScroll"
              @touchstart="onPullStart"
              @touchmove="onPullMove"
              @touchend="onPullEnd"
            >
              <div class="pull-indicator" :style="{ height: pullDistance + 'px' }">
                <span v-if="refreshing" class="pull-text">刷新中…</span>
                <span v-else-if="pullDistance > 40" class="pull-text">松开刷新</span>
                <span v-else-if="pullDistance > 0" class="pull-text">下拉刷新</span>
              </div>

              <div v-if="loading && products.length === 0" class="loading-text">加载中…</div>

              <div v-else-if="products.length === 0" class="empty-state">
                <p>暂无推荐礼遇</p>
              </div>

              <div v-else class="products-grid">
                <article 
                  v-for="(p, idx) in products" 
                  :key="p.id"
                  class="product-card glass"
                  :data-imp-card="p.id"
                  @click="openDetail(p, idx)"
                >
                  <div class="card-img-wrap">
                    <img :src="p.image" :alt="p.title" class="card-img" loading="lazy" />
                    <button 
                      type="button" 
                      class="card-collect" 
                      @click.stop="onCollect(p)"
                      aria-label="收藏"
                    >♡</button>
                  </div>
                  <h3 class="card-title">{{ p.title }}</h3>
                  <p class="card-price">¥{{ p.price }}</p>
                  <p class="card-reason" v-if="p.reason">
                    <span class="reason-glass">
                      <span>✨</span>
                      <span>{{ p.reason }}</span>
                    </span>
                  </p>
                </article>
              </div>

              <div v-if="loadingMore" class="loading-text">加载更多…</div>
              <div v-if="!hasMore && products.length > 0" class="loading-text">已加载全部</div>
            </div>
          </section>

          <div v-if="modalProduct" class="modal-mask" role="presentation" @click.self="closeDetail">
            <div class="modal glass" role="dialog" aria-labelledby="modal-title">
              <div class="modal-handle" aria-hidden="true"></div>
              <button type="button" class="modal-close" aria-label="关闭" @click="closeDetail">×</button>
              
              <div class="modal-images">
                <button type="button" class="modal-prev" @click="prevModalSlide" aria-label="上一张">‹</button>
                <img 
                  :src="modalImages(modalProduct)[modalSlideIndex]" 
                  :alt="modalProduct.title" 
                  class="modal-img"
                />
                <button type="button" class="modal-next" @click="nextModalSlide" aria-label="下一张">›</button>
                <div class="modal-indicators">
                  <span 
                    v-for="(_, i) in modalImages(modalProduct)" 
                    :key="i"
                    class="modal-indicator"
                    :class="{ active: i === modalSlideIndex }"
                  ></span>
                </div>
              </div>

              <div class="modal-body">
                <h2 id="modal-title" class="font-serif detail-name">{{ modalProduct.title }}</h2>
                <p class="detail-price">¥{{ modalProduct.price }}</p>
                <p class="detail-reason" v-if="modalProduct.reason">
                  <span class="reason-glass">
                    <span>✨</span>
                    <span>{{ modalProduct.reason }}</span>
                  </span>
                </p>
                <p class="detail-desc">{{ modalProduct.description }}</p>
                
                <div v-if="relatedProducts.length > 0" class="detail-related">
                  <h3 class="related-title">相关礼遇</h3>
                  <div class="related-list">
                    <button 
                      v-for="rp in relatedProducts.slice(0, 4)" 
                      :key="rp.id"
                      type="button"
                      class="related-item"
                      @click="openRelatedFromModal(rp)"
                    >
                      <img :src="rp.image" class="related-thumb" :alt="rp.title" loading="lazy" />
                      <span class="related-name">{{ rp.title }}</span>
                    </button>
                  </div>
                </div>

                <div class="modal-actions">
                  <button type="button" class="btn-outline" @click="onCollect(modalProduct)">♡ 收藏</button>
                  <button type="button" class="btn-primary" @click="onPurchase(modalProduct)">礼遇呈献</button>
                </div>
                <p class="modal-legal">正式版将提示离开礼遇馆前往第三方完成交易</p>
              </div>
            </div>
          </div>

          <div v-if="favorites.length > 0" class="modal-mask" role="presentation" @click.self="favorites = []">
            <div class="modal glass modal-favorites" role="dialog" aria-labelledby="favorites-title">
              <div class="modal-handle" aria-hidden="true"></div>
              <button type="button" class="modal-close" aria-label="关闭" @click="favorites = []">×</button>
              <h3 id="favorites-title" class="font-serif">我的礼遇单</h3>
              <div class="favorites-list">
                <div v-if="favoritesLoading" class="loading-text">加载中…</div>
                <div v-else-if="favorites.length === 0" class="empty-favorites">
                  <p>暂无收藏</p>
                </div>
                <div v-else>
                  <div v-for="f in favorites" :key="f.product_id" class="favorite-item">
                    <span class="favorite-name">{{ f.product_id }}</span>
                    <button type="button" class="btn-remove" @click="removeFavorite(f.product_id)">移除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="showProfile" class="modal-mask" role="presentation" @click.self="showProfile = false">
            <div class="modal glass modal-profile" role="dialog" aria-labelledby="profile-title">
              <div class="modal-handle" aria-hidden="true"></div>
              <button type="button" class="modal-close" aria-label="关闭" @click="showProfile = false">×</button>
              <h3 id="profile-title" class="font-serif">我的画像</h3>
              <div class="profile-content">
                <div class="profile-row">
                  <span class="profile-label">用户分组</span>
                  <span class="profile-value">{{ group === 'A' ? '典藏组 (A)' : '策展组 (B)' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">用户ID</span>
                  <span class="profile-value">{{ userId }}</span>
                </div>
                <div class="profile-divider"></div>
                <div class="profile-row">
                  <span class="profile-label">收礼关系</span>
                  <span class="profile-value">{{ relationLabels[form.relation] || '未设置' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">年龄段</span>
                  <span class="profile-value">{{ form.ageBand || '未设置' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">性别</span>
                  <span class="profile-value">{{ form.gender === 'female' ? '女' : form.gender === 'male' ? '男' : '未知/通用' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">场合</span>
                  <span class="profile-value">{{ form.occasion || '未设置' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">预算</span>
                  <span class="profile-value">{{ form.budget || '未设置' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">风格</span>
                  <span class="profile-value">{{ form.style || '未设置' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">兴趣圈层</span>
                  <span class="profile-value">{{ form.interests.length ? form.interests.map(i => interestOptions.find(o => o.v === i)?.l || i).join(', ') : '未设置' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-label">禁忌</span>
                  <span class="profile-value">{{ form.taboos.length ? form.taboos.map(t => t === 'smell' ? '气味敏感' : t === 'religion' ? '宗教禁忌' : t).join(', ') : '无' }}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <nav :class="{ 'tab-bar glass': true, 'hidden': phase === 'landing' }" role="navigation">
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'home' }"
          @click="goToHome"
          aria-label="首页"
        >
          <span class="tab-icon">🏠</span>
          <span class="tab-text">首页</span>
        </button>
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'browse' }"
          @click="goToBrowse"
          aria-label="浏览"
        >
          <span class="tab-icon">✨</span>
          <span class="tab-text">礼遇</span>
        </button>
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'profile' }"
          @click="goToProfile"
          aria-label="我的"
        >
          <span class="tab-icon">👤</span>
          <span class="tab-text">我的</span>
        </button>
      </nav>
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

.glass {
  background: rgba(28, 25, 23, 0.55);
  backdrop-filter: blur(18px);
}

.main-content {
  min-height: 100vh;
  padding-bottom: 56px;
  box-sizing: border-box;
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

.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  box-sizing: border-box;
}

.landing-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 320px;
  background: linear-gradient(180deg, rgba(202, 138, 4, 0.08) 0%, transparent 100%);
  pointer-events: none;
}

.landing-top {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.pill-ab {
  padding: 4px 10px;
  background: rgba(202, 138, 4, 0.15);
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: #ca8a04;
}

.landing-refine {
  font-size: 10px;
  color: #78716c;
  letter-spacing: 0.08em;
}

.landing-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.landing-eyebrow {
  margin: 0 0 12px;
  font-size: 11px;
  letter-spacing: 0.3em;
  color: #78716c;
}

.landing-title {
  margin: 0 0 8px;
  font-size: 4rem;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.landing-sub {
  margin: 0 0 24px;
  font-size: 1.25rem;
  font-weight: 300;
  letter-spacing: 0.2em;
  color: #a8a29e;
}

.landing-lead {
  margin: 0 0 32px;
  font-size: 14px;
  line-height: 1.7;
  color: #a8a29e;
}

.landing-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  color: #fafaf9;
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.18);
}

.action-icon {
  font-size: 16px;
}

.cta-explore {
  padding: 14px 48px;
  background: linear-gradient(135deg, #ca8a04 0%, #a16207 100%);
  border: none;
  border-radius: 999px;
  color: #1c1917;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cta-explore:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(202, 138, 4, 0.35);
}

.landing-hint {
  margin: 24px 0 0;
  font-size: 11px;
  color: #78716c;
}

.landing-foot {
  padding: 16px 0;
  font-size: 10px;
  color: #57534e;
  letter-spacing: 0.06em;
}

.tags-screen {
  min-height: 100vh;
  padding-bottom: 60px;
}

.tags-head {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 14px 16px;
  border-radius: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tags-title {
  margin: 8px 0 4px;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.tags-sub {
  margin: 0;
  font-size: 12px;
  color: #a8a29e;
}

.tags-body {
  margin: 12px;
  padding: 16px;
  border-radius: 2px;
}

.lx-label {
  display: block;
  margin: 16px 0 8px;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #a8a29e;
}

.lx-input {
  width: 100%;
  padding: 12px;
  background: rgba(12, 10, 9, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  color: #fafaf9;
  font-size: 13px;
  cursor: pointer;
}

.lx-input:focus {
  outline: none;
  border-color: rgba(202, 138, 4, 0.5);
}

.lx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lx-chip {
  padding: 8px 14px;
  background: rgba(12, 10, 9, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: #a8a29e;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lx-chip.on {
  background: rgba(202, 138, 4, 0.15);
  border-color: rgba(202, 138, 4, 0.4);
  color: #ca8a04;
}

.cta-gold {
  width: 100%;
  margin-top: 24px;
  padding: 14px;
  background: linear-gradient(135deg, #ca8a04 0%, #a16207 100%);
  border: none;
  border-radius: 2px;
  color: #1c1917;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.cta-gold:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #1c1917;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.link-ghost {
  background: none;
  border: none;
  color: #ca8a04;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.browse-screen {
  min-height: 100vh;
  padding-bottom: 80px;
}

.browse-head {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 14px 16px;
  border-radius: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-bar {
  margin: 12px;
  padding: 14px;
  border-radius: 2px;
}

.filter-eyebrow {
  margin: 0 0 12px;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #78716c;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.filter-label {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #a8a29e;
}

.filter-select {
  padding: 6px 10px;
  background: rgba(12, 10, 9, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  color: #fafaf9;
  font-size: 12px;
  cursor: pointer;
}

.filter-clear {
  width: 100%;
  padding: 10px;
  background: rgba(12, 10, 9, 0.4);
  border: none;
  border-radius: 2px;
  color: #a8a29e;
  font-size: 12px;
  cursor: pointer;
}

.browse-scroll {
  position: relative;
}

.pull-indicator {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transition: height 0.15s ease;
}

.pull-text {
  font-size: 12px;
  color: #a8a29e;
}

.loading-text {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: #a8a29e;
}

.empty-state {
  padding: 60px 24px;
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: #78716c;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 12px;
}

.product-card {
  padding: 12px;
  border-radius: 2px;
  cursor: pointer;
}

.card-img-wrap {
  position: relative;
  margin-bottom: 10px;
}

.card-img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 2px;
}

.card-collect {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  background: rgba(12, 10, 9, 0.7);
  border: none;
  border-radius: 50%;
  color: #a8a29e;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
}

.card-price {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: #ca8a04;
}

.card-reason {
  margin: 0;
}

.reason-glass {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(202, 138, 4, 0.1);
  border-radius: 999px;
  font-size: 11px;
  color: #ca8a04;
  display: inline-flex;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.modal {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  margin: 0 auto;
  background: #1c1917;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
}

.modal-handle {
  width: 48px;
  height: 6px;
  margin: 12px auto 0;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 50%;
  color: #a8a29e;
  font-size: 18px;
  cursor: pointer;
}

.modal-images {
  position: relative;
  height: 320px;
  background: #0c0a09;
}

.modal-prev,
.modal-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  background: rgba(12, 10, 9, 0.7);
  border: none;
  border-radius: 50%;
  color: #fafaf9;
  font-size: 24px;
  cursor: pointer;
}

.modal-prev {
  left: 12px;
}

.modal-next {
  right: 12px;
}

.modal-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-indicators {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}

.modal-indicator {
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.modal-indicator.active {
  background: #ca8a04;
}

.modal-body {
  padding: 16px;
}

.detail-name {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.detail-price {
  margin: 0 0 12px;
  font-size: 1.25rem;
  font-weight: 500;
  color: #ca8a04;
}

.detail-reason {
  margin: 0 0 16px;
}

.detail-desc {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.6;
  color: #a8a29e;
}

.detail-related {
  margin-bottom: 20px;
}

.related-title {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #a8a29e;
}

.related-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.related-item {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.related-thumb {
  width: 100%;
  height: 64px;
  object-fit: cover;
  border-radius: 2px;
}

.related-name {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.btn-outline {
  flex: 1;
  padding: 14px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  color: #fafaf9;
  font-size: 13px;
  cursor: pointer;
}

.btn-primary {
  flex: 2;
  padding: 14px;
  background: linear-gradient(135deg, #ca8a04 0%, #a16207 100%);
  border: none;
  border-radius: 2px;
  color: #1c1917;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.modal-legal {
  margin: 16px 0 0;
  font-size: 11px;
  color: #57534e;
  text-align: center;
}

.modal-favorites {
  max-height: 60vh;
}

.favorites-list {
  max-height: 300px;
  overflow-y: auto;
}

.favorite-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.favorite-item:last-child {
  border-bottom: none;
}

.favorite-name {
  font-size: 13px;
}

.btn-remove {
  padding: 6px 12px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 2px;
  color: #dc2626;
  font-size: 11px;
  cursor: pointer;
}

.modal-profile {
  max-height: 70vh;
}

.profile-content {
  padding-top: 8px;
}

.profile-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
}

.profile-label {
  font-size: 12px;
  color: #a8a29e;
}

.profile-value {
  font-size: 12px;
}

.profile-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 0;
}

.tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  width: 100%;
  max-width: 520px;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  border-radius: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  box-sizing: border-box;
}

.tab-bar.hidden {
  display: none;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0;
  margin: 0;
  background: none;
  border: none;
  color: #78716c;
  cursor: pointer;
  transition: color 0.3s ease;
  min-height: 48px;
}

.tab-item.active {
  color: #ca8a04;
}

.tab-icon {
  font-size: 20px;
  line-height: 1;
}

.tab-text {
  font-size: 10px;
  letter-spacing: 0.08em;
  line-height: 1.2;
}
</style>