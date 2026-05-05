const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, profile, user_id, mockOpenid } = event;
  const wxContext = cloud.getWXContext();
  
  // 获取 OPENID，优先使用模拟值，然后是真实值
  let openid = mockOpenid || wxContext.OPENID;
  
  // 如果仍然没有 OPENID，返回错误
  if (!openid) {
    return { success: false, error: '无法获取用户标识，请先登录' };
  }
  
  try {
    let user = await db.collection('users').where({ openid }).get();
    
    if (user.data.length === 0) {
      return { success: false, error: '用户不存在' };
    }
    
    user = user.data[0];
    
    if (action === 'get') {
      return {
        success: true,
        data: user.profile || {}
      };
    } else if (action === 'set') {
      await db.collection('users').doc(user._id).update({
        data: {
          profile: profile || {},
          updated_at: new Date()
        }
      });
      return { success: true };
    }
    
    return { success: false, error: '无效的action' };
  } catch (err) {
    console.error('profile操作失败:', err);
    return { success: false, error: err.message };
  }
};
