"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { allWords, type Word } from "../data/words";

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
// error count, and game mode.
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

  // Keep a ref to the timeout so we can clear it on unmount
  const nextWordTimeoutRef = useRef<number | null>(null);

  // Build the word list from the extended dataset and the current filters.
  const wordList: Word[] = useMemo(() => {
    const band = FREQUENCY_BANDS.find((b) => b.id === frequencyBandId);

    return allWords.filter((w) => {
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
  }, [complexityFilter, frequencyBandId, classificationFilter]);

  const currentWord: Word | undefined = wordList[currentIndex];

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
    return () => {
      if (nextWordTimeoutRef.current !== null) {
        window.clearTimeout(nextWordTimeoutRef.current);
      }
    };
  }, []);

  // Whenever filters change, reset progress so the user starts
  // cleanly on the new subset of words.
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
  }, [complexityFilter, frequencyBandId, classificationFilter]);

  // Switch between Copy and Recall modes. We reset the input for clarity
  // but keep the current word and error count.
  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    setInput("");
    setJustCompleted(false);
  };

  // Handle typing in the input box and count new character-level errors.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentWord) return;

    const target = currentWord.korean;
    const previous = input;
    let next = e.target.value;

    // Prevent typing beyond the length of the target word
    if (next.length > target.length) {
      next = next.slice(0, target.length);
    }

    // Only count NEW errors for newly added characters (not deletions)
    if (next.length > previous.length) {
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

  // Submit handler triggered explicitly (e.g. Enter key). Validates the current
  // word, updates accuracy / score / streak, and advances to the next word.
  const handleSubmitCurrentWord = () => {
    if (!currentWord || input.length === 0) return;

    const target = currentWord.korean;
    const isCorrect = input === target && !madeMistakeOnCurrentWord;

    setTotalAttempts((prev) => prev + 1);

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
    setErrors(0);
    setMadeMistakeOnCurrentWord(false);

    // Advance to the next word immediately (no delay) for snappier UX.
    setCurrentIndex((prevIndex) =>
      prevIndex + 1 < wordList.length ? prevIndex + 1 : 0
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
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