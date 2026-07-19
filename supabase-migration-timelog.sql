-- Time Log: journal horaire + bilan du jour
-- Run this in your Supabase SQL Editor

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT NOT NULL,
  energy TEXT NOT NULL DEFAULT 'mid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE day_metrics (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  stress TEXT,
  sommeil TEXT,
  energie TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, entry_date)
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_time_entries" ON time_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_day_metrics" ON day_metrics FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_time_entries_day ON time_entries(user_id, entry_date);
