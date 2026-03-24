CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  openai_api_key_enc TEXT,
  openai_api_key_iv TEXT,
  openai_refresh_token_enc TEXT,
  openai_refresh_token_iv TEXT,
  openai_email TEXT,
  openai_plan_type TEXT,
  openai_auth_method TEXT CHECK (openai_auth_method IN ('oauth-device', 'api-key')),
  openai_connected_at TIMESTAMPTZ,
  openai_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai_settings"
  ON ai_settings FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Service role bypass for ai_settings"
  ON ai_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
