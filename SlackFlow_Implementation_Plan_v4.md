# SlackFlow — Implementation Plan v4

> **Stack:** Next.js 15 · Supabase (Auth + DB, no ORM) · OpenAI GPT-4o-mini · Slack · Telegram

| | |
|---|---|
| **What it does** | Routes client Slack messages to the right team member's Telegram with an AI-drafted reply |
| **User auth** | Supabase Auth (email + password / magic link) |
| **AI engine** | OpenAI GPT-4o-mini — single server-side API key |
| **Approval flow** | Human-in-the-loop via Telegram (Approve / Edit / Dismiss) |
| **Slack** | Multi-tenant, multi-workspace |

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Project Structure](#3-project-structure)
4. [Dependencies](#4-dependencies)
5. [Database Schema](#5-database-schema)
6. [Environment Variables](#6-environment-variables)
7. [Supabase Setup (Auth + DB Client)](#7-supabase-setup)
8. [AI Message Drafting](#8-ai-message-drafting)
9. [Slack Integration](#9-slack-integration)
10. [Telegram Approval Hub](#10-telegram-approval-hub)
11. [Pipeline Orchestrator](#11-pipeline-orchestrator)
12. [Security Model](#12-security-model)
13. [Frontend & Design System](#13-frontend--design-system)
14. [Additional Features](#14-additional-features)
15. [Local Development & Tunneling](#15-local-development--tunneling)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment Checklist](#17-deployment-checklist)

---

## 1. How It Works

This is the core workflow — the entire platform exists to serve this loop:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THE SLACKFLOW LOOP                               │
│                                                                         │
│  1. CLIENT sends a message in a connected Slack channel                 │
│     "The checkout button is broken on mobile"                           │
│                                                                         │
│  2. SLACKFLOW captures it via Slack Events API                          │
│                                                                         │
│  3. CLASSIFIER categorizes: BUG (92% confidence)                        │
│     Keywords matched: ["broken"]                                        │
│                                                                         │
│  4. ROLE RESOLVER looks up: workspace "Acme" + category "BUG"           │
│     → Assigned to: "Builder" role → Person: dev@team.com                │
│     → Their Telegram chat_id: 123456789                                 │
│                                                                         │
│  5. AI DRAFTER generates a reply using GPT-4o-mini:                     │
│     "Hi! We've identified the issue and are investigating.              │
│      We'll update you within 2 hours."                                  │
│                                                                         │
│  6. TELEGRAM sends notification to the assignee:                        │
│     ┌──────────────────────────────────────────┐                        │
│     │ 🆕 New task assigned to you               │                        │
│     │                                          │                        │
│     │ Workspace: Acme Corp                     │                        │
│     │ Channel: #support                        │                        │
│     │ Category: BUG (92%)                      │                        │
│     │                                          │                        │
│     │ Client: "The checkout button is broken   │                        │
│     │ on mobile"                               │                        │
│     │                                          │                        │
│     │ Draft reply: "Hi! We've identified the   │                        │
│     │ issue and are investigating..."          │                        │
│     │                                          │                        │
│     │ [✅ Approve] [✏️ Edit] [❌ Dismiss]       │                        │
│     └──────────────────────────────────────────┘                        │
│                                                                         │
│  7. ASSIGNEE taps Approve → reply posted to Slack as thread reply       │
│     (or Edit → types custom reply → posted to Slack)                    │
│     (or Dismiss → no reply, task marked dismissed)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### User journey (platform owner)

```
Sign up → Log in → Install Slack workspace → Configure roles per category
  → Messages start flowing → Manage tasks from dashboard
```

1. **Sign up / Log in** — email + password via Supabase Auth
2. **Add Slack workspace** — OAuth install flow ("Add to Slack" button)
3. **Configure roles** — For each workspace, map BUG → Builder, FEATURE → PM, GENERAL → Support, etc.
4. **Set Telegram chat IDs** — Each role's assignee provides their Telegram `chat_id`
5. **Go live** — Messages in connected channels are automatically captured and routed

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **User auth** | Supabase Auth (email + password) | Built-in, session management via `@supabase/ssr`, RLS integration |
| **AI model** | `gpt-4o-mini` (configurable) | Fast (<2s), $0.15/1M input tokens, good enough for draft replies |
| **AI credentials** | Single `OPENAI_API_KEY` in env vars | Server-side only. No per-user tokens needed — platform pays for AI |
| **Framework** | Next.js 15 App Router | Edge-ready, co-located API routes, React Server Components |
| **Database** | Supabase (`supabase-js` v2) | No ORM. Direct typed queries. Built-in RLS, connection pooling |
| **DB access** | `supabase-js` typed client | Auto-generated TypeScript types via `supabase gen types` |
| **Token encryption** | AES-256-GCM (Node `crypto`) | Slack OAuth tokens encrypted at rest. No third-party crypto deps |
| **Telegram pattern** | `sendMessage` + `InlineKeyboardMarkup` | Inline buttons for Approve/Edit/Dismiss. Standard Bot API |
| **Slack verification** | HMAC-SHA256 + 5-min replay window | Prevents webhook spoofing. Standard Slack security |
| **Rate limiting** | DB-backed sliding window | Per-user, per-endpoint. No Redis needed |
| **Logging** | Pino + correlation IDs | Structured JSON. Correlation ID threads all pipeline stages |
| **Design system** | Inter + Tailwind CSS | Linear/Notion aesthetic. Dark mode first-class |

---

## 3. Project Structure

```
slackflow/
├── next.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── middleware.ts                        # Auth guard — redirects unauthenticated users
├── supabase/
│   ├── migrations/                     # Raw SQL migration files
│   └── types.ts                        # Auto-generated DB types
└── src/
    ├── app/
    │   ├── layout.tsx                  # Root layout — Inter font, global CSS
    │   ├── page.tsx                    # Landing page (public)
    │   ├── (auth)/
    │   │   ├── login/page.tsx          # Login form
    │   │   ├── signup/page.tsx         # Signup form
    │   │   └── callback/route.ts       # Supabase auth callback
    │   ├── api/
    │   │   ├── slack/
    │   │   │   ├── install/route.ts    # OAuth install redirect
    │   │   │   ├── callback/route.ts   # OAuth token exchange
    │   │   │   └── events/route.ts     # Webhook handler (verify + dispatch)
    │   │   ├── telegram/
    │   │   │   └── webhook/route.ts    # Bot callback handler
    │   │   ├── ai/
    │   │   │   └── draft/route.ts      # Force-regenerate a task draft
    │   │   └── health/route.ts         # Health check
    │   └── (dashboard)/
    │       ├── layout.tsx              # Sidebar + topbar shell (auth required)
    │       ├── page.tsx                # Overview — metrics + task feed
    │       ├── workspaces/page.tsx     # Connected Slack workspaces
    │       ├── tasks/page.tsx          # Paginated task feed + filters
    │       └── settings/page.tsx       # Role config per workspace
    ├── components/
    │   ├── layout/                     # Sidebar, Topbar, PageHeader
    │   ├── ui/                         # Button, Card, Badge, Input, Modal, Toast, etc.
    │   ├── dashboard/                  # MetricCard, TaskFeed, TaskRow, PipelineStatus
    │   └── settings/                   # RoleConfigForm, WorkspaceCard
    ├── lib/
    │   ├── db/
    │   │   ├── client.ts               # Supabase singleton (server + browser)
    │   │   └── queries.ts              # All DB query functions — typed
    │   ├── ai/
    │   │   ├── client.ts               # OpenAI client singleton (server-side API key)
    │   │   ├── pipeline.ts             # 5-stage pipeline: collect → prompt → generate → parse → persist
    │   │   ├── prompts.ts              # Prompt templates per category
    │   │   └── parser.ts               # JSON extraction + Zod validation + fallback
    │   ├── slack/
    │   │   ├── oauth.ts                # Install + callback logic
    │   │   ├── events.ts               # Event parsing + dispatch
    │   │   ├── classifier.ts           # BUG / FEATURE / GENERAL + confidence
    │   │   └── egress.ts               # Post approved reply as Slack thread
    │   ├── telegram/
    │   │   ├── bot.ts                  # Bot client setup
    │   │   ├── notify.ts               # Send notification + inline buttons
    │   │   └── callbacks.ts            # Approve / Edit / Dismiss handlers
    │   ├── pipeline/
    │   │   ├── orchestrator.ts         # End-to-end wiring
    │   │   └── scheduler.ts            # node-cron scheduled jobs
    │   └── utils/
    │       ├── logger.ts               # Pino with correlation IDs
    │       ├── security.ts             # Slack sig verify, AES-256-GCM helpers
    │       ├── rate-limiter.ts         # Sliding-window, DB-backed
    │       └── errors.ts               # Custom typed error classes
    ├── styles/
    │   └── globals.css                 # Design tokens, Tailwind base
    └── types/
        └── index.ts                    # Shared TypeScript types
```

---

## 4. Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "latest",
    "openai": "^4.0.0",
    "@slack/web-api": "latest",
    "node-telegram-bot-api": "latest",
    "zod": "^3.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "latest",
    "node-cron": "latest",
    "nanoid": "latest",
    "tailwindcss": "^3.0.0",
    "@headlessui/react": "latest"
  },
  "devDependencies": {
    "vitest": "latest",
    "@testing-library/react": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "msw": "latest"
  }
}
```

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | DB queries, user auth, realtime subscriptions |
| `@supabase/ssr` | Server-side cookie-based auth for Next.js App Router |
| `openai` | GPT-4o-mini chat completions for draft reply generation |
| `@slack/web-api` | Slack API — post messages, OAuth token exchange |
| `node-telegram-bot-api` | Telegram Bot API — send messages, inline keyboards |
| `zod` | Runtime schema validation for AI output + API inputs |
| `pino` | Structured JSON logging with correlation IDs |
| `node-cron` | Scheduled jobs — cleanup, reminders |
| `@headlessui/react` | Accessible modal, dropdown, transition primitives |
| `msw` | Mock Service Worker for tests |

---

## 5. Database Schema

> No ORM. Direct `supabase-js` queries. Types auto-generated via `supabase gen types typescript`. All secrets encrypted before write.

### 5.1 User Auth

Handled entirely by **Supabase Auth** — no custom users table. The `auth.users` table is managed by Supabase. We reference `auth.users(id)` as foreign keys where needed.

### 5.2 `workspaces`

```sql
CREATE TABLE workspaces (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_team_id     TEXT        UNIQUE NOT NULL,
  name              TEXT        NOT NULL,
  access_token_enc  TEXT        NOT NULL,   -- AES-256-GCM ciphertext
  access_token_iv   TEXT        NOT NULL,   -- 12-byte IV (hex)
  bot_user_id       TEXT        NOT NULL,
  installed_at      TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workspaces_team_id ON workspaces (slack_team_id);
CREATE INDEX idx_workspaces_owner ON workspaces (owner_id);

-- RLS: users can only see their own workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON workspaces
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
```

### 5.3 `roles`

```sql
CREATE TABLE roles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL CHECK (type IN ('BUILDER', 'TESTER', 'DESIGNER', 'PM', 'SUPPORT')),
  name             TEXT        NOT NULL,       -- e.g. "Arpit (Backend Dev)"
  telegram_chat_id TEXT,                       -- Telegram chat ID for notifications
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON roles
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
```

### 5.4 `workspace_roles`

```sql
-- Maps: workspace × category → assigned role
CREATE TABLE workspace_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role_id      UUID REFERENCES roles(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('BUG', 'FEATURE', 'GENERAL')),
  UNIQUE (workspace_id, category)  -- one assignee per category per workspace
);

ALTER TABLE workspace_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_workspace" ON workspace_roles
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
```

### 5.5 `tasks`

```sql
CREATE TABLE tasks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  channel               TEXT        NOT NULL,
  thread_ts             TEXT        NOT NULL,
  original_text         TEXT        NOT NULL,
  sender_name           TEXT,                    -- Slack display name of message sender
  category              TEXT        CHECK (category IN ('BUG', 'FEATURE', 'GENERAL')),
  category_confidence   REAL,                    -- 0.0–1.0
  draft_text            TEXT,                    -- AI-generated reply
  edited_text           TEXT,                    -- human-edited override
  final_text            TEXT,                    -- what was actually sent to Slack
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                      'pending', 'draft_ready', 'approved',
                                      'edited', 'dismissed', 'sent', 'failed'
                                    )),
  role_id               UUID        REFERENCES roles(id),
  telegram_message_id   INTEGER,
  ai_model              TEXT,
  ai_tokens_used        INTEGER,
  draft_generated_at    TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_workspace_status ON tasks (workspace_id, status);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_workspace" ON tasks
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
```

### 5.6 `activity_log`

```sql
-- Audit trail for all significant events
CREATE TABLE activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id      UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  actor        TEXT        NOT NULL,   -- 'system' | 'telegram:chat_id' | 'user:user_id'
  action       TEXT        NOT NULL,   -- 'task_created' | 'draft_generated' | 'approved' | 'edited' | 'dismissed' | 'sent' | 'failed'
  details      JSONB,                  -- extra context (e.g. edited text, error message)
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_log_workspace ON activity_log (workspace_id, created_at DESC);
```

### 5.7 `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id      UUID        REFERENCES roles(id) ON DELETE CASCADE,
  quiet_start  TIME,       -- e.g. '22:00' — don't send notifications after this
  quiet_end    TIME,       -- e.g. '08:00' — resume notifications after this
  timezone     TEXT        DEFAULT 'UTC',
  notify_on    TEXT[]      DEFAULT '{BUG,FEATURE,GENERAL}',  -- which categories to notify
  UNIQUE (role_id)
);
```

### 5.8 `rate_limits`

```sql
CREATE TABLE rate_limits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT        UNIQUE NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_rate_limits_key ON rate_limits (key);
```

### Supabase Notes

- **RLS enabled on all tables** — policies scoped to `auth.uid()` for dashboard access, service role key for webhook/API routes.
- After any schema change: `supabase gen types typescript --project-id <id> > supabase/types.ts`
- Use **connection pooler URL (port 6543)** for serverless functions.

---

## 6. Environment Variables

```bash
# ── Supabase ────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>      # server-only

# ── Security ────────────────────────────────────────────────────────────
ENCRYPTION_KEY=<32-byte hex>   # openssl rand -hex 32

# ── OpenAI ──────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...          # server-only, platform-wide

# ── Slack ───────────────────────────────────────────────────────────────
SLACK_CLIENT_ID=<app client id>
SLACK_CLIENT_SECRET=<app client secret>
SLACK_SIGNING_SECRET=<signing secret>

# ── Telegram ────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=<bot token from @BotFather>

# ── App ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

---

## 7. Supabase Setup

### `lib/db/client.ts` — Auth + DB client

```typescript
import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/supabase/types'

// ── Server client (API routes — bypasses RLS with service role) ──────────
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Singleton for long-running processes (orchestrator, scheduler)
let _serviceClient: ReturnType<typeof createServiceClient> | null = null
export function getServiceClient() {
  if (!_serviceClient) _serviceClient = createServiceClient()
  return _serviceClient
}

// ── Auth-aware server client (Server Components + protected API routes) ──
export async function createAuthClient() {
  const cookieStore = await cookies()
  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// ── Browser client (client components only) ──────────────────────────────
export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `middleware.ts` — Auth guard

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/api/slack/events', '/api/telegram/webhook', '/api/health']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const path = req.nextUrl.pathname

  // Skip auth for public routes and API webhooks
  if (PUBLIC_ROUTES.some(r => path === r || path.startsWith('/api/slack/') || path.startsWith('/api/telegram/'))) {
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !path.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### `lib/db/queries.ts` — All DB interactions

```typescript
import { getServiceClient } from './client'
import { DbError } from '@/lib/utils/errors'
import type { Database } from '@/supabase/types'

type Task       = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']
type TaskStatus = 'pending' | 'draft_ready' | 'approved' | 'edited' | 'dismissed' | 'sent' | 'failed'

// ── Workspaces ────────────────────────────────────────────────────────────

export async function getWorkspaceByTeamId(teamId: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('slack_team_id', teamId)
    .single()
  if (error) throw new DbError('workspace_not_found', error.message)
  return data
}

export async function upsertWorkspace(workspace: {
  owner_id: string
  slack_team_id: string
  name: string
  access_token_enc: string
  access_token_iv: string
  bot_user_id: string
}) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .upsert(workspace, { onConflict: 'slack_team_id' })
    .select()
    .single()
  if (error) throw new DbError('workspace_upsert_failed', error.message)
  return data
}

export async function listWorkspacesForUser(userId: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .order('installed_at', { ascending: false })
  if (error) throw new DbError('workspaces_list_failed', error.message)
  return data
}

// ── Roles ─────────────────────────────────────────────────────────────────

export async function resolveRole(workspaceId: string, category: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('workspace_roles')
    .select('*, roles(*)')
    .eq('workspace_id', workspaceId)
    .eq('category', category)
    .single()
  if (error) return null  // no role configured for this category — skip
  return data?.roles
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export async function createTask(task: TaskInsert) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw new DbError('task_create_failed', error.message)
  return data
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  extra?: Partial<Task>
) {
  const db = getServiceClient()
  const { error } = await db
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id)
  if (error) throw new DbError('task_update_failed', error.message)
}

export async function getTaskById(id: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tasks')
    .select('*, workspaces(*), roles(*)')
    .eq('id', id)
    .single()
  if (error) throw new DbError('task_not_found', error.message)
  return data
}

export async function listTasks(filters: {
  workspaceId?: string
  status?: TaskStatus
  category?: string
  limit?: number
  offset?: number
}) {
  const db = getServiceClient()
  let q = db.from('tasks').select('*, workspaces(name), roles(name)', { count: 'exact' })
  if (filters.workspaceId) q = q.eq('workspace_id', filters.workspaceId)
  if (filters.status)      q = q.eq('status', filters.status)
  if (filters.category)    q = q.eq('category', filters.category)
  q = q.order('created_at', { ascending: false })
       .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 25) - 1)
  const { data, error, count } = await q
  if (error) throw new DbError('tasks_list_failed', error.message)
  return { tasks: data, total: count }
}

// ── Rate limits ───────────────────────────────────────────────────────────

export async function checkAndIncrementRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const db = getServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  const { data } = await db
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .single()

  if (!data || new Date(data.window_start) < windowStart) {
    await db.from('rate_limits').upsert(
      { key, count: 1, window_start: now.toISOString() },
      { onConflict: 'key' }
    )
    return { allowed: true, remaining: maxCount - 1 }
  }

  if (data.count >= maxCount) {
    return { allowed: false, remaining: 0 }
  }

  await db.from('rate_limits').update({ count: data.count + 1 }).eq('key', key)
  return { allowed: true, remaining: maxCount - data.count - 1 }
}
```

---

## 8. AI Message Drafting

> The AI is a **server-side tool** — it generates draft replies to client messages. Users never interact with OpenAI directly. The platform owner provides a single API key in env vars.

### `lib/ai/client.ts`

```typescript
import OpenAI from 'openai'

// Single server-side OpenAI client — one API key for the whole platform
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
export const AI_TIMEOUT_MS = 30_000
export const AI_MAX_RETRIES = 3
```

### `lib/ai/prompts.ts`

```typescript
export const PROMPT_VERSIONS = {
  bug:     'v1.0',
  feature: 'v1.0',
  general: 'v1.0',
}

type ChatMessage = { role: 'system' | 'user'; content: string }

export function bugDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a helpful support agent for ${workspace}.
A client has reported a bug. Write a brief, empathetic reply acknowledging the issue.
Reply with ONLY valid JSON: {"draft":"<reply text>","tone":"empathetic","severity":"low|medium|high"}
No markdown. No preamble. JSON only. Prompt version: ${PROMPT_VERSIONS.bug}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}

export function featureDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a product manager for ${workspace}.
A client has requested a feature. Write a brief, enthusiastic reply acknowledging the request.
Reply with ONLY valid JSON: {"draft":"<reply text>","tone":"enthusiastic","priority_hint":"low|medium|high"}
No markdown. JSON only. Prompt version: ${PROMPT_VERSIONS.feature}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}

export function generalDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a helpful support agent for ${workspace}.
A client has sent a message. Write a brief, friendly reply.
Reply with ONLY valid JSON: {"draft":"<reply text>","tone":"friendly"}
No markdown. JSON only. Prompt version: ${PROMPT_VERSIONS.general}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}

