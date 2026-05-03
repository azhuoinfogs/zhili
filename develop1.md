送礼AI - MVP开发文档（完整版）
版本: v2.0
更新日期: 2026-05-02
编写者: 产品经理 & 技术负责人
状态: 待评审

目录
0. 前置验证：前端最小页面验证

1. 项目范围

2. 技术选型

3. 功能清单

4. 数据库设计

5. API接口设计

6. 推荐算法（v1.0）

7. 开发任务分解

8. 商品打标与初始化

9. 验收标准

10. 发布与灰度计划

11. 风险与应对

12. 里程碑与交付物

13. 附录

0. 前置验证：前端最小页面验证
目的：用最小成本（2-3天）验证个性化推荐是否显著优于热门推荐。
结论通过条件：B组CTR > A组且提升≥10%，p<0.05；用户评分≥4分比例>70%。
若不通过：调整算法或交互后重新验证，不启动完整MVP开发。

0.1 验证目标
指标	目标
个性化推荐组（B组）CTR	比热门组（A组）提升 ≥10%
统计显著性（卡方检验）	p < 0.05
推荐理由合理性评分（1-5分）	≥4分比例 >70%
0.2 流程与时间表
阶段	时间	产出	负责人
准备（原型/埋点/分流）	0.5天	页面原型、埋点方案文档	产品+前端
前端页面开发	1.5天	可运行H5页面（画像+推荐流+埋点）	前端
轻量后端（Mock API）	0.5天	商品Mock API / 简单Node服务	后端
用户招募与实验	2-3天	收集≥200用户行为数据	运营+产品
数据分析与报告	0.5天	实验报告（CTR对比+显著性检验）	数据分析
0.3 技术实现要点
前端: Vue3 CDN + Vant UI（或微信小程序开发版），部署在Vercel/Netlify。

分流: 用户首次访问时随机分配A组（热门，随机排序）或B组（个性化），存入localStorage。

商品数据: 从打标结果中提取50-200个商品，转化为JSON前端数据。

推荐逻辑: B组前端实现打分函数（公式见6节），A组随机/按销量排序。

埋点: 使用navigator.sendBeacon上报到轻量后端或Google表单。

用户识别: 生成匿名user_id存入localStorage。

0.4 数据收集与分析
收集事件：page_view, form_submit, impression, click, collect, purchase_click。
分析脚本（Python）计算CTR、卡方检验、输出结论。

决策门：验证通过 → 进入第1章正式MVP开发；不通过 → 调整后再次验证。

1. 项目范围
1.1 核心目标
开发微信小程序，实现“创建收礼人画像 → 个性化推荐 → 收藏 → 跳转购买”闭环。
前提：前置验证已证明个性化推荐有效。

1.2 范围界定
包含（v1.0）：

微信授权登录（静默）

收礼人画像创建与管理（多画像、切换）

个性化推荐流（双列瀑布，规则+画像匹配）

商品详情页（动态推荐理由）

收藏功能（云端同步）

跳转电商购买（京东/淘宝联盟）

基础数据埋点

不包含（v1.0后迭代）：

订阅提醒、送礼记录

AB实验平台、负反馈处理

分享海报、裂变邀请

自营商城或会员体系

