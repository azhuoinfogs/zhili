-- B0 工程与数据基座（develop2 §6；画像/商品英文键与 API 对齐）
-- 执行：在 server 目录 npm run migrate

CREATE TABLE IF NOT EXISTS `user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` VARCHAR(128) UNIQUE COMMENT '微信openid',
  `device_id` VARCHAR(64) COMMENT '设备ID',
  `anon_id` VARCHAR(64) UNIQUE COMMENT '匿名ID(zhili_vid)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_openid` (`openid`),
  INDEX `idx_anon_id` (`anon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS `user_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '画像ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `name` VARCHAR(64) COMMENT '画像名称',
  `relation` VARCHAR(32) COMMENT '关系: friend/partner/family/colleague/lover/parent/child/other',
  `gender` VARCHAR(16) COMMENT '性别: male/female/unknown',
  `age_range` VARCHAR(16) COMMENT '年龄区间: under18/18-25/26-35/36-45/46plus',
  `budget` VARCHAR(16) COMMENT '预算档位: lt100/100-300/300-500/500-1000/1000+',
  `circles` JSON COMMENT '兴趣圈层数组',
  `taboos` JSON COMMENT '禁忌数组',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否默认画像',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_default` (`is_default`),
  CONSTRAINT `fk_user_profile_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户画像表';

CREATE TABLE IF NOT EXISTS `product` (
  `product_id` VARCHAR(32) NOT NULL COMMENT '商品ID',
  `name` VARCHAR(255) NOT NULL COMMENT '商品名称',
  `price` DECIMAL(10,2) NOT NULL COMMENT '价格',
  `sell_point` VARCHAR(512) COMMENT '卖点',
  `occasion_keyword` VARCHAR(128) COMMENT '场合关键词',
  `images` JSON COMMENT '图片URL数组',
  `styles` JSON COMMENT '风格标签数组',
  `occasions` JSON COMMENT '适用场合数组',
  `interests` JSON COMMENT '兴趣标签数组',
  `gender` VARCHAR(16) COMMENT '适用性别',
  `age_bands` JSON COMMENT '适用年龄区间数组',
  `taboos_avoid` JSON COMMENT '禁忌标签数组',
  `hot_rank` INT UNSIGNED NOT NULL DEFAULT 999 COMMENT '热门排名',
  `click_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点击次数',
  `affiliate_url` VARCHAR(512) COMMENT '联盟链接',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`product_id`),
  INDEX `idx_hot_rank` (`hot_rank`),
  INDEX `idx_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

CREATE TABLE IF NOT EXISTS `collection` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收藏ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `product_id` VARCHAR(32) NOT NULL COMMENT '商品ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_product` (`user_id`, `product_id`),
  INDEX `idx_user_id` (`user_id`),
  CONSTRAINT `fk_collection_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collection_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

CREATE TABLE IF NOT EXISTS `event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '事件ID',
  `event_type` VARCHAR(64) NOT NULL COMMENT '事件类型',
  `user_id` BIGINT UNSIGNED COMMENT '用户ID(登录后)',
  `product_id` VARCHAR(32) COMMENT '商品ID',
  `page_name` VARCHAR(64) COMMENT '页面名称',
  `position` INT COMMENT '位置索引',
  `extra` JSON COMMENT '额外数据(含zhili_vid等匿名信息)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='事件埋点表';
