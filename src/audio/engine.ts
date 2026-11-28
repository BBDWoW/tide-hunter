// 背景音樂與環境音：全部用 Web Audio 即時合成，不需要下載音檔。
// 瀏覽器規定要先有使用者操作才能發聲，所以第一次點擊畫面時才會開始（unlockAudio）。
import { CHORDS, FLAVORS, SONGS, type Flavor, type Lead, type Song, type SongId } from './songs';

// ── 設定（記在這台裝置上） ──
export interface SoundSettings { music: number; amb: number; sfx: number; muted: boolean }
const KEY = 'tidehunter.sound';
export function loadSound(): SoundSettings {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) return { music: 0.7, amb: 0.7, sfx: 0.8, muted: false, ...s }; } catch { /* 略過 */ }
  return { music: 0.7, amb: 0.7, sfx: 0.8, muted: false };
}
let settings = loadSound();
export function saveSound(s: SoundSettings) {
  settings = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 略過 */ }
  applyVolumes();
}

// ── 節點 ──
let ctx: AudioContext | null = null;
let sfxBus: GainNode, master: GainNode, musicBus: GainNode, musicFade: GainNode, ambBus: GainNode, verbSend: GainNode, verb: ConvolverNode;
let pulse25: PeriodicWave, pulse50: PeriodicWave, noise: AudioBuffer;
let unlocked = false;
let meter: AnalyserNode | null = null;

function pulseWave(c: AudioContext, duty: number) {
  const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    const soft = Math.exp(-k / 14); // 高頻柔和一點
    real[k] = (Math.sin(2 * Math.PI * k * duty) / (Math.PI * k)) * soft;
    imag[k] = ((1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k)) * soft;
  }
  return c.createPeriodicWave(real, imag);
}
function makeVerb(c: AudioContext, secs: number) {
  const len = Math.floor(secs * c.sampleRate), buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.exp(-(i / c.sampleRate) * 3.6); }
  }
  return buf;
}

function build() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  // 總輸出加一個限制器，很多音同時響也不會爆音
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
  limiter.connect(ctx.destination);
  master = ctx.createGain(); master.connect(limiter);
  meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
  musicBus = ctx.createGain(); musicFade = ctx.createGain(); musicFade.connect(musicBus); musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  verb = ctx.createConvolver(); verb.buffer = makeVerb(ctx, 1.8); verbSend = ctx.createGain(); verbSend.connect(verb); verb.connect(musicBus);
  pulse25 = pulseWave(ctx, 0.25); pulse50 = pulseWave(ctx, 0.5);
  noise = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = noise.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  applyVolumes();
  return true;
}
function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music * 0.9, t, 0.05);
  ambBus.gain.setTargetAtTime(settings.amb * 0.9, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx * 0.9, t, 0.05);
}

/** 第一次點擊／按鍵時呼叫：建立音訊並開始播放目前場景的音樂 */
export function unlockAudio() {
  if (unlocked) { if (ctx?.state === 'suspended' && !document.hidden) ctx.resume(); return; }
  if (!ctx && !build()) return;
  ctx!.resume();
  unlocked = true;
  startScene();
}

// 切到背景時暫停，回來再繼續（加到主畫面的 App 很重要）
document.addEventListener('visibilitychange', () => {
  if (!ctx || !unlocked) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});

// ── 樂器 ──
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let flavor: Flavor = FLAVORS.sunset;

