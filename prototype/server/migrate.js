import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, execute } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILE = path.join(__dirname, 'migrations', '001_b0_schema.sql');

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

async function createTables() {
  try {
    await initDatabase();
    const sqlStatements = splitSqlStatements(CREATE_TABLES_SQL);
    for (const sql of sqlStatements) {
      await execute(sql);
    }
    console.log('[知礼 DB] 迁移完成:', MIGRATION_FILE);
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
