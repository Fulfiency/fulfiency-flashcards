-- Fulfiency Flashcards — Supabase schema
-- Run this in your Supabase SQL Editor

-- Decks
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#c9a552',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  due TIMESTAMPTZ DEFAULT NOW(),
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0,
  elapsed_days INTEGER DEFAULT 0,
  scheduled_days INTEGER DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state INTEGER DEFAULT 0,
  last_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review logs
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  state INTEGER NOT NULL,
  due TIMESTAMPTZ,
  stability FLOAT,
  difficulty FLOAT,
  elapsed_days INTEGER,
  scheduled_days INTEGER,
  review TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_decks" ON decks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_cards" ON cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_logs" ON review_logs FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_cards_due ON cards(user_id, due);
CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_logs_card ON review_logs(card_id);
