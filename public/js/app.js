/**
 * 플랜두씨(Plan-Do-See) 메인 프론트엔드 컨트롤러
 */

const App = {
  // 상태
  currentTab: 'plans',
  activeDrilldown: null, // 'delayed', 'need_reflection', null
  plans: [],
  todos: [],
  reflections: [],
  summary: null,

  filters: {
    search: '',
    plan_id: '',
    status: 'ALL',
    priority: 'ALL',
    tag: '',
    sort_by: 'default'
  },

  // 1. 초기화
  async init() {
    console.log('🚀 플랜두씨 다이어리 프론트엔드 초기화 시작');
    await this.loadAll();
    this.setupDatePickers();
  },

  // 기본 날짜를 오늘로 설정
  setupDatePickers() {
    const today = new Date().toISOString().split('T')[0];
    const planStartDate = document.getElementById('plan-start-date');
    const planEndDate = document.getElementById('plan-end-date');
    const todoDueDate = document.getElementById('todo-due-date');
    if (planStartDate) planStartDate.value = today;
    if (planEndDate) planEndDate.value = today;
    if (todoDueDate) todoDueDate.value = today;
  },

  // 전체 데이터 로드
  async loadAll() {
    await Promise.all([
      this.loadSummary(),
      this.loadPlans(),
      this.loadTodos(),
      this.loadReflections()
    ]);
  },

  // ============================================================
  // 대시보드 통계 & 드릴다운
  // ============================================================
  async loadSummary() {
    try {
      const res = await API.getSummary();
      if (res.success) {
        this.summary = res.data;
        this.renderSummary();
      }
    } catch (err) {
      console.error('요약 데이터 로드 실패:', err);
    }
  },

  renderSummary() {
    if (!this.summary) return;
    const s = this.summary;
    document.getElementById('val-total-plans').innerText = s.totalPlans;
    document.getElementById('val-completed-plans').innerText = `완료 ${s.completedPlans}건`;

    document.getElementById('val-completion-rate').innerText = `${s.completionRate}%`;
    document.getElementById('val-todos-ratio').innerText = `${s.completedTodos} / ${s.totalTodos}건 완료`;

    document.getElementById('val-delayed-todos').innerText = s.delayedCount;
    document.getElementById('val-need-reflection').innerText = s.needReflectionCount;

    // 대시보드 카드 활성화 표시 (드릴다운 상태와 연동)
    const delayedCard = document.getElementById('card-drill-delayed');
    const reflectionCard = document.getElementById('card-drill-reflection');
    if (delayedCard) delayedCard.classList.toggle('active-filter', this.activeDrilldown === 'delayed');
    if (reflectionCard) reflectionCard.classList.toggle('active-filter', this.activeDrilldown === 'need_reflection');
  },

  // 집계 숫자 드릴다운 클릭 이벤트
  applyDrilldown(type) {
    this.activeDrilldown = type;
    this.switchTab('todos');

    const alertBanner = document.getElementById('drilldown-active-alert');
    const alertText = document.getElementById('drilldown-alert-text');

    if (alertBanner) alertBanner.style.display = 'flex';
    if (alertText) {
      if (type === 'delayed') {
        alertText.innerHTML = `🔍 <strong>[지연 및 예상 초과]</strong> 집계 숫자 드릴다운 필터가 적용 중입니다.`;
      } else if (type === 'need_reflection') {
        alertText.innerHTML = `🔍 <strong>[회고 대기 중]</strong> 집계 숫자 드릴다운 필터가 적용 중입니다.`;
      }
    }

    this.renderSummary();
    this.loadTodos();
  },

  clearDrilldown() {
    this.activeDrilldown = null;
    const alertBanner = document.getElementById('drilldown-active-alert');
    if (alertBanner) alertBanner.style.display = 'none';
    this.renderSummary();
    this.loadTodos();
  },

  // ============================================================
  // 탭 네비게이션
  // ============================================================
  switchTab(tabName) {
    this.currentTab = tabName;
    ['plans', 'todos', 'reflections'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const panel = document.getElementById(`panel-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (panel) panel.classList.toggle('active', t === tabName);
    });
  },

  // ============================================================
  // 카드 1: 계획 (Plan) 세우기 및 수정 이력
  // ============================================================
  async loadPlans() {
    try {
      const res = await API.getPlans();
      if (res.success) {
        this.plans = res.data;
        this.renderPlans();
        this.updatePlanSelectOptions();
        document.getElementById('count-tab-plans').innerText = this.plans.length;
      }
    } catch (err) {
      console.error('계획 로드 실패:', err);
    }
  },

  renderPlans() {
    const container = document.getElementById('plans-container');
    if (!container) return;

    if (this.plans.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
          <h3 style="font-size: 1.1rem; color: #475569; margin-bottom: 8px;">등록된 계획이 아직 없습니다.</h3>
          <p style="font-size: 0.88rem; color: #94a3b8; margin-bottom: 16px;">지금 실제로 하고 있는 일 가운데 하나를 골라 계획으로 세워보세요!</p>
          <button class="btn btn-primary" onclick="App.openPlanModal()">+ 첫 계획 세우기</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.plans.map(p => {
      const todoCount = p.todo_count || 0;
      const completedCount = p.completed_todo_count || 0;
      const percent = todoCount > 0 ? Math.round((completedCount / todoCount) * 100) : 0;

      return `
        <article class="plan-card">
          <div>
            <div class="card-top">
              <div class="badges-wrapper">
                <span class="badge badge-category">${this.escapeHtml(p.category)}</span>
                <span class="badge badge-priority-${p.priority}">우선순위: ${p.priority}</span>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">#ID: ${p.id}</span>
            </div>

            <h3 class="card-heading">${this.escapeHtml(p.title)}</h3>

            <div class="card-meta-list">
              <div class="card-meta-item">
                <span>📅 기간 (T06-C04):</span>
                <strong>${p.start_date} ~ ${p.end_date}</strong>
              </div>
              <div class="card-meta-item">
                <span>⏱️ 예상 시간 (T06-C07):</span>
                <strong>${p.estimated_minutes}분 (${Math.round(p.estimated_minutes / 60 * 10) / 10}시간)</strong>
              </div>
              <div class="card-meta-item" style="flex-direction: column; gap: 2px; margin-top: 4px;">
                <span>🎯 성공 기준 (T06-C06):</span>
                <strong style="font-weight: 500; color: #334155; word-break: break-word;">${this.escapeHtml(p.success_criteria)}</strong>
              </div>
            </div>

            <!-- 할 일 진행 현황 바 -->
            <div style="margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted);">
                <span>딸린 할 일: ${completedCount}/${todoCount} 완료</span>
                <span>${percent}%</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          </div>

          <div class="card-footer">
            <div style="display: flex; gap: 6px;">
              <!-- T06-C08 보존 증거 확인 버튼 -->
              <button class="btn btn-secondary btn-sm" onclick="App.viewPlanHistory(${p.id})">📜 수정 이력 (${p.history_count || 1}건)</button>
              <button class="btn btn-secondary btn-sm" onclick="App.openEditPlanModal(${p.id})">✏️ 계획 수정</button>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-primary btn-sm" onclick="App.openAddTodoForPlan(${p.id})">+ 할 일 추가</button>
              <button class="btn btn-danger btn-sm" onclick="App.deletePlan(${p.id})">삭제</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  },

  updatePlanSelectOptions() {
    const filterSelect = document.getElementById('filter-plan-select');
    const modalSelect = document.getElementById('todo-plan-id');

    const filterOptions = '<option value="">모든 계획</option>' + this.plans.map(p => `
      <option value="${p.id}">${this.escapeHtml(p.title)} (${p.category})</option>
    `).join('');

    const modalOptions = this.plans.map(p => `
      <option value="${p.id}">${this.escapeHtml(p.title)}</option>
    `).join('');

    if (filterSelect) filterSelect.innerHTML = filterOptions;
    if (modalSelect) modalSelect.innerHTML = modalOptions;
  },

  openPlanModal() {
    document.getElementById('plan-id').value = '';
    document.getElementById('modal-plan-title').innerText = '새 계획 세우기';
    document.getElementById('form-plan').reset();
    document.getElementById('plan-change-reason-group').style.display = 'none';
    this.setupDatePickers();
    this.openModal('modal-plan');
  },

  async openEditPlanModal(planId) {
    try {
      const res = await API.getPlan(planId);
      if (!res.success) return alert(res.message);
      const p = res.data;

      document.getElementById('plan-id').value = p.id;
      document.getElementById('modal-plan-title').innerText = `계획 수정 (ID #${p.id})`;
      document.getElementById('plan-title').value = p.title;
      document.getElementById('plan-category').value = p.category;
      document.getElementById('plan-priority').value = p.priority;
      document.getElementById('plan-start-date').value = p.start_date;
      document.getElementById('plan-end-date').value = p.end_date;
      document.getElementById('plan-estimated-minutes').value = p.estimated_minutes;
      document.getElementById('plan-success-criteria').value = p.success_criteria;
      
      // 수정 시에는 수정 사유 필수 표시 (T06-C08 보존 안내)
      const reasonGroup = document.getElementById('plan-change-reason-group');
      reasonGroup.style.display = 'block';
      document.getElementById('plan-change-reason').value = '';
      document.getElementById('plan-change-reason').required = true;

      this.openModal('modal-plan');
    } catch (err) {
      console.error(err);
    }
  },

  async savePlan(e) {
    e.preventDefault();
    const id = document.getElementById('plan-id').value;
    const planData = {
      title: document.getElementById('plan-title').value.trim(),
      category: document.getElementById('plan-category').value,
      priority: document.getElementById('plan-priority').value,
      start_date: document.getElementById('plan-start-date').value,
      end_date: document.getElementById('plan-end-date').value,
      estimated_minutes: Number(document.getElementById('plan-estimated-minutes').value),
      success_criteria: document.getElementById('plan-success-criteria').value.trim(),
      change_reason: document.getElementById('plan-change-reason').value.trim()
    };

    try {
      let res;
      if (id) {
        res = await API.updatePlan(id, planData);
        if (res.success) this.showToast('✅ 계획이 수정되었고 이전 계획은 이력에 보존되었습니다.');
      } else {
        res = await API.createPlan(planData);
        if (res.success) this.showToast('✅ 새 계획이 DB에 등록되었습니다.');
      }

      if (res.success) {
        this.closeModal('modal-plan');
        await this.loadAll();
      } else {
        alert(res.message || '저장 실패');
      }
    } catch (err) {
      console.error('계획 저장 중 오류:', err);
      alert('오류가 발생했습니다.');
    }
  },

  // T06-C08: 계획 수정 이력(처음 세운 계획 보존) 모달 표시
  async viewPlanHistory(planId) {
    try {
      const res = await API.getPlan(planId);
      if (!res.success) return alert(res.message);
      const plan = res.data;
      const histories = plan.histories || [];

      const container = document.getElementById('history-timeline-container');
      if (histories.length === 0) {
        container.innerHTML = `<p style="color: #64748b;">이력이 없습니다.</p>`;
      } else {
        container.innerHTML = histories.map((h, idx) => {
          const isInitial = h.version === 1;
          return `
            <div class="history-item">
              <div>
                <span class="history-version-badge">버전 ${h.version} ${isInitial ? '(최초 계획)' : '(수정됨)'}</span>
                <span class="history-date">기록 시점: ${h.created_at}</span>
              </div>
              <div class="history-box">
                <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: #1e293b;">
                  ${this.escapeHtml(h.title)}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; color: #475569; font-size: 0.8rem; margin-bottom: 6px;">
                  <div>카테고리: <strong>${this.escapeHtml(h.category)}</strong></div>
                  <div>우선순위: <strong>${h.priority}</strong></div>
                  <div>기간: <strong>${h.start_date} ~ ${h.end_date}</strong></div>
                  <div>예상 시간: <strong>${h.estimated_minutes}분</strong></div>
                </div>
                <div style="font-size: 0.8rem; color: #334155; margin-bottom: 4px;">
                  🎯 성공 기준: ${this.escapeHtml(h.success_criteria)}
                </div>
                <div style="font-size: 0.78rem; color: #0284c7; background: #e0f2fe; padding: 4px 8px; border-radius: 4px;">
                  📝 사유: ${this.escapeHtml(h.change_reason || '최초 생성')}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      this.openModal('modal-history');
    } catch (err) {
      console.error(err);
    }
  },

  async deletePlan(planId) {
    if (!confirm('정말 이 계획을 삭제하시겠습니까? 딸린 모든 할 일과 이력도 함께 삭제됩니다.')) return;
    try {
      const res = await API.deletePlan(planId);
      if (res.success) {
        this.showToast('계획이 삭제되었습니다.');
        await this.loadAll();
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    }
  },

  openAddTodoForPlan(planId) {
    this.openTodoModal();
    const select = document.getElementById('todo-plan-id');
    if (select) select.value = planId;
  },

  // ============================================================
  // 카드 2: 할 일 (Todo / Do) 다루기 & 검색 / 필터 / 정렬
  // ============================================================
  async loadTodos() {
    try {
      const params = {
        ...this.filters,
        drilldown: this.activeDrilldown
      };
      const res = await API.getTodos(params);
      if (res.success) {
        this.todos = res.data;
        this.renderTodos();
        document.getElementById('count-tab-todos').innerText = this.todos.length;
      }
    } catch (err) {
      console.error('할 일 로드 실패:', err);
    }
  },

  renderTodos() {
    const container = document.getElementById('todos-container');
    if (!container) return;

    if (this.todos.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
          <h3 style="font-size: 1.1rem; color: #475569; margin-bottom: 8px;">조건에 맞는 할 일이 없습니다.</h3>
          <p style="font-size: 0.88rem; color: #94a3b8; margin-bottom: 16px;">새로운 할 일을 추가하거나 필터를 조정해보세요.</p>
          <button class="btn btn-primary" onclick="App.openTodoModal()">+ 새 할 일 추가</button>
        </div>
      `;
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    container.innerHTML = this.todos.map(t => {
      const isCompleted = t.status === 'COMPLETED';
      const isDelayed = (!isCompleted && t.due_date < todayStr) || (isCompleted && t.actual_minutes > t.estimated_minutes);
      const hasReflection = !!t.reflection_id;

      return `
        <article class="todo-card">
          <div>
            <div class="card-top">
              <div class="badges-wrapper">
                <span class="badge badge-status-${t.status}">${isCompleted ? '✓ 완료됨' : '진행 중'}</span>
                <span class="badge badge-priority-${t.priority}">우선순위: ${t.priority}</span>
                <span class="badge badge-tag">${this.escapeHtml(t.tag)}</span>
                ${isDelayed ? '<span class="badge badge-delayed">⚠️ 지연/초과</span>' : ''}
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">#ID: ${t.id}</span>
            </div>

            <!-- 내용 & 소속 계획 -->
            <div style="margin-bottom: 8px;">
              <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">[계획: ${this.escapeHtml(t.plan_title)}]</span>
              <h3 class="card-heading" style="${isCompleted ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${this.escapeHtml(t.content)}</h3>
            </div>

            <div class="card-meta-list">
              <div class="card-meta-item">
                <span>📅 마감일 (T06-C14):</span>
                <strong style="${!isCompleted && t.due_date < todayStr ? 'color: #dc2626;' : ''}">${t.due_date}</strong>
              </div>
              <div class="card-meta-item">
                <span>⏱️ 예상 시간 (T06-C17):</span>
                <strong>${t.estimated_minutes}분</strong>
              </div>
              ${isCompleted ? `
                <div class="card-meta-item">
                  <span>⏱️ 실제 소요 시간:</span>
                  <strong style="${t.actual_minutes > t.estimated_minutes ? 'color: #d97706;' : 'color: #10b981;'}">
                    ${t.actual_minutes}분 (오차: ${t.actual_minutes - t.estimated_minutes}분)
                  </strong>
                </div>
              ` : ''}
            </div>

            <!-- 회고가 작성된 경우 회고 요약 표시 -->
            ${hasReflection ? `
              <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px; margin-top: 8px; font-size: 0.8rem;">
                <div style="font-weight: 700; color: #6d28d9; margin-bottom: 2px;">
                  🔍 돌아보기 완료: [${this.escapeHtml(t.variance_reason)}]
                </div>
                <div style="color: #4b5563; font-style: italic;">
                  "${this.escapeHtml(t.insight)}"
                </div>
              </div>
            ` : ''}
          </div>

          <div class="card-footer">
            <div style="display: flex; gap: 8px; align-items: center;">
              <!-- T06-C11 완료 및 T06-C12 되돌리기 -->
              ${isCompleted ? `
                <button class="btn btn-secondary btn-sm" onclick="App.revertTodoStatus(${t.id})">↩️ 다시 진행 중으로</button>
              ` : `
                <button class="btn btn-success btn-sm" onclick="App.openCompleteModal(${t.id}, '${encodeURIComponent(t.content)}', ${t.estimated_minutes})">✓ 완료 체크</button>
              `}
              ${isCompleted && !hasReflection ? `
                <button class="btn btn-primary btn-sm" onclick="App.openReflectionModal(${t.plan_id}, ${t.id}, '${encodeURIComponent(t.content)}', ${t.estimated_minutes}, ${t.actual_minutes})">✍️ 돌아보기 작성</button>
              ` : ''}
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="App.openEditTodoModal(${t.id})">수정</button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteTodo(${t.id})">삭제</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  },

  openTodoModal() {
    if (this.plans.length === 0) {
      alert('먼저 계획을 하나 이상 등록해주세요!');
      this.switchTab('plans');
      this.openPlanModal();
      return;
    }
    document.getElementById('todo-id').value = '';
    document.getElementById('modal-todo-title').innerText = '새 할 일 추가';
    document.getElementById('form-todo').reset();
    this.setupDatePickers();
    this.openModal('modal-todo');
  },

  async openEditTodoModal(todoId) {
    const todo = this.todos.find(t => t.id === todoId);
    if (!todo) return;

    document.getElementById('todo-id').value = todo.id;
    document.getElementById('modal-todo-title').innerText = `할 일 수정 (ID #${todo.id})`;
    document.getElementById('todo-plan-id').value = todo.plan_id;
    document.getElementById('todo-content').value = todo.content;
    document.getElementById('todo-due-date').value = todo.due_date;
    document.getElementById('todo-priority').value = todo.priority;
    document.getElementById('todo-tag').value = todo.tag;
    document.getElementById('todo-estimated-minutes').value = todo.estimated_minutes;

    this.openModal('modal-todo');
  },

  async saveTodo(e) {
    e.preventDefault();
    const id = document.getElementById('todo-id').value;
    const todoData = {
      plan_id: Number(document.getElementById('todo-plan-id').value),
      content: document.getElementById('todo-content').value.trim(),
      due_date: document.getElementById('todo-due-date').value,
      priority: document.getElementById('todo-priority').value,
      tag: document.getElementById('todo-tag').value.trim(),
      estimated_minutes: Number(document.getElementById('todo-estimated-minutes').value)
    };

    try {
      let res;
      if (id) {
        res = await API.updateTodo(id, todoData);
        if (res.success) this.showToast('✅ 할 일이 수정되었습니다.');
      } else {
        res = await API.createTodo(todoData);
        if (res.success) this.showToast('✅ 새 할 일이 추가되었습니다.');
      }

      if (res.success) {
        this.closeModal('modal-todo');
        await this.loadAll();
      } else {
        alert(res.message || '할 일 저장 실패');
      }
    } catch (err) {
      console.error(err);
    }
  },

  // 할 일 완료 모달 열기
  openCompleteModal(todoId, encodedContent, estimatedMinutes) {
    const content = decodeURIComponent(encodedContent);
    document.getElementById('complete-todo-id').value = todoId;
    document.getElementById('complete-todo-desc').innerText = `"${content}" (예상: ${estimatedMinutes}분)`;
    document.getElementById('complete-actual-minutes').value = estimatedMinutes;
    this.openModal('modal-complete');
  },

  // 할 일 완료 처리 (T06-C11)
  async confirmCompleteTodo(e) {
    e.preventDefault();
    const todoId = document.getElementById('complete-todo-id').value;
    const actualMinutes = Number(document.getElementById('complete-actual-minutes').value);

    try {
      const res = await API.updateTodoStatus(todoId, 'COMPLETED', actualMinutes);
      if (res.success) {
        this.showToast('🎉 할 일을 완료 처리했습니다! 실제 소요 시간이 저장되었습니다.');
        this.closeModal('modal-complete');
        await this.loadAll();
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    }
  },

  // 완료된 할 일 다시 진행 중으로 되돌리기 (T06-C12)
  async revertTodoStatus(todoId) {
    if (!confirm('이 할 일을 다시 진행 중으로 되돌리시겠습니까?')) return;
    try {
      const res = await API.updateTodoStatus(todoId, 'PENDING', 0);
      if (res.success) {
        this.showToast('할 일이 다시 진행 중으로 전환되었습니다.');
        await this.loadAll();
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    }
  },

  // 할 일 삭제 (T06-C13)
  async deleteTodo(todoId) {
    if (!confirm('정말 이 할 일을 삭제하시겠습니까?')) return;
    try {
      const res = await API.deleteTodo(todoId);
      if (res.success) {
        this.showToast('할 일이 삭제되었습니다.');
        await this.loadAll();
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    }
  },

  // 실시간 검색 (T06-C18)
  onSearchInput() {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.filters.search = document.getElementById('search-todo-input').value.trim();
      this.loadTodos();
    }, 250);
  },

  // 조건 거르기 (T06-C19)
  applyFilters() {
    this.filters.plan_id = document.getElementById('filter-plan-select').value;
    this.filters.status = document.getElementById('filter-status-select').value;
    this.filters.priority = document.getElementById('filter-priority-select').value;
    this.loadTodos();
  },

  resetFilters() {
    document.getElementById('search-todo-input').value = '';
    document.getElementById('filter-plan-select').value = '';
    document.getElementById('filter-status-select').value = 'ALL';
    document.getElementById('filter-priority-select').value = 'ALL';
    document.getElementById('sort-by-select').value = 'default';
    this.filters = {
      search: '',
      plan_id: '',
      status: 'ALL',
      priority: 'ALL',
      tag: '',
      sort_by: 'default'
    };
    this.clearDrilldown();
    this.onSortChange();
  },

  // T06-C20 화면에 밝혀 둔 기준대로 할 일 정렬
  onSortChange() {
    const sortVal = document.getElementById('sort-by-select').value;
    this.filters.sort_by = sortVal;

    const descElem = document.getElementById('current-sort-desc');
    if (descElem) {
      if (sortVal === 'default') {
        descElem.innerText = '1순위 마감일 오름차순 ➔ 2순위 우선순위(높음➔보통➔낮음) ➔ 3순위 등록순(ID 오름차순)';
      } else if (sortVal === 'priority') {
        descElem.innerText = '1순위 우선순위(HIGH ➔ MEDIUM ➔ LOW) ➔ 2순위 마감일 오름차순 ➔ 3순위 등록순';
      } else if (sortVal === 'estimated_minutes') {
        descElem.innerText = '1순위 예상 시간 긴 순(내림차순) ➔ 2순위 등록순(ID 오름차순)';
      } else if (sortVal === 'created_desc') {
        descElem.innerText = '최근 등록된 순 (ID 내림차순)';
      }
    }

    this.loadTodos();
  },

  // ============================================================
  // 섹션 3: 돌아보기 (See / 회고)
  // ============================================================
  async loadReflections() {
    try {
      const res = await API.getReflections();
      if (res.success) {
        this.reflections = res.data;
        this.renderReflections();
        document.getElementById('count-tab-reflections').innerText = this.reflections.length;
      }
    } catch (err) {
      console.error('회고 로드 실패:', err);
    }
  },

  renderReflections() {
    const container = document.getElementById('reflections-container');
    if (!container) return;

    if (this.reflections.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
          <h3 style="font-size: 1.1rem; color: #475569; margin-bottom: 8px;">작성된 돌아보기(회고)가 없습니다.</h3>
          <p style="font-size: 0.88rem; color: #94a3b8;">완료된 할 일에서 '돌아보기 작성' 버튼을 눌러 계획과 실제의 괴리를 기록해보세요.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.reflections.map(r => `
      <article class="todo-card" style="border-left: 4px solid var(--color-purple);">
        <div>
          <div class="card-top">
            <span class="badge" style="background: #ede9fe; color: #6d28d9; font-weight: 700;">
              원인: ${this.escapeHtml(r.variance_reason)}
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${r.created_at}</span>
          </div>

          <h3 class="card-heading" style="font-size: 1rem;">
            🎯 계획: ${this.escapeHtml(r.plan_title || '')} 
            ${r.todo_content ? `<br><span style="font-size: 0.85rem; color: #64748b;">할 일: ${this.escapeHtml(r.todo_content)}</span>` : ''}
          </h3>

          <div class="card-meta-list">
            <div class="card-meta-item">
              <span>⏱️ 시간 오차:</span>
              <strong style="${r.time_variance > 0 ? 'color: #d97706;' : 'color: #10b981;'}">
                ${r.time_variance > 0 ? `+${r.time_variance}분 초과` : r.time_variance === 0 ? '정확히 일치' : `${r.time_variance}분 단축`}
              </strong>
            </div>
            <div class="card-meta-item" style="flex-direction: column; gap: 4px; margin-top: 6px;">
              <span>💡 돌아보기 느낀 점 (Insight):</span>
              <p style="color: #334155; font-size: 0.85rem;">${this.escapeHtml(r.insight)}</p>
            </div>
            <div class="card-meta-item" style="flex-direction: column; gap: 4px; margin-top: 6px;">
              <span>🚀 다음 계획에 반영할 점 (Action Item):</span>
              <p style="color: #1e40af; font-size: 0.85rem; font-weight: 600;">${this.escapeHtml(r.action_item)}</p>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  },

  openReflectionModal(planId, todoId, encodedContent, estimatedMinutes, actualMinutes) {
    const content = decodeURIComponent(encodedContent);
    const variance = actualMinutes - estimatedMinutes;

    document.getElementById('reflection-plan-id').value = planId;
    document.getElementById('reflection-todo-id').value = todoId;
    document.getElementById('reflection-target-info').innerHTML = `
      <strong>할 일:</strong> ${this.escapeHtml(content)}<br>
      <strong>예상:</strong> ${estimatedMinutes}분 / <strong>실제:</strong> ${actualMinutes}분 (오차: ${variance > 0 ? `+${variance}분 초과` : `${variance}분`})
    `;
    document.getElementById('form-reflection').reset();
    this.openModal('modal-reflection');
  },

  async saveReflection(e) {
    e.preventDefault();
    const planId = Number(document.getElementById('reflection-plan-id').value);
    const todoId = Number(document.getElementById('reflection-todo-id').value);
    const varianceReason = document.getElementById('reflection-variance-reason').value;
    const insight = document.getElementById('reflection-insight').value.trim();
    const actionItem = document.getElementById('reflection-action-item').value.trim();

    // 할 일의 시간 오차 조회
    const todo = this.todos.find(t => t.id === todoId);
    const timeVariance = todo ? (todo.actual_minutes - todo.estimated_minutes) : 0;

    try {
      const res = await API.createReflection({
        plan_id: planId,
        todo_id: todoId,
        variance_reason: varianceReason,
        time_variance: timeVariance,
        insight,
        action_item: actionItem
      });

      if (res.success) {
        this.showToast('🔍 돌아보기(See) 회고가 저장되었습니다!');
        this.closeModal('modal-reflection');
        await this.loadAll();
        this.switchTab('reflections');
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    }
  },

  // ============================================================
  // 모달 제어 & XSS 방어 유틸리티
  // ============================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // XSS 방어: HTML 특수문자 이스케이프
  escapeHtml(str) {
    if (typeof str !== 'string') return str ?? '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // 토스트 메시지
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }
};

// DOM 로드 완료 시 앱 실행
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
