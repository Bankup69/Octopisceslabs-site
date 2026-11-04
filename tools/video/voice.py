"""Voices a scene list with Kokoro and lays each line at its start time."""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
D = '/tmp/claude-0/-home-claude/9747ce12-c821-5271-b46a-c30fbd8b1522/scratchpad/tts/'
spec = json.load(open(sys.argv[1]))  # {"voice":..,"speed":..,"total":..,"lines":[[start,end,text],...],"out":..}
k = Kokoro(D + 'kokoro-v1.0.onnx', D + 'voices-v1.0.bin')
sr = 24000
track = np.zeros(int(spec['total'] * sr), dtype=np.float32)
report = []
for start, end, text in spec['lines']:
    speed = spec.get('speed', 1.0)
    for attempt in range(4):
        s, sr = k.create(text.replace('EquityFoundry', 'Equity Foundry').replace('DSCR', 'D S C R'), voice=spec['voice'], speed=speed, lang='en-us')
        dur = len(s) / sr
        if start + 0.15 + dur <= end - 0.1 or speed >= 1.25:
            break
        speed = round(speed + 0.06, 2)
    i = int((start + 0.15) * sr)
    seg = s[: max(0, min(len(s), len(track) - i))]
    track[i:i + len(seg)] += seg
    report.append((start, end, round(dur, 2), speed, 'OK' if start + 0.15 + dur <= end else 'OVER'))
peak = np.abs(track).max() or 1
sf.write(spec['out'], track / peak * 0.89, sr)
for r in report: print(r)
