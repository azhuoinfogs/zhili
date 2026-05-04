<script setup>
import { ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiJson, uploadImage } from '../api.js';

const props = defineProps({
  productId: { type: String, default: null },
});

const router = useRouter();
const isNew = computed(() => !props.productId);

const id = ref('');
const title = ref('');
const price = ref(0);
const gender = ref('any');
const hotRank = ref(999);
const sellPoint = ref('');
const occasionKeyword = ref('');
const affiliateUrl = ref('');
const listed = ref(true);
const images = ref(['']);
const stylesStr = ref('practical');
const occasionsStr = ref('birthday,universal');
const interestsStr = ref('tech');
const ageBandsStr = ref('26-35');
const taboosStr = ref('');
const err = ref('');
const busy = ref(false);

function splitCsv(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function load() {
  if (isNew.value) {
    id.value = '';
    title.value = '';
    price.value = 0;
    gender.value = 'any';
    hotRank.value = 999;
    sellPoint.value = '';
    occasionKeyword.value = '';
    affiliateUrl.value = '';
    listed.value = true;
    images.value = [''];
    return;
  }
  err.value = '';
  const data = await apiJson(`/admin/products/${encodeURIComponent(props.productId)}`);
  const p = data.product;
  id.value = p.productId;
  title.value = p.title;
  price.value = p.price;
  gender.value = p.gender;
  hotRank.value = p.hotRank;
  sellPoint.value = p.sellPoint || '';
  occasionKeyword.value = p.occasionKeyword || '';
  affiliateUrl.value = p.affiliateUrl || '';
  listed.value = !!p.listed;
  images.value = (p.images && p.images.length ? [...p.images] : ['']).map(String);
  stylesStr.value = (p.styles || []).join(',');
  occasionsStr.value = (p.occasions || []).join(',');
  interestsStr.value = (p.interests || []).join(',');
  ageBandsStr.value = (p.ageBands || []).join(',');
  taboosStr.value = (p.taboosAvoid || []).join(',');
}

watch(
  () => props.productId,
  () => load(),
  { immediate: true }
);

function addImageRow() {
  images.value.push('');
}

function removeImageRow(i) {
  if (images.value.length <= 1) return;
  images.value.splice(i, 1);
}

async function onPickFile(e, i) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  busy.value = true;
  err.value = '';
  try {
    const { url } = await uploadImage(f);
    images.value[i] = url;
  } catch (e2) {
    err.value = e2.message;
  } finally {
    busy.value = false;
  }
}

async function save() {
  err.value = '';
  const imgs = images.value.map((s) => String(s).trim()).filter(Boolean);
  if (imgs.length < 1) {
    err.value = '至少 1 张图片 URL（可上传或粘贴地址）';
    return;
  }
  const body = {
    title: title.value.trim(),
    price: Number(price.value),
    gender: gender.value,
    hotRank: Number(hotRank.value) || 999,
    sellPoint: sellPoint.value,
    occasionKeyword: occasionKeyword.value,
    affiliateUrl: affiliateUrl.value || null,
    listed: listed.value,
    images: imgs,
    styles: splitCsv(stylesStr.value),
    occasions: splitCsv(occasionsStr.value),
    interests: splitCsv(interestsStr.value),
    ageBands: splitCsv(ageBandsStr.value),
    taboosAvoid: splitCsv(taboosStr.value),
  };
  busy.value = true;
  try {
    if (isNew.value) {
      const pid = id.value.trim();
      if (!pid) {
        err.value = '请填写商品 ID（英文数字下划线短横线，≤32）';
        busy.value = false;
        return;
      }
      body.id = pid;
      await apiJson('/admin/products', { method: 'POST', body: JSON.stringify(body) });
    } else {
      await apiJson(`/admin/products/${encodeURIComponent(props.productId)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    }
    router.push({ name: 'products' });
  } catch (e) {
    err.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="card">
    <h2>{{ isNew ? '新增商品' : '编辑商品' }}</h2>
    <p v-if="err" class="err">{{ err }}</p>
    <form @submit.prevent="save">
      <div v-if="isNew" class="row">
        <label>商品 ID *</label>
        <input v-model="id" type="text" required pattern="[a-zA-Z0-9_-]{1,32}" placeholder="如 zl_new_01" />
      </div>
      <div class="row">
        <label>标题 *</label>
        <input v-model="title" type="text" required maxlength="255" />
      </div>
      <div class="row">
        <label>价格 *</label>
        <input v-model.number="price" type="number" step="0.01" min="0" required />
      </div>
      <div class="row">
        <label>性别向</label>
        <select v-model="gender">
          <option value="any">any</option>
          <option value="male">male</option>
          <option value="female">female</option>
          <option value="unknown">unknown</option>
        </select>
      </div>
      <div class="row">
        <label>热门序</label>
        <input v-model.number="hotRank" type="number" min="0" />
      </div>
      <div class="row">
        <label>上架</label>
        <input v-model="listed" type="checkbox" />
      </div>
      <div class="row">
        <label>卖点</label>
        <input v-model="sellPoint" type="text" />
      </div>
      <div class="row">
        <label>场合词</label>
        <input v-model="occasionKeyword" type="text" />
      </div>
      <div class="row">
        <label>联盟 URL</label>
        <input v-model="affiliateUrl" type="text" style="min-width: 320px" />
      </div>
      <div class="row">
        <label>图片 URL *</label>
        <div class="imgs">
          <div v-for="(im, i) in images" :key="i" class="imgline">
            <input v-model="images[i]" type="text" placeholder="https://..." />
            <input type="file" accept="image/*" @change="onPickFile($event, i)" />
            <button v-if="images.length > 1" type="button" class="ghost" @click="removeImageRow(i)">删行</button>
          </div>
          <button type="button" class="ghost" @click="addImageRow">加一行</button>
        </div>
      </div>
      <div class="row">
        <label>styles</label>
        <input v-model="stylesStr" type="text" placeholder="逗号分隔" />
      </div>
      <div class="row">
        <label>occasions</label>
        <input v-model="occasionsStr" type="text" />
      </div>
      <div class="row">
        <label>interests</label>
        <input v-model="interestsStr" type="text" />
      </div>
      <div class="row">
        <label>ageBands</label>
        <input v-model="ageBandsStr" type="text" />
      </div>
      <div class="row">
        <label>taboosAvoid</label>
        <input v-model="taboosStr" type="text" />
      </div>
      <div class="row" style="margin-top: 20px">
        <button type="button" class="ghost" @click="router.back()">取消</button>
        <button type="submit" class="primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
h2 {
  margin-top: 0;
}
.imgs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.imgline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.imgline input[type='text'] {
  flex: 1;
  min-width: 200px;
}
</style>
