"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { allWords, type Word } from "../data/words";
import { 
  onAuthStateChange,
  signIn, 
  signOut, 
  signUp, 
  fetchUserStats, 
  upsertUserStats,
  fetchLearnedWords,
  fetchReviewWords,
  addLearnedWord,
  addReviewWord,
  type UserStats 
} from "../lib/supabase";

// Game modes:
// - "copy": show the Korean word and ask the user to copy it
// - "recall": hide the Korean word, user recalls it from the definition
type GameMode = "copy" | "recall";

// Filters for the extended vocabulary dataset.
type ComplexityFilter = "all" | "A" | "B" | "C" | "D" | "E";
type FrequencyBandId =
  | "all"
  | "1-500"
  | "501-1000"
  | "1001-1500"
  | "1501-2000"
  | "2001-3000"
  | "3001-4000"
  | "4001-5000"
  | "5001-6000";
type ClassificationFilter =
  | "all"
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "auxiliary verb"
  | "pronoun"
  | "interjection";

// Small delay before automatically moving to the next word
const NEXT_WORD_DELAY_MS = 500;

const FREQUENCY_BANDS: {
  id: FrequencyBandId;
  label: string;
  min: number;
  max: number;
}[] = [
  {
    id: "all",
    label: "All frequencies",
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  },
  { id: "1-500", label: "1–500 (most frequent)", min: 1, max: 500 },
  { id: "501-1000", label: "501–1000", min: 501, max: 1000 },
  { id: "1001-1500", label: "1001–1500", min: 1001, max: 1500 },
  { id: "1501-2000", label: "1501–2000", min: 1501, max: 2000 },
  { id: "2001-3000", label: "2001–3000", min: 2001, max: 3000 },
  { id: "3001-4000", label: "3001–4000", min: 3001, max: 4000 },
  { id: "4001-5000", label: "4001–5000", min: 4001, max: 5000 },
  { id: "5001-6000", label: "5001–6000", min: 5001, max: 6000 },
];

const COMPLEXITY_SEQUENCE: ComplexityFilter[] = ["A", "B", "C", "D", "E"];
const FREQUENCY_SEQUENCE: FrequencyBandId[] = [
  "1-500",
  "501-1000",
  "1001-1500",
  "1501-2000",
  "2001-3000",
  "3001-4000",
  "4001-5000",
  "5001-6000",
];

// Helpers to avoid counting IME composition steps (like typing ㄱ on the way to 것)
// as errors. We treat Hangul Jamo characters as "in progress" when the target
// is a full Hangul syllable.
const isHangulSyllable = (ch: string): boolean =>
  ch >= "\uAC00" && ch <= "\uD7AF";

const isHangulJamo = (ch: string): boolean =>
  (ch >= "\u3130" && ch <= "\u318F") || (ch >= "\u1100" && ch <= "\u11FF");

