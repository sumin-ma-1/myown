<p align="center">
  <img src="./assets/brand/favicon.png" alt="MyOwn" width="120" />
</p>

<h1 align="center">MyOwn</h1>

<p align="center">
  <strong>The easiest way to add your work schedule and get reminders.</strong><br />
  No extra apps to install — use Telegram, KakaoTalk, or the web dashboard you already open every day.
</p>

<p align="center">
  <a href="http://bigsoft.iptime.org:51110"><strong>Try MyOwn →</strong></a>
</p>

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/189559c2-7294-4f54-9e3d-55d079b62fc2"
    alt="MyOwn service preview"
    width="900"
  />
</p>

---

## What you get

| | |
| --- | --- |
| **Chat where you already are** | Register and check tasks in Telegram (or KakaoTalk). Natural language when an LLM is configured. |
| **Web dashboard** | Chat, task status, calendar, task list, integrations, light/dark mode. |
| **Reminders that stick** | Default D-day reminders plus extra “in 5 minutes / tomorrow at 3pm” style alerts. |
| **Attachments → tasks** | Drop HWP / PDF / DOCX / images in Telegram; MyOwn extracts and drafts tasks. |
| **Google Calendar** | Import events, then activate only the ones you want as MyOwn tasks. |

---

## Quick start

### Requirements

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://docs.docker.com/get-docker/) (Postgres, Redis, HWP parser, optional full stack)

### 1. Clone

```bash
git clone https://github.com/<your-org>/myown.git
cd myown
```

### 2. Configure

```bash
cp .env.example .env
```

Minimum to get going:

| Variable | What it is |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth web client |
| `ADMIN_EMAILS` | Your Google email (admin access) |
| `WEB_APP_URL` | Public or local URL of the web app |
| `LLM_BASE_URL` / `LLM_MODEL` | Optional — natural language |

See `.env.example` for the full list.

### 3. Run the full stack (Docker)

```bash
docker compose up -d --build
```

Open the mapped web URL (default share deploy: `http://bigsoft.iptime.org:51110`).

### 4. Or run locally for development

```bash
docker compose up -d postgres redis hwp-parser   # if you use local infra services
pnpm install
pnpm db:push
pnpm dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

Bot only: `pnpm dev:bot` · Web only: `pnpm dev:web`

---

## First-time setup

### Google sign-in

1. Create an OAuth **Web** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add redirect URI: `{WEB_APP_URL}/api/auth/google/callback`
3. Put client ID/secret in `.env`, set `ADMIN_EMAILS` to your Gmail.
4. Open `/signup` and sign in with Google.

### Telegram

1. Sign in on the web → **Integrations**
2. **Connect Telegram** → open the bot → **Start**
3. When the web shows connected, chat with the bot (`/help`, natural language, file uploads)

### Optional

- **KakaoTalk** — set `KAKAO_CHANNEL_URL` and wire the Open Builder skill to `{WEB_APP_URL}/api/kakao/skill`
- **Google Calendar** — enable Calendar API, add `{WEB_APP_URL}/api/integrations/google-calendar/callback`, then connect under Integrations
- **Public HTTPS tunnel** — `pnpm tunnel` (Cloudflare) and point `WEB_APP_URL` / OAuth redirects at the tunnel URL

---

## Bot commands

| Command | Action |
| --- | --- |
| `/start`, `/help` | Help |
| `/list` | Active tasks |
| `/today` | Due today |
| `/add <title> [YYYY-MM-DD] [HH:MM]` | Create a task |
| `/remind <n> 5분` / `/remind <n> HH:MM` | Extra reminder |
| `/done <n>` | Complete task |
| `/web` | Open the web app |

With an LLM: *“finish #3”*, *“report due tomorrow”*, *“remind me about #1 in 10 minutes”*.

---

## Project layout

```
myown/
├── apps/gateway/          # Telegram, Kakao skill, REST API, reminders, agent
├── apps/web/              # React dashboard (Vite + Tailwind)
├── packages/database/     # Drizzle schema & repositories
├── services/hwp-parser/   # HWP sidecar
└── docker-compose.yml
```

---

## License

See repository license file if present. Built as a personal work / schedule assistant.
