const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();

const mockProducts = [
  {
    _id: 'p001',
    productId: 'p001',
    name: '茶香礼盒',
    description: '精选乌龙茶与红茶组合，雅致包装',
    price: 298,
    images: ['https://picsum.photos/seed/tea/400/400'],
    tags: ['tea', 'gift', 'traditional'],
    stock: 100,
    sales: 234
  },
  {
    _id: 'p002',
    productId: 'p002',
    name: '香薰蜡烛套装',
    description: '天然大豆蜡，多种香型可选',
    price: 168,
    images: ['https://picsum.photos/seed/candle/400/400'],
    tags: ['candle', 'home', 'relax'],
    stock: 200,
    sales: 567
  },
  {
    _id: 'p003',
    productId: 'p003',
    name: '复古钢笔礼盒',
    description: '德国工艺，精美书写体验',
    price: 458,
    images: ['https://picsum.photos/seed/pen/400/400'],
    tags: ['pen', 'office', 'luxury'],
    stock: 50,
    sales: 123
  },
  {
    _id: 'p004',
    productId: 'p004',
    name: '多肉植物组合',
    description: '精选萌系多肉，附赠陶瓷花盆',
    price: 128,
    images: ['https://picsum.photos/seed/plant/400/400'],
    tags: ['plant', 'home', 'green'],
    stock: 150,
    sales: 345
  },
  {
    _id: 'p005',
    productId: 'p005',
    name: '手工巧克力礼盒',
    description: '比利时进口原料，精美手工制作',
    price: 328,
    images: ['https://picsum.photos/seed/choco/400/400'],
    tags: ['chocolate', 'food', 'sweet'],
    stock: 80,
    sales: 789
  },
  {
    _id: 'p006',
    productId: 'p006',
    name: '丝绸围巾',
    description: '100%桑蚕丝，优雅印花',
    price: 568,
    images: ['https://picsum.photos/seed/scarf/400/400'],
    tags: ['scarf', 'fashion', 'elegant'],
    stock: 60,
    sales: 234
  },
  {
    _id: 'p007',
    productId: 'p007',
    name: '智能手环',
    description: '健康监测，运动追踪',
    price: 299,
    images: ['https://picsum.photos/seed/bracelet/400/400'],
    tags: ['tech', 'fitness', 'smart'],
    stock: 300,
    sales: 876
  },
  {
    _id: 'p008',
    productId: 'p008',
    name: '精装笔记本',
    description: '手工皮质封面，优质内页',
    price: 158,
    images: ['https://picsum.photos/seed/notebook/400/400'],
    tags: ['notebook', 'office', 'creative'],
    stock: 200,
    sales: 456
  }
];

exports.main = async (event, context) => {
  const { action, productId } = event;
  
  try {
    if (action === 'detail') {
      const product = mockProducts.find(p => p.productId === productId);
      if (!product) {
        return { success: false, error: '商品不存在' };
      }
      return { success: true, data: product };
    } else if (action === 'list') {
      return { success: true, data: mockProducts };
    } else if (action === 'related') {
      const current = mockProducts.find(p => p.productId === productId);
      if (!current) {
        return { success: false, error: '商品不存在' };
      }
      const related = mockProducts.filter(p => 
        p.productId !== productId && 
        p.tags.some(t => current.tags.includes(t))
      ).slice(0, 4);
      return { success: true, data: related };
    }
    
    return { success: false, error: '无效的action' };
  } catch (err) {
    console.error('product操作失败:', err);
    return { success: false, error: err.message };
  }
};
