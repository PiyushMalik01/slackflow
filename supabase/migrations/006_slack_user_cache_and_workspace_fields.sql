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

ALTER TABLE workspaces ADD COLUMN team_group_chat_id TEXT;
ALTER TABLE workspaces ADD COLUMN daily_digest_time TEXT;
ALTER TABLE workspaces ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#3B82F6';

ALTER TABLE tasks ADD COLUMN thread_context TEXT;
