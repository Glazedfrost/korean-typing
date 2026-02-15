import { Word } from '@/data/words'
import { createClient, type Session } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============================================================================
// Auth Functions with Session Handling
// ============================================================================

export interface UserStats {
  id: string
  user_id: string
  total_score: number
  highest_streak: number
  total_words_completed: number
  accuracy: number
  current_level: number
  updated_at: string
}

// Helper: normalize a DB row (handles legacy/alternate column names)
function mapDbUserStats(row: any): UserStats | null {
  if (!row || !row.user_id) return null

  return {
    id: row.id,
    user_id: row.user_id,
    // support both new (`total_score`) and legacy (`score`) column names
    total_score: (row.total_score ?? row.score) as number ?? 0,
    highest_streak: (row.highest_streak ?? row.streak) as number ?? 0,
    // total_words_completed may be absent in older schemas
    total_words_completed: (row.total_words_completed ?? row.total_words ?? 0) as number,
    accuracy: (row.accuracy ?? row.acc ?? 0) as number,
    current_level: (row.current_level ?? row.level) as number ?? 1,
    updated_at: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  }
}

/**
 * Listen to auth state changes (login, logout, session refresh)
 * Returns unsubscribe function and current session
 */
export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data: authListener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session)
      console.log('[Supabase Auth] Session changed:', session?.user?.email || 'no user')
    }
  )

  return authListener?.subscription?.unsubscribe ?? (() => {})
}

/**
 * Get current session (does NOT make API call)
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

/**
 * Sign up with email/password
 * Note: User may need email verification depending on Supabase settings
 */
export async function signUp(email: string, password: string) {
  console.log('[Supabase Auth] Attempting signup for:', email)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    console.error('[Supabase Auth] Signup error:', error.message)
  } else {
    console.log('[Supabase Auth] Signup successful, user:', data.user?.id)
    // Create initial user_stats row
    if (data.user) {
      await createInitialUserStats(data.user.id)
    }
  }

  return { data, error }
}

/**
 * Sign in with email/password
 */
export async function signIn(email: string, password: string) {
  console.log('[Supabase Auth] Attempting signin for:', email)
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[Supabase Auth] Signin error:', error.message)
  } else {
    console.log('[Supabase Auth] Signin successful, user:', data.user?.id)
  }

  return { data, error }
}

/**
 * Sign out
 */
export async function signOut() {
  console.log('[Supabase Auth] Signing out')
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('[Supabase Auth] Signout error:', error.message)
  } else {
    console.log('[Supabase Auth] Signout successful')
  }

  return { error }
}

/**
 * Create initial user_stats row after signup
 * This ensures the user_id is in the table for future updates
 */
export async function createInitialUserStats(userId: string) {
  // Primary attempt: canonical column names
  let { error } = await supabase
    .from('user_stats')
    .insert({
      user_id: userId,
      total_score: 0,
      highest_streak: 0,
      total_words_completed: 0,
      accuracy: 0,
      current_level: 1,
      updated_at: new Date().toISOString(),
    })

  if (!error) {
    console.log('[Supabase DB] Initial user_stats row created for user:', userId)
    return { error: null }
  }

  const errMsg = (error.message ?? String(error)).toLowerCase()

  // Fallback: some deployments use legacy column names (score, streak, level)
  if (errMsg.includes('current_level') || errMsg.includes('total_score') || errMsg.includes('total_words_completed')) {
    console.warn('[Supabase DB] Falling back to legacy user_stats column names (score/streak/level)')

    const { error: legacyErr } = await supabase
      .from('user_stats')
      .insert({
        user_id: userId,
        score: 0,
        streak: 0,
        total_words_completed: 0,
        accuracy: 0,
        level: 1,
        updated_at: new Date().toISOString(),
      })

    if (!legacyErr) {
      console.log('[Supabase DB] Initial user_stats (legacy columns) created for user:', userId)
      return { error: null }
    }

    console.error('[Supabase DB] Legacy insert also failed:', legacyErr.message ?? legacyErr)
    return { error: legacyErr }
  }

  console.error('[Supabase DB] Error creating initial user_stats:', error.message ?? error)
  return { error }
} 

// ============================================================================
// User Stats Database Functions
// ============================================================================

/**
 * Fetch user's stats from the database
 * RLS policy ensures users can only fetch their own stats
 */
