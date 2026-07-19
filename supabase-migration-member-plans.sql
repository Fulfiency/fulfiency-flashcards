-- Tracks which Fulfiency plan (Starter / Pro / Élite) each member is on,
-- fed by the Stripe webhook. Keyed by email since Stripe checkout links
-- aren't tied to a Supabase user_id.
CREATE TABLE IF NOT EXISTS member_plans (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'elite')),
  stripe_customer_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE member_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan" ON member_plans
  FOR SELECT USING (auth.jwt()->>'email' = email);

CREATE POLICY "Coach can read all plans" ON member_plans
  FOR SELECT USING (auth.jwt()->>'email' = 'jordan.garnier53000@gmail.com');
