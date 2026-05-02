前端最小页面验证流程——开发步骤及阶段说明
本流程目标：用最轻量的前端页面（H5或小程序）快速验证推荐算法的有效性，不依赖完整后端系统。核心是A/B分流、画像采集、推荐展示、埋点上报，并通过数据分析判断个性化推荐是否优于热门推荐。

一、整体阶段划分
阶段	时间	产出	说明
1. 设计准备	0.5天	页面原型、埋点方案、A/B分流逻辑	确定UI简图、数据字段
2. 前端页面开发	1.5天	可运行H5页面（或小程序开发版）	包含表单、推荐流、埋点
3. 后端模拟（可选）	0.5天	简单的JSON API或Mock数据	若后端未就绪，可用静态JSON
4. 用户招募与实验运行	2-3天	收集200用户行为数据	线上或线下扫码访问
5. 数据分析与报告	0.5天	实验报告（CTR对比、显著性检验）	判断验证是否通过
二、详细步骤（含技术实现要点）
阶段1：设计准备（0.5天）
1.1 定义验证指标
主要指标：点击率（CTR = 点击商品次数 / 曝光商品次数）

次要指标：收藏率、用户问卷评分（推荐理由合理性）

1.2 设计页面流程（3屏）
text
第一屏：画像表单（关系、年龄、兴趣圈层、场合、预算、性别）
第二屏：推荐商品瀑布流（双列卡片，展示图片、标题、价格、推荐理由）
第三屏：商品详情弹窗或简单页（展示完整推荐理由 + 收藏按钮）
要求：简单、低代码，无需登录（用localStorage存储userId和分组）。

1.3 定义A/B分流规则
用户首次访问时随机分配 group = 'A'（对照组，热门推荐）或 group = 'B'（实验组，个性化推荐）

分配后存入 localStorage，后续访问保持不变。

前端根据 group 请求不同的推荐接口（或参数）。

1.4 埋点事件设计
事件	触发时机	上报字段
page_view	页面加载完成	user_id, group, page_name
form_submit	提交画像	所有表单字段
impression	商品卡片进入可视区	product_id, position
click	点击卡片/查看详情	product_id
collect	点击收藏按钮	product_id
purchase_click	点击“去购买”	product_id
1.5 数据存储方案
前端仅负责上报，数据统一收集到第三方或简单后端（如Google Form、腾讯云数据万象、或自建API）。

若自建API，可用 Flask/Express + SQLite 在本地临时运行。

阶段2：前端页面开发（1.5天）
2.1 技术选型（推荐H5，方便传播）
框架：Vue 3 CDN 或 React CDN（无需构建）

UI库：Vant UI 或 自定义简单样式

HTTP 库：Axios

存储：localStorage

2.2 页面组件拆分
组件1：画像表单（Form.vue）

使用 <select> 或 Vant Picker

兴趣圈层：多选框（最多3个，超过提示）

提交时校验预算为正、圈层非空（可选）

提交后存储画像到 localStorage + 上报 form_submit

组件2：推荐列表（RecommendList.vue）

接收 group 和 profile 作为props

请求推荐API（根据group决定参数）

使用 IntersectionObserver 实现曝光上报

每项包含：图片、标题、价格、推荐理由、收藏图标

组件3：详情弹窗（DetailModal.vue）

点击卡片时弹出，展示完整信息

包含收藏按钮（点击后上报 collect）

包含“去购买”按钮（模拟，仅上报 purchase_click）

2.3 推荐API对接（Mock 或 轻量后端）
方案A：完全前端Mock（适用于快速验证，但无法动态更新商品）

javascript
// 在前端写死商品列表（50个，从打标结果中提取）
const allProducts = [...];  // 包含标签
function getHotProducts() { return shuffle(allProducts).slice(0,20); }
function getPersonalizedProducts(profile) {
  return allProducts.map(p => ({...p, score: computeScore(p, profile)}))
                    .sort((a,b)=>b.score-a.score).slice(0,20);
}
方案B：轻量后端（推荐，更真实）

用 json-server 或 Node.js + express 提供两个接口：

GET /api/hot：返回热门商品列表（固定排序）

POST /api/personalized：接收画像，返回排序后商品列表

后端实现与MVP开发文档一致的打分逻辑（约50行代码）

2.4 埋点上报实现
javascript
function track(eventName, extra = {}) {
  const data = {
    event: eventName,
    user_id: localStorage.getItem('user_id'),
    group: localStorage.getItem('group'),
    timestamp: Date.now(),
    ...extra
  };
  // 发送到轻量后端或第三方（如Google Analytics、Beacon API）
  navigator.sendBeacon('https://your-log-server.com/collect', JSON.stringify(data));
}
2.5 存储与用户识别
首次访问时生成 user_id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2,6)