export async function fetchUserStats(userId: string) {
  console.log('[Supabase DB] Fetching stats for user:', userId)
  
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // If no stats exist yet, that's normal (first signup)
    if (error.code === 'PGRST116') {
      console.log('[Supabase DB] No stats found for user (first time), creating...')
      await createInitialUserStats(userId)
      return { data: null, error: null }
    }

    console.error('[Supabase DB] Error fetching user stats:', error.message)
    return { data: null, error }
  }

  // Normalize row (support legacy column names)
  const normalized = mapDbUserStats(data as any)
  console.log('[Supabase DB] Stats fetched successfully (normalized)')
  return { data: normalized, error: null }
} 

/**
 * Upsert (insert or update) user stats
 * Called after each word completion or level up to keep progress in sync
 * RLS policy ensures users can only update their own stats
 */
export async function upsertUserStats(userId: string, stats: Partial<UserStats>) {
  console.log('[Supabase DB] Upserting stats for user:', userId, stats)

  // Primary attempt (canonical columns)
  const payload = { user_id: userId, ...stats, updated_at: new Date().toISOString() }
  let { data, error } = await supabase
    .from('user_stats')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (!error) {
    console.log('[Supabase DB] Stats upserted successfully (canonical)')
    return { data: mapDbUserStats(data as any), error: null }
  }

  const errMsg = (error.message ?? String(error)).toLowerCase()
  // Log full error details + payload to make schema / permission failures obvious in logs
  console.error('[Supabase DB] Error upserting user stats:', errMsg, {
    code: (error as any)?.code,
    details: (error as any)?.details,
    hint: (error as any)?.hint,
    payload,
  })

  // If the error indicates missing canonical columns, try legacy column names
  if (errMsg.includes('current_level') || errMsg.includes('total_score') || errMsg.includes('total_words_completed')) {
    console.warn('[Supabase DB] Detected legacy schema for user_stats; attempting legacy upsert')

    const legacyPayload: any = {
      user_id: userId,
      score: stats.total_score ?? 0,
      streak: stats.highest_streak ?? 0,
      accuracy: stats.accuracy ?? 0,
      level: stats.current_level ?? 1,
      updated_at: new Date().toISOString(),
    }

    const { data: legacyData, error: legacyErr } = await supabase
      .from('user_stats')
      .upsert(legacyPayload, { onConflict: 'user_id' })
      .select()
      .single()

    if (!legacyErr) {
      console.log('[Supabase DB] Stats upserted successfully (legacy columns)')
      return { data: mapDbUserStats(legacyData as any), error: null }
    }

    console.error('[Supabase DB] Legacy upsert failed:', legacyErr.message ?? legacyErr)
    // fall through to other fallback logic
  }

  // Helpful guidance for missing table vs missing unique constraint
  if (errMsg.includes("could not find the table") || errMsg.includes('relation "user_stats" does not exist')) {
    console.error('[Supabase DB] The `user_stats` table appears to be missing. Run the setup SQL to create it.');
    return { data: null, error }
  }

  // Fallback: no UNIQUE index / ON CONFLICT not available — do select -> insert/update
  if (errMsg.includes('no unique or exclusion constraint') || errMsg.includes('on conflict')) {
    console.warn('[Supabase DB] Falling back to select/insert/update because ON CONFLICT is not available for `user_id`.')

    // Check whether a row already exists for this user
    const { data: existing, error: selectErr } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (selectErr) {
      // If no existing row, create one (try canonical then legacy)
      if (selectErr.code === 'PGRST116') {
        const { data: inserted, error: insertErr } = await supabase
          .from('user_stats')
          .insert(payload)
          .select()
          .single()

        if (!insertErr) {
          return { data: mapDbUserStats(inserted as any), error: null }
        }

        // Try legacy insert if canonical failed due to schema
        const insertErrMsg = (insertErr.message ?? String(insertErr)).toLowerCase()
        if (insertErrMsg.includes('current_level') || insertErrMsg.includes('total_score')) {
          const { data: legacyInserted, error: legacyInsertErr } = await supabase
            .from('user_stats')
            .insert({
              user_id: userId,
              score: stats.total_score ?? 0,
              streak: stats.highest_streak ?? 0,
              accuracy: stats.accuracy ?? 0,
              level: stats.current_level ?? 1,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (!legacyInsertErr) return { data: mapDbUserStats(legacyInserted as any), error: null }
          console.error('[Supabase DB] Error inserting (legacy) user_stats fallback:', legacyInsertErr.message ?? legacyInsertErr)
          return { data: null, error: legacyInsertErr }
        }

        console.error('[Supabase DB] Error inserting user_stats fallback:', insertErr.message ?? insertErr)
        return { data: null, error: insertErr }
      }

      console.error('[Supabase DB] Error checking existing user_stats row:', selectErr.message ?? selectErr)
      return { data: null, error: selectErr }
    }

    // Row exists — update it using canonical columns where possible
    const { data: updated, error: updateErr } = await supabase
      .from('user_stats')
      .update({ ...stats, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single()

    if (!updateErr) return { data: mapDbUserStats(updated as any), error: null }

    // Try legacy update if canonical update fails due to schema
    const updateErrMsg = (updateErr.message ?? String(updateErr)).toLowerCase()
    if (updateErrMsg.includes('current_level') || updateErrMsg.includes('total_score')) {
      const { data: legacyUpdated, error: legacyUpdateErr } = await supabase
        .from('user_stats')
        .update({
          score: stats.total_score ?? 0,
          streak: stats.highest_streak ?? 0,
          accuracy: stats.accuracy ?? 0,
          level: stats.current_level ?? 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (!legacyUpdateErr) return { data: mapDbUserStats(legacyUpdated as any), error: null }
      console.error('[Supabase DB] Error updating user_stats fallback (legacy):', legacyUpdateErr.message ?? legacyUpdateErr)
      return { data: null, error: legacyUpdateErr }
    }

    console.error('[Supabase DB] Error updating user_stats fallback:', updateErr.message ?? updateErr)
    return { data: null, error: updateErr }
  }

  // Other errors — return as-is
  return { data: null, error }
} 

// ============================================================================
// Learned & Review Words Tracking (Recall Mode)
// ============================================================================

export interface LearnedWord {
  id: string
  user_id: string
  word_id: string
  word_data: Word // Store full word metadata
  learned_at: string
}

export interface ReviewWord {
  id: string
  user_id: string
  word_id: string
  word_data: Word // Store full word metadata
  failed_count: number
  created_at: string
}

/**
 * Fetch all learned words for the user
 */
export async function fetchLearnedWords(userId: string) {
  console.log('[Supabase DB] Fetching learned words for user:', userId)

  // Primary: order by learned_at (preferred)
  let res = await supabase
    .from('learned_words')
    .select('*')
    .eq('user_id', userId)
    .order('learned_at', { ascending: false })

  if (res.error) {
    const msg = (res.error.message ?? String(res.error)).toLowerCase()
    // Fallback: some schemas use `created_at` instead of `learned_at`
    if (msg.includes('learned_at') || msg.includes("could not find the 'learned_at'")) {
      console.warn('[Supabase DB] learned_at missing; retrying fetchLearnedWords ordering by created_at')
      res = await supabase
        .from('learned_words')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    }
  }

  if (res.error) {
    console.error('[Supabase DB] Error fetching learned words:', res.error.message)
    return { data: [], error: res.error }
  }

  console.log('[Supabase DB] Learned words fetched:', res.data?.length)
  return { data: (res.data as LearnedWord[]) || [], error: null }
} 

/**
 * Fetch all review words (failed) for the user
 */
export async function fetchReviewWords(userId: string) {
  console.log('[Supabase DB] Fetching review words for user:', userId)
  
  const { data, error } = await supabase
    .from('review_words')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Supabase DB] Error fetching review words:', error.message)
    return { data: [], error }
  }

  const rows = (data as ReviewWord[]) || []

  // Deduplicate by word_id (defensive: server may have duplicate rows)
  const deduped = new Map<string, ReviewWord>()
  for (const r of rows) {
    if (!deduped.has(r.word_id)) {
      deduped.set(r.word_id, r)
    } else {
      console.warn('[Supabase DB] Duplicate review_words row detected for', userId, r.word_id)
    }
  }

  const result = Array.from(deduped.values())
  console.log('[Supabase DB] Review words fetched (deduped):', result.length)
  return { data: result, error: null }
}

/**
 * Add a word to learned words list
 */
export async function addLearnedWord(userId: string, word: Word) {
  console.log('[Supabase DB] Adding learned word:', word.korean)

  // Try canonical payload first (learned_at)
  let { data, error } = await supabase
    .from('learned_words')
    .upsert({
      user_id: userId,
      word_id: word.id,
      word_data: word,
      learned_at: new Date().toISOString(),
    }, { onConflict: 'user_id,word_id' })
    .select()
    .single()

  // If learned_at column is missing, retry using created_at (legacy schema)
  if (error) {
    const msg = (error.message ?? String(error)).toLowerCase()
    if (msg.includes('learned_at') || msg.includes("could not find the 'learned_at'")) {
      console.warn('[Supabase DB] learned_at missing; retrying addLearnedWord with created_at')
      const retry = await supabase
        .from('learned_words')
        .upsert({
          user_id: userId,
          word_id: word.id,
          word_data: word,
          created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,word_id' })
        .select()
        .single()

      data = retry.data
      error = retry.error
    }
  }

  if (error) {
    console.error('[Supabase DB] Error adding learned word:', error.message ?? error)
  } else {
    console.log('[Supabase DB] Learned word added successfully')
  }

  return { data, error }
} 

/**
 * Add a word to review words list (or increment if already exists)
 */
export async function addReviewWord(userId: string, word: Word) {
  console.log('[Supabase DB] Adding review word:', word.korean)
  
  // First check if word already exists
  // Query all rows matching (user_id, word_id) defensively (server may have duplicates)
  const { data: rows, error: fetchError } = await supabase
    .from('review_words')
    .select('id, failed_count, word_id')
    .eq('user_id', userId)
    .eq('word_id', word.id)

  if (fetchError) {
    console.error('[Supabase DB] Error checking existing review word:', fetchError.message)
    return { error: fetchError }
  }

  const matched = (rows as any[]) || []

  if (matched.length > 1) {
    // Server-side duplicates detected — coalesce into one row (sum failed_count)
    const totalFails = matched.reduce((s, r) => s + (r.failed_count || 0), 0)
    const keeper = matched[0]

    // Update keeper with aggregated failed_count
    const { error: updErr } = await supabase
      .from('review_words')
      .update({ failed_count: totalFails, updated_at: new Date().toISOString() })
      .eq('id', keeper.id)

    if (updErr) {
      console.error('[Supabase DB] Error consolidating duplicate review rows:', updErr.message)
      // continue — we'll still try to insert/update normally
    }

    // Delete the duplicate rows (keep the keeper)
    const duplicateIds = matched.slice(1).map((r) => r.id)
    const { error: delErr } = await supabase
      .from('review_words')
      .delete()
      .in('id', duplicateIds)

    if (delErr) {
      console.error('[Supabase DB] Error deleting duplicate review rows:', delErr.message)
    }

    // Reload the keeper row to use below
    const { data: reloaded } = await supabase
      .from('review_words')
      .select('id, failed_count')
      .eq('id', keeper.id)
      .single()

    if (reloaded) {
      matched.length = 1
      matched[0] = reloaded
    }
  }

  const existing = matched[0] ?? null

  if (existing) {
    // Update fail count
    const { data, error } = await supabase
      .from('review_words')
      .update({ failed_count: existing.failed_count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('[Supabase DB] Error updating review word:', error.message)
      return { data: null, error }
    }

    return { data, error: null }
  }

  // Insert new (use upsert to avoid duplicate-key race conditions)
  const { data, error } = await supabase
    .from('review_words')
    .upsert({
      user_id: userId,
      word_id: word.id,
      word_data: word,
      failed_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,word_id' })
    .select()
    .single()

  if (error) {
    console.error('[Supabase DB] Error adding review word:', error.message)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Remove a word from learned words
 */
export async function removeLearnedWord(userId: string, wordId: string) {
  console.log('[Supabase DB] Removing learned word:', wordId)
  
  const { error } = await supabase
    .from('learned_words')
    .delete()
    .eq('user_id', userId)
    .eq('word_id', wordId)

  if (error) {
    console.error('[Supabase DB] Error removing learned word:', error.message)
  }

  return { error }
}

/**
 * Remove a word from review words
 */
export async function removeReviewWord(userId: string, wordId: string) {
  console.log('[Supabase DB] Removing review word:', wordId)
  
  const { error } = await supabase
    .from('review_words')
    .delete()
    .eq('user_id', userId)
    .eq('word_id', wordId)

  if (error) {
    console.error('[Supabase DB] Error removing review word:', error.message)
  }

  return { error }
}
