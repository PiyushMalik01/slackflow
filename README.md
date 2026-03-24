# SlackFlow

AI-powered Slack task routing platform. Messages from your Slack channels are automatically classified, drafted, and routed to the right team member via Telegram — no manual triage needed.

## How It Works

```
Client posts in Slack → AI classifies & drafts → Team member gets Telegram alert → Approves/edits → Reply posted to Slack
```

## Features

### Core Pipeline
- **AI Classification** — GPT-4o-mini analyzes messages and categorizes them (Bug, Feature, Design, custom categories)
- **AI Draft Responses** — Generates contextual, human-sounding replies for each message
- **Telegram Notifications** — Assigned team member gets an alert with Approve / Edit / Dismiss buttons
- **Auto-reply to Slack** — Approved responses are posted back as thread replies

### Dashboard
- **Overview** — Real-time metrics, charts (tasks by category/status), team load, setup checklist
- **Tasks** — Filterable task list with expandable detail cards, bulk actions (dismiss, delete, reassign), AI recategorize
- **Workspaces** — Connect multiple Slack workspaces, manage monitored channels (bot auto-joins/leaves)
- **Teams** — Create members, generate Telegram invite links (QR code, WhatsApp, email sharing)
- **Activity** — Timeline audit log with charts showing events per day and action distribution
- **Settings** — Custom categories with per-category AI prompts, response templates, workspace preferences

### Smart Features
- **Custom Categories** — Define your own (Bug, Feature, Design, DevOps, etc.) with descriptions that guide the AI
- **Per-Category Prompts** — Customize how the AI drafts responses for each category, with AI-generated prompt suggestions
- **Response Templates** — Pre-written snippets for quick replies, AI-generated from template names
- **Manual Assignment** — Unrouted tasks can be assigned inline, with option to create new members and set up routing in one flow
- **Team Group** — Optional Telegram group that gets a live activity feed of all task assignments and status changes
- **Bulk Actions** — Select multiple tasks and dismiss, delete, or reassign in bulk
- **AI Clean Noise** — AI identifies and removes system messages, spam, and irrelevant tasks

### Integrations
- **ChatGPT OAuth** — Users can connect their ChatGPT account (device code flow) for AI-powered features
- **Manual API Key** — Alternatively, paste an OpenAI API key directly
- **Dark Mode** — Full dark/light theme toggle across the entire platform
- **Real-time Updates** — Supabase Realtime auto-refreshes the dashboard when data changes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components) |
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, Recharts |
| Database | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| AI | OpenAI GPT-4o-mini (classification + drafting) |
| Slack | @slack/web-api (OAuth, Events API, conversations) |
| Telegram | node-telegram-bot-api (webhook mode) |
| Security | AES-256-GCM encryption, HMAC-SHA256 verification, CSRF protection |

## Setup

### Prerequisites
- Node.js 18+
- [Supabase](https://supabase.com/) project
- [Slack App](https://api.slack.com/apps) with Bot Token
- [Telegram Bot](https://core.telegram.org/bots/tutorial) via @BotFather

### 1. Clone & Install

```bash
git clone https://github.com/PiyushMalik01/slackflow.git
cd slackflow
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256-GCM |
| `OPENAI_API_KEY` | OpenAI API key |
| `SLACK_CLIENT_ID` | Slack app client ID |
| `SLACK_CLIENT_SECRET` | Slack app client secret |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | Bot username (without @) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |
| `SLACK_REDIRECT_URI` | ngrok URL + `/api/slack/callback` for dev |

### 3. Database

Run the migrations in your Supabase SQL editor (in order):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_flexible_roles.sql
supabase/migrations/003_flexible_categories.sql
supabase/migrations/004_categories_and_invite_tokens.sql
supabase/migrations/004b_migrate_workspace_roles_category.sql
supabase/migrations/005_telegram_sessions_and_events.sql
supabase/migrations/006_slack_user_cache_and_workspace_fields.sql
supabase/migrations/007_indexes_and_rls.sql
supabase/migrations/008_ai_settings.sql
supabase/migrations/009_enable_realtime.sql
supabase/migrations/010_category_prompts_and_templates.sql
```

### 4. Slack App Configuration

In your Slack app settings (api.slack.com/apps):

- **OAuth Scopes**: `channels:history`, `channels:join`, `channels:read`, `chat:write`, `commands`, `users:read`
- **Event Subscriptions**: Enable, set Request URL to `{your-url}/api/slack/events`
- **Subscribe to bot events**: `message.channels`
- **OAuth Redirect URL**: `{your-url}/api/slack/callback`

### 5. Telegram Webhook

```bash
curl "https://api.telegram.org/bot{YOUR_TOKEN}/setWebhook?url={your-url}/api/telegram/webhook"
```

### 6. Run

```bash
npm run dev
```

For development with Slack/Telegram (needs public URL):
```bash
node scripts/tunnel.mjs  # starts ngrok tunnel
```

## Project Structure

```
app/
  api/
    slack/          — OAuth install, callback, events webhook
    telegram/       — Webhook for bot commands and callbacks
    categories/     — CRUD for custom categories
    roles/          — CRUD for team members
    tasks/          — Task management + AI bulk actions
    templates/      — Response template CRUD + AI generation
    auth/openai/    — ChatGPT OAuth device flow
  dashboard/
    page.tsx        — Overview with metrics and charts
    tasks/          — Task list with filters and bulk actions
    workspaces/     — Slack workspace management
    teams/          — Team members, invite links, routing
    activity/       — Audit log timeline with charts
    settings/       — Categories, templates, preferences, AI config

lib/
  ai/              — OpenAI client, classifier, pipeline, schemas
  slack/           — Channel discovery, user cache, egress
  telegram/        — Bot, notifications, commands, sessions, group notify
  pipeline/        — Main orchestrator (Slack event → AI → Telegram → Slack)
  db/              — Supabase clients, queries, types
  utils/           — Security, logging, CSRF, rate limiting, idempotency

components/        — React components (shadcn/ui + custom)
supabase/          — Database migrations
```

## License

MIT