export function getPromptForCategory(category: string, msg: string, workspace: string) {
  switch (category) {
    case 'BUG':     return bugDraftPrompt(msg, workspace)
    case 'FEATURE': return featureDraftPrompt(msg, workspace)
    default:        return generalDraftPrompt(msg, workspace)
  }
}
```

### `lib/ai/parser.ts`

```typescript
import { z } from 'zod'

const DraftSchema = z.object({
  draft: z.string().min(1),
  tone: z.string(),
}).passthrough()  // allow extra fields (severity, priority_hint, etc.)

export function parseAiOutput(raw: string) {
  // 1. Strip markdown fences
  const stripped = raw.replace(/```json\n?|\n?```/g, '').trim()

  // 2. Extract JSON
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { type: 'plain_text' as const, draft: raw }
  }

  // 3. Validate
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const validated = DraftSchema.parse(parsed)
    return { type: 'structured' as const, ...validated }
  } catch {
    return { type: 'plain_text' as const, draft: raw }
  }
}
```

### `lib/ai/pipeline.ts` — 5-stage pipeline

```
collect(ctx) → buildPrompt(data) → generate(prompt) → parse(raw) → persist(result)
```

```typescript
import { openai, AI_MODEL, AI_TIMEOUT_MS, AI_MAX_RETRIES } from './client'
import { getPromptForCategory } from './prompts'
import { parseAiOutput } from './parser'
import { getWorkspaceByTeamId, updateTaskStatus } from '@/lib/db/queries'
import { logger } from '@/lib/utils/logger'

