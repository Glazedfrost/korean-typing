import pandas as pd
import json

file_path = "Korean vocabulary list 6000 TOPIK final release v1.csv"
df = pd.read_csv(file_path)

result = []

for _, row in df.iterrows():
    entry = {
        "korean": row["Word"],
        "en": row["English"],
        "zh": None,
        "hanja": None if pd.isna(row["Hanja/Ref."]) else row["Hanja/Ref."],
        "classification": row["Classification"],
        "frequency": int(row["Frequency Rank"]),
        "complexity": row["Complexity"],
        "wordreferencelink": row["Wordreference Link"],
        "wiktionarylink": row["Wiktionary Link"]
    }
    result.append(entry)

with open("topik_vocab.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
