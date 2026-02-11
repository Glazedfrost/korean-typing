-- ============================================================================
-- Recall Mode: Learned and Review Words Tables
-- ============================================================================
-- These tables store user progress in Recall Mode, persisting learned and failed words

-- ============================================================================
-- TABLE: learned_words
-- Stores words successfully learned by the user
-- ============================================================================
CREATE TABLE learned_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL,
  word_data JSONB NOT NULL, -- Full word metadata (korean, en, zh, etc)
  learned_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure unique constraint (user can't learn the same word twice)
CREATE UNIQUE INDEX idx_learned_words_user_word ON learned_words(user_id, word_id);
CREATE INDEX idx_learned_words_user_id ON learned_words(user_id);

-- ============================================================================
-- TABLE: review_words
-- Stores words user answered incorrectly (needs review)
-- ============================================================================
CREATE TABLE review_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL,
  word_data JSONB NOT NULL, -- Full word metadata (korean, en, zh, etc)
  failed_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for queries
CREATE INDEX idx_review_words_user_id ON review_words(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on both tables

ALTER TABLE learned_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_words ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- learned_words Policies
-- ============================================================================

-- SELECT: Users can view their own learned words
CREATE POLICY "Users can view their own learned words"
ON learned_words
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Users can insert their own learned words
CREATE POLICY "Users can insert their own learned words"
ON learned_words
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own learned words
CREATE POLICY "Users can update their own learned words"
ON learned_words
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own learned words
CREATE POLICY "Users can delete their own learned words"
ON learned_words
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- review_words Policies
-- ============================================================================

-- SELECT: Users can view their own review words
CREATE POLICY "Users can view their own review words"
ON review_words
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Users can insert their own review words
CREATE POLICY "Users can insert their own review words"
ON review_words
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own review words
CREATE POLICY "Users can update their own review words"
ON review_words
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own review words
CREATE POLICY "Users can delete their own review words"
ON review_words
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- Verification
-- ============================================================================
-- After pasting this SQL into Supabase:
-- 1. Both tables should have 4 RLS policies each (SELECT, INSERT, UPDATE, DELETE)
-- 2. RLS should be enabled on both tables
-- 3. All policies use auth.uid() = user_id for user isolation
-- 4. Unique constraint ensures no duplicate learned words per user
-- ============================================================================
