-- Log des générations de cartes par IA, pour appliquer une limite mensuelle par utilisateur
-- Run this in your Supabase SQL Editor

CREATE TABLE ai_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_ai_generation_log" ON ai_generation_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_ai_generation_log_user_date ON ai_generation_log(user_id, created_at);
