-- ─── Flexible Categories Migration ──────────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Alter `workspace_roles` table to use TEXT instead of ENUM
ALTER TABLE workspace_roles ALTER COLUMN category DROP DEFAULT;
ALTER TABLE workspace_roles ALTER COLUMN category TYPE TEXT USING category::text;

-- 2. Alter `tasks` table to use TEXT instead of ENUM
ALTER TABLE tasks ALTER COLUMN category DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN category TYPE TEXT USING category::text;

-- 3. Drop the old ENUM type
DROP TYPE IF EXISTS task_category;
