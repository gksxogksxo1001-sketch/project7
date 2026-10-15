/**
 * 플랜두씨(Plan-Do-See) 메인 프론트엔드 컨트롤러 (카드 1~5 통합 사양)
 */

const App = {
  // 상태
  currentUser: null,
  isUsernameAvailable: false,
  isPasswordMatch: false,
  usernameCheckTimer: null,

  currentTab: 'plans',
  activeDrilldown: null, // 'all', 'completed', 'delayed', 'blocked', 'need_reflection', null
  plans: [],
  todos: [],
  reflections: [],
  summary: null,
  isSubmittingExecution: false, // T06-C21 연타 방지 플래그

  filters: {
    search: '',
    plan_id: '',
    status: 'ALL',
    priority: 'ALL',
    tag: '',
    sort_by: 'default'
  },

  // 1. 초기화 (과제 7: 인증 상태 확인 후 첫 화면 분기)
  async init() {
    console.log('🚀 플랜두씨 다이어리 프론트엔드 초기화 시작');
    this.setupAuthListeners();
    await this.checkAuthStatus();
  },

  // ----------------------------------------------------
  // 과제 7: 인증 상태 확인 및 뷰 전환
  // ----------------------------------------------------
  async checkAuthStatus() {
    try {
      const res = await API.getMe();
      if (res && res.success && res.user) {
        this.currentUser = res.user;
        this.showAuthenticatedView();
        await this.loadAll();
        this.setupDatePickers();
      } else {
        this.currentUser = null;
        this.showUnauthenticatedView();
      }
    } catch (e) {
      this.currentUser = null;
      this.showUnauthenticatedView();
    }
  },

  showAuthenticatedView() {
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('app-main-content');
    const headerActions = document.getElementById('header-user-actions');
    const headerUserName = document.getElementById('header-user-name');
    const bannerText = document.getElementById('banner-notice-text');
    const bannerBadge = document.getElementById('banner-badge');

    if (authSection) authSection.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
    if (headerActions) headerActions.classList.remove('hidden');
    if (headerUserName && this.currentUser) headerUserName.textContent = this.currentUser.name;

    if (bannerText && this.currentUser) {
      bannerText.textContent = `🔒 ${this.currentUser.name}(${this.currentUser.username})님의 전용 다이어리입니다. 타인은 내 계획과 기록에 절대 접근할 수 없습니다.`;
    }
    if (bannerBadge) bannerBadge.textContent = '✅ 인증 보호 중';
  },

  showUnauthenticatedView() {
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('app-main-content');
    const headerActions = document.getElementById('header-user-actions');
    const bannerText = document.getElementById('banner-notice-text');
    const bannerBadge = document.getElementById('banner-badge');

    if (authSection) authSection.classList.remove('hidden');
    if (mainContent) mainContent.classList.add('hidden');
    if (headerActions) headerActions.classList.add('hidden');

    if (bannerText) {
      bannerText.textContent = '비로그인 상태입니다. 내 기록을 안전하게 보호하기 위해 먼저 로그인하거나 회원가입을 진행해주세요.';
    }
    if (bannerBadge) bannerBadge.textContent = '🔒 과제 7';

    this.switchAuthTab('login');
  },

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (formLogin) formLogin.classList.remove('hidden');
      if (formRegister) formRegister.classList.add('hidden');
    } else {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
      if (formLogin) formLogin.classList.add('hidden');
      if (formRegister) formRegister.classList.remove('hidden');
    }
  },

  // 동적 반응 (실시간 중복 체크 & 실시간 비밀번호 일치 확인) 리스너 설정
  setupAuthListeners() {
    const regUsername = document.getElementById('reg-username');
    const usernameMsg = document.getElementById('reg-username-msg');

    if (regUsername && usernameMsg) {
      regUsername.addEventListener('input', () => {
        clearTimeout(this.usernameCheckTimer);
        const val = regUsername.value.trim();

        if (!val) {
          usernameMsg.textContent = '';
          usernameMsg.className = 'validation-msg';
          this.isUsernameAvailable = false;
          return;
        }

        if (val.length < 4) {
          usernameMsg.textContent = '⚠️ 아이디는 최소 4자 이상이어야 합니다.';
          usernameMsg.className = 'validation-msg info';
          this.isUsernameAvailable = false;
          return;
        }

        usernameMsg.textContent = '🔍 아이디 중복 확인 중...';
        usernameMsg.className = 'validation-msg info';

        this.usernameCheckTimer = setTimeout(async () => {
          try {
            const res = await API.checkUsername(val);
            if (res.available) {
              usernameMsg.textContent = '✅ ' + res.message;
              usernameMsg.className = 'validation-msg success';
              this.isUsernameAvailable = true;
            } else {
              usernameMsg.textContent = '❌ ' + (res.message || '이미 사용 중인 아이디입니다.');
              usernameMsg.className = 'validation-msg error';
              this.isUsernameAvailable = false;
            }
          } catch (e) {
            usernameMsg.textContent = '⚠️ 확인 중 오류가 발생했습니다.';
            usernameMsg.className = 'validation-msg error';
            this.isUsernameAvailable = false;
          }
        }, 300);
      });
    }

    const regPassword = document.getElementById('reg-password');
    const regConfirm = document.getElementById('reg-password-confirm');
    const passwordMsg = document.getElementById('reg-password-msg');

    const checkPasswordMatch = () => {
      if (!passwordMsg) return;
      const p1 = regPassword ? regPassword.value : '';
      const p2 = regConfirm ? regConfirm.value : '';

      if (!p2) {
        passwordMsg.textContent = '';
        passwordMsg.className = 'validation-msg';
        this.isPasswordMatch = false;
        return;
      }

      if (p1 === p2) {
        if (p1.length >= 4) {
          passwordMsg.textContent = '✅ 비밀번호가 일치합니다.';
          passwordMsg.className = 'validation-msg success';
          this.isPasswordMatch = true;
        } else {
          passwordMsg.textContent = '⚠️ 비밀번호는 4자 이상 입력해주세요.';
          passwordMsg.className = 'validation-msg info';
          this.isPasswordMatch = false;
        }
      } else {
        passwordMsg.textContent = '❌ 비밀번호가 일치하지 않습니다.';
        passwordMsg.className = 'validation-msg error';
        this.isPasswordMatch = false;
      }
    };

    if (regPassword) regPassword.addEventListener('input', checkPasswordMatch);
    if (regConfirm) regConfirm.addEventListener('input', checkPasswordMatch);
  },

  // 로그인 제출 처리
  async handleLogin() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const feedback = document.getElementById('login-feedback');

    if (!usernameInput || !passwordInput) return;
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      if (feedback) {
        feedback.textContent = '❌ 아이디와 비밀번호를 모두 입력해주세요.';
        feedback.className = 'validation-msg error';
      }
      return;
    }

    if (feedback) {
      feedback.textContent = '⏳ 로그인 진행 중...';
      feedback.className = 'validation-msg info';
    }

    const res = await API.login(username, password);
    if (res.success && res.user) {
      this.currentUser = res.user;
      if (feedback) feedback.textContent = '';
      this.showAuthenticatedView();
      this.showToast(res.message || '로그인되었습니다! 🎉');
      await this.loadAll();
      this.setupDatePickers();
    } else {
      if (feedback) {
        feedback.textContent = '❌ ' + (res.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
        feedback.className = 'validation-msg error';
      }
    }
  },

  // 회원가입 제출 처리
  async handleRegister() {
    const username = document.getElementById('reg-username')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-password-confirm')?.value;
    const name = document.getElementById('reg-name')?.value.trim();
    const birthdate = document.getElementById('reg-birthdate')?.value;
    const gender = document.getElementById('reg-gender')?.value;
    const phone = document.getElementById('reg-phone')?.value.trim();
    const address = document.getElementById('reg-address')?.value.trim();
    const globalMsg = document.getElementById('reg-global-msg');

    if (!this.isUsernameAvailable) {
      if (globalMsg) {
        globalMsg.textContent = '❌ 사용 가능한 아이디를 입력해주세요.';
        globalMsg.className = 'validation-msg error';
      }
      document.getElementById('reg-username')?.focus();
      return;
    }

    if (!this.isPasswordMatch || password !== confirm) {
      if (globalMsg) {
        globalMsg.textContent = '❌ 비밀번호가 일치하지 않습니다.';
        globalMsg.className = 'validation-msg error';
      }
      document.getElementById('reg-password-confirm')?.focus();
      return;
    }

    if (!name || !birthdate || !gender || !phone || !address) {
      if (globalMsg) {
        globalMsg.textContent = '❌ 이름, 생년월일, 성별, 전화번호, 주소를 모두 입력해주세요.';
        globalMsg.className = 'validation-msg error';
      }
      return;
    }

    if (globalMsg) {
      globalMsg.textContent = '⏳ 회원가입 처리 중...';
      globalMsg.className = 'validation-msg info';
    }

    const res = await API.register({
      username,
      password,
      name,
      birthdate,
      gender,
      phone,
      address
    });

    if (res.success && res.user) {
      this.currentUser = res.user;
      if (globalMsg) globalMsg.textContent = '';
      this.showAuthenticatedView();
      this.showToast('🎉 회원가입 완료! 자동으로 로그인되었습니다.');
      await this.loadAll();
      this.setupDatePickers();
    } else {
      if (globalMsg) {
        globalMsg.textContent = '❌ ' + (res.message || '회원가입에 실패했습니다.');
        globalMsg.className = 'validation-msg error';
      }
    }
  },

  // 로그아웃 처리 (과제 7: 세션 파괴 및 로그인 화면 복귀)
  async handleLogout() {
    if (!confirm('로그아웃하시겠습니까?')) return;
    await API.logout();
    this.currentUser = null;
    this.plans = [];
    this.todos = [];
    this.reflections = [];
    this.summary = null;
    this.showUnauthenticatedView();
    this.showToast('안전하게 로그아웃되었습니다.');
  },

  // 회원 탈퇴 / 계정 삭제 처리 (T07-C134: 내 계정을 지우면 내 모든 자료도 함께 영구 삭제됨)
  async handleDeleteAccount() {
    const confirmed = confirm('⚠️ 정말로 회원 탈퇴를 진행하시겠습니까?\n\n탈퇴 시 등록하신 모든 계획, 할 일, 실행 기록, 회고 자료가 함께 영구히 삭제되며 절대 복구할 수 없습니다.');
    if (!confirmed) return;

    const res = await API.deleteAccount();
    if (res.success) {
      this.currentUser = null;
      this.plans = [];
      this.todos = [];
      this.reflections = [];
      this.summary = null;
      this.showUnauthenticatedView();
      alert(res.message || '계정이 삭제되었습니다.');
    } else {
      alert('오류 발생: ' + (res.message || '탈퇴 처리에 실패했습니다.'));
    }
  },

  setupDatePickers() {
    const today = new Date().toISOString().split('T')[0];
    const planStartDate = document.getElementById('plan-start-date');
    const planEndDate = document.getElementById('plan-end-date');
    const todoDueDate = document.getElementById('todo-due-date');
    if (planStartDate) planStartDate.value = today;
    if (planEndDate) planEndDate.value = today;
    if (todoDueDate) todoDueDate.value = today;
  },

  // 전체 데이터 로드 (T06-C35 새로고침 후에도 온전히 복원)
  async loadAll() {
    if (!this.currentUser) return;
    await Promise.all([
      this.loadSummary(),
      this.loadPlans(),
      this.loadTodos(),
      this.loadReflections()
    ]);
  },

  // ============================================================
  // 대시보드 통계 & 드릴다운 (카드 4 T06-C28 ~ C32, C83)
  // ============================================================
  async loadSummary() {
    try {
      const res = await API.getSummary();
      if (res && res.status === 401) {
        this.showUnauthenticatedView();
        return;
      }
      if (res && res.success) {
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

    // T06-C28: 계획된 할 일 수
    const totalTodosElem = document.getElementById('val-total-todos');
    if (totalTodosElem) totalTodosElem.innerText = s.totalTodos;
    const totalPlansSub = document.getElementById('val-total-plans-sub');
    if (totalPlansSub) totalPlansSub.innerText = `등록된 계획 ${s.totalPlans}건`;

    // T06-C29: 완료 수
    const completedTodosElem = document.getElementById('val-completed-todos');
    if (completedTodosElem) completedTodosElem.innerText = s.completedTodos;
    const completionRateSub = document.getElementById('val-completion-rate-sub');
    if (completionRateSub) completionRateSub.innerText = `달성률 ${s.completionRate}%`;

    // T06-C30: 지연 수 (미완료 & 오늘 이전 마감)
    const delayedTodosElem = document.getElementById('val-delayed-todos');
    if (delayedTodosElem) delayedTodosElem.innerText = s.delayedCount;

    // T06-C31: 막힘 수
    const blockedTodosElem = document.getElementById('val-blocked-todos');
    if (blockedTodosElem) blockedTodosElem.innerText = s.blockedCount;

    // T06-C32: 시간 오차 요약 (실제 - 예상)
    const timeVarianceElem = document.getElementById('val-time-variance');
    if (timeVarianceElem) {
      const sign = s.timeVariance > 0 ? '+' : '';
      timeVarianceElem.innerText = `${sign}${s.timeVariance}분`;
      timeVarianceElem.style.color = s.timeVariance > 0 ? '#d97706' : s.timeVariance === 0 ? '#10b981' : '#3b82f6';
    }
    const timeDetailsElem = document.getElementById('val-time-details');
    if (timeDetailsElem) {
      timeDetailsElem.innerText = `예상 ${s.totalEstimatedMinutes}분 / 실제 ${s.totalActualMinutes}분`;
    }

    // 카드 활성화 하이라이트
    ['all', 'completed', 'delayed', 'blocked'].forEach(type => {
      const card = document.getElementById(`card-drill-${type}`);
      if (card) card.classList.toggle('active-filter', this.activeDrilldown === type);
    });
  },

  // T06-C83 집계 숫자 클릭 시 그 숫자가 나온 기록으로 드릴다운 이동
  applyDrilldown(type) {
    this.activeDrilldown = type;
    this.switchTab('todos');

    const alertBanner = document.getElementById('drilldown-active-alert');
    const alertText = document.getElementById('drilldown-alert-text');

    if (alertBanner) alertBanner.style.display = 'flex';
    if (alertText) {
      if (type === 'all') {
        alertText.innerHTML = `🔍 <strong>[계획된 전체 할 일]</strong> 목록이 표시 중입니다.`;
      } else if (type === 'completed') {
        alertText.innerHTML = `🔍 <strong>[완료된 할 일 (T06-C29)]</strong> 집계 숫자 드릴다운이 동작 중입니다.`;
      } else if (type === 'delayed') {
        alertText.innerHTML = `🔍 <strong>[지연된 할 일 (T06-C30)]</strong> 집계 숫자 드릴다운이 동작 중입니다. (완료된 건은 제외)`;
      } else if (type === 'blocked') {
        alertText.innerHTML = `🔍 <strong>[막혔던 이유가 있는 할 일 (T06-C31)]</strong> 집계 숫자 드릴다운이 동작 중입니다.`;
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
      if (res && res.status === 401) {
        this.showUnauthenticatedView();
        return;
      }
      if (res && res.success) {
        this.plans = res.data;
        this.renderPlans();
        this.updatePlanSelectOptions();
        const tabCount = document.getElementById('count-tab-plans');
        if (tabCount) tabCount.innerText = this.plans.length;
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
                <span>⏱️ 총 예상 시간 (T06-C07):</span>
                <strong>${p.estimated_minutes}분 (${Math.round(p.estimated_minutes / 60 * 10) / 10}시간)</strong>
              </div>
              <div class="card-meta-item" style="flex-direction: column; gap: 2px; margin-top: 4px;">
                <span>🎯 성공 기준 (T06-C06):</span>
                <strong style="font-weight: 500; color: #334155; word-break: break-word;">${this.escapeHtml(p.success_criteria)}</strong>
              </div>
            </div>

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

  openPlanModal(prefillActionItem = '') {
    document.getElementById('plan-id').value = '';
    document.getElementById('modal-plan-title').innerText = '새 계획 세우기';
    document.getElementById('form-plan').reset();
    document.getElementById('plan-change-reason-group').style.display = 'none';
    this.setupDatePickers();

    // T06-C33: 돌아보기에서 정한 고칠 점 한 건이 다음 계획으로 넘어간다
    if (prefillActionItem) {
      document.getElementById('plan-title').value = `[개선] ${prefillActionItem.substring(0, 25)}`;
      document.getElementById('plan-success-criteria').value = `돌아보기 고칠 점 반영: ${prefillActionItem}`;
      this.showToast('🚀 이전 돌아보기의 고칠 점이 새 계획에 자동 반영되었습니다!');
    }

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
    }
  },

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
        container.innerHTML = histories.map(h => `
          <div class="history-item">
            <div>
              <span class="history-version-badge">버전 ${h.version} ${h.version === 1 ? '(최초 계획)' : '(수정됨)'}</span>
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
        `).join('');
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
  // 카드 2 & 3: 할 일 (Todo) 및 실행 기록 (Executions)
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
        const tabCount = document.getElementById('count-tab-todos');
        if (tabCount) tabCount.innerText = this.todos.length;
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
      // T06-C30: 완료되지 않았고 마감일이 오늘보다 앞선 것만 지연! (완료된 것은 제외)
      const isDelayed = !isCompleted && t.due_date < todayStr;
      const isBlocked = !!(t.blocked_reason && t.blocked_reason.trim() !== '');
      const hasReflection = !!t.reflection_id;

      return `
        <article class="todo-card">
          <div>
            <div class="card-top">
              <div class="badges-wrapper">
                <span class="badge badge-status-${t.status}">${isCompleted ? '✓ 완료됨' : '진행 중'}</span>
                <span class="badge badge-priority-${t.priority}">우선순위: ${t.priority}</span>
                <span class="badge badge-tag">${this.escapeHtml(t.tag)}</span>
                ${isDelayed ? '<span class="badge badge-delayed">⏰ 마감 지연</span>' : ''}
                ${isBlocked ? '<span class="badge badge-blocked">🛑 막힘 기록됨</span>' : ''}
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">#ID: ${t.id}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">[계획: ${this.escapeHtml(t.plan_title)}]</span>
              <h3 class="card-heading" style="${isCompleted ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${this.escapeHtml(t.content)}</h3>
            </div>

            <!-- 원래 계획 값 보존 영역 (T06-C27) -->
            <div class="card-meta-list">
              <div class="card-meta-item">
                <span>📅 계획 마감일 (T06-C14):</span>
                <strong style="${isDelayed ? 'color: #dc2626;' : ''}">${t.due_date}</strong>
              </div>
              <div class="card-meta-item">
                <span>⏱️ 계획 예상 시간 (T06-C17 / C27 보존):</span>
                <strong>${t.estimated_minutes}분</strong>
              </div>
            </div>

            <!-- 카드 3: 실행 기록 표시 (T06-C23 ~ C26) -->
            ${isCompleted ? `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; margin-top: 8px; font-size: 0.82rem;">
                <div style="font-weight: 700; color: #166534; margin-bottom: 4px;">📌 실제 실행 기록 (Do):</div>
                <div style="color: #374151;">• 시작: <strong>${t.started_at || '-'}</strong> ➔ 종료: <strong>${t.ended_at || '-'}</strong></div>
                <div style="color: #374151;">• 실제로 걸린 시간: <strong>${t.actual_minutes}분</strong> (계획과의 차이: <strong>${t.actual_minutes - t.estimated_minutes > 0 ? `+${t.actual_minutes - t.estimated_minutes}분 초과` : `${t.actual_minutes - t.estimated_minutes}분`}</strong>)</div>
                ${t.blocked_reason ? `<div style="color: #991b1b; margin-top: 2px;">• 막혔던 이유: <em>"${this.escapeHtml(t.blocked_reason)}"</em></div>` : ''}
              </div>
            ` : ''}

            <!-- 카드 4: 돌아보기 연결 정보 -->
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
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              ${isCompleted ? `
                <button class="btn btn-secondary btn-sm" onclick="App.revertTodoStatus(${t.id})">↩️ 다시 진행 중으로</button>
              ` : `
                <button class="btn btn-success btn-sm" onclick="App.openCompleteModal(${t.id}, '${encodeURIComponent(t.content)}', ${t.estimated_minutes})">✓ 완료 & 실행기록 적기</button>
              `}
              ${isCompleted && !hasReflection ? `
                <button class="btn btn-primary btn-sm" onclick="App.openReflectionModal(${t.plan_id}, ${t.id}, '${encodeURIComponent(t.content)}', ${t.estimated_minutes}, ${t.actual_minutes})">✍️ 돌아보기 작성</button>
              ` : ''}
            </div>

            <div style="display: flex; gap: 6px;">
              ${!isCompleted ? `<button class="btn btn-secondary btn-sm" onclick="App.openEditTodoModal(${t.id})">수정</button>` : ''}
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

  // 카드 3: 실행 기록 작성 모달 열기
  openCompleteModal(todoId, encodedContent, estimatedMinutes) {
    const content = decodeURIComponent(encodedContent);
    document.getElementById('complete-todo-id').value = todoId;
    document.getElementById('complete-todo-desc').innerText = `할 일: "${content}" (원래 계획 예상: ${estimatedMinutes}분)`;
    
    // 기본 시작/종료 시각을 오늘 현재 시간대로 세팅
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const endedStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    const startObj = new Date(now.getTime() - estimatedMinutes * 60000);
    const startedStr = `${startObj.getFullYear()}-${pad(startObj.getMonth()+1)}-${pad(startObj.getDate())}T${pad(startObj.getHours())}:${pad(startObj.getMinutes())}`;

    document.getElementById('complete-started-at').value = startedStr;
    document.getElementById('complete-ended-at').value = endedStr;
    document.getElementById('complete-actual-minutes').value = estimatedMinutes;
    document.getElementById('complete-blocked-reason').value = '';

    const btn = document.getElementById('btn-submit-execution');
    if (btn) btn.disabled = false;

    this.openModal('modal-complete');
  },

  autoCalcMinutes() {
    const startVal = document.getElementById('complete-started-at').value;
    const endVal = document.getElementById('complete-ended-at').value;
    if (startVal && endVal) {
      const s = new Date(startVal);
      const e = new Date(endVal);
      const diffMinutes = Math.round((e.getTime() - s.getTime()) / 60000);
      if (diffMinutes > 0) {
        document.getElementById('complete-actual-minutes').value = diffMinutes;
      }
    }
  },

  // 카드 3: 실행 기록 저장 및 완료 확인 (T06-C21 중복 연타 방지 멱등성)
  async confirmCompleteTodo(e) {
    e.preventDefault();
    if (this.isSubmittingExecution) return; // T06-C21 방어

    const todoId = document.getElementById('complete-todo-id').value;
    const executionData = {
      started_at: document.getElementById('complete-started-at').value.replace('T', ' '),
      ended_at: document.getElementById('complete-ended-at').value.replace('T', ' '),
      actual_minutes: Number(document.getElementById('complete-actual-minutes').value),
      blocked_reason: document.getElementById('complete-blocked-reason').value.trim()
    };

    this.isSubmittingExecution = true;
    const btn = document.getElementById('btn-submit-execution');
    if (btn) btn.disabled = true;

    try {
      const res = await API.saveExecution(todoId, executionData);
      if (res.success) {
        this.showToast('🎉 실행 기록(Do)이 등록되고 완료되었습니다! (원래 계획 값 보존)');
        this.closeModal('modal-complete');
        await this.loadAll(); // T06-C22: 집계 1회만 정확히 반영 확인
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isSubmittingExecution = false;
      if (btn) btn.disabled = false;
    }
  },

  async revertTodoStatus(todoId) {
    if (!confirm('이 할 일을 다시 진행 중으로 되돌리시겠습니까? 실행 기록과 회고가 함께 초기화됩니다.')) return;
    try {
      const res = await API.revertTodo(todoId);
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

  onSearchInput() {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.filters.search = document.getElementById('search-todo-input').value.trim();
      this.loadTodos();
    }, 250);
  },

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
  // 카드 4: 돌아보기 (See) 및 다음 계획으로 연계 (T06-C33)
  // ============================================================
  async loadReflections() {
    try {
      const res = await API.getReflections();
      if (res.success) {
        this.reflections = res.data;
        this.renderReflections();
        const tabCount = document.getElementById('count-tab-reflections');
        if (tabCount) tabCount.innerText = this.reflections.length;
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
            ${r.blocked_reason ? `
              <div class="card-meta-item">
                <span>🛑 실행 중 막힌 이유:</span>
                <strong style="color: #991b1b;">${this.escapeHtml(r.blocked_reason)}</strong>
              </div>
            ` : ''}
            <div class="card-meta-item" style="flex-direction: column; gap: 4px; margin-top: 6px;">
              <span>💡 돌아보기 느낀 점 (Insight):</span>
              <p style="color: #334155; font-size: 0.85rem;">${this.escapeHtml(r.insight)}</p>
            </div>
            <div class="card-meta-item" style="flex-direction: column; gap: 4px; margin-top: 6px; background: #eff6ff; padding: 8px; border-radius: 6px;">
              <span>🚀 다음 계획으로 넘길 고칠 점 (T06-C33 Action Item):</span>
              <p style="color: #1e40af; font-size: 0.85rem; font-weight: 700;">${this.escapeHtml(r.action_item)}</p>
            </div>
          </div>
        </div>

        <!-- T06-C33: 돌아보기에서 정한 고칠 점 한 건이 다음 계획으로 넘어간다 -->
        <div class="card-footer" style="justify-content: flex-end;">
          <button class="btn btn-primary btn-sm" onclick="App.startNextPlanWithActionItem('${encodeURIComponent(r.action_item)}')">
            🚀 이 고칠 점으로 새 계획 세우기 (T06-C33)
          </button>
        </div>
      </article>
    `).join('');
  },

  // T06-C33: 회고의 고칠 점을 가지고 새 계획 세우기 모달 열기
  startNextPlanWithActionItem(encodedActionItem) {
    const actionItem = decodeURIComponent(encodedActionItem);
    this.switchTab('plans');
    this.openPlanModal(actionItem);
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
  // 카드 5: 자료 전체 파일 하나로 내보내기 (T06-C36)
  // ============================================================
  async exportData() {
    this.showToast('📥 백업 JSON 파일을 생성하여 다운로드합니다...');
    await API.exportData();
  },

  // ============================================================
  // 모달 제어 & XSS 방어 유틸리티 (T06-C57)
  // ============================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  escapeHtml(str) {
    if (typeof str !== 'string') return str ?? '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

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

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
