# 潮汐獵手 試聽：主畫面「夕陽海灣」— 輕快悠閒的島嶼晶片音樂＋海浪聲
import numpy as np, wave
SR = 44100
BPM = 92
BEAT = 60 / BPM
BAR = BEAT * 4
INTRO, BODY, OUTRO = 2, 8, 2
TOTAL = (INTRO + BODY + OUTRO) * BAR + 2.5
N = int(TOTAL * SR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig)); buf[i:j] += sig[:j - i] * gain

def pluck(m, dur, duty=0.25, decay=3.2, vib=0.0):
    n = int((dur + 0.6) * SR); t = np.arange(n) / SR
    f = hz(m) * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 3 - 0.3, 0, 1))
    ph = np.cumsum(f) / SR
    pulse = np.where((ph % 1) < duty, 1.0, -1.0)
    tri = 2 * np.abs(2 * (ph % 1) - 1) - 1
    s = 0.55 * pulse + 0.45 * tri
    # 簡單的低通讓方波柔和一點
    k = 6; s = np.convolve(s, np.ones(k) / k, mode='same')
    env = np.minimum(1, t / 0.004) * np.exp(-t * decay)
    rel = np.clip((dur + 0.15 - t) / 0.15, 0, 1)
    return s * env * np.maximum(rel, np.exp(-t * decay * 2.5) * 0)

def marimba(m, dur):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR
    f = hz(m); s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 18)
    return s * np.minimum(1, t / 0.002) * np.exp(-t * 4.5)

def bass(m, dur):
    n = int((dur + 0.2) * SR); t = np.arange(n) / SR
    ph = hz(m) * t
    s = 2 * np.abs(2 * (ph % 1) - 1) - 1
    env = np.minimum(1, t / 0.01) * np.exp(-t * 1.6) * np.clip((dur - t) / 0.08, 0, 1)
    return s * env

def shaker(dur=0.09):
    n = int(dur * SR); t = np.arange(n) / SR
    s = rng.standard_normal(n); s = s - np.convolve(s, np.ones(3) / 3, mode='same')
    return s * np.minimum(1, t / 0.01) * np.exp(-t * 45)

# 和弦（F 大調：F Dm Bb C / F Dm Gm C）
CH = {'F': [65, 69, 72], 'Dm': [62, 65, 69], 'Bb': [62, 65, 70], 'C': [64, 67, 72], 'Gm': [62, 67, 70]}
ROOT = {'F': 41, 'Dm': 38, 'Bb': 46, 'C': 36, 'Gm': 43}
prog = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C']
bars = ['F', 'C'] + prog + ['F', 'F']
MEL = [
    [(0, 1, 69), (1, .5, 72), (1.5, .5, 74), (2, 1.5, 72), (3.5, .5, 69)],
    [(0, 1, 74), (1, .5, 72), (1.5, .5, 69), (2, 2, 65)],
    [(0, 1, 70), (1, .5, 69), (1.5, .5, 67), (2, 1, 65), (3, 1, 67)],
    [(0, 1.5, 67), (1.5, .5, 69), (2, 2, 72)],
    [(0, .5, 77), (.5, .5, 74), (1, 1, 72), (2, .5, 69), (2.5, .5, 72), (3, 1, 74)],
    [(0, 1.5, 72), (1.5, .5, 69), (2, 1, 65), (3, 1, 69)],
    [(0, 1, 70), (1, 1, 74), (2, .5, 72), (2.5, .5, 70), (3, 1, 69)],
    [(0, 1, 67), (1, .5, 69), (1.5, .5, 67), (2, 2, 64)],
]
SWING = 0.06  # 反拍稍微晚一點，比較慵懶
def tpos(bar, beat):
    off = SWING * BEAT if (beat * 2) % 2 == 1 else 0
    return 1.0 + bar * BAR + beat * BEAT + off

