-- ============================================================================
-- Row Level Security (RLS) Policies for user_stats table
-- ============================================================================
-- IMPORTANT: Before applying these policies:
-- 1. In Supabase dashboard, go to: Authentication > Policies
-- 2. Select the user_stats table
-- 3. Enable RLS toggle if not already enabled
-- 4. Copy and paste each policy below into the SQL editor
-- 5. Each policy will be automatically enabled after creation
-- ============================================================================

-- Policy 1: Allow SELECT - Users can only view their own stats
CREATE POLICY "Users can view their own stats"
ON user_stats
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Allow INSERT - Users can only insert their own stats
CREATE POLICY "Users can insert their own stats"
ON user_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Allow UPDATE - Users can only update their own stats
CREATE POLICY "Users can update their own stats"
ON user_stats
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4 (optional): Allow DELETE - Users can delete their own stats
CREATE POLICY "Users can delete their own stats"
ON user_stats
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- Verification
-- ============================================================================
-- After applying all policies, your user_stats table should have:
-- - 4 policies enabled (SELECT, INSERT, UPDATE, DELETE)
-- - RLS toggle ON
-- - All policies using auth.uid() = user_id for authentication
-- ============================================================================
