# SlackFlow Targeted Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SlackFlow from a functional prototype into a production-grade, polished AI-powered Slack-to-Telegram task routing platform with custom categories, invite-link onboarding, team group transparency, multi-workspace clarity, and a professional UI.

**Architecture:** Next.js 16 App Router with Supabase (PostgreSQL + Auth + Realtime), OpenAI GPT-4o-mini for classification + drafting, Telegram Bot API for notifications and approvals, Slack Web API for OAuth and message handling. All background work uses Next.js `after()` for serverless-safe execution.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5, Supabase, Tailwind CSS 4, shadcn/ui, OpenAI SDK, @slack/web-api, node-telegram-bot-api, Zod, Pino, Sonner

**Spec:** `docs/superpowers/specs/2026-03-24-slackflow-targeted-rebuild-design.md`

---

## File Structure Overview

### New Files to Create

```
lib/
  ai/
    classifier.ts              — AI-powered classifier (replaces lib/slack/classifier.ts)
    schemas.ts                 — Zod schemas for AI response validation
  telegram/
    commands.ts                — Bot command handlers (/start, /pending, /status, /help)
    group-notify.ts            — Team group notification functions
    sessions.ts                — DB-backed session management (replaces in-memory Map)
  slack/
    channels.ts                — Channel discovery and management
    user-cache.ts              — Slack user profile resolution + caching
  utils/
    csrf.ts                    — CSRF origin/referer validation
    api-helpers.ts             — Shared API response helpers, error formatting
    idempotency.ts             — Processed events dedup logic

app/
  api/
    categories/route.ts        — CRUD for custom categories
    invite-tokens/route.ts     — Generate/regenerate invite links
    workspaces/
      [id]/channels/route.ts   — Fetch & toggle monitored channels
    telegram/
      webhook/route.ts         — Rewritten with secret token validation

components/
  error-boundary.tsx           — React error boundary with retry
  loading-skeleton.tsx         — Reusable skeleton loader
  workspace-switcher.tsx       — Workspace dropdown for sidebar
  category-badge.tsx           — Color-coded category badge
  status-pill.tsx              — Color-coded status indicator
  task-card.tsx                — Expandable task detail card
  invite-link-button.tsx       — Copy-to-clipboard invite link
  channel-toggle-card.tsx      — Channel monitor toggle

supabase/
  migrations/
    004_categories_and_invite_tokens.sql
    005_telegram_sessions_and_events.sql
    006_slack_user_cache_and_workspace_fields.sql
    007_indexes_and_rls.sql
```

### Files to Significantly Modify

```
lib/ai/pipeline.ts             — Combined classify+draft, JSON mode, fallback
lib/ai/prompts.ts              — Dynamic prompts from custom categories
lib/ai/parser.ts               — Strict Zod + JSON mode (remove regex fallback)
lib/telegram/notify.ts         — Richer formatting, group notification trigger
lib/telegram/callbacks.ts      — DB-backed sessions, edit preview flow
lib/pipeline/orchestrator.ts   — New pipeline: idempotency, AI classify, user cache, group notify
lib/slack/egress.ts            — Failure notification to admin via Telegram
lib/db/queries.ts              — New queries for categories, invite tokens, sessions, channels, user cache
lib/db/types.ts                — New table types
lib/utils/security.ts          — Add Telegram webhook secret validation
lib/utils/rate-limiter.ts      — Tuned presets

app/api/slack/events/route.ts  — after() instead of setImmediate, idempotency
app/api/slack/install/route.ts — Add channels:read scope
app/api/telegram/webhook/route.ts — Secret token validation, command routing
app/api/roles/route.ts         — Zod validation, invite token generation on create

app/page.tsx                   — Complete landing page rebuild
app/dashboard/layout.tsx       — Workspace switcher, responsive sidebar
app/dashboard/page.tsx         — Real metrics, charts, team load, setup wizard
app/dashboard/tasks/page.tsx   — Full labeling, filters, expandable detail
app/dashboard/settings/page.tsx — Tabbed: Categories, Roles (invite links), Routing
app/dashboard/workspaces/page.tsx — Card layout, channel management, re-auth banner
app/dashboard/activity/page.tsx — Timeline style, filters

components/app-sidebar.tsx     — Rebuilt with workspace switcher, active states
components/settings-interactive.tsx — Rebuilt for categories, invite links, routing
```

---

## Phase 1: Database Migrations & Schema

### Task 1: Categories and Invite Tokens Migration

**Files:**
- Create: `supabase/migrations/004_categories_and_invite_tokens.sql`
- Modify: `lib/db/types.ts`

- [ ] **Step 1: Write the categories table migration**

```sql
-- 004_categories_and_invite_tokens.sql

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6B7280',
  emoji TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for categories (owner-based)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Service role bypass for categories"
  ON categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Invite tokens table
CREATE TABLE invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage invite tokens via roles"
  ON invite_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roles WHERE roles.id = invite_tokens.role_id AND roles.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles WHERE roles.id = invite_tokens.role_id AND roles.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role bypass for invite tokens"
  ON invite_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add status to roles
ALTER TABLE roles ADD COLUMN status TEXT NOT NULL DEFAULT 'pending_link';

-- Unique constraint for category names per owner (needed for ON CONFLICT in seeding)
ALTER TABLE categories ADD CONSTRAINT categories_owner_name_unique UNIQUE (owner_id, name);

-- Index for fast token lookup
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
```

- [ ] **Step 2: Run migration against Supabase**

Run: Apply via Supabase dashboard SQL editor or `supabase db push`
Expected: Tables created, RLS policies active

- [ ] **Step 3: Update TypeScript types**

In `lib/db/types.ts`, add types for `categories` and `invite_tokens` tables. Add `status` field to `roles` type. Ensure `Database` interface includes all new tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_categories_and_invite_tokens.sql lib/db/types.ts
git commit -m "feat(db): add categories and invite_tokens tables with RLS"
```

---

### Task 2: Workspace Roles Migration (category → category_id)

**Files:**
- Create: `supabase/migrations/004b_migrate_workspace_roles_category.sql`
- Modify: `lib/db/queries.ts` (resolveRole, setWorkspaceRole)

- [ ] **Step 1: Write the migration**

```sql
-- 004b_migrate_workspace_roles_category.sql

-- Step 1: Seed default categories for each existing owner
INSERT INTO categories (owner_id, name, description, emoji, color, is_default)
SELECT DISTINCT owner_id, 'Bug', 'Bug reports, errors, crashes, and broken functionality', '', '#EF4444', true
FROM roles
ON CONFLICT DO NOTHING;

INSERT INTO categories (owner_id, name, description, emoji, color, is_default)
SELECT DISTINCT owner_id, 'Feature', 'Feature requests, enhancements, and new functionality ideas', '', '#8B5CF6', true
FROM roles
ON CONFLICT DO NOTHING;

