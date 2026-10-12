/**
 * 플랜두씨(Plan-Do-See) REST API 클라이언트 모듈
 * (백엔드 서버 연동 + GitHub Pages 정적 배포 시 자동 LocalStorage 하이브리드 지원)
 */

// 초기 데모/실제 데이터 (카드 1, 카드 2 검증 기준)
const INITIAL_DATA = {
  plans: [
    {
      id: 1,
      title: '플랜두씨 다이어리 1 완주 및 배포',
      category: '공부',
      start_date: '2026-10-12',
      end_date: '2026-10-22',
      priority: 'HIGH',
      success_criteria: '과제 6 완주 체크리스트 5개 항목 모두 만족 및 DB 영속화 검증',
      estimated_minutes: 600,
      status: 'IN_PROGRESS',
      todo_count: 5,
      completed_todo_count: 1,
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
          success_criteria: '과제 6 완주 체크리스트 5개 항목 모두 만족 및 DB 영속화 검증',
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
      content: '과제 6 요구사항 및 카드 1, 2 체크리스트 분석',
      due_date: '2026-10-13',
      priority: 'HIGH',
      tag: '#기획',
      estimated_minutes: 60,
      actual_minutes: 80,
      status: 'COMPLETED',
      reflection_id: 1,
      variance_reason: '소요시간 과소평가',
      insight: 'SQLite 테이블 연관관계 및 외래키 캐스케이드 규칙을 검토하느라 20분이 더 걸렸다.'
    },
    {
      id: 2,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: 'Node.js + SQLite 데이터베이스 스키마 및 REST API 구축',
      due_date: '2026-10-14',
      priority: 'HIGH',
      tag: '#백엔드',
      estimated_minutes: 120,
      actual_minutes: 0,
      status: 'PENDING'
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
      actual_minutes: 0,
      status: 'PENDING'
    },
    {
      id: 4,
      plan_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      content: '마감일 및 우선순위 정렬 기준 화면 명시 및 필터링 테스트',
      due_date: '2026-10-11',
      priority: 'MEDIUM',
      tag: '#테스트',
      estimated_minutes: 90,
      actual_minutes: 0,
      status: 'PENDING'
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
      actual_minutes: 0,
      status: 'PENDING'
    }
  ],
  reflections: [
    {
      id: 1,
      plan_id: 1,
      todo_id: 1,
      plan_title: '플랜두씨 다이어리 1 완주 및 배포',
      todo_content: '과제 6 요구사항 및 카드 1, 2 체크리스트 분석',
      variance_reason: '소요시간 과소평가',
      time_variance: 20,
      insight: 'SQLite 테이블 연관관계 및 외래키 캐스케이드 규칙을 검토하느라 20분이 더 걸렸다.',
      action_item: '다음 번엔 DB 초기화 스크립트 템플릿을 사전 준비해두자.',
      created_at: '2026-10-12 15:40:00'
    }
  ]
};

// 로컬 스토리지 헬퍼
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

  // 서버 fetch 시도 후 실패 시 LocalStorage 모드로 전환하는 스마트 래퍼
  async safeFetch(url, options = {}, fallbackFn) {
    if (this.isServerDown || (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))) {
      return fallbackFn();
    }
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('HTTP Error ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('⚠️ 서버 API 연결 불가(GitHub Pages 등 정적 호스팅 감지). 오프라인/로컬 모드로 전환합니다.');
      this.isServerDown = true;
      return fallbackFn();
    }
  },

  // 1. 대시보드 통계 및 드릴다운 요약
  async getSummary() {
    return this.safeFetch(`${this.baseUrl}/summary`, {}, () => {
      const db = getLocalDB();
      const todayStr = new Date().toISOString().split('T')[0];
      const totalPlans = db.plans.length;
      const completedPlans = db.plans.filter(p => p.status === 'COMPLETED').length;
      const totalTodos = db.todos.length;
      const completedTodos = db.todos.filter(t => t.status === 'COMPLETED').length;
      const delayedCount = db.todos.filter(t => 
        (t.status === 'PENDING' && t.due_date < todayStr) || 
        (t.status === 'COMPLETED' && t.actual_minutes > t.estimated_minutes)
      ).length;
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
          needReflectionCount,
          varianceStats: [{ variance_reason: '소요시간 과소평가', count: 1 }]
        }
      };
    });
  },

  // 2. 계획 (Plan) CRUD
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
      if (!plan) return { success: false, message: '계획을 찾을 수 없습니다.' };
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
      return { success: true, message: '계획 삭제 완료' };
    });
  },

  // 3. 할 일 (Todo / Do) CRUD & 필터/검색/정렬
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
      if (filters.drilldown === 'delayed') {
        list = list.filter(t => (t.status === 'PENDING' && t.due_date < todayStr) || (t.status === 'COMPLETED' && t.actual_minutes > t.estimated_minutes));
      } else if (filters.drilldown === 'need_reflection') {
        list = list.filter(t => t.status === 'COMPLETED' && !t.reflection_id);
      }

      // 정렬
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

  async updateTodoStatus(id, status, actualMinutes = 0) {
    return this.safeFetch(`${this.baseUrl}/todos/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actual_minutes: actualMinutes })
    }, () => {
      const db = getLocalDB();
      const todo = db.todos.find(t => t.id === Number(id));
      if (!todo) return { success: false, message: '할 일 없음' };
      todo.status = status;
      todo.actual_minutes = Number(actualMinutes || 0);
      const plan = db.plans.find(p => p.id === todo.plan_id);
      if (plan) {
        plan.completed_todo_count = db.todos.filter(t => t.plan_id === plan.id && t.status === 'COMPLETED').length;
      }
      saveLocalDB(db);
      return { success: true, data: todo };
    });
  },

  async deleteTodo(id) {
    return this.safeFetch(`${this.baseUrl}/todos/${id}`, {
      method: 'DELETE'
    }, () => {
      const db = getLocalDB();
      db.todos = db.todos.filter(t => t.id !== Number(id));
      saveLocalDB(db);
      return { success: true, message: '삭제 완료' };
    });
  },

  // 4. 돌아보기 (Reflection / See)
  async getReflections() {
    return this.safeFetch(`${this.baseUrl}/reflections`, {}, () => {
      const db = getLocalDB();
      return { success: true, data: db.reflections };
    });
  },

  async createReflection(reflectionData) {
    return this.safeFetch(`${this.baseUrl}/reflections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reflectionData)
    }, () => {
      const db = getLocalDB();
      const newId = db.reflections.length > 0 ? Math.max(...db.reflections.map(r => r.id)) + 1 : 1;
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
      }
      db.reflections.unshift(newRef);
      saveLocalDB(db);
      return { success: true, data: newRef };
    });
  }
};
