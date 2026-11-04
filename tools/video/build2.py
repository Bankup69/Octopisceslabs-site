"""Desktop 1080p how-to: frames + chapter labels + title/end cards + voice -> MP4, plus SRT and YouTube chapters."""
import json, os, subprocess, sys, re
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont
D = os.path.dirname(os.path.abspath(__file__)); VOICE = sys.argv[1]; SEQ = sys.argv[2]; OUT = sys.argv[3]; LINES = sys.argv[4]; T1 = sys.argv[5]; T2 = sys.argv[6]
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'; FONTR = '/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf'
LOGO = '/home/claude/rental-income-calculator/assets/brand/social-logo-1200x630.png'
W, H = 1920, 1080; GOLD = (244, 196, 92); NAVY = (7, 12, 30)
lines = json.load(open(os.path.join(D, LINES))); seq = json.load(open(SEQ)); sc = {n: (a, b) for n, a, b in seq['scenes']}
durs = json.load(open(os.path.join(VOICE, 'durs.json')))
tmp = os.path.join(D, 'tmp_' + os.path.basename(OUT).replace('.mp4','')); os.makedirs(tmp, exist_ok=True)
# base
with open(f'{tmp}/concat.txt', 'w') as f:
    for p, h in seq['list']: f.write(f"file '{os.path.abspath(p)}'\nduration {h:.4f}\n")
    f.write(f"file '{os.path.abspath(seq['list'][-1][0])}'\n")
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',f'{tmp}/concat.txt','-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','18',f'{tmp}/base.mp4'],check=True)
big = ImageFont.truetype(FONT, 76); mid = ImageFont.truetype(FONT, 44); small = ImageFont.truetype(FONTR, 34)
items = []
# title card over s1 (translucent panel)
t = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
d.rounded_rectangle((260, 330, W - 260, 750), radius=40, fill=NAVY + (238,))
for i, (ln, fnt, col) in enumerate([(T1, big, (255, 255, 255)), (T2, big, GOLD), ('Every listing tells a story. The numbers tell the truth.', small, (200, 208, 230))]):
    tw = d.textlength(ln, font=fnt); d.text(((W - tw) / 2, 395 + i * 100 + (20 if i == 2 else 0)), ln, font=fnt, fill=col)
t.save(f'{tmp}/title.png'); items.append((f'{tmp}/title.png', 0.2, sc['s1'][1] - 0.4))
# chapter labels (s2..s12)
for i, (sid, name, _) in enumerate(lines):
    if sid in ('s1', lines[-1][0]): continue
    a, b = sc[sid]; im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    num = f'{i:02d}'; label = name.upper()
    tw = d.textlength(label, font=mid) + d.textlength(num, font=mid) + 70
    x0, y0 = 60, H - 150
    d.rounded_rectangle((x0, y0, x0 + tw, y0 + 86), radius=22, fill=NAVY + (235,))
    d.text((x0 + 28, y0 + 18), num, font=mid, fill=GOLD); d.text((x0 + 42 + d.textlength(num, font=mid), y0 + 18), label, font=mid, fill=(255, 255, 255))
    p = f'{tmp}/ch{i}.png'; im.save(p); items.append((p, round(a + 0.1, 2), round(min(a + 3.6, b), 2)))
# end card over s13
a13, b13 = sc[lines[-1][0]]; logo = Image.open(LOGO).convert('RGBA'); bg = logo.getpixel((4, 4))[:3]; end = Image.new('RGBA', (W, H), bg + (255,))
lw = 1100; logo = logo.resize((lw, int(logo.size[1] * lw / logo.size[0])), Image.LANCZOS); end.paste(logo, ((W - lw) // 2, 170), logo)
d = ImageDraw.Draw(end)
for i, (ln, fnt, col) in enumerate([('Forge better deals.', big, (255, 255, 255)), ('Run your first deal free', mid, GOLD), ('octopisceslabs.com/rental-calc', mid, (200, 208, 230))]):
    tw = d.textlength(ln, font=fnt); d.text(((W - tw) / 2, 790 + i * 85 + (10 if i else 0)), ln, font=fnt, fill=col)
end.save(f'{tmp}/end.png'); items.append((f'{tmp}/end.png', round(a13 + 0.2, 2), round(b13 + 2.5, 2)))
total = b13 + 2.5
# voice track
sr = sf.info(os.path.join(VOICE, 'line1.wav')).samplerate; track = np.zeros(int(total * sr), dtype=np.float32)
for i, (sid, _, _) in enumerate(lines):
    s, r = sf.read(os.path.join(VOICE, f'line{i+1}.wav'), dtype='float32')
    if s.ndim > 1: s = s.mean(1)
    st = int((sc[sid][0] + 0.35) * sr); seg = s[: max(0, len(track) - st)]; track[st:st + len(seg)] += seg
track = track / (np.abs(track).max() or 1) * 0.89; sf.write(f'{tmp}/voice.wav', track, sr)
# composite
inputs = ['-i', f'{tmp}/base.mp4']; filt = []; last = '0:v'
inputs += ['-loop','1','-t',str(total),'-i',f'{tmp}/end.png']  # placeholder index 1 unused
filt.append(f"[0:v]tpad=stop_mode=clone:stop_duration=3[b0]"); last = 'b0'
for k, (png, s0, e0) in enumerate(items, start=2):
    inputs += ['-i', png]; filt.append(f"[{last}][{k}:v]overlay=0:0:enable='between(t,{s0},{e0})'[v{k}]"); last = f'v{k}'
subprocess.run(['ffmpeg','-v','error','-y',*inputs,'-i',f'{tmp}/voice.wav','-filter_complex',';'.join(filt),'-map',f'[{last}]','-map',f'{len(items)+2}:a',
  '-af','loudnorm=I=-15:TP=-1.5:LRA=11','-ar','48000','-c:a','aac','-b:a','192k','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-t',f'{total:.2f}','-movflags','+faststart',OUT],check=True)
# SRT + chapters
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h:02d}:{m:02d}:{s:06.3f}".replace('.',',')
srt=[]; k=1
for i,(sid,name,text) in enumerate(lines):
    st=sc[sid][0]+0.35; dur=durs[i]; parts=re.split(r'(?<=[.?!:])\s+',text); tot=sum(len(p) for p in parts); t0=st
    for p in parts:
        dd=dur*len(p)/tot; srt.append(f"{k}\n{ts(t0)} --> {ts(t0+dd)}\n{p}\n"); k+=1; t0+=dd
open(OUT.replace('.mp4','.srt'),'w').write('\n'.join(srt))
ch=[f"{int(sc[s][0]//60)}:{int(sc[s][0]%60):02d} {n}" for s,n,_ in lines]; ch[0]='0:00 Intro'
open(OUT.replace('.mp4','_chapters.txt'),'w').write('\n'.join(ch)); print('\n'.join(ch)); print('total',round(total,1))