function voice(t: number, midi: number, dur: number, vol: number, kind: Lead | 'strum' | 'bass' | 'arp', pan = 0) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain(), f = midi + (flavor.detune ?? 0);
  let decay = 2.2, attack = 0.004, tail = 0.5;
  if (kind === 'pluck') { o.setPeriodicWave(pulse25); decay = 2.4; }
  else if (kind === 'strum') { o.setPeriodicWave(pulse50); decay = 5.5; tail = 0.25; }
  else if (kind === 'arp') { o.type = 'triangle'; decay = 2; tail = 0.9; }
  else if (kind === 'bass') { o.type = 'triangle'; decay = 1.4; attack = 0.01; tail = 0.12; }
  else if (kind === 'bell') { o.type = 'sine'; decay = 1.2; tail = 1.4; }
  else if (kind === 'marimba') { o.type = 'sine'; decay = 4.2; tail = 0.6; }
  else if (kind === 'saw') { o.type = 'sawtooth'; decay = 2.6; vol *= 0.55; }
  else { o.type = 'triangle'; decay = 1.1; attack = 0.03; tail = 1.2; }
  o.frequency.setValueAtTime(hz(f), t);
  if (kind === 'pluck' || kind === 'saw') { // 長音加一點顫音
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz(f) * 0.004, t + 0.3);
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + tail);
  }
  const end = t + dur + tail;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setTargetAtTime(0.0001, t + attack, 1 / decay);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  let out: AudioNode = g;
  if (kind === 'saw') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.connect(lp); out = lp; }
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; out.connect(p); out = p; }
  o.connect(g);
  out.connect(musicFade); out.connect(verbSend);
  if (kind === 'bell') { // 鈴聲：加一個高八度的泛音
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = 'sine'; o2.frequency.value = hz(f) * 2.01; g2.gain.setValueAtTime(vol * 0.35, t); g2.gain.setTargetAtTime(0.0001, t, 0.25);
    o2.connect(g2); g2.connect(musicFade); g2.connect(verbSend); o2.start(t); o2.stop(end);
  }
  o.start(t); o.stop(end);
}

function drum(t: number, kind: 'shaker' | 'kick' | 'snare', vol: number) {
  const c = ctx!;
  if (kind === 'kick') {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(musicFade); o.start(t); o.stop(t + 0.25);
    return;
  }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise; f.type = kind === 'shaker' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'shaker' ? 6500 : 1800;
  const len = kind === 'shaker' ? 0.07 : 0.16;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f); f.connect(g); g.connect(musicFade);
  s.start(t, Math.random() * 2, len + 0.02);
}

// ── 編曲排程（往前排 0.3 秒） ──
let song: Song | null = null, songId: SongId | null = null;
let barIdx = 0, barTime = 0, timer = 0;
const LOOK = 0.3;

function scheduleBar(s: Song, i: number, t0: number) {
  const beat = 60 / s.bpm, ch = CHORDS[s.bars[i]];
  const at = (b: number) => t0 + b * beat + ((b * 2) % 2 === 1 ? s.swing * beat : 0);
  if (s.strum) for (const [b, dir, v] of s.strum) {
    const notes = dir === 'd' ? ch.notes : [...ch.notes].reverse();
    notes.forEach((m, k) => voice(at(b) + k * 0.014, m - 12, beat * 0.9, s.chord * v, 'strum', (k - 1) * 0.25));
  }
  if (s.arp) {
    const seq = [...ch.notes, ch.notes[2] + 5, ch.notes[1] + 12, ch.notes[2], ch.notes[1], ch.notes[0] + 12];
    seq.forEach((m, k) => voice(at(k * 0.5), m - 12, beat * 0.9, s.chord, 'arp', k % 2 ? 0.3 : -0.3));
  }
  s.bass.forEach((b, k) => voice(at(b), ch.root + (s.bassFifth && k % 2 ? 7 : 0), beat * (s.bass.length > 4 ? 0.45 : 1.5), s.bass.length > 4 ? 0.12 : 0.16, 'bass'));
  if (s.shaker) for (let e = 0; e < 8; e++) drum(at(e / 2), 'shaker', e % 2 ? 0.05 : 0.025);
  s.kick?.forEach((b) => drum(at(b), 'kick', 0.35));
  s.snare?.forEach((b) => drum(at(b), 'snare', 0.12));
  const mel = s.melody[i];
  if (mel) for (const [b, d, m] of mel) voice(at(b), m, d * beat, s.lead, flavor.lead, 0.05);
}

function tick() {
  if (!ctx || !song) return;
  while (barTime < ctx.currentTime + LOOK) {
    scheduleBar(song, barIdx, barTime);
    barTime += (60 / song.bpm) * 4;
    barIdx = (barIdx + 1) % song.bars.length;
  }
}

