## SUPABASE INTEGRATION SETUP GUIDE

This guide will help you apply the RLS policies and verify authentication is working.

---

## 1. CREATE TABLE (if not already created)

Go to your Supabase dashboard SQL editor and run:

```sql
CREATE TABLE user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  highest_streak INTEGER DEFAULT 0,
  total_words_completed INTEGER DEFAULT 0,
  accuracy FLOAT DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
```

---

## 2. ENABLE ROW LEVEL SECURITY (RLS)

1. Go to Supabase dashboard > Authentication > Policies
2. Select `user_stats` table from the dropdown
3. Toggle ON: "Enable row level security"
4. This prevents unauthorized access to the table

---

## 3. APPLY RLS POLICIES

Copy the entire contents of `RLS_POLICIES.sql` and paste into Supabase SQL editor, then run.

This creates 4 policies:
- **SELECT**: Users can only read their own stats
- **INSERT**: Users can only insert their own stats  
- **UPDATE**: Users can only update their own stats
- **DELETE**: Users can only delete their own stats

All policies use `auth.uid() = user_id` to ensure user isolation.

---

## 4. ENVIRONMENT VARIABLES

Make sure your `.env.local` has:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these from: Supabase dashboard > Project Settings > API

---

## 5. TEST THE INTEGRATION

1. `npm run dev`
2. In the app, click "Sign In / Sign Up"
3. **Sign Up** with email & password
   - ✓ Auth listener will trigger
   - ✓ Initial `user_stats` row auto-created
   - ✓ Form clears and auth section shows logged-in email
4. Play the typing game
   - ✓ After 5-10 words, progress auto-saves (1-second debounce)
   - Check browser console for `[Supabase DB] Upserting stats for user...` logs
5. Refresh page
   - ✓ Session persists (you stay logged in)
   - ✓ Previous stats load automatically
6. Click "Logout"
   - ✓ Session clears
   - ✓ Game state resets
7. Sign back in with same email
   - ✓ Previous stats load again

---

## 6. DEBUGGING

Check browser console (F12) for logs:

- `[Supabase Auth] Attempting signup for: ...` - Auth request started
- `[Supabase Auth] Signup successful, user: ...` - User created
- `[Supabase DB] Initial user_stats row created for user: ...` - DB row created
- `[Supabase DB] Upserting stats for user...` - Auto-save triggered
- `[TypingGame] Auth state changed, session: ...` - Session restored

If you see errors like:
- `"new row violates row-level security policy"` → Check RLS policies were applied
- `"permission denied for schema public"` → RLS not enabled or policies incorrect
- `"no rows affected"` → User_id mismatch or row doesn't exist yet

---

## 7. TROUBLESHOOTING

### Issue: "new row violates row-level security policy" on signup

**Fix**: Ensure INSERT policy is applied with correct SQL:
```sql
CREATE POLICY "Users can insert their own stats"
ON user_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Issue: Can't log back in after logout

**Fix**: Both signin and logout should work now with the persistent session listener.
Check console for auth errors.

### Issue: Stats not saving

**Fix**: 
1. Ensure user is authenticated (check `[TypingGame] Auto-saving progress to Supabase:` in console)
2. Check upsert error: `[Supabase DB] Error upserting user stats:`
3. Verify RLS policies allow UPDATE: 
```sql
CREATE POLICY "Users can update their own stats"
ON user_stats
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Issue: Stats not loading on page refresh

**Fix**: Now uses `onAuthStateChange` listener which persists sessions.
Check console for: `[TypingGame] Setting up auth listener`

---

## 8. KEY CHANGES IN CODE

### `lib/supabase.ts`:
- ✓ `onAuthStateChange()` - Listens to auth state changes
- ✓ `createInitialUserStats()` - Auto-creates db row after signup
- ✓ Console logs for debugging each operation

### `app/TypingGame.tsx`:
- ✓ Auth listener in useEffect - Handles session persistence
- ✓ Updated `handleSignUp/SignIn/Logout` - Proper error handling
- ✓ Auto-save with debounce - Prevents excessive DB requests

---

## 9. ARCHITECTURE

```
User Signs Up
    ↓
signUp() called
    ↓
Auth state changes
    ↓
onAuthStateChange listener triggers
    ↓
fetchUserStats() called → finds nothing
    ↓
createInitialUserStats() called
    ↓
user_stats row created (INSERT policy needed)
    ↓
Game loads, user plays
    ↓
Score/streak/accuracy changes
    ↓
upsertUserStats() called (UPDATE policy needed)
    ↓
Stats saved to DB (debounced 1sec)
    ↓
User refreshes page
    ↓
onAuthStateChange listener still has session
    ↓
fetchUserStats() called (SELECT policy needed)
    ↓
Previous stats loaded
    ↓
Game continues with history intact
```

All policies use `auth.uid() = user_id` to ensure only the logged-in user can access their data.

---

## NEXT STEPS

1. Apply RLS policies from `RLS_POLICIES.sql`
2. Verify table exists with correct columns
3. Test signup → verify initial row creation
4. Test save → verify upsert
5. Test refresh → verify persistence
6. Test logout + signin → verify it works

You're ready to go!
