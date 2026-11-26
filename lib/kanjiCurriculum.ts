export type CurriculumWord = {
  word: string;
  reading: string;
  meaning: string;
  kanji: string;
};

export type CurriculumLevel = {
  label: string;
  radicals: { character: string; meaning: string; visual: string }[];
  kanji: string[];
  words: CurriculumWord[];
};

const word = (word: string, reading: string, meaning: string, kanji: string): CurriculumWord => ({ word, reading, meaning, kanji });

// JLPT word groupings are practical study sets and are not an official syllabus.
export const KANJI_CURRICULUM: Record<number, CurriculumLevel> = {
  5: {
    label: 'Beginner',
    radicals: [
      { character: '日', meaning: 'sun', visual: '☀️' }, { character: '月', meaning: 'moon', visual: '🌙' },
      { character: '木', meaning: 'tree', visual: '🌳' }, { character: '人', meaning: 'person', visual: '🧍' },
      { character: '口', meaning: 'mouth', visual: '👄' }, { character: '山', meaning: 'mountain', visual: '⛰️' },
      { character: '川', meaning: 'river', visual: '〰️' }, { character: '水', meaning: 'water', visual: '💧' },
      { character: '火', meaning: 'fire', visual: '🔥' }, { character: '土', meaning: 'soil', visual: '🌱' },
      { character: '女', meaning: 'woman', visual: '👩' }, { character: '子', meaning: 'child', visual: '🧒' },
      { character: '手', meaning: 'hand', visual: '✋' }, { character: '目', meaning: 'eye', visual: '👁️' },
      { character: '耳', meaning: 'ear', visual: '👂' }, { character: '雨', meaning: 'rain', visual: '🌧️' },
      { character: '石', meaning: 'stone', visual: '🪨' }, { character: '糸', meaning: 'thread', visual: '🧵' },
    ],
    kanji: ['日', '月', '火', '水', '木'],
    words: [
      word('日本', 'にほん', 'Japan', '日'), word('日曜日', 'にちようび', 'Sunday', '日'), word('毎日', 'まいにち', 'every day', '日'),
      word('月曜日', 'げつようび', 'Monday', '月'), word('一月', 'いちがつ', 'January', '月'), word('月', 'つき', 'moon; month', '月'),
      word('火曜日', 'かようび', 'Tuesday', '火'), word('火', 'ひ', 'fire', '火'), word('火山', 'かざん', 'volcano', '火'),
      word('水曜日', 'すいようび', 'Wednesday', '水'), word('水', 'みず', 'water', '水'), word('水道', 'すいどう', 'water supply; tap', '水'),
      word('木曜日', 'もくようび', 'Thursday', '木'), word('木', 'き', 'tree; wood', '木'), word('木の下', 'きのした', 'under a tree', '木'),
    ],
  },
  4: {
    label: 'Elementary',
    radicals: [
      { character: '金', meaning: 'gold / metal', visual: '🪙' }, { character: '土', meaning: 'soil', visual: '🌱' },
      { character: '人', meaning: 'person', visual: '🧍' }, { character: '口', meaning: 'mouth', visual: '👄' },
      { character: '日', meaning: 'sun', visual: '☀️' }, { character: '月', meaning: 'moon', visual: '🌙' },
      { character: '木', meaning: 'tree', visual: '🌳' }, { character: '水', meaning: 'water', visual: '💧' },
      { character: '火', meaning: 'fire', visual: '🔥' }, { character: '女', meaning: 'woman', visual: '👩' },
      { character: '子', meaning: 'child', visual: '🧒' }, { character: '山', meaning: 'mountain', visual: '⛰️' },
      { character: '川', meaning: 'river', visual: '〰️' }, { character: '手', meaning: 'hand', visual: '✋' },
      { character: '目', meaning: 'eye', visual: '👁️' }, { character: '耳', meaning: 'ear', visual: '👂' },
      { character: '雨', meaning: 'rain', visual: '🌧️' }, { character: '石', meaning: 'stone', visual: '🪨' },
    ],
    kanji: ['金', '土', '先', '生', '名'],
    words: [
      word('お金', 'おかね', 'money', '金'), word('金曜日', 'きんようび', 'Friday', '金'), word('金色', 'きんいろ', 'gold color', '金'),
      word('土曜日', 'どようび', 'Saturday', '土'), word('土地', 'とち', 'land; plot of land', '土'), word('土産', 'みやげ', 'souvenir', '土'),
      word('先生', 'せんせい', 'teacher', '先'), word('先月', 'せんげつ', 'last month', '先'), word('先週', 'せんしゅう', 'last week', '先'),
      word('学生', 'がくせい', 'student', '生'), word('生まれる', 'うまれる', 'to be born', '生'), word('生活', 'せいかつ', 'daily life', '生'),
      word('名前', 'なまえ', 'name', '名'), word('有名', 'ゆうめい', 'famous', '名'), word('名人', 'めいじん', 'master; expert', '名'),
    ],
  },
  3: {
    label: 'Intermediate',
    radicals: [
      { character: '糸', meaning: 'thread', visual: '🧵' }, { character: '辶', meaning: 'movement', visual: '🚶' },
      { character: '車', meaning: 'vehicle', visual: '🚗' }, { character: '足', meaning: 'foot', visual: '🦶' },
      { character: '言', meaning: 'speech', visual: '💬' }, { character: '食', meaning: 'food', visual: '🍚' },
      { character: '雨', meaning: 'rain', visual: '🌧️' }, { character: '山', meaning: 'mountain', visual: '⛰️' },
      { character: '木', meaning: 'tree', visual: '🌳' }, { character: '人', meaning: 'person', visual: '🧍' },
      { character: '口', meaning: 'mouth', visual: '👄' }, { character: '手', meaning: 'hand', visual: '✋' },
      { character: '水', meaning: 'water', visual: '💧' }, { character: '火', meaning: 'fire', visual: '🔥' },
      { character: '心', meaning: 'heart', visual: '❤️' }, { character: '刀', meaning: 'sword', visual: '🗡️' },
      { character: '門', meaning: 'gate', visual: '🚪' }, { character: '田', meaning: 'rice field', visual: '🌾' },
    ],
    kanji: ['旅', '着', '乗', '降', '運'],
    words: [
      word('旅行', 'りょこう', 'travel; trip', '旅'), word('旅館', 'りょかん', 'Japanese inn', '旅'), word('旅人', 'たびびと', 'traveler', '旅'),
      word('着物', 'きもの', 'kimono', '着'), word('到着', 'とうちゃく', 'arrival', '着'), word('着替える', 'きがえる', 'to change clothes', '着'),
      word('乗車', 'じょうしゃ', 'boarding a vehicle', '乗'), word('乗り場', 'のりば', 'boarding area; stop', '乗'), word('乗客', 'じょうきゃく', 'passenger', '乗'),
      word('降車', 'こうしゃ', 'getting off a vehicle', '降'), word('降りる', 'おりる', 'to get off; descend', '降'), word('降水量', 'こうすいりょう', 'precipitation', '降'),
      word('運転', 'うんてん', 'driving; operation', '運'), word('運動', 'うんどう', 'exercise', '運'), word('運ぶ', 'はこぶ', 'to carry; transport', '運'),
    ],
  },
  2: {
    label: 'Upper intermediate',
    radicals: [
      { character: '言', meaning: 'speech', visual: '💬' }, { character: '心', meaning: 'heart', visual: '❤️' },
      { character: '糸', meaning: 'thread', visual: '🧵' }, { character: '辶', meaning: 'movement', visual: '🚶' },
      { character: '車', meaning: 'vehicle', visual: '🚗' }, { character: '食', meaning: 'food', visual: '🍚' },
      { character: '金', meaning: 'metal', visual: '🪙' }, { character: '門', meaning: 'gate', visual: '🚪' },
      { character: '田', meaning: 'rice field', visual: '🌾' }, { character: '水', meaning: 'water', visual: '💧' },
      { character: '木', meaning: 'tree', visual: '🌳' }, { character: '火', meaning: 'fire', visual: '🔥' },
      { character: '口', meaning: 'mouth', visual: '👄' }, { character: '人', meaning: 'person', visual: '🧍' },
      { character: '手', meaning: 'hand', visual: '✋' }, { character: '土', meaning: 'soil', visual: '🌱' },
      { character: '山', meaning: 'mountain', visual: '⛰️' }, { character: '刀', meaning: 'sword', visual: '🗡️' },
    ],
    kanji: ['経', '済', '政', '治', '議'],
    words: [
      word('経済', 'けいざい', 'economy', '経済'), word('経験', 'けいけん', 'experience', '経'), word('経由', 'けいゆ', 'via; by way of', '経'),
      word('済む', 'すむ', 'to be settled; to finish', '済'), word('返済', 'へんさい', 'repayment', '済'), word('救済', 'きゅうさい', 'relief; rescue', '済'),
      word('政治', 'せいじ', 'politics', '政治'), word('政策', 'せいさく', 'policy', '政'), word('政府', 'せいふ', 'government', '政'),
      word('治安', 'ちあん', 'public safety', '治'), word('治療', 'ちりょう', 'medical treatment', '治'), word('自治', 'じち', 'self-government', '治'),
      word('議会', 'ぎかい', 'assembly; parliament', '議'), word('会議', 'かいぎ', 'meeting; conference', '議'), word('議論', 'ぎろん', 'discussion; argument', '議'),
    ],
  },
  1: {
    label: 'Advanced',
    radicals: [
      { character: '言', meaning: 'speech', visual: '💬' }, { character: '心', meaning: 'heart', visual: '❤️' },
      { character: '糸', meaning: 'thread', visual: '🧵' }, { character: '辶', meaning: 'movement', visual: '🚶' },
      { character: '食', meaning: 'food', visual: '🍚' }, { character: '金', meaning: 'metal', visual: '🪙' },
      { character: '門', meaning: 'gate', visual: '🚪' }, { character: '車', meaning: 'vehicle', visual: '🚗' },
      { character: '雨', meaning: 'rain', visual: '🌧️' }, { character: '田', meaning: 'rice field', visual: '🌾' },
      { character: '石', meaning: 'stone', visual: '🪨' }, { character: '人', meaning: 'person', visual: '🧍' },
      { character: '口', meaning: 'mouth', visual: '👄' }, { character: '手', meaning: 'hand', visual: '✋' },
      { character: '水', meaning: 'water', visual: '💧' }, { character: '木', meaning: 'tree', visual: '🌳' },
      { character: '火', meaning: 'fire', visual: '🔥' }, { character: '刀', meaning: 'sword', visual: '🗡️' },
    ],
    kanji: ['概', '認', '適', '複', '確'],
    words: [
      word('概念', 'がいねん', 'concept', '概'), word('概要', 'がいよう', 'outline; summary', '概'), word('概算', 'がいさん', 'rough estimate', '概'),
      word('認識', 'にんしき', 'recognition; understanding', '認'), word('確認', 'かくにん', 'confirmation', '認'), word('承認', 'しょうにん', 'approval; recognition', '認'),
      word('適応', 'てきおう', 'adaptation', '適'), word('適切', 'てきせつ', 'appropriate', '適'), word('適用', 'てきよう', 'application; use', '適'),
      word('複雑', 'ふくざつ', 'complicated', '複'), word('複数', 'ふくすう', 'plural; multiple', '複'), word('複製', 'ふくせい', 'copy; reproduction', '複'),
      word('確立', 'かくりつ', 'establishment', '確'), word('確実', 'かくじつ', 'certain; reliable', '確'), word('正確', 'せいかく', 'accurate; precise', '確'),
    ],
  },
};

export function nextCurriculumLevel(level: number) {
  return level > 1 ? level - 1 : null;
}