export async function runAiDraftPipeline(task: {
  id: string
  workspace_id: string
  original_text: string
  category: string
}) {
  const correlationId = task.id
  const log = logger.child({ correlationId, stage: 'ai_pipeline' })

  try {
    // 1. Collect — get workspace context
    const workspace = await getWorkspaceByTeamId(task.workspace_id)
    log.info({ stage: 'collect' }, 'Context loaded')

    // 2. Prompt — build messages for the category
    const messages = getPromptForCategory(task.category, task.original_text, workspace.name)
    log.info({ stage: 'prompt', category: task.category }, 'Prompt built')

    // 3. Generate — call OpenAI
    const startMs = Date.now()
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    })
    const latencyMs = Date.now() - startMs
    const rawOutput = completion.choices[0]?.message?.content || ''
    const tokensUsed = completion.usage?.total_tokens || 0
    log.info({ stage: 'generate', latencyMs, tokensUsed }, 'AI response received')

    // 4. Parse — validate output
    const parsed = parseAiOutput(rawOutput)
    log.info({ stage: 'parse', type: parsed.type }, 'Output parsed')

    // 5. Persist — update task with draft
    await updateTaskStatus(task.id, 'draft_ready', {
      draft_text: parsed.draft,
      ai_model: AI_MODEL,
      ai_tokens_used: tokensUsed,
      draft_generated_at: new Date().toISOString(),
    })
    log.info({ stage: 'persist' }, 'Task updated with draft')

    return { draft: parsed.draft, tokensUsed, latencyMs }
  } catch (error) {
    log.error({ error }, 'AI pipeline failed')
    await updateTaskStatus(task.id, 'failed')
    throw error
  }
}
```

---

## 9. Slack Integration

### Slack App Setup

```
Bot Token Scopes: channels:history, chat:write, commands, users:read
Event Subscriptions: message.channels
OAuth Redirect URL: https://yourdomain.com/api/slack/callback
Events URL: https://yourdomain.com/api/slack/events
```

### `POST /api/slack/events` — Webhook handler

```typescript
// 1. Verify Slack HMAC-SHA256 signature + 5-min replay window → 401 if invalid
// 2. Handle URL verification challenge (returns challenge token)
// 3. Filter: type=message only. Skip messages with bot_id (prevents loops).
// 4. Look up workspace by team_id
// 5. Dispatch to orchestrator.handle(event, workspace)
```

### `lib/slack/classifier.ts`

```typescript
type Category = 'BUG' | 'FEATURE' | 'GENERAL'
type ClassifyResult = {
  category: Category
  confidence: number        // 0.0–1.0
  matchedKeywords: string[]
}