# 烏克麗麗刷弦：下、下上、上下上
STRUM = [(0, 'd', 1.0), (1, 'd', 0.7), (1.5, 'u', 0.55), (2.5, 'u', 0.6), (3, 'd', 0.75), (3.5, 'u', 0.5)]
for b, c in enumerate(bars):
    last = b >= len(bars) - 1
    pattern = [(0, 'd', 1.0)] if last else STRUM
    for beat, d, v in pattern:
        notes = CH[c] if d == 'd' else CH[c][::-1]
        for k, m in enumerate(notes):
            s = pluck(m - 12, BEAT * (2.5 if last else 0.9), duty=0.5, decay=5.5 if not last else 1.6)
            add(L, tpos(b, beat) + k * 0.014, s, 0.075 * v)
            add(R, tpos(b, beat) + k * 0.014, s, 0.085 * v)
    # 低音：第 1、3 拍
    if b >= 1:
        add(L, tpos(b, 0), bass(ROOT[c], BEAT * 1.6), 0.16); add(R, tpos(b, 0), bass(ROOT[c], BEAT * 1.6), 0.16)
        if not last:
            m5 = ROOT[c] + 7
            add(L, tpos(b, 2), bass(m5, BEAT * 1.2), 0.12); add(R, tpos(b, 2), bass(m5, BEAT * 1.2), 0.12)
    # 沙鈴：每八分音符，反拍重一點
    if 1 <= b < len(bars) - 1:
        for e in range(8):
            sh = shaker(); g = 0.035 if e % 2 else 0.018
            add(L, tpos(b, e / 2), sh, g * 0.8); add(R, tpos(b, e / 2), sh, g * 1.2)
# 主旋律（烏克麗麗般的撥弦）
for i, notes in enumerate(MEL):
    b = INTRO + i
    for beat, dur, m in notes:
        s = pluck(m, dur * BEAT, duty=0.25, decay=2.2, vib=0.004)
        add(L, tpos(b, beat), s, 0.16); add(R, tpos(b, beat), s, 0.14)
# 木琴點綴：前奏與尾聲
for b, seq in [(0, [(0, 72), (1, 69), (2, 74), (3, 72)]), (1, [(0, 70), (1.5, 72), (3, 67)]), (10, [(0, 77), (1, 72), (2, 74), (3, 69)]), (11, [(0, 72), (1, 69), (2, 65)])]:
    for beat, m in seq:
        s = marimba(m, BEAT); add(L, tpos(b, beat), s, 0.10); add(R, tpos(b, beat), s, 0.10)

# 殘響：用衰減雜訊當脈衝響應
def reverb(x, secs=1.6, mix=0.22, seed=1):
    r = np.random.default_rng(seed); n = int(secs * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 4.2); ir[0] = 0
    ir = np.convolve(ir, np.ones(30) / 30, mode='same')  # 讓殘響暗一點
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    y /= np.max(np.abs(y)) + 1e-9
    return x + y * mix * np.max(np.abs(x))
L = reverb(L, seed=1); R = reverb(R, seed=2)

# ── 海浪聲 ──
def lowpass(x, cutoff):
    size = 1 << int(np.ceil(np.log2(len(x))))
    X = np.fft.rfft(x, size); f = np.fft.rfftfreq(size, 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, size)[:len(x)]
def highpass(x, cutoff):
    return x - lowpass(x, cutoff)
t = np.arange(N) / SR
def swell(seed):
    r = np.random.default_rng(seed); env = np.zeros(N); crest = np.zeros(N); pos = r.uniform(-2, 0)
    while pos < TOTAL:
        per = r.uniform(6.0, 8.5); peak = pos + per * 0.42
        rise = np.clip((t - pos) / (peak - pos), 0, 1); fall = np.clip(1 - (t - peak) / (per * 0.75), 0, 1)
        w = np.where(t < peak, rise ** 1.8, fall ** 1.3) * ((t >= pos) & (t < pos + per * 1.2)) * r.uniform(0.75, 1.0)
        env = np.maximum(env, w)
        c = np.exp(-((t - peak - 0.25) / 0.55) ** 2) * r.uniform(0.6, 1.0)
        crest = np.maximum(crest, c)
        pos += per
    return env, crest
for ch, seed in ((0, 11), (1, 12)):
    white = rng.standard_normal(N)
    body = lowpass(white, 500); body /= np.max(np.abs(body))
    hiss = highpass(lowpass(white, 7000), 1800); hiss /= np.max(np.abs(hiss))
    env, crest = swell(seed)
    waves = body * (0.10 + 0.9 * env) * 0.28 + hiss * (0.03 + crest) * 0.055
    (L if ch == 0 else R)[:] += waves

# 頭尾淡入淡出、正規化
fade = np.ones(N); fi = int(1.2 * SR); fo = int(3.0 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
L *= fade; R *= fade
peak = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= 0.89 / peak; R *= 0.89 / peak
data = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open('試聽_夕陽海灣.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('seconds', round(TOTAL, 1))
