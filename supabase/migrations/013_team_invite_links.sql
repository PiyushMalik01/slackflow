CREATE TABLE team_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_joins INTEGER NOT NULL DEFAULT 20,
  join_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE team_invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own team_invite_links"
  ON team_invite_links FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Service role bypass for team_invite_links"
  ON team_invite_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);