// Presentational component that renders the Korean word with
// per-letter highlighting and current-letter underline.
function KoreanWordDisplay({
  word,
  typed,
  mode,
}: {
  word: string;
  typed: string;
  mode: GameMode;
}) {
  const chars = word.split("");

  return (
    <div className="flex justify-center gap-1 text-3xl md:text-4xl font-semibold tracking-wide">
      {chars.map((char, idx) => {
        const typedChar = typed[idx];
        const isCurrent = idx === typed.length && typed.length < chars.length;
        const isCorrect = typedChar !== undefined && typedChar === char;
        const isIncorrect = typedChar !== undefined && typedChar !== char;

        // In copy mode we always show the correct Korean character so the
        // user can visually copy it. In recall mode we only show what the
        // user actually typed so we don't accidentally reveal the answer.
        let showChar: string;
        if (mode === "copy") {
          showChar = char;
        } else if (idx < typed.length && typedChar !== undefined) {
          showChar = typedChar;
        } else {
          showChar = "•";
        }

        return (
          <span
            key={idx}
            className={[
              "px-1 transition-colors duration-150",
              isCorrect ? "text-green-500" : "",
              isIncorrect ? "text-red-500" : "",
              isCurrent ? "underline decoration-2 decoration-sky-400" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {showChar}
          </span>
        );
      })}
    </div>
  );
}

// Main typing game component. Manages the current word, input,
// error count, and game mode. Integrates with Supabase for user progress tracking.
// Recall Mode Features: Learned/Failed words tracking, smart word pool management.
export default function TypingGame() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [errors, setErrors] = useState(0);
  const [mode, setMode] = useState<GameMode>("copy");
  const [justCompleted, setJustCompleted] = useState(false);
  const [complexityFilter, setComplexityFilter] =
    useState<ComplexityFilter>("A");
  const [frequencyBandId, setFrequencyBandId] =
    useState<FrequencyBandId>("1-500");
  const [classificationFilter, setClassificationFilter] =
    useState<ClassificationFilter>("all");

  // Accuracy and scoring state
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [madeMistakeOnCurrentWord, setMadeMistakeOnCurrentWord] =
    useState(false);
  const [maxLevelUnlocked, setMaxLevelUnlocked] = useState(1);

  // ============================================================================
  // Recall Mode: Learned/Failed Words Tracking (Persisted in Supabase)
  // ============================================================================
  const [learnedWords, setLearnedWords] = useState<Word[]>([]);
  const [reviewWords, setReviewWords] = useState<Word[]>([]);
  const [failedWordsRequeueCount, setFailedWordsRequeueCount] = useState<
    Map<string, number>
  >(new Map());
  const [showTabsUI, setShowTabsUI] = useState(false);
  const [activeTab, setActiveTab] = useState<"learned" | "to-review">("learned");

  // ============================================================================
  // Supabase Auth State
  // ============================================================================
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Keep a ref to the timeout so we can clear it on unmount
  const nextWordTimeoutRef = useRef<number | null>(null);
  // Track if we need to save progress (prevents too many saves)
  const saveTimeoutRef = useRef<number | null>(null);

  // Build the word list from the extended dataset and the current filters.
  // NOTE: In Recall Mode, we do NOT exclude learned words from this list.
  // Instead, we manage which words to show via a separate mechanism.
  const wordList: Word[] = useMemo(() => {
    const band = FREQUENCY_BANDS.find((b) => b.id === frequencyBandId);

    const filtered = allWords.filter((w) => {
      // Complexity filter
      if (
        complexityFilter !== "all" &&
        w.complexity &&
        w.complexity !== complexityFilter
      ) {
        return false;
      }

      // Frequency filter
      if (band && band.id !== "all" && typeof w.frequency === "number") {
        if (w.frequency < band.min || w.frequency > band.max) {
          return false;
        }
      }

      // Classification filter
      if (
        classificationFilter !== "all" &&
        w.classification !== classificationFilter
      ) {
        return false;
      }

      return true;
    });

    console.log(
      `[WordList] Filters: complexity=${complexityFilter}, frequency=${frequencyBandId}, class=${classificationFilter} => ${filtered.length} words`
    );

    return filtered;
  }, [complexityFilter, frequencyBandId, classificationFilter]);

  // Get next valid word (skip learned words in Recall Mode)
  const getValidCurrentWord = (): Word | undefined => {
    if (wordList.length === 0) {
      console.warn('[Game] No words available in current filter set');
      return undefined;
    }

    // Ensure currentIndex is within bounds
    const safeIndex = currentIndex < wordList.length ? currentIndex : currentIndex % wordList.length;

    const learnedIds = new Set(learnedWords.map((w) => w.id));
    let idx = safeIndex;
    let attempts = 0;
    const maxAttempts = wordList.length;

    console.log(
      `[GetValidWord] currentIndex=${currentIndex}, safeIndex=${safeIndex}, learned=${learnedWords.length}, pool=${wordList.length}`
    );

    while (attempts < maxAttempts) {
      const word = wordList[idx % wordList.length];
      if (mode === "copy" || !learnedIds.has(word.id)) {
        console.log(`[GetValidWord] Found valid word: ${word.korean} at index ${idx % wordList.length}`);
        return word;
      }
      idx++;
      attempts++;
    }

    console.warn('[GetValidWord] No valid words found after checking entire pool');
    return undefined;
  };

  const currentWord: Word | undefined = getValidCurrentWord();

  // Derive current "level" from complexity * frequency band, e.g.
  // Level 1: A + 1–500, Level 2: A + 501–1000, etc.
  const currentLevel: number | null = useMemo(() => {
    if (
      complexityFilter === "all" ||
      frequencyBandId === "all" ||
      wordList.length === 0
    ) {
      return null;
    }

    const cIndex = COMPLEXITY_SEQUENCE.indexOf(complexityFilter);
    const fIndex = FREQUENCY_SEQUENCE.indexOf(frequencyBandId);

    if (cIndex === -1 || fIndex === -1) return null;

    return cIndex * FREQUENCY_SEQUENCE.length + fIndex + 1;
  }, [complexityFilter, frequencyBandId, wordList.length]);

  // Clean up any pending timeout when the component unmounts
  useEffect(() => {
    console.log(`[TypingGame] Component mounted, allWords loaded: ${allWords.length} words`);
    return () => {
      if (nextWordTimeoutRef.current !== null) {
        window.clearTimeout(nextWordTimeoutRef.current);
      }
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // Load current user and their progress on mount + Fetch learned/review words
  // ============================================================================
  useEffect(() => {
    console.log('[TypingGame] Setting up auth listener');
    
    // Listen to auth state changes (handles login, logout, session persist)
    const unsubscribe = onAuthStateChange(async (session) => {
      console.log('[TypingGame] Auth state changed, session:', session?.user?.email || 'no user');
      
      if (session?.user) {
        setUser(session.user);

        // Fetch user's saved stats
        const { data: userStats, error: statsError } = await fetchUserStats(
          session.user.id
        );

        if (!statsError && userStats) {
          // Load saved progress
          console.log('[TypingGame] Loading user stats:', userStats);
          setScore(userStats.total_score);
          setMaxStreak(userStats.highest_streak);
          setMaxLevelUnlocked(userStats.current_level);
          
          // Recalculate accuracy from saved values
          if (userStats.total_words_completed > 0) {
            const calculatedCorrect = Math.round(
              (userStats.accuracy / 100) * userStats.total_words_completed
            );
            setCorrectAnswers(calculatedCorrect);
            setTotalAttempts(userStats.total_words_completed);
          }
        }

        // Fetch learned words from Supabase
        const { data: learnedData } = await fetchLearnedWords(session.user.id);
        if (learnedData && learnedData.length > 0) {
          setLearnedWords(learnedData.map((lw) => lw.word_data));
          console.log('[TypingGame] Loaded learned words:', learnedData.length);
        }

        // Fetch review words (failed) from Supabase
        const { data: reviewData } = await fetchReviewWords(session.user.id);
        if (reviewData && reviewData.length > 0) {
          setReviewWords(reviewData.map((rw) => rw.word_data));
          console.log('[TypingGame] Loaded review words:', reviewData.length);
        }
      } else {
        console.log('[TypingGame] No user session, clearing state');
        setUser(null);
      }

      setIsAuthLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // ============================================================================
  // Auth handlers
  // ============================================================================
  const handleSignUp = async () => {
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Email and password required");
      return;
    }

    setIsSubmittingAuth(true);
    const { data, error } = await signUp(authEmail, authPassword);
    setIsSubmittingAuth(false);

    if (error) {
      console.error('[TypingGame] Signup error:', error);
      setAuthError(error.message);
    } else {
      console.log('[TypingGame] Signup successful');
      // Clear form
      setAuthEmail("");
      setAuthPassword("");
      setShowAuthForm(false);
      // Auth listener will handle setting user state
    }
  };

  const handleSignIn = async () => {
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Email and password required");
      return;
    }

    setIsSubmittingAuth(true);
    const { data, error } = await signIn(authEmail, authPassword);
    setIsSubmittingAuth(false);

    if (error) {
      console.error('[TypingGame] Signin error:', error);
      setAuthError(error.message);
    } else {
      console.log('[TypingGame] Signin successful');
      // Clear form
      setAuthEmail("");
      setAuthPassword("");
      setShowAuthForm(false);
      // Auth listener will handle setting user state and loading stats
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('[TypingGame] Logout error:', error);
    } else {
      console.log('[TypingGame] Logout successful');
      // Auth listener will handle clearing user state
      setShowAuthForm(false);
      // Reset game state
      setCurrentIndex(0);
      setInput("");
      setErrors(0);
      setTotalAttempts(0);
      setCorrectAnswers(0);
      setCurrentStreak(0);
      setMaxStreak(0);
      setScore(0);
      setMaxLevelUnlocked(1);
    }
  };

  // ============================================================================
  // Save progress to Supabase (called after each word submission)
  // ============================================================================
  const saveProgressToSupabase = async () => {
    if (!user) {
      console.log('[TypingGame] No user logged in, skipping save');
      return;
    }

    // Debounce saves to avoid too many requests
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      const accuracy = totalAttempts === 0 ? 0 : Math.round((correctAnswers / totalAttempts) * 100);

      console.log('[TypingGame] Auto-saving progress to Supabase:', {
        user_id: user.id,
        total_score: score,
        highest_streak: maxStreak,
        total_words_completed: totalAttempts,
        accuracy: accuracy,
        current_level: currentLevel ?? maxLevelUnlocked,
      });

      const { error } = await upsertUserStats(user.id, {
        total_score: score,
        highest_streak: maxStreak,
        total_words_completed: totalAttempts,
        accuracy: accuracy,
        current_level: currentLevel ?? maxLevelUnlocked,
      });

      if (error) {
        console.error('[TypingGame] Error saving progress:', error?.message ?? error);
      } else {
        console.log('[TypingGame] Progress saved successfully');
      }

      saveTimeoutRef.current = null;
    }, 1000); // Wait 1 second before saving to batch updates
  };

  // Auto-save progress whenever score, streak, or attempts change
  useEffect(() => {
    saveProgressToSupabase();
  }, [score, maxStreak, totalAttempts, correctAnswers, user]);

  // When filters change, reset game position but preserve learned/review words
  // (they should persist from Supabase, not reset)
  useEffect(() => {
    if (nextWordTimeoutRef.current !== null) {
      window.clearTimeout(nextWordTimeoutRef.current);
      nextWordTimeoutRef.current = null;
    }
    setCurrentIndex(0);
    setInput("");
    setErrors(0);
    setMadeMistakeOnCurrentWord(false);
    setJustCompleted(false);
    // NOTE: Do NOT reset learnedWords or reviewWords - they persist from Supabase
  }, [complexityFilter, frequencyBandId, classificationFilter]);

  // Switch between Copy and Recall modes
  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    setInput("");
    setJustCompleted(false);
    // NOTE: Do NOT reset learned/review words when switching modes
  };

  // Handle typing in the input box.
  // In Copy Mode: count errors during typing
  // In Recall Mode: do NOT count errors during typing (only on Enter submission)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentWord) return;

    const target = currentWord.korean;
    const previous = input;
    let next = e.target.value;

    // Prevent typing beyond the length of the target word
    if (next.length > target.length) {
      next = next.slice(0, target.length);
    }

    // ============================================================================
    // In Copy Mode: Count errors during typing for live feedback
    // In Recall Mode: Errors are only counted on Enter submission (see handleSubmitCurrentWord)
    // ============================================================================
    if (mode === "copy" && next.length > previous.length) {
      const added = next.slice(previous.length);
      const startIndex = previous.length;

      let newErrors = 0;
      for (let i = 0; i < added.length; i += 1) {
        const idx = startIndex + i;
        const targetChar = target[idx];
        const typedChar = added[i];

        if (targetChar !== typedChar) {
          // If the target is a Hangul syllable and the typed character is a
          // Hangul Jamo, treat this as part of IME composition and DO NOT
          // count it as an error yet (e.g. typing ㄱ on the way to 것).
          if (
            !(isHangulSyllable(targetChar) && isHangulJamo(typedChar))
          ) {
            newErrors += 1;
          }
        }
      }

      if (newErrors > 0) {
        setErrors((prevErrors) => prevErrors + newErrors);
        setMadeMistakeOnCurrentWord(true);
      }
    }

    setInput(next);
    setJustCompleted(false);
  };

  const progressLabel =
    wordList.length > 0 ? `${currentIndex + 1} / ${wordList.length}` : "0 / 0";

  const accuracy =
    totalAttempts === 0
      ? 0
      : Math.round((correctAnswers / totalAttempts) * 100);

  // ============================================================================
  // Submit handler triggered explicitly (e.g. Enter key).
  // Validates the current word, updates accuracy / score / streak, and advances to next word.
  // In Recall Mode: saves learned/failed words to Supabase.
  // ============================================================================
  const handleSubmitCurrentWord = () => {
    if (!currentWord || input.length === 0) return;

    const target = currentWord.korean;
    const isCorrect = input === target && !madeMistakeOnCurrentWord;

    setTotalAttempts((prev) => prev + 1);

    // ============================================================================
    // Recall Mode: Track learned/failed words and save to Supabase
    // ============================================================================
    if (mode === "recall" && user) {
      if (isCorrect) {
        // Correct: Add to learned list (Supabase + local state)
        setLearnedWords((prev) => {
          if (!prev.find((w) => w.id === currentWord.id)) {
            const updated = [...prev, currentWord];
            addLearnedWord(user.id, currentWord).catch((err) =>
              console.error('[TypingGame] Error saving learned word:', err)
            );
            return updated;
          }
          return prev;
        });
      } else {
        // Wrong: Add to review list (Supabase + local state)
        setReviewWords((prev) => {
          if (!prev.find((w) => w.id === currentWord.id)) {
            const updated = [...prev, currentWord];
            addReviewWord(user.id, currentWord).catch((err) =>
              console.error('[TypingGame] Error saving review word:', err)
            );
            return updated;
          }
          return prev;
        });
        setErrors(1); // In Recall Mode, count errors only on submission
      }
    }

    // ============================================================================
    // Standard game mechanics (same for both modes)
    // ============================================================================
    if (isCorrect) {
      // Perfect attempt
      setCorrectAnswers((prev) => prev + 1);
      setCurrentStreak((prevStreak) => {
        const nextStreak = prevStreak + 1;
        setMaxStreak((prevMax) => Math.max(prevMax, nextStreak));

        // Score with multiplier based on streak
        const BASE_SCORE = 10;
        const getMultiplier = (streak: number): number => {
          if (streak >= 20) return 5;
          if (streak >= 10) return 3;
          if (streak >= 5) return 2;
          return 1;
        };

        const multiplier = getMultiplier(nextStreak);
        setScore((prevScore) => prevScore + BASE_SCORE * multiplier);

        // Unlock next level if this one is higher than any seen before
        if (currentLevel && currentLevel > maxLevelUnlocked) {
          setMaxLevelUnlocked(currentLevel);
        }

        return nextStreak;
      });
    } else {
      // Incorrect attempt resets streak
      setCurrentStreak(0);
    }

    setJustCompleted(isCorrect);

    // Clear input immediately so the field is ready for the next word.
    setInput("");
    if (mode === "copy") {
      setErrors(0);
    }
    setMadeMistakeOnCurrentWord(false);

    // Advance to the next word, safely wrapping if needed
    console.log(`[Submit] Advancing from index ${currentIndex}, wordList length=${wordList.length}`);
    setCurrentIndex((prevIndex) => {
      if (wordList.length === 0) {
        console.warn('[Submit] wordList is empty, keeping index at 0');
        return 0;
      }
      const nextIndex = prevIndex + 1 >= wordList.length ? 0 : prevIndex + 1;
      console.log(`[Submit] New index: ${nextIndex}`);
      return nextIndex;
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
        {/* Auth Section */}
        {isAuthLoading ? (
          <div className="mb-6 text-center text-sm text-slate-400">
            Loading...
          </div>
        ) : !user ? (
          <div className="mb-6 border-b border-slate-700 pb-6">
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowAuthForm(!showAuthForm)}
                className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 transition"
              >
                {showAuthForm ? "Cancel" : "Sign In / Sign Up"}
              </button>
            </div>

            {showAuthForm && (
              <div className="space-y-3">
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/60"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/60"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      handleSignIn();
                    }}
                    disabled={isSubmittingAuth}
                    className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition"
                  >
                    {isSubmittingAuth ? "..." : "Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      handleSignUp();
                    }}
                    disabled={isSubmittingAuth}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition"
                  >
                    {isSubmittingAuth ? "..." : "Sign Up"}
                  </button>
                </div>

                {authError && (
                  <div className="text-xs text-red-400">{authError}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="text-sm text-slate-300">
              <span className="text-slate-400">Logged in:</span>{" "}
              {user.email}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600 transition"
            >
              Logout
            </button>
          </div>
        )}

        {/* Header with title, filters, progress and error counter */}
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Korean Typing Trainer
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <label className="flex items-center gap-1">
                <span className="text-slate-400">Complexity</span>
                <select
                  value={complexityFilter}
                  onChange={(e) =>
                    setComplexityFilter(e.target.value as ComplexityFilter)
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="all">All</option>
                  <option value="A">A (easiest)</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E (hardest)</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-slate-400">Frequency</span>
                <select
                  value={frequencyBandId}
                  onChange={(e) =>
                    setFrequencyBandId(e.target.value as FrequencyBandId)
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                >
                  {FREQUENCY_BANDS.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-slate-400">Class</span>
                <select
                  value={classificationFilter}
                  onChange={(e) =>
                    setClassificationFilter(
                      e.target.value as ClassificationFilter
                    )
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="all">All</option>
                  <option value="noun">Noun</option>
                  <option value="verb">Verb</option>
                  <option value="adjective">Adjective</option>
                  <option value="adverb">Adverb</option>
                  <option value="auxiliary verb">Auxiliary verb</option>
                  <option value="pronoun">Pronoun</option>
                  <option value="interjection">Interjection</option>
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
            <div className="flex gap-2">
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                {progressLabel}
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                Errors: {errors}
              </span>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px]">
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                Acc: {accuracy}%
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                Streak: {currentStreak} (max {maxStreak})
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                Score: {score}
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                Level: {currentLevel ?? "-"}
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
                Max Lv: {maxLevelUnlocked}
              </span>
            </div>
          </div>
        </div>

        {/* Mode toggle buttons */}
        <div className="mb-6 flex rounded-full bg-slate-800 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => handleModeChange("copy")}
            className={`flex-1 rounded-full px-3 py-1 transition ${
              mode === "copy"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Copy Mode
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("recall")}
            className={`flex-1 rounded-full px-3 py-1 transition ${
              mode === "recall"
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Recall Mode
          </button>
        </div>

        {/* Recall Mode: Learned/To Review Tabs */}
        {mode === "recall" && (
          <div className="mb-6 space-y-3 border-b border-slate-700 pb-4">
            <button
              type="button"
              onClick={() => setShowTabsUI(!showTabsUI)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              {showTabsUI ? "Hide Stats" : "Show Stats"} (Learned: {learnedWords.length} | To Review: {reviewWords.length})
            </button>

            {showTabsUI && (
              <div className="space-y-3">
                {/* Tab Buttons */}
                <div className="flex gap-2 rounded-lg bg-slate-800 p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveTab("learned")}
                    className={`flex-1 rounded-md px-3 py-1 transition ${
                      activeTab === "learned"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Learned ({learnedWords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("to-review")}
                    className={`flex-1 rounded-md px-3 py-1 transition ${
                      activeTab === "to-review"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    To Review ({reviewWords.length})
                  </button>
                </div>

                {/* Learned Tab Content */}
                {activeTab === "learned" && (
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-slate-800/50 p-3">
                    {learnedWords.length === 0 ? (
                      <div className="text-center text-xs text-slate-400">
                        No learned words yet. Keep typing!
                      </div>
                    ) : (
                      learnedWords.map((word) => (
                        <div
                          key={word.id}
                          className="rounded-md border border-emerald-900/50 bg-emerald-900/20 p-2 text-xs"
                        >
                          <div className="font-semibold text-emerald-400">
                            {word.korean}
                          </div>
                          <div className="text-slate-300">
                            {word.en}
                            {word.zh && ` / ${word.zh}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* To Review Tab Content */}
                {activeTab === "to-review" && (
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-slate-800/50 p-3">
                    {reviewWords.length === 0 ? (
                      <div className="text-center text-xs text-slate-400">
                        No review words yet. Great job!
                      </div>
                    ) : (
                      reviewWords.map((word) => (
                        <div
                          key={word.id}
                          className="rounded-md border border-amber-900/50 bg-amber-900/20 p-2 text-xs"
                        >
                          <div className="font-semibold text-amber-400">
                            {word.korean}
                          </div>
                          <div className="text-slate-300">
                            {word.en}
                            {word.zh && ` / ${word.zh}`}
                          </div>
                          {word.hanja && (
                            <div className="text-slate-400 text-[11px]">
                              {word.hanja}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentWord ? (
          <>
            {/* Word and definitions */}
            <div className="mb-6 space-y-2 text-center">
              <KoreanWordDisplay
                word={currentWord.korean}
                typed={input}
                mode={mode}
              />
              <div className="text-sm text-slate-300">
                <span className="font-semibold text-slate-100">
                  {currentWord.en}
                </span>
                {currentWord.zh && (
                  <>
                    <span className="mx-2 text-slate-500">/</span>
                    <span>{currentWord.zh}</span>
                  </>
                )}
              </div>
              {currentWord.classification && (
                <div className="text-xs text-slate-400">
                  {currentWord.classification}
                </div>
              )}
              {currentWord.hanja && (
                <div className="text-xs text-slate-400">{currentWord.hanja}</div>
              )}
              {currentWord.wordreferencelink && (
                <div className="pt-1 text-xs">
                  <a
                    href={currentWord.wordreferencelink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
                  >
                    Open in WordReference
                  </a>
                </div>
              )}
            </div>

            {/* Typing input and feedback */}
            <div className="space-y-2">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  // Ensure state stays in sync with the final composed value.
                  setInput(e.currentTarget.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Ignore Enter while the IME is still composing a syllable.
                    if (isComposing) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    handleSubmitCurrentWord();
                  }
                }}
                placeholder={
                  mode === "copy"
                    ? "Copy the Korean word here..."
                    : "Recall and type the Korean word..."
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center text-lg tracking-wide text-slate-50 outline-none ring-sky-500/60 focus:border-sky-500 focus:ring-2"
                autoFocus
              />
              <div className="h-5 text-center text-sm">
                {justCompleted && (
                  <span className="font-medium text-emerald-400">
                    Perfect! Moving to the next word…
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 text-center text-sm text-slate-400">
            No words match the current filters. Try relaxing one of the filters.
          </div>
        )}
      </div>
    </div>
  );
}