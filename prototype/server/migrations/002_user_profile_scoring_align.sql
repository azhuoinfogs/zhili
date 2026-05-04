-- 策略 A：将旧版 user_profile 列名/缺列对齐 POST /api/personalized 与 scoring.js（develop2 §9.3.1）
-- 由 migrate.js 检测：仅当仍存在列 age_range 时执行（升级已跑过 001 的旧库）
-- 新装库若 001 已含 age_band/occasion/style/interests，则跳过本文件

ALTER TABLE `user_profile`
  CHANGE COLUMN `age_range` `age_band` VARCHAR(16) NULL COMMENT '与 personalized ageBand 一致: under18/18-25/26-35/36-45/46plus',
  CHANGE COLUMN `circles` `interests` JSON NULL COMMENT '与 personalized interests 一致，最多 3 项',
  ADD COLUMN `occasion` VARCHAR(32) NULL COMMENT '与 personalized occasion 一致' AFTER `budget`,
  ADD COLUMN `style` VARCHAR(32) NULL COMMENT '与 personalized style 一致' AFTER `occasion`;
