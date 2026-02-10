"use client";

import React, { useEffect, useRef, useState } from "react";
import { wordsByLevel, type Word } from "../data/words";

// Game modes:
// - "copy": show the Korean word and ask the user to copy it
// - "recall": hide the Korean word, user recalls it from the definition
type GameMode = "copy" | "recall";
// Difficulty:
// - "topik1": basic everyday words
// - "topik2": more abstract / advanced
// - "words6000": large 6000-word list from JSON vocab
type Difficulty = "topik1" | "topik2" | "words6000";

// Small delay before automatically moving to the next word
const NEXT_WORD_DELAY_MS = 500;

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
  const [errors, setErrors] = useState(0);
  const [mode, setMode] = useState<GameMode>("copy");
  const [justCompleted, setJustCompleted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("topik1");

  // Keep a ref to the timeout so we can clear it on unmount
  const nextWordTimeoutRef = useRef<number | null>(null);

  const wordList: Word[] = wordsByLevel[difficulty];
  const currentWord: Word = wordList[currentIndex];

  // Clean up any pending timeout when the component unmounts
  useEffect(() => {
    return () => {
      if (nextWordTimeoutRef.current !== null) {
        window.clearTimeout(nextWordTimeoutRef.current);
      }
    };
  }, []);

  // Change difficulty (TOPIK1 / TOPIK2). We reset position and input
  // so you start cleanly on the new list.
  const handleDifficultyChange = (nextDifficulty: Difficulty) => {
    if (nextWordTimeoutRef.current !== null) {
      window.clearTimeout(nextWordTimeoutRef.current);
      nextWordTimeoutRef.current = null;
    }
    setDifficulty(nextDifficulty);
    setCurrentIndex(0);
    setInput("");
    setJustCompleted(false);
    setErrors(0);
  };

  // Switch between Copy and Recall modes. We reset the input for clarity
  // but keep the current word and error count.
  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    setInput("");
    setJustCompleted(false);
  };

  // Handle typing in the input box, count new errors, and advance
  // to the next word when the current one is completed correctly.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (target[idx] !== added[i]) {
          newErrors += 1;
        }
      }

      if (newErrors > 0) {
        setErrors((prevErrors) => prevErrors + newErrors);
      }
    }

    setInput(next);
    setJustCompleted(false);

    // If the word has been typed exactly, show a short success message
    // and then automatically move to the next word.
    if (next === target) {
      setJustCompleted(true);

      if (nextWordTimeoutRef.current !== null) {
        window.clearTimeout(nextWordTimeoutRef.current);
      }

      nextWordTimeoutRef.current = window.setTimeout(() => {
        setCurrentIndex((prevIndex) =>
          prevIndex + 1 < wordList.length ? prevIndex + 1 : 0
        );
        setInput("");
        setJustCompleted(false);
      }, NEXT_WORD_DELAY_MS);
    }
  };

  const progressLabel = `${currentIndex + 1} / ${wordList.length}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
        {/* Header with title, difficulty, progress and error counter */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Korean Typing Trainer
            </div>
            <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-slate-800 p-1 text-[11px] font-medium text-slate-300">
              <button
                type="button"
                onClick={() => handleDifficultyChange("topik1")}
                className={`rounded-full px-3 py-1 ${
                  difficulty === "topik1"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "hover:text-white"
                }`}
              >
                TOPIK 1 (Basic)
              </button>
              <button
                type="button"
                onClick={() => handleDifficultyChange("topik2")}
                className={`rounded-full px-3 py-1 ${
                  difficulty === "topik2"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "hover:text-white"
                }`}
              >
                TOPIK 2 (Harder)
              </button>
              <button
                type="button"
                onClick={() => handleDifficultyChange("words6000")}
                className={`rounded-full px-3 py-1 ${
                  difficulty === "words6000"
                    ? "bg-sky-400 text-white shadow-sm"
                    : "hover:text-white"
                }`}
              >
                6000 Words
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
              {progressLabel}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-1 font-mono">
              Errors: {errors}
            </span>
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
            <span className="mx-2 text-slate-500">/</span>
            <span>{currentWord.zh}</span>
          </div>
          {currentWord.hanja && (
            <div className="text-xs text-slate-400">{currentWord.hanja}</div>
          )}
        </div>

        {/* Typing input and feedback */}
        <div className="space-y-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
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
      </div>
    </div>
  );
}