2. 技术选型
层	技术	理由
小程序端	微信小程序原生 + WeUI	稳定、包体积小、无第三方依赖
后端	Node.js (Nest.js) + TypeScript	便于维护，社区生态好
数据库	MySQL 8.0 + Redis 7.0	业务数据存储 + 推荐缓存
电商联盟	京东联盟API（首选） + 淘宝联盟备用	高佣金、商品质量好
部署	腾讯云（CVM + CDN）	小程序合规、备案方便
埋点	自定义 + 微信数据分析	MVP阶段轻量自建
3. 功能清单
3.1 用户端小程序
功能	描述	优先级
微信登录	静默获取openId，生成用户记录	P0
收礼人画像创建	表单：关系、年龄段、兴趣圈层（最多3）、默认场合、预算、性别	P0
多画像管理	列表展示，支持新增、编辑、删除、切换默认	P1
推荐首页	双列瀑布流，顶栏筛选（场合/预算/风格）	P0
商品详情页	图片轮播、价格、推荐理由、参数、类似推荐	P0
收藏功能	收藏/取消，收藏列表查看	P0
购买跳转	点击“去购买”跳转电商小程序或webview	P0
我的页面	展示收藏列表、画像管理入口	P0
3.2 后台管理系统（极简版）
功能	描述	优先级
商品管理	商品CRUD、标签编辑（性别/年龄/圈层/场合/风格）	P0
数据看板	展示DAU、推荐请求量、CTR、收藏率（基于埋点）	P1
画像查看	查看用户画像匿名统计数据（年龄分布/圈层喜好）	P1
4. 数据库设计
4.1 用户表 user
sql
CREATE TABLE `user` (
  `user_id` int PRIMARY KEY AUTO_INCREMENT,
  `openid` varchar(64) UNIQUE NOT NULL,
  `nickname` varchar(64),
  `avatar_url` varchar(255),
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
);
4.2 用户画像表 user_profile
sql
CREATE TABLE `user_profile` (
  `profile_id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `relation` enum('伴侣','家人','朋友','同事','长辈','老师','客户','其他') NOT NULL,
  `age_range` enum('<18','18-25','26-35','36-45','46+') NOT NULL,
  `circles` json,                -- 兴趣圈层数组，最多3个
  `occasion` varchar(20) NOT NULL,
  `budget_max` decimal(10,2) NOT NULL,
  `gender` enum('男','女','通用'),
  `is_current` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`)
);
4.3 商品表 product
sql
CREATE TABLE `product` (
  `product_id` varchar(32) PRIMARY KEY,
  `name` varchar(128) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `gender` enum('男','女','通用'),
  `age_range` json,               -- 适用年龄段数组
  `circles` json,                 -- 兴趣圈层数组（最多3）
  `occasions` json,               -- 适用场合数组
  `style` enum('实用','仪式','搞怪','温情'),
  `selling_point` varchar(50),
  `occasion_keyword` varchar(10),
  `images` json,                  -- 图片URL数组
  `status` enum('on_shelf','off_shelf') DEFAULT 'on_shelf',
  `click_count` int DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
);
4.4 收藏表 collection
sql
CREATE TABLE `collection` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` varchar(32) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`),
  FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`)
);
4.5 埋点事件表 event
sql
CREATE TABLE `event` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `event_type` varchar(20),     -- impression/click/collect/purchase
  `product_id` varchar(32),
  `extra` json,                  -- 存放场景、位置等上下文
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_time (`user_id`, `created_at`)
);
5. API接口设计（RESTful）
端点	方法	说明	请求示例
/api/user/login	POST	微信code登录	{ code: "xxx" }
/api/profile	POST	创建/更新画像	{ user_id, relation, age_range, circles, occasion, budget_max, gender }
/api/profile/list	GET	获取用户所有画像	?user_id=123
/api/profile/current	PUT	设置当前默认画像	{ user_id, profile_id }
/api/recommend	GET	获取推荐列表（已排序）	?user_id=123&profile_id=1&occasion=birthday&budget=300-500&page=1&size=20
/api/product/:product_id	GET	商品详情	-
/api/collect	POST	添加收藏	{ user_id, product_id }
/api/collect	DELETE	取消收藏	{ user_id, product_id }
/api/collect/list	GET	获取收藏列表	?user_id=123
/api/event	POST	上报事件	{ user_id, event_type, product_id, extra }
/api/purchase/url	GET	获取电商跳转链接	?product_id=p_1001
6. 推荐算法（v1.0）
6.1 得分公式
python
total_score = interest_match * 0.5 + occasion_match * 0.3 + base_match * 0.2
子项	权重	计算规则
兴趣匹配分	0.5	重合圈层数：3个→10分，2个→7分，1个→4分，0个→0分；未选圈层→5分（均值）
场合匹配分	0.3	场合匹配（完全匹配6分 / 通用场合4分 / 不匹配0分）+ 风格匹配（完全匹配4分 / 部分2分 / 冲突0分）
基础匹配分	0.2	性别匹配（匹配4分 / 通用3分 / 不匹配0分）+ 年龄匹配（完全3分 / 相邻1分 / 不匹配0分）+ 预算匹配（预算内3分 / 超≤20%得1分 / 超>20%0分）
6.2 推荐理由生成
取得分最高的因子，从模板库选择：

javascript
const reasonMap = {
  interest: `因为ta喜欢{circle}，${product.selling_point}`,
  occasion: `${occasion}选它，${product.occasion_keyword || '表达心意'}`,
  style: `${style}之选，恰到好处`,
  budget: `刚好在预算内，性价比不错`
};
6.3 缓存策略
Redis缓存key：recommend:{user_id}:{profile_id}:{filter_hash}，TTL=10分钟

修改画像时主动删除该用户所有推荐缓存

Redis故障时降级为热门商品（按点击量排序）

7. 开发任务分解
前提：前置验证已通过，且商品打标已完成。
总周期：4周（2人并行，总计约27人天）

模块	任务	人天	负责人
后端	数据库设计与初始化	1	后端
后端	用户登录（微信）	1	后端
后端	画像CRUD API	2	后端
后端	推荐打分函数实现	2	后端
后端	Redis缓存集成	1	后端
后端	推荐API开发	2	后端
后端	商品CRUD API	1	后端
后端	电商联盟对接（获取商品+转链）	2	后端
后端	收藏API & 事件API	2	后端
后端合计		14	
前端	小程序项目搭建、登录页	1	前端
前端	画像创建/编辑页（多步表单）	3	前端
前端	多画像管理页	2	前端
前端	推荐首页（瀑布流+筛选）	4	前端
前端	商品详情页	2	前端
前端	收藏列表页	2	前端
前端	我的页面	1	前端
前端	埋点上报集成	1	前端
前端合计		16	
后台管理	商品管理页（表格+标签编辑）	2	全栈
后台管理	简易数据看板	2	全栈
后台合计		4	
测试与部署	功能测试、性能测试	3	QA
测试与部署	小程序提审与发布	1	产品
总计		38	
实际开发中前后端可并行，总日历时间约4周。

8. 商品打标与初始化
8.1 打标流程
商品抓取：从京东联盟API获取200个礼物类目商品。

自动预打标：运行脚本根据标题/价格自动生成部分标签。

人工精标：2名运营依据商品详情完善标签（2分钟/商品，3天完成）。

交叉校验：抽检20%，准确率≥90%后导入数据库。

8.2 标签体系
类型	字段	取值
基础	适用性别	男 / 女 / 通用
基础	适用年龄段	<18, 18-25, 26-35, 36-45, 46+（多选）
兴趣	圈层	科技数码、文艺生活、户外运动、美妆护肤、居家宅人、时尚穿搭、美食美酒、健康养生、职场办公、母婴亲子（最多3个）
情境	适用场合	生日、纪念日、节日、感谢、道歉、无理由（多选）
情境	风格	实用、仪式、搞怪、温情（单选）
情境	关键词	自定义（≤3个）
禁忌	禁忌项	气味敏感、宗教禁忌等（选填）
9. 验收标准
9.1 功能测试（全部通过）
场景	验收点
登录	微信授权后正常进入，无报错
画像创建	所有字段可填、保存、修改；圈层最多选3个；预算为正数
多画像	可切换默认，删除后自动切换到其他
推荐列表	切换画像/筛选后1秒内刷新；下拉加载更多；无结果时空状态
商品详情	图片轮播，推荐理由与画像匹配
收藏	详情页和列表页收藏状态同步；收藏列表可删除
跳转购买	点击按钮打开京东/淘宝小程序或H5，返回后无异常
埋点	控制台能看到事件上报成功
9.2 性能指标
指标	目标
推荐接口响应时间（P90）	≤ 1.5秒
首页首屏加载（4G）	≤ 2秒
并发用户100	CPU ≤ 70%
小程序包大小	≤ 2MB（主包）
9.3 用户体验测试（5名非开发人员）
任务：创建画像 → 筛选 → 收藏商品 → 跳转购买

成功率：100%

平均完成时间：≤ 3分钟（无引导）

10. 发布与灰度计划
10.1 环境划分
环境	用途	域名
开发环境	本地或Dev服务器	dev.giftai.com
测试环境	内部测试	test.giftai.com
生产环境	线上小程序	api.giftai.com
10.2 发布流程
代码合并到release分支，自动构建小程序包。

上传小程序代码至微信公众平台（设为“开发版”）。

内部测试20人（1天）。

小范围灰度5%用户（2天），监控错误率<1%。

审核通过后全量发布，监控24小时。

10.3 回滚条件
崩溃率 > 0.5%

推荐接口成功率 < 95%

用户投诉“隐私泄露”（立即下线）

11. 风险与应对
风险	概率	应对措施
电商联盟API不稳定	中	增加超时重试（最多2次）；缓存上次成功结果
推荐效果差导致跳出率高	中	后台保留“热门榜单”兜底；支持运营手动调整权重
小程序审核被拒	低	提前阅读《电商小程序规范》，准备测试账号
商品池不足200个	低	先保证50个精品商品上线，运营持续扩充
用户画像完成率低	中	简化表单（圈层可选），提供默认画像示例
12. 里程碑与交付物
里程碑	时间	交付物
前置验证完成报告	W0	实验报告+分析脚本
数据库设计评审	W1D1	ER图、建表SQL
后端核心API完成	W1D5	Swagger文档，Postman测试集合
前端UI开发完成	W2D5	小程序体验版二维码
联调测试完成	W3D3	测试报告、Bug清单
小程序提审	W3D5	上线版本代码
正式发布	W4D1	生产环境运行
13. 附录
A. 商品打标Excel模板（含数据验证） → [见单独文件]

B. 自动预打标脚本 (auto_tag.py) → [见单独文件]

C. CSV导入数据库脚本 (csv_to_mysql.py) → [见单独文件]

D. 前置验证分析脚本 (analyze_experiment.py) → [见单独文件]

E. 推荐缓存策略详细设计 → [见技术方案文档]

F. 数据库索引优化建议 → [见技术方案文档]