CREATE TABLE IF NOT EXISTS import_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_url VARCHAR(1024) NOT NULL,
  platform VARCHAR(16) NOT NULL,
  product_id VARCHAR(32) NULL,
  status ENUM('success', 'failed') NOT NULL,
  message VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_import_history_platform (platform),
  INDEX idx_import_history_status (status),
  INDEX idx_import_history_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
