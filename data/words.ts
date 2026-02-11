import vocabExtended from "./korean_vocabulary_extended.json";

// Unified word shape used by the typing game.
export type Word = {
  korean: string;
  en: string;
  zh: string | null;
  hanja?: string | null;
  classification?: string | null;
  frequency?: number | null;
  complexity?: string | null;
  wordreferencelink?: string | null;
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
};

// Full extended vocabulary list used by the app.
export const allWords: Word[] = (vocabExtended as RawVocabEntry[]).map(
  (item) => ({
    korean: item.korean,
    en: item.en,
    zh: item.zh,
    hanja: item.hanja,
    classification: item.classification,
    frequency: item.frequency,
    complexity: item.complexity,
    wordreferencelink: item.wordreferencelink,
  })
);