#!/bin/zsh
# Copies clips and music into the Remotion public dir and refreshes
# timings.json (clip durations only — the edit itself is beat-driven).
set -e
cd "$(dirname "$0")/.."
mkdir -p video/public/clips video/public/music video/src

cp clips/clip-*.webm video/public/clips/
cp music/*.mp3 video/public/music/
mkdir -p video/public/brand && cp assets/logo.png video/public/brand/logo.png

python3 - <<'EOF'
import json, subprocess, os
def dur(p):
    return float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',p]))
clips = {f: round(dur(f'clips/{f}'), 3) for f in sorted(os.listdir('clips')) if f.endswith('.webm')}
json.dump({'clips': clips}, open('video/src/timings.json','w'), indent=2)
print(f'assets synced — {len(clips)} clips, music: bg.mp3')
EOF
