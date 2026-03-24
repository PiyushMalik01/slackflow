-- Migration 002: Flexible Roles

-- Step 1: Add a new TEXT column
ALTER TABLE roles ADD COLUMN type_text TEXT;

-- Step 2: Migrate existing data from the ENUM to the TEXT column
UPDATE roles SET type_text = type::text;

-- Step 3: Set the default and NOT NULL constraints on the new column
ALTER TABLE roles ALTER COLUMN type_text SET DEFAULT 'BUILDER', ALTER COLUMN type_text SET NOT NULL;

-- Step 4: Drop the old ENUM column
ALTER TABLE roles DROP COLUMN type;

-- Step 5: Rename the new column to 'type'
ALTER TABLE roles RENAME COLUMN type_text TO type;

-- Step 6: Drop the ENUM type entirely since it's no longer used
DROP TYPE role_type;
