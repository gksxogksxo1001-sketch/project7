/**
 * HTTP 레벨 E2E 인증 & 로그아웃 후 거절(401) 검증 스크립트
 */
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { initDb } = require('./server/db');
const apiRouter = require('./server/api');

async function runHttpTest() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(session({
    name: 'plandosee.sid',
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 }
  }));
  app.use('/api', apiRouter);

  await initDb();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`\n📡 테스트 서버 기동 완료: ${baseUrl}`);

  try {
    // 1. 비로그인 상태에서 자료 조회 시 401 거절 확인
    console.log('\n▶ [시나리오 1] 비로그인 상태에서 GET /api/plans 요청');
    const resNoAuth = await fetch(`${baseUrl}/plans`);
    const dataNoAuth = await resNoAuth.json();
    console.log(` - 응답 상태 코드: ${resNoAuth.status} ${resNoAuth.statusText}`);
    console.log(' - 응답 바디:', dataNoAuth);
    if (resNoAuth.status === 401) {
      console.log(' ✅ 통과: 비로그인 요청 401 Unauthorized로 확실하게 거절됨');
    } else {
      console.log(' ❌ 실패: 401이 아님');
    }

    // 2. 아이디 실시간 중복 체크
    const validTestId = `user_${Date.now().toString().slice(-6)}`;
    console.log(`\n▶ [시나리오 2] 아이디 중복 체크 (GET /api/auth/check-username?username=${validTestId})`);
    const resCheck = await fetch(`${baseUrl}/auth/check-username?username=${validTestId}`);
    const dataCheck = await resCheck.json();
    console.log(' - 중복 체크 결과:', dataCheck);

    // 3. 회원가입 (이름, 생년월일, 성별, 전화번호, 주소)
    console.log('\n▶ [시나리오 3] 회원가입 (POST /api/auth/register)');
    const testUsername = validTestId;
    const registerPayload = {
      username: testUsername,
      password: 'password1234!',
      name: '홍길동',
      birthdate: '1990-01-01',
      gender: '남성',
      phone: '010-1111-2222',
      address: '서울시 종로구 세종대로 1'
    };

    const resReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload)
    });
    const dataReg = await resReg.json();
    console.log(` - 가입 상태 코드: ${resReg.status}`);
    console.log(' - 가입 응답:', dataReg);

    // 쿠키 추출
    const setCookie = resReg.headers.get('set-cookie');
    const sessionCookie = setCookie ? setCookie.split(';')[0] : '';
    console.log(' - 발급된 세션 쿠키 (마스킹):', sessionCookie.substring(0, 20) + '... (가려짐)');

    // 4. 가입된 세션 쿠키로 자료 조회
    console.log('\n▶ [시나리오 4] 세션 쿠키로 GET /api/plans 요청');
    const resAuthPlans = await fetch(`${baseUrl}/plans`, {
      headers: { 'Cookie': sessionCookie }
    });
    console.log(` - 로그인 상태 조회 코드: ${resAuthPlans.status}`);
    const dataAuthPlans = await resAuthPlans.json();
    console.log(' - 내 계획 목록:', dataAuthPlans.data);

    // 5. 로그아웃 (체크리스트 3: 로그아웃 뒤 같은 값으로 다시 요청하면 거절됩니다)
    console.log('\n▶ [시나리오 5] 로그아웃 (POST /api/auth/logout)');
    const resLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
    const dataLogout = await resLogout.json();
    console.log(` - 로그아웃 코드: ${resLogout.status}`, dataLogout);

    // 6. 로그아웃 후 '이전 세션 쿠키'로 다시 요청 시 401 거절 확인
    console.log('\n▶ [시나리오 6] 로그아웃 후 같은 세션 쿠키로 다시 GET /api/plans 요청');
    const resAfterLogout = await fetch(`${baseUrl}/plans`, {
      headers: { 'Cookie': sessionCookie }
    });
    const dataAfterLogout = await resAfterLogout.json();
    console.log(` - 응답 상태 코드: ${resAfterLogout.status} ${resAfterLogout.statusText}`);
    console.log(' - 응답 바디:', dataAfterLogout);
    if (resAfterLogout.status === 401) {
      console.log(' ✅ 체크리스트 3 완벽 충족: 로그아웃 후 이전 세션 값으로 요청 시 401 Unauthorized 거절!');
    } else {
      console.log(' ❌ 거절되지 않음!');
    }

  } finally {
    server.close();
    console.log('\n📡 테스트 서버 정상 종료');
  }
}

runHttpTest().catch(console.error);
