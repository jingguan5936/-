"""Builds the film's om-score (ABC) and writes it into index.html.

100 BPM, 4/4, 25 written bars + 4 inserted for reading time = 29 bars ≈ 69.6 s, D 宫 (D major pentatonic melody over diatonic chords).
Motif: D E A B (1 2 5 6) on 笛子, stated in the hook, an octave-bright statement on the hero,
driven in the montage, and the sonic logo at the end. Every voice must have exactly 25 written bars.
Run: python3 -I tools/score.py index.html
"""
import re
import sys

S16 = lambda pat: ' '.join(pat for _ in range(2))  # a 16th figure, twice per bar

voices = {
    'DZ inst=dizi role=melody gain=0.8': [
        '!mf! z2 de a2b2', 'a4 f2e2',                                   # hook
        'z8', 'z8', 'z8',                                               # chart
        '!mp! z4 B2d2', 'e4 d2B2', 'A4 z4',                             # steps, stop
        '!f! d2e2 a3b', 'b4 a2f2',                                      # hero
        '!mp! z2 a2 f2e2', 'd4 e4',                                     # what if
        'z8', 'z8',                                                     # rule
        'z8',                                                           # montage title
        '!ff! deab d\'2ba', 'b2a2 f2d2', 'd2g2 b2a2', 'e2a2 b2a2', '!ff! c\'4 a2e2',
        '!mf! f4 e2d2', 'B4 d4', 'e8',                                  # 顺用逆用
        '!p! z2 de a2b2', '!fermata!d8',                                # end: the motif as the logo
    ],
    'ZH inst=guzheng gain=0.6': [
        '!mf! DAde aedA', 'B,FAd fdAF',
        '!mf! DAdf afdA', 'B,FBd fdBF', 'G,DGB dBGD',
        'E,B,EG BGEB,', 'G,DGB dBGD', 'A,EAc z4',
        '!mf! DAdf afdA', 'B,FBd fdBF',
        '!mp! G,DGB dBGD', 'A,EAc ecAE',
        '!p! B,FBd fdBF', '!crescendo(! G,DGB dBGD !crescendo)!',
        '!mf! ' + S16('A,/E/A/c/ e/c/A/E/'),
        '!ff! ' + S16('D/A/d/f/ a/f/d/A/'), S16('B,/F/B/d/ f/d/B/F/'), S16('G,/D/G/B/ d/B/G/D/'),
        S16('E,/B,/E/G/ B/G/E/B,/'), S16('A,/E/A/c/ e/c/A/E/'),
        '!mf! DAdf afdA', 'G,DGB dBGD', 'A,EAc ecAE',
        '!p! G,DGB dBGD', '!fermata![DAdf]8',
    ],
    'PNO inst=piano gain=0.5': [
        '!mp! [D,A,D]8', '[B,,F,B,]8',
        '[D,A,D]8', '[B,,F,B,]8', '[G,,D,G,]8',
        '[E,,B,,E,]8', '[G,,D,G,]8', '[A,,E,A,]4 z4',
        '!mf! [D,A,DF]4 [D,A,DF]4', '[B,,F,B,D]8',
        '!mp! [G,,D,G,B,]8', '[A,,E,A,C]8',
        '!p! [B,,F,B,]8', '[G,,D,G,]8', '[A,,E,A,]8',
        '!ff! [D,A,DF]4 [D,A,DF]4', '[B,,F,B,D]4 [B,,F,B,D]4', '[G,,D,G,B,]4 [G,,D,G,B,]4',
        '[E,,B,,E,G,]4 [E,,B,,E,G,]4', '[A,,E,A,C]4 [A,,E,A,C]4',
        '!mp! [D,A,D]8', '[G,,D,G,]8', '[A,,E,A,]8',
        '!p! [G,,D,G,]8', '!fermata![D,,A,,D,]8',
    ],
    'STR inst=strings gain=0.45': [
        'z8', 'z8', 'z8', 'z8', 'z8',
        '!p! !crescendo(! [E,G,B,]8', '[G,B,D]8', '[A,CE]4 !crescendo)! z4',
        '!f! [F,A,D]8', '[F,B,D]8',
        '!mp! [G,B,D]8', '[E,A,C]8',
        '!p! [F,B,D]8', '!crescendo(! [G,B,D]8', '[E,A,C]8 !crescendo)!',
        '!ff! [F,A,D]8', '[F,B,D]8', '[G,B,D]8', '[G,B,E]8', '[E,A,C]8',
        '!mp! [F,A,D]8', '[G,B,D]8', '[E,A,C]8',
        '!p! [G,B,D]8', '!fermata![F,A,D]8',
    ],
    'BAS inst=bass gain=0.8': [
        'z8', 'z8', '!mp! D,,8',
        'B,,,8', 'G,,,8',
        'E,,8', 'G,,,8', 'A,,,4 z4',
        '!mf! D,,3D,,3D,,2', 'B,,,3B,,,3B,,,2',
        '!mp! G,,,8', 'A,,,8',
        'B,,,8', 'G,,,8', 'A,,,8',
        '!f! D,,3D,,3D,,2', 'B,,,3B,,,3B,,,2', 'G,,,3G,,,3G,,,2', 'E,,3E,,3E,,2', 'A,,,3A,,,3A,,,2',
        '!mp! D,,8', 'G,,,8', 'A,,,8',
        '!p! G,,,8', '!fermata!D,,8',
    ],
    # cinematic kit: taiko-like kick (=C,,), big snare (D,,), toms (A,,), crash (^C,). K:D would sharpen C, so kicks are =C,,.
    'DR inst=drums kit=cinematic gain=0.9': [
        '!mark:hook! !mf! =C,,4 z2 A,,A,,', '=C,,4 z4',
        '!mark:chart! !mp! =C,,8', 'z8', '=C,,4 z4',
        '!mark:steps! =C,,4 =C,,4', '=C,,4 =C,,2 =C,,2', '!crescendo(! =C,,2 D,,2 !crescendo)! z4',
        '!mark:hero! !hit! !mf! [=C,,^C,]4 =C,,4', '=C,,4 =C,,2 A,,A,,',
        '!mark:whatif! !mp! =C,,4 z4', '=C,,4 z4',
        '!mark:rule! z8', '!rise(! !crescendo(! A,,2A,,2 A,,A,, A,,/A,,/A,,/A,,/ !crescendo)! !rise)!',
        '!mark:montage! !f! [=C,,^C,]2 z2 =C,,2 D,,2',
        '!ff! =C,,2 D,,2 =C,,2 D,,2', '=C,,2 D,,2 =C,,=C,, D,,2', '=C,,2 D,,2 =C,,2 D,,2', '=C,,2 D,,2 =C,,=C,, D,,2',
        '!ff! =C,,2 D,,2 D,,D,, D,,/D,,/D,,/D,,/',
        '!mark:shunni! !mp! [=C,,^C,]4 z4', '=C,,4 z4', '=C,,4 z2 A,,A,,',
        '!mark:end! !p! =C,,8', '!fermata!=C,,8',
    ],
    'DR2 inst=drums kit=pop gain=0.4': [
        'z8', 'z8', '!pp! ^A2^A2 ^A2^A2', '^A2^A2 ^A2^A2', '^A2^A2 ^A2^A2',
        '!p! ^A^A^A^A ^A^A^A^A', '^A^A^A^A ^A^A^A^A', '^A^A^A^A z4',
        '!mf! ^F,,^F,,^F,,^F,, ^F,,^F,,^F,,^F,,', '^F,,^F,,^F,,^F,, ^F,,^F,,^F,,^F,,',
        '!p! ^F,,2^F,,2 ^F,,2^F,,2', '^F,,2^F,,2 ^F,,2^F,,2',
        'z8', '^F,,2^F,,2 ^F,,2^F,,2',
        '^F,,^F,,^F,,^F,, ^F,,^F,,^F,,^F,,',
        *(['!f! ' + ' '.join(['^F,,/'] * 16)] + [' '.join(['^F,,/'] * 16)] * 4),
        'z8', 'z8', 'z8',
        'z8', 'z8',
    ],
}

