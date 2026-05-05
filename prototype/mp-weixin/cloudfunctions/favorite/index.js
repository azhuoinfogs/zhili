const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, productId, productInfo } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    if (action === 'add') {
      const exists = await db.collection('favorites')
        .where({ openid, productId })
        .get();
      
      if (exists.data.length > 0) {
        return { success: false, error: '已收藏' };
      }
      
      await db.collection('favorites').add({
        data: {
          openid,
          productId,
          name: productInfo?.name || productInfo?.productName || '未知商品',
          price: productInfo?.price || productInfo?.productPrice || 0,
          image: productInfo?.image || productInfo?.productImage || 'https://picsum.photos/seed/default/200/200',
          created_at: db.serverDate()
        }
      });
      
      return { success: true, isCollected: true };
    } else if (action === 'remove') {
      const result = await db.collection('favorites')
        .where({ openid, productId })
        .remove();
      
      if (result.stats.removed === 0) {
        return { success: false, error: '未收藏' };
      }
      
      return { success: true, isCollected: false };
    } else if (action === 'list') {
      const favorites = await db.collection('favorites')
        .where({ openid })
        .orderBy('created_at', 'desc')
        .get();
      
      return { success: true, data: favorites.data };
    } else if (action === 'status') {
      const exists = await db.collection('favorites')
        .where({ openid, productId })
        .get();
      
      return { success: true, isCollected: exists.data.length > 0 };
    }
    
    return { success: false, error: '无效的action' };
  } catch (err) {
    console.error('favorite操作失败:', err);
    return { success: false, error: err.message };
  }
};
