const express = require('express');
const router = express.Router();
const { run, get, all } = require('./db');

// ==========================================
// 1. 대시보드 및 돌아보기 집계 통계 (카드 4 T06-C28 ~ C32)
// ==========================================
router.get('/summary', async (req, res) => {
  try {
    const totalPlansRow = await get('SELECT COUNT(*) as count FROM plans');
    const completedPlansRow = await get("SELECT COUNT(*) as count FROM plans WHERE status = 'COMPLETED'");
    
    // T06-C28: 돌아보기의 계획 수 = 지우지 않은 할 일 수
    const totalTodosRow = await get('SELECT COUNT(*) as count FROM todos');
    
    // T06-C29: 돌아보기의 완료 수 = 지금 완료 상태인 할 일 수
    const completedTodosRow = await get("SELECT COUNT(*) as count FROM todos WHERE status = 'COMPLETED'");
    
    // T06-C30: 돌아보기의 지연 수 = 완료되지 않았고 마감일이 서울 기준 오늘보다 앞선 할 일 수 (완료된 할 일을 두 번 세지 않음)
    const delayedTodosRow = await get(`
      SELECT COUNT(*) as count FROM todos 
      WHERE status != 'COMPLETED' AND due_date < date('now', 'localtime')
    `);

    // T06-C31: 돌아보기의 막힘 수 = 막힌 이유가 하나라도 적힌 할 일 수
    const blockedTodosRow = await get(`
      SELECT COUNT(DISTINCT t.id) as count 
      FROM todos t
      JOIN executions e ON t.id = e.todo_id
      WHERE e.blocked_reason IS NOT NULL AND TRIM(e.blocked_reason) != ''
    `);

    // T06-C32: 예상 시간 합계, 실제 시간 합계, 차이 계산 (아무것도 없으면 0)
    const timeStatsRow = await get(`
      SELECT 
        COALESCE(SUM(t.estimated_minutes), 0) as total_estimated,
        COALESCE(SUM(e.actual_minutes), 0) as total_actual
      FROM todos t
      LEFT JOIN executions e ON t.id = e.todo_id
    `);

    const totalEstimated = timeStatsRow.total_estimated || 0;
    const totalActual = timeStatsRow.total_actual || 0;
    const timeVariance = totalActual - totalEstimated; // 실제 - 예상

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
// 2. 전체 데이터 JSON 파일 내보내기 (카드 5 T06-C36)
// ==========================================
router.get('/export', async (req, res) => {
  try {
    const plans = await all('SELECT * FROM plans ORDER BY id ASC');
    const planHistories = await all('SELECT * FROM plan_histories ORDER BY id ASC');
    const todos = await all('SELECT * FROM todos ORDER BY id ASC');
    const executions = await all('SELECT * FROM executions ORDER BY id ASC');
    const reflections = await all('SELECT * FROM reflections ORDER BY id ASC');

    const backupData = {
      app: 'Plan-Do-See Diary',
      version: '2.0.0',
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
    res.setHeader('Content-Disposition', `attachment; filename=plan-do-see-backup-${Date.now()}.json`);
    res.json(backupData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. 계획 (Plan) API (카드 1)
// ==========================================
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

router.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, start_date, end_date, priority, success_criteria, estimated_minutes, change_reason } = req.body;

  try {
    const current = await get('SELECT * FROM plans WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ success: false, message: '수정할 계획을 찾을 수 없습니다.' });

    const lastHistory = await get('SELECT MAX(version) as max_version FROM plan_histories WHERE plan_id = ?', [id]);
    const nextVersion = (lastHistory && lastHistory.max_version ? lastHistory.max_version : 1) + 1;

    await run(`
      UPDATE plans 
      SET title = ?, category = ?, start_date = ?, end_date = ?, priority = ?, success_criteria = ?, estimated_minutes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [title, category, start_date, end_date, priority, success_criteria, Number(estimated_minutes), id]);

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

router.delete('/plans/:id', async (req, res) => {
  try {
    await run('DELETE FROM plans WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '계획이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. 할 일 (Todo) 및 실행 기록 (Executions) API (카드 2, 카드 3)
// ==========================================
router.get('/todos', async (req, res) => {
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
      WHERE 1=1
    `;
    const params = [];

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
      // T06-C30: 완료되지 않았고 마감일이 오늘보다 앞선 항목 (완료된 것은 배제!)
      sql += ` AND t.status != 'COMPLETED' AND t.due_date < date('now', 'localtime')`;
    } else if (drilldown === 'blocked') {
      // T06-C31: 막혔던 이유가 있는 항목
      sql += ` AND e.blocked_reason IS NOT NULL AND TRIM(e.blocked_reason) != ''`;
    } else if (drilldown === 'need_reflection') {
      sql += ` AND t.status = 'COMPLETED' AND r.id IS NULL`;
    }

    // T06-C20 화면에 밝혀 둔 기준대로 정렬
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

router.post('/todos', async (req, res) => {
  const { plan_id, content, due_date, priority, tag, estimated_minutes } = req.body;
  if (!plan_id || !content || !due_date || !priority || !tag || estimated_minutes === undefined) {
    return res.status(400).json({ success: false, message: '할 일 필수 정보를 모두 입력해주세요.' });
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

router.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { content, due_date, priority, tag, estimated_minutes } = req.body;

  try {
    await run(`
      UPDATE todos
      SET content = ?, due_date = ?, priority = ?, tag = ?, estimated_minutes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [content, due_date, priority, tag, Number(estimated_minutes), id]);

    const updated = await get('SELECT * FROM todos WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 카드 3: 실행 기록 저장 및 완료 처리 (T06-C21 ~ C27)
// T06-C21 연달아 두 번 눌러도 완료 기록 1건만 유지 (멱등성 방어)
// T06-C27 실행 기록을 저장해도 원래 계획 값(todos.estimated_minutes 등)은 덮어쓰이지 않음
router.post('/todos/:id/execution', async (req, res) => {
  const todoId = req.params.id;
  const { started_at, ended_at, actual_minutes, blocked_reason } = req.body;

  if (!started_at || !ended_at || actual_minutes === undefined) {
    return res.status(400).json({ success: false, message: '시작 시각, 끝난 시각, 실제 걸린 시간은 필수입니다.' });
  }

  try {
    const todo = await get('SELECT * FROM todos WHERE id = ?', [todoId]);
    if (!todo) return res.status(404).json({ success: false, message: '할 일을 찾을 수 없습니다.' });

    // T06-C21: 이미 실행 기록이 있는지 확인
    const existingExecution = await get('SELECT * FROM executions WHERE todo_id = ?', [todoId]);
    
    if (existingExecution) {
      // 이미 완료 처리되어 실행 기록이 있으므로 중복 등록하지 않고 기존 데이터 반환
      return res.json({ 
        success: true, 
        message: '이미 완료 처리된 기록입니다. (중복 방어 완료)', 
        data: existingExecution 
      });
    }

    // 1. 실행 기록 등록 (T06-C23 시작시각, T06-C24 끝난시각, T06-C25 실제시간, T06-C26 막힌이유)
    await run(`
      INSERT INTO executions (todo_id, started_at, ended_at, actual_minutes, blocked_reason)
      VALUES (?, ?, ?, ?, ?)
    `, [todoId, started_at, ended_at, Number(actual_minutes), blocked_reason || null]);

    // 2. 상태를 완료로 변경 (원래 할 일의 estimated_minutes 등은 전혀 덮어쓰지 않음: T06-C27)
    await run(`
      UPDATE todos 
      SET status = 'COMPLETED', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [todoId]);

    const createdExecution = await get('SELECT * FROM executions WHERE todo_id = ?', [todoId]);
    res.status(201).json({ success: true, data: createdExecution });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 완료된 할 일 다시 진행 중으로 되돌리기
router.post('/todos/:id/revert', async (req, res) => {
  const todoId = req.params.id;
  try {
    await run('DELETE FROM executions WHERE todo_id = ?', [todoId]);
    await run('DELETE FROM reflections WHERE todo_id = ?', [todoId]);
    await run(`UPDATE todos SET status = 'PENDING', updated_at = datetime('now', 'localtime') WHERE id = ?`, [todoId]);
    res.json({ success: true, message: '진행 중으로 되돌렸습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/todos/:id', async (req, res) => {
  try {
    await run('DELETE FROM todos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '할 일이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. 돌아보기 (Reflection / See) API (카드 4)
// ==========================================
router.get('/reflections', async (req, res) => {
  try {
    const reflections = await all(`
      SELECT r.*, t.content as todo_content, t.estimated_minutes, e.actual_minutes, e.blocked_reason, p.title as plan_title
      FROM reflections r
      JOIN plans p ON r.plan_id = p.id
      LEFT JOIN todos t ON r.todo_id = t.id
      LEFT JOIN executions e ON t.id = e.todo_id
      ORDER BY r.id DESC
    `);
    res.json({ success: true, data: reflections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reflections', async (req, res) => {
  const { plan_id, todo_id, variance_reason, time_variance, insight, action_item } = req.body;
  if (!plan_id || !variance_reason || !insight || !action_item) {
    return res.status(400).json({ success: false, message: '회고 필수 항목을 모두 입력해주세요.' });
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
