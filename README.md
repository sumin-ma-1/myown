<p align="center">
  <img src="./assets/brand/favicon.png" alt="MyOwn" width="120" />
</p>

<h1 align="center">MyOwn</h1>

<p align="center">개인 일정·업무를 기억하고 텔레그램으로 알려주는 업무 관리 AI 개인 비서</p>

## 기능

- 텔레그램 봇 (grammY), 화이트리스트 기반 1인 사용
- 업무 등록 · 목록 · 오늘 마감 · 완료
- 마감일·시각 리마인더 (D-3, D-1, 당일 09:00, 시각 마감 시 1시간 전)
- 추가 알림 (`/remind`, `N분 후`, `내일 N시에 알려줘`)
- 인라인 버튼: 완료, 1시간 후, 상세
- 첨부파일 분석 (HWP, HWPX, PDF, DOCX, 이미지) → 업무 자동 추출
- OpenAI / Ollama 연동 시 자연어 처리
- **웹 대시보드** — 메인 화면, 업무 목록, 달력, D-DAY 설정 (텔레그램과 동일 DB)

## 사전 요구사항

- Node.js 20+
- pnpm 9+
- Docker (PostgreSQL, Redis, hwp-parser)

## 빠른 시작

### 1. 인프라

```bash
docker compose up -d
```

PostgreSQL은 호스트 포트 **5433**을 사용합니다 (Windows 5432 충돌 회피).

### 2. 환경 변수

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather)에서 발급 |
| `ALLOWED_TELEGRAM_USER_IDS` | (선택) 추가 허용 ID. 비우면 웹 **연동 APP**에서 Telegram 연결 |
| `DATABASE_URL` | 기본 `postgresql://myown:myown@localhost:5433/myown` |
| `REDIS_URL` | 기본 `redis://localhost:6379` |
| `LLM_BASE_URL` | (선택) Ollama 등 OpenAI 호환 API |
| `OPENAI_API_KEY` | (선택) OpenAI 또는 Ollama용 더미 값 |
| `LLM_MODEL` | 사용할 모델명 |
| `WEB_API_TOKEN` | 웹 대시보드 API 토큰 (`.env`와 `apps/web/.env` 동일 값) |
| `WEB_API_PORT` | API 포트 (기본 `4000`) |

웹 대시보드용 환경 변수:

```bash
cp apps/web/.env.example apps/web/.env
```

`apps/web/.env`의 `VITE_API_TOKEN`은 루트 `.env`의 `WEB_API_TOKEN`과 같아야 합니다.

### 3. 설치 및 DB

```bash
pnpm install
pnpm db:push
```

### 4. 실행

```bash
pnpm dev
```

- **텔레그램 봇** + **Web API** (`http://localhost:4000`) + **대시보드** (`http://localhost:5173`)
- 봇만 실행: `pnpm dev:bot`
- 웹만 실행: `pnpm dev:web` (API는 gateway가 떠 있어야 함)

### 5. Telegram 연동

1. 대시보드 (`http://localhost:5173`) → **연동 APP**
2. **Telegram 연결** → 열리는 봇에서 **시작(Start)**
3. 웹에「연결됨」이 보이면 봇 사용 가능 (ID 조회·`.env` 수정 불필요)

## 명령어

| 명령 | 설명 |
|------|------|
| `/start` | 도움말 |
| `/list` | 활성 업무 목록 |
| `/today` | 오늘 마감 업무 |
| `/add 제목 [YYYY-MM-DD] [HH:MM]` | 업무 등록 (`HH:MM` = 그때까지 마감) |
| `/remind 번호 5분` | N분 후 알림 |
| `/remind 번호 [날짜] HH:MM` | 지정 시각 알림 |
| `/done 번호` | 업무 완료 |

자연어 (LLM 설정 시): `3번 완료했어`, `내일까지 보고서 작성해줘`, `1번 10분 후에 알려줘`

## 첨부파일

텔레그램에 문서·이미지를 첨부하면 텍스트를 추출하고, LLM이 업무를 자동 등록합니다. 캡션으로 메모를 남기면 분석에 반영됩니다.

| 형식 | 처리 |
|------|------|
| `.hwp` | `hwp-parser` sidecar (Docker, `pyhwp`) |
| `.hwpx` | ZIP + XML (gateway) |
| `.pdf` | pdf-parse |
| `.docx` | mammoth |
| 이미지 | LLM Vision |

| 환경 변수 | 기본값 |
|-----------|--------|
| `HWP_PARSER_URL` | `http://localhost:8100` |
| `ATTACHMENT_MAX_MB` | `20` |

원본은 `data/attachments/`에 저장됩니다 (git 제외). 메타데이터는 DB `attachments` 테이블에 기록됩니다.

## 프로젝트 구조

```
myown/
├── apps/
│   ├── gateway/           # Telegram 봇, REST API, Reminder Worker
│   │   └── src/api/       # 웹 대시보드용 HTTP API
│   └── web/               # React 대시보드 (Vite)
├── packages/database/     # Drizzle ORM
├── services/hwp-parser/   # HWP 파서 (Python)
├── docs/FEATURES.md       # 기능설명서
└── docker-compose.yml
```

자세한 설계·로드맵은 [docs/FEATURES.md](./docs/FEATURES.md)를 참고하세요.
