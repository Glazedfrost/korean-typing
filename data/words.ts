import topikVocab from "./topik_vocab_with_wiktionary.json";

// Unified word shape used by the typing game.
export type Word = {
  id: string; // Unique identifier
  korean: string;
  en: string;
  zh: string | null;
  hanja?: string | null;
  classification?: string | null;
  frequency?: number | null;
  complexity?: string | null;
  wordreferencelink?: string | null;
  wiktionarylink?: string | null;
};

type RawVocabEntry = {
  korean: string;
  en: string;
  zh: string | null;
  hanja: string | null;
  classification: string | null;
  frequency: number | null;
  complexity: string | null;
  wordreferencelink: string | null;
  wiktionarylink: string | null;
};

// Full extended vocabulary list used by the app.
export const allWords: Word[] = (topikVocab as RawVocabEntry[]).map(
  (item, index) => ({
    id: `word_${index}_${item.korean}`, // Create unique ID from index + korean text
    korean: item.korean,
    en: item.en,
    zh: item.zh,
    hanja: item.hanja,
    classification: item.classification,
    frequency: item.frequency,
    // Normalize complexity: treat null or 'E' as 'D'
    complexity: (item.complexity === null || item.complexity === "E") ? "D" : item.complexity,
    wordreferencelink: item.wordreferencelink,
    wiktionarylink: item.wiktionarylink,
  })
);