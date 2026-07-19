-- Sub-decks: add parent_id to decks
ALTER TABLE decks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES decks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_decks_parent ON decks(parent_id);

-- Daily goal tracking
CREATE TABLE IF NOT EXISTS daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  cards_reviewed INTEGER DEFAULT 0,
  goal INTEGER DEFAULT 20,
  UNIQUE(user_id, date)
);
ALTER TABLE daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_goals" ON daily_goals FOR ALL USING (auth.uid() = user_id);

-- Tags column (if not already added)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_cards_tags ON cards USING GIN(tags);
