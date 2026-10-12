const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// DB 파일 저장 경로 (서버 영속성 보장)
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'plandosee.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite 연결 실패:', err.message);
  } else {
    console.log('✅ SQLite 연결 성공:', dbPath);
  }
});

// Promise 헬퍼 함수
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 테이블 초기화
async function initDb() {
  // 1. 계획 테이블 (T06-C04:기간, T06-C05:우선순위, T06-C06:성공기준, T06-C07:예상시간)
  await run(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      success_criteria TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 2. 계획 수정 이력 테이블 (T06-C08: 계획을 고쳐도 고치기 전 내용 보존)
  await run(`
    CREATE TABLE IF NOT EXISTS plan_histories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      success_criteria TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      change_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    )
  `);

  // 3. 할 일 (Do) 테이블 (T06-C09 ~ T06-C17)
  await run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      tag TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      actual_minutes INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    )
  `);

  // 4. 돌아보기 (See / 회고) 테이블
  await run(`
    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      todo_id INTEGER,
      variance_reason TEXT NOT NULL,
      time_variance INTEGER NOT NULL DEFAULT 0,
      insight TEXT NOT NULL,
      action_item TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
    )
  `);

  console.log('✅ DB 스키마 초기화 완료 (plans, plan_histories, todos, reflections)');
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};
