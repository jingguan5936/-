# 八个字的婚事: production notes

Vertical cartoon short (2D characters in a 3D toon world), made with the `cartoon-3d-short` skill in a cloud container
without a GPU. 70.3 s, 1080x1920, 30 fps, Chinese narration, no captions (the user adds captions in their own edit).

## Files
| Path | What |
|---|---|
| `SCRIPT.md` | Facts with sources, approved script, shot list |
| `voice/make_voice.py` | Offline Chinese TTS (sherpa-onnx Kokoro v1.0, voice `zm_yunjian`, speed 1.15), clause by clause, with fixed pauses. Writes `voice.wav` and `words.json` |
| `app/src/videos/bazi/` | Remotion + three.js project, built from the skill's bridge template |
| `app/src/videos/bazi/timing.ts` | Generated from `words.json`: clause and character onset frames |
| `app/src/videos/bazi/story.ts` | Shots, story beats (`EV`), cameras, kicks, depth of field |
| `app/src/videos/bazi/jn.ts` | Jiangnan set: plaster, tile, slab, lacquer and slip textures; houses with stepped gable walls; arch bridge, canal, lanterns, boats, stall, abacus, ancestral hall, gears |
| `app/src/videos/bazi/world.ts` | Scene, lights, sky, water, animated props |
| `app/src/videos/bazi/cast.ts` | Staging per shot, plus effects |
| `app/src/videos/bazi/toon.ts` | Character drawing: Qing hats (skullcap, bun with flower), glasses, goatee, a held slip, 12 zodiac heads, the cat, effects |
| `audio/bazi_audio.py` | Original pentatonic score (guzheng-like plucks, glockenspiel, music box, pad, woodblock, timpani, gong), 86 synced SFX events, and the mix |
| `audio/cues.md` | Every SFX event and its level |
| `app/scripts/render_final.sh` | Resumable chunked render (JPEG q95 frames), H.264 CRF 16, mux with the mix (AAC 320k) |

## Departures from the skill's original rules (agreed with the user, or forced by the environment)
- **Chinese narration, not English.** The user approved the script in Chinese.
- **Offline TTS, not a recorded voice.** The user chose this. Wrong default readings in the lexicon were fixed with homophones in the TTS text only: 属相→属象, 供在→贡在, 处不来→楚不来, 只→支, 得→的.
- **1080x1920, not 2K.** Rendering is SwiftShader (CPU) WebGL at about 5 s per frame, so 2K would take about 4.5 h. 1080x1920 is also Douyin's native vertical size.
- **Cheaper post-processing for CPU WebGL:**
  - MSAA 2 instead of 4.
  - Lens blur at 40/20 main taps (was 64/32) and skipped entirely in shots with no blur.
  - Shadow map 2048.
- **No Kenney models.** They are not in the repo and kenney.nl is unreachable from the container. Every prop is procedural.

## Look-match
- **Passes.** Three check passes (every 45th, then every 60th frame, then 18 key stills). Then one round with an Opus max verifier.
- **Verifier round 1 scores:** colour day 5, golden 5, lighting 5, ink 6, textures 6, characters 6, depth 6, composition 5, readability 5.
- **Fixed after round 1:**
  - Hook: changed to a deck-level medium shot, with the slip slamming down upright between the pair.
  - Golden-hour shadows brightened; stone and plaster warmed; red wood saturation reduced.
  - Step lines thinned; edge cuts fixed.
  - Misreads fixed: beard, horse, goat horns.
  - Bolts glow and run low; the storm cloud is puffier and dims the sun.
  - Gear jam: bigger shake and chips.
  - The bowl's fall path is clear of the chair; the cat close-up is tighter; the procession enters the close shot.
- **Lighting decisions:**
  - The sun is camera-relative per shot. Most day and golden shots light the subjects from behind the camera (az 130–155), so faces and lacquer read warm.
  - The sunset procession stays backlit.

## Mix
Voice unchanged. Music sits 10 LU under the voice (the "+3 dB" standard), ducked 3 dB while the voice speaks. SFX events are placed at their naive level −6 dB. Master −15.0 LUFS, true peak −1.2 dBTP, LRA 1.8, 70.333 s, 48 kHz stereo 24-bit.

## Final render + QA (2026-11-03)
- `bazi_short.mp4`: 1080x1920, 30 fps, 2110 frames, 70.333 s, H.264 CRF 16 + AAC 320k 48 kHz; -15.0 LUFS, peak -1.1 dBFS.
- short_qa.py: no black, unplanned white or frozen frames, no silences. Every frame-diff spike is a planned camera cut or effect.
- Depth of field: sharpness of the final frames matches fresh stills within ~5 % (frames 200, 300, 575, 810, 1140, 1650, 1940, 2058).
- **Lessons:**
  - Toggling the lens-blur passes per shot (to save CPU) rebuilt the composer and broke depth of field: after a rebuild, everything blurred. Keep the passes fixed. The 1269 affected frames were re-rendered.
  - renderFrames names files `element-<absolute frame>` when everyNthFrame = 1. The render script fills only missing frames, so it can resume.
  - The crossfade layer's unmount called InkPass.dispose after the composer had torn it down; it is guarded now.
- Not done: a second Opus verifier round after the round-1 fixes. Every round-1 item was addressed and checked on stills.