INSERT INTO categories (owner_id, name, description, emoji, color, is_default)
SELECT DISTINCT owner_id, 'General', 'General questions, discussions, and miscellaneous messages', '', '#6B7280', true
FROM roles
ON CONFLICT DO NOTHING;

-- Step 2: Add category_id column (nullable first)
ALTER TABLE workspace_roles ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE CASCADE;

-- Step 3: Populate category_id by joining on name
UPDATE workspace_roles wr
SET category_id = c.id
FROM categories c
JOIN roles r ON r.owner_id = c.owner_id
JOIN workspaces w ON w.id = wr.workspace_id AND w.owner_id = r.owner_id
WHERE UPPER(wr.category) = UPPER(c.name)
  AND wr.role_id = r.id;

-- Step 4: Drop old category column and add constraint
ALTER TABLE workspace_roles DROP CONSTRAINT IF EXISTS workspace_roles_workspace_id_category_key;
ALTER TABLE workspace_roles DROP COLUMN category;
ALTER TABLE workspace_roles ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE workspace_roles ADD CONSTRAINT workspace_roles_workspace_id_category_id_key UNIQUE (workspace_id, category_id);

-- Step 5: Add category_id and ai_prompt_version to tasks
ALTER TABLE tasks ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN ai_prompt_version TEXT;
```

- [ ] **Step 2: Update queries.ts — resolveRole()**

Change `resolveRole(workspaceId, category)` to `resolveRole(workspaceId, categoryId)`. Query on `.eq('category_id', categoryId)` instead of `.eq('category', category)`.

- [ ] **Step 3: Update queries.ts — setWorkspaceRole()**

Change upsert to use `category_id` field. Update `onConflict` to `'workspace_id,category_id'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004b_migrate_workspace_roles_category.sql lib/db/queries.ts
git commit -m "feat(db): migrate workspace_roles.category to category_id FK"
```

---

### Task 3: Telegram Sessions, Processed Events, User Cache Tables

**Files:**
- Create: `supabase/migrations/005_telegram_sessions_and_events.sql`
- Create: `supabase/migrations/006_slack_user_cache_and_workspace_fields.sql`
- Modify: `lib/db/types.ts`

- [ ] **Step 1: Write telegram_sessions and processed_events migration**

```sql
-- 005_telegram_sessions_and_events.sql

CREATE TABLE telegram_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('editing', 'confirming')),
  draft_text TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for telegram_sessions"
  ON telegram_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_telegram_sessions_chat_state ON telegram_sessions(chat_id, state);

-- Processed events (idempotency)
CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for processed_events"
  ON processed_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_processed_events_time ON processed_events(processed_at);
```

- [ ] **Step 2: Write slack_user_cache and workspace fields migration**

```sql
-- 006_slack_user_cache_and_workspace_fields.sql

CREATE TABLE slack_user_cache (
  slack_user_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slack_user_id, workspace_id)
);

ALTER TABLE slack_user_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for slack_user_cache"
  ON slack_user_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Workspace additions
ALTER TABLE workspaces ADD COLUMN team_group_chat_id TEXT;
ALTER TABLE workspaces ADD COLUMN daily_digest_time TEXT;
ALTER TABLE workspaces ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#3B82F6';

-- Task additions
ALTER TABLE tasks ADD COLUMN thread_context TEXT;
```

- [ ] **Step 3: Write performance indexes migration**

Create `supabase/migrations/007_indexes_and_rls.sql`:

```sql
-- 007_indexes_and_rls.sql
-- Performance indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_workspace_time ON activity_log(workspace_id, created_at);
```

- [ ] **Step 4: Update lib/db/types.ts with all new table types**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_telegram_sessions_and_events.sql supabase/migrations/006_slack_user_cache_and_workspace_fields.sql supabase/migrations/007_indexes_and_rls.sql lib/db/types.ts
git commit -m "feat(db): add telegram sessions, processed events, user cache, indexes"
```

---

## Phase 2: Security & Infrastructure

### Task 4: CSRF Protection and API Helpers

**Files:**
- Create: `lib/utils/csrf.ts`
- Create: `lib/utils/api-helpers.ts`

- [ ] **Step 1: Create CSRF utility**

```typescript
// lib/utils/csrf.ts
import { headers } from 'next/headers'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

export async function validateOrigin(): Promise<boolean> {
  const h = await headers()
  const origin = h.get('origin')
  const referer = h.get('referer')

  if (!origin && !referer) return false

  const allowed = new URL(APP_URL).origin
  if (origin && origin === allowed) return true
  if (referer && new URL(referer).origin === allowed) return true

  return false
}
```

- [ ] **Step 2: Create API helpers**

```typescript
// lib/utils/api-helpers.ts
import { NextResponse } from 'next/server'

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

export function json400(message: string) {
  return jsonError(message, 'BAD_REQUEST', 400)
}

export function json401() {
  return jsonError('Unauthorized', 'UNAUTHORIZED', 401)
}

export function json403(message = 'Forbidden') {
  return jsonError(message, 'FORBIDDEN', 403)
}

export function json429() {
  return jsonError('Too many requests', 'RATE_LIMITED', 429)
}

export function json500() {
  return jsonError('Internal server error', 'INTERNAL_ERROR', 500)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/utils/csrf.ts lib/utils/api-helpers.ts
git commit -m "feat(security): add CSRF validation and API response helpers"
```

---

### Task 5: Idempotency Layer

**Files:**
- Create: `lib/utils/idempotency.ts`
- Modify: `lib/db/queries.ts` (add processed events queries)

- [ ] **Step 1: Create idempotency module**

```typescript
// lib/utils/idempotency.ts
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

export async function tryClaimEvent(eventId: string, workspaceId: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('processed_events')
    .insert({ event_id: eventId, workspace_id: workspaceId })

  if (error) {
    if (error.code === '23505') { // unique_violation
      logger.info({ eventId }, 'Duplicate event skipped')
      return false
    }
    logger.error({ error, eventId }, 'Error claiming event')
    return false
  }
  return true
}

export async function cleanupOldEvents(): Promise<void> {
  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('processed_events')
    .delete()
    .lt('processed_at', cutoff)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/utils/idempotency.ts
git commit -m "feat(security): add event idempotency with INSERT ON CONFLICT"
```

---

### Task 6: Telegram Webhook Secret Validation

**Files:**
- Modify: `lib/utils/security.ts`

- [ ] **Step 1: Add Telegram secret validation function**

Add to `lib/utils/security.ts`:

```typescript
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''

export function verifyTelegramWebhook(secretHeader: string | null): boolean {
  if (!TELEGRAM_WEBHOOK_SECRET) return true // skip in dev if not set
  return secretHeader === TELEGRAM_WEBHOOK_SECRET
}
```

- [ ] **Step 2: Document setWebhook setup with secret_token**

Add a note to `.env.example` and a setup script/comment that the Telegram webhook must be registered with the secret token:

```bash
# To set up Telegram webhook with secret validation:
# curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook&secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET"
```

