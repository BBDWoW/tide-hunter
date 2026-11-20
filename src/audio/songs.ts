// 背景音樂的樂譜：每首曲子是一段會無限循環的小節序列。
// 音高用 MIDI 編號（60 = 中央 C），拍點從 0 開始（4/4 拍，一小節 4 拍）。

export type Note = [beat: number, dur: number, midi: number];
export type SongId = 'bay' | 'voyage' | 'fish' | 'battle' | 'boss';

export interface Song {
  bpm: number;
  swing: number; // 反拍延後的比例（0 = 不搖擺）
  bars: string[]; // 每小節的和弦
  melody: (Note[] | null)[]; // 每小節的旋律（null = 這小節沒有旋律）
  strum: [beat: number, dir: 'd' | 'u', vel: number][] | null; // 刷弦節奏
  arp?: boolean; // 和弦改成分解（琶音）
  bass: number[]; // 低音在哪幾拍
  bassFifth?: boolean; // 第二個低音彈五度
  shaker?: boolean;
  kick?: number[];
  snare?: number[];
  lead: number; // 旋律音量
  chord: number; // 和弦音量
}

// 和弦組成音（中音域）與根音（低音域）
export const CHORDS: Record<string, { notes: number[]; root: number }> = {
  F: { notes: [65, 69, 72], root: 41 },
  Dm: { notes: [62, 65, 69], root: 38 },
  Bb: { notes: [62, 65, 70], root: 46 },
  C: { notes: [64, 67, 72], root: 36 },
  Gm: { notes: [62, 67, 70], root: 43 },
  A: { notes: [61, 64, 69], root: 45 },
};

const ISLAND: Song['strum'] = [[0, 'd', 1], [1, 'd', 0.7], [1.5, 'u', 0.55], [2.5, 'u', 0.6], [3, 'd', 0.75], [3.5, 'u', 0.5]];

export const SONGS: Record<SongId, Song> = {
  // 主畫面、港口：夕陽海灣（試聽那首）
  bay: {
    bpm: 92, swing: 0.06, lead: 0.16, chord: 0.08,
    bars: ['F', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'],
    melody: [
      null, null,
      [[0, 1, 69], [1, 0.5, 72], [1.5, 0.5, 74], [2, 1.5, 72], [3.5, 0.5, 69]],
      [[0, 1, 74], [1, 0.5, 72], [1.5, 0.5, 69], [2, 2, 65]],
      [[0, 1, 70], [1, 0.5, 69], [1.5, 0.5, 67], [2, 1, 65], [3, 1, 67]],
      [[0, 1.5, 67], [1.5, 0.5, 69], [2, 2, 72]],
      [[0, 0.5, 77], [0.5, 0.5, 74], [1, 1, 72], [2, 0.5, 69], [2.5, 0.5, 72], [3, 1, 74]],
      [[0, 1.5, 72], [1.5, 0.5, 69], [2, 1, 65], [3, 1, 69]],
      [[0, 1, 70], [1, 1, 74], [2, 0.5, 72], [2.5, 0.5, 70], [3, 1, 69]],
      [[0, 1, 67], [1, 0.5, 69], [1.5, 0.5, 67], [2, 2, 64]],
    ],
    strum: ISLAND, bass: [0, 2], bassFifth: true, shaker: true,
  },
  // 航行與海圖：輕快出航
  voyage: {
    bpm: 104, swing: 0.05, lead: 0.15, chord: 0.075,
    bars: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
    melody: [
      [[0, 0.5, 72], [0.5, 0.5, 74], [1, 1, 77], [2, 0.5, 76], [2.5, 0.5, 74], [3, 1, 72]],
      [[0, 1.5, 72], [1.5, 0.5, 70], [2, 1, 69], [3, 1, 67]],
      [[0, 0.5, 69], [0.5, 0.5, 72], [1, 1, 74], [2, 1, 72], [3, 0.5, 69], [3.5, 0.5, 67]],
      [[0, 2, 70], [2, 1, 74], [3, 1, 72]],
      [[0, 0.5, 77], [0.5, 0.5, 76], [1, 1, 74], [2, 0.5, 72], [2.5, 0.5, 74], [3, 1, 77]],
      [[0, 1, 79], [1, 1, 76], [2, 1, 72], [3, 1, 74]],
      [[0, 1, 74], [1, 0.5, 72], [1.5, 0.5, 70], [2, 1, 69], [3, 1, 70]],
      [[0, 1.5, 67], [1.5, 0.5, 69], [2, 2, 72]],
    ],
    strum: ISLAND, bass: [0, 2], bassFifth: true, shaker: true, kick: [0, 2],
  },
  // 釣魚：安靜的分解和弦，讓海浪聲出來
  fish: {
    bpm: 80, swing: 0, lead: 0.1, chord: 0.07,
    bars: ['F', 'Bb', 'F', 'C'],
    melody: [null, null, null, [[2, 2, 72]]],
    strum: null, arp: true, bass: [0],
  },
  // 一般戰鬥：有活力
  battle: {
    bpm: 126, swing: 0, lead: 0.15, chord: 0.06,
    bars: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'],
    melody: [
      [[0, 0.5, 74], [0.5, 0.5, 72], [1, 0.5, 74], [1.5, 0.5, 77], [2, 1, 76], [3, 0.5, 74], [3.5, 0.5, 72]],
      [[0, 1, 70], [1, 0.5, 72], [1.5, 0.5, 74], [2, 1.5, 77], [3.5, 0.5, 74]],
      [[0, 0.5, 76], [0.5, 0.5, 74], [1, 0.5, 72], [1.5, 0.5, 74], [2, 1, 76], [3, 1, 79]],
      [[0, 1.5, 76], [1.5, 0.5, 73], [2, 2, 69]],
      [[0, 0.5, 81], [0.5, 0.5, 79], [1, 0.5, 77], [1.5, 0.5, 76], [2, 1, 77], [3, 1, 74]],
      [[0, 1, 74], [1, 1, 77], [2, 0.5, 76], [2.5, 0.5, 74], [3, 1, 72]],
      [[0, 1, 70], [1, 0.5, 74], [1.5, 0.5, 79], [2, 1, 77], [3, 1, 74]],
      [[0, 1, 73], [1, 1, 76], [2, 2, 81]],
    ],
    strum: [[0, 'd', 1], [0.5, 'u', 0.5], [1.5, 'u', 0.6], [2, 'd', 0.9], [2.5, 'u', 0.5], [3.5, 'u', 0.6]],
    bass: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], kick: [0, 1.5, 2], snare: [1, 3], shaker: true,
  },
  // 霸主戰：低音加重、比較緊張
  boss: {
    bpm: 138, swing: 0, lead: 0.15, chord: 0.055,
    bars: ['Dm', 'Dm', 'Bb', 'A', 'Gm', 'Gm', 'A', 'A'],
    melody: [
      [[0, 1, 62], [1, 1, 65], [2, 1, 69], [3, 1, 74]],
      [[0, 1.5, 72], [1.5, 0.5, 70], [2, 2, 69]],
      [[0, 1, 70], [1, 1, 74], [2, 1, 77], [3, 1, 74]],
      [[0, 2, 73], [2, 1, 69], [3, 1, 64]],
      [[0, 1, 67], [1, 1, 70], [2, 1, 74], [3, 1, 79]],
      [[0, 1.5, 77], [1.5, 0.5, 74], [2, 2, 70]],
      [[0, 1, 69], [1, 1, 73], [2, 1, 76], [3, 1, 81]],
      [[0, 2, 79], [2, 2, 76]],
    ],
    strum: [[0, 'd', 1], [1, 'd', 0.7], [2, 'd', 0.9], [3, 'd', 0.7]],
    bass: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], kick: [0, 1, 2, 3], snare: [1, 3],
  },
};

