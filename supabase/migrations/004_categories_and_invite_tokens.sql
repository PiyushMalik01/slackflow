-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6B7280',
  emoji TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Service role bypass for categories"
  ON categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Unique constraint for category names per owner (needed for ON CONFLICT in seeding)
ALTER TABLE categories ADD CONSTRAINT categories_owner_name_unique UNIQUE (owner_id, name);

-- Invite tokens table
CREATE TABLE invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage invite tokens via roles"
  ON invite_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roles WHERE roles.id = invite_tokens.role_id AND roles.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles WHERE roles.id = invite_tokens.role_id AND roles.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role bypass for invite tokens"
  ON invite_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add status to roles
ALTER TABLE roles ADD COLUMN status TEXT NOT NULL DEFAULT 'pending_link';

-- Index for fast token lookup
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
