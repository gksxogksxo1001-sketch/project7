const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { run, get, all, migrateLegacyDataToUser } = require('./db');

// ==========================================
// 0. 인증 미들웨어 (과제 7: 비인가 접근 및 로그아웃 후 거절 방어)
// ==========================================
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: '로그인이 필요합니다. 로그인 후 이용해주세요.'
    });
  }
  next();
}

// ==========================================
// 1. 인증(Auth) API (가입, 로그인, 로그아웃, 중복체크, 내정보)
// ==========================================

// 아이디 실시간 중복 확인 (동적 유효성 검사)
router.get('/auth/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username || username.trim() === '') {
    return res.status(400).json({ success: false, available: false, message: '아이디를 입력해주세요.' });
  }

  const trimmed = username.trim();
  // 정규식: 영문, 숫자, 밑줄, 4~20자
  const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;
  if (!usernameRegex.test(trimmed)) {
    return res.json({
      success: true,
      available: false,
      message: '아이디는 4~20자의 영문, 숫자, 밑줄(_)만 사용 가능합니다.'
    });
  }

  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [trimmed]);
    if (existing) {
      return res.json({
        success: true,
        available: false,
        message: '이미 사용 중인 아이디입니다.'
      });
    }
    return res.json({
      success: true,
      available: true,
      message: '사용 가능한 멋진 아이디입니다!'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 회원가입 (이름, 생년월일, 성별, 전화번호, 주소, 아이디, 비밀번호 해싱)
router.post('/auth/register', async (req, res) => {
  const { username, password, name, birthdate, gender, phone, address } = req.body;

  // 필수 필드 유효성 검증
  if (!username || !password || !name || !birthdate || !gender || !phone || !address) {
    return res.status(400).json({
      success: false,
      message: '아이디, 비밀번호, 이름, 생년월일, 성별, 전화번호, 주소를 모두 입력해주세요.'
    });
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 4 || password.length < 4) {
    return res.status(400).json({
      success: false,
      message: '아이디와 비밀번호는 각각 최소 4자 이상이어야 합니다.'
    });
  }

  try {
    // 중복 아이디 최종 검사
    const existing = await get('SELECT id FROM users WHERE username = ?', [trimmedUsername]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: '이미 사용 중인 아이디입니다.'
      });
    }

    // 비밀번호 bcrypt 솔트 해싱 (과제 7: 비밀번호 원문 노출 금지)
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await run(`
      INSERT INTO users (username, password_hash, name, birthdate, gender, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [trimmedUsername, password_hash, name.trim(), birthdate.trim(), gender.trim(), phone.trim(), address.trim()]);

    const newUserId = result.lastID;

    // T07-C100: 6번에서 만들어 둔 기존 내 자료가 있는 경우 신규 계정으로 자동 이전
    await migrateLegacyDataToUser(newUserId);

    // 가입 완료 후 자동 로그인 세션 생성
    req.session.userId = newUserId;
    req.session.username = trimmedUsername;
    req.session.name = name.trim();

    res.status(201).json({
      success: true,
      message: '회원가입이 성공적으로 완료되었습니다!',
      user: {
        id: newUserId,
        username: trimmedUsername,
        name: name.trim()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 로그인 (세션 발급 & 비밀번호 검증)
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 모두 입력해주세요.' });
  }

  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    // T07-C100: 기존 과제 6 미지정 자료가 남아있는 경우 로그인한 계정으로 이전
    await migrateLegacyDataToUser(user.id);

    // 세션 저장
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.name = user.name;

    res.json({
      success: true,
      message: `${user.name}님, 환영합니다!`,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        address: user.address,
        birthdate: user.birthdate,
        gender: user.gender
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 로그아웃 (세션 파괴 & 세션 쿠키 만료)
router.post('/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: '로그아웃 처리 중 오류가 발생했습니다.' });
      }
      res.clearCookie('plandosee.sid');
      return res.json({ success: true, message: '안전하게 로그아웃되었습니다.' });
    });
  } else {
    res.json({ success: true, message: '이미 로그아웃된 상태입니다.' });
  }
});

// 현재 로그인 정보 확인 (/auth/me)
router.get('/auth/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: '로그인되어 있지 않습니다.' });
  }

  try {
    const user = await get(`
      SELECT id, username, name, birthdate, gender, phone, address, created_at 
      FROM users WHERE id = ?
    `, [req.session.userId]);

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계정 삭제 / 회원 탈퇴 (T07-C134: 내 계정을 지우면 내 자료도 함께 지워짐)
router.delete('/auth/account', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    // 1. 소유한 모든 다이어리 데이터 영구 삭제
    await run('DELETE FROM reflections WHERE user_id = ?', [userId]);
    await run('DELETE FROM executions WHERE user_id = ?', [userId]);
    await run('DELETE FROM todos WHERE user_id = ?', [userId]);
    await run('DELETE FROM plan_histories WHERE user_id = ?', [userId]);
    await run('DELETE FROM plans WHERE user_id = ?', [userId]);
    await run('DELETE FROM users WHERE id = ?', [userId]);

    // 2. 세션 파괴 및 쿠키 삭제
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: '탈퇴 처리 중 세션 정리 오류가 발생했습니다.' });
      }
      res.clearCookie('plandosee.sid');
      return res.json({
        success: true,
        message: '계정이 완전히 삭제되었으며, 등록하신 모든 계획과 기록이 함께 영구 삭제되었습니다.'
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. 대시보드 및 집계 통계 (본인 데이터만 집계: T06-C28 ~ C32)
// ==========================================
router.get('/summary', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const totalPlansRow = await get('SELECT COUNT(*) as count FROM plans WHERE user_id = ?', [userId]);
    const completedPlansRow = await get("SELECT COUNT(*) as count FROM plans WHERE user_id = ? AND status = 'COMPLETED'", [userId]);
    
    // T06-C28: 돌아보기의 계획 수 = 본인의 지우지 않은 할 일 수
    const totalTodosRow = await get('SELECT COUNT(*) as count FROM todos WHERE user_id = ?', [userId]);
    
    // T06-C29: 돌아보기의 완료 수 = 본인의 지금 완료 상태인 할 일 수
    const completedTodosRow = await get("SELECT COUNT(*) as count FROM todos WHERE user_id = ? AND status = 'COMPLETED'", [userId]);
    
    // T06-C30: 돌아보기의 지연 수 = 본인 완료되지 않았고 마감일이 오늘보다 앞선 할 일 수
    const delayedTodosRow = await get(`
      SELECT COUNT(*) as count FROM todos 
      WHERE user_id = ? AND status != 'COMPLETED' AND due_date < date('now', 'localtime')
    `, [userId]);

    // T06-C31: 돌아보기의 막힘 수 = 본인 막힌 이유가 적힌 할 일 수
    const blockedTodosRow = await get(`
      SELECT COUNT(DISTINCT t.id) as count 
      FROM todos t
      JOIN executions e ON t.id = e.todo_id
      WHERE t.user_id = ? AND e.blocked_reason IS NOT NULL AND TRIM(e.blocked_reason) != ''
    `, [userId]);

    // T06-C32: 예상 시간 합계, 실제 시간 합계, 차이 계산 (본인 데이터만)
    const timeStatsRow = await get(`
      SELECT 
        COALESCE(SUM(t.estimated_minutes), 0) as total_estimated,
        COALESCE(SUM(e.actual_minutes), 0) as total_actual
      FROM todos t
      LEFT JOIN executions e ON t.id = e.todo_id
      WHERE t.user_id = ?
    `, [userId]);

    const totalEstimated = timeStatsRow.total_estimated || 0;
    const totalActual = timeStatsRow.total_actual || 0;
    const timeVariance = totalActual - totalEstimated; // 실제 - 예상

    // 회고 대기 항목 (완료되었으나 reflection이 없는 본인 할 일)
    const needReflectionRow = await get(`
      SELECT COUNT(*) as count FROM todos t
      LEFT JOIN reflections r ON t.id = r.todo_id
      WHERE t.user_id = ? AND t.status = 'COMPLETED' AND r.id IS NULL
    `, [userId]);

    // 오차 원인별 집계 (본인 데이터만)
    const varianceStats = await all(`
      SELECT variance_reason, COUNT(*) as count 
      FROM reflections 
      WHERE user_id = ?
      GROUP BY variance_reason 
      ORDER BY count DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        totalPlans: totalPlansRow.count,
        completedPlans: completedPlansRow.count,
        totalTodos: totalTodosRow.count,
        completedTodos: completedTodosRow.count,
        completionRate: totalTodosRow.count > 0 ? Math.round((completedTodosRow.count / totalTodosRow.count) * 100) : 0,
        delayedCount: delayedTodosRow.count,
        blockedCount: blockedTodosRow.count,
        totalEstimatedMinutes: totalEstimated,
        totalActualMinutes: totalActual,
        timeVariance: timeVariance,
        needReflectionCount: needReflectionRow.count,
        varianceStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. 내 데이터 JSON 백업 내보내기 (본인 데이터만 백업)
// ==========================================
router.get('/export', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const username = req.session.username;

  try {
    const plans = await all('SELECT * FROM plans WHERE user_id = ? ORDER BY id ASC', [userId]);
    const planHistories = await all('SELECT * FROM plan_histories WHERE user_id = ? ORDER BY id ASC', [userId]);
    const todos = await all('SELECT * FROM todos WHERE user_id = ? ORDER BY id ASC', [userId]);
    const executions = await all('SELECT * FROM executions WHERE user_id = ? ORDER BY id ASC', [userId]);
    const reflections = await all('SELECT * FROM reflections WHERE user_id = ? ORDER BY id ASC', [userId]);

    const backupData = {
      app: 'Plan-Do-See Diary',
      version: '3.0.0-auth',
      user: { id: userId, username },
      exported_at: new Date().toISOString(),
      timezone: 'Asia/Seoul',
      data: {
        plans,
        plan_histories: planHistories,
        todos,
        executions,
        reflections
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=plan-do-see-${username}-backup-${Date.now()}.json`);
    res.json(backupData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. 계획 (Plan) API (소유권 검증 및 격리)
// ==========================================
router.get('/plans', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const plans = await all(`
      SELECT p.*, 
             COUNT(t.id) as todo_count,
             SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_todo_count,
             (SELECT COUNT(*) FROM plan_histories ph WHERE ph.plan_id = p.id) as history_count
      FROM plans p
      LEFT JOIN todos t ON p.id = t.plan_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC
    `, [userId]);
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계획 상세 조회 (남의 자료 요청 시 403 Forbidden 거절)
router.get('/plans/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const planId = req.params.id;

  try {
    const plan = await get('SELECT * FROM plans WHERE id = ?', [planId]);
    if (!plan) {
      return res.status(404).json({ success: false, message: '계획을 찾을 수 없습니다.' });
    }

    // 소유권 검증 (과제 7: 남의 자료 읽기 차단)
    if (plan.user_id !== userId) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: '해당 계획에 접근할 수 있는 권한이 없습니다.'
      });
    }

    const histories = await all('SELECT * FROM plan_histories WHERE plan_id = ? ORDER BY version ASC', [plan.id]);
    const todos = await all('SELECT * FROM todos WHERE plan_id = ? ORDER BY id ASC', [plan.id]);

    res.json({
      success: true,
      data: {
        ...plan,
        histories,
        todos
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계획 등록
router.post('/plans', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { title, category, start_date, end_date, priority, success_criteria, estimated_minutes } = req.body;
  if (!title || !category || !start_date || !end_date || !priority || !success_criteria || estimated_minutes === undefined) {
    return res.status(400).json({ success: false, message: '모든 계획 필수 항목을 입력해주세요.' });
  }

  try {
    const result = await run(`
      INSERT INTO plans (user_id, title, category, start_date, end_date, priority, success_criteria, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes)]);

    const planId = result.lastID;

    // 최초 계획 버전 1 이력 보존
    await run(`
      INSERT INTO plan_histories (plan_id, user_id, version, title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, '최초 계획 등록')
    `, [planId, userId, title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes)]);

    const createdPlan = await get('SELECT * FROM plans WHERE id = ?', [planId]);
    res.status(201).json({ success: true, data: createdPlan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계획 수정 (남의 계획 수정 시 403 Forbidden 거절)
router.put('/plans/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const planId = req.params.id;
  const { title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason } = req.body;

  try {
    const current = await get('SELECT * FROM plans WHERE id = ?', [planId]);
    if (!current) return res.status(404).json({ success: false, message: '수정할 계획을 찾을 수 없습니다.' });

    // 소유권 검증 (과제 7: 남의 자료 수정 차단)
    if (current.user_id !== userId) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: '해당 계획을 수정할 수 있는 권한이 없습니다.'
      });
    }

    const lastHistory = await get('SELECT MAX(version) as max_version FROM plan_histories WHERE plan_id = ?', [planId]);
    const nextVersion = (lastHistory && lastHistory.max_version ? lastHistory.max_version : 1) + 1;

    await run(`
      UPDATE plans 
      SET title = ?, category = ?, start_date = ?, end_date = ?, priority = ?, success_criteria = ?, estimated_minutes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ? AND user_id = ?
    `, [title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes), planId, userId]);

    await run(`
      INSERT INTO plan_histories (plan_id, user_id, version, title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [planId, userId, nextVersion, title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes), change_reason || `계획 수정 (버전 ${nextVersion})`]);

    const updated = await get('SELECT * FROM plans WHERE id = ?', [planId]);
    const histories = await all('SELECT * FROM plan_histories WHERE plan_id = ? ORDER BY version ASC', [planId]);

    res.json({ success: true, data: { ...updated, histories } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계획 삭제 (남의 계획 삭제 시 403 Forbidden 거절)
router.delete('/plans/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const planId = req.params.id;

  try {
    const current = await get('SELECT * FROM plans WHERE id = ?', [planId]);
    if (!current) return res.status(404).json({ success: false, message: '삭제할 계획을 찾을 수 없습니다.' });

    // 소유권 검증
    if (current.user_id !== userId) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: '해당 계획을 삭제할 수 있는 권한이 없습니다.'
      });
    }

    await run('DELETE FROM plans WHERE id = ? AND user_id = ?', [planId, userId]);
    res.json({ success: true, message: '계획이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. 할 일 (Todo) 및 실행 기록 (Executions) API (소유권 검증 및 격리)
// ==========================================
router.get('/todos', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const { plan_id, search, status, priority, tag, drilldown, sort_by } = req.query;

    let sql = `
      SELECT t.*, p.title as plan_title,
             e.id as execution_id, e.started_at, e.ended_at, e.actual_minutes, e.blocked_reason,
             r.id as reflection_id, r.variance_reason, r.insight, r.action_item
      FROM todos t
      JOIN plans p ON t.plan_id = p.id
      LEFT JOIN executions e ON t.id = e.todo_id
      LEFT JOIN reflections r ON t.id = r.todo_id
      WHERE t.user_id = ?
    `;
    const params = [userId];

    if (plan_id) {
      sql += ' AND t.plan_id = ?';
      params.push(plan_id);
    }

    if (search && search.trim() !== '') {
      sql += ' AND (t.content LIKE ? OR t.tag LIKE ? OR p.title LIKE ?)';
      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword, keyword);
    }

    if (status && status !== 'ALL') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (priority && priority !== 'ALL') {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    if (tag && tag.trim() !== '') {
      sql += ' AND t.tag = ?';
      params.push(tag.trim());
    }

    // T06-C83 드릴다운 매핑
    if (drilldown === 'completed') {
      sql += ` AND t.status = 'COMPLETED'`;
    } else if (drilldown === 'delayed') {
      sql += ` AND t.status != 'COMPLETED' AND t.due_date < date('now', 'localtime')`;
    } else if (drilldown === 'blocked') {
      sql += ` AND e.blocked_reason IS NOT NULL AND TRIM(e.blocked_reason) != ''`;
    } else if (drilldown === 'need_reflection') {
      sql += ` AND t.status = 'COMPLETED' AND r.id IS NULL`;
    }

    // 정렬 기준
    const priorityWeight = `CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END`;
    if (sort_by === 'priority') {
      sql += ` ORDER BY ${priorityWeight} ASC, t.due_date ASC, t.id ASC`;
    } else if (sort_by === 'estimated_minutes') {
      sql += ` ORDER BY t.estimated_minutes DESC, t.id ASC`;
    } else if (sort_by === 'created_desc') {
      sql += ` ORDER BY t.id DESC`;
    } else {
      sql += ` ORDER BY t.due_date ASC, ${priorityWeight} ASC, t.id ASC`;
    }

    const todos = await all(sql, params);
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 등록
router.post('/todos', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { plan_id, content, due_date, priority, tag, estimated_minutes } = req.body;
  if (!plan_id || !content || !due_date || !priority || !tag || estimated_minutes === undefined) {
    return res.status(400).json({ success: false, message: '할 일 필수 정보를 모두 입력해주세요.' });
  }

  try {
    // 연결된 계획이 본인 것인지 검증
    const plan = await get('SELECT * FROM plans WHERE id = ?', [plan_id]);
    if (!plan) return res.status(404).json({ success: false, message: '연결할 계획을 찾을 수 없습니다.' });
    if (plan.user_id !== userId) {
      return res.status(403).json({ success: false, message: '해당 계획에 할 일을 추가할 권한이 없습니다.' });
    }

    const result = await run(`
      INSERT INTO todos (plan_id, user_id, content, due_date, priority, tag, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [plan_id, userId, content, due_date, priority, tag, Number(estimated_minutes)]);

    const created = await get('SELECT * FROM todos WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 수정 (소유권 검증)
router.put('/todos/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const todoId = req.params.id;
  const { content, due_date, priority, tag, estimated_minutes } = req.body;

  try {
    const todo = await get('SELECT * FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ success: false, message: '할 일을 찾을 수 없습니다.' });
    if (todo.user_id !== userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: '해당 할 일을 수정할 권한이 없습니다.' });
    }

    await run(`
      UPDATE todos
      SET content = ?, due_date = ?, priority = ?, tag = ?, estimated_minutes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ? AND user_id = ?
    `, [content, due_date, priority, tag, Number(estimated_minutes), todoId, userId]);

    const updated = await get('SELECT * FROM todos WHERE id = ?', [todoId]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 완료 & 실행 기록 작성 (소유권 검증 및 멱등성 유지)
router.post('/todos/:id/execution', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const todoId = req.params.id;
  const { started_at, ended_at, actual_minutes, blocked_reason } = req.body;

  if (!started_at || !ended_at || actual_minutes === undefined) {
    return res.status(400).json({ success: false, message: '시작 시각, 끝난 시각, 실제 걸린 시간은 필수입니다.' });
  }

  try {
    const todo = await get('SELECT * FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ success: false, message: '할 일을 찾을 수 없습니다.' });
    if (todo.user_id !== userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: '해당 할 일을 완료 처리할 권한이 없습니다.' });
    }

    // T06-C21: 이미 실행 기록이 있는지 확인 (멱등성 방어)
    const existingExecution = await get('SELECT * FROM executions WHERE todo_id = ?', [todoId]);
    if (existingExecution) {
      return res.json({ 
        success: true, 
        message: '이미 완료 처리된 기록입니다. (중복 방어 완료)', 
        data: existingExecution 
      });
    }

    // 실행 기록 등록
    await run(`
      INSERT INTO executions (todo_id, user_id, started_at, ended_at, actual_minutes, blocked_reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [todoId, userId, started_at, ended_at, Number(actual_minutes), blocked_reason || null]);

    // 상태 변경
    await run(`
      UPDATE todos 
      SET status = 'COMPLETED', updated_at = datetime('now', 'localtime')
      WHERE id = ? AND user_id = ?
    `, [todoId, userId]);

    const createdExecution = await get('SELECT * FROM executions WHERE todo_id = ?', [todoId]);
    res.status(201).json({ success: true, data: createdExecution });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 완료 취소 / 되돌리기
router.post('/todos/:id/revert', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const todoId = req.params.id;

  try {
    const todo = await get('SELECT * FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ success: false, message: '할 일을 찾을 수 없습니다.' });
    if (todo.user_id !== userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: '해당 할 일을 되돌릴 권한이 없습니다.' });
    }

    await run('DELETE FROM executions WHERE todo_id = ? AND user_id = ?', [todoId, userId]);
    await run('DELETE FROM reflections WHERE todo_id = ? AND user_id = ?', [todoId, userId]);
    await run(`UPDATE todos SET status = 'PENDING', updated_at = datetime('now', 'localtime') WHERE id = ? AND user_id = ?`, [todoId, userId]);
    res.json({ success: true, message: '진행 중으로 되돌렸습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 삭제
router.delete('/todos/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const todoId = req.params.id;

  try {
    const todo = await get('SELECT * FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ success: false, message: '할 일을 찾을 수 없습니다.' });
    if (todo.user_id !== userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: '해당 할 일을 삭제할 권한이 없습니다.' });
    }

    await run('DELETE FROM todos WHERE id = ? AND user_id = ?', [todoId, userId]);
    res.json({ success: true, message: '할 일이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 6. 돌아보기 (Reflection / See) API (소유권 검증 및 격리)
// ==========================================
router.get('/reflections', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const reflections = await all(`
      SELECT r.*, t.content as todo_content, t.estimated_minutes, e.actual_minutes, e.blocked_reason, p.title as plan_title
      FROM reflections r
      JOIN plans p ON r.plan_id = p.id
      LEFT JOIN todos t ON r.todo_id = t.id
      LEFT JOIN executions e ON t.id = e.todo_id
      WHERE r.user_id = ?
      ORDER BY r.id DESC
    `, [userId]);
    res.json({ success: true, data: reflections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reflections', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { plan_id, todo_id, variance_reason, time_variance, insight, action_item } = req.body;
  if (!plan_id || !variance_reason || !insight || !action_item) {
    return res.status(400).json({ success: false, message: '회고 필수 항목을 모두 입력해주세요.' });
  }

  try {
    const plan = await get('SELECT * FROM plans WHERE id = ?', [plan_id]);
    if (!plan) return res.status(404).json({ success: false, message: '연결된 계획을 찾을 수 없습니다.' });
    if (plan.user_id !== userId) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: '해당 계획에 회고를 작성할 권한이 없습니다.' });
    }

    const result = await run(`
      INSERT INTO reflections (plan_id, todo_id, user_id, variance_reason, time_variance, insight, action_item)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [plan_id, todo_id || null, userId, variance_reason, Number(time_variance || 0), insight, action_item]);

    const created = await get('SELECT * FROM reflections WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
