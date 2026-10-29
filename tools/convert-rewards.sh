#!/usr/bin/env bash
# Convert ProRes 4444 (alpha) bag-opening clips into web assets:
#   <slug>.webp  animated WebP, alpha, 512x512, 30fps, q80, plays once (loop count 1) and holds the last frame
#   <slug>-still.webp  last frame, for reduced motion
#   <slug>.webm  VP9 + alpha (yuva420p), 512x512, 30fps, no audio
# Output names match the companion <slug>.mp3 (audio is shipped separately).
# Usage: convert-rewards.sh <raw_dir> <out_dir>
set -euo pipefail
RAW="${1:-assets/rewards/raw}"; OUT="${2:-assets/rewards}"
mkdir -p "$OUT"

# source .mov  ->  slug (matches the MP3 track name, web-safe)
declare -A MAP=(
  ["Common.mov"]="common"       ["Common 2.mov"]="common-2"
  ["UNCOMMON.mov"]="uncommon"
  ["Rare.mov"]="rare"           ["RARE 2.mov"]="rare-2"
  ["Legendary.mov"]="legendary" ["Mythic.mov"]="mythic"
)
# Lanczos downscale; premultiply-free since both formats carry straight alpha.
VF="fps=30,scale=512:512:flags=lanczos"

for src in "${!MAP[@]}"; do
  slug="${MAP[$src]}"; in="$RAW/$src"
  [[ -f "$in" ]] || { echo "MISSING: $in" >&2; exit 1; }
  echo ">> $src -> $slug"

  ffmpeg -hide_banner -loglevel error -y -i "$in" -an \
    -vf "$VF,format=yuva420p" \
    -c:v libwebp_anim -lossless 0 -quality 80 -compression_level 6 \
    -loop 1 -preset default "$OUT/$slug.webp"

  # Two-pass constrained-quality VP9; alpha kept as yuva420p.
  ffmpeg -hide_banner -loglevel error -y -i "$in" -an \
    -vf "$VF,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p \
    -b:v 0 -crf 32 -row-mt 1 -deadline good -cpu-used 1 -auto-alt-ref 0 \
    -pass 1 -passlogfile "$OUT/.$slug" -f webm /dev/null
  ffmpeg -hide_banner -loglevel error -y -i "$in" -an \
    -vf "$VF,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p \
    -b:v 0 -crf 32 -row-mt 1 -deadline good -cpu-used 1 -auto-alt-ref 0 \
    -pass 2 -passlogfile "$OUT/.$slug" "$OUT/$slug.webm"
  rm -f "$OUT/.$slug"*

  # Final frame as a small still: shown instead of the animation under reduced motion.
  ffmpeg -hide_banner -loglevel error -y -sseof -0.1 -i "$in" -an -frames:v 1 \
    -vf "scale=512:512:flags=lanczos,format=yuva420p" \
    -c:v libwebp -quality 80 "$OUT/$slug-still.webp"
done
ls -la "$OUT"
