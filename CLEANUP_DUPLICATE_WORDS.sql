-- ============================================================================
-- CLEANUP SCRIPT: Remove words from review_words if they exist in learned_words
-- ============================================================================
-- This script cleans up any words that appear in both learned_words and 
-- review_words tables. A word should only be in ONE of these tables.
--
-- Run this in your Supabase SQL editor.
-- ============================================================================

-- Step 1: Find and delete duplicate entries
-- This removes review_words entries where the word_id already exists in learned_words
DELETE FROM review_words
WHERE (user_id, word_id) IN (
  SELECT rw.user_id, rw.word_id
  FROM review_words rw
  INNER JOIN learned_words lw 
    ON rw.user_id = lw.user_id 
    AND rw.word_id = lw.word_id
);

-- Step 2: Verify the cleanup worked
-- Run this to see if there are still any duplicates:
-- SELECT rw.user_id, rw.word_id, COUNT(*) as count
-- FROM review_words rw
-- INNER JOIN learned_words lw 
--   ON rw.user_id = lw.user_id 
--   AND rw.word_id = lw.word_id
-- GROUP BY rw.user_id, rw.word_id;
-- (Should return 0 rows if cleanup was successful)

-- Step 3: Optional - View summary of learned vs review words after cleanup
-- SELECT 
--   (SELECT COUNT(*) FROM learned_words) as total_learned,
--   (SELECT COUNT(*) FROM review_words) as total_review;
