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
  // 0. 사용자(Users) 테이블 (과제 7: 가입, 로그인, 개인정보, 암호화된 비밀번호 보관)
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      birthdate TEXT NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 1. 계획 테이블 (T06-C04:기간, T06-C05:우선순위, T06-C06:성공기준, T06-C07:예상시간 + user_id)
  await run(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      success_criteria TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 2. 계획 수정 이력 테이블 (T06-C08: 계획을 고쳐도 고치기 전 내용 보존)
  await run(`
    CREATE TABLE IF NOT EXISTS plan_histories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      user_id INTEGER,
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

  // 3. 할 일 (Do) 테이블 (T06-C09 ~ T06-C17 + user_id)
  await run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      tag TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    )
  `);

  // 4. 실행 기록 (Executions) 테이블 (카드 3: T06-C21 ~ C27 + user_id)
  // UNIQUE(todo_id)로 완료 연타 시에도 중복 방지 (T06-C21)
  await run(`
    CREATE TABLE IF NOT EXISTS executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      actual_minutes INTEGER NOT NULL,
      blocked_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    )
  `);

  // 5. 돌아보기 (See / 회고) 테이블 (+ user_id)
  await run(`
    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      todo_id INTEGER,
      user_id INTEGER,
      variance_reason TEXT NOT NULL,
      time_variance INTEGER NOT NULL DEFAULT 0,
      insight TEXT NOT NULL,
      action_item TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
    )
  `);

  // 마이그레이션: 기존 테이블에 user_id 컬럼이 없으면 안전하게 추가
  const addColumnIfNotExists = async (tableName, columnName, colType) => {
    try {
      const columns = await all(`PRAGMA table_info(${tableName})`);
      const exists = columns.some(c => c.name === columnName);
      if (!exists) {
        await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${colType}`);
        console.log(`ℹ️ [Migration] ${tableName} 테이블에 ${columnName} 컬럼 추가 완료`);
      }
    } catch (e) {
      console.warn(`마이그레이션 확인 중 경고 (${tableName}.${columnName}):`, e.message);
    }
  };

  await addColumnIfNotExists('plans', 'user_id', 'INTEGER');
  await addColumnIfNotExists('plan_histories', 'user_id', 'INTEGER');
  await addColumnIfNotExists('todos', 'user_id', 'INTEGER');
  await addColumnIfNotExists('executions', 'user_id', 'INTEGER');
  await addColumnIfNotExists('reflections', 'user_id', 'INTEGER');

  console.log('✅ DB 스키마 초기화 완료 (users, plans, plan_histories, todos, executions, reflections)');
}

// T07-C100: 6번에서 만든 기존 다이어리 자료를 계정으로 안전하게 이전
async function migrateLegacyDataToUser(userId) {
  if (!userId) return;
  try {
    const unassignedPlans = await get('SELECT COUNT(*) as count FROM plans WHERE user_id IS NULL');
    if (unassignedPlans && unassignedPlans.count > 0) {
      await run('UPDATE plans SET user_id = ? WHERE user_id IS NULL', [userId]);
      await run('UPDATE plan_histories SET user_id = ? WHERE user_id IS NULL', [userId]);
      await run('UPDATE todos SET user_id = ? WHERE user_id IS NULL', [userId]);
      await run('UPDATE executions SET user_id = ? WHERE user_id IS NULL', [userId]);
      await run('UPDATE reflections SET user_id = ? WHERE user_id IS NULL', [userId]);
      console.log(`ℹ️ [T07-C100] 과제 6 기존 자료 ${unassignedPlans.count}건이 사용자(ID: ${userId}) 계정으로 이전되었습니다.`);
    }
  } catch (err) {
    console.warn('과제 6 자료 이전 중 경고:', err.message);
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb,
  migrateLegacyDataToUser
};

