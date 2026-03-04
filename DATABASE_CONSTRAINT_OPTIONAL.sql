-- ============================================================================
-- OPTIONAL: Add Database Constraint to Prevent Duplicates
-- ============================================================================
-- This adds a trigger that automatically removes a word from review_words
-- when it's added to learned_words (database-level enforcement).
--
-- This is optional but recommended for data integrity.
-- Run this in your Supabase SQL editor if you want automatic cleanup at the DB level.
-- ============================================================================

-- Create a trigger function that removes from review_words when adding to learned_words
CREATE OR REPLACE FUNCTION ensure_word_not_in_review()
RETURNS TRIGGER AS $$
BEGIN
  -- When a word is inserted into learned_words, remove it from review_words
  DELETE FROM review_words
  WHERE user_id = NEW.user_id
    AND word_id = NEW.word_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_learned_word_cleanup ON learned_words;
CREATE TRIGGER trigger_learned_word_cleanup
AFTER INSERT ON learned_words
FOR EACH ROW
EXECUTE FUNCTION ensure_word_not_in_review();

-- ============================================================================
-- OPTIONAL: Reverse trigger (remove from learned if added to review)
-- ============================================================================
-- Uncomment below if you want the opposite: remove from learned_words when adding to review_words
-- (This is less common, but available if needed)

/*
CREATE OR REPLACE FUNCTION ensure_word_not_in_learned()
RETURNS TRIGGER AS $$
BEGIN
  -- When a word is inserted into review_words, remove it from learned_words
  DELETE FROM learned_words
  WHERE user_id = NEW.user_id
    AND word_id = NEW.word_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_review_word_cleanup ON review_words;
CREATE TRIGGER trigger_review_word_cleanup
AFTER INSERT ON review_words
FOR EACH ROW
EXECUTE FUNCTION ensure_word_not_in_learned();
*/
