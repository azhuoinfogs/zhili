-- 可选：将 server/data/events.csv 导入 SQLite 后使用
-- sqlite3 events.sqlite
-- .mode csv
-- .import server/data/events.csv events
-- 注意：CSV 列名为 group，SQLite 中需加引号
CREATE TABLE IF NOT EXISTS events (
  server_ts INTEGER,
  event TEXT,
  user_id TEXT,
  "group" TEXT,
  page_name TEXT,
  client_ts INTEGER,
  product_id TEXT,
  position INTEGER,
  payload_json TEXT
);
