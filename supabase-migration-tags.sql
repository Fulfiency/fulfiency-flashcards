-- Add tags column to cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_cards_tags ON cards USING GIN(tags);
