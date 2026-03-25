-- Shared workspace model: multiple users share ONE workspace row via workspace_members
-- Instead of each user having their own workspace row, we have ONE workspace per Slack team
-- and a members table tracking which users have access.

-- Workspace members — tracks which users have access to which workspace
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin', -- for future: 'admin', 'member', 'viewer'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own memberships"
  ON workspace_members FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass for workspace_members"
  ON workspace_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill: create membership for existing workspace owners
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'admin' FROM workspaces
ON CONFLICT DO NOTHING;
