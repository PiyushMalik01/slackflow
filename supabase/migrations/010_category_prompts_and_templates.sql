-- Per-category system prompts
ALTER TABLE categories ADD COLUMN system_prompt TEXT NOT NULL DEFAULT '';

-- Response templates table
CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON response_templates FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Service role bypass for templates"
  ON response_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);
