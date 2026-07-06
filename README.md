<p align="center">
  <img src="./assets/brand/favicon.png" alt="MyOwn" width="120" />
</p>

<h1 align="center">MyOwn</h1>

<p align="center">The easiest way to add your work schedule and get reminders! No downloads needed, just use the apps you already use.</p>

## 기능

### 메신저

- **Telegram**: grammY 봇, 웹 **연동 APP**에서 계정 연결, 첨부 분석, 인라인 버튼 알림
- **KakaoTalk** (선택, `KAKAO_CHANNEL_URL` 설정 시): 오픈빌더 스킬로 업무 등록·조회 · 알림 발송은 Telegram 우선

### 웹 대시보드 (`https://powers-addresses-cubic-magnificent.trycloudflare.com`)

- **Google 로그인** · 이메일 전용 초대코드 (클로즈드 베타)
- **업무 현황** — 금일 마감·진행 중 요약, 월/주 캘린더, D-DAY 알림 기본값 설정
- **등록 업무 목록** — 진행/완료/전체 필터, 정렬, 웹에서 등록·수정·완료·삭제
- **연동 APP** — Telegram · KakaoTalk · **Google Calendar** (일정 가져오기 → 선택 활성화)
- 접이식 사이드바(아이콘 모드), **라이트·다크 모드**
- **관리자** (`/admin`) — 사용자·초대코드·로그인 기록

### 업무·알림·AI (Telegram·웹·카카오 공통 DB)