Add `TELEGRAM_WEBHOOK_SECRET` to `.env.example`. Without calling `setWebhook` with `secret_token`, Telegram will not send the header and validation will be skipped (by design — the guard returns `true` if env var is empty).

- [ ] **Step 3: Commit**

```bash
git add lib/utils/security.ts
git commit -m "feat(security): add Telegram webhook secret validation"
```

---

### Task 7: Rate Limiter Tuning

**Files:**
- Modify: `lib/utils/rate-limiter.ts`

- [ ] **Step 1: Add new rate limit presets**

Update `lib/utils/rate-limiter.ts` to add presets:

```typescript
export const RATE_LIMITS = {
  slackInstall: { maxCount: 5, windowMs: 60 * 60 * 1000 },      // 5/hour
  slackEvents: { maxCount: 60, windowMs: 60 * 1000 },            // 60/min per workspace
  telegramWebhook: { maxCount: 100, windowMs: 60 * 1000 },       // 100/min
  apiMutation: { maxCount: 30, windowMs: 60 * 1000 },            // 30/min per user
  aiDraft: { maxCount: 30, windowMs: 60 * 1000 },                // 30/min
} as const
```

- [ ] **Step 2: Commit**

```bash
git add lib/utils/rate-limiter.ts
git commit -m "feat(security): tune rate limit presets for production"
```

---

## Phase 3: AI Pipeline Rebuild

### Task 8: AI Classifier with Custom Categories

**Files:**
- Create: `lib/ai/classifier.ts`
- Create: `lib/ai/schemas.ts`
- Modify: `lib/db/queries.ts` (add category queries)

- [ ] **Step 1: Create Zod schemas for AI responses**

```typescript
// lib/ai/schemas.ts
import { z } from 'zod'

export const classifyAndDraftSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  draft: z.string(),
  tone: z.string().optional(),
})

export type ClassifyAndDraftResult = z.infer<typeof classifyAndDraftSchema>
```

- [ ] **Step 2: Create AI classifier**

```typescript
// lib/ai/classifier.ts
import { openai } from '@/lib/ai/client'
import { classifyAndDraftSchema, type ClassifyAndDraftResult } from '@/lib/ai/schemas'
import { logger } from '@/lib/utils/logger'

interface Category {
  id: string
  name: string
  description: string
  emoji: string
}

export async function classifyAndDraft(
  message: string,
  senderName: string,
  channel: string,
  categories: Category[],
  threadContext?: string | null,
): Promise<ClassifyAndDraftResult & { promptVersion: string }> {
  const categoryList = categories
    .map((c) => `- "${c.name}" (${c.emoji}): ${c.description}`)
    .join('\n')

  const promptVersion = 'v2.0-dynamic'

  const systemPrompt = `You are an AI assistant for SlackFlow, a task routing platform.

Your job:
1. Classify the following Slack message into one of the defined categories
2. Draft a helpful response to post back in the Slack thread

Available categories:
${categoryList}

Rules:
- Pick the single best-matching category
- Set confidence 0.0-1.0 (1.0 = certain match)
- If unsure, use "General" with low confidence
- Draft should be professional, helpful, and concise
- Draft should acknowledge the message and indicate it's being handled

Respond in JSON format:
{
  "category": "<category name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<why this category>",
  "draft": "<response to post in Slack>",
  "tone": "<professional|friendly|urgent>"
}`

  const userContent = threadContext
    ? `Thread context:\n${threadContext}\n\nNew message from ${senderName} in #${channel}:\n${message}`
    : `Message from ${senderName} in #${channel}:\n${message}`

  const response = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.4,
  })

  const raw = response.choices[0]?.message?.content || '{}'
  const parsed = classifyAndDraftSchema.parse(JSON.parse(raw))

  // Validate category name exists
  const validCategory = categories.find(
    (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
  )
  if (!validCategory) {
    logger.warn({ returnedCategory: parsed.category }, 'AI returned unknown category, falling back to General')
    parsed.category = 'General'
    parsed.confidence = 0.3
  }

  return {
    ...parsed,
    promptVersion,
  }
}
```

- [ ] **Step 3: Add category CRUD queries to queries.ts**

Add to `lib/db/queries.ts`:
- `getCategories(ownerId)` — list all categories for an owner
- `getCategoryByName(ownerId, name)` — find by name (for fallback)
- `createCategory(data)` — insert new category
- `updateCategory(id, data)` — update category
- `deleteCategory(id)` — delete category
- `seedDefaultCategories(ownerId)` — create Bug/Feature/General defaults

- [ ] **Step 4: Commit**

```bash
git add lib/ai/classifier.ts lib/ai/schemas.ts lib/db/queries.ts
git commit -m "feat(ai): add AI classifier with custom categories and JSON mode"
```

---

### Task 9: Rebuild AI Pipeline

**Files:**
- Modify: `lib/ai/pipeline.ts`
- Modify: `lib/ai/prompts.ts` (simplify — dynamic prompts now in classifier)

- [ ] **Step 1: Rewrite pipeline.ts**

Replace the existing pipeline with one that:
1. Loads categories for the workspace owner
2. Calls `classifyAndDraft()` (single API call)
3. On success: updates task with `category`, `category_id`, `draft_text`, `ai_model`, `ai_tokens_used`, `ai_prompt_version`, `draft_generated_at`
4. On failure: sets category to "General", category_id to General's ID, draft_text to null, logs error, marks `ai_prompt_version` with "failed"
5. Returns `{ category, categoryId, draft, confidence }`

- [ ] **Step 2: Simplify prompts.ts**

Remove the three hardcoded prompt templates. Keep file as a utility with just the `PROMPT_VERSIONS` constant updated to `v2.0-dynamic`. The actual prompt is now built dynamically in `classifier.ts`.

- [ ] **Step 3: Update parser.ts**

Simplify `parser.ts` — since we use JSON mode, the regex fallback is no longer needed. Just parse JSON and validate with Zod schema. Keep plain-text fallback only for edge cases.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/pipeline.ts lib/ai/prompts.ts lib/ai/parser.ts
git commit -m "feat(ai): rebuild pipeline with combined classify+draft and JSON mode"
```

---

## Phase 4: Telegram Rebuild

### Task 10: DB-Backed Session Management

**Files:**
- Create: `lib/telegram/sessions.ts`

- [ ] **Step 1: Create sessions module**

