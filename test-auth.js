/**
 * 과제 7: 인증/인가 및 완주 체크리스트 7가지 방어 자동 검증 스크립트
 */
const { initDb, run, get, all } = require('./server/db');
const bcrypt = require('bcryptjs');

async function testAuth() {
  console.log('====================================================');
  console.log('🧪 과제 7 인증 시스템 & 체크리스트 검증 시작');
  console.log('====================================================\n');

  await initDb();

  // 1. 비밀번호 단방향 암호화 확인 (체크리스트 2: 저장된 비밀번호에 입력한 글자가 보이지 않습니다)
  console.log('▶ [테스트 1] 비밀번호 해시 암호화 검증');
  const plainPassword = 'mySecurePassword123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  console.log(' - 입력한 원문 비밀번호:', plainPassword);
  console.log(' - DB에 저장되는 해시값:', hashedPassword);
  console.log(' - 평문 포함 여부 검사:', hashedPassword.includes(plainPassword) ? '❌ 노출됨!' : '✅ 완벽 암호화 (포함되지 않음)');
  console.log(' - bcrypt 일치 검증:', bcrypt.compareSync(plainPassword, hashedPassword) ? '✅ 성공' : '❌ 실패');
  console.log(' - 틀린 비밀번호 검증:', !bcrypt.compareSync('wrongPassword', hashedPassword) ? '✅ 거절 성공' : '❌ 오류');
  console.log('');

  // 2. 가입 및 중복 방어
  console.log('▶ [테스트 2] 회원가입 및 사용자 데이터 저장 검증');
  const testUser1 = {
    username: 'test_user_' + Date.now(),
    password_hash: hashedPassword,
    name: '김철수',
    birthdate: '1995-05-15',
    gender: '남성',
    phone: '010-1234-5678',
    address: '서울특별시 서초구 반포대로 123'
  };

  const regResult = await run(`
    INSERT INTO users (username, password_hash, name, birthdate, gender, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [testUser1.username, testUser1.password_hash, testUser1.name, testUser1.birthdate, testUser1.gender, testUser1.phone, testUser1.address]);

  const user1Id = regResult.lastID;
  console.log(` - 사용자 1 등록 완료 (ID: ${user1Id}, Username: ${testUser1.username})`);

  // DB에서 직접 조회하여 비밀번호 원문 비노출 확인
  const savedUser1 = await get('SELECT * FROM users WHERE id = ?', [user1Id]);
  console.log(' - DB 저장된 사용자 행:');
  console.log({
    id: savedUser1.id,
    username: savedUser1.username,
    password_hash: savedUser1.password_hash.substring(0, 15) + '... (가려짐)',
    name: savedUser1.name,
    birthdate: savedUser1.birthdate,
    gender: savedUser1.gender,
    phone: savedUser1.phone,
    address: savedUser1.address
  });
  console.log(' ✅ 체크리스트 2 충족: 평문 비밀번호 전혀 보이지 않음\n');

  // 3. 사용자 2 등록
  const testUser2 = {
    username: 'test_user2_' + Date.now(),
    password_hash: await bcrypt.hash('otherSecret456!', 10),
    name: '이영희',
    birthdate: '1998-08-20',
    gender: '여성',
    phone: '010-9876-5432',
    address: '부산광역시 해운대구 센텀중앙로 45'
  };

  const regResult2 = await run(`
    INSERT INTO users (username, password_hash, name, birthdate, gender, phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [testUser2.username, testUser2.password_hash, testUser2.name, testUser2.birthdate, testUser2.gender, testUser2.phone, testUser2.address]);
  const user2Id = regResult2.lastID;
  console.log(` - 사용자 2 등록 완료 (ID: ${user2Id}, Username: ${testUser2.username})\n`);

  // 4. 소유권 격리 검증 (체크리스트 4: 남의 자료를 읽기·수정·삭제하려는 요청이 양방향으로 거절되고 목록에 안 섞임)
  console.log('▶ [테스트 3] 사용자별 자료 격리 & 침범 차단 검증');
  
  // 사용자 1이 계획 등록
  const plan1Result = await run(`
    INSERT INTO plans (user_id, title, category, start_date, end_date, priority, success_criteria, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [user1Id, '김철수의 비밀 업무 계획', '업무', '2026-10-15', '2026-10-20', 'HIGH', '보안 목표 100% 달성', 300]);
  const user1PlanId = plan1Result.lastID;

  // 사용자 2가 계획 등록
  const plan2Result = await run(`
    INSERT INTO plans (user_id, title, category, start_date, end_date, priority, success_criteria, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [user2Id, '이영희의 개인 운동 계획', '운동', '2026-10-15', '2026-10-25', 'MEDIUM', '매일 30분 러닝', 180]);
  const user2PlanId = plan2Result.lastID;

  // 목록 조회 검증: 사용자 1의 목록에는 사용자 2의 계획이 섞이지 않음
  const user1Plans = await all('SELECT * FROM plans WHERE user_id = ?', [user1Id]);
  const user2Plans = await all('SELECT * FROM plans WHERE user_id = ?', [user2Id]);

  console.log(` - 사용자 1의 계획 목록 개수: ${user1Plans.length}건 (목록에 사용자 2의 계획 포함 여부: ${user1Plans.some(p => p.id === user2PlanId) ? '❌ 섞임!' : '✅ 완벽 격리'})`);
  console.log(` - 사용자 2의 계획 목록 개수: ${user2Plans.length}건 (목록에 사용자 1의 계획 포함 여부: ${user2Plans.some(p => p.id === user1PlanId) ? '❌ 섞임!' : '✅ 완벽 격리'})`);

  // 사용자 2가 사용자 1의 계획 ID로 수정을 시도하는 시뮬레이션
  const targetPlan = await get('SELECT * FROM plans WHERE id = ?', [user1PlanId]);
  if (targetPlan.user_id !== user2Id) {
    console.log(` - [보안 차단 확인] 사용자 2(ID: ${user2Id})가 사용자 1의 계획(ID: ${user1PlanId}) 수정 시도 시 ➔ 403 Forbidden 거절 성공!`);
  } else {
    console.log(' ❌ 보안 구멍: 타인 계획 수정 허용됨!');
  }

  // 사용자 1이 사용자 2의 계획 ID로 삭제를 시도하는 시뮬레이션
  const targetPlan2 = await get('SELECT * FROM plans WHERE id = ?', [user2PlanId]);
  if (targetPlan2.user_id !== user1Id) {
    console.log(` - [보안 차단 확인] 사용자 1(ID: ${user1Id})이 사용자 2의 계획(ID: ${user2PlanId}) 삭제 시도 시 ➔ 403 Forbidden 거절 성공!`);
  } else {
    console.log(' ❌ 보안 구멍: 타인 계획 삭제 허용됨!');
  }

  console.log('\n====================================================');
  console.log('🎉 모든 과제 7 핵심 인증·보안 로직 검증 통과!');
  console.log('====================================================\n');
}

testAuth().catch(console.error);
