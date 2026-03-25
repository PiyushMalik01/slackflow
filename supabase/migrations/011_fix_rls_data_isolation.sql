-- Fix broken RLS policies that granted public access instead of service_role only
-- This was the root cause of cross-user data leakage

-- Fix tasks
DROP POLICY IF EXISTS "Service role bypass" ON tasks;
CREATE POLICY "Service role bypass for tasks"
  ON tasks FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Users see tasks from own workspaces"
  ON tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces WHERE workspaces.id = tasks.workspace_id AND workspaces.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces WHERE workspaces.id = tasks.workspace_id AND workspaces.owner_id = auth.uid()
    )
  );

-- Fix activity_log
DROP POLICY IF EXISTS "Service role bypass" ON activity_log;
CREATE POLICY "Service role bypass for activity_log"
  ON activity_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Users see activity from own workspaces"
  ON activity_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces WHERE workspaces.id = activity_log.workspace_id AND workspaces.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces WHERE workspaces.id = activity_log.workspace_id AND workspaces.owner_id = auth.uid()
    )
  );

-- Fix workspace_roles
DROP POLICY IF EXISTS "Service role bypass" ON workspace_roles;
CREATE POLICY "Service role bypass for workspace_roles"
  ON workspace_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Users see workspace_roles from own workspaces"
  ON workspace_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces WHERE workspaces.id = workspace_roles.workspace_id AND workspaces.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces WHERE workspaces.id = workspace_roles.workspace_id AND workspaces.owner_id = auth.uid()
    )
  );

-- Fix workspaces service role (was on {public} instead of {service_role})
DROP POLICY IF EXISTS "Service role bypass" ON workspaces;
CREATE POLICY "Service role bypass for workspaces"
  ON workspaces FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Add missing service_role bypass for roles
CREATE POLICY "Service role bypass for roles"
  ON roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);
