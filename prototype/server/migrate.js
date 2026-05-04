import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, execute, query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILE = path.join(__dirname, 'migrations', '001_b0_schema.sql');
const MIGRATION_002 = path.join(__dirname, 'migrations', '002_user_profile_scoring_align.sql');

function loadMigrationSql() {
  return fs.readFileSync(MIGRATION_FILE, 'utf8');
}

/** 按分号拆分可执行语句（忽略仅注释/空白的片段） */
function splitSqlStatements(sql) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      const noLineComments = s
        .split('\n')
        .map((line) => line.replace(/--.*$/, '').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
      return noLineComments.length > 0;
    });
}

const CREATE_TABLES_SQL = loadMigrationSql();

async function columnExists(tableName, columnName) {
  const db = process.env.DB_NAME || 'zhili_mvp';
  const rows = await query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [db, tableName, columnName]
  );
  return rows.length > 0;
}

async function tableExists(tableName) {
  const db = process.env.DB_NAME || 'zhili_mvp';
  const rows = await query(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     LIMIT 1`,
    [db, tableName]
  );
  return rows.length > 0;
}

/** 策略 A：旧库仍存在 age_range 时执行 002（develop2 §9.3.1） */
async function apply002UserProfileAlignIfNeeded() {
  if (!(await tableExists('user_profile'))) return;
  if (!(await columnExists('user_profile', 'age_range'))) return;
  const sql = fs.readFileSync(MIGRATION_002, 'utf8');
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    await execute(stmt);
  }
  console.log('[知礼 DB] 002 user_profile 列对齐（策略 A）:', MIGRATION_002);
}

async function createTables() {
  try {
    await initDatabase();
    const sqlStatements = splitSqlStatements(CREATE_TABLES_SQL);
    for (const sql of sqlStatements) {
      await execute(sql);
    }
    console.log('[知礼 DB] 001 迁移完成:', MIGRATION_FILE);
    await apply002UserProfileAlignIfNeeded();
    console.log('[知礼 DB] 迁移流程结束');
    process.exit(0);
  } catch (error) {
    console.error('[知礼 DB] 迁移失败:', error.message);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  createTables();
}

export { CREATE_TABLES_SQL, createTables, loadMigrationSql, MIGRATION_FILE };
