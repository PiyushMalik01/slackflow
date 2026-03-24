# SlackFlow Targeted Rebuild — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Approach:** Targeted Rebuild (keep Supabase, Next.js, Slack OAuth, encryption; rebuild integration logic, AI pipeline, Telegram flow, UI)

---

## Context

SlackFlow is an AI-powered workflow automation platform that bridges Slack and Telegram. It captures messages from monitored Slack channels, classifies them using AI, generates draft responses, and routes tasks to team members via Telegram for approval before posting replies back to Slack.

**Current state:** Functional prototype with significant gaps in onboarding UX, AI classification, Telegram state management, security, and UI quality.

**Target user:** Single admin managing workspaces. Team members interact only via Telegram.

**Scale target:** Small teams now (1-5 workspaces, <50 messages/day), architected for medium scale (5-20 workspaces, 50-500 messages/day).

---

## 1. Telegram Onboarding Overhaul

### Problem
Every team member must manually find their Telegram chat ID and give it to the admin. This is a UX blocker for adoption.

### Design

**Invite-link flow:**
1. Admin creates a role in the dashboard (e.g., "DevOps Lead — Rahul")
2. System generates a unique invite token and deep link: `t.me/SlackFlowBot?start=inv_a8f3c2`
3. Admin copies the link and sends it to the team member via any channel
4. Team member clicks the link -> Telegram opens -> bot receives `/start inv_a8f3c2`
5. Bot validates the token, links the member's `chat_id` to the role automatically
6. Bot sends confirmation: "You're now linked as DevOps Lead. You'll receive task notifications here."
7. Dashboard shows the role status change in real-time (linked/unlinked indicator)

**Database changes:**
- New `invite_tokens` table:
  - `id` (UUID, PK)
  - `role_id` (UUID, FK to roles)
  - `token` (TEXT, UNIQUE) — format: `inv_` + 16 crypto-random alphanumeric chars (~95 bits entropy)
  - `expires_at` (TIMESTAMPTZ) — 24 hours from creation
  - `used_at` (TIMESTAMPTZ, nullable)
  - `created_at` (TIMESTAMPTZ)
- Add `status` field to `roles` table: `pending_link` | `linked` | `unlinked`

**Security:**
- Tokens expire after 24 hours
- Single-use (invalidated after linking)
- Admin can regenerate expired tokens
- Token validated against role ownership

---

## 2. AI-Powered Smart Routing with Custom Categories

### Problem
Current classifier is keyword-only (hardcoded Bug/Feature/General). Brittle, can't handle nuance, no custom categories.

### Design

**Custom Categories:**
- Admin defines categories in dashboard (e.g., "Design", "DevOps", "Billing", "Urgent", "Support")
- Each category has: name, description (helps AI understand intent), color, emoji, mapped role
- Default starter set on account creation: Bug, Feature, General
- Admin can add, edit, delete categories freely

**AI Classifier (replaces keyword matcher):**
- Single GPT-4o-mini call with dynamic system prompt containing all admin-defined categories + descriptions
- Returns structured JSON: `{ "category": "...", "confidence": 0.0-1.0, "reasoning": "..." }`
- If confidence < 0.5, falls back to "General" and flags for admin review
- Category descriptions act as few-shot guidance — admin tunes accuracy by refining descriptions

**Smart Assignment Logic:**
1. AI classifies message into a custom category
2. System looks up the role mapped to that category via `workspace_roles`
3. Task created and routed to the mapped person's Telegram
4. Future: round-robin or workload-based assignment if multiple people share a role

**Combined Pipeline:**
- Merge classification + draft generation into a single structured API call
- Use OpenAI JSON mode for reliable parsing (no regex fallback)
- Saves latency (one API call instead of two) and cost
- **Fallback on AI failure:** If the combined call fails, route task to "General" category with no draft, flag for admin review, and notify via Telegram with "AI draft unavailable — original message attached." This ensures task creation and routing always succeed even without AI.

**Prompt Versioning:**
- Persist prompt version hash in `tasks.ai_prompt_version` for each task so classification behavior can be audited when admins report incorrect routing.

**Database changes:**
- New `categories` table:
  - `id` (UUID, PK)
  - `owner_id` (UUID, FK to auth.users)
  - `name` (TEXT)
  - `description` (TEXT) — used in AI prompt
  - `color` (TEXT) — hex color for UI badges
  - `emoji` (TEXT)
  - `is_default` (BOOLEAN)
  - `created_at` (TIMESTAMPTZ)
  - RLS: owner-based access policy (same pattern as `roles` table)
- Modify `workspace_roles.category` from TEXT to `category_id` (UUID, FK to categories)
- Add `category_id` (UUID, FK to categories, nullable) to `tasks` table — denormalize `category` text for display but add FK for referential integrity
- Add `ai_prompt_version` (TEXT, nullable) to `tasks` table