BARS = 25
for name, bars in voices.items():
    assert len(bars) == BARS, f'{name}: {len(bars)} bars'

# Reading time added to the picture (index.html INSERTS): one more bar after bars 5, 13, 15 and 23.
# Each repeats the bar before it, without marks, hits, fermatas or span openers/closers.
INSERTS = [5, 13, 15, 23]
STRIP = re.compile(r'!(mark:[^!]+|hit|fermata|(crescendo|diminuendo|rise|stop|filter|stutter)[()])!\s*')
for name, bars in voices.items():
    for after in sorted(INSERTS, reverse=True):
        bars.insert(after, STRIP.sub('', bars[after - 1]).strip() or 'z8')
BARS += len(INSERTS)
for name, bars in voices.items():
    assert len(bars) == BARS, f'{name}: {len(bars)} bars after inserts'

lines = ['X:1', 'T:八字格局 · 怎么取格', 'M:4/4', 'L:1/8', 'Q:1/4=100', 'K:D']
for name, bars in voices.items():
    lines.append('V:' + name)
    for i in range(0, BARS, 5):
        lines.append(' | '.join(bars[i:i + 5]) + ' |')
abc = '\n'.join(lines)

path = sys.argv[1]
html = open(path, encoding='utf-8').read()
block = f'<script type="text/vnd.abc" id="om-score">\n{abc}\n</script>\n'
if 'id="om-score"' in html:
    html = re.sub(r'<script type="text/vnd.abc" id="om-score">.*?</script>\n', lambda m: block, html, flags=re.S)
else:
    html = html.replace('\n<script>\n  const V = OM.vars();', '\n' + block + '<script>\n  const V = OM.vars();', 1)
    assert 'id="om-score"' in html
open(path, 'w', encoding='utf-8').write(html)
print(f'score: {len(voices)} voices × {BARS} bars written to {path}')
