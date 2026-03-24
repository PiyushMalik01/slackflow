-- Enable Realtime for dashboard tables
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE roles;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE invite_tokens;