```typescript
// lib/telegram/sessions.ts
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

interface Session {
  id: string
  chat_id: string
  task_id: string
  state: 'editing' | 'confirming'
  draft_text: string | null
  expires_at: string
}

export async function startEditSession(chatId: string, taskId: string): Promise<Session> {
  const supabase = getServiceClient()
  // Clear any existing sessions for this chat
  await supabase.from('telegram_sessions').delete().eq('chat_id', chatId)

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('telegram_sessions')
    .insert({ chat_id: chatId, task_id: taskId, state: 'editing', expires_at: expiresAt })
    .select()
    .single()

  if (error) throw error
  return data as Session
}

export async function getActiveSession(chatId: string): Promise<Session | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as Session) || null
}

export async function updateSessionState(
  sessionId: string,
  state: 'editing' | 'confirming',
  draftText?: string
): Promise<void> {
  const supabase = getServiceClient()
  const update: Record<string, unknown> = { state }
  if (draftText !== undefined) update.draft_text = draftText
  await supabase.from('telegram_sessions').update(update).eq('id', sessionId)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('telegram_sessions').delete().eq('id', sessionId)
}

export async function cleanupExpiredSessions(): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from('telegram_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/telegram/sessions.ts
git commit -m "feat(telegram): add DB-backed session management"
```

---

### Task 11: Telegram Bot Commands (Onboarding + Utilities)

**Files:**
- Create: `lib/telegram/commands.ts`
- Modify: `lib/db/queries.ts` (add invite token queries)

- [ ] **Step 1: Add invite token queries to queries.ts**

Add to `lib/db/queries.ts`:
- `createInviteToken(roleId, token, expiresAt)` — insert token
- `getInviteTokenByToken(token)` — find by token string (join with role for owner info)
- `markInviteTokenUsed(tokenId)` — set `used_at`
- `getInviteTokenForRole(roleId)` — get active (unexpired, unused) token for role
- `linkRoleTelegram(roleId, chatId)` — update role's `telegram_chat_id` and set `status` to `linked`
- `getRoleByChatId(chatId)` — find role by Telegram chat ID
- `getPendingTasksForRole(roleId)` — list pending tasks assigned to role

- [ ] **Step 2: Create commands module**

```typescript
// lib/telegram/commands.ts
import { bot } from '@/lib/telegram/bot'
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'
import crypto from 'crypto'

export async function handleStartCommand(chatId: number, payload: string): Promise<void> {
  if (!payload || !payload.startsWith('inv_')) {
    await bot.sendMessage(chatId, 'Welcome to SlackFlow! If you have an invite link, click it to get started.')
    return
  }

  const supabase = getServiceClient()
  // Look up the invite token
  const { data: token } = await supabase
    .from('invite_tokens')
    .select('*, roles(*)')
    .eq('token', payload)
    .single()

  if (!token) {
    await bot.sendMessage(chatId, 'Invalid invite link. Please ask your admin for a new one.')
    return
  }

  if (token.used_at) {
    await bot.sendMessage(chatId, 'This invite link has already been used.')
    return
  }

  if (new Date(token.expires_at) < new Date()) {
    await bot.sendMessage(chatId, 'This invite link has expired. Please ask your admin to generate a new one.')
    return
  }

  // Link the role
  await supabase
    .from('roles')
    .update({ telegram_chat_id: String(chatId), status: 'linked' })
    .eq('id', token.role_id)

  // Mark token as used
  await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)

  const roleName = token.roles?.name || 'Team Member'
  await bot.sendMessage(
    chatId,
    `You're now linked as <b>${roleName}</b>. You'll receive task notifications here.`,
    { parse_mode: 'HTML' }
  )
}

export async function handlePendingCommand(chatId: number): Promise<void> {
  // Find role by chat_id, then list pending tasks
  const supabase = getServiceClient()
  const { data: role } = await supabase
    .from('roles')
    .select('id, name')
    .eq('telegram_chat_id', String(chatId))
    .single()

  if (!role) {
    await bot.sendMessage(chatId, 'You are not linked to any role. Ask your admin for an invite link.')
    return
  }

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, original_text, category, channel, created_at, status')
    .eq('role_id', role.id)
    .in('status', ['pending', 'draft_ready'])
    .order('created_at', { ascending: false })
    .limit(10)

  if (!tasks || tasks.length === 0) {
    await bot.sendMessage(chatId, 'No pending tasks. You\'re all caught up!')
    return
  }

  const lines = tasks.map((t, i) =>
    `${i + 1}. [${t.category}] #${t.channel} — ${t.original_text?.substring(0, 60)}...`
  )
  await bot.sendMessage(chatId, `<b>Pending Tasks (${tasks.length}):</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' })
}

export async function handleStatusCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const { data: role } = await supabase
    .from('roles')
    .select('name, type, status')
    .eq('telegram_chat_id', String(chatId))
    .single()

  if (!role) {
    await bot.sendMessage(chatId, 'Not linked. Ask your admin for an invite link.')
    return
  }

  await bot.sendMessage(
    chatId,
    `<b>Your Status</b>\nRole: ${role.name}\nType: ${role.type}\nStatus: ${role.status}`,
    { parse_mode: 'HTML' }
  )
}

export async function handleHelpCommand(chatId: number): Promise<void> {
  await bot.sendMessage(
    chatId,
    `<b>SlackFlow Bot Commands</b>\n\n` +
    `/pending — View your pending tasks\n` +
    `/status — Check your link status\n` +
    `/help — Show this help message`,
    { parse_mode: 'HTML' }
  )
}

// Group commands (called from team group chats)
export async function handleBoardCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('status')
    .gte('created_at', today.toISOString())

  const pending = tasks?.filter(t => ['pending', 'draft_ready'].includes(t.status)).length || 0
  const done = tasks?.filter(t => ['approved', 'edited', 'sent'].includes(t.status)).length || 0
  const dismissed = tasks?.filter(t => t.status === 'dismissed').length || 0

  await bot.sendMessage(
    chatId,
    `<b>Task Board — Today</b>\n\nPending: ${pending}\nCompleted: ${done}\nDismissed: ${dismissed}`,
    { parse_mode: 'HTML' }
  )
}

export async function handleSummaryCommand(chatId: number): Promise<void> {
  const supabase = getServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('category, sender_name, channel, status, roles(name)')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(15)

  if (!tasks || tasks.length === 0) {
    await bot.sendMessage(chatId, 'No tasks today yet.')
    return
  }

  const lines = tasks.map(t =>
    `[${t.category}] #${t.channel} — ${t.sender_name || 'Unknown'} → ${(t as any).roles?.name || 'Unassigned'} (${t.status})`
  )
  await bot.sendMessage(chatId, `<b>Today's Summary (${tasks.length}):</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' })
}

export function generateInviteToken(): string {
  return 'inv_' + crypto.randomBytes(12).toString('base64url').substring(0, 16)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/telegram/commands.ts lib/db/queries.ts
git commit -m "feat(telegram): add bot commands for onboarding, /pending, /status, /help"
```

---

### Task 12: Rebuild Telegram Callbacks with DB Sessions

**Files:**
- Modify: `lib/telegram/callbacks.ts`

- [ ] **Step 1: Rewrite callbacks.ts**

Replace in-memory `editModeStore` Map with DB session calls:
- `handleApprove()` — unchanged logic, but update Telegram message in-place via `editMessageText`
- `handleEdit()` — call `startEditSession()` instead of Map.set, reply with edit prompt
- `handleDismiss()` — unchanged logic, update message in-place
- `handleEditReply()` — call `getActiveSession()` instead of Map.get, show preview with Confirm/Cancel buttons, update session state to `confirming`
- New `handleEditConfirm(chatId, sessionId)` — get session, post to Slack, delete session, update message
- New `handleEditCancel(chatId, sessionId)` — delete session, notify user
- New `handleViewOriginal(taskId, chatId)` — fetch task, send original_text

Remove all references to the in-memory Map.

- [ ] **Step 2: Commit**

```bash
git add lib/telegram/callbacks.ts
git commit -m "feat(telegram): rebuild callbacks with DB-backed sessions and edit preview"
```

---

### Task 13: Team Group Notifications

**Files:**
- Create: `lib/telegram/group-notify.ts`
- Modify: `lib/telegram/notify.ts` (richer individual notifications)

- [ ] **Step 1: Create group notification module**

```typescript
// lib/telegram/group-notify.ts
import { bot } from '@/lib/telegram/bot'
import { logger } from '@/lib/utils/logger'

interface GroupNotifyParams {
  groupChatId: string
  workspaceName: string
  channel: string
  category: string
  categoryEmoji: string
  assigneeName: string
  senderName: string
  action: 'created' | 'approved' | 'edited' | 'dismissed'
  taskPreview?: string
}

export async function notifyTeamGroup(params: GroupNotifyParams): Promise<void> {
  const { groupChatId, workspaceName, channel, category, categoryEmoji, assigneeName, senderName, action } = params

  if (!groupChatId) return

  let message = ''
  switch (action) {
    case 'created':
      message = `${categoryEmoji} <b>New ${category}</b> from <b>#${channel}</b> (${workspaceName})\nFrom: ${senderName} — Assigned to: <b>${assigneeName}</b>`
      if (params.taskPreview) message += `\n<i>${params.taskPreview.substring(0, 100)}...</i>`
      break
    case 'approved':
      message = `<b>${assigneeName}</b> approved the response for a task in <b>#${channel}</b>`
      break
    case 'edited':
      message = `<b>${assigneeName}</b> sent a custom response for a task in <b>#${channel}</b>`
      break
    case 'dismissed':
      message = `<b>${assigneeName}</b> dismissed a task from <b>#${channel}</b>`
      break
  }

  try {
    await bot.sendMessage(groupChatId, message, { parse_mode: 'HTML' })
  } catch (err) {
    logger.error({ err, groupChatId }, 'Failed to notify team group')
  }
}
```

- [ ] **Step 2: Update notify.ts with richer formatting**

Rebuild `notifyAssignee()` in `lib/telegram/notify.ts`:
- Include workspace name, sender name (from user cache), channel, category emoji + name, confidence
- Truncate AI draft to 200 chars in preview
- Inline keyboard: Approve | Edit | Dismiss | View Original
- Return message ID for later `editMessageText` calls

- [ ] **Step 3: Commit**

```bash
git add lib/telegram/group-notify.ts lib/telegram/notify.ts
git commit -m "feat(telegram): add team group notifications and richer individual formatting"
```

---

### Task 14: Rewrite Telegram Webhook Route

**Files:**
- Modify: `app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Rewrite the route handler**

