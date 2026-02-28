-- Add categories array column for multi-select support
-- The existing 'category' column is kept for backward compatibility

ALTER TABLE memories
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY['uncategorized']::TEXT[];

-- Backfill: copy existing category into categories array
UPDATE memories
SET categories = ARRAY[category]
WHERE categories IS NULL OR array_length(categories, 1) IS NULL;

-- Update the category check constraint to include 'uncategorized'
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_category_check;
ALTER TABLE memories ADD CONSTRAINT memories_category_check
  CHECK (category IN ('uncategorized', 'success', 'peace', 'fun', 'love', 'gratitude', 'inspiration', 'growth', 'adventure'));
