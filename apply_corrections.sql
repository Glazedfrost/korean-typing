-- ============================================================================
-- View Reviewed Corrections
-- ============================================================================
-- Run this query to see all reviewed corrections that need to be applied
-- to the JSON data file

SELECT 
  korean,
  current_meaning,
  corrected_meaning,
  user_id,
  created_at
FROM reported_meanings
WHERE status = 'reviewed'
ORDER BY created_at DESC;

-- After updating the JSON file with these corrections, you can mark them as 'applied':
-- UPDATE reported_meanings SET status = 'applied' WHERE status = 'reviewed';

-- ============================================================================
-- Alternative: View All Pending Reports (Not Yet Applied)
-- ============================================================================

SELECT 
  korean,
  current_meaning,
  corrected_meaning,
  status,
  created_at
FROM reported_meanings
WHERE status IN ('pending', 'reviewed')
ORDER BY status DESC, created_at DESC;
