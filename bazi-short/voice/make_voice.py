"""Offline Chinese narration (sherpa-onnx Kokoro v1.0, zm_yunjian) clause by clause, joined with fixed pauses.
Writes voice.wav (24 kHz mono) and words.json (per-character times, clause + beat boundaries).
TTS text uses homophones where the lexicon's default reading is wrong (display text keeps the real characters)."""
import json, re, sys, numpy as np, soundfile as sf, sherpa_onnx as so
M = "/home/user/-/bazi-short/models/kokoro/kokoro-multi-lang-v1_0/"
SID, SPEED = int(sys.argv[1]) if len(sys.argv) > 1 else 49, float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
OUT = "/home/user/-/bazi-short/voice/"
# (beat, display, tts or None)
C = [
 ("hook", "两个人还没见面，", None), ("hook", "婚事就先被八个字否了。", None),
 ("setting", "清朝，", None), ("setting", "江南小镇。", None), ("setting", "媒人揣着一张红纸——", "媒人揣着一张红纸，"), ("setting", "庚帖，", None),
 ("setting", "上面写着姑娘的生辰八字。", None),
 ("a1", "年、月、日、时，", "年，月，日，时，"), ("a1", "各配一个天干、一个地支。", "各配一个天干，一个地支。"), ("a1", "四根柱子，", None), ("a1", "正好八个字。", None),
 ("a2", "男方把它供在祖宗牌位前。", "男方把它贡在祖宗牌位前。"), ("a2", "三五天里家宅平安，", None), ("a2", "亲事才往下走。", None),
 ("a3", "再请算命先生合婚：", "再请算命先生合婚。"), ("a3", "既看代表“夫妻宫”的日柱地支，", "既看代表夫妻宫的日柱地支，"), ("a3", "也看两人的属相。", "也看两人的属象。"),
 ("snap", "先生拨了拨算盘：", "先生拨了拨算盘。"), ("snap", "男属马，", None), ("snap", "女属鼠——", "女属鼠，"), ("snap", "子午相冲。", None),
 ("rhyme", "就算躲过相冲，", None), ("rhyme", "民间还有口诀：", "民间还有口诀。"), ("rhyme", "“白马怕青牛，", "白马怕青牛，"), ("rhyme", "羊鼠一旦休。”", "羊鼠一旦休。"),
 ("dead", "好消息是，", None), ("dead", "每个属相都有一个“六合”的天生搭档。", "每个属象都有一个六合的天生搭档。"),
 ("dead", "坏消息是，", None), ("dead", "每个属相也有一个冲、一个害，", "每个属象也有一个冲，一个害，"), ("dead", "还躲不开一个“刑”。", "还躲不开一个刑。"),
 ("explain", "合婚就像两只齿轮：", "合婚就像两支齿轮。"), ("explain", "齿对上了叫“合”，", "齿对上了叫合，"), ("explain", "转得顺；", "转的顺。"),
 ("explain", "齿顶上了叫“冲”，", "齿顶上了叫冲，"), ("explain", "咔咔响。", None),
 ("conseq", "从唐宋算起，", None), ("conseq", "“八字合不合”，", "八字合不合，"), ("conseq", "在婚前被问了一千多年。", None),
 ("twist", "所以今天，", None), ("twist", "两样东西处不来，", "两样东西楚不来，"), ("twist", "我们还会说：", "我们还会说。"), ("twist", "八字不合。", None),
 ("twist", "比如这只猫，", "比如这支猫，"), ("twist", "和那只碗。", "和那支碗。"),
]
PAUSE = {"，": 0.16, "、": 0.12, "。": 0.42, "：": 0.3, "；": 0.3, "—": 0.3, "”": 0.42}
BEAT_GAP = 0.3
cfg = so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(kokoro=so.OfflineTtsKokoroModelConfig(model=M + "model.onnx", voices=M + "voices.bin",
      tokens=M + "tokens.txt", data_dir=M + "espeak-ng-data", dict_dir=M + "dict", lexicon=M + "lexicon-us-en.txt," + M + "lexicon-zh.txt"), num_threads=4))
tts = so.OfflineTts(cfg)
SR = tts.sample_rate
def trim(a, thr=0.012):
    e = np.convolve(np.abs(a), np.ones(240) / 240, "same")
    idx = np.where(e > thr)[0]
    return a[max(0, idx[0] - 120): idx[-1] + 360] if len(idx) else a
def voiced(a, thr=0.02, gap=0.07):
    """voiced segments (s, e) in seconds: energy above thr, merging gaps shorter than `gap`"""
    e = np.convolve(np.abs(a), np.ones(480) / 480, "same") > thr
    segs, on = [], None
    for i, v in enumerate(e):
        if v and on is None: on = i
        if not v and on is not None: segs.append([on / SR, i / SR]); on = None
    if on is not None: segs.append([on / SR, len(e) / SR])
    out = []
    for s in segs:
        if out and s[0] - out[-1][1] < gap: out[-1][1] = s[1]
        else: out.append(s)
    return out
parts, t, words, clauses, beats, prev = [np.zeros(int(0.25 * SR), np.float32)], 0.25, [], [], {}, None
for beat, disp, say in C:
    if prev and beat != prev: parts.append(np.zeros(int(BEAT_GAP * SR), np.float32)); t += BEAT_GAP
    a = trim(np.array(tts.generate(say or disp, sid=SID, speed=SPEED).samples, np.float32))
    d = len(a) / SR
    chars = [ch for ch in disp if re.match(r"[一-鿿]", ch)]
    segs = voiced(a)
    # per-character times: if the voiced segments match the character count use them, else spread by equal share
    if len(segs) == len(chars): ct = [(t + s, t + e) for s, e in segs]
    else:
        v0, v1 = (segs[0][0], segs[-1][1]) if segs else (0, d)
        step = (v1 - v0) / max(1, len(chars)); ct = [(t + v0 + i * step, t + v0 + (i + 1) * step) for i in range(len(chars))]
    for ch, (s, e) in zip(chars, ct): words.append({"w": ch, "s": round(s, 3), "e": round(e, 3)})
    clauses.append({"beat": beat, "text": disp, "s": round(t, 3), "e": round(t + d, 3), "segs": len(segs), "chars": len(chars)})
    beats.setdefault(beat, [round(t, 3), 0]); beats[beat][1] = round(t + d, 3)
    parts.append(a); t += d
    p = PAUSE.get(disp.rstrip()[-1], 0.15)
    parts.append(np.zeros(int(p * SR), np.float32)); t += p
    prev = beat
parts.append(np.zeros(int(0.6 * SR), np.float32)); t += 0.6
y = np.concatenate(parts)
y = y / max(1e-6, np.abs(y).max()) * 0.89
sf.write(OUT + "voice.wav", y, SR, subtype="PCM_16")
json.dump({"sr": SR, "dur": round(len(y) / SR, 3), "sid": SID, "speed": SPEED, "beats": beats, "clauses": clauses, "words": words},
          open(OUT + "words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"dur {len(y)/SR:.2f}s, chars {len(words)}, {len(words)/(len(y)/SR):.2f} chars/s")
for k, v in beats.items(): print(f"  {k:8s} {v[0]:6.2f} - {v[1]:6.2f}")
