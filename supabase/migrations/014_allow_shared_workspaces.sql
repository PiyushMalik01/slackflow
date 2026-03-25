-- Allow multiple users to connect the same Slack workspace
-- Previously, slack_team_id was globally UNIQUE, meaning one workspace per team.
-- Now we allow different users to each connect the same workspace, with full data isolation.
-- The unique constraint becomes (owner_id, slack_team_id): same user can't add the same workspace twice.

-- Drop the global unique constraint on slack_team_id
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_slack_team_id_key;

-- Add a composite unique constraint: same user can't connect same workspace twice
ALTER TABLE workspaces ADD CONSTRAINT workspaces_owner_slack_team_unique UNIQUE (owner_id, slack_team_id);