存入 localStorage，所有埋点带上

阶段3：后端模拟（0.5天，如需要）
如果选择方案B，创建一个最简单的Node服务（server.js）：

javascript
const express = require('express');
const app = express();
app.use(express.json());

// 商品数据从CSV加载（预先转换为JSON）
const products = require('./products.json');

app.get('/api/hot', (req, res) => {
  // 简单随机排序作为热门
  const hot = [...products].sort(() => 0.5 - Math.random()).slice(0,20);
  res.json(hot);
});

app.post('/api/personalized', (req, res) => {
  const profile = req.body;
  const scored = products.map(p => ({
    ...p,
    score: computeScore(p, profile)
  })).sort((a,b)=>b.score-a.score).slice(0,20);
  res.json(scored);
});

app.listen(3000, () => console.log('Mock server ready'));
使用 node server.js 启动，前端代理或CORS处理。

阶段4：用户招募与实验运行（2-3天）
4.1 部署页面
使用 Vercel/Netlify 免费托管静态H5页面（或微信开发者工具上传开发版小程序）。

确保页面可以通过二维码访问。

4.2 招募用户（200人）
内部：公司群、亲友（50人）

外部：知乎/小红书发帖、微信群红包（150人）

激励：完成实验后抽奖（10元红包 x 20份）

4.3 数据收集
所有埋点数据发送到轻量后端，存为CSV（每天导出）。

实验持续至少3天，确保每组有效用户（完成画像+曝光≥10个商品）≥80人。

4.4 问卷收集（可选）
在页面底部或实验结束后跳转腾讯问卷，询问：

“推荐的商品是否符合收礼人喜好？”（1-5分）

“推荐理由是否合理？”（1-5分）

阶段5：数据分析与报告（0.5天）
5.1 数据清洗
python
import pandas as pd
df = pd.read_csv('events.csv')
# 过滤无效用户（未提交画像或曝光数<10）
users_with_profile = df[df['event']=='form_submit']['user_id'].unique()
impressions = df[df['event']=='impression'].groupby('user_id').size()
valid_users = [u for u in users_with_profile if impressions.get(u,0) >= 10]
df_valid = df[df['user_id'].isin(valid_users)]
5.2 计算CTR
python
# 按分组计算
impressions_by_group = df_valid[df_valid['event']=='impression'].groupby('group').size()
clicks_by_group = df_valid[df_valid['event']=='click'].groupby('group').size()
ctr = clicks_by_group / impressions_by_group
print(ctr)
5.3 显著性检验（卡方检验）
python
from scipy.stats import chi2_contingency
# 构建列联表
a_imp, a_clk = impressions_by_group['A'], clicks_by_group['A']
b_imp, b_clk = impressions_by_group['B'], clicks_by_group['B']
table = [[a_clk, a_imp - a_clk], [b_clk, b_imp - b_clk]]
chi2, p, dof, expected = chi2_contingency(table)
print(f'p-value = {p}')
if p < 0.05:
    print("个性化推荐显著优于热门推荐")
5.4 输出报告模板
指标	A组（热门）	B组（个性化）	提升	p值
总曝光数	3,200	3,100	-	-
点击数	128	186	-	-
CTR	4.0%	6.0%	+50%	0.012
结论：B组CTR显著高于A组，推荐模型有效 ✅

三、前端最小页面验证产物清单
产物	格式	说明
页面代码	HTML/CSS/JS	可直接部署的静态文件
埋点数据	CSV/JSON	至少3天的实验数据
分析脚本	Python Notebook	自动计算CTR和显著性
实验报告	PDF/Markdown	包含结论和改进建议
四、与完整MVP开发的关系
若验证通过：前端页面中的推荐逻辑可直接复用至小程序，画像字段设计与后端对齐。

若验证不通过：调整推荐权重、增加特征或修改交互（如引导用户填写更精确的圈层），再次进行小范围验证。

五、注意事项
不要做复杂后端：最小验证的核心是前端+Mock数据或最简单的API，避免过度工程。

确保分流稳定：用户刷新页面后分组不变，否则污染实验。

埋点不漏：使用 sendBeacon 保证页面关闭前数据发送。

隐私保护：不收集真实姓名、电话，仅在页面声明“匿名数据仅用于产品优化”。

按此流程，2-3天即可完成前端最小页面验证，快速决策是否进入完整MVP开发。