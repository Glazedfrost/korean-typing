## RECALL MODE: Learned/Review Words - Setup Guide

### Issues Fixed

1. **"No words match filters" error after learning words**
   - Fixed: Changed word pool logic to skip learned words via function instead of filtering them from wordList
   - Now: currentWord correctly skips learned words without breaking the pool

2. **Tabs reset on filter change**
   - Fixed: Tabs now persist learned/review words from Supabase
   - No longer reset on filter or mode changes

### What Changed

#### 1. Database Schema
Two new tables created to persist Recall Mode progress:

**learned_words table:**
- `id` (UUID primary key)
- `user_id` (UUID, foreign key to auth.users)
- `word_id` (TEXT, unique per user)
- `word_data` (JSONB, full word metadata)
- `learned_at` (timestamp)

**review_words table:**
- `id` (UUID primary key)
- `user_id` (UUID, foreign key to auth.users)
- `word_id` (TEXT)
- `word_data` (JSONB, full word metadata)
- `failed_count` (INTEGER, increments on each failure)
- `created_at`, `updated_at` (timestamps)

#### 2. Supabase Functions (lib/supabase.ts)
New functions added:
- `fetchLearnedWords(userId)` - Load learned words from DB
- `fetchReviewWords(userId)` - Load failed words from DB
- `addLearnedWord(userId, word)` - Save learned word
- `addReviewWord(userId, word)` - Save/update failed word
- `removeLearnedWord(userId, wordId)` - Delete learned word
- `removeReviewWord(userId, wordId)` - Delete review word

#### 3. Game Component (app/TypingGame.tsx)

**State changes:**
```typescript
const [learnedWords, setLearnedWords] = useState<Word[]>([]);
const [reviewWords, setReviewWords] = useState<Word[]>([]);
// Removed: failedWords, activeWordPool
```

**Auth listener now:**
1. Loads stats from user_stats
2. Fetches learned_words from DB
3. Fetches review_words from DB
4. Stores in component state

**Filter change behavior:**
- Game position resets
- Learned/review words NOT reset (persist from Supabase)

**Word selection logic:**
```typescript
const getValidCurrentWord = () => {
  // Skip learned words in currentIndex search
  // Returns next non-learned word
}
```

**Submit handler:**
- Correct answer: adds to learnedWords + saves to Supabase
- Wrong answer: adds to reviewWords + saves to Supabase
- No immediate requeue logic needed (handled in future phases)

**Tabs UI:**
- Shows data from learnedWords and reviewWords (Supabase state)
- Persists when filters change
- Updates in real-time as words are learned/failed

### Setup Instructions

#### Step 1: Create Tables & RLS Policies
1. Go to Supabase dashboard > SQL Editor
2. Copy entire contents of `RECALL_MODE_SETUP.sql`
3. Paste into SQL editor and run
4. Verify: Both tables should have 8 RLS policies total (4 each)

#### Step 2: Verify Table Creation
In Supabase dashboard > Database > Tables:
- ✓ `learned_words` table exists
- ✓ `review_words` table exists
- ✓ Both have RLS enabled
- ✓ Each has 4 policies (SELECT, INSERT, UPDATE, DELETE)

#### Step 3: Test the Feature
1. Run `npm run dev`
2. Sign in or sign up
3. Switch to Recall Mode
4. Type a word correctly:
   - Should add to "Learned" tab
   - Shouldn't appear again in this session
   - Should appear in Learned tab (persisted from DB)
5. Type a word incorrectly:
   - Should add to "To Review" tab
   - Should appear again later in pool
   - Should appear in To Review tab (persisted from DB)
6. Change filters:
   - Learned/Review tabs should stay populated
   - Should NOT reset
7. Refresh page:
   - Learned/Review tabs load from Supabase
   - Previous progress visible

### Architecture

```
User Signs In
    ↓
Load stats from user_stats
Load learned_words from DB → learnedWords state
Load review_words from DB → reviewWords state
    ↓
Recall Mode Started
    ↓
getValidCurrentWord() checks learnedWords
    ↓
User submits word
    ↓
If correct → addLearnedWord() + update state
If wrong → addReviewWord() + update state
    ↓
Tabs UI renders from learnedWords/reviewWords state
    ↓
Filter changes
    ↓
Only game position resets, learned/review persist
    ↓
Refresh page
    ↓
Auth listener fetches learned/review from DB again
    ↓
User sees their progress intact
```

### RLS Security

All policies enforce: `auth.uid() = user_id`

This means:
- Users can ONLY see their own learned words
- Users can ONLY see their own review words
- No cross-user data leakage
- Database-enforced security

### Notes

1. **JSONB storage**: `word_data` stores complete word metadata, so we don't need separate word lookups
2. **Unique constraint**: `learned_words` prevents duplicates (user can't learn same word twice)
3. **Failed count**: `review_words.failed_count` tracks how many times word failed (useful for retry algorithms)
4. **No immediate requeue**: Current implementation doesn't requeue words immediately. Full requeue logic (insert word back after N attempts) can be added in future phase.
5. **Session persistence**: Learned/review words persist across:
   - Filter changes ✓
   - Mode switches ✓
   - Page refreshes ✓
   - Browser closes/opens (via Supabase) ✓

### Troubleshooting

**Issue: "No words match filters" still appearing**
- Verify RLS policies are enabled on both tables
- Check learned_words table isn't too large
- Try logging in again to force refresh

**Issue: Learned words appearing again in pool**
- Check getValidCurrentWord() is being called
- Verify learnedWords state updated correctly
- Check console for errors during addLearnedWord()

**Issue: Tabs not showing saved progress**
- Clear browser localStorage
- Sign out / sign in again
- Verify auth.uid() in RLS policies works correctly

**Issue: Data not persisting across page refresh**
- Ensure SupabaseAuth is configured correctly
- Check session token isn't expiring
- Verify tables have correct RLS policies
