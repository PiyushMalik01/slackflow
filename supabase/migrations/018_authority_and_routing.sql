ALTER TABLE roles ADD COLUMN is_authority BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE telegram_sessions DROP CONSTRAINT IF EXISTS telegram_sessions_state_check;
ALTER TABLE telegram_sessions ADD CONSTRAINT telegram_sessions_state_check
  CHECK (state IN ('editing', 'confirming', 'routing', 'redirecting'));

ALTER TABLE telegram_sessions ADD COLUMN target_action TEXT;
