const express = require('express');
const router = express.Router();
const { run, get, all } = require('./db');

// ==========================================
// 1. 대시보드 통계 & 드릴다운 데이터 (Summary)
// ==========================================
router.get('/summary', async (req, res) => {
  try {
    const totalPlansRow = await get('SELECT COUNT(*) as count FROM plans');
    const completedPlansRow = await get("SELECT COUNT(*) as count FROM plans WHERE status = 'COMPLETED'");
    
    const totalTodosRow = await get('SELECT COUNT(*) as count FROM todos');
    const completedTodosRow = await get("SELECT COUNT(*) as count FROM todos WHERE status = 'COMPLETED'");
    
    // 지연 또는 시간 초과된 할 일 (마감일 지남 OR 실제소요시간 > 예상소요시간)
    const delayedTodosRow = await get(`
      SELECT COUNT(*) as count FROM todos 
      WHERE (status = 'PENDING' AND due_date < date('now', 'localtime'))
         OR (status = 'COMPLETED' AND actual_minutes > estimated_minutes)
    `);

    // 회고 대기 항목 (완료되었으나 reflection이 없는 할 일)
    const needReflectionRow = await get(`
      SELECT COUNT(*) as count FROM todos t
      LEFT JOIN reflections r ON t.id = r.todo_id
      WHERE t.status = 'COMPLETED' AND r.id IS NULL
    `);

    // 오차 원인별 집계
    const varianceStats = await all(`
      SELECT variance_reason, COUNT(*) as count 
      FROM reflections 
      GROUP BY variance_reason 
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        totalPlans: totalPlansRow.count,
        completedPlans: completedPlansRow.count,
        totalTodos: totalTodosRow.count,
        completedTodos: completedTodosRow.count,
        completionRate: totalTodosRow.count > 0 ? Math.round((completedTodosRow.count / totalTodosRow.count) * 100) : 0,
        delayedCount: delayedTodosRow.count,
        needReflectionCount: needReflectionRow.count,
        varianceStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. 계획 (Plan) API
// ==========================================

// 계획 목록 조회
router.get('/plans', async (req, res) => {
  try {
    const plans = await all(`
      SELECT p.*, 
             COUNT(t.id) as todo_count,
             SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_todo_count,
             (SELECT COUNT(*) FROM plan_histories ph WHERE ph.plan_id = p.id) as history_count
      FROM plans p
      LEFT JOIN todos t ON p.id = t.plan_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 단일 계획 상세 조회 (히스토리 포함)
router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await get('SELECT * FROM plans WHERE id = ?', [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, message: '계획을 찾을 수 없습니다.' });

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

// 계획 생성 (T06-C04:기간, C05:우선순위, C06:성공기준, C07:예상시간 + 최초 버전 스냅샷 생성)
router.post('/plans', async (req, res) => {
  const { title, category, start_date, end_date, priority, success_criteria, estimated_minutes } = req.body;
  if (!title || !category || !start_date || !end_date || !priority || !success_criteria || estimated_minutes === undefined) {
    return res.status(400).json({ success: false, message: '모든 계획 필수 항목을 입력해주세요.' });
  }

  try {
    const result = await run(`
      INSERT INTO plans (title, category, start_date, end_date, priority, success_criteria, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes)]);

    const planId = result.lastID;

    // T06-C08: 최초 계획도 버전 1로 이력(스냅샷)에 보존
    await run(`
      INSERT INTO plan_histories (plan_id, version, title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, '최초 계획 등록')
    `, [planId, title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes)]);

    const createdPlan = await get('SELECT * FROM plans WHERE id = ?', [planId]);
    res.status(201).json({ success: true, data: createdPlan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계획 수정 (T06-C08: 계획을 고쳐도 고치기 전 계획이 그대로 남아 있다 - 이력 테이블에 버전 기록)
router.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason } = req.body;

  try {
    const current = await get('SELECT * FROM plans WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ success: false, message: '수정할 계획을 찾을 수 없습니다.' });

    // 현재 최대 버전 번호 조회
    const lastHistory = await get('SELECT MAX(version) as max_version FROM plan_histories WHERE plan_id = ?', [id]);
    const nextVersion = (lastHistory && lastHistory.max_version ? lastHistory.max_version : 1) + 1;

    // 1. 계획 테이블 업데이트 (계획 ID는 유지되면서 내용 갱신)
    await run(`
      UPDATE plans 
      SET title = ?, category = ?, start_date = ?, end_date = ?, priority = ?, success_criteria = ?, estimated_minutes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes), id]);

    // 2. T06-C08 보존: 변경된 새 내용을 새로운 버전 이력으로 기록
    await run(`
      INSERT INTO plan_histories (plan_id, version, title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, nextVersion, title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes), change_reason || `계획 수정 (버전 ${nextVersion})`]);

    const updated = await get('SELECT * FROM plans WHERE id = ?', [id]);
    const histories = await all('SELECT * FROM plan_histories WHERE plan_id = ? ORDER BY version ASC', [id]);

    res.json({ success: true, data: { ...updated, histories } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계획 삭제
router.delete('/plans/:id', async (req, res) => {
  try {
    await run('DELETE FROM plans WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '계획이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. 할 일 (Todo / Do) API - 카드 2 완벽 구현
// ==========================================

// 할 일 목록 조회 (검색: T06-C18, 거르기: T06-C19, 정렬: T06-C20)
router.get('/todos', async (req, res) => {
  try {
    const { plan_id, search, status, priority, tag, drilldown, sort_by } = req.query;

    let sql = `
      SELECT t.*, p.title as plan_title,
             r.id as reflection_id, r.variance_reason, r.time_variance, r.insight, r.action_item
      FROM todos t
      JOIN plans p ON t.plan_id = p.id
      LEFT JOIN reflections r ON t.id = r.todo_id
      WHERE 1=1
    `;
    const params = [];

    // 특정 계획 필터
    if (plan_id) {
      sql += ' AND t.plan_id = ?';
      params.push(plan_id);
    }

    // T06-C18: 할 일 검색 (내용, 태그, 소속 계획명 검색)
    if (search && search.trim() !== '') {
      sql += ' AND (t.content LIKE ? OR t.tag LIKE ? OR p.title LIKE ?)';
      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword, keyword);
    }

    // T06-C19: 상태 조건 거르기
    if (status && status !== 'ALL') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    // T06-C19: 우선순위 조건 거르기
    if (priority && priority !== 'ALL') {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    // T06-C19: 태그 조건 거르기
    if (tag && tag.trim() !== '') {
      sql += ' AND t.tag = ?';
      params.push(tag.trim());
    }

    // 드릴다운 전용 조건
    if (drilldown === 'delayed') {
      // 지연된 할 일
      sql += ` AND ((t.status = 'PENDING' AND t.due_date < date('now', 'localtime')) OR (t.status = 'COMPLETED' AND t.actual_minutes > t.estimated_minutes))`;
    } else if (drilldown === 'need_reflection') {
      // 회고 대기
      sql += ` AND t.status = 'COMPLETED' AND r.id IS NULL`;
    } else if (drilldown === 'completed') {
      sql += ` AND t.status = 'COMPLETED'`;
    }

    // T06-C20: 화면에 밝혀 둔 기준대로 할 일 정렬
    // 기본 정렬: 1) 마감일 빠른 순 -> 2) 우선순위 높은 순 (HIGH > MEDIUM > LOW) -> 3) ID 순
    const priorityWeight = `CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END`;

    if (sort_by === 'priority') {
      sql += ` ORDER BY ${priorityWeight} ASC, t.due_date ASC, t.id ASC`;
    } else if (sort_by === 'estimated_minutes') {
      sql += ` ORDER BY t.estimated_minutes DESC, t.id ASC`;
    } else if (sort_by === 'created_desc') {
      sql += ` ORDER BY t.id DESC`;
    } else {
      // 기본 정렬 (default): 마감일 순 -> 우선순위 순 -> ID 순
      sql += ` ORDER BY t.due_date ASC, ${priorityWeight} ASC, t.id ASC`;
    }

    const todos = await all(sql, params);
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 생성 (T06-C09, C14, C15, C16, C17)
router.post('/todos', async (req, res) => {
  const { plan_id, content, due_date, priority, tag, estimated_minutes } = req.body;
  if (!plan_id || !content || !due_date || !priority || !tag || estimated_minutes === undefined) {
    return res.status(400).json({ success: false, message: '할 일 필수 정보(계획, 내용, 마감일, 우선순위, 태그, 예상시간)를 모두 입력해주세요.' });
  }

  try {
    const result = await run(`
      INSERT INTO todos (plan_id, content, due_date, priority, tag, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [plan_id, content, due_date, priority, tag, Number(estimated_minutes)]);

    const created = await get('SELECT * FROM todos WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 내용/정보 수정 (T06-C10)
router.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { content, due_date, priority, tag, estimated_minutes, actual_minutes } = req.body;

  try {
    await run(`
      UPDATE todos
      SET content = ?, due_date = ?, priority = ?, tag = ?, estimated_minutes = ?, actual_minutes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [content, due_date, priority, tag, Number(estimated_minutes), Number(actual_minutes || 0), id]);

    const updated = await get('SELECT * FROM todos WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 완료 (T06-C11) 및 진행 중 되돌리기 (T06-C12)
router.patch('/todos/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, actual_minutes } = req.body; // 'COMPLETED' or 'PENDING'

  try {
    const completedAt = status === 'COMPLETED' ? "datetime('now', 'localtime')" : null;
    
    if (status === 'COMPLETED') {
      await run(`
        UPDATE todos 
        SET status = 'COMPLETED', actual_minutes = ?, completed_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [Number(actual_minutes || 0), id]);
    } else {
      await run(`
        UPDATE todos 
        SET status = 'PENDING', completed_at = NULL, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [id]);
    }

    const updated = await get('SELECT * FROM todos WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 할 일 삭제 (T06-C13)
router.delete('/todos/:id', async (req, res) => {
  try {
    await run('DELETE FROM todos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '할 일이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. 돌아보기 (Reflection / See) API
// ==========================================

// 회고 목록 조회
router.get('/reflections', async (req, res) => {
  try {
    const reflections = await all(`
      SELECT r.*, t.content as todo_content, t.estimated_minutes, t.actual_minutes, p.title as plan_title
      FROM reflections r
      JOIN plans p ON r.plan_id = p.id
      LEFT JOIN todos t ON r.todo_id = t.id
      ORDER BY r.id DESC
    `);
    res.json({ success: true, data: reflections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 회고 작성
router.post('/reflections', async (req, res) => {
  const { plan_id, todo_id, variance_reason, time_variance, insight, action_item } = req.body;
  if (!plan_id || !variance_reason || !insight || !action_item) {
    return res.status(400).json({ success: false, message: '회고 필수 항목(오차 원인, 인사이트, 액션 아이템)을 입력해주세요.' });
  }

  try {
    const result = await run(`
      INSERT INTO reflections (plan_id, todo_id, variance_reason, time_variance, insight, action_item)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [plan_id, todo_id || null, variance_reason, Number(time_variance || 0), insight, action_item]);

    const created = await get('SELECT * FROM reflections WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
