-- ============================================================================
-- REPORTED MEANINGS TABLE - For Debug/Feedback Feature
-- ============================================================================
-- This table stores user reports of incorrect word meanings/translations.
-- Users can click the debug button (bottom right, orange circle) to report
-- when a word's meaning is wrong and provide the correct one.
--
-- Run this in your Supabase SQL editor after creating the main user_stats table.
-- ============================================================================

-- Create the reported_meanings table
CREATE TABLE reported_meanings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL,
  korean TEXT NOT NULL,
  current_meaning TEXT NOT NULL,
  corrected_meaning TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_reported_meanings_user_id ON reported_meanings(user_id);
CREATE INDEX idx_reported_meanings_word_id ON reported_meanings(word_id);
CREATE INDEX idx_reported_meanings_status ON reported_meanings(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on the reported_meanings table

ALTER TABLE reported_meanings ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can only see their own reports
CREATE POLICY select_own_reports ON reported_meanings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: INSERT - Users can only insert their own reports
CREATE POLICY insert_own_reports ON reported_meanings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: UPDATE - Users can only update their own reports (status only)
CREATE POLICY update_own_reports ON reported_meanings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE - Users can only delete their own reports
CREATE POLICY delete_own_reports ON reported_meanings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- ADMIN QUERIES (Run these as admin to view all reports)
-- ============================================================================
-- To view all reported meanings (run in Supabase as admin):
-- SELECT * FROM reported_meanings ORDER BY created_at DESC;
--
-- To view reports for a specific word:
-- SELECT * FROM reported_meanings WHERE word_id = 'word-id-here' ORDER BY created_at DESC;
--
-- To mark a report as 'reviewed':
-- UPDATE reported_meanings SET status = 'reviewed' WHERE id = 'report-id-here';
--
-- To delete invalid reports:
-- DELETE FROM reported_meanings WHERE id = 'report-id-here';
