/**
 * 플랜두씨(Plan-Do-See) REST API 클라이언트 모듈 (카드 1~5 통합)
 * 백엔드 서버 + GitHub Pages 오프라인 스마트 하이브리드 지원
 */

const INITIAL_DATA = {
  plans: [
    {
      id: 1,
      title: '플랜두씨 다이어리 1 완주 및 배포',
      category: '공부',
      start_date: '2026-10-12',
      end_date: '2026-10-22',
      priority: 'HIGH',
      success_criteria: '과제 6 완주 체크리스트 및 카드 1~5 전체 통과 기준 만족',
      estimated_minutes: 600,
      status: 'IN_PROGRESS',
      todo_count: 5,
      completed_todo_count: 3,
      history_count: 2,
      histories: [
        {
          id: 1,
          plan_id: 1,
          version: 1,
          title: '플랜두씨 다이어리 1 완주 및 배포',
          category: '공부',
          start_date: '2026-10-12',
          end_date: '2026-10-18',
          priority: 'HIGH',
          success_criteria: '과제 6 완주 체크리스트 5개 항목 모두 만족 및 DB 영속화 검증',
          estimated_minutes: 480,
          change_reason: '최초 계획 등록',
          created_at: '2026-10-12 15:30:00'
        },
        {
          id: 2,
          plan_id: 1,
          version: 2,
          title: '플랜두씨 다이어리 1 완주 및 배포',
          category: '공부',
          start_date: '2026-10-12',
          end_date: '2026-10-22',
          priority: 'HIGH',
          success_criteria: '과제 6 완주 체크리스트 및 카드 1~5 전체 통과 기준 만족',
          estimated_minutes: 600,
          change_reason: '보안 점검 및 집계 드릴다운 UX 고도화를 위한 마감일 4일 연장',
          created_at: '2026-10-12 15:35:00'
        }
      ]
    }
  ],
  todos: [
    {
      id: 1,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: '과제 6 요구사항 및 카드 1, 2, 3 체크리스트 분석',
      due_date: '2026-10-13',
      priority: 'HIGH',
      tag: '#기획',
      estimated_minutes: 60,
      status: 'COMPLETED',
      execution_id: 1,
      started_at: '2026-10-12 14:00',
      ended_at: '2026-10-12 15:20',
      actual_minutes: 80,
      blocked_reason: '요구사항 세부 항목 정리에 20분이 더 소요됨',
      reflection_id: 1,
      variance_reason: '소요시간 과소평가',
      insight: '세부 통과 기준 번호들을 하나씩 대조하느라 시간이 초과되었다.',
      action_item: '다음 번엔 요구사항 템플릿을 사전 정리해두자.'
    },
    {
      id: 2,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: 'Node.js + SQLite 데이터베이스 스키마 및 executions 테이블 구축',
      due_date: '2026-10-14',
      priority: 'HIGH',
      tag: '#백엔드',
      estimated_minutes: 120,
      status: 'COMPLETED',
      execution_id: 2,
      started_at: '2026-10-12 15:30',
      ended_at: '2026-10-12 17:10',
      actual_minutes: 100,
      blocked_reason: '',
      reflection_id: null
    },
    {
      id: 3,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: 'Bento Grid 대시보드 및 집계 드릴다운 UI 연동',
      due_date: '2026-10-15',
      priority: 'HIGH',
      tag: '#프론트',
      estimated_minutes: 180,
      status: 'COMPLETED',
      execution_id: 3,
      started_at: '2026-10-12 17:30',
      ended_at: '2026-10-12 21:00',
      actual_minutes: 210,
      blocked_reason: '모달 폼 반응형 스타일링에서 시간이 지체됨',
      reflection_id: null
    },
    {
      id: 4,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: '마감일 및 우선순위 정렬 기준 화면 명시 및 필터링 테스트',
      due_date: '2026-10-11', // 미완료 + 서울기준 과거일 -> 지연 (T06-C30)
      priority: 'MEDIUM',
      tag: '#테스트',
      estimated_minutes: 90,
      status: 'PENDING',
      execution_id: null
    },
    {
      id: 5,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: 'XSS 방어 및 무로그인 배너 노출 최종 점검',
      due_date: '2026-10-17',
      priority: 'LOW',
      tag: '#보안',
      estimated_minutes: 45,
      status: 'PENDING',
      execution_id: null
    }
  ],
  executions: [
    {
      id: 1,
      todo_id: 1,
      started_at: '2026-10-12 14:00',
      ended_at: '2026-10-12 15:20',
      actual_minutes: 80,
      blocked_reason: '요구사항 세부 항목 정리에 20분이 더 소요됨'
    },
    {
      id: 2,
      todo_id: 2,
      started_at: '2026-10-12 15:30',
      ended_at: '2026-10-12 17:10',
      actual_minutes: 100,
      blocked_reason: ''
    },
    {
      id: 3,
      todo_id: 3,
      started_at: '2026-10-12 17:30',
      ended_at: '2026-10-12 21:00',
      actual_minutes: 210,
      blocked_reason: '모달 폼 반응형 스타일링에서 시간이 지체됨'
    }
  ],
  reflections: [
    {
      id: 1,
      plan_id: 1,
      todo_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      todo_content: '과제 6 요구사항 및 카드 1, 2, 3 체크리스트 분석',
      variance_reason: '소요시간 과소평가',
      time_variance: 20,
      insight: '세부 통과 기준 번호들을 하나씩 대조하느라 시간이 초과되었다.',
      action_item: '다음 번엔 요구사항 템플릿을 사전 정리해두자.',
      created_at: '2026-10-12 15:40:00'
    }
  ]
};

