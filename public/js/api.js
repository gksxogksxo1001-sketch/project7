/**
 * 플랜두씨(Plan-Do-See) REST API 클라이언트 모듈
 */
const API = {
  baseUrl: (typeof window !== 'undefined' && window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api',

  // 1. 대시보드 통계 및 드릴다운 요약
  async getSummary() {
    const res = await fetch(`${this.baseUrl}/summary`);
    return await res.json();
  },

  // 2. 계획 (Plan) CRUD
  async getPlans() {
    const res = await fetch(`${this.baseUrl}/plans`);
    return await res.json();
  },

  async getPlan(id) {
    const res = await fetch(`${this.baseUrl}/plans/${id}`);
    return await res.json();
  },

  async createPlan(planData) {
    const res = await fetch(`${this.baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData)
    });
    return await res.json();
  },

  async updatePlan(id, planData) {
    const res = await fetch(`${this.baseUrl}/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData)
    });
    return await res.json();
  },

  async deletePlan(id) {
    const res = await fetch(`${this.baseUrl}/plans/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
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

    const res = await fetch(`${this.baseUrl}/todos?${query.toString()}`);
    return await res.json();
  },

  async createTodo(todoData) {
    const res = await fetch(`${this.baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData)
    });
    return await res.json();
  },

  async updateTodo(id, todoData) {
    const res = await fetch(`${this.baseUrl}/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData)
    });
    return await res.json();
  },

  async updateTodoStatus(id, status, actualMinutes = 0) {
    const res = await fetch(`${this.baseUrl}/todos/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actual_minutes: actualMinutes })
    });
    return await res.json();
  },

  async deleteTodo(id) {
    const res = await fetch(`${this.baseUrl}/todos/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // 4. 돌아보기 (Reflection / See)
  async getReflections() {
    const res = await fetch(`${this.baseUrl}/reflections`);
    return await res.json();
  },

  async createReflection(reflectionData) {
    const res = await fetch(`${this.baseUrl}/reflections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reflectionData)
    });
    return await res.json();
  }
};