const BUG_KEYWORDS     = ['bug', 'broken', 'error', 'crash', 'not working', 'issue', 'fail', 'down']
const FEATURE_KEYWORDS = ['feature', 'request', 'suggestion', 'add', 'would be nice', 'can you add', 'idea']

export function classify(text: string): ClassifyResult {
  const lower = text.toLowerCase()
  const bugMatches     = BUG_KEYWORDS.filter(k => lower.includes(k))
  const featureMatches = FEATURE_KEYWORDS.filter(k => lower.includes(k))

  if (bugMatches.length > featureMatches.length) {
    return { category: 'BUG', confidence: Math.min(bugMatches.length / 3, 1), matchedKeywords: bugMatches }
  }
  if (featureMatches.length > 0) {
    return { category: 'FEATURE', confidence: Math.min(featureMatches.length / 3, 1), matchedKeywords: featureMatches }
  }
  return { category: 'GENERAL', confidence: 1.0, matchedKeywords: [] }
}
```

### `lib/slack/oauth.ts`

```
GET /api/slack/install
  → Redirect to Slack OAuth consent URL (scopes: channels:history, chat:write, commands, users:read)

GET /api/slack/callback?code=...
  → Exchange code for access_token via Slack API
  → Encrypt token (AES-256-GCM)
  → Upsert workspaces row (slack_team_id as conflict key, owner_id from session)
  → Redirect to /workspaces with success toast