// ── 海浪與環境音 ──
let surfSrc: AudioBufferSourceNode | null = null, surfLp: BiquadFilterNode, surfGain: GainNode, hissGain: GainNode, surfUntil = 0, surfTimer = 0;
function startSurf() {
  const c = ctx!;
  if (!surfSrc) {
    surfSrc = c.createBufferSource(); surfSrc.buffer = brown(c); surfSrc.loop = true;
    surfLp = c.createBiquadFilter(); surfLp.type = 'lowpass';
    surfGain = c.createGain(); surfGain.gain.value = 0;
    surfSrc.connect(surfLp); surfLp.connect(surfGain); surfGain.connect(ambBus);
    const hs = c.createBufferSource(); hs.buffer = noise; hs.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.4;
    hissGain = c.createGain(); hissGain.gain.value = 0;
    hs.connect(bp); bp.connect(hissGain); hissGain.connect(ambBus);
    surfSrc.start(); hs.start();
    surfTimer = window.setInterval(scheduleSurf, 1000);
  }
  surfLp.frequency.setTargetAtTime(flavor.surf.cutoff, c.currentTime, 0.5);
  surfUntil = Math.max(surfUntil, c.currentTime);
  scheduleSurf();
}
function brown(c: AudioContext) {
  const buf = c.createBuffer(2, c.sampleRate * 6, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
  }
  return buf;
}
function scheduleSurf() {
  if (!ctx) return;
  const s = flavor.surf;
  while (surfUntil < ctx.currentTime + 10) {
    const per = s.period[0] + Math.random() * (s.period[1] - s.period[0]);
    const peak = surfUntil + per * 0.42, big = 0.75 + Math.random() * 0.25;
    surfGain.gain.setTargetAtTime(s.base + (s.peak - s.base) * big, surfUntil, per * 0.18);
    surfGain.gain.setTargetAtTime(s.base, peak, per * 0.22);
    if (s.hiss > 0) { hissGain.gain.setTargetAtTime(s.hiss * big * 0.5, peak - 0.1, 0.12); hissGain.gain.setTargetAtTime(0.008, peak + 0.35, 0.4); }
    surfUntil += per;
  }
}

// ── 換場景 ──
let wantSong: SongId = 'bay', wantTheme = 'sunset';
/** 依畫面切換音樂與海域音色（還沒解鎖時只記下來） */
export function setScene(id: SongId, theme: string) {
  const sameSong = id === wantSong && songId === id;
  wantSong = id; wantTheme = theme;
  if (!ctx || !unlocked) return;
  flavor = FLAVORS[theme] ?? FLAVORS.day;
  verbSend.gain.setTargetAtTime(flavor.reverb, ctx.currentTime, 0.3);
  startSurf();
  if (sameSong) return;
  // 舊的曲子淡出，再從頭開始新的
  const t = ctx.currentTime;
  musicFade.gain.cancelScheduledValues(t);
  musicFade.gain.setTargetAtTime(0, t, 0.12);
  window.clearInterval(timer);
  window.setTimeout(() => startSong(id), 450);
}
function startSong(id: SongId) {
  if (!ctx) return;
  song = SONGS[id]; songId = id; barIdx = 0; barTime = ctx.currentTime + 0.1;
  musicFade.gain.cancelScheduledValues(ctx.currentTime);
  musicFade.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
  window.clearInterval(timer);
  tick(); timer = window.setInterval(tick, 50);
}
function startScene() {
  flavor = FLAVORS[wantTheme] ?? FLAVORS.day;
  verbSend.gain.value = flavor.reverb;
  startSurf();
  startSong(wantSong);
}

export const audioReady = () => unlocked;
// 給測試用：目前狀態
export const audioDebug = () => {
  let rms = 0;
  if (meter) { const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); rms = Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length); }
  return { unlocked, state: ctx?.state, song: songId, theme: wantTheme, bar: barIdx, rms: Math.round(rms * 1000) / 1000 };
};
(window as unknown as { __audio?: typeof audioDebug }).__audio = audioDebug;
/** 停止環境音的排程（目前沒用到，留給之後的設定） */
export const stopSurf = () => { window.clearInterval(surfTimer); };

// ── 音效：全部即時合成 ──
export type SfxId =
  | 'select' | 'confirm' | 'back' | 'hit' | 'crit' | 'super' | 'weak' | 'dodge' | 'block' | 'shieldbreak' | 'heal' | 'buff' | 'debuff' | 'status'
  | 'faint' | 'enter' | 'enrage' | 'cast' | 'splash' | 'nibble' | 'bite' | 'shake' | 'catch' | 'escape' | 'levelup' | 'coin' | 'win' | 'lose'
  | 'turn' | 'reveal' | 'item' | 'energy' | 'fanfare' | 'bossdown'
  | `skill:${string}`;