Complete rewrite:
1. Validate `X-Telegram-Bot-Api-Secret-Token` header via `verifyTelegramWebhook()`
2. Rate limit check (telegramWebhook preset)
3. Route to appropriate handler:
   - `/start` command → `handleStartCommand()`
   - `/pending` command → `handlePendingCommand()`
   - `/status` command → `handleStatusCommand()`
   - `/help` command → `handleHelpCommand()`
   - `/board` command (group chats) → `handleBoardCommand()`
   - `/summary` command (group chats) → `handleSummaryCommand()`
   - Callback query with `approve/edit/dismiss/view_original/confirm_edit/cancel_edit` → appropriate callback handler
   - Text message (no command) → `handleEditReply()` (check for active session)
4. Wrap everything in try/catch, return 200 always (Telegram retries on non-200)

- [ ] **Step 2: Commit**

```bash
git add app/api/telegram/webhook/route.ts
git commit -m "feat(telegram): rewrite webhook with secret validation and command routing"
```

---

## Phase 5: Slack Integration Improvements

### Task 15: Channel Discovery and User Cache

**Files:**
- Create: `lib/slack/channels.ts`
- Create: `lib/slack/user-cache.ts`

- [ ] **Step 1: Create channel discovery module**

```typescript
// lib/slack/channels.ts
import { WebClient } from '@slack/web-api'
import { logger } from '@/lib/utils/logger'

interface SlackChannel {
  id: string
  name: string
  is_member: boolean
  num_members: number
  topic: string
}

export async function listWorkspaceChannels(accessToken: string): Promise<SlackChannel[]> {
  const client = new WebClient(accessToken)
  const channels: SlackChannel[] = []
  let cursor: string | undefined

  do {
    const result = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 200,
      cursor,
    })

    for (const ch of result.channels || []) {
      channels.push({
        id: ch.id || '',
        name: ch.name || '',
        is_member: ch.is_member || false,
        num_members: ch.num_members || 0,
        topic: ch.topic?.value || '',
      })
    }

    cursor = result.response_metadata?.next_cursor
  } while (cursor)

  return channels
}
```

- [ ] **Step 2: Create user cache module**

```typescript
// lib/slack/user-cache.ts
import { WebClient } from '@slack/web-api'
import { getServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

interface CachedUser {
  display_name: string
  avatar_url: string | null
}

export async function resolveSlackUser(
  accessToken: string,
  workspaceId: string,
  slackUserId: string
): Promise<CachedUser> {
  const supabase = getServiceClient()

  // Check cache (24h TTL)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('slack_user_cache')
    .select('display_name, avatar_url')
    .eq('slack_user_id', slackUserId)
    .eq('workspace_id', workspaceId)
    .gt('cached_at', cutoff)
    .single()

  if (cached) return cached

  // Fetch from Slack
  try {
    const client = new WebClient(accessToken)
    const result = await client.users.info({ user: slackUserId })
    const user = result.user
    const displayName = user?.real_name || user?.name || slackUserId
    const avatarUrl = user?.profile?.image_72 || null

    // Upsert cache
    await supabase
      .from('slack_user_cache')
      .upsert({
        slack_user_id: slackUserId,
        workspace_id: workspaceId,
        display_name: displayName,
        avatar_url: avatarUrl,
        cached_at: new Date().toISOString(),
      }, { onConflict: 'slack_user_id,workspace_id' })

    return { display_name: displayName, avatar_url: avatarUrl }
  } catch (err) {
    logger.warn({ err, slackUserId }, 'Failed to resolve Slack user, using ID as fallback')
    return { display_name: slackUserId, avatar_url: null }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/slack/channels.ts lib/slack/user-cache.ts
git commit -m "feat(slack): add channel discovery and user profile caching"
```

---

### Task 16: Slack Egress Failure Notifications

