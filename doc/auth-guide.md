# 🔒 과제 7: 플랜두씨 다이어리 2 — 인증 구현 설명서 및 거절 검증 증거

> **과제 7 핵심 목표**: 6번에서 만든 다이어리에 가입·로그인을 붙여 내 자료를 나만 보게 만들고, 로그아웃 및 타인 자료 침범 시 실제로 막히는 장면(요청과 응답)을 증명하며, 5일간 잠긴 앱을 쓰면서 규칙을 개선합니다.

---

## 📋 인증 구현 설명서 (6대 필수 항목)

### ① 무엇으로 붙였나
- **인증 방식**: 서버 사이드 세션(`express-session` v1.18.1) 기반 쿠키 인증 + 단방향 솔트 해싱(`bcryptjs` v3.0.3).
- **데이터베이스**: SQLite `users` 테이블 신규 구축 및 기존 테이블(`plans`, `plan_histories`, `todos`, `executions`, `reflections`)에 `user_id` 외래키 추가.

### ② 왜 그걸 골랐나
- 브라우저의 LocalStorage에 JWT를 보관하는 방식은 XSS 스크립트에 의해 토큰이 쉽게 탈취될 수 있습니다.
- 반면 `httpOnly`, `sameSite: 'lax'`가 적용된 서버 세션 쿠키는 브라우저 자바스크립트에서 직접 읽을 수 없어 안전하며, **로그아웃 즉시 서버 세션 저장소(`req.session.destroy`)에서 완전히 파괴**되어 과제 체크리스트 요건(로그아웃 뒤 같은 값으로 재요청 시 거절)을 가장 확실하고 원자적으로 방어할 수 있기 때문입니다.

### ③ 어디를 어떻게 고쳤나 (흐름별 소스 위치)
1. **가입 흐름 (`T07-C128`)**:
   - `public/js/app.js` (`handleRegister`) ➔ `server/api.js` (`POST /api/auth/register`, 라인 70~120) ➔ `server/db.js` (`INSERT INTO users` & `migrateLegacyDataToUser`)
2. **로그인 및 세션 발급 흐름 (`T07-C128`)**:
   - `public/js/app.js` (`handleLogin`) ➔ `server/api.js` (`POST /api/auth/login`, `bcrypt.compare`, 라인 122~165) ➔ `server/server.js` (`express-session` 쿠키 발급, 라인 20~35)
3. **로그아웃 및 세션 파괴 흐름 (`T07-C128`)**:
   - `public/js/app.js` (`handleLogout`) ➔ `server/api.js` (`POST /api/auth/logout`, `req.session.destroy`, 라인 167~185) ➔ 세션 파괴 및 로그인 화면 전환
4. **자료 조회 및 소유권 격리 흐름 (`T07-C128`)**:
   - `server/api.js` (`requireAuth` 미들웨어: 라인 9~18, 비인가 시 401 반환)
   - `server/api.js` (`router.get('/plans')`, `router.get('/todos')` 등: `WHERE user_id = req.session.userId` 바인딩)
   - `server/api.js` (`router.get('/plans/:id')`, `PUT`, `DELETE`: `current.user_id !== userId` 시 403 Forbidden 반환)
5. **계정 삭제(회원 탈퇴) 흐름 (`T07-C134`)**:
   - `public/js/app.js` (`handleDeleteAccount`) ➔ `server/api.js` (`DELETE /api/auth/account`, 라인 205~235) ➔ 유저 및 연결된 모든 데이터 일괄 영구 삭제

---

### ④ 안 열리는 것을 확인한 기록 (실제 막히는 요청·응답 5대 장면)

#### [장면 1] 비로그인 상태에서 자료 조회 시 401 거절 (`T07-C124`)
- **요청**: `GET /api/plans` (인증 쿠키 없음)
- **응답 (HTTP 401 Unauthorized)**:
  ```json
  {
    "success": false,
    "code": "UNAUTHORIZED",
    "message": "로그인이 필요합니다. 로그인 후 이용해주세요."
  }
  ```

#### [장면 2] 로그아웃 뒤 이전 세션 쿠키로 재요청 시 401 거절 (`T07-C109`, `C110`)
- **요청**: `GET /api/plans` (로그아웃된 쿠키: `plandosee.sid=s%3AUR... (가려짐)`)
- **응답 (HTTP 401 Unauthorized)**:
  ```json
  {
    "success": false,
    "code": "UNAUTHORIZED",
    "message": "로그인이 필요합니다. 로그인 후 이용해주세요."
  }
  ```

#### [장면 3] 사용자 A가 사용자 B의 계획 읽기 시 403 거절 (`T07-C117`)
- **요청**: `GET /api/plans/6` (사용자 A 세션 쿠키)
- **응답 (HTTP 403 Forbidden)**:
  ```json
  {
    "success": false,
    "code": "FORBIDDEN",
    "message": "해당 계획에 접근할 수 있는 권한이 없습니다."
  }
  ```

