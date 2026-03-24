-- 004b_migrate_workspace_roles_category.sql

-- Step 1: Seed default categories for each existing owner
INSERT INTO categories (owner_id, name, description, emoji, color, is_default)
SELECT DISTINCT r.owner_id, 'Bug', 'Bug reports, errors, crashes, and broken functionality', '🐛', '#EF4444', true
FROM roles r
ON CONFLICT (owner_id, name) DO NOTHING;

INSERT INTO categories (owner_id, name, description, emoji, color, is_default)
SELECT DISTINCT r.owner_id, 'Feature', 'Feature requests, enhancements, and new functionality ideas', '✨', '#8B5CF6', true
FROM roles r
ON CONFLICT (owner_id, name) DO NOTHING;

INSERT INTO categories (owner_id, name, description, emoji, color, is_default)
SELECT DISTINCT r.owner_id, 'General', 'General questions, discussions, and miscellaneous messages', '💬', '#6B7280', true
FROM roles r
ON CONFLICT (owner_id, name) DO NOTHING;

-- Step 2: Add category_id column (nullable first)
ALTER TABLE workspace_roles ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE CASCADE;

-- Step 3: Populate category_id by joining on name + owner
UPDATE workspace_roles wr
SET category_id = c.id
FROM categories c
JOIN roles r ON r.owner_id = c.owner_id
WHERE UPPER(wr.category) = UPPER(c.name)
  AND wr.role_id = r.id;

-- Step 4: Drop old category column and constraints, add new ones
ALTER TABLE workspace_roles DROP CONSTRAINT IF EXISTS workspace_roles_workspace_id_category_key;
ALTER TABLE workspace_roles DROP COLUMN IF EXISTS category;
ALTER TABLE workspace_roles ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE workspace_roles ADD CONSTRAINT workspace_roles_workspace_id_category_id_key UNIQUE (workspace_id, category_id);

-- Step 5: Add category_id and ai_prompt_version to tasks
ALTER TABLE tasks ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN ai_prompt_version TEXT;
