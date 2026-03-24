-- ─── SlackFlow Database Schema ───────────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── workspaces ─────────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_team_id        TEXT        UNIQUE NOT NULL,
  name                 TEXT        NOT NULL,
  access_token_enc     TEXT        NOT NULL,
  access_token_iv      TEXT        NOT NULL,
  bot_user_id          TEXT        NOT NULL DEFAULT '',
  monitored_channels   TEXT[]      DEFAULT '{}',
  installed_at         TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workspaces_owner ON workspaces (owner_id);
CREATE INDEX idx_workspaces_team_id ON workspaces (slack_team_id);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their workspaces"
  ON workspaces FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Service role bypass (for webhook routes)
CREATE POLICY "Service role bypass"
  ON workspaces FOR ALL
  USING (true) WITH CHECK (true);

-- ── roles ──────────────────────────────────────────────────────────────────────
CREATE TYPE role_type AS ENUM ('BUILDER', 'TESTER', 'DESIGNER', 'PM', 'SUPPORT');

CREATE TABLE roles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                 role_type   NOT NULL DEFAULT 'BUILDER',
  name                 TEXT        NOT NULL,
  telegram_chat_id     TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_roles_owner ON roles (owner_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their roles"
  ON roles FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ── workspace_roles ────────────────────────────────────────────────────────────
CREATE TYPE task_category AS ENUM ('BUG', 'FEATURE', 'GENERAL');

CREATE TABLE workspace_roles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role_id              UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  category             task_category NOT NULL,
  UNIQUE (workspace_id, category)
);

CREATE INDEX idx_workspace_roles_workspace ON workspace_roles (workspace_id);

ALTER TABLE workspace_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass" ON workspace_roles FOR ALL USING (true) WITH CHECK (true);

-- ── tasks ──────────────────────────────────────────────────────────────────────
CREATE TYPE task_status AS ENUM ('pending', 'draft_ready', 'approved', 'edited', 'dismissed', 'sent', 'failed');

CREATE TABLE tasks (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel              TEXT        NOT NULL,
  thread_ts            TEXT        NOT NULL,
  original_text        TEXT        NOT NULL,
  sender_name          TEXT,
  category             task_category,
  category_confidence  REAL,
  draft_text           TEXT,
  edited_text          TEXT,
  final_text           TEXT,
  status               task_status NOT NULL DEFAULT 'pending',
  role_id              UUID        REFERENCES roles(id) ON DELETE SET NULL,
  telegram_message_id  INTEGER,
  ai_model             TEXT,
  ai_tokens_used       INTEGER,
  draft_generated_at   TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_workspace ON tasks (workspace_id, created_at DESC);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_telegram_msg ON tasks (telegram_message_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- ── activity_log ───────────────────────────────────────────────────────────────
CREATE TABLE activity_log (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id              UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  actor                TEXT        NOT NULL,
  action               TEXT        NOT NULL,
  details              JSONB,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_log_workspace ON activity_log (workspace_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass" ON activity_log FOR ALL USING (true) WITH CHECK (true);

-- ── rate_limits ────────────────────────────────────────────────────────────────
CREATE TABLE rate_limits (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key                  TEXT        UNIQUE NOT NULL,
  count                INTEGER     NOT NULL DEFAULT 0,
  window_start         TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_rate_limits_key ON rate_limits (key);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass" ON rate_limits FOR ALL USING (true) WITH CHECK (true);