function getLocalDB() {
  const data = localStorage.getItem('plandosee_offline_db');
  if (!data) {
    localStorage.setItem('plandosee_offline_db', JSON.stringify(INITIAL_DATA));
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
  return JSON.parse(data);
}

function saveLocalDB(data) {
  localStorage.setItem('plandosee_offline_db', JSON.stringify(data));
}

const API = {
  baseUrl: (typeof window !== 'undefined' && window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api',
  isServerDown: false,
  currentUser: null,

  async safeFetch(url, options = {}, fallbackFn) {
    const opts = {
      ...options,
      credentials: 'include' // 세션 쿠키 필수 전송 (과제 7)
    };

    try {
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({}));

      // 인증/인가 거절 (과제 7 핵심: 401, 403)
      if (res.status === 401) {
        this.currentUser = null;
        return { success: false, status: 401, code: 'UNAUTHORIZED', message: data.message || '로그인이 필요합니다.' };
      }
      if (res.status === 403) {
        return { success: false, status: 403, code: 'FORBIDDEN', message: data.message || '접근 권한이 없습니다.' };
      }
      if (!res.ok) {
        return { success: false, status: res.status, message: data.message || ('HTTP 오류 ' + res.status) };
      }
      return data;
    } catch (err) {
      if (fallbackFn && (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))) {
        return fallbackFn();
      }
      return { success: false, message: '서버와 통신할 수 없습니다: ' + err.message };
    }
  },

  // ----------------------------------------------------
  // 과제 7: 인증 (Auth) API
  // ----------------------------------------------------
  async checkUsername(username) {
    return this.safeFetch(`${this.baseUrl}/auth/check-username?username=${encodeURIComponent(username)}`, {
      method: 'GET'
    });
  },

  async register(data) {
    return this.safeFetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async login(username, password) {
    return this.safeFetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    return this.safeFetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST'
    });
  },

  async getMe() {
    return this.safeFetch(`${this.baseUrl}/auth/me`, {
      method: 'GET'
    });
  },

  async deleteAccount() {
    return this.safeFetch(`${this.baseUrl}/auth/account`, {
      method: 'DELETE'
    });
  },

  // 1. 대시보드 및 돌아보기 통계 집계 (T06-C28 ~ C32)
  async getSummary() {
    return this.safeFetch(`${this.baseUrl}/summary`, {}, () => {
      const db = getLocalDB();
      const todayStr = new Date().toISOString().split('T')[0];

      const totalPlans = db.plans.length;
      const completedPlans = db.plans.filter(p => p.status === 'COMPLETED').length;

      // T06-C28: 계획에 딸린 지우지 않은 할 일 수
      const totalTodos = db.todos.length;

      // T06-C29: 지금 완료 상태인 할 일 수
      const completedTodos = db.todos.filter(t => t.status === 'COMPLETED').length;

      // T06-C30: 지연 수 = 완료되지 않았고 마감일이 서울 기준 오늘보다 앞선 할 일 수 (완료된 것은 배제)
      const delayedCount = db.todos.filter(t => t.status !== 'COMPLETED' && t.due_date < todayStr).length;

      // T06-C31: 막힘 수 = 막힌 이유가 하나라도 적힌 할 일 수
      const blockedCount = db.todos.filter(t => t.blocked_reason && t.blocked_reason.trim() !== '').length;

      // T06-C32: 예상시간합계, 실제시간합계, 차이
      const totalEstimatedMinutes = db.todos.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
      const totalActualMinutes = db.todos.reduce((acc, t) => acc + (t.actual_minutes || 0), 0);
      const timeVariance = totalActualMinutes - totalEstimatedMinutes;

      const needReflectionCount = db.todos.filter(t => t.status === 'COMPLETED' && !t.reflection_id).length;

      return {
        success: true,
        data: {
          totalPlans,
          completedPlans,
          totalTodos,
          completedTodos,
          completionRate: totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0,
          delayedCount,
          blockedCount,
          totalEstimatedMinutes,
          totalActualMinutes,
          timeVariance,
          needReflectionCount,
          varianceStats: [{ variance_reason: '소요시간 과소평가', count: 1 }]
        }
      };
    });
  },

  // 2. 전체 데이터 JSON 파일 내보내기 (T06-C36)
  async exportData() {
    if (this.isServerDown || (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))) {
      const db = getLocalDB();
      const backup = {
        app: 'Plan-Do-See Diary',
        version: '2.0.0',
        exported_at: new Date().toISOString(),
        timezone: 'Asia/Seoul',
        data: db
      };
      this.downloadJsonFile(backup, `plan-do-see-backup-${Date.now()}.json`);
      return { success: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/export`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan-do-see-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { success: true };
    } catch (e) {
      const db = getLocalDB();
      this.downloadJsonFile(db, `plan-do-see-backup-${Date.now()}.json`);
      return { success: true };
    }
  },

  downloadJsonFile(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // 3. 계획 CRUD
  async getPlans() {
    return this.safeFetch(`${this.baseUrl}/plans`, {}, () => {
      const db = getLocalDB();
      return { success: true, data: db.plans };
    });
  },

  async getPlan(id) {
    return this.safeFetch(`${this.baseUrl}/plans/${id}`, {}, () => {
      const db = getLocalDB();
      const plan = db.plans.find(p => p.id === Number(id));
      if (!plan) return { success: false, message: '계획 없음' };
      return {
        success: true,
        data: {
          ...plan,
          histories: plan.histories || [],
          todos: db.todos.filter(t => t.plan_id === Number(id))
        }
      };
    });
  },

  async createPlan(planData) {
    return this.safeFetch(`${this.baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData)
    }, () => {
      const db = getLocalDB();
      const newId = db.plans.length > 0 ? Math.max(...db.plans.map(p => p.id)) + 1 : 1;
      const newPlan = {
        ...planData,
        id: newId,
        status: 'IN_PROGRESS',
        todo_count: 0,
        completed_todo_count: 0,
        history_count: 1,
        histories: [
          {
            id: 1,
            plan_id: newId,
            version: 1,
            ...planData,
            change_reason: '최초 계획 등록',
            created_at: new Date().toLocaleString()
          }
        ]
      };
      db.plans.unshift(newPlan);
      saveLocalDB(db);
      return { success: true, data: newPlan };
    });
  },

  async updatePlan(id, planData) {
    return this.safeFetch(`${this.baseUrl}/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData)
    }, () => {
      const db = getLocalDB();
      const plan = db.plans.find(p => p.id === Number(id));
      if (!plan) return { success: false, message: '계획 없음' };

      plan.histories = plan.histories || [];
      const nextVersion = plan.histories.length + 1;
      plan.histories.push({
        id: Date.now(),
        plan_id: Number(id),
        version: nextVersion,
        ...planData,
        change_reason: planData.change_reason || `계획 수정 (버전 ${nextVersion})`,
        created_at: new Date().toLocaleString()
      });

      Object.assign(plan, planData);
      plan.history_count = plan.histories.length;
      saveLocalDB(db);
      return { success: true, data: plan };
    });
  },

  async deletePlan(id) {
    return this.safeFetch(`${this.baseUrl}/plans/${id}`, {
      method: 'DELETE'
    }, () => {
      const db = getLocalDB();
      db.plans = db.plans.filter(p => p.id !== Number(id));
      db.todos = db.todos.filter(t => t.plan_id !== Number(id));
      saveLocalDB(db);
      return { success: true, message: '삭제 완료' };
    });
  },

  // 4. 할 일 CRUD & 실행 기록 (카드 3 T06-C21~C27)
  async getTodos(filters = {}) {
    const query = new URLSearchParams();
    if (filters.plan_id) query.append('plan_id', filters.plan_id);
    if (filters.search) query.append('search', filters.search);
    if (filters.status) query.append('status', filters.status);
    if (filters.priority) query.append('priority', filters.priority);
    if (filters.tag) query.append('tag', filters.tag);
    if (filters.drilldown) query.append('drilldown', filters.drilldown);
    if (filters.sort_by) query.append('sort_by', filters.sort_by);

    return this.safeFetch(`${this.baseUrl}/todos?${query.toString()}`, {}, () => {
      const db = getLocalDB();
      let list = [...db.todos];
      const todayStr = new Date().toISOString().split('T')[0];

      if (filters.plan_id) {
        list = list.filter(t => t.plan_id === Number(filters.plan_id));
      }
      if (filters.search) {
        const kw = filters.search.toLowerCase();
        list = list.filter(t => t.content.toLowerCase().includes(kw) || t.tag.toLowerCase().includes(kw));
      }
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter(t => t.status === filters.status);
      }
      if (filters.priority && filters.priority !== 'ALL') {
        list = list.filter(t => t.priority === filters.priority);
      }
      if (filters.drilldown === 'completed') {
        list = list.filter(t => t.status === 'COMPLETED');
      } else if (filters.drilldown === 'delayed') {
        // T06-C30: 미완료 + 오늘 이전 마감
        list = list.filter(t => t.status !== 'COMPLETED' && t.due_date < todayStr);
      } else if (filters.drilldown === 'blocked') {
        // T06-C31: 막힌 이유 존재
        list = list.filter(t => t.blocked_reason && t.blocked_reason.trim() !== '');
      } else if (filters.drilldown === 'need_reflection') {
        list = list.filter(t => t.status === 'COMPLETED' && !t.reflection_id);
      }

      const pWeight = { HIGH: 1, MEDIUM: 2, LOW: 3 };
      if (filters.sort_by === 'priority') {
        list.sort((a, b) => (pWeight[a.priority] || 4) - (pWeight[b.priority] || 4) || a.due_date.localeCompare(b.due_date));
      } else if (filters.sort_by === 'estimated_minutes') {
        list.sort((a, b) => b.estimated_minutes - a.estimated_minutes);
      } else if (filters.sort_by === 'created_desc') {
        list.sort((a, b) => b.id - a.id);
      } else {
        list.sort((a, b) => a.due_date.localeCompare(b.due_date) || (pWeight[a.priority] || 4) - (pWeight[b.priority] || 4));
      }

      return { success: true, data: list };
    });
  },

  async createTodo(todoData) {
    return this.safeFetch(`${this.baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData)
    }, () => {
      const db = getLocalDB();
      const newId = db.todos.length > 0 ? Math.max(...db.todos.map(t => t.id)) + 1 : 1;
      const plan = db.plans.find(p => p.id === todoData.plan_id);
      const newTodo = {
        ...todoData,
        id: newId,
        status: 'PENDING',
        execution_id: null,
        actual_minutes: 0,
        plan_title: plan ? plan.title : ''
      };
      db.todos.push(newTodo);
      if (plan) plan.todo_count = (plan.todo_count || 0) + 1;
      saveLocalDB(db);
      return { success: true, data: newTodo };
    });
  },

  async updateTodo(id, todoData) {
    return this.safeFetch(`${this.baseUrl}/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData)
    }, () => {
      const db = getLocalDB();
      const todo = db.todos.find(t => t.id === Number(id));
      if (!todo) return { success: false, message: '할 일 없음' };
      Object.assign(todo, todoData);
      saveLocalDB(db);
      return { success: true, data: todo };
    });
  },

  // 카드 3: 실행 기록 저장 및 완료 처리 (T06-C21 ~ C27)
  // T06-C21 연타 멱등 방어: 이미 완료되어 실행 기록이 있으면 중복 추가하지 않고 성공 반환
  async saveExecution(todoId, executionData) {
    return this.safeFetch(`${this.baseUrl}/todos/${todoId}/execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(executionData)
    }, () => {
      const db = getLocalDB();
      const todo = db.todos.find(t => t.id === Number(todoId));
      if (!todo) return { success: false, message: '할 일 없음' };

      // 이미 실행 기록이 있으면 중복 생성하지 않고 반환 (T06-C21 멱등성)
      if (todo.execution_id) {
        return { success: true, message: '이미 완료 처리된 기록입니다. (중복 방어)' };
      }

      const newExecId = db.executions && db.executions.length > 0 ? Math.max(...db.executions.map(e => e.id)) + 1 : 1;
      const newExec = {
        id: newExecId,
        todo_id: Number(todoId),
        started_at: executionData.started_at,
        ended_at: executionData.ended_at,
        actual_minutes: Number(executionData.actual_minutes),
        blocked_reason: executionData.blocked_reason || ''
      };

      db.executions = db.executions || [];
      db.executions.push(newExec);

      // 할 일 상태 완료로 변경 (원래 계획 estimated_minutes는 덮어쓰지 않음: T06-C27)
      todo.status = 'COMPLETED';
      todo.execution_id = newExecId;
      todo.started_at = executionData.started_at;
      todo.ended_at = executionData.ended_at;
      todo.actual_minutes = Number(executionData.actual_minutes);
      todo.blocked_reason = executionData.blocked_reason || '';

      const plan = db.plans.find(p => p.id === todo.plan_id);
      if (plan) {
        plan.completed_todo_count = db.todos.filter(t => t.plan_id === plan.id && t.status === 'COMPLETED').length;
      }

      saveLocalDB(db);
      return { success: true, data: newExec };
    });
  },

  async revertTodo(todoId) {
    return this.safeFetch(`${this.baseUrl}/todos/${todoId}/revert`, {
      method: 'POST'
    }, () => {
      const db = getLocalDB();
      const todo = db.todos.find(t => t.id === Number(todoId));
      if (!todo) return { success: false, message: '할 일 없음' };

      todo.status = 'PENDING';
      todo.execution_id = null;
      todo.actual_minutes = 0;
      todo.blocked_reason = '';
      todo.reflection_id = null;

      db.executions = (db.executions || []).filter(e => e.todo_id !== Number(todoId));
      db.reflections = (db.reflections || []).filter(r => r.todo_id !== Number(todoId));

      const plan = db.plans.find(p => p.id === todo.plan_id);
      if (plan) {
        plan.completed_todo_count = db.todos.filter(t => t.plan_id === plan.id && t.status === 'COMPLETED').length;
      }

      saveLocalDB(db);
      return { success: true, message: '진행 중으로 되돌렸습니다.' };
    });
  },

  async deleteTodo(id) {
    return this.safeFetch(`${this.baseUrl}/todos/${id}`, {
      method: 'DELETE'
    }, () => {
      const db = getLocalDB();
      db.todos = db.todos.filter(t => t.id !== Number(id));
      db.executions = (db.executions || []).filter(e => e.todo_id !== Number(id));
      saveLocalDB(db);
      return { success: true, message: '삭제 완료' };
    });
  },

  // 5. 돌아보기 회고 CRUD (카드 4)
  async getReflections() {
    return this.safeFetch(`${this.baseUrl}/reflections`, {}, () => {
      const db = getLocalDB();
      return { success: true, data: db.reflections || [] };
    });
  },

  async createReflection(reflectionData) {
    return this.safeFetch(`${this.baseUrl}/reflections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reflectionData)
    }, () => {
      const db = getLocalDB();
      const newId = (db.reflections && db.reflections.length > 0) ? Math.max(...db.reflections.map(r => r.id)) + 1 : 1;
      const plan = db.plans.find(p => p.id === reflectionData.plan_id);
      const todo = db.todos.find(t => t.id === reflectionData.todo_id);
      const newRef = {
        ...reflectionData,
        id: newId,
        plan_title: plan ? plan.title : '',
        todo_content: todo ? todo.content : '',
        created_at: new Date().toLocaleString()
      };
      if (todo) {
        todo.reflection_id = newId;
        todo.variance_reason = reflectionData.variance_reason;
        todo.insight = reflectionData.insight;
        todo.action_item = reflectionData.action_item;
      }
      db.reflections = db.reflections || [];
      db.reflections.unshift(newRef);
      saveLocalDB(db);
      return { success: true, data: newRef };
    });
  }
};