**Files:**
- Modify: `lib/slack/egress.ts`

- [ ] **Step 1: Add failure notification logic**

Update `postReplyToSlack()`:
- Wrap the Slack API call in try/catch
- On failure: look up workspace owner, find their admin Telegram chat ID (or use a configured admin notification channel)
- Send Telegram message: "Failed to post reply in #channel (Workspace: Name). Error: <message>. Retry from dashboard."
- Update task status to `failed`
- Log the failure with full context

- [ ] **Step 2: Commit**

```bash
git add lib/slack/egress.ts
git commit -m "feat(slack): add failure notification to admin via Telegram"
```

---

### Task 17: Update Slack OAuth Scopes and Install Route

**Files:**
- Modify: `app/api/slack/install/route.ts`

- [ ] **Step 1: Add channels:read scope**

Update the scopes string in `install/route.ts`:
```typescript
const scopes = 'channels:history,channels:read,chat:write,commands,users:read'
```

- [ ] **Step 2: Commit**

```bash
git add app/api/slack/install/route.ts
git commit -m "feat(slack): add channels:read scope for channel discovery"
```

---

### Task 18: Rebuild Orchestrator Pipeline

**Files:**
- Modify: `lib/pipeline/orchestrator.ts`

- [ ] **Step 1: Rewrite handleSlackMessage()**

New pipeline flow:
1. Extract event metadata (workspace_id, channel, user, text, thread_ts, event_id)
2. **Idempotency check** — `tryClaimEvent(eventId, workspaceId)`, skip if duplicate
3. Load workspace, validate monitored channel, decrypt access token
4. Skip bot messages (check `bot_id` or match `bot_user_id`)
5. **Resolve sender** — `resolveSlackUser(accessToken, workspaceId, event.user)` for display name (non-blocking, fallback to user ID)
6. **Fetch thread context** — If `event.thread_ts` exists and differs from `event.ts`, fetch parent message via `conversations.replies` API, extract first message text as context. If API fails, set `threadContext = null` and continue.
7. **Load categories** — `getCategories(ownerId)`
8. **AI classify + draft** — `classifyAndDraft(text, senderName, channel, categories, threadContext)`. On failure: set `category = 'General'`, `draft = null`, log error.
9. **Resolve category_id** — find matching category from loaded list:
   ```typescript
   const matchedCategory = categories.find(c => c.name.toLowerCase() === result.category.toLowerCase())
   const categoryId = matchedCategory?.id || generalCategory.id
   ```
10. **Resolve role** — `resolveRole(workspaceId, categoryId)` — NOTE: this now takes a UUID `categoryId`, not a category name string
11. **Create task** — with all enriched fields (sender_name, category, category_id, draft, thread_context, ai_prompt_version)
12. **Notify assignee** — `notifyAssignee()` with enriched data
13. **Notify team group** — `notifyTeamGroup()` with action='created' (non-blocking)
14. Log activity

All steps after idempotency check should be wrapped in try/catch. Failures at any step should not prevent subsequent steps from executing where possible.

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/orchestrator.ts
git commit -m "feat(pipeline): rebuild orchestrator with idempotency, AI classify, user cache, group notify"
```

---

### Task 19: Update Slack Events Route with after()

**Files:**
- Modify: `app/api/slack/events/route.ts`

- [ ] **Step 1: Replace setImmediate with after()**

```typescript
import { after } from 'next/server'

