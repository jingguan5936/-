#!/bin/bash
# Resumable final render: frames in 211-frame chunks as JPEG q95 (out/final/frames/f_00000.jpeg ...), each chunk
# skipped when complete, then H.264 CRF 16 + the mix (48 kHz -> AAC 320k), mux -map 0:v:0 -map 1:a:0.
set -e
cd "$(dirname "$0")/.."
SCALE=${SCALE:-1}; CONC=${CONC:-4}; TOTAL=2110; CH=211
mkdir -p out/final/frames
for ((a=0; a<TOTAL; a+=CH)); do
  b=$((a+CH-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  n=$(ls out/final/frames 2>/dev/null | awk -F'[_.]' -v a=$a -v b=$b '$2>=a && $2<=b' | wc -l)
  if [ "$n" -ge $((b-a+1)) ]; then echo "chunk $a-$b done"; continue; fi
  rm -rf out/final/chunk && node scripts/frames.mjs out/final/chunk $a $b 1 $SCALE $CONC 2>&1 | grep -E "^total|frames " || true
  for f in out/final/chunk/*.jpeg; do i=$(basename "$f" .jpeg | sed 's/element-//'); mv "$f" out/final/frames/f_$(printf %05d $((10#$i + a))).jpeg; done
  echo "chunk $a-$b $(date +%T)"
done
ffmpeg -y -loglevel error -framerate 30 -i out/final/frames/f_%05d.jpeg -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart out/final/video.mp4
ffmpeg -y -loglevel error -i out/final/video.mp4 -i ../audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest out/final/bazi_short.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact out/final/bazi_short.mp4
