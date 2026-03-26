-- Message filter mode per workspace
ALTER TABLE workspaces ADD COLUMN message_filter_mode TEXT NOT NULL DEFAULT 'all' CHECK (message_filter_mode IN ('all', 'ignore_team', 'whitelist_only'));
-- Whitelisted Slack user IDs (used in whitelist_only mode)
ALTER TABLE workspaces ADD COLUMN whitelisted_slack_users TEXT[] NOT NULL DEFAULT '{}';
-- Team Slack user IDs to ignore (used in ignore_team mode, auto-populated or manual)
ALTER TABLE workspaces ADD COLUMN ignored_slack_users TEXT[] NOT NULL DEFAULT '{}';
