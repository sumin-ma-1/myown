<p align="center">
  <img src="../assets/brand/favicon.png" alt="MyOwn" width="120" />
</p>

<h1 align="center">MyOwn, 개인 업무 관리 AI 기능설명서</h1>

<p align="center"><em>Phase 1~2.5 구현 · Phase 3~4 계획</em></p>

> **서비스명:** MyOwn  
> **한 줄 요약:** 개인 일정/업무/첨부 문서를 기억하고, 웹/텔레그램/카카오톡으로 관리하며, 마감에 맞춰 알려주는 업무 관리 AI  
> **UI:** 웹 대시보드 + Telegram (+ KakaoTalk 선택)  
> **대상:** 클로즈드 베타,  Google 로그인·초대코드 기반 개인 사용

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [핵심 가치](#2-핵심-가치)
3. [기능 목록](#3-기능-목록)
4. [사용 시나리오](#4-사용-시나리오)
5. [텔레그램 사용자 경험](#5-텔레그램-사용자-경험)
6. [AI 에이전트 기능](#6-ai-에이전트-기능)
7. [첨부파일·문서 분석](#7-첨부파일문서-분석)
8. [기억(메모리) 시스템](#8-기억메모리-시스템)
9. [알림·리마인더](#9-알림리마인더)
10. [데이터·저장 구조](#10-데이터저장-구조)
11. [보안·접근 제어](#11-보안접근-제어)
12. [시스템 구성](#12-시스템-구성)
13. [환경 설정](#13-환경-설정)
14. [구현 현황](#14-구현-현황)
15. [제한 사항·알려진 이슈](#15-제한-사항알려진-이슈)

---

## 1. 서비스 개요

| 역할 | 설명 |
|------|------|
| **기억** | 일정, 업무, 메모, 첨부파일 내용을 구조화하여 장기 보관 |
| **이해** | HWP/PDF/이미지 등에서 "해야 할 일"을 자동 추출 |
| **알림** | 마감 임박·당일·사용자 지정 시각에 텔레그램으로 통지 (카카오는 등록·조회, 알림은 Telegram 우선) |
| **완료** | 완료 처리 시 활성 목록에서 제거하고 대기 중인 알림 취소 |

### 설계

- **DB:** 업무·일정은 PostgreSQL에 저장. LLM은 추출·대화·검색 보조.
- **로컬·자가 호스팅:** Docker로 DB/Redis를 로컬 또는 VPS에서 운영. LLM은 OpenAI·Ollama(원격 터널) 선택.

---

## 2. 핵심 가치

### 사용자에게 주는 것

1. **대화만으로 업무 관리** — "내일까지 보고서 작성해줘" 한 마디로 등록
2. **잊지 않게 알림** — D-3, D-1, 당일 자동 리마인더
3. **문서에서 할 일 추출** — HWP 공문 첨부 시 마감·업무 항목 자동 등록
4. **완료하면 깔끔하게 정리** — 완료 시 목록·알림에서 즉시 제거
5. **과거 기억 검색** — "지난달 그 공문 뭐였지?" 의미 검색 (Phase 3)

### 기존 도구와의 차이

| 항목 | 일반 리마인더 앱 | MyOwn |
|------|------------------|-------|
| 입력 | 수동 입력 위주 | 자연어 + 문서 첨부 + 웹 폼 |
| 문서 | 미지원 | HWP/PDF 등 분석 |
| AI | 없음 | 도구 호출 기반 에이전트 |
| UI | 전용 앱 | 웹 대시보드 + 이미 쓰는 Telegram·Kakao |

---

## 3. 기능 목록

### 3.1 업무(Task) 관리

| 기능 | 설명 | 상태 |
|------|------|------|
| 업무 등록 | 제목, 설명, 우선순위, 마감일·마감 시각 (텔레그램·웹·카카오) | ✅ |
| 마감 시각 | `/add 제목 YYYY-MM-DD HH:MM` (그때까지 마감) | ✅ |
| 업무 목록 | 활성 업무만 번호와 함께 표시 | ✅ |
| 오늘 마감 | 당일 마감 업무만 필터 | ✅ |
| 업무 완료 | 번호·제목·버튼으로 완료 처리 | ✅ |
| 완료 후 제거 | `completed` 상태로 전환, 활성 목록 제외 | ✅ |
| 우선순위 | low / medium / high / urgent | ✅ (DB·도구) |
| 업무 취소 | cancelled 상태 | 🔲 스키마만 |

### 3.2 일정(Event) 관리

| 기능 | 설명 | 상태 |
|------|------|------|
| 일정 등록 | 제목, 시작·종료, 장소 | 🔲 설계 완료 |
| 반복 일정 | 매주·매월 cron | 🔲 설계 완료 |
| 일정 알림 | 시작 전 리마인더 | 🔲 설계 완료 |

### 3.3 텔레그램 봇

| 기능 | 설명 | 상태 |
|------|------|------|
| Long Polling | 개발 환경 기본 | ✅ |
| Webhook | 프로덕션 HTTPS 배포 | ✅ (코드) |
| 사용자 화이트리스트 | `ALLOWED_TELEGRAM_USER_IDS` | ✅ |
| 인라인 버튼 | 완료 / 1시간 후 / 상세 | ✅ |
| 명령어 | `/start`, `/help`, `/list`, `/today`, `/add`, `/done`, `/remind` | ✅ |
| 첨부 수신 | document, photo → 문서 분석 | ✅ |
| 자연어 대화 | LLM 연동 시 | ✅ |
| 에러 안내 | DB·LLM 오류 시 사용자 메시지 | ✅ |

### 3.4 AI 에이전트

| 기능 | 설명 | 상태 |
|------|------|------|
| ReAct 루프 | LLM → 도구 호출 → 결과 반영 (최대 5회) | ✅ |
| Function Calling | create_task, complete_task, list_tasks 등 | ✅ |
| OpenAI API | 클라우드 모델 | ✅ |
| Ollama (원격 터널) | `LLM_BASE_URL` 로컬/SSH 터널 | ✅ |
| 응답 타임아웃 | 기본 120초 | ✅ |
| 대화 요약·장기 메모리 | L3 Semantic Memory | 🔲 Phase 3 |

### 3.5 첨부파일·문서

| 기능 | 설명 | 상태 |
|------|------|------|
| Telegram 파일 수신 | document, photo | ✅ |
| HWP 5.0 파싱 | pyhwp sidecar (`services/hwp-parser`) | ✅ |
| HWPX 파싱 | ZIP+XML (gateway) | ✅ |
| PDF / DOCX | pdf-parse, mammoth | ✅ |
| 이미지 OCR | LLM Vision | ✅ |
| LLM 할 일 추출 | 구조화 JSON → 업무 자동 등록 | ✅ |
| 첨부 ↔ 업무 연결 | `tasks.attachment_id` | ✅ |
| 원본 저장 | `data/attachments/` (로컬) | ✅ |
| S3/MinIO 저장 | 프로덕션 객체 스토리지 | 🔲 Phase 4 |
| `parse_attachment` 도구 | 에이전트가 첨부 재분석 | 🔲 |

### 3.6 메모리·검색

| 기능 | 설명 | 상태 |
|------|------|------|
| L1 Working Memory | 현재 대화 (Redis) | 🔲 Phase 3 |
| L2 Structured | tasks, attachments (PostgreSQL) | ✅ |
| L3 Semantic | PGVector 임베딩 검색 | 🔲 Phase 3 |
| `/search` 명령 | 키워드·의미 검색 | 🔲 Phase 3 |

### 3.7 알림·리마인더

| 기능 | 설명 | 상태 |
|------|------|------|
| D-3, D-1, 당일 09:00 | 마감일 기준 자동 예약 | ✅ |
| 시각 마감 1시간 전 | `due_at`에 시각이 있을 때 추가 알림 | ✅ |
| 사용자 지정 시각 | `/remind`, `N분 후`, `내일 N시에 알려줘` | ✅ |
| `create_reminder` 도구 | LLM function calling | ✅ |
| BullMQ 지연 큐 | Redis 기반 정확한 발송 | ✅ |
| 완료 시 알림 취소 | pending reminder 일괄 cancelled | ✅ |
| 1시간 후 (Snooze) | 인라인 버튼 | ✅ |
| 반복 알림 (cron) | 매주 월요일 등 | 🔲 Phase 4 |

### 3.8 웹 대시보드 (`apps/web`)

| 기능 | 설명 | 상태 |
|------|------|------|
| Google 로그인 | OAuth 2.0, 세션 쿠키 | ✅ |
| 초대코드 가입 | 이메일 전용 코드, 관리자 발급 | ✅ |
| 업무 현황 | 금일 마감·진행 중 요약, 월/주 캘린더 | ✅ |
| D-DAY 설정 | 사용자별 리마인더 기본값 (웹) | ✅ |
| 등록 업무 목록 | 필터(진행/완료/전체), 정렬, CRUD | ✅ |
| 업무 등록·수정 모달 | 마감일·시각, 우선순위, 알림 옵션 | ✅ |
| 연동 APP | Telegram · KakaoTalk · Google Calendar | ✅ |
| 접이식 사이드바 | 아이콘 전용 축소 모드 | ✅ |
| 라이트·다크 모드 | `localStorage` + `class` 기반 테마 | ✅ |
| 관리자 (`/admin`) | 사용자·초대코드·로그인 기록 | ✅ |
| 첨부 업로드 (웹) | — | 🔲 Telegram 전용 |

### 3.9 채널·캘린더 연동

| 기능 | 설명 | 상태 |
|------|------|------|
| Telegram 연결 | 웹에서 링크 토큰 → 봇 `/start` | ✅ |
| Telegram 화이트리스트 | `ALLOWED_TELEGRAM_USER_IDS` (선택) | ✅ |
| KakaoTalk 연결 | `KAKAO_CHANNEL_URL` + 오픈빌더 스킬 | ✅ |
| Kakao 스킬 명령 | 목록·오늘·완료·추가·알림·자연어 | ✅ |
| Kakao 알림 발송 | — | 🔲 Telegram 우선 |
| Google Calendar OAuth | 일정 가져오기 (과거/미래 일수 설정) | ✅ |
| 캘린더 이벤트 활성화 | 선택 항목만 MyOwn 업무로 반영 | ✅ |
| Slack 연동 | 카탈로그만 (준비 중) | 🔲 |

---

## 4. 사용 시나리오

### 시나리오 A: 텍스트로 업무 등록 (시각 마감)

```
사용자: /add 분기 보고서 작성 2026-06-20 14:00
봇:     ✅ 업무 등록: 1. 분기 보고서 작성 (마감: 2026. 06. 20. 14:00)
        → D-3, D-1, 6/20 09:00, 6/20 13:00(1시간 전) 알림 자동 예약
```

### 시나리오 B: 자연어 (LLM 연동)

```
사용자: 내일까지 회의 자료 준비해줘
봇:     (create_task 도구 호출)
        ✅ 2번 업무로 등록했습니다. 마감: 내일
```

### 시나리오 C: HWP 공문 첨부

```
사용자: [2026_실적보고_공문.hwp 첨부] 이거 처리해야 해
봇:     📎 문서 분석 중...
        📎 2026_실적보고_공문.hwp
        📝 2분기 실적 보고 관련 공문
        ✅ 3건의 업무를 등록했습니다:
        3. 분기 실적 보고서 제출 (2026. 06. 15.)
        4. 검토 의견 회신 (2026. 06. 18.)
        5. 최종본 제출 (2026. 06. 20.)
```

### 시나리오 C-2: 추가 알림

```
사용자: /remind 3 5분
봇:     ⏰ 3번 "분기 실적 보고서 제출" — 5분 후에 알려드릴게요.

사용자: 1번 내일 15시에 알려줘
봇:     ⏰ 1번 "..." — 2026. 06. 18. 15:00에 알려드릴게요.
```

### 시나리오 D: 리마인더 및 완료

```
봇:     🔔 마감 임박 (D-1)
        📌 분기 실적 보고서 제출
        📅 마감: 2026. 06. 15.
        [✅ 완료]  [⏰ 1시간 후]  [📋 상세]

사용자: [✅ 완료] 클릭
봇:     ✅ 분기 실적 보고서 제출 완료 처리했습니다.
        → 활성 목록 제거, 남은 알림 취소
```

### 시나리오 E: 과거 기억 검색 (Phase 3)

```
사용자: 지난달 실적보고 공문에서 뭐 해야 했지?
봇:     (PGVector 검색)
        2026_실적보고_공문.hwp 요약:
        - 6/15 보고서 제출, 6/20 최종본 제출 ...
```

### 시나리오 F: 웹에서 업무 관리

```
사용자: 대시보드 → 새 업무 등록 → "분기 보고서" 마감 6/20 14:00
웹:     목록·캘린더에 즉시 반영, D-DAY 알림 자동 예약
        Telegram 연동 시 동일 업무에 대해 봇 알림도 발송
```

### 시나리오 G: Google Calendar 가져오기

```
사용자: 연동 APP → Google Calendar 연결 → 일정 가져오기
웹:     가져온 일정 목록 (기본 비활성)
사용자: 회의 2건 "활성" 체크
웹:     MyOwn 업무·달력에 반영, 비활성화 시 연결 업무 취소
```

### 시나리오 H: KakaoTalk에서 조회

```
사용자: (채널 연결 후) 「목록」
봇:     활성 업무 번호·마감 표시 (웹·텔레그램과 동일 DB)
```

---

## 5. 텔레그램 UX

### 5.1 명령어

| 명령 | 기능 | 예시 |
|------|------|------|
| `/start`, `/help` | 도움말·온보딩 | `/start` |
| `/list` | 활성 업무 전체 | `/list` |
| `/today` | 오늘 마감 업무 | `/today` |
| `/add` | 업무 등록 | `/add 보고서 2026-06-15 14:00` |
| `/remind` | 추가 알림 | `/remind 1 5분`, `/remind 1 14:00` |
| `/done` | 번호로 완료 | `/done 1` |
| `/week` | 이번 주 요약 | 🔲 Phase 4 |
| `/search` | 메모리 검색 | 🔲 Phase 3 |
| `/settings` | 알림·타임존 설정 | 🔲 Phase 4 |

### 5.2 자연어 (LLM 설정 시)

| 입력 예시 | 동작 |
|-----------|------|
| `3번 완료했어` | 3번 업무 완료 |
| `내일까지 보고서 작성해줘` | 업무 등록 + 마감일 |
| `1번 10분 후에 알려줘` | 10분 후 알림 (규칙 처리) |
| `1번 내일 15시에 알려줘` | 지정 시각 알림 (규칙 처리) |
| `오늘 할 일 뭐야?` | 오늘 마감 목록 |
| `안녕` | 일반 대화 |

> LLM 미설정 시: `/add`, `/list`, `/remind` 등 명령어 사용 안내

### 5.3 인라인 키보드 (알림 메시지)

| 버튼 | 동작 |
|------|------|
| ✅ 완료 | 해당 업무 완료 처리 |
| ⏰ 1시간 후 | 60분 후 동일 알림 재예약 |
| 📋 상세 | 제목·마감·우선순위 상세 표시 |

### 5.4 목록 표시 형식

```
📋 활성 업무 목록

1. 🟡 분기 보고서 작성 | 마감: 2026. 06. 20. (D-9)
2. 🔴 회의 자료 준비 | 마감: 2026. 06. 12. (D-1)

완료: /done <번호> 또는 "N번 완료"
```

우선순위 아이콘: 🟢 low · 🟡 medium · 🟠 high · 🔴 urgent

### 5.5 KakaoTalk (오픈빌더 스킬)

| 입력 | 동작 |
|------|------|
| `목록` / `list` | 활성 업무 |
| `오늘` / `today` | 오늘 마감 |
| `완료 1` / `done 1` | 1번 완료 |
| `추가 제목 2026-06-15 14:00` | 업무 등록 |
| `알림 1 5분` | 추가 알림 |
| `연결 link_xxxx` | 웹 연동 토큰 (최초 1회) |
| 자연어 | LLM 설정 시 (텔레그램과 동일 에이전트) |

> 스킬 URL: `{WEB_APP_URL}/api/kakao/skill` · `KAKAO_CHANNEL_URL` 설정 시 웹 연동 APP에 표시

---

## 6. AI 에이전트 기능

### 6.1 Agent Loop (ReAct)

```
메시지 수신 → 명령어·규칙 패턴 매칭 (우선)
           → LLM 호출 (자연어)
           → 도구 실행 (create_task 등)
           → DB 저장 / 리마인더 예약
           → 텔레그램 응답

첨부 수신  → 파일 저장 → 텍스트 추출 → LLM 구조화 추출 → 업무 등록
```

### 6.2 제공 도구 (Function Calling)

| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `create_task` | 업무 등록 | title, description, due_date, due_time, priority |
| `create_reminder` | 알림 설정 | list_index, remind_time, remind_in_minutes |
| `complete_task` | 완료 | list_index 또는 title |
| `list_tasks` | 활성 목록 | — |
| `list_today_tasks` | 오늘 마감 | — |
| `search_memory` | 의미 검색 | 🔲 Phase 3 |
| `parse_attachment` | 첨부 재분석 | 🔲 |

### 6.3 LLM 프로바이더

| 방식 | 설정 | 용도 |
|------|------|------|
| **Ollama (터널)** | `LLM_BASE_URL`, `LLM_MODEL` | 로컬/원격 자가 호스팅, 비용 없음 |
| **OpenAI** | `OPENAI_API_KEY`, `LLM_MODEL` | 도구 호출 안정성 우수 |
| **명령어 전용** | LLM 미설정 | LLM 없이 `/add`, `/list` 등 |

### 6.4 System Prompt 구성

- 역할: 개인 업무 비서 (한국어)
- 오늘 날짜·타임존 (Asia/Seoul)
- 활성 업무 목록 (컨텍스트)
- 도구 사용 규칙

---

## 7. 첨부파일·문서 분석

### 7.1 지원 포맷 (구현)

| 포맷 | 처리 방식 | 비고 |
|------|-----------|------|
| `.hwp` (v5) | `hwp-parser` sidecar → `hwp5txt` | Docker `localhost:8100` |
| `.hwpx` | gateway ZIP+XML 파싱 | sidecar 불필요 |
| `.pdf` | pdf-parse | gateway |
| `.docx` | mammoth | gateway |
| `.txt`, `.md` | UTF-8 읽기 | gateway |
| 이미지 | LLM Vision OCR | LLM 설정 필요 |

### 7.2 처리 파이프라인 (현재)

```
Telegram document/photo
  → gateway 파일 다운로드
  → data/attachments/{userId}/ 원본 저장
  → 텍스트 추출 (포맷별)
  → LLM 구조화 추출 (summary, tasks, keywords)
  → PostgreSQL attachments + tasks 등록
  → 마감일 있으면 리마인더 자동 예약
  → 사용자에게 요약·등록 결과 회신
```

LLM 미설정 시: 텍스트 추출·DB 저장만 수행, 업무 자동 등록은 건너뜀.

### 7.3 hwp-parser sidecar

- 경로: `services/hwp-parser/` (Python FastAPI)
- 엔드포인트: `POST /extract`, `GET /health`
- Docker: `docker compose up -d` 시 함께 기동
- 의존성: `pyhwp`, `six`, `lxml`, `cryptography`

### 7.4 LLM 추출 출력 예시

```json
{
  "tasks": [
    {
      "title": "분기 실적 보고서 제출",
      "due_date": "2026-06-15",
      "priority": "high",
      "source_quote": "6월 15일까지 제출 바랍니다"
    }
  ],
  "summary": "2분기 실적 보고 관련 공문",
  "keywords": ["실적보고", "2분기", "마감"]
}
```

---

## 8. 기억(메모리) 시스템

### 3계층 구조

| 계층 | 저장소 | 내용 | 상태 |
|------|--------|------|------|
| **L1 Working** | Redis | 현재 대화 10~20턴 | 🔲 Phase 3 |
| **L2 Structured** | PostgreSQL | tasks, attachments 메타 | ✅ |
| **L3 Semantic** | PGVector | 문서 청크·대화 요약 임베딩 | 🔲 Phase 3 |

### 검색 유형

- **구조화:** "이번 주 마감 업무" → SQL 쿼리
- **의미:** "지난달 공문" → Vector 유사도 + 메타 필터
- **첨부 연계:** `attachment_id`로 HWP에서 뽑은 할 일 조회

---

## 9. 알림·리마인더

### 9.1 자동 스케줄 (마감일 있는 업무)

| 시점 | 발송 시각 (기본) |
|------|------------------|
| D-3 | 마감 3일 전 09:00 |
| D-1 | 마감 1일 전 09:00 |
| D-day | 마감 당일 09:00 |
| 마감 1시간 전 | `due_at`에 시각이 포함된 경우 |

날짜만 마감(`YYYY-MM-DD`)이면 당일 09:00까지만. 시각 마감이면 09:00 + 1시간 전 알림이 추가됩니다.

`REMINDER_HOUR=9`, `TIMEZONE=Asia/Seoul` 로 조정 가능.

### 9.2 사용자 지정 알림

| 방식 | 예시 |
|------|------|
| 명령어 | `/remind 1 5분`, `/remind 1 2026-06-15 14:00` |
| 규칙 (LLM 불필요) | `1번 10분 후에 알려줘`, `1번 내일 15시에 알려줘` |
| LLM 도구 | `create_reminder` function calling |
| Snooze | 알림 메시지 [⏰ 1시간 후] 버튼 |

### 9.3 알림 메시지

```
🔔 업무 알림

📌 분기 실적 보고서 제출
📅 마감: 2026. 06. 15.

[✅ 완료]  [⏰ 1시간 후]  [📋 상세]
```

### 9.4 완료 시 동작

1. `tasks.status` → `completed`
2. `tasks.completed_at` 기록
3. 해당 업무의 `pending` 리마인더 → `cancelled`
4. BullMQ 예약 job 제거
5. `/list`, `/today`에서 제외

### 9.5 기술 구현

- **BullMQ** + Redis delayed jobs
- DB `reminders` 테이블에 job_id 매핑
- 봇 재시작 시 pending job 복구 (🔲 향후 강화)

---

## 10. 데이터·저장 구조

### 10.1 어디에 쌓이나?

| 데이터 | 위치 | 비고 |
|--------|------|------|
| 컴파일된 코드 | `packages/database/dist/` | 빌드 산출물 |
| 업무·사용자·알림 | Docker PostgreSQL (`localhost:5433`) | 영구 볼륨 |
| 예약 알림 큐 | Docker Redis (`localhost:6379`) | BullMQ |
| 첨부 원본 | `data/attachments/` | git 제외, 로컬 디스크 |
| `.env` | 프로젝트 루트 | git 제외 |

> Windows에 PostgreSQL이 5432를 쓰는 경우 **Docker는 5433** 사용.

### 10.2 DB 스키마 (현재)

```
web_accounts, invite_codes, sessions, login_events
  — Google 로그인·초대코드·세션·감사 로그

users
  ├─ id, web_account_id, telegram_user_id (레거시), timezone, preferences
  │
channel_connections
  ├─ user_id, provider (telegram|kakao|slack), external_id, status
  │
google_calendar_connections, calendar_imports
  ├─ OAuth 토큰, google_event_id, enabled → task_id
  │
attachments
  ├─ id, user_id, file_name, mime_type, file_size
  ├─ storage_path, extracted_text, summary, keywords
  └─ status (pending|processing|ready|failed)
  │
tasks
  ├─ id, user_id, title, description, attachment_id
  ├─ status (active|completed|cancelled)
  ├─ priority (low|medium|high|urgent)
  ├─ due_at, completed_at, list_index
  │
reminders
  ├─ id, user_id, task_id
  ├─ fire_at, status (pending|sent|cancelled)
  └─ job_id (BullMQ)
```

### 10.3 계획 테이블 (Phase 3~4)

```
events          — 일정
memory_chunks   — PGVector 임베딩
archived_tasks  — 완료 후 30일 이관
```

---

## 11. 보안·접근 제어

| 항목 | 방식 |
|------|------|
| 웹 인증 | Google OAuth 2.0 + HTTP-only 세션 쿠키 |
| 베타 가입 | 이메일 전용 초대코드 (`ADMIN_EMAILS`는 코드 없이 가입) |
| Telegram | `user_id` — 웹 연동 링크 또는 `ALLOWED_TELEGRAM_USER_IDS` |
| Kakao | 오픈빌더 `userRequest.user.id` + 웹 `link_` 토큰 연결 |
| Google Calendar | 별도 OAuth scope, refresh token DB 저장 |
| 거부 시 안내 | 미연동·미허용 시 안내 메시지 |
| Webhook | Secret token 검증 (프로덕션) |
| API Key | `.env` only, git 미포함 |
| 연동 표시명 | Kakao는 웹에 displayName 미표시 (개인정보) |
| 파일 저장 | `data/attachments/` 로컬 (git 제외) |

---

## 12. 시스템 구성

### 12.1 아키텍처

```
[Web Browser] ←→ [React apps/web] ←→ [REST API apps/gateway/src/api]
                                              │
[Telegram] ←→ [grammY]                        │
[Kakao Skill] ←→ [/api/kakao/skill] ──────────┤
                                              │
                    ┌─────────────────────────┼──────────────┐
                    ▼                         ▼              ▼
              [Agent Runtime]          [Task Service]  [Calendar Import]
                    │                         │              │
                    ▼                         ▼              ▼
               [LLM API]               [PostgreSQL]    [Google Calendar API]
               OpenAI/Ollama                 │
                    │              users, tasks, channel_connections,
                    │              calendar_imports, reminders, …
                    ▼
            [Attachment] → [hwp-parser sidecar]
                    │
            [Reminder Worker] → [Redis/BullMQ] → Telegram 알림
```

### 12.2 프로젝트 구조

```
myown/
├── apps/
│   ├── gateway/           # Telegram·Kakao 스킬, REST API, Agent, Reminder Worker
│   │   └── src/api/       # 웹 대시보드 HTTP API
│   └── web/               # React 대시보드 (Vite, Tailwind)
├── packages/database/     # Drizzle ORM, 스키마, Repository
├── services/hwp-parser/   # Python FastAPI (HWP 파싱)
├── docker-compose.yml     # PostgreSQL:5433, Redis, hwp-parser
├── docs/FEATURES.md       # 본 문서
└── .env                   # 비밀 설정
```

### 12.3 기술 스택

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 20+, TypeScript |
| Web | React, Vite, Tailwind CSS |
| Telegram | grammY |
| Kakao | 오픈빌더 스킬 HTTP (`/api/kakao/skill`) |
| ORM | Drizzle + PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| LLM | OpenAI SDK (Ollama 호환 baseURL) |
| HWP | pyhwp Python sidecar (`services/hwp-parser`) |
| 첨부 저장 | 로컬 `data/attachments/` |
| Vector | PGVector (Phase 3) |

---

## 13. 환경 설정

### 필수

```env
TELEGRAM_BOT_TOKEN=...
# (선택) 비우면 웹 연동 APP에서 Telegram 연결
ALLOWED_TELEGRAM_USER_IDS=
DATABASE_URL=postgresql://myown:myown@localhost:5433/myown
REDIS_URL=redis://localhost:6379
```

### 웹·인증 (대시보드)

```env
WEB_API_PORT=4000
WEB_CORS_ORIGIN=http://localhost:5173
WEB_APP_URL=http://localhost:5173
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=   # 기본: {WEB_APP_URL}/api/integrations/google-calendar/callback
ADMIN_EMAILS=you@example.com
SESSION_TTL_DAYS=30
```

### Kakao (선택)

```env
KAKAO_CHANNEL_URL=https://pf.kakao.com/_xxxxx
KAKAO_BOT_NAME=MyOwn
```

### LLM (선택 — 자연어)

**Ollama (SSH 터널):**
```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=gemma2:9b
OPENAI_API_KEY=ollama
```

**OpenAI:**
```env
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

### 앱

```env
TIMEZONE=Asia/Seoul
REMINDER_HOUR=9
LLM_TIMEOUT_MS=120000
```

### 첨부파일

```env
HWP_PARSER_URL=http://localhost:8100
ATTACHMENT_MAX_MB=20
ATTACHMENT_MAX_TEXT_CHARS=12000
# ATTACHMENT_STORAGE_DIR=   # 기본: data/attachments/
```

### 실행 순서

```powershell
docker compose up -d
pnpm install
pnpm db:push      # 최초 1회 및 스키마 변경 시
pnpm dev          # gateway(API+봇) + web 대시보드
```

로컬: API `http://localhost:4000`, 웹 `http://localhost:5173`

---

## 14. 구현 현황

### Phase 1 — MVP ✅

- Telegram 봇 + 화이트리스트
- 업무 CRUD (등록·목록·오늘·완료)
- 마감일·마감 시각 (`/add … HH:MM`)
- 리마인더 D-3/D-1/D-day + 시각 마감 1시간 전 + Snooze
- 사용자 지정 알림 (`/remind`, 규칙, `create_reminder` 도구)
- 인라인 버튼
- OpenAI / Ollama 자연어 + 규칙 기반 명령 우선 처리
- DB·LLM 에러 사용자 안내

### Phase 2 — 첨부파일 ✅

- HWP/HWPX/PDF/DOCX/이미지 파이프라인
- `attachments` 테이블 + `tasks.attachment_id`
- 로컬 원본 저장 (`data/attachments/`)
- LLM 업무 자동 추출 (캡션 힌트 지원)
- hwp-parser Docker sidecar

**미구현:** S3 저장, `parse_attachment` 에이전트 도구, PGVector 임베딩

### Phase 2.5 — 웹·연동 ✅

- React 대시보드 (메인·업무 목록·연동 APP·관리자)
- Google 로그인, 초대코드, 세션
- Telegram 웹 연동 링크
- KakaoTalk 오픈빌더 스킬 + 채널 연결
- Google Calendar OAuth, 일정 가져오기·선택 활성화
- D-DAY 설정, 캘린더 패널, 라이트·다크 모드, 접이식 사이드바

**미구현:** Kakao 알림 발송, Slack 연동, 웹 첨부 업로드

### Phase 3 — 메모리 🔲

- PGVector + `search_memory`
- L1 Working Memory (Redis 대화)
- 대화 요약 → L3
- `/search`

### Phase 4 — UX·운영 🔲

- events, `/week`, `/settings`
- S3/MinIO 첨부 저장
- Webhook 프로덕션 배포
- pending job 복구·모니터링

---

## 15. 제한 사항·알려진 이슈

| 항목 | 설명 |
|------|------|
| Ollama 터널 | SSH 터널이 꺼지면 `Connection error`. 터널 유지 필요. |
| 소형 로컬 모델 | Gemma 등은 function calling 불안정. `/add`, `/remind` 명령어 권장. |
| Windows 5432 충돌 | 로컬 PostgreSQL과 Docker 포트 충돌 → **5433** 사용. |
| 대용량 모델 | 31B 등은 응답 수 분·타임아웃 가능. |
| HWP 파서 | `pyhwp` 의존성(`six` 등) 필요. `docker compose`로 hwp-parser 실행. |
| HWP 제한 | 암호화·일부 구버전 HWP는 추출 실패 가능. HWPX 변환 권장. |
| 첨부 LLM | 업무 자동 등록에는 LLM 설정 필요. 미설정 시 텍스트 저장만. |
| 그룹 채팅 | 개인 DM·1:1 채널 전용 설계. |
| 멀티 사용자 | 초대코드·계정별 `users` 행, 공유 테넌트 아님. |
| Kakao 알림 | 등록·조회만 카카오 지원. 푸시 알림은 Telegram 연동 필요. |
| 카카오 로컬 테스트 | 오픈빌더 스킬은 공개 HTTPS URL 필요 (Cloudflare Tunnel 등). |

---

## 부록: 빠른 참조

### 자주 쓰는 명령

```
/start
/help
/list
/today
/add 제목 YYYY-MM-DD [HH:MM]
/remind 1 5분
/remind 1 14:00
/done 1
```

첨부: 텔레그램에 HWP/PDF/DOCX/이미지 파일 전송 (캡션으로 메모 가능)

### 문제 해결

| 증상 | 확인 |
|------|------|
| 허용된 사용자만 | `.env` ID = @userinfobot Id, `pnpm dev` 재시작 |
| DB 연결 오류 | `docker compose ps`, `pnpm db:push`, port 5433 |
| LLM 처리 오류 | SSH 터널, `curl localhost:11434/v1/models`, 모델명 |
| HWP 파서 422 | `docker compose ps hwp-parser`, `docker logs myown-hwp-parser-1` |
| pnpm 없음 | Node.js 설치 후 `npm i -g pnpm` |

---

*문서 버전: 1.2 · Phase 1~2.5 구현 반영 (웹·Kakao·Google Calendar)*
