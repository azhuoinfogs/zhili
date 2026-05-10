const { getProfile, getOrCreateGroup } = require('./storage.js');
const { get } = require('./request.js');

const PAGE_SIZE = 10;

async function fetchRecommendChunk({ base, group, profile, listFilters, offset }) {
  try {
    const params = {
      page: Math.floor(offset / PAGE_SIZE) + 1,
      size: PAGE_SIZE,
      ...listFilters
    };
    
    const result = await get('/api/recommend', params);
    
    if (result && result.success) {
      let products = result.data || [];
      
      if (group === 'A') {
        products = [...products].sort((a, b) => (b.sales || 0) - (a.sales || 0));
      }
      
      const { occasion, budget, style } = listFilters;
      
      if (occasion) {
        products = products.filter(p => p.tags?.includes(occasion));
      }
      if (budget) {
        const budgetMap = {
          'lt100': p => p.price < 100,
          '100-300': p => p.price >= 100 && p.price < 300,
          '300-500': p => p.price >= 300 && p.price < 500,
          '500-1000': p => p.price >= 500 && p.price < 1000,
          '1000+': p => p.price >= 1000
        };
        if (budgetMap[budget]) {
          products = products.filter(budgetMap[budget]);
        }
      }
      if (style) {
        products = products.filter(p => p.tags?.includes(style));
      }
      
      const chunk = products.map(p => ({
        id: p.productId || p.id,
        productId: p.productId || p.id,
        name: p.name || p.title || '未知商品',
        title: p.title || p.name || '未知商品',
        description: p.description,
        price: p.price,
        image: p.images?.[0] || p.image || 'https://picsum.photos/seed/default/200/200',
        tags: p.tags
      }));
      
      return chunk;
    } else {
      throw new Error(result?.error || '获取推荐失败');
    }
  } catch (err) {
    console.error('fetchRecommendChunk error:', err);
    throw err;
  }
}

async function fetchRecommendList(base, profile = null) {
  const userProfile = profile || getProfile();
  const group = getOrCreateGroup();
  
  try {
    const result = await get('/api/recommend', { page: 1, size: 20 });
    
    if (result && result.success) {
      let products = result.data || [];
      
      if (group === 'A') {
        products = [...products].sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 20);
      }
      
      return {
        success: true,
        list: products.map(p => ({
          id: p.productId || p.id,
          productId: p.productId || p.id,
          name: p.name || p.title || '未知商品',
          title: p.title || p.name || '未知商品',
          description: p.description,
          price: p.price,
          image: p.images?.[0] || p.image || 'https://picsum.photos/seed/default/200/200',
          tags: p.tags
        }))
      };
    } else {
      throw new Error(result?.error || '获取推荐失败');
    }
  } catch (err) {
    console.error('fetchRecommendList error:', err);
    return { success: false, error: err.message };
  }
}

async function fetchProductDetail(base, productId, profile = null) {
  try {
    const result = await get(`/api/product/${productId}`);
    
    if (result && result.success) {
      const p = result.data;
      return {
        success: true,
        data: {
          id: p.productId || p.id,
          productId: p.productId || p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          images: p.images,
          tags: p.tags
        }
      };
    } else {
      throw new Error(result?.error || '获取商品详情失败');
    }
  } catch (err) {
    console.error('fetchProductDetail error:', err);
    return { success: false, error: err.message };
  }
}

async function fetchRelatedProducts(base, productId, profile = null) {
  try {
    const result = await get(`/api/related/${productId}`);
    
    if (result && result.success) {
      return {
        success: true,
        data: (result.data || []).map(p => ({
          id: p.productId || p.id,
          productId: p.productId || p.id,
          name: p.name || p.title || '未知商品',
          title: p.title || p.name || '未知商品',
          price: p.price,
          image: p.images?.[0] || p.image || 'https://picsum.photos/seed/default/200/200'
        }))
      };
    } else {
      throw new Error(result?.error || '获取相关推荐失败');
    }
  } catch (err) {
    console.error('fetchRelatedProducts error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  PAGE_SIZE,
  fetchRecommendChunk,
  fetchRecommendList,
  fetchProductDetail,
  fetchRelatedProducts
};
