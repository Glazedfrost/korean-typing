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
  const { error } = await supabase
    .from('user_stats')
    .insert({
      user_id: userId,
      total_score: 0,
      highest_streak: 0,
      total_words_completed: 0,
      accuracy: 0,
      current_level: 1,
    })

  if (error) {
    console.error('[Supabase DB] Error creating initial user_stats:', error.message)
  } else {
    console.log('[Supabase DB] Initial user_stats row created for user:', userId)
  }

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

  console.log('[Supabase DB] Stats fetched successfully')
  return { data: data as UserStats, error: null }
}

/**
 * Upsert (insert or update) user stats
 * Called after each word completion or level up to keep progress in sync
 * RLS policy ensures users can only update their own stats
 */
export async function upsertUserStats(userId: string, stats: Partial<UserStats>) {
  console.log('[Supabase DB] Upserting stats for user:', userId, stats)
  
  const { data, error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: userId,
      ...stats,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    // Provide actionable guidance when the table is missing
    console.error('[Supabase DB] Error upserting user stats:', error.message)
    if (error.message && error.message.includes('Could not find the table')) {
      console.error('[Supabase DB] It seems the `user_stats` table does not exist or RLS/schema is misconfigured. Please run the setup SQL to create the table and policies.');
    }
  } else {
    console.log('[Supabase DB] Stats upserted successfully')
  }

  return { data: data as UserStats | null, error }
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
  
  const { data, error } = await supabase
    .from('learned_words')
    .select('*')
    .eq('user_id', userId)
    .order('learned_at', { ascending: false })

  if (error) {
    console.error('[Supabase DB] Error fetching learned words:', error.message)
    return { data: [], error }
  }

  console.log('[Supabase DB] Learned words fetched:', data?.length)
  return { data: (data as LearnedWord[]) || [], error: null }
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

  console.log('[Supabase DB] Review words fetched:', data?.length)
  return { data: (data as ReviewWord[]) || [], error: null }
}

/**
 * Add a word to learned words list
 */
export async function addLearnedWord(userId: string, word: Word) {
  console.log('[Supabase DB] Adding learned word:', word.korean)
  // Use upsert to avoid duplicate-key errors when the same word is learned twice
  const { data, error } = await supabase
    .from('learned_words')
    .upsert({
      user_id: userId,
      word_id: word.id,
      word_data: word,
      learned_at: new Date().toISOString(),
    }, { onConflict: 'user_id,word_id' })
    .select()
    .single()

  if (error) {
    console.error('[Supabase DB] Error adding learned word:', error.message)
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
  const { data: existing, error: fetchError } = await supabase
    .from('review_words')
    .select('id, failed_count')
    .eq('user_id', userId)
    .eq('word_id', word.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[Supabase DB] Error checking existing review word:', fetchError.message)
    return { error: fetchError }
  }

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
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('review_words')
      .insert({
        user_id: userId,
        word_id: word.id,
        word_data: word,
        failed_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[Supabase DB] Error adding review word:', error.message)
      return { data: null, error }
    }

    return { data, error: null }
  }
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
