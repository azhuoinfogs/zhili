const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { code, anon_id } = event;
  
  if (!code) {
    return { success: false, error: '缺少code参数' };
  }
  
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    if (!openid) {
      return { success: false, error: '获取openid失败' };
    }
    
    let user = await db.collection('users').where({ openid }).get();
    
    if (user.data.length === 0) {
      const group = Math.random() > 0.5 ? 'A' : 'B';
      const result = await db.collection('users').add({
        data: {
          openid,
          anon_id,
          group,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      user = { _id: result._id, openid, group };
    } else {
      user = user.data[0];
      if (anon_id && !user.anon_id) {
        await db.collection('users').doc(user._id).update({
          data: { anon_id, updated_at: new Date() }
        });
      }
    }
    
    return {
      success: true,
      data: {
        user_id: user._id,
        openid: user.openid,
        group: user.group,
        token: `${user._id}_${Date.now()}`
      }
    };
  } catch (err) {
    console.error('登录失败:', err);
    return { success: false, error: err.message };
  }
};