**Migration strategy for `workspace_roles.category`:**
1. Create `categories` table first, seed default rows for Bug/Feature/General per owner
2. Add `category_id` column to `workspace_roles` (nullable initially)
3. Populate `category_id` by joining on category name + owner
4. Drop old `category` TEXT column
5. Add NOT NULL constraint to `category_id`
6. Recreate UNIQUE constraint as `UNIQUE(workspace_id, category_id)`
7. Update `resolveRole()` and `setWorkspaceRole()` queries in `queries.ts` to use `category_id`

---

## 3. Telegram Integration Rebuild

### Problem
Edit mode uses in-memory `Map<chatId, taskId>` — lost on every deployment. Interactions are basic. No way for team members to see pending tasks.

### Design

**State Management:**
- All conversation state moves to Supabase
- New `telegram_sessions` table for tracking edit flows
- Survives restarts, works across serverless invocations

**Richer Notifications:**
- HTML-formatted message with: workspace name, channel, sender name, category (with emoji), confidence score, AI draft preview (truncated to 200 chars)
- Inline keyboard: `Approve` | `Edit` | `Dismiss` | `View Original`
- After action: message updates in-place via `editMessageText` (no chat clutter)
- **Note:** Telegram limits `callback_data` to 64 bytes. Current pattern `{uuid}:{action}` uses ~44 bytes. Keep action names short if adding more buttons.

**Edit Flow:**
1. User taps "Edit" -> bot replies "Send your edited response (or /cancel to abort)"
2. State tracked in `telegram_sessions` with 30-minute TTL
3. User sends text -> bot shows preview with `Confirm` | `Cancel` buttons
4. On confirm -> posts to Slack, updates task status
5. On cancel or TTL expiry -> session cleaned up

**Session TTL Cleanup:** Lazy cleanup on read (check `expires_at` before using any session). Additionally, a Supabase pg_cron job runs hourly to delete expired sessions (`DELETE FROM telegram_sessions WHERE expires_at < now()`).

**Bot Commands:**
- `/start inv_xxxxx` — Onboarding link (from Section 1)
- `/pending` — List all pending tasks assigned to this person
- `/status` — Show link status, workspace info, role
- `/help` — Available commands and usage

**Database changes:**
- New `telegram_sessions` table:
  - `id` (UUID, PK)
  - `chat_id` (TEXT)
  - `task_id` (UUID, FK to tasks)
  - `state` (TEXT: `editing` | `confirming`)
  - `draft_text` (TEXT, nullable)
  - `expires_at` (TIMESTAMPTZ)
  - `created_at` (TIMESTAMPTZ)
  - RLS: service-role-bypass policy (accessed from webhook routes via service client)

---

## 4. Security Hardening & Production Readiness

### Problem
Missing CSRF protection, inconsistent input validation, no error boundaries, no webhook idempotency persistence.

### Security Fixes

- **API Input Validation:** Zod schemas on every API route input. All POST/PUT/DELETE bodies validated before processing.
- **CSRF Protection:** Origin/referer checking on all mutation endpoints.
- **Rate Limiting Tuning:**
  - Slack events: 60/min per workspace
  - Telegram webhook: 100/min
  - API mutations: 30/min per user
  - Slack install: 5/hour (existing)
- **Error Sanitization:** Structured error responses `{ error: string, code: string }`. No internal details leaked.
- **Telegram Webhook Auth:** Validate `X-Telegram-Bot-Api-Secret-Token` header on every incoming webhook request. Set the secret token via Telegram's `setWebhook` API `secret_token` parameter.
- **Webhook Idempotency:** Dedicated `processed_events` table replaces in-memory dedup. Auto-cleanup of entries > 24h old. Insert event ID immediately on receipt using `INSERT ... ON CONFLICT DO NOTHING` — if insert succeeds (row was new), proceed with processing; if conflict, skip. This handles concurrent serverless invocations safely.

### Production Readiness

- **React Error Boundaries:** Per dashboard section. Friendly fallback UI with retry button.
- **Structured Logging:** Correlation IDs on every request, consistent across all API routes and pipeline steps.
- **Health Check Enhancement:** Add Telegram bot connectivity check and encryption key validity check.
- **Graceful Degradation:** If AI fails, still create task and notify via Telegram with "AI draft unavailable" note and original message. Route to "General" category as fallback (see Section 2 fallback strategy).
- **Background Processing:** Replace `setImmediate()` in Slack events route with Next.js `after()` from `next/server` (or Vercel `waitUntil`) to ensure background work (AI pipeline + Telegram notification) completes before serverless function teardown.
- **Database Indexes:**
  - `tasks(workspace_id, status)`
  - `tasks(created_at)`
  - `activity_log(workspace_id, created_at)`
  - `processed_events(processed_at)` — for TTL cleanup
  - `invite_tokens(token)` — for fast lookup
  - `telegram_sessions(chat_id, state)` — for active session lookup

### Database changes
- New `processed_events` table:
  - `event_id` (TEXT, PK) — Slack event ID
  - `workspace_id` (UUID, FK)
  - `processed_at` (TIMESTAMPTZ)
  - RLS: service-role-bypass policy

