const { getProfile, getOrCreateGroup } = require('./storage.js');

const PAGE_SIZE = 10;

async function fetchRecommendChunk({ base, group, profile, listFilters, offset }) {
  try {
    const result = await wx.cloud.callFunction({
      name: 'product',
      data: { action: 'list' }
    });
    
    if (result.result && result.result.success) {
      let products = result.result.data;
      
      if (group === 'A') {
        products = [...products].sort((a, b) => b.sales - a.sales);
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
      
      const chunk = products.slice(offset, offset + PAGE_SIZE).map(p => ({
        id: p.productId,
        productId: p.productId,
        name: p.name || p.title || '未知商品',
        title: p.title || p.name || '未知商品',
        description: p.description,
        price: p.price,
        image: p.images?.[0] || p.image || 'https://picsum.photos/seed/default/200/200',
        tags: p.tags
      }));
      
      return chunk;
    } else {
      throw new Error(result.result?.error || '获取推荐失败');
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
    const result = await wx.cloud.callFunction({
      name: 'product',
      data: { action: 'list' }
    });
    
    if (result.result && result.result.success) {
      let products = result.result.data;
      
      if (group === 'A') {
        products = [...products].sort((a, b) => b.sales - a.sales).slice(0, 20);
      }
      
      return {
        success: true,
        list: products.map(p => ({
          id: p.productId,
          productId: p.productId,
          name: p.name || p.title || '未知商品',
          title: p.title || p.name || '未知商品',
          description: p.description,
          price: p.price,
          image: p.images?.[0] || p.image || 'https://picsum.photos/seed/default/200/200',
          tags: p.tags
        }))
      };
    } else {
      throw new Error(result.result?.error || '获取推荐失败');
    }
  } catch (err) {
    console.error('fetchRecommendList error:', err);
    return { success: false, error: err.message };
  }
}

async function fetchProductDetail(base, productId, profile = null) {
  try {
    const result = await wx.cloud.callFunction({
      name: 'product',
      data: { action: 'detail', productId }
    });
    
    if (result.result && result.result.success) {
      const p = result.result.data;
      return {
        success: true,
        data: {
          id: p.productId,
          productId: p.productId,
          name: p.name,
          description: p.description,
          price: p.price,
          images: p.images,
          tags: p.tags
        }
      };
    } else {
      throw new Error(result.result?.error || '获取商品详情失败');
    }
  } catch (err) {
    console.error('fetchProductDetail error:', err);
    return { success: false, error: err.message };
  }
}

async function fetchRelatedProducts(base, productId, profile = null) {
  try {
    const result = await wx.cloud.callFunction({
      name: 'product',
      data: { action: 'related', productId }
    });
    
    if (result.result && result.result.success) {
      return {
        success: true,
        data: result.result.data.map(p => ({
          id: p.productId,
          productId: p.productId,
          name: p.name || p.title || '未知商品',
          title: p.title || p.name || '未知商品',
          price: p.price,
          image: p.images?.[0] || p.image || 'https://picsum.photos/seed/default/200/200'
        }))
      };
    } else {
      throw new Error(result.result?.error || '获取相关推荐失败');
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