#### [장면 4] 사용자 A가 사용자 B의 계획 수정 시 403 거절 (`T07-C118`)
- **요청**: `PUT /api/plans/6` (사용자 A 세션 쿠키)
- **응답 (HTTP 403 Forbidden)**:
  ```json
  {
    "success": false,
    "code": "FORBIDDEN",
    "message": "해당 계획을 수정할 수 있는 권한이 없습니다."
  }
  ```

#### [장면 5] 사용자 A가 사용자 B의 계획 삭제 시 403 거절 (`T07-C119`)
- **요청**: `DELETE /api/plans/6` (사용자 A 세션 쿠키)
- **응답 (HTTP 403 Forbidden)**:
  ```json
  {
    "success": false,
    "code": "FORBIDDEN",
    "message": "해당 계획을 삭제할 수 있는 권한이 없습니다."
  }
  ```

---

### ⑤ AI와 나
- **AI에게 맡긴 일**: `bcryptjs`와 `express-session` 기반 인증 미들웨어 보일러플레이트 작성, SQLite 테이블 `user_id` 자동 마이그레이션 스크립트 작성, E2E 카드 4 양방향 침범 거절 테스트 스크립트(`test-card4-cross-auth.js`) 작성.
- **내가 직접 판단한 일**: 회원가입 시 아이디 중복 확인과 비밀번호 1차/2차 확인을 별도 버튼 없이 타이핑 시 실시간(동적 반응)으로 피드백하도록 UX를 설계하고, 개인정보 필드(이름, 생년월일, 성별, 전화번호, 주소)를 필수 항목으로 확정.
- **AI 제안을 따르지 않은 일**: JWT 토큰을 브라우저에 저장하자는 일반적인 제안 대신, 로그아웃 시 즉시 무효화가 확실하고 XSS에 안전한 서버 사이드 세션 쿠키 방식을 고수하여 체크리스트 3을 빈틈없이 방어함.

---

### ⑥ 아직 못 막은 것 (솔직한 기술적 한계 및 남은 과제, `T07-C130`)
- **무차별 대입(Brute-Force) 공격 완화**: 로그인 실패가 연속으로 N회 이상 발생할 때 계정을 일시 잠그거나 IP 요청 횟수를 제한하는 Rate Limiting(`express-rate-limit`)이 현재 미적용되어 있음. 이로 인해 자동화된 봇이 임의의 비밀번호를 무한 반복 대입할 위험이 남아있음.
- **동일 브라우저 멀티탭 다중 로그인 충돌**: 같은 브라우저에서 다른 탭으로 다른 계정으로 로그인할 경우, 단일 쿠키가 덮어씌워져 이전 탭의 세션이 새 계정으로 교체되는 현상 (단일 도메인 쿠키의 특성).
- **실명 인증(SMS/본인인증) 부재**: 전화번호와 주소의 정규식 검증은 클라이언트 기본 수준이며, 실제 존재하는 번호인지 확인하는 통신사 SMS 본인확인은 연결되어 있지 않음.

---

## 📅 5일 실사용 관찰 지표 및 규칙 변경 계획 (`T07-C04` ~ `C27`)

1. **관찰 질문**: *"내 하루 계획 시간은 실제 실행 시간과 얼마나 차이가 나며, 어떤 원인으로 지연되는가?"*
2. **관찰 지표**: **계획 시간 오차 (Time Variance = 실제 소요 시간 - 예상 소요 시간)**
3. **지표 단위**: **분 (Minutes)**
4. **계산 규칙**: `actual_minutes - estimated_minutes`
5. **예외 처리 기준**:
   - `값이 빠졌을 때`: 실행 기록이 없는 미완료 항목은 오차 계산에서 제외하고 0분 처리.
   - `값이 중복될 때`: `UNIQUE(todo_id)` 제약으로 최초 1회 완료만 인정.
   - `값이 유난히 튈 때`: 1일 1,440분(24시간) 초과 입력 시 400 Bad Request 방어.
   - `반올림`: 소수점 발생 시 `Math.round()`로 정수 분 반올림.
   - `주 시작 요일`: 월요일(Monday).
6. **계획 규칙 변경 내역 (2일차 뒤 3일차 앞)**:
   - **기존 규칙 (1~2일차)**: 할 일당 60분 내외로 타이트하게 예상 시간 산정.
   - **문제점 파악**: 예상치 못한 방해 요인(버그 디버깅, 긴급 대응)으로 인해 하루 평균 50~80분의 시간 초과(지연) 발생.
   - **변경 일시**: 2026-10-14 23:00 (2일차 종료 직후, 3일차 시작 전).
   - **새로운 규칙 (3~5일차)**: "모든 할 일 등록 시 예상 시간에 20%의 버퍼 시간(최소 +15분)을 의무적으로 가산한다."
   - **규칙 변경 효과**: 3일차부터 계획 시간 오차가 0분에 가깝게 수렴하며 계획 적중률 대폭 개선.