function tone(t: number, type: OscillatorType | 'p25' | 'p50', f0: number, f1: number, dur: number, vol: number, attack = 0.004) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  if (type === 'p25') o.setPeriodicWave(pulse25); else if (type === 'p50') o.setPeriodicWave(pulse50); else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1) {
  const c = ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 2, dur + 0.05);
}
const notes = (t: number, list: number[], step: number, type: OscillatorType | 'p25' | 'p50', vol: number, len = step * 1.6) =>
  list.forEach((m, i) => tone(t + i * step, type, hz(m), hz(m), len, vol));

const lastPlayed: Record<string, number> = {};
/** 播放音效（同一個音效 40ms 內只會響一次，避免疊在一起爆音） */
export function sfx(id: SfxId) {
  if (!ctx || !unlocked || settings.muted || settings.sfx <= 0) return;
  const t = ctx.currentTime + 0.005;
  if (lastPlayed[id] && t - lastPlayed[id] < 0.04) return;
  lastPlayed[id] = t;
  switch (id) {
    case 'select': tone(t, 'p25', 1320, 1320, 0.035, 0.08); break;
    case 'confirm': tone(t, 'p25', 990, 990, 0.05, 0.1); tone(t + 0.05, 'p25', 1480, 1480, 0.08, 0.1); break;
    case 'back': tone(t, 'p25', 880, 660, 0.08, 0.08); break;
    case 'hit': hiss(t, 0.12, 0.5, 'lowpass', 2400, 400); tone(t, 'sine', 160, 55, 0.16, 0.55); break;
    case 'weak': hiss(t, 0.08, 0.3, 'lowpass', 900, 300); tone(t, 'sine', 110, 60, 0.1, 0.35); break;
    case 'super': hiss(t, 0.16, 0.55, 'lowpass', 3200, 500); tone(t, 'sine', 180, 50, 0.2, 0.6); tone(t + 0.02, 'square', 660, 1320, 0.12, 0.08); break;
    case 'crit': hiss(t, 0.2, 0.7, 'lowpass', 4200, 300); tone(t, 'sine', 200, 40, 0.28, 0.7); tone(t, 'p50', 1760, 1700, 0.25, 0.09); tone(t + 0.03, 'p50', 2640, 2600, 0.2, 0.05); break;
    case 'dodge': hiss(t, 0.22, 0.35, 'bandpass', 600, 3200, 2); break;
    case 'block': tone(t, 'square', 320, 300, 0.09, 0.14); tone(t, 'square', 470, 460, 0.12, 0.1); hiss(t, 0.05, 0.25, 'highpass', 3000); break;
    case 'shieldbreak': tone(t, 'triangle', 1120, 340, 0.16, 0.19); hiss(t, 0.13, 0.24, 'highpass', 3600); break;
    case 'heal': notes(t, [72, 76, 79, 84], 0.06, 'sine', 0.18, 0.18); break;
    case 'buff': tone(t, 'p25', 330, 990, 0.25, 0.1); tone(t + 0.12, 'p25', 660, 1320, 0.18, 0.07); break;
    case 'debuff': tone(t, 'p25', 880, 220, 0.3, 0.1); break;
    case 'status': tone(t, 'triangle', 300, 200, 0.12, 0.18); tone(t + 0.12, 'triangle', 280, 160, 0.14, 0.16); break;
    case 'faint': tone(t, 'p50', 440, 70, 0.6, 0.14); hiss(t + 0.1, 0.5, 0.25, 'lowpass', 1200, 150); break;
    case 'enter': hiss(t, 0.18, 0.3, 'bandpass', 400, 2400, 1.5); tone(t + 0.12, 'p25', 660, 990, 0.08, 0.08); break;
    case 'enrage': tone(t, 'sawtooth', 70, 50, 0.9, 0.35, 0.05); tone(t, 'sawtooth', 105, 72, 0.9, 0.2, 0.05); hiss(t, 0.8, 0.35, 'lowpass', 600, 200); break;
    case 'cast': hiss(t, 0.3, 0.35, 'bandpass', 2500, 500, 2); break;
    case 'splash': hiss(t, 0.35, 0.45, 'highpass', 1200, 400); tone(t, 'sine', 300, 120, 0.12, 0.2); break;
    case 'nibble': tone(t, 'sine', 900, 700, 0.05, 0.12); break;
    case 'bite': tone(t, 'p25', 1320, 1320, 0.06, 0.14); tone(t + 0.07, 'p25', 1760, 1760, 0.1, 0.14); hiss(t, 0.2, 0.3, 'highpass', 1500); break;
    case 'shake': tone(t, 'sine', 180, 120, 0.08, 0.3); hiss(t, 0.05, 0.15, 'bandpass', 1200); break;
    case 'catch': notes(t, [72, 76, 79, 84, 79, 84], 0.09, 'p25', 0.12, 0.2); break;
    case 'escape': notes(t, [76, 72, 67], 0.1, 'p25', 0.11, 0.18); break;
    case 'levelup': notes(t, [67, 71, 74, 79], 0.07, 'p25', 0.11, 0.16); tone(t + 0.3, 'sine', hz(86), hz(86), 0.4, 0.08); break;
    case 'coin': tone(t, 'p25', 1976, 1976, 0.05, 0.08); tone(t + 0.05, 'p25', 2637, 2637, 0.14, 0.08); break;
    case 'win': notes(t, [67, 72, 76, 79, 84], 0.1, 'p25', 0.12, 0.22); break;
    case 'lose': notes(t, [67, 63, 60, 55], 0.16, 'triangle', 0.18, 0.3); break;
    case 'turn': tone(t, 'sine', 400, 1600, 0.4, 0.12); notes(t + 0.3, [84, 88, 91], 0.06, 'sine', 0.12, 0.2); break;
    case 'reveal': notes(t, [72, 79, 84, 88, 91], 0.07, 'p25', 0.11, 0.3); hiss(t, 0.6, 0.15, 'highpass', 5000); break;
    case 'item': tone(t, 'sine', 600, 900, 0.12, 0.15); break;
    case 'bossdown': tone(t, 'sawtooth', 220, 40, 1.4, 0.3, 0.02); hiss(t, 1.2, 0.5, 'lowpass', 2000, 100); tone(t + 0.3, 'sine', 80, 30, 1.2, 0.5); break;
    case 'fanfare': notes(t, [67, 67, 67, 72], 0.12, 'p25', 0.13, 0.14); notes(t + 0.6, [76, 79, 84], 0.18, 'p25', 0.14, 0.5); notes(t + 0.6, [60, 64, 67], 0.18, 'triangle', 0.18, 0.6); tone(t + 1.2, 'sine', hz(96), hz(96), 0.8, 0.06); break;
    case 'energy': tone(t, 'p25', 1200, 1800, 0.08, 0.06); break;
    default: skillSfx(t, id.slice(6));
  }
}
/** 使用技能：依屬性有不同的聲音 */
function skillSfx(t: number, elem: string) {
  switch (elem) {
    case 'fire': hiss(t, 0.35, 0.4, 'bandpass', 800, 2400, 0.8); hiss(t + 0.05, 0.25, 0.2, 'highpass', 4000); break;
    case 'water': hiss(t, 0.35, 0.4, 'bandpass', 2400, 500, 1.2); tone(t, 'sine', 500, 200, 0.2, 0.15); break;
    case 'elec': for (let i = 0; i < 5; i++) tone(t + i * 0.035, 'square', 200 + Math.random() * 1600, 100 + Math.random() * 800, 0.04, 0.07); break;
    case 'ice': notes(t, [96, 91, 98, 93], 0.04, 'sine', 0.07, 0.15); hiss(t, 0.2, 0.15, 'highpass', 6000); break;
    case 'grass': hiss(t, 0.3, 0.3, 'bandpass', 1500, 3000, 3); break;
    case 'rock': tone(t, 'sine', 90, 40, 0.25, 0.5); hiss(t, 0.2, 0.35, 'lowpass', 700, 200); break;
    case 'dark': tone(t, 'sawtooth', 110, 55, 0.4, 0.12, 0.05); hiss(t, 0.4, 0.18, 'lowpass', 500, 150); break;
    case 'data': for (let i = 0; i < 6; i++) tone(t + i * 0.03, 'square', [880, 1320, 660, 1760][i % 4], [880, 1320, 660, 1760][i % 4], 0.025, 0.06); break;
    case 'fly': hiss(t, 0.3, 0.35, 'bandpass', 700, 2600, 2.5); break;
    default: hiss(t, 0.15, 0.3, 'bandpass', 1500, 600, 1);
  }
}
