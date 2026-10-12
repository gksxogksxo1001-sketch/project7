const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const apiRouter = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 프론트엔드 정적 파일 서빙 (public 하위 html, css, js 폴더 분리 지원)
app.use(express.static(path.join(__dirname, '..', 'public')));

// 기본 루트 접속 시 index.html 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'index.html'));
});

// REST API 라우터
app.use('/api', apiRouter);

// DB 초기화 후 서버 시작
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 플랜두씨 다이어리 서버가 실행되었습니다!`);
      console.log(`📡 포트: http://localhost:${PORT}`);
      console.log(`📄 대시보드 URL: http://localhost:${PORT}/html/index.html`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('서버 기동 중 오류 발생:', err);
    process.exit(1);
  }
}

startServer();
