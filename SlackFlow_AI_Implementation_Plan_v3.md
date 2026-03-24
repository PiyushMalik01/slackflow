# SlackFlow AI — Implementation Plan v3

> **Stack:** Next.js 15 · Supabase (native client, no ORM) · ChatGPT device-login · GPT-4o-mini · Slack · Telegram

| | |
|---|---|
| **AI auth** | Keyless — ChatGPT device-login (primary) + API key fallback |
| **Users provide** | 0 API keys |
| **Approval flow** | Human-in-the-loop via Telegram |
| **Slack** | Multi-tenant, multi-workspace |

---

## Table of Contents

1. [Resolved Architecture Decisions](#1-resolved-architecture-decisions)
2. [Project Structure](#2-project-structure)
3. [Dependencies](#3-dependencies)
4. [Database Schema](#4-database-schema-supabase-postgresql--native-sql)
5. [Environment Variables](#5-environment-variables)
6. [Supabase Client Setup](#6-supabase-client-setup)
7. [ChatGPT Auth Pipeline](#7-chatgpt-auth-pipeline)
8. [AI Pipeline Core](#8-ai-pipeline-core)
9. [Slack Integration](#9-slack-integration)
10. [Telegram Approval Hub](#10-telegram-approval-hub)
11. [Pipeline Orchestrator](#11-pipeline-orchestrator)
12. [Security Model](#12-security-model)
13. [Frontend & Global Design System](#13-frontend--global-design-system)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment Checklist](#15-deployment-checklist)

---

## 1. Resolved Architecture Decisions

All major technical choices are locked before coding begins.

| Decision | Choice | Rationale |
|---|---|---|
| **AI auth (primary)** | ChatGPT device-login OAuth | User clicks Connect, enters a code once. Backend obtains + stores tokens. Zero `OPENAI_CLIENT_ID`/`SECRET`. Keyless UX. |
| **AI auth (fallback)** | Manual API key (optional) | `sk-...` paste. Encrypted at rest. Only used if device-login not connected. |
| **AI model** | `gpt-4o-mini` (configurable) | Fast (<2s), $0.15/1M input tokens, upgradeable per-workspace via DB config. |
| **Framework** | Next.js 15 App Router | Edge-ready, co-located API routes, React Server Components, TypeScript first. |
| **Database** | Supabase (`supabase-js` v2) | No Prisma, no ORM. Direct SQL via `supabase-js`. Built-in RLS, connection pooling for serverless. |
| **DB access pattern** | `supabase-js` typed client | Auto-generated TypeScript types from schema via `supabase gen types`. Schema changes via Supabase Dashboard SQL Editor. |
| **Token encryption** | AES-256-GCM (Node `crypto`) | All OAuth tokens + API keys encrypted at rest. IV stored alongside ciphertext. No third-party crypto deps. |
| **Telegram pattern** | `sendMessage` + `InlineKeyboardMarkup` | Public Bot API. `sendMessageDraft` does not exist. Same UX achieved with inline buttons. |
| **Slack verification** | HMAC-SHA256 + 5-min replay window | Prevents webhook spoofing. Standard Slack security requirement. |
| **Rate limiting** | DB-backed sliding window (`rate_limits` table) | Per-user, per-endpoint. No Redis needed. Supabase handles concurrent writes. |
| **Logging** | Pino + correlation IDs | Structured JSON. Correlation ID threads all pipeline stages. |
| **Design system** | Inter + Tailwind CSS | Linear/Notion aesthetic. Consistent tokens. Dark mode first-class. |

---

## 2. Project Structure

```
slackflow/
├── next.config.ts                    # Edge runtime, env validation
├── package.json
├── tsconfig.json                     # Strict TypeScript
├── .env.example
├── supabase/
│   ├── migrations/                   # Raw SQL migration files
│   └── types.ts                      # Auto-generated DB types (supabase gen types)
└── src/
    ├── app/
    │   ├── layout.tsx                # Root layout — Inter font, global CSS
    │   ├── page.tsx                  # Landing page
    │   └── api/
    │       ├── slack/
    │       │   ├── install/route.ts  # OAuth install redirect
    │       │   ├── callback/route.ts # OAuth token exchange
    │       │   └── events/route.ts   # Webhook handler (verify + dispatch)
    │       ├── telegram/
    │       │   └── webhook/route.ts  # Bot callback handler
    │       ├── auth/
    │       │   ├── connect/route.ts  # Initiate ChatGPT device-login
    │       │   ├── poll/route.ts     # Poll for device-login completion
    │       │   ├── apikey/route.ts   # Manual API key (optional fallback)
    │       │   ├── status/route.ts   # Connection status — masked
    │       │   └── disconnect/route.ts
    │       ├── ai/
    │       │   ├── chat/route.ts     # Streaming SSE chat endpoint
    │       │   └── draft/route.ts    # Force-regenerate a task draft
    │       └── health/route.ts       # Health check — all services
    ├── (dashboard)/
    │   ├── layout.tsx                # Sidebar + topbar shell
    │   ├── page.tsx                  # Overview — metrics + task feed
    │   ├── workspaces/page.tsx       # Connected Slack workspaces
    │   ├── tasks/page.tsx            # Paginated task feed + filters
    │   └── settings/page.tsx         # AI connection + role config
    ├── components/
    │   ├── layout/                   # Sidebar, Topbar, PageHeader
    │   ├── ui/                       # Button, Card, Badge, Input, Modal, Toast, Skeleton, DataTable
    │   ├── dashboard/                # MetricCard, TaskFeed, TaskRow, PipelineStatus
    │   └── settings/                 # AiConnectionCard, RoleConfigForm
    ├── lib/
    │   ├── db/
    │   │   ├── client.ts             # Supabase singleton (server + browser)
    │   │   └── queries.ts            # All DB query functions — typed
    │   ├── ai/
    │   │   ├── client.ts             # OpenAI gateway — singleton, retry, timeout
    │   │   ├── auth.ts               # Device-login + API key — full token lifecycle
    │   │   ├── pipeline.ts           # 6-stage pipeline
    │   │   ├── prompts.ts            # Prompt templates per category
    │   │   ├── parser.ts             # JSON extraction + Zod validation + fallback
    │   │   ├── cache.ts              # Staleness windows, pruning
    │   │   └── usage.ts              # Token tracking, cost estimation
    │   ├── slack/
    │   │   ├── oauth.ts              # Install + callback logic
    │   │   ├── events.ts             # Event parsing + dispatch
    │   │   ├── classifier.ts         # BUG / FEATURE / GENERAL + confidence score
    │   │   └── egress.ts             # Post approved reply as Slack thread
    │   ├── telegram/
    │   │   ├── bot.ts                # Bot client setup
    │   │   ├── notify.ts             # Send notification + inline buttons
    │   │   └── callbacks.ts          # Approve / Edit / Dismiss handlers
    │   ├── pipeline/
    │   │   ├── orchestrator.ts       # End-to-end wiring
    │   │   └── scheduler.ts          # node-cron scheduled jobs
    │   └── utils/
    │       ├── logger.ts             # Pino with request correlation ID
    │       ├── security.ts           # Slack sig verify, AES-256-GCM helpers
    │       ├── rate-limiter.ts       # Sliding-window, DB-backed
    │       └── errors.ts             # Custom typed error classes
    ├── styles/
    │   └── globals.css               # Design tokens, Tailwind base
    └── types/
        └── index.ts                  # Shared app-wide TypeScript types
```

---

## 3. Dependencies

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
| `@supabase/supabase-js` | Official Supabase client — DB queries, auth, realtime |
| `@supabase/ssr` | Server-side helpers for Next.js App Router cookie handling |
| `openai` | Official OpenAI SDK — chat completions, streaming, built-in retry |
| `@slack/web-api` | Slack API client — post messages, OAuth token exchange |
| `node-telegram-bot-api` | Telegram Bot API — send messages, inline keyboards, webhooks |
| `zod` | Runtime schema validation — AI output contracts + API input validation |
| `pino` | Structured JSON logging with correlation IDs |
| `node-cron` | Scheduled jobs — token refresh, cleanup, reminders |
| `@headlessui/react` | Accessible modal, dropdown, transition primitives |
| `msw` | Mock Service Worker — mock OpenAI + Supabase in tests |

---

## 4. Database Schema (Supabase PostgreSQL — Native SQL)

> No ORM. No Prisma. Direct `supabase-js` queries. Types auto-generated via `supabase gen types typescript`. All secrets encrypted before write — never stored raw.

Run all migrations via **Supabase Dashboard → SQL Editor**.

---

### 4.1 `workspaces`

```sql
CREATE TABLE workspaces (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_team_id     TEXT        UNIQUE NOT NULL,
  name              TEXT        NOT NULL,
  access_token_enc  TEXT        NOT NULL,   -- AES-256-GCM ciphertext
  access_token_iv   TEXT        NOT NULL,   -- 12-byte IV (hex)
  bot_user_id       TEXT        NOT NULL,
  installed_at      TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workspaces_team_id ON workspaces (slack_team_id);
```

### 4.2 `roles`

```sql
CREATE TABLE roles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             TEXT        NOT NULL CHECK (type IN ('BUILDER', 'TESTER', 'DESIGNER', 'PM')),
  name             TEXT        NOT NULL,
  telegram_chat_id TEXT,                   -- personal Telegram chat ID for notifications
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 `workspace_roles`

```sql
-- Maps: workspace × category → auto-assign target role
CREATE TABLE workspace_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role_id      UUID REFERENCES roles(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('BUG', 'FEATURE', 'GENERAL')),
  UNIQUE (workspace_id, category)  -- one assignee per category per workspace
);
```

### 4.4 `tasks`

```sql
-- Full lifecycle of every Slack message processed
CREATE TABLE tasks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  channel               TEXT        NOT NULL,
  thread_ts             TEXT        NOT NULL,    -- Slack thread timestamp
  original_text         TEXT        NOT NULL,
  category              TEXT        CHECK (category IN ('BUG', 'FEATURE', 'GENERAL')),
  category_confidence   REAL,                    -- 0.0–1.0 from classifier
  draft_text            TEXT,                    -- AI-generated reply
  edited_text           TEXT,                    -- human-edited override
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                      'pending', 'draft_ready', 'approved',
                                      'edited', 'dismissed', 'sent', 'failed'
                                    )),
  role_id               UUID        REFERENCES roles(id),
  telegram_message_id   INTEGER,                 -- for editing the Telegram notification
  ai_model              TEXT,
  draft_generated_at    TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_workspace_status ON tasks (workspace_id, status);
CREATE INDEX idx_tasks_created_at       ON tasks (created_at DESC);
```

### 4.5 `user_settings`

```sql
-- Per-user AI credentials — all secrets encrypted at rest
CREATE TABLE user_settings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        UNIQUE NOT NULL,
  auth_mode           TEXT        CHECK (auth_mode IN ('device_login', 'api_key')),
  access_token_enc    TEXT,       -- AES-256-GCM ciphertext
  access_token_iv     TEXT,       -- 12-byte IV (hex)
  refresh_token_enc   TEXT,
  refresh_token_iv    TEXT,
  token_expires_at    TIMESTAMPTZ,  -- for auto-refresh check (5-min buffer)
  api_key_enc         TEXT,       -- optional fallback
  api_key_iv          TEXT,
  connected_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### 4.6 `ai_analyses`

```sql
CREATE TABLE ai_analyses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  type              TEXT        NOT NULL,    -- 'bug_draft' | 'feature_draft' | 'chat'
  structured_data   JSONB,                   -- parsed model output
  raw_output        TEXT,                    -- verbatim model response
  prompt_version    TEXT        NOT NULL,    -- traceability across prompt changes
  source_data_hash  TEXT,                    -- hash of inputs (cache invalidation)
  generated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_analyses_user_type ON ai_analyses (user_id, type, generated_at DESC);
```

### 4.7 `ai_usage`

```sql
CREATE TABLE ai_usage (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id          UUID    REFERENCES ai_analyses(id) ON DELETE CASCADE,
  model                TEXT    NOT NULL,
  prompt_tokens        INTEGER NOT NULL,
  completion_tokens    INTEGER NOT NULL,
  latency_ms           INTEGER NOT NULL,
  status               TEXT    NOT NULL CHECK (status IN (
                         'success', 'timeout', 'rate_limited', 'parse_error', 'auth_error'
                       )),
  error_type           TEXT,
  cost_estimate_usd    REAL,   -- computed at write time from token counts × model pricing
  created_at           TIMESTAMPTZ DEFAULT now()
);
```

### 4.8 `rate_limits`

```sql
-- Sliding-window rate limiting, DB-backed — no Redis required
CREATE TABLE rate_limits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT        UNIQUE NOT NULL,  -- e.g. 'user:abc123:ai_draft'
  count        INTEGER     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_rate_limits_key ON rate_limits (key);
```

### Supabase-specific notes

- Enable **Row Level Security (RLS)** on all tables. Add service role bypass policies for API routes.
- After any schema change, regenerate types:
  ```bash
  supabase gen types typescript --project-id <project-id> > supabase/types.ts
  ```
- Use the **connection pooler URL (port 6543)** in `DATABASE_URL` — never the direct connection (port 5432) — for serverless Next.js functions.

---

## 5. Environment Variables

```bash
# ── Supabase ────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, never in NEXT_PUBLIC_

# ── Security ────────────────────────────────────────────────────────────
ENCRYPTION_KEY=<32-byte hex>   # generate: openssl rand -hex 32

# ── Slack ───────────────────────────────────────────────────────────────
SLACK_CLIENT_ID=<app client id>
SLACK_CLIENT_SECRET=<app client secret>
SLACK_SIGNING_SECRET=<signing secret>

# ── Telegram ────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=<bot token from @BotFather>

# ── OpenAI (OPTIONAL — only for manual API key fallback) ────────────────
# OPENAI_API_KEY=sk-...   # NOT required for device-login flow

# ── App ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

---

## 6. Supabase Client Setup

### `lib/db/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types'

// ── Server client (API routes + Server Components) ───────────────────────
// Uses service role key — bypasses RLS. Never expose to browser.
export function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Singleton for long-running processes (orchestrator, scheduler)
let _client: ReturnType<typeof createServerClient> | null = null
export function getServerClient() {
  if (!_client) _client = createServerClient()
  return _client
}

// ── Browser client (client components only) ──────────────────────────────
// Uses anon key — respects RLS. Safe to expose.
export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `lib/db/queries.ts`

All DB interactions live here — no scattered SQL across the codebase.

```typescript
import { getServerClient } from './client'
import { DbError } from '@/lib/utils/errors'
import type { Database } from '@/supabase/types'

type Task       = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']
type TaskStatus = 'pending' | 'draft_ready' | 'approved' | 'edited' | 'dismissed' | 'sent' | 'failed'

// ── Workspaces ────────────────────────────────────────────────────────────

export async function getWorkspaceByTeamId(teamId: string) {
  const db = getServerClient()
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('slack_team_id', teamId)
    .single()
  if (error) throw new DbError('workspace_not_found', error.message)
  return data
}

export async function upsertWorkspace(workspace: {
  slack_team_id: string
  name: string
  access_token_enc: string
  access_token_iv: string
  bot_user_id: string
}) {
  const db = getServerClient()
  const { data, error } = await db
    .from('workspaces')
    .upsert(workspace, { onConflict: 'slack_team_id' })
    .select()
    .single()
  if (error) throw new DbError('workspace_upsert_failed', error.message)
  return data
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export async function createTask(task: TaskInsert) {
  const db = getServerClient()
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
  const db = getServerClient()
  const { error } = await db
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id)
  if (error) throw new DbError('task_update_failed', error.message)
}

export async function getTaskById(id: string) {
  const db = getServerClient()
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
  const db = getServerClient()
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

// ── User settings ─────────────────────────────────────────────────────────

export async function getUserSettings(userId: string) {
  const db = getServerClient()
  const { data } = await db
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data   // null if not found — handled by caller
}

export async function upsertUserSettings(
  userId: string,
  settings: Partial<Database['public']['Tables']['user_settings']['Insert']>
) {
  const db = getServerClient()
  const { error } = await db
    .from('user_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() },
             { onConflict: 'user_id' })
  if (error) throw new DbError('user_settings_upsert_failed', error.message)
}

// ── Rate limits ───────────────────────────────────────────────────────────

export async function checkAndIncrementRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const db = getServerClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  const { data } = await db
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .single()

  if (!data || new Date(data.window_start) < windowStart) {
    // New window
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

## 7. ChatGPT Auth Pipeline

> The single most important module. All AI calls go through `getCredentials()` — they never touch tokens directly.

### `lib/ai/auth.ts`

#### Device-login flow (primary path)

```
POST /api/auth/connect
  → Backend calls OpenAI device authorization endpoint
  → Returns: { device_code, user_code, verification_uri, expires_in, interval }

Frontend shows:
  → user_code (e.g. "ABCD-1234")
  → link to verification_uri (e.g. https://auth.openai.com/device)
  → "Enter this code on the page that opens"

GET /api/auth/poll (called every `interval` seconds by frontend)
  → Backend polls OpenAI token endpoint with device_code
  → On completion: receives { access_token, refresh_token, expires_in }
  → Encrypt both tokens with AES-256-GCM
  → Upsert user_settings: auth_mode='device_login', encrypted tokens, token_expires_at

User is now connected. No OPENAI_CLIENT_ID or OPENAI_CLIENT_SECRET required.
```

#### `getCredentials(userId)` — called before every AI request

```typescript
export async function getCredentials(userId: string): Promise<string> {
  const settings = await getUserSettings(userId)

  if (!settings?.auth_mode) {
    throw new AiAuthError('not_connected', 'No AI credentials found. Connect ChatGPT in Settings.')
  }

  if (settings.auth_mode === 'device_login') {
    const expiresAt = new Date(settings.token_expires_at!)
    const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)

    if (expiresAt < fiveMinFromNow) {
      // Auto-refresh
      try {
        const { access_token, refresh_token, expires_in } = await refreshOpenAIToken(
          decrypt(settings.refresh_token_enc!, settings.refresh_token_iv!)
        )
        const { enc: atEnc, iv: atIv } = encrypt(access_token)
        const { enc: rtEnc, iv: rtIv } = encrypt(refresh_token)
        await upsertUserSettings(userId, {
          access_token_enc: atEnc, access_token_iv: atIv,
          refresh_token_enc: rtEnc, refresh_token_iv: rtIv,
          token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        })
        return access_token
      } catch {
        throw new AiAuthError('reconnect_required', 'Token refresh failed. Please reconnect ChatGPT.')
      }
    }

    return decrypt(settings.access_token_enc!, settings.access_token_iv!)
  }

  if (settings.auth_mode === 'api_key') {
    return decrypt(settings.api_key_enc!, settings.api_key_iv!)
  }

  throw new AiAuthError('unknown_mode', 'Unknown auth mode.')
}
```

#### Status endpoint — `GET /api/auth/status`

```typescript
// Returns — never exposes raw tokens
{ connected: false }
{ connected: true, mode: 'device_login', connectedAt: '2025-...' }
{ connected: true, mode: 'api_key',      connectedAt: '2025-...' }
{ connected: false, error: 'reconnect_required' }
```

---

## 8. AI Pipeline Core

### `lib/ai/pipeline.ts` — 6 composable stages

```
collect(ctx) → enrich(data)? → buildPrompt(data) → generate(prompt, creds) → parse(raw) → persist(result)
```

Each stage returns `PipelineResult<T>` with `correlationId`, `latencyMs`, and `status`.

| Stage | Function | Detail |
|---|---|---|
| **1. Collect** | `collect(ctx)` | Pull Slack message, thread history, workspace meta, role config from Supabase. Returns typed `CollectResult`. |
| **2. Enrich** | `enrich(data)` | Optional. Add conversation thread, prior task history. Skippable — composable pipeline. |
| **3. Prompt** | `buildPrompt(data)` | Route to `bugDraftPrompt` / `featureDraftPrompt` / `generalDraftPrompt`. System message enforces strict JSON output. Prompt version string embedded. |
| **4. Generate** | `generate(prompt, creds)` | Call `gpt-4o-mini` via authenticated client. 3 retries with exponential backoff on 429/5xx. 30s timeout. Token budget enforced. |
| **5. Parse** | `parse(raw)` | Strip markdown fences. Extract JSON. Zod schema validation. Fallback to `{ type: "plain_text", content: raw }` on failure. |
| **6. Persist** | `persist(result)` | Write `ai_analyses` + `ai_usage` rows. Update `task.draft_text` + `task.status = 'draft_ready'`. |

### `lib/ai/prompts.ts`

```typescript
export const PROMPT_VERSIONS = {
  bug:     'v1.2',
  feature: 'v1.1',
  general: 'v1.0',
}

export function bugDraftPrompt(msg: string, workspace: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a helpful support agent for ${workspace}.
Reply with ONLY valid JSON in this exact shape:
{"draft":"<reply text>","tone":"empathetic","estimated_fix_time":"<timeframe>"}
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
Reply with ONLY valid JSON:
{"draft":"<reply text>","tone":"enthusiastic","priority_hint":"low|medium|high"}
No markdown. JSON only. Prompt version: ${PROMPT_VERSIONS.feature}`,
    },
    { role: 'user', content: `Client message: ${msg}` },
  ]
}
```

### `lib/ai/parser.ts`

```typescript
import { z } from 'zod'

const BugDraftSchema = z.object({
  draft: z.string().min(1),
  tone: z.string(),
  estimated_fix_time: z.string().optional(),
})

export function parseAiOutput(raw: string, schema: z.ZodSchema) {
  // 1. Strip markdown fences
  const stripped = raw.replace(/```json\n?|\n?```/g, '').trim()

  // 2. Extract JSON if mixed with text
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { type: 'plain_text', content: raw } as const
  }

  // 3. Validate against Zod schema
  try {
    const parsed = JSON.parse(jsonMatch[0])
    return schema.parse(parsed)
  } catch {
    return { type: 'plain_text', content: raw } as const
  }
}
```

### `lib/utils/errors.ts`

```typescript
export class AiAuthError extends Error {
  constructor(public code: 'not_connected' | 'reconnect_required' | 'unknown_mode', message: string) {
    super(message); this.name = 'AiAuthError'
  }
}
export class AiRateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super('OpenAI rate limit hit'); this.name = 'AiRateLimitError'
  }
}
export class AiTimeoutError extends Error {
  constructor() { super('AI request timed out after 30s'); this.name = 'AiTimeoutError' }
}
export class AiParseError extends Error {
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

## 9. Slack Integration

### `POST /api/slack/events`

```typescript
// 1. Verify Slack HMAC-SHA256 signature + 5-min replay window → 401 if invalid
// 2. Handle URL verification challenge (initial setup)
// 3. Filter: type=message.channels only. Skip messages with bot_id.
// 4. Dispatch to orchestrator.handle(event, workspaceId)
```

### `lib/slack/classifier.ts`

```typescript
type Category   = 'BUG' | 'FEATURE' | 'GENERAL'
type ClassifyResult = {
  category: Category
  confidence: number        // 0.0–1.0
  matchedKeywords: string[]
}

const BUG_KEYWORDS     = ['bug', 'broken', 'error', 'crash', 'not working', 'issue', 'fail']
const FEATURE_KEYWORDS = ['feature', 'request', 'suggestion', 'add', 'would be nice', 'can you add']

export function classify(text: string): ClassifyResult {
  const lower = text.toLowerCase()
  const bugMatches     = BUG_KEYWORDS.filter(k => lower.includes(k))
  const featureMatches = FEATURE_KEYWORDS.filter(k => lower.includes(k))

  if (bugMatches.length > featureMatches.length) {
    return { category: 'BUG',     confidence: Math.min(bugMatches.length / 3, 1), matchedKeywords: bugMatches }
  }
  if (featureMatches.length > 0) {
    return { category: 'FEATURE', confidence: Math.min(featureMatches.length / 3, 1), matchedKeywords: featureMatches }
  }
  return { category: 'GENERAL', confidence: 1.0, matchedKeywords: [] }
}
```

### `lib/slack/egress.ts`

Decrypt workspace `access_token` → call `chat.postMessage` with `thread_ts` → update `task.status = 'sent'`.

### `lib/slack/oauth.ts`

```
GET /api/slack/install
  → Redirect to Slack OAuth consent URL
  → Scopes: channels:history, chat:write, commands, users:read

GET /api/slack/callback?code=...
  → Exchange code for access_token
  → Encrypt token (AES-256-GCM)
  → Upsert workspaces row (slack_team_id as conflict key)
  → Redirect to /workspaces with success toast
```

---

## 10. Telegram Approval Hub

### Notification format (`lib/telegram/notify.ts`)

```
<b>New task assigned to you</b>

<b>Workspace:</b> Acme Corp
<b>Channel:</b> #support
<b>Category:</b> BUG  (confidence: 92%)

<b>Client message:</b>
"The checkout button is broken on mobile"

<b>AI draft reply:</b>
"Hi! We've received your report and are investigating urgently. We'll update you within 2 hours."
```

Inline keyboard:

```
[ ✅ Approve ]  [ ✏️ Edit ]  [ ❌ Dismiss ]
```

Callback data encodes: `{taskId}:approve` / `{taskId}:edit` / `{taskId}:dismiss`

### Callback handlers (`lib/telegram/callbacks.ts`)

| Action | Handler |
|---|---|
| **Approve** | Update task `status → 'approved'`. Call `egress.postReply()`. Edit Telegram message to "✅ Approved and sent." Update `status → 'sent'`. |
| **Edit** | Edit Telegram message to "Send your edited reply:". Wait for next text from same `chat_id`. Use that text as `edited_text`. Post to Slack. `status → 'edited' → 'sent'`. |
| **Dismiss** | `status → 'dismissed'`. Edit Telegram message to "❌ Dismissed." No Slack reply sent. |

---

## 11. Pipeline Orchestrator

### `lib/pipeline/orchestrator.ts`

```
Slack event (verified)
  → classify(message.text)  →  { category, confidence }
  → resolveRole(workspaceId, category)  →  role (with telegram_chat_id)
  → createTask(...)  →  task record (status: 'pending')
  → runAiPipeline(task)  →  draft_text  →  task (status: 'draft_ready')
  → telegram.notify(role.telegram_chat_id, task)
  → [awaits Telegram callback via separate webhook route]
  → on Approve: egress.postReply(task)  →  task (status: 'sent')
```

`orchestrator.handle()` is **async but non-blocking** — it does not await the Telegram callback. The task row tracks all state transitions.

### `lib/pipeline/scheduler.ts` — `node-cron` jobs

```typescript
// Every 5 min: remind assignee about tasks stuck in draft_ready > 30 min
cron.schedule('*/5 * * * *', remindStaleTasks)

// Every 1 hour: prune ai_analyses older than 7 days (keep latest 50 per user)
cron.schedule('0 * * * *', pruneOldAnalyses)

// Every 6 hours: proactively refresh tokens expiring within 30 min
cron.schedule('0 */6 * * *', proactiveTokenRefresh)

// On startup: verify all workspace Slack tokens are still valid
verifyAllWorkspaceTokens()
```

---

## 12. Security Model

| Concern | Implementation |
|---|---|
| **Token storage** | AES-256-GCM encryption. Key from `ENCRYPTION_KEY` env var (32-byte hex). Separate IV (12 bytes, random) per value. IV stored alongside ciphertext. |
| **Slack webhooks** | HMAC-SHA256 signature verification on every `POST /api/slack/events`. 5-minute timestamp replay window. 401 on failure — no processing. |
| **Supabase access** | Service role key used server-side only. Never in `NEXT_PUBLIC_` vars. RLS enabled on all tables as defense in depth. |
| **Raw token logging** | Never logged. Pino `redactFields` explicitly masks: `access_token_enc`, `api_key_enc`, any field named `token` or `key`. |
| **Rate limiting** | Per-user sliding-window in `rate_limits` table. AI draft: 20/min. Install: 5/hour. Chat: 30/min. |
| **Input validation** | Zod schemas on all API route inputs. 400 on failure before any processing. |

### `lib/utils/security.ts`

```typescript
import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(plaintext: string): { enc: string; iv: string } {
  const iv  = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    enc: Buffer.concat([enc, tag]).toString('base64'),
    iv:  iv.toString('hex'),
  }
}

export function decrypt(enc: string, ivHex: string): string {
  const iv  = Buffer.from(ivHex, 'hex')
  const buf = Buffer.from(enc, 'base64')
  const tag = buf.slice(buf.length - 16)
  const ciphertext = buf.slice(0, buf.length - 16)
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false  // replay window
  const baseString = `v0:${timestamp}:${body}`
  const expected   = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex')
  return signature === expected
}
```

---

## 13. Frontend & Global Design System

> Philosophy: **Linear + Notion aesthetic.** Flat, purposeful, no decorative effects. Dark mode is first-class from day one.

### 13.1 Design tokens — `styles/globals.css`

```css
:root {
  /* ── Brand ─────────────────────────────────────────────────── */
  --color-brand:        #4F46E5;   /* indigo-600 — primary CTA, active nav */
  --color-brand-hover:  #4338CA;
  --color-brand-light:  #EEF2FF;   /* indigo-50 — tint backgrounds */

  /* ── Backgrounds ───────────────────────────────────────────── */
  --color-bg-primary:   #FFFFFF;   /* page background */
  --color-bg-secondary: #F9FAFB;   /* sidebar, cards, inputs */
  --color-bg-tertiary:  #F3F4F6;   /* hover states, badges */

  /* ── Text ───────────────────────────────────────────────────── */
  --color-text-primary:   #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary:  #9CA3AF;
  --color-text-brand:     #4F46E5;

  /* ── Borders ───────────────────────────────────────────────── */
  --color-border:       #E5E7EB;
  --color-border-focus: #4F46E5;

  /* ── Semantic ───────────────────────────────────────────────── */
  --color-success:      #16A34A;
  --color-success-bg:   #F0FDF4;
  --color-warning:      #D97706;
  --color-warning-bg:   #FFFBEB;
  --color-danger:       #DC2626;
  --color-danger-bg:    #FEF2F2;
  --color-info:         #0EA5E9;
  --color-info-bg:      #F0F9FF;

  /* ── Typography ─────────────────────────────────────────────── */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* ── Spacing & Shape ────────────────────────────────────────── */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* ── Elevation ──────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

  /* ── Motion ─────────────────────────────────────────────────── */
  --transition: 150ms ease;
}

/* ── Dark mode ──────────────────────────────────────────────────────────── */
.dark {
  --color-brand:          #6366F1;
  --color-brand-light:    #1E1B4B;

  --color-bg-primary:     #0F0F10;
  --color-bg-secondary:   #18181B;
  --color-bg-tertiary:    #27272A;

  --color-text-primary:   #F9FAFB;
  --color-text-secondary: #A1A1AA;
  --color-text-tertiary:  #71717A;
  --color-text-brand:     #818CF8;

  --color-border:         #3F3F46;
  --color-border-focus:   #6366F1;

  --color-success:        #4ADE80;
  --color-success-bg:     #052E16;
  --color-warning:        #FCD34D;
  --color-warning-bg:     #1C1004;
  --color-danger:         #F87171;
  --color-danger-bg:      #1C0A0A;
  --color-info:           #38BDF8;
  --color-info-bg:        #082F49;
}
```

### 13.2 Dark mode strategy

- CSS custom properties switch via `class="dark"` on `<html>` (not `prefers-color-scheme` alone — user preference overrides system).
- User preference stored in `localStorage`. System preference used as default on first visit.
- All colors use `var(--color-*)` tokens — never hardcoded hex in component CSS.
- Tailwind `dark:` variant used for conditional dark styles.
- Charts and SVG re-render on theme change via React context.

```typescript
// app/layout.tsx — inject theme class before paint to avoid flash
const themeScript = `
  const stored = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark')
  }
`
```

### 13.3 Component specifications

| Component | Specification |
|---|---|
| **Button** | Variants: `primary` (brand bg), `secondary` (outline), `ghost` (text only), `danger`. Sizes: sm/md/lg. Loading spinner. Disabled state. Icon support. |
| **Card** | White/dark bg, `0.5px` border, `--radius-md`. Padding `1.25rem`. Hover: slight border darkening. Optional header/footer slots. |
| **Badge** | Color-coded pills. `pending→warning`, `approved→success`, `dismissed→secondary`, `bug→danger`, `feature→brand`, `general→info`. |
| **Input / Select** | 36px height, `0.5px` border, focus ring (brand, 2px offset). Error state (danger border + message below). Label above. Hint text below. |
| **Modal** | Headless UI `Dialog`. Backdrop `blur-sm`. Centered card. Escape to close. Focus trap. `150ms` enter/leave animation. |
| **Toast** | Bottom-right stack. Max 5 visible. Auto-dismiss 4s. Swipe to dismiss on mobile. Variants: success / error / info / warning. |
| **DataTable** | Sortable columns (click header). Client pagination (10/25/50). Row click handler. Empty state. Loading skeleton rows. Search input. |
| **Skeleton** | Pulse animation. Matches exact shape of content it replaces. |
| **AiConnectionCard** | Mode display (`device_login` / `api_key` / disconnected). Masked token. Connect button. Disconnect link. Status polling every 5s. |
| **PipelineStatus** | Topbar dot. Green=healthy / amber=degraded / red=down. Tooltip with last-check time. Polls every 30s. |
| **TaskRow** | Category badge + status badge + workspace tag + assignee + timestamp. Expandable inline for original message + AI draft. Click → detail modal. |

### 13.4 Pages

| Page | Content |
|---|---|
| **Landing (`/`)** | Hero: name + tagline + "Install to Slack" CTA + "Connect ChatGPT" secondary CTA. 3-step how-it-works. Feature list. Clean marketing page — no sidebar. |
| **Overview (`/dashboard`)** | 4 `MetricCard`s: tasks today, p50 response time, approval rate %, active workspaces. Live `TaskFeed` (last 20, Supabase realtime). `PipelineStatus`. |
| **Workspaces** | `DataTable`: name, team ID, connected date, roles configured, status. Row click: edit role mappings per category. Empty state with Install CTA. |
| **Tasks** | `DataTable` + filters: status multiselect, workspace, category, date range. Full-text search. `TaskDetailModal`: original text, AI draft, edit history, status timeline. |
| **Settings** | Section 1: `AiConnectionCard` (device-login flow + optional API key). Section 2: `RoleConfigForm` — per workspace, map BUG/FEATURE/GENERAL to role + Telegram chat ID. |

### 13.5 Layout grid

```
┌─────────────────────────────────────────────────────────────┐
│  Topbar (56px) — breadcrumb · PipelineStatus · theme toggle  │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  Main content                                 │
│  (240px)     │  max-width: 1280px, centered                 │
│              │  padding: 2rem                               │
│  Overview    │                                              │
│  Workspaces  │                                              │
│  Tasks       │                                              │
│  Settings    │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- Sidebar: 240px fixed on desktop, slide-over drawer on mobile (< 768px).
- All transitions: `150ms ease`.
- Content cards: `max-width: 100%` within their grid column.

---

## 14. Testing Strategy

```bash
# Unit tests (no credentials needed — all mocked)
npx vitest run tests/unit/

# All tests (uses MSW to mock OpenAI + Supabase)
npx vitest run

# Watch mode
npx vitest

# Coverage
npx vitest run --coverage
```

| Type | File | Covers |
|---|---|---|
| Unit | `classifier.test.ts` | BUG/FEATURE/GENERAL classification, edge cases, confidence scoring |
| Unit | `ai-parser.test.ts` | JSON extraction, fence stripping, Zod validation, plain_text fallback |
| Unit | `ai-prompts.test.ts` | Template generation, JSON contract enforcement, version embedding |
| Unit | `ai-cache.test.ts` | Staleness detection, pruning logic, cache metadata |
| Unit | `rate-limiter.test.ts` | Sliding window math, per-user limits, DB upsert pattern |
| Unit | `security.test.ts` | AES-256-GCM encrypt/decrypt round-trip, HMAC-SHA256 verification |
| Integration | `ai-pipeline.test.ts` | Full 6-stage pipeline with mocked OpenAI and Supabase |
| Integration | `auth-flow.test.ts` | Device-login exchange, token refresh, API key encrypt/decrypt, `getCredentials()` |
| Integration | `slack-events.test.ts` | Webhook verification, event dispatch, orchestrator integration |
| Integration | `telegram-callbacks.test.ts` | Approve / Edit / Dismiss flows end-to-end |
| Failure | `timeout.test.ts` | `AiTimeoutError` at 30s, task marked `failed` |
| Failure | `rate-limit-429.test.ts` | Retry + exponential backoff, `AiRateLimitError` after 3 attempts |
| Failure | `malformed-output.test.ts` | Graceful plain_text fallback, parse error logged correctly |

---

## 15. Deployment Checklist

### 15.1 Supabase setup

```bash
# 1. Create project at supabase.com. Copy credentials to .env.

# 2. Run all migrations via Dashboard → SQL Editor (paste each migration file).

# 3. Enable RLS on all tables via Dashboard → Authentication → Policies.
#    Add service role bypass policy for each table:
#    CREATE POLICY "service_role_bypass" ON tasks USING (true) WITH CHECK (true);
#    (only applies when using service_role_key)

# 4. Create required indexes (if not in migration files):
#    CREATE INDEX idx_tasks_workspace_status ON tasks (workspace_id, status);
#    CREATE INDEX idx_tasks_created_at       ON tasks (created_at DESC);
#    CREATE INDEX idx_rate_limits_key        ON rate_limits (key);

# 5. Generate TypeScript types:
supabase gen types typescript --project-id <project-id> > supabase/types.ts

# 6. Verify you're using the pooler URL (port 6543) not direct (port 5432).
```

### 15.2 Slack app setup

```
1. Create app at api.slack.com/apps → "From scratch"

2. OAuth & Permissions → Scopes:
   Bot Token Scopes: channels:history, chat:write, commands, users:read

3. OAuth & Permissions → Redirect URLs:
   https://yourdomain.com/api/slack/callback

4. Event Subscriptions → Enable → Request URL:
   https://yourdomain.com/api/slack/events

5. Event Subscriptions → Subscribe to bot events:
   message.channels

6. Copy to .env:
   SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET
```

### 15.3 Telegram bot setup

```bash
# 1. Message @BotFather on Telegram → /newbot → follow prompts
#    Copy token to TELEGRAM_BOT_TOKEN

# 2. After deploying, register webhook:
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://yourdomain.com/api/telegram/webhook"

# 3. Each team member must /start the bot once to generate their chat_id.
#    To find a chat_id, the bot can echo it back:
#    GET https://api.telegram.org/bot{TOKEN}/getUpdates

# 4. Store chat_ids in roles.telegram_chat_id via Settings → Role Config.
```

### 15.4 Manual verification sequence

| # | Step |
|---|---|
| 1 | `npm run dev` → `GET /api/health` → all services show green |
| 2 | Visit `/api/slack/install` → complete OAuth → workspace row appears in Supabase |
| 3 | Settings → Connect ChatGPT → complete device-login → status shows "connected" |
| 4 | Send a message to a connected Slack channel → Telegram notification arrives |
| 5 | Tap **Approve** in Telegram → threaded reply appears in Slack within 3s |
| 6 | Tap **Edit** → send edited text → edited reply posted to Slack |
| 7 | Test streaming chat: `POST /api/ai/chat` → SSE stream responds |
| 8 | Send 21 AI draft requests in 1 min → 21st returns 429 |
| 9 | Disconnect ChatGPT in Settings → next AI call returns `{ error: "not_connected" }` |
| 10 | Reconnect ChatGPT → AI calls work immediately with no manual intervention |

### 15.5 Production monitoring (first 24h)

- **Pino logs** — watch for `AiAuthError`, `AiRateLimitError`, `AiParseError` with correlation IDs.
- **Supabase** → `ai_usage` table — check `avg(latency_ms)` and `sum(cost_estimate_usd)`.
- **Supabase** → `tasks` table — watch for tasks stuck in `draft_ready` for > 30 min.
- **Health endpoint** — poll `GET /api/health` every 60s from your monitoring tool.
- **Telegram** — confirm notifications arrive within 5s of Slack message.
- **Rate limits** — query `rate_limits` for any `key` with `count` near threshold.

---

*SlackFlow AI — Implementation Plan v3 — Next.js 15 + Supabase (native) + ChatGPT device-login + GPT-4o-mini*