```

### `lib/slack/egress.ts`

```
Decrypt workspace access_token → chat.postMessage with thread_ts → update task.status = 'sent'
Store the final_text on the task row for audit trail.
```

---

## 10. Telegram Approval Hub

### Notification format (`lib/telegram/notify.ts`)

```
🆕 <b>New task assigned to you</b>

<b>Workspace:</b> Acme Corp
<b>Channel:</b> #support
<b>Category:</b> BUG  (confidence: 92%)

<b>Client message:</b>
"The checkout button is broken on mobile"

<b>AI draft reply:</b>
"Hi! We've received your report and are investigating urgently.
We'll update you within 2 hours."
```

Inline keyboard:
```
[ ✅ Approve ]  [ ✏️ Edit ]  [ ❌ Dismiss ]
```

Callback data: `{taskId}:approve` / `{taskId}:edit` / `{taskId}:dismiss`

### Callback handlers (`lib/telegram/callbacks.ts`)

| Action | Handler |
|---|---|
| **Approve** | Update task `status → 'approved'`. Call `egress.postReply(task)` with `draft_text`. Edit Telegram message to "✅ Approved and sent." Update `status → 'sent'`. |
| **Edit** | Edit Telegram message to "📝 Send your edited reply:". Wait for next text from same `chat_id`. Use that text as `edited_text`. Post to Slack. `status → 'edited' → 'sent'`. |
| **Dismiss** | `status → 'dismissed'`. Edit Telegram message to "❌ Dismissed." No Slack reply sent. |

### `POST /api/telegram/webhook` — Webhook route

```typescript
// 1. Parse incoming update (callback_query or message)
// 2. If callback_query → extract taskId + action → route to handler
// 3. If text message → check if user is in "edit mode" (pending edited reply)
//    → If yes, treat text as edited reply for the pending task
// 4. Acknowledge callback_query to stop Telegram loading spinner
```

---

## 11. Pipeline Orchestrator

### `lib/pipeline/orchestrator.ts`

```
Slack event (verified)
  → classify(message.text)             → { category: 'BUG', confidence: 0.92 }
  → resolveRole(workspaceId, 'BUG')   → role { name, telegram_chat_id }
  → createTask(...)                    → task record (status: 'pending')
  → runAiDraftPipeline(task)           → draft_text (status: 'draft_ready')
  → telegram.notify(role.telegram_chat_id, task)
  → [awaits Telegram callback via separate webhook route]
  → on Approve: egress.postReply(task) → task (status: 'sent')
```

`orchestrator.handle()` is **async but non-blocking** — it does not block the Slack webhook response. The task row tracks all state transitions. Telegram callback is handled by a separate webhook route.

### Error handling in the pipeline

```
If classify fails    → task created with category 'GENERAL' (fallback)
If no role found     → task created but status stays 'pending', no Telegram notification
If AI draft fails    → task.status = 'failed', Telegram notification sent WITHOUT draft
                       (just the raw client message — assignee can still reply manually)
If Telegram fails    → task.status stays 'draft_ready', logged for retry
```

### `lib/pipeline/scheduler.ts` — `node-cron` jobs

```typescript
// Every 5 min: remind assignee about tasks stuck in draft_ready > 30 min
cron.schedule('*/5 * * * *', remindStaleTasks)

// Every 1 hour: prune old rate_limits entries
cron.schedule('0 * * * *', pruneOldRateLimits)