- 업무 등록 · 목록 · 오늘 마감 · 완료
- 마감일·시각 리마인더 (D-3, D-1, 당일 09:00, 시각 마감 시 1시간 전)
- 추가 알림 (`/remind`, `N분 후`, `내일 N시에 알려줘`)
- 인라인 버튼: 완료, 1시간 후, 상세 (Telegram)
- 첨부파일 분석 (HWP, HWPX, PDF, DOCX, 이미지) → 업무 자동 추출 (Telegram)
- OpenAI / Ollama 연동 시 자연어 처리

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
| `WEB_APP_URL` | 웹 앱 URL (기본 `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5173/api/auth/google/callback` |
| `GOOGLE_CALENDAR_REDIRECT_URI` | (선택) Calendar OAuth callback — 기본 `{WEB_APP_URL}/api/integrations/google-calendar/callback` |
| `ADMIN_EMAILS` | 관리자 Google 이메일. 초대코드 없이 가입·`/admin` |
| `WEB_API_PORT` | API 포트 (기본 `4000`) |
| `KAKAO_CHANNEL_URL` | (선택) 카카오톡 채널 URL — 설정 시 KakaoTalk 연동 활성화 |
| `KAKAO_BOT_NAME` | (선택) 오픈빌더 봇 이름 (기본 `MyOwn`) |

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

### 5. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → 사용자 인증 정보
2. **OAuth 2.0 클라이언트 ID** (웹 애플리케이션) 생성
3. **승인된 리디렉션 URI**: `http://localhost:5173/api/auth/google/callback`
4. `.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 입력

### 6. 관리자·베타 가입

1. `.env`에 `ADMIN_EMAILS=본인@gmail.com` (Google 계정 이메일)
2. `http://localhost:5173/signup` → **초대코드 없이 Google 가입** (관리자)
3. 사이드바 **관리자** → **초대코드**에서 `user@example.com` 전용 코드 발급
4. 지인에게 가입 링크 전달 → 초대코드 입력 → **해당 Google 계정**으로만 가입 가능

### 7. Telegram 연동

1. 로그인 후 대시보드 (`http://localhost:5173`) → **연동 APP**
2. **Telegram 연결** → 열리는 봇에서 **시작(Start)**
3. 웹에「연결됨」이 보이면 봇 사용 가능 (ID 조회·`.env` 수정 불필요)

### 7.1 KakaoTalk 연동 (선택, 오픈빌더)

텔레그램과 별도로 카카오톡 채널에서 업무 등록·조회가 가능합니다. 기존 가입자·데이터는 그대로 유지됩니다.

#### 사전 준비

1. [카카오톡 채널](https://center-pf.kakao.com/) 개설 → 채널 URL 복사 (`https://pf.kakao.com/_xxxxx`)
2. [카카오 i 오픈빌더](https://i.kakao.com/) → 봇 생성 → **운영 채널 연결**
3. 오픈빌더 **스킬** 생성 → URL:

```text
{WEB_APP_URL}/api/kakao/skill
```

(로컬 베타: Cloudflare Tunnel URL + `/api/kakao/skill`)

4. 폴백 블록(기본 응답)의 봇 응답을 **위 스킬**로 연결
5. `.env` 설정:

```env
KAKAO_CHANNEL_URL=https://pf.kakao.com/_xxxxx
KAKAO_BOT_NAME=MyOwn
```

6. `pnpm dev` 재시작

#### 사용자 연동 절차

1. 웹 **연동 APP** → **카카오 연결**
2. 열리는 채널에서 **채널 추가** 후 채팅 열기
3. 화면에 나온 `연결 link_xxxx` 문구를 채팅에 붙여넣기
4. 웹에「연결됨」 표시되면 사용 가능

#### 카카오에서 쓸 수 있는 명령

| 입력 | 동작 |
|------|------|
| `목록` | 활성 업무 |
| `오늘` | 오늘 마감 |
| `완료 1` | 1번 완료 |
| `추가 보고서 2026-06-15 14:00` | 업무 등록 |
| `알림 1 5분` | 추가 알림 |
| 자연어 | LLM 설정 시 (텔레그램과 동일) |

> **알림 발송**은 현재 Telegram 우선입니다. 카카오만 연동한 경우 업무 등록·조회는 되고, 푸시 알림은 Telegram 연동 후 발송됩니다.

### 7.2 Google Calendar 연동 (선택)

Google Calendar 일정을 **가져온 뒤**, 원하는 항목만 MyOwn 업무로 **활성화**합니다. 새로 가져온 일정은 기본 **비활성**입니다.

#### 사전 준비

1. [Google Cloud Console](https://console.cloud.google.com/) → **Google Calendar API** 사용 설정
2. OAuth 클라이언트 → **승인된 리디렉션 URI**에 추가:

```text
{WEB_APP_URL}/api/integrations/google-calendar/callback
```

3. `pnpm db:push` (신규 테이블 반영)
4. `pnpm dev` 재시작

#### 사용 방법

1. 웹 **연동 APP** → **Google Calendar** → **연결**
2. **일정 가져오기** — 기본 지난 7일 ~ 앞으로 90일 (연동 APP에서 **과거/앞으로 일수** 조정 가능)
3. 목록에서 **활성** 체크 또는 「선택 항목 활성화」→ MyOwn 업무·달력에 반영
4. 비활성화하면 연결된 업무는 취소 처리

### 8. 사용자에게 공유 (Cloudflare Tunnel, 무료)

**임시 공개 URL**로 접속합니다. 모든 설명들은 이 깃을 클론하여 본인을 관리자로, 서비스를 새로 운영하고 싶을 때 해당합니다. 만약, 셀프 호스팅(LLM, DB 모두 로컬에서 가동)을 원하시면 커밋ID: 5b9358734c11883651cd5f5b702ab41fe36b3752 로 사용하시면 됩니다. 단, 연구개발 부분은 반영되어 있지 않습니다.

#### 8.1 cloudflared 설치 (최초 1회)

```bash
winget install Cloudflare.cloudflared
```

#### 8.2 실행 (터미널 2개)

```bash
# 터미널 1
pnpm dev

# 터미널 2
pnpm tunnel
```

`pnpm tunnel` 출력에 `https://xxxx.trycloudflare.com` 같은 주소가 나옵니다. **이 URL을 복사**합니다.

#### 8.3 `.env` 수정 후 gateway 재시작

터널 URL을 `https://YOUR-TUNNEL.trycloudflare.com` 라고 할 때:

```env
WEB_APP_URL=https://YOUR-TUNNEL.trycloudflare.com
WEB_CORS_ORIGIN=https://YOUR-TUNNEL.trycloudflare.com
GOOGLE_REDIRECT_URI=https://YOUR-TUNNEL.trycloudflare.com/api/auth/google/callback
```

`pnpm dev`를 **한 번 재시작**합니다.

> 터널을 끄고 다시 켜면 URL이 **바뀝니다**. 바뀔 때마다 위 3줄 + Google Console URI를 다시 맞춰 주세요.

#### 8.4 Google Cloud Console

[사용자 인증 정보](https://console.cloud.google.com/apis/credentials) → OAuth 클라이언트 → **승인된 리디렉션 URI**에 **추가**:

```text
https://YOUR-TUNNEL.trycloudflare.com/api/auth/google/callback
```

(`localhost` URI는 그대로 두어도 됩니다.)

#### 8.5 사용자에게 줄 것

1. 터널 URL (`https://YOUR-TUNNEL.trycloudflare.com`)
2. **관리자** → 초대코드 발급 (사용자 Gmail 전용)
3. Google OAuth가 **Testing**이면 사용자 Gmail을 **Test users**에 등록
4. 가입 링크: `https://YOUR-TUNNEL.trycloudflare.com/signup?code=MYOWN-XXXX`

Telegram 봇은 내 PC의 gateway가 돌아가면 사용자도 같은 봇을 쓸 수 있습니다.

## 명령어

| 명령 | 설명 |
|------|------|
| `/start`, `/help` | 도움말 |
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
│   ├── gateway/           # Telegram·Kakao 스킬, REST API, Reminder Worker, Agent
│   │   └── src/api/       # 웹 대시보드용 HTTP API
│   └── web/               # React 대시보드 (Vite, Tailwind)
├── packages/database/     # Drizzle ORM (users, tasks, channel_connections, …)
├── services/hwp-parser/   # HWP 파서 (Python)
├── docs/FEATURES.md       # 기능설명서
└── docker-compose.yml
```

자세한 설계·로드맵은 [docs/FEATURES.md](./docs/FEATURES.md)를 참고하세요.