export async function POST(req: Request) {
  // ... signature verification, URL challenge handling ...

  // Acknowledge immediately
  const response = new Response('ok', { status: 200 })

  // Background processing
  after(async () => {
    try {
      await handleSlackMessage(event)
    } catch (err) {
      logger.error({ err }, 'Pipeline error')
    }
  })

  return response
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/slack/events/route.ts
git commit -m "feat(slack): use after() for serverless-safe background processing"
```

---

## Phase 6: New API Routes

### Task 20: Categories CRUD API

**Files:**
- Create: `app/api/categories/route.ts`

- [ ] **Step 1: Create the route**

Implement GET (list), POST (create), PUT (update), DELETE (remove) with:
- Auth guard (get user from session)
- Zod validation on all inputs
- CSRF validation on mutations
- Rate limiting (apiMutation preset)
- Structured error responses via api-helpers

- [ ] **Step 2: Commit**

```bash
git add app/api/categories/route.ts
git commit -m "feat(api): add categories CRUD endpoint"
```

---

### Task 21: Invite Tokens API

**Files:**
- Create: `app/api/invite-tokens/route.ts`

- [ ] **Step 1: Create the route**

Implement POST (generate token for role) and DELETE (revoke token):
- Auth guard
- Validate role belongs to current user
- Generate token via `generateInviteToken()`
- Set 24h expiry
- Return token and deep link URL (`t.me/BotName?start=inv_xxx`)
- Zod validation, CSRF, rate limiting

- [ ] **Step 2: Commit**

```bash
git add app/api/invite-tokens/route.ts
git commit -m "feat(api): add invite token generation endpoint"
```

---

### Task 22: Workspace Channels API

**Files:**
- Create: `app/api/workspaces/[id]/channels/route.ts`

- [ ] **Step 1: Create the route**

Implement GET (list channels) and PUT (toggle monitored):
- Auth guard, verify workspace ownership
- GET: decrypt token, call `listWorkspaceChannels()`, merge with current `monitored_channels` array
- PUT: update `monitored_channels` array on workspace record
- Handle scope errors gracefully (return `needs_reauth: true` if channels:read scope missing)

- [ ] **Step 2: Commit**

```bash
git add app/api/workspaces/[id]/channels/route.ts
git commit -m "feat(api): add workspace channel discovery and toggle endpoint"
```

---

### Task 23: Harden Existing API Routes

**Files:**
- Modify: `app/api/roles/route.ts`
- Modify: `app/api/workspace-roles/route.ts`
- Modify: `app/api/health/route.ts`

- [ ] **Step 1: Add Zod validation and CSRF to roles route**

Update `roles/route.ts`:
- Define Zod schemas for POST (create), PUT (update), DELETE body
- Add `validateOrigin()` check on all mutations
- Use api-helpers for consistent error responses
- On role creation: auto-generate invite token and return it in response
- On role creation: seed default categories for the owner if they have none

- [ ] **Step 2: Add Zod validation and CSRF to workspace-roles route**

Update `workspace-roles/route.ts`:
- Zod schema for POST body (workspace_id, category_id, role_id)
- CSRF check
- Structured errors

- [ ] **Step 3: Enhance health check**

Update `health/route.ts`:
- Add Telegram bot connectivity check (`bot.getMe()`)
- Add encryption key validity check (encrypt/decrypt a test string)
- Return component-level status for each service

- [ ] **Step 4: Commit**

```bash
git add app/api/roles/route.ts app/api/workspace-roles/route.ts app/api/health/route.ts
git commit -m "feat(api): harden all routes with Zod validation, CSRF, structured errors"
```

---

## Phase 7: UI/UX Overhaul

### Task 24: Shared UI Components

**Files:**
- Create: `components/error-boundary.tsx`
- Create: `components/loading-skeleton.tsx`
- Create: `components/category-badge.tsx`
- Create: `components/status-pill.tsx`
- Create: `components/workspace-switcher.tsx`
- Create: `components/invite-link-button.tsx`

- [ ] **Step 1: Create error boundary component**

React error boundary class component with:
- Friendly error message + retry button
- `fallback` prop for custom fallback UI
- Logs error to console (production: could send to monitoring)

- [ ] **Step 2: Create loading skeleton component**

Reusable skeleton with variants: `card`, `table-row`, `text-line`, `metric-card`. Uses Tailwind animate-pulse with proper sizing.

- [ ] **Step 3: Create category badge component**

Props: `name`, `emoji`, `color`. Renders a small pill with emoji + category name, background tinted with the category color at low opacity.

- [ ] **Step 4: Create status pill component**

Props: `status`. Maps status to color:
- pending → yellow
- draft_ready → blue
- approved → green
- edited → green
- dismissed → gray
- sent → green
- failed → red

Renders a small rounded pill with status text.

- [ ] **Step 5: Create workspace switcher component**

Client component. Fetches workspaces from API. Dropdown with:
- "All Workspaces" option (default)
- Each workspace with accent color dot + name
- Uses URL search params to persist selection (`?workspace=id`)
- Emits selection change

- [ ] **Step 6: Create invite link button component**

Props: `roleId`, `existingToken?`. Shows either:
- Active link with copy button + expiry countdown
- "Generate Link" button that calls invite-tokens API
- Regenerate button if expired

- [ ] **Step 7: Commit**

```bash
git add components/error-boundary.tsx components/loading-skeleton.tsx components/category-badge.tsx components/status-pill.tsx components/workspace-switcher.tsx components/invite-link-button.tsx
git commit -m "feat(ui): add shared components: error boundary, skeleton, badges, workspace switcher"
```

---

### Task 25: Rebuild Landing Page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Complete rewrite of landing page**

Structure:
1. **Nav bar** — Logo, "How it Works", "Features", Login, "Get Started" CTA
2. **Hero** — Headline: "AI routes your Slack messages to the right person, automatically". Subtext. Two CTAs: "Get Started" + "See How It Works". Subtle gradient background.
3. **How It Works** — 4-step horizontal flow with connecting lines/arrows:
   - Slack message arrives → AI classifies → Team member notified on Telegram → Approved response posted
   - Each step has icon, title, brief description
4. **Features Grid** — 6 cards in 2x3 grid:
   - Smart AI Routing, Custom Categories, Telegram Notifications, Multi-Workspace, Team Transparency, Security
   - Each with icon, title, 2-line description
5. **CTA Section** — "Ready to streamline your workflow?" + Get Started button
6. **Footer** — Logo, copyright, links

Mobile: stack everything vertically, full-width cards, hamburger nav.

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): rebuild landing page with professional design"
```

---

### Task 26: Rebuild Dashboard Layout and Sidebar

**Files:**
- Modify: `app/dashboard/layout.tsx`
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Rebuild sidebar**

Rewrite `components/app-sidebar.tsx`:
- Desktop: fixed sidebar (240px), collapsible to icon-only (60px)
- Mobile: sheet/drawer triggered by hamburger button
- Top: workspace switcher component
- Nav items with icons and active state highlighting:
  - Overview (LayoutDashboard icon)
  - Tasks (CheckSquare icon)
  - Workspaces (Building icon)
  - Activity (Clock icon)
  - Settings (Settings icon)
- Bottom: Sign Out button
- Smooth transitions on collapse/expand

- [ ] **Step 2: Rebuild dashboard layout**

Rewrite `app/dashboard/layout.tsx`:
- Remove `force-dynamic` export (handle on per-page basis)
- Sidebar + main content area with proper responsive grid
- Mobile: full-width content, sidebar as drawer
- No more health indicator in header (move to settings page)

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/layout.tsx components/app-sidebar.tsx
git commit -m "feat(ui): rebuild dashboard layout with collapsible sidebar and workspace switcher"
```

---

### Task 27: Rebuild Overview Dashboard Page

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Rewrite overview page**

Server component that fetches real data. Sections:

1. **Metric Cards Row** (4 cards):
   - Tasks Today (count from DB)
   - Approval Rate (approved / total * 100)
   - Avg Response Time (time between task creation and sent)
   - Pending Review (count of pending + draft_ready)
   - Each card shows number + trend indicator (up/down from yesterday)

2. **Charts Row** (2 charts side by side on desktop, stacked on mobile):
   - Tasks by Category (bar chart, colored by category)
   - Tasks by Workspace (bar chart, colored by workspace accent)

3. **Team Load Section**:
   - Cards for each role showing: name, pending count, last active
   - Sorted by pending count descending

4. **Recent Tasks Feed**:
   - Last 10 tasks with full labeling (workspace badge, channel, sender, category badge, assignee, status pill, relative time)
   - Click to navigate to task detail

5. **Setup Checklist** (only if setup incomplete):
   - Step 1: Connect a Slack workspace
   - Step 2: Create categories and roles
   - Step 3: Link team members via Telegram
   - Auto-hides when all steps complete

Wrap each section in ErrorBoundary. Use loading skeletons for async data.

- [ ] **Step 2: Add metric queries to queries.ts**

Add to `lib/db/queries.ts`:
- `getDashboardMetrics(ownerId, workspaceId?)` — tasks today, approval rate, avg response time, pending count
- `getTasksByCategory(ownerId, workspaceId?)` — count per category for chart
- `getTasksByWorkspace(ownerId)` — count per workspace for chart
- `getTeamLoad(ownerId, workspaceId?)` — pending count per role

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx lib/db/queries.ts
git commit -m "feat(ui): rebuild overview dashboard with real metrics, charts, team load"
```

---

### Task 28: Rebuild Tasks Page

**Files:**
- Modify: `app/dashboard/tasks/page.tsx`
- Create: `components/task-card.tsx`

- [ ] **Step 1: Create expandable task card**

Client component. Props: task data. Shows:
- Collapsed: workspace badge | #channel | sender name | category badge | assignee | status pill | time ago
- Expanded: original message (full), AI draft, edited text (if any), final text, timeline of status changes

- [ ] **Step 2: Rewrite tasks page**

Server component with client-side filtering:
- Filter bar: status dropdown, category dropdown, workspace dropdown (from switcher), search input, date range
- Task list using task-card components
- Pagination (25 per page)
- Empty state: "No tasks match your filters"
- Loading skeletons while fetching

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/tasks/page.tsx components/task-card.tsx
git commit -m "feat(ui): rebuild tasks page with filters, expandable cards, full labeling"
```

---

### Task 29: Rebuild Settings Page

**Files:**
- Modify: `app/dashboard/settings/page.tsx`
- Modify: `components/settings-interactive.tsx`

- [ ] **Step 1: Rewrite settings with tabbed layout**

Three tabs:

**Categories Tab:**
- List of current categories with: emoji, name, description preview, color dot, edit/delete buttons
- "Add Category" button opens inline form: name, description, emoji picker (text input), color picker (preset palette), save/cancel
- Default categories (Bug/Feature/General) can be edited but show "default" badge
- Delete confirmation dialog

**Roles Tab:**
- List of roles with: name, type, link status indicator (green dot = linked, yellow = pending, red = unlinked)
- Each role shows invite link section (InviteLinkButton component)
- "Add Role" form: name, type (with quick-select buttons)
- Edit/delete with confirmation

**Routing Tab:**
- For selected workspace (from workspace switcher):
- Grid/list of categories, each with a role dropdown
- "Assign" saves the workspace_role mapping
- Unassigned categories highlighted with warning
- "Auto-assign" suggestion based on role types

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/settings/page.tsx components/settings-interactive.tsx
git commit -m "feat(ui): rebuild settings with tabbed categories, roles with invite links, routing"
```

---

### Task 30: Rebuild Workspaces Page

**Files:**
- Modify: `app/dashboard/workspaces/page.tsx`
- Create: `components/channel-toggle-card.tsx`

- [ ] **Step 1: Create channel toggle card**

Client component. Props: channel data + monitored state.
- Shows channel name, member count, topic preview
- Toggle switch for monitoring on/off
- Bot membership indicator (green = bot is in channel, gray = not)

- [ ] **Step 2: Rewrite workspaces page**

Card layout:
- Each workspace card shows: name, accent color stripe, Slack team ID, installed date, monitored channel count, last task timestamp
- Click to expand: shows channel list with toggle cards (fetched from channels API)
- Re-auth banner if `needs_reauth` flag is true (new scopes needed)
- "Team Group" section: link/unlink Telegram group, show linked status
- "Add Workspace" CTA card with Slack button
- Empty state for no workspaces

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/workspaces/page.tsx components/channel-toggle-card.tsx
git commit -m "feat(ui): rebuild workspaces page with channel management and team group linking"
```

---

### Task 31: Rebuild Activity Page

**Files:**
- Modify: `app/dashboard/activity/page.tsx`

- [ ] **Step 1: Rewrite activity page**

Timeline-style layout:
- Left side: time markers
- Right side: activity entries with icon, action description, actor, workspace badge, timestamp
- Filters: action type dropdown (created, approved, edited, dismissed, failed), workspace, date range
- Pagination (50 per page)
- Loading skeletons
- Empty state

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/activity/page.tsx
git commit -m "feat(ui): rebuild activity page with timeline layout and filters"
```

---

### Task 32: Polish Login and Signup Pages

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`

- [ ] **Step 1: Polish auth pages**

Both pages:
- Centered card on gradient background (consistent with landing page)
- Logo at top of card
- Clean form with proper spacing, labels, validation messages
- Loading state on submit button
- Error toast via Sonner instead of inline red text
- Smooth transitions
- "Back to home" link

- [ ] **Step 2: Commit**

```bash
git add app/login/page.tsx app/signup/page.tsx
git commit -m "feat(ui): polish login and signup pages"
```

---

## Phase 8: Global Polish & Production

### Task 33: Global CSS and Theme Polish

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update global styles**

- Ensure consistent color scheme across light/dark modes
- Add smooth scrolling
- Add focus-visible styles for accessibility
- Typography scale: consistent heading sizes, body text, captions
- Ensure all shadcn/ui component colors align with brand

- [ ] **Step 2: Update root layout**

- Add proper meta tags (description, og:image, etc.)
- Ensure Sonner Toaster is rendered at root level
- Proper font loading with display: swap

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat(ui): polish global styles, theme, typography, meta tags"
```

---

### Task 34: Remove Dead Code and Clean Up

**Files:**
- Delete: `lib/slack/classifier.ts` (replaced by `lib/ai/classifier.ts`)
- Delete: `app/dashboard/data.json` (sample data, no longer needed)
- Modify: `lib/db/queries.ts` (remove old deduplication function if superseded)
- Clean: Any unused imports across all modified files

- [ ] **Step 1: Remove old classifier**

Delete `lib/slack/classifier.ts`. The AI-powered classifier in `lib/ai/classifier.ts` replaces it entirely.

- [ ] **Step 2: Remove sample data**

Delete `app/dashboard/data.json` — dashboard now uses real DB queries.

- [ ] **Step 3: Clean up imports and unused code**

Run through all modified files and remove unused imports, dead functions, commented-out code.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead code, old classifier, sample data"
```

---

### Task 35: Responsive Testing and Final Fixes

**Files:**
- Various fixes across all UI files

- [ ] **Step 1: Test all pages at mobile breakpoint (375px)**

Check every page renders correctly:
- Landing page: stacked layout, hamburger nav, readable text
- Login/Signup: centered card doesn't overflow
- Dashboard overview: cards stack, charts resize, no horizontal scroll
- Tasks: table scrolls horizontally or cards stack
- Settings: tabs work on mobile, forms full-width
- Workspaces: cards stack
- Activity: timeline readable

Fix any overflow, truncation, or layout issues found.

- [ ] **Step 2: Test all pages at tablet breakpoint (768px)**

Check intermediate layouts work.

- [ ] **Step 3: Test dark mode on all pages**

Ensure all custom components respect dark mode. Check contrast ratios. Fix any white-on-white or black-on-black issues.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(ui): responsive and dark mode fixes across all pages"
```

---

### Task 36: Environment Variable Documentation

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example with all required variables**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Encryption (AES-256-GCM)
ENCRYPTION_KEY=

# OpenAI
OPENAI_API_KEY=
AI_MODEL=gpt-4o-mini

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_BOT_USERNAME=

# App URLs
NEXT_PUBLIC_APP_URL=
SLACK_REDIRECT_URI=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with all required variables"
```

---

### Task 37: Final Integration Verification

- [ ] **Step 1: Verify build succeeds**

Run: `npm run build`
Expected: No TypeScript errors, no build failures.

- [ ] **Step 2: Verify all API routes respond**

Start dev server, hit each endpoint:
- GET `/api/health` → 200
- POST `/api/categories` → 401 (no auth)
- POST `/api/invite-tokens` → 401
- GET `/api/workspaces/[id]/channels` → 401

- [ ] **Step 3: Verify all pages render**

Navigate to each page in browser:
- `/` → landing page
- `/login` → login form
- `/signup` → signup form
- `/dashboard` → overview (redirects to login if not authed)
- `/dashboard/tasks` → tasks page
- `/dashboard/workspaces` → workspaces page
- `/dashboard/settings` → settings page
- `/dashboard/activity` → activity page

- [ ] **Step 4: Final commit and tag**

```bash
git add -A
git commit -m "feat: SlackFlow v2.0 - targeted rebuild complete"
```
