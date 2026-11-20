// 背景音樂與環境音：全部用 Web Audio 即時合成，不需要下載音檔。
// 瀏覽器規定要先有使用者操作才能發聲，所以第一次點擊畫面時才會開始（unlockAudio）。
import { CHORDS, FLAVORS, SONGS, type Flavor, type Lead, type Song, type SongId } from './songs';

// ── 設定（記在這台裝置上） ──
export interface SoundSettings { music: number; amb: number; muted: boolean }
const KEY = 'tidehunter.sound';
export function loadSound(): SoundSettings {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) return { music: 0.7, amb: 0.7, muted: false, ...s }; } catch { /* 略過 */ }
  return { music: 0.7, amb: 0.7, muted: false };
}
let settings = loadSound();
export function saveSound(s: SoundSettings) {
  settings = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 略過 */ }
  applyVolumes();
}

// ── 節點 ──
let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, musicFade: GainNode, ambBus: GainNode, verbSend: GainNode, verb: ConvolverNode;
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
