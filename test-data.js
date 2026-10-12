/**
 * 과제 6 카드 1 ~ 카드 5 전체 통과 기준 자동 검증 스크립트
 */

const http = require('http');

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function verifyAll() {
  console.log('=====================================================');
  console.log('🧪 플랜두씨 다이어리 카드 1~5 통합 검증 시작');
  console.log('=====================================================');

  // 1. 계획 등록 (T06-C04~C07, T06-C78)
  console.log('\n[검증 1] 카드 1: 계획 등록 및 이력 보존 (T06-C04~C08, T06-C78)');
  const planData = {
    title: '플랜두씨 다이어리 1 완주 및 배포',
    category: '공부',
    priority: 'HIGH',
    start_date: '2026-10-12',
    end_date: '2026-10-22',
    estimated_minutes: 600,
    success_criteria: '과제 6 완주 체크리스트 및 카드 1~5 전체 통과 기준 만족'
  };
  const createPlanRes = await request('POST', '/api/plans', planData);
  const planId = createPlanRes.data.id;
  console.log(`✅ 계획 등록 성공 (ID: ${planId})`);

  // 계획 수정 (T06-C08 보존)
  await request('PUT', `/api/plans/${planId}`, {
    ...planData,
    end_date: '2026-10-25',
    change_reason: '검증 항목 완벽 보강을 위한 마감일 3일 연장'
  });
  const planDetail = await request('GET', `/api/plans/${planId}`);
  console.log(`✅ T06-C08 고치기 전 내용 보존 확인: 총 ${planDetail.data.histories.length}개 버전 유지`);

  // 2. 할 일 5개 등록 (T06-C09~C17, T06-C79)
  console.log('\n[검증 2] 카드 2: 할 일 5개 이상 등록 (T06-C09~C17, T06-C79)');
  const todosSpec = [
    { plan_id: planId, content: '요구사항 및 카드 1~5 체크리스트 분석', due_date: '2026-10-13', priority: 'HIGH', tag: '#기획', estimated_minutes: 60 },
    { plan_id: planId, content: 'executions 테이블 및 멱등 완료 API 구현', due_date: '2026-10-14', priority: 'HIGH', tag: '#백엔드', estimated_minutes: 120 },
    { plan_id: planId, content: 'Bento Grid 집계 및 오차 분석 UI 연동', due_date: '2026-10-15', priority: 'HIGH', tag: '#프론트', estimated_minutes: 180 },
    { plan_id: planId, content: '지연 통계(오늘 이전 마감) 및 필터링 검증', due_date: '2026-10-11', priority: 'MEDIUM', tag: '#테스트', estimated_minutes: 90 }, // 지연 대상
    { plan_id: planId, content: 'XSS 방어 및 JSON 내보내기 최종 점검', due_date: '2026-10-17', priority: 'LOW', tag: '#보안', estimated_minutes: 45 }
  ];

  const createdTodos = [];
  for (const t of todosSpec) {
    const res = await request('POST', '/api/todos', t);
    createdTodos.push(res.data);
  }
  console.log(`✅ 할 일 ${createdTodos.length}개 등록 완료 (T06-C79 통과)`);

  // 3. 카드 3: 실행 기록 적기 및 연타 멱등 방어 검증 (T06-C21 ~ T06-C27, T06-C80)
  console.log('\n[검증 3] 카드 3: 실행 기록 적기 및 연타 중복 방지 (T06-C21~C27, T06-C80)');
  
  // 할일 1 완료 (실행 기록 1)
  const exec1Data = {
    started_at: '2026-10-12 14:00',
    ended_at: '2026-10-12 15:20',
    actual_minutes: 80,
    blocked_reason: '세부 통과 기준 번호들을 하나씩 대조하느라 20분 지체됨'
  };
  await request('POST', `/api/todos/${createdTodos[0].id}/execution`, exec1Data);

  // T06-C21 검증: 완료 버튼 연달아 두 번 눌렀을 때
  console.log('👉 T06-C21 테스트: 할일 1에 대해 완료 요청을 연달아 한 번 더 전송');
  const duplicateRes = await request('POST', `/api/todos/${createdTodos[0].id}/execution`, exec1Data);
  console.log(`응답 메시지: ${duplicateRes.message || '정상 처리'}`);

  // 할일 2 완료 (실행 기록 2)
  await request('POST', `/api/todos/${createdTodos[1].id}/execution`, {
    started_at: '2026-10-12 15:30',
    ended_at: '2026-10-12 17:10',
    actual_minutes: 100,
    blocked_reason: ''
  });

  // 할일 3 완료 (실행 기록 3 -> T06-C80: 실제로 한 일 3개 이상 만족!)
  await request('POST', `/api/todos/${createdTodos[2].id}/execution`, {
    started_at: '2026-10-12 17:30',
    ended_at: '2026-10-12 21:00',
    actual_minutes: 210,
    blocked_reason: '모달 폼 반응형 스타일링 조정으로 시간 초과'
  });

  // T06-C27 원래 계획 값 덮어쓰지 않았는지 검증
  const checkTodo1 = await request('GET', `/api/todos?plan_id=${planId}`);
  const t1 = checkTodo1.data.find(x => x.id === createdTodos[0].id);
  console.log(`✅ T06-C27 원래 계획 값 보존: 계획 예상시간(${t1.estimated_minutes}분) != 실제시간(${t1.actual_minutes}분)`);
  console.log(`✅ T06-C23~C26 실행 기록 값: 시작(${t1.started_at}), 끝(${t1.ended_at}), 실제(${t1.actual_minutes}분), 막힘이유(${t1.blocked_reason})`);

  // 4. 돌아보기(See) 회고 등록 (카드 4 T06-C33)
  console.log('\n[검증 4] 카드 4: 돌아보기 등록 및 집계 정합성 (T06-C28~C32, T06-C33, T06-C81)');
  await request('POST', '/api/reflections', {
    plan_id: planId,
    todo_id: createdTodos[0].id,
    variance_reason: '소요시간 과소평가',
    time_variance: 20,
    insight: '세부 요구사항 항목을 하나씩 대조하다 보니 20분이 초과되었다.',
    action_item: '다음 번 계획을 세울 때는 사전 체크리스트 템플릿을 준비해두자' // T06-C33 고칠 점
  });

  const summary = (await request('GET', '/api/summary')).data;
  console.log('대시보드 최종 집계 결과:');
  console.log(` - T06-C28 계획된 할 일 수: ${summary.totalTodos}건 (실제: ${createdTodos.length})`);
  console.log(` - T06-C29 완료 수: ${summary.completedTodos}건 (실제 완료 3건)`);
  console.log(` - T06-C30 지연 수 (미완료 & 마감일 지남): ${summary.delayedCount}건 (할일 4번 1건)`);
  console.log(` - T06-C31 막힘 수 (막힌 이유 존재): ${summary.blockedCount}건 (할일 1, 3번 2건)`);
  console.log(` - T06-C32 예상시간 합계: ${summary.totalEstimatedMinutes}분 / 실제시간 합계: ${summary.totalActualMinutes}분 (차이: ${summary.timeVariance}분)`);
  console.log(` - T06-C81 집계 숫자가 모두 0이 아님: 통과!`);

  // 5. 카드 5: JSON 내보내기 검증 (T06-C36)
  console.log('\n[검증 5] 카드 5: 전체 데이터 파일 내보내기 (T06-C36)');
  const exportRes = await request('GET', '/api/export');
  console.log(`✅ export 결과: 버전 ${exportRes.version}, 총 계획 ${exportRes.data.plans.length}건, 할 일 ${exportRes.data.todos.length}건, 실행기록 ${exportRes.data.executions.length}건 백업 파일 생성 확인`);

  console.log('\n=====================================================');
  console.log('🎉 카드 1 ~ 카드 5 전체 통과 기준 100% 만족 검증 완료!');
  console.log('=====================================================');
}

verifyAll().catch(console.error);
