#!/bin/bash
# Resumable final render: renders only the frames missing from out/final/frames (f_00000.jpeg ...), in runs of at most
# 422 frames (renderFrames names files element-<frame number>), then H.264 CRF 16 + the mix (AAC 320k).
cd "$(dirname "$0")/.."
SCALE=${SCALE:-1}; CONC=${CONC:-4}; TOTAL=2110; MAXRUN=422
mkdir -p out/final/frames
missing_runs() { # prints "a b" for each run of missing frames
  python3 - "$TOTAL" "$MAXRUN" <<'PY'
import os, sys
T, M = int(sys.argv[1]), int(sys.argv[2])
have = {int(f[2:7]) for f in os.listdir("out/final/frames") if f.startswith("f_")}
f = 0
while f < T:
    if f in have: f += 1; continue
    a = f
    while f < T and f not in have and f - a < M: f += 1
    print(a, f - 1)
PY
}
for pass in 1 2 3; do
  runs=$(missing_runs)
  [ -z "$runs" ] && break
  echo "$runs" | while read a b; do
    rm -rf out/final/chunk
    node scripts/frames.mjs out/final/chunk $a $b 1 $SCALE $CONC > out/final/chunk.log 2>&1
    grep -E "^total|TypeError|Error:" out/final/chunk.log | head -3
    for f in out/final/chunk/element-*.jpeg; do [ -e "$f" ] || continue; i=$(basename "$f" .jpeg | sed 's/element-0*//'); mv "$f" out/final/frames/f_$(printf %05d ${i:-0}).jpeg; done
    echo "run $a-$b $(date +%T) have $(ls out/final/frames | wc -l)"
  done
done
n=$(ls out/final/frames | wc -l); [ "$n" -ne $TOTAL ] && { echo "INCOMPLETE $n"; exit 1; }
ffmpeg -y -loglevel error -framerate 30 -i out/final/frames/f_%05d.jpeg -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart out/final/video.mp4
ffmpeg -y -loglevel error -i out/final/video.mp4 -i ../audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest out/final/bazi_short.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact out/final/bazi_short.mp4
echo "DONE"
