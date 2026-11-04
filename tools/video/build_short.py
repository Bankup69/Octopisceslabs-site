"""Assemble a vertical Short. Usage: build_short.py <key> <out.mp4>  (needs v_<key>/seq.json, durs.json, lineN.wav; lines.json)"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont
D = os.path.dirname(os.path.abspath(__file__)); key, out = sys.argv[1], sys.argv[2]; V = f'{D}/v_{key}'
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'; LOGO = '/home/claude/rental-income-calculator/assets/brand/social-logo-1200x630.png'
W, H = 1080, 1920; GOLD = (244, 196, 92)
cfg = json.load(open(f'{D}/lines.json'))[key]; seq = json.load(open(f'{V}/seq.json')); durs = json.load(open(f'{V}/durs.json'))
sc = {n: (a, b) for n, a, b in seq['scenes']}; total = seq['scenes'][-1][2]
with open(f'{V}/concat.txt', 'w') as f:
    for path, hold in seq['list']: f.write(f"file '{os.path.abspath(path)}'\nduration {hold:.4f}\n")
    f.write(f"file '{os.path.abspath(seq['list'][-1][0])}'\n")
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',f'{V}/concat.txt','-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','18',f'{V}/base.mp4'],check=True)
font = ImageFont.truetype(FONT, 58)
def chunks(t, n=6):
    out, cur = [], []
    for w in t.split():
        cur.append(w)
        if len(cur) >= n and (w.endswith(('.', ',', '?', ':')) or len(cur) >= n + 2): out.append(' '.join(cur)); cur = []
    if cur: out.append(' '.join(cur))
    return out
def cap(text, path):
    img = Image.new('RGBA', (W, H), (0,0,0,0)); d = ImageDraw.Draw(img); words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) > 900 and cur: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur); bh = 74 * len(lines) + 44; y0 = int(H * 0.70)
    d.rounded_rectangle((60, y0, W-60, y0+bh), radius=28, fill=(7,12,30,225))
    for i, ln in enumerate(lines): d.text(((W - d.textlength(ln, font=font)) / 2, y0 + 22 + i * 74), ln, font=font, fill=(255,255,255))
    img.save(path)
items = []; k = 0
for i, (sid, text) in enumerate(cfg['lines']):
    text = text.replace('Link in bio.', 'Link in bio.')
    a, b = sc[sid]; parts = chunks(text); tw = sum(len(p.split()) for p in parts); t = a + 0.15; span = min(b - a - 0.2, durs[i] + 0.2)
    for p in parts:
        dur = span * len(p.split()) / tw; png = f'{V}/c{k:03d}.png'; k += 1; cap(p, png)
        e = round(t + dur, 2)
        if sid == 's5': e = min(e, total - 3.05)
        if e > t: items.append((png, round(t, 2), e))
        t += dur
title = Image.new('RGBA', (W, H), (0,0,0,0)); d = ImageDraw.Draw(title); big = ImageFont.truetype(FONT, 96)
d.rounded_rectangle((70, 470, W-70, 790), radius=36, fill=(7,12,30,235))
for i, ln in enumerate(cfg['title']):
    tw = d.textlength(ln, font=big); d.text(((W-tw)/2+4, 520+i*120+4), ln, font=big, fill=(0,0,0,160)); d.text(((W-tw)/2, 520+i*120), ln, font=big, fill=GOLD)
title.save(f'{V}/title.png')
end = Image.new('RGBA', (W, H), (5,10,24,255)); logo = Image.open(LOGO).convert('RGBA'); lw = 1000; logo = logo.resize((lw, int(logo.size[1]*lw/logo.size[0])), Image.LANCZOS); end.paste(logo, ((W-lw)//2, 560), logo)
d = ImageDraw.Draw(end); mid = ImageFont.truetype(FONT, 60)
for i, ln in enumerate(['Forge better deals.', 'Run your first deal free · Link in bio']):
    d.text(((W - d.textlength(ln, font=mid)) / 2, 1180 + i*90), ln, font=mid, fill=(255,255,255) if i == 0 else GOLD)
end.save(f'{V}/end.png')
allitems = [(f'{V}/title.png', 0, sc['s1'][1])] + items + [(f'{V}/end.png', total - 3, total)]
inputs = ['-i', f'{V}/base.mp4']; fl, last = [], '0:v'
for i, (png, s, e) in enumerate(allitems, 1):
    inputs += ['-i', png]; fl.append(f"[{last}][{i}:v]overlay=0:0:enable='between(t,{s},{e})'[v{i}]"); last = f'v{i}'
subprocess.run(['ffmpeg','-v','error','-y',*inputs,'-filter_complex',';'.join(fl),'-map',f'[{last}]','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',f'{V}/silent.mp4'],check=True)
# voice track
SR = 24000; tr = np.zeros(int((total + 0.5) * SR), dtype=np.float32)
for i, (sid, _) in enumerate(cfg['lines']):
    w, sr = sf.read(f'{V}/line{i+1}.wav'); assert sr == SR; s = int((sc[sid][0] + 0.15) * SR); tr[s:s+len(w)] += w[:len(tr)-s]
sf.write(f'{V}/voice.wav', tr, SR)
subprocess.run(['ffmpeg','-v','error','-y','-i',f'{V}/silent.mp4','-i',f'{V}/voice.wav','-map','0:v','-map','1:a','-c:v','copy','-af','loudnorm=I=-15:TP=-1.5:LRA=11','-ar','48000','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',out],check=True)
print(out, round(total, 1), 's')
