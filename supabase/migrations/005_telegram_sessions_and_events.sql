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