// On startup: verify all workspace Slack tokens are still valid
verifyAllWorkspaceTokens()
```

---

## 12. Security Model

| Concern | Implementation |
|---|---|
| **User auth** | Supabase Auth. Cookie-based sessions via `@supabase/ssr`. Middleware guards all `/dashboard/*` routes. |
| **Slack token storage** | AES-256-GCM encryption. Key from `ENCRYPTION_KEY` env var. Separate IV per value. |
| **OpenAI key** | Server-side env var only. Never exposed to browser. Never logged. |
| **Slack webhooks** | HMAC-SHA256 signature verification. 5-minute replay window. |
| **Supabase access** | Service role key for webhooks (bypass RLS). Anon key + RLS for dashboard queries. |
| **Sensitive data logging** | Pino `redactFields` masks: `access_token_enc`, `api_key`, any field named `token` or `key`. |
| **Rate limiting** | Per-user sliding-window. AI draft: 20/min. Slack install: 5/hour. |
| **Input validation** | Zod schemas on all API route inputs. 400 before processing. |

### `lib/utils/security.ts`

```typescript
import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(plaintext: string): { enc: string; iv: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    enc: Buffer.concat([enc, tag]).toString('base64'),
    iv: iv.toString('hex'),
  }
}

export function decrypt(enc: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex')
  const buf = Buffer.from(enc, 'base64')
  const tag = buf.slice(buf.length - 16)
  const ciphertext = buf.slice(0, buf.length - 16)
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function verifySlackSignature(
  body: string, timestamp: string, signature: string, signingSecret: string
): boolean {
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false
  const baseString = `v0:${timestamp}:${body}`
  const expected = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex')
  return signature === expected
}
```

### `lib/utils/errors.ts`

```typescript
export class AiError extends Error {
  constructor(message: string) { super(message); this.name = 'AiError' }
}
export class AiTimeoutError extends AiError {
  constructor() { super('AI request timed out after 30s'); this.name = 'AiTimeoutError' }
}
export class AiParseError extends AiError {
  constructor(public raw: string) { super('Failed to parse AI output'); this.name = 'AiParseError' }
}
export class SlackVerificationError extends Error {
  constructor() { super('Slack signature verification failed'); this.name = 'SlackVerificationError' }
}
export class DbError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'DbError' }
}
```

---

## 13. Frontend & Design System

> Philosophy: **Linear + Notion aesthetic.** Flat, purposeful, no decorative effects. Dark mode first-class.

### 13.1 Design tokens — `styles/globals.css`

```css
:root {
  --color-brand:        #4F46E5;
  --color-brand-hover:  #4338CA;
  --color-brand-light:  #EEF2FF;

  --color-bg-primary:   #FFFFFF;
  --color-bg-secondary: #F9FAFB;
  --color-bg-tertiary:  #F3F4F6;

  --color-text-primary:   #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary:  #9CA3AF;
  --color-text-brand:     #4F46E5;

  --color-border:       #E5E7EB;
  --color-border-focus: #4F46E5;

  --color-success:    #16A34A;  --color-success-bg: #F0FDF4;
  --color-warning:    #D97706;  --color-warning-bg: #FFFBEB;
  --color-danger:     #DC2626;  --color-danger-bg:  #FEF2F2;
  --color-info:       #0EA5E9;  --color-info-bg:    #F0F9FF;

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --radius-sm: 6px;  --radius-md: 8px;  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --transition: 150ms ease;
}

.dark {
  --color-brand: #6366F1;  --color-brand-light: #1E1B4B;
  --color-bg-primary: #0F0F10;  --color-bg-secondary: #18181B;  --color-bg-tertiary: #27272A;
  --color-text-primary: #F9FAFB;  --color-text-secondary: #A1A1AA;  --color-text-tertiary: #71717A;
  --color-border: #3F3F46;  --color-border-focus: #6366F1;
  --color-success: #4ADE80;  --color-success-bg: #052E16;
  --color-warning: #FCD34D;  --color-warning-bg: #1C1004;
  --color-danger: #F87171;  --color-danger-bg: #1C0A0A;
  --color-info: #38BDF8;  --color-info-bg: #082F49;
}
```

### 13.2 Pages

| Page | Content |
|---|---|
| **Landing (`/`)** | Animated hero with gradient. "Add to Slack" primary CTA. 3-step how-it-works with icons. Feature grid. Social proof section. Fully responsive. |
| **Login / Signup** | Centered card with subtle gradient background. Email + password. Magic link option. Smooth transitions between login/signup. |
| **Overview (`/dashboard`)** | 4 animated `MetricCard`s with sparkline charts. Live `TaskFeed` with Supabase realtime. Status distribution donut chart. Response time trend line chart. |
| **Workspaces** | Card grid (not just a table). Each workspace card shows: name, channel count, role config status, last activity. Expand card → inline role editor. "Add to Slack" floating action button. |
| **Tasks** | `DataTable` + sidebar filter panel: status chips, workspace dropdown, category pills, date range picker. Full-text search with debounce. `TaskDetailModal`: timeline visualization showing each status change, original text, AI draft, edits, final text. |
| **Activity** | Reverse-chronological feed with icons per action type. Filter by workspace, action, date. Infinite scroll. |
| **Settings** | Tabbed layout: (1) Role Config — drag-and-drop role assignment per category, (2) Notification Prefs — quiet hours, category filters per role, (3) Workspace Config — channel filtering, AI model selection. |

### 13.3 Enhanced UI/UX Details

**Landing page:**
- Animated gradient hero (CSS `@keyframes` on background-position)
- 3-step "How it works" with animated step connectors
- Feature cards with hover lift + icon accent color
- Responsive: stacks vertically on mobile, 2-col on tablet, 3-col on desktop

**Dashboard:**
- `MetricCard` — number animates counting up on mount (counter animation). Sparkline mini-chart (last 7 days). Percentage change badge (↑ green / ↓ red).
- `TaskFeed` — realtime updates via Supabase `on('INSERT')`. New items slide in from top with fade animation. Relative timestamps ("2 min ago").
- Charts — lightweight chart library (e.g. `recharts` or pure SVG). Status donut + response time line.

**Task detail modal:**
- Status timeline: vertical steps with colored dots + timestamps for each state change
- Side-by-side diff between AI draft and final sent text (if edited)
- "Regenerate Draft" button to re-run the AI pipeline

**Micro-interactions:**
- Button press: scale(0.97) → scale(1) spring animation
- Card hover: subtle translateY(-2px) + shadow increase
- Badge: subtle pulse animation on status change
- Page transitions: fade + slight slide (150ms)
- Skeleton loaders match exact content layout
- Toast: slide-in from right, slide-out on dismiss

**Responsive breakpoints:**
- `< 640px` — mobile: sidebar hidden, hamburger menu, stacked cards
- `640–1024px` — tablet: collapsible sidebar, 2-col grid
- `> 1024px` — desktop: full sidebar, 3-col grid

### 13.4 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Topbar (56px) — breadcrumb · PipelineStatus · theme toggle │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  Main content                                │
│  (240px)     │  max-width: 1280px, centered                 │
│              │                                               │
│  Overview    │                                               │
│  Workspaces  │                                               │
│  Tasks       │                                               │
│  Activity    │                                               │
│  Settings    │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

### 13.5 Component specs

| Component | Spec |
|---|---|
| **Button** | Variants: primary (gradient), secondary (outline), ghost (text), danger. Sizes: sm/md/lg. Loading spinner. Press animation. Icon+text support. |
| **Card** | Border, radius, padding `1.25rem`. Hover lift. Optional header/footer. Skeleton variant. |
| **Badge** | Color-coded pills with subtle background: `pending→warning`, `approved→success`, `dismissed→secondary`, `bug→danger`, `feature→brand`. |
| **DataTable** | Sortable columns (click header, arrow indicator). Client pagination (10/25/50). Row hover highlight. Empty state with illustration. Skeleton rows. Bulk select. |
| **Modal** | Headless UI Dialog. Backdrop blur-sm. Centered card. Escape to close. Focus trap. Scale-in animation (150ms). Max-width configurable. |
| **Toast** | Bottom-right stack (max 5). Auto-dismiss 4s. Swipe dismiss on mobile. Success/error/info/warning. Progress bar countdown. |
| **TaskRow** | Category badge + status badge + workspace tag + assignee avatar + relative timestamp. Click to expand inline preview. Full detail via modal. |
| **MetricCard** | Large number with count-up animation. Trend badge (↑↓). Mini sparkline chart. Subtitle label. |
| **StatusTimeline** | Vertical timeline with colored dots per status. Timestamps. Actor labels. Used in task detail modal. |

---

## 14. Additional Features

### 14.1 Activity Log & Audit Trail

Every significant event is logged to `activity_log`. The Activity page shows a reverse-chronological feed:

```
🟢 Task #a1b2 approved by telegram:123456 — 2 min ago
🤖 AI draft generated for task #a1b2 (452 tokens, 1.2s) — 3 min ago
📥 New task created from #support: "checkout broken" — 3 min ago
✏️ Task #c3d4 edited and sent by telegram:789012 — 15 min ago
```

### 14.2 Duplicate Message Detection

`lib/slack/dedup.ts` — Prevents processing the same message twice (Slack sometimes sends duplicate webhooks):

- Hash `team_id + channel + ts` → check against recent task `thread_ts` values
- Skip if duplicate found within last 60 seconds
- Also prevents re-processing if user edits a message (different `subtype`)

### 14.3 Channel Filtering

Not all channels need monitoring. Per-workspace configuration:

```sql
-- Add to workspaces table
ALTER TABLE workspaces ADD COLUMN monitored_channels TEXT[] DEFAULT '{}';  -- empty = all channels
```

- Empty array = monitor all channels (default)
- Populate via Settings UI = only monitor listed channels
- Checked in the events handler before dispatching to orchestrator

### 14.4 Priority Escalation

Tasks stuck in `draft_ready` for too long get escalated:

| Time stuck | Action |
|---|---|
| 30 min | Telegram reminder to assignee |
| 2 hours | Escalate to PM role (if configured) |
| 6 hours | Dashboard warning banner |

### 14.5 Quick Stats in Telegram

Bot command `/stats` returns a quick summary to the team member:

```
📊 Your stats (last 7 days)
• Tasks received: 23
• Approved: 18 (78%)
• Edited: 3 (13%)
• Dismissed: 2 (9%)
• Avg response time: 4.2 min
```

### 14.6 Notification Preferences

Per-role quiet hours + category filtering via `notification_preferences` table:
- Don't send Telegram notifications during quiet hours (queue them for morning)
- Filter which categories trigger notifications (e.g. PM only wants FEATURE)

### 14.7 Webhook Health Monitoring

Dashboard `PipelineStatus` indicator shows real-time health:

| Check | How |
|---|---|
| Slack webhook | Last event received timestamp (warn if > 10 min) |
| Telegram webhook | Ping bot API `getWebhookInfo()` — check for errors |
| OpenAI | Last successful AI call timestamp + avg latency |
| Supabase | Connection pool status |

---

## 15. Local Development & Tunneling

> Slack and Telegram require a public URL for webhooks. During local development, we use **ngrok** to tunnel `localhost:3000` to a public HTTPS URL.

### 15.1 Setup

```bash
# Install ngrok (one-time)
npm install -g ngrok
# OR download from https://ngrok.com/download

# Sign up at ngrok.com → get auth token
ngrok config add-authtoken <your-token>
```

### 15.2 Dev workflow

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start ngrok tunnel
ngrok http 3000

# ngrok outputs:
# Forwarding: https://abc123.ngrok-free.app → http://localhost:3000
```

### 15.3 Configure webhooks with tunnel URL

After starting ngrok, update these with the tunnel URL:

```bash
# 1. Update .env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app

# 2. Update Slack app (api.slack.com/apps)
#    Event Subscriptions → Request URL: https://abc123.ngrok-free.app/api/slack/events
#    OAuth Redirect URL: https://abc123.ngrok-free.app/api/slack/callback

# 3. Register Telegram webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://abc123.ngrok-free.app/api/telegram/webhook"
```

### 15.4 `npm run tunnel` convenience script

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "tunnel": "ngrok http 3000",
    "dev:full": "concurrently \"npm run dev\" \"npm run tunnel\""
  }
}
```

### 15.5 End-to-end local test sequence

| # | Step | Expected result |
|---|---|---|
| 1 | `npm run dev` + `ngrok http 3000` | Dev server + tunnel running |
| 2 | Update Slack Event URL to ngrok URL | Slack sends challenge → verified |
| 3 | Register Telegram webhook with ngrok URL | `{"ok":true}` response |
| 4 | Sign up at `localhost:3000/signup` | Account created, redirected to dashboard |
| 5 | Click "Add to Slack" on Workspaces page | Slack OAuth flow → workspace saved |
| 6 | Go to Settings → Create a role (Builder, with your Telegram chat_id) | Role saved |
| 7 | Map BUG category → Builder role for the workspace | Mapping saved |
| 8 | Send "The app is broken" in a monitored Slack channel | |
| 9 | Check ngrok inspector (`http://localhost:4040`) | POST /api/slack/events visible |
| 10 | Telegram notification arrives with AI draft + buttons | |
| 11 | Tap **✅ Approve** in Telegram | |
| 12 | Check Slack — threaded reply posted | |
| 13 | Check Dashboard — task shows status `sent` | |
| 14 | Check Activity page — full event timeline visible | |
| 15 | Send another message → tap **✏️ Edit** → type custom reply | Custom reply posted to Slack |
| 16 | Send another message → tap **❌ Dismiss** | No Slack reply, task dismissed |

> **Tip:** ngrok inspector at `http://localhost:4040` shows all incoming webhook requests with full headers/body — extremely useful for debugging.

---

## 16. Testing Strategy

```bash
npx vitest run              # All tests (MSW mocks OpenAI + Supabase)
npx vitest run tests/unit/  # Unit tests only
npx vitest                  # Watch mode
npx vitest run --coverage   # Coverage report
```

| Type | File | Covers |
|---|---|---|
| Unit | `classifier.test.ts` | BUG/FEATURE/GENERAL classification, confidence scoring |
| Unit | `ai-parser.test.ts` | JSON extraction, fence stripping, Zod validation, fallback |
| Unit | `ai-prompts.test.ts` | Template generation, version embedding |
| Unit | `rate-limiter.test.ts` | Sliding window math, DB upsert |
| Unit | `security.test.ts` | AES encrypt/decrypt round-trip, HMAC verification |
| Unit | `dedup.test.ts` | Duplicate message detection, timing edge cases |
| Integration | `ai-pipeline.test.ts` | Full 5-stage pipeline with mocked OpenAI |
| Integration | `slack-events.test.ts` | Webhook verification, event dispatch, channel filter |
| Integration | `telegram-callbacks.test.ts` | Approve/Edit/Dismiss flows, edit mode state |
| Integration | `orchestrator.test.ts` | End-to-end pipeline: event → task → draft → notify |
| Failure | `ai-timeout.test.ts` | Timeout at 30s, task marked `failed`, notification sent without draft |
| Failure | `ai-parse-error.test.ts` | Graceful plain_text fallback |
| E2E | `full-pipeline.test.ts` | Slack event → classify → AI draft → Telegram notify → approve → Slack reply |

---

## 17. Deployment Checklist

### 17.1 Supabase

```bash
# 1. Create project at supabase.com → copy credentials to .env
# 2. Run all migrations via Dashboard → SQL Editor
# 3. Enable RLS on all tables
# 4. Add service role bypass policies for webhook routes:
#    CREATE POLICY "service_role_bypass" ON tasks USING (true) WITH CHECK (true);
# 5. Enable Supabase Auth (email + password provider)
# 6. Generate TypeScript types:
supabase gen types typescript --project-id <id> > supabase/types.ts
# 7. Use pooler URL (port 6543) for DATABASE_URL
```

### 17.2 Slack App

```
1. Create app at api.slack.com/apps → "From scratch"
2. OAuth & Permissions → Bot Token Scopes: channels:history, chat:write, commands, users:read
3. OAuth & Permissions → Redirect: https://yourdomain.com/api/slack/callback
4. Event Subscriptions → Enable → URL: https://yourdomain.com/api/slack/events
5. Subscribe to bot events: message.channels
6. Copy SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET to .env
```

### 17.3 Telegram Bot

```bash
# 1. Message @BotFather → /newbot → copy token to TELEGRAM_BOT_TOKEN
# 2. After deploying, register webhook:
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://yourdomain.com/api/telegram/webhook"
# 3. Each assignee /start the bot once → get chat_id via getUpdates
# 4. Store chat_ids in roles.telegram_chat_id via Settings
```

### 17.4 Smoke test

| # | Step | Verify |
|---|---|---|
| 1 | `npm run dev` → `GET /api/health` | All services green |
| 2 | Sign up → Log in | Dashboard loads, empty state |
| 3 | "Add to Slack" → complete OAuth | Workspace appears in list |
| 4 | Settings → Configure roles + Telegram chat IDs | Roles saved |
| 5 | Settings → Map BUG/FEATURE/GENERAL → roles | Mappings saved |
| 6 | Send "app is broken" in Slack channel | Telegram notification w/ AI draft |
| 7 | Tap **Approve** in Telegram | Reply posted as Slack thread |
| 8 | Tap **Edit** → send edited text | Custom reply in Slack |
| 9 | Tap **Dismiss** | No Slack reply, task dismissed |
| 10 | Dashboard → check MetricCards + TaskFeed | Real data displayed |
| 11 | Activity page → check audit trail | Full event history |
| 12 | Send 21 requests in 1 min | 21st returns rate limit error |

---

*SlackFlow — Implementation Plan v4 — Next.js 15 + Supabase Auth + OpenAI (server-side) + Slack + Telegram*