---

## 5. UI/UX Overhaul

### Problem
Dashboard feels scaffolded. Landing page is generic. Broken responsiveness. No loading states or animations.

### Landing Page

- Clear value proposition above the fold: "AI routes your Slack messages to the right person, automatically"
- Animated workflow diagram: Slack message -> AI classification -> Telegram notification -> Reply posted
- Feature cards with icons and clean typography
- Social proof section (placeholder-ready)
- Mobile layout with hamburger navigation
- CTA: "Get Started" -> signup

### Dashboard

- **Sidebar:** Clean navigation with active state indicators, workspace name at top, collapse to icon-only on mobile via sheet/drawer
- **Overview:** Real metric cards pulling from actual DB queries (tasks today, approval rate, avg response time, pending count). Recent tasks feed with status badges. Setup checklist that auto-hides once complete.
- **Tasks Page:** Filterable/sortable table with status pills (color-coded per status), category badges (color from category settings), search, date range filter. Click to expand task detail with original message, AI draft, final response, and timeline.
- **Settings Page:** Tabbed layout:
  - Categories tab: CRUD with color picker, emoji selector, description field
  - Roles tab: CRUD with invite link generation, link status indicator (green=linked, yellow=pending, red=unlinked)
  - Routing tab: Map categories to roles with dropdowns
- **Workspaces Page:** Card layout showing workspace name, status, monitored channel count, last active timestamp. Prominent "Add Workspace" CTA.
- **Activity Page:** Timeline-style log with filters (action type, workspace, date range).

### Global UX

- Loading skeletons on every data-fetching component
- Toast notifications for all actions via Sonner
- Smooth transitions between pages
- Mobile-first responsive design — every page functional on phone
- Polished dark mode (not just color inversion)
- Error boundaries per section with friendly fallback + retry

---

## 6. Slack Integration Improvements

### Problem
Manual bot invite required. Manual channel ID entry. No user profile context. No failure recovery.

### Design

- **Auto-discover channels:** After OAuth, fetch public channel list via `conversations.list`. Display as toggleable cards in dashboard. Admin clicks to monitor/unmonitor.
- **Bot invite detection:** Capture `member_joined_channel` / `member_left_channel` events. Auto-update monitored status in dashboard.
- **User profile resolution:** Resolve Slack user profiles via `users.info`. Show real names and avatars in task views. Cache in DB to minimize API calls.
- **Thread awareness:** If message is a thread reply, include parent message context in AI prompt for better draft quality.
- **Failure notifications:** If Slack reply fails (token expired, channel archived), notify admin via Telegram with error details and retry option.
- **OAuth scope expansion:** Add `channels:read` for channel listing (`users:read` already present in current scopes).
- **Re-authorization flow:** Adding `channels:read` requires existing workspaces to re-authorize. Add a dashboard banner prompting admins to re-install when the app detects missing scopes (check on workspace load by attempting `conversations.list` and handling scope errors gracefully).

### Database changes
- New `slack_user_cache` table:
  - `slack_user_id` (TEXT)
  - `workspace_id` (UUID, FK)
  - `display_name` (TEXT)
  - `avatar_url` (TEXT, nullable)
  - `cached_at` (TIMESTAMPTZ)
  - PK: `(slack_user_id, workspace_id)`
  - RLS: service-role-bypass policy
- Add `thread_context` (TEXT, nullable) field to `tasks` table

**User profile resolution timing:** Resolve after task creation but before Telegram notification, using the cache (skip API call if cached within 24h). Fall back to Slack user ID if resolution fails. Non-blocking — profile resolution failure must not prevent notification.

---

## Database Schema Summary (New Tables)

| Table | Purpose |
|-------|---------|
| `categories` | Admin-defined custom task categories |
| `invite_tokens` | Single-use Telegram onboarding links |
| `telegram_sessions` | DB-backed conversation state for edit flows |
| `processed_events` | Webhook idempotency (replaces in-memory dedup) |
| `slack_user_cache` | Cached Slack user profiles |

## Existing Table Modifications

| Table | Change |
|-------|--------|
| `roles` | Add `status` field (pending_link/linked/unlinked) |
| `workspace_roles` | Change `category` TEXT to `category_id` UUID FK (see Section 2 migration strategy) |
| `tasks` | Add `thread_context` TEXT, `category_id` UUID FK, `ai_prompt_version` TEXT |

---

## What Stays Unchanged

- **Supabase** as database + auth provider
- **Next.js App Router** with server components
- **Slack OAuth flow** (extend scopes, keep flow)
- **AES-256-GCM encryption** for access tokens
- **Pino logging** (enhance with consistent correlation IDs)
- **shadcn/ui** component library (rebuild pages, keep primitives)
- **Vercel deployment** target

---

## Out of Scope (Future)

- Multi-admin / team dashboard access
- Billing / subscription management
- Slack DM notifications (Telegram only for now)
- Multi-language support
- Mobile app
- Redis / external queue (Supabase sufficient for medium scale)
