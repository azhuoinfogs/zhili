-- 添加用户认证相关字段（用于手机号+密码注册/登录）
-- 执行：在 server 目录 npm run migrate

ALTER TABLE `user`
  ADD COLUMN `phone` VARCHAR(11) UNIQUE COMMENT '手机号' AFTER `anon_id`,
  ADD COLUMN `password` VARCHAR(64) COMMENT '密码哈希(sha256)' AFTER `phone`,
  ADD COLUMN `nickname` VARCHAR(64) DEFAULT '用户' COMMENT '昵称' AFTER `password`,
  ADD COLUMN `avatar` VARCHAR(256) COMMENT '头像URL' AFTER `nickname`,
  ADD INDEX `idx_phone` (`phone`);