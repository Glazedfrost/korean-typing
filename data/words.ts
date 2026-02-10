export type Word = {
  korean: string;
  en: string;
  zh: string;
  hanja?: string | null;
};

// Basic everyday words – good for TOPIK 1 level practice.
export const wordsTopik1: Word[] = [
  { korean: "사과", en: "apple", zh: "苹果", hanja: "沙果" },
  { korean: "학교", en: "school", zh: "学校", hanja: "學校" },
  { korean: "물", en: "water", zh: "水", hanja: "水" },
  { korean: "책", en: "book", zh: "书", hanja: "冊" },
  { korean: "집", en: "house", zh: "家", hanja: "宅" },
  { korean: "나무", en: "tree", zh: "树", hanja: "木" },
  { korean: "친구", en: "friend", zh: "朋友", hanja: "親舊" },
  { korean: "강아지", en: "puppy", zh: "小狗", hanja: null },
  { korean: "고양이", en: "cat", zh: "猫", hanja: null },
  { korean: "자동차", en: "car", zh: "汽车", hanja: "自動車" },
  { korean: "하늘", en: "sky", zh: "天空", hanja: null },
  { korean: "꽃", en: "flower", zh: "花", hanja: "花" },
  { korean: "바다", en: "sea", zh: "海", hanja: "海" },
  { korean: "산", en: "mountain", zh: "山", hanja: "山" },
  { korean: "음식", en: "food", zh: "食物", hanja: "飮食" },
  { korean: "물고기", en: "fish", zh: "鱼", hanja: "魚" },
  { korean: "의자", en: "chair", zh: "椅子", hanja: "椅子" },
  { korean: "책상", en: "desk", zh: "书桌", hanja: "冊床" },
  { korean: "문", en: "door", zh: "门", hanja: "門" },
  { korean: "창문", en: "window", zh: "窗户", hanja: "窓門" },
  { korean: "손", en: "hand", zh: "手", hanja: "手" },
  { korean: "발", en: "foot", zh: "脚", hanja: "足" },
  { korean: "눈", en: "eye/snow", zh: "眼睛/雪", hanja: "目/雪" },
  { korean: "코", en: "nose", zh: "鼻子", hanja: "鼻" },
  { korean: "입", en: "mouth", zh: "嘴", hanja: "口" },
  { korean: "귀", en: "ear", zh: "耳朵", hanja: "耳" },
  { korean: "머리", en: "head", zh: "头", hanja: "頭" },
  { korean: "시간", en: "time", zh: "时间", hanja: "時間" },
  { korean: "날씨", en: "weather", zh: "天气", hanja: "天氣" },
  { korean: "아침", en: "morning", zh: "早晨", hanja: "朝" },
  { korean: "저녁", en: "evening", zh: "傍晚", hanja: "夕" },
  { korean: "점심", en: "lunch", zh: "午餐", hanja: "點心" },
  { korean: "시장", en: "market", zh: "市场", hanja: "市場" },
  { korean: "길", en: "road", zh: "路", hanja: "路" },
  { korean: "차", en: "tea/car", zh: "茶/车", hanja: "茶/車" },
  { korean: "의사", en: "doctor", zh: "医生", hanja: "醫師" },
  { korean: "병원", en: "hospital", zh: "医院", hanja: "病院" },
  { korean: "약", en: "medicine", zh: "药", hanja: "藥" },
  { korean: "음악", en: "music", zh: "音乐", hanja: "音樂" },
  { korean: "노래", en: "song", zh: "歌曲", hanja: "歌" },
  { korean: "영화", en: "movie", zh: "电影", hanja: "映畫" },
  { korean: "사진", en: "photo", zh: "照片", hanja: "寫眞" },
  { korean: "컴퓨터", en: "computer", zh: "电脑", hanja: null },
  { korean: "전화", en: "telephone", zh: "电话", hanja: "電話" },
  { korean: "편지", en: "letter", zh: "信", hanja: "便紙" },
  { korean: "가방", en: "bag", zh: "包", hanja: null },
  { korean: "신발", en: "shoes", zh: "鞋子", hanja: "新발" },
  { korean: "옷", en: "clothes", zh: "衣服", hanja: "衣" },
  { korean: "모자", en: "hat", zh: "帽子", hanja: null },
  { korean: "공원", en: "park", zh: "公园", hanja: "公園" },
  { korean: "놀이", en: "play", zh: "玩耍", hanja: "遊" },
  { korean: "게임", en: "game", zh: "游戏", hanja: null },
];

// Slightly more abstract / advanced words – good for TOPIK 2 style practice.
export const wordsTopik2: Word[] = [
  { korean: "친절", en: "kindness", zh: "亲切", hanja: "親切" },
  { korean: "행복", en: "happiness", zh: "幸福", hanja: "幸福" },
  { korean: "걱정", en: "worry", zh: "担心", hanja: "걱정" },
  { korean: "경험", en: "experience", zh: "经验", hanja: "經驗" },
  { korean: "노력", en: "effort", zh: "努力", hanja: "努力" },
  { korean: "성공", en: "success", zh: "成功", hanja: "成功" },
  { korean: "실패", en: "failure", zh: "失败", hanja: "失敗" },
  { korean: "약속", en: "promise", zh: "约定", hanja: "約束" },
  { korean: "계획", en: "plan", zh: "计划", hanja: "計劃" },
  { korean: "문제", en: "problem", zh: "问题", hanja: "問題" },
  { korean: "해결", en: "solution", zh: "解决", hanja: "解決" },
  { korean: "자유", en: "freedom", zh: "自由", hanja: "自由" },
  { korean: "문화", en: "culture", zh: "文化", hanja: "文化" },
  { korean: "역사", en: "history", zh: "历史", hanja: "歷史" },
  { korean: "전통", en: "tradition", zh: "传统", hanja: "傳統" },
  { korean: "환경", en: "environment", zh: "环境", hanja: "環境" },
  { korean: "사회", en: "society", zh: "社会", hanja: "社會" },
  { korean: "정부", en: "government", zh: "政府", hanja: "政府" },
  { korean: "경제", en: "economy", zh: "经济", hanja: "經濟" },
  { korean: "회사", en: "company", zh: "公司", hanja: "會社" },
  { korean: "직원", en: "employee", zh: "职员", hanja: "職員" },
  { korean: "고객", en: "customer", zh: "顾客", hanja: "顧客" },
  { korean: "회의", en: "meeting", zh: "会议", hanja: "會議" },
  { korean: "준비", en: "preparation", zh: "准备", hanja: "準備" },
  { korean: "설명", en: "explanation", zh: "说明", hanja: "說明" },
  { korean: "연습", en: "practice", zh: "练习", hanja: "練習" },
  { korean: "발표", en: "presentation", zh: "发表", hanja: "發表" },
  { korean: "발전", en: "development", zh: "发展", hanja: "發展" },
  { korean: "변화", en: "change", zh: "变化", hanja: "變化" },
  { korean: "조건", en: "condition", zh: "条件", hanja: "條件" },
  { korean: "경쟁", en: "competition", zh: "竞争", hanja: "競爭" },
  { korean: "선택", en: "choice", zh: "选择", hanja: "選擇" },
  { korean: "도전", en: "challenge", zh: "挑战", hanja: "挑戰" },
  { korean: "목표", en: "goal", zh: "目标", hanja: "目標" },
];

// Helper map for easy lookup in the game component.
export const wordsByLevel = {
  topik1: wordsTopik1,
  topik2: wordsTopik2,
} as const;

// Backwards-compatible export – default to TOPIK 1 list.
export const words: Word[] = wordsTopik1;