// 各海域的音色與環境音
export type Lead = 'pluck' | 'bell' | 'marimba' | 'saw' | 'soft';
export interface Flavor {
  lead: Lead;
  surf: { base: number; peak: number; cutoff: number; hiss: number; period: [number, number] };
  reverb: number; // 殘響量
  detune?: number; // 整體移調（半音）
}
export const FLAVORS: Record<string, Flavor> = {
  day: { lead: 'pluck', surf: { base: 0.12, peak: 0.9, cutoff: 520, hiss: 0.35, period: [6, 8.5] }, reverb: 0.22 },
  sunset: { lead: 'pluck', surf: { base: 0.14, peak: 1, cutoff: 520, hiss: 0.35, period: [6.5, 9] }, reverb: 0.25 },
  ice: { lead: 'bell', surf: { base: 0.2, peak: 0.7, cutoff: 1100, hiss: 0.55, period: [5, 7] }, reverb: 0.35 },
  lava: { lead: 'pluck', surf: { base: 0.35, peak: 0.8, cutoff: 220, hiss: 0.1, period: [4, 6] }, reverb: 0.2, detune: -2 },
  forest: { lead: 'marimba', surf: { base: 0.1, peak: 0.5, cutoff: 700, hiss: 0.2, period: [7, 10] }, reverb: 0.3 },
  void: { lead: 'soft', surf: { base: 0.15, peak: 0.5, cutoff: 300, hiss: 0.1, period: [9, 13] }, reverb: 0.45, detune: -3 },
  core: { lead: 'saw', surf: { base: 0.1, peak: 0.4, cutoff: 600, hiss: 0.15, period: [6, 9] }, reverb: 0.3 },
  cyber: { lead: 'saw', surf: { base: 0.1, peak: 0.45, cutoff: 650, hiss: 0.2, period: [6, 9] }, reverb: 0.3 },
  abyss: { lead: 'soft', surf: { base: 0.3, peak: 0.75, cutoff: 160, hiss: 0, period: [10, 14] }, reverb: 0.5, detune: -5 },
};
