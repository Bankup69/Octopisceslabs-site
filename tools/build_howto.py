#!/usr/bin/env python3
"""Builds /how-to/: video walkthroughs plus written steps with screenshots.

Usage: python3 tools/build_howto.py <manifest.json>
The manifest lists each video: key, tab label, heading, blurb, the recorder's
seq.json and lines.json (scene times and narration), the MP4 and its SRT. Screenshots are pulled from the recorded frames, so the page always
matches the video. Writes how-to/index.html, how-to/img/*.jpg and media files.
"""
import html, json, os, re, shutil, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
manifest = json.load(open(sys.argv[1]))  # [{key,label,heading,seq,lines,video,srt,results}]
OUT = os.path.join(ROOT, 'how-to'); os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)

def mmss(t): return f"{int(t//60)}:{int(t%60):02d}"
tabs, panels, ld = [], [], []
for vi, v in enumerate(manifest):
    seq = json.load(open(v['seq'])); lines = json.load(open(v['lines']))
    base = os.path.dirname(os.path.dirname(os.path.abspath(v['seq'])))  # recorder ran one level up
    sc = {n: (a, b) for n, a, b in seq['scenes']}; k = v['key']
    shutil.copy(v['video'], os.path.join(ROOT, 'media', f'equityfoundry-howto-{k}.mp4'))
    open(os.path.join(ROOT, 'media', f'equityfoundry-howto-{k}.vtt'), 'w').write('WEBVTT\n\n' + re.sub(r'(\d\d:\d\d:\d\d),(\d\d\d)', r'\1.\2', open(v['srt']).read()))
    def frame_at(t):
        acc = 0
        for p, h in seq['list']:
            if acc + h > t: return p if os.path.isabs(p) else os.path.join(base, p)
            acc += h
        return os.path.join(base, seq['list'][-1][0])
    cards = []
    for i, (sid, name, text) in enumerate(lines):
        if i == 0 or i == len(lines) - 1: continue
        a, b = sc[sid]; back = v.get('back', {}).get(sid, 0.8)
        im = Image.open(frame_at(b - back)).convert('RGB'); im.thumbnail((1280, 720))
        fn = f'{k}-{i:02d}.jpg'; im.save(os.path.join(OUT, 'img', fn), quality=82, optimize=True)
        text = text.replace('octopisceslabs dot com slash rental calc', 'octopisceslabs.com/rental-calc').replace("I'll show you", 'this shows you')
        cards.append(f'<li class="step"><div class="step-text"><span class="num">{i:02d}</span><h3>{html.escape(name)}</h3><p>{html.escape(text)}</p>'
                     f'<button type="button" class="jump" data-v="{k}" data-t="{a:.1f}">Watch this part &middot; {mmss(a)}</button></div>'
                     f'<img src="img/{fn}" alt="{html.escape(name)}: {html.escape(v["label"])} in EquityFoundry" width="{im.width}" height="{im.height}" loading="lazy"></li>')
    rs = v.get('results', lines[len(lines)//2][0])
    poster = Image.open(frame_at(sc[rs][1] - 1.0)).convert('RGB'); poster.thumbnail((1280, 720)); poster.save(os.path.join(OUT, 'img', f'{k}-poster.jpg'), quality=82)
    last = lines[-1][0]; dur = sc[last][1] + 2.5
    chapters = ''.join(f'<li><button type="button" class="jump" data-v="{k}" data-t="{sc[s][0]:.1f}"><span>{mmss(sc[s][0])}</span>{html.escape(n)}</button></li>' for s, n, _ in lines)
    tabs.append(f'<button type="button" role="tab" id="tab-{k}" aria-controls="panel-{k}" aria-selected="{str(vi==0).lower()}" data-k="{k}">{html.escape(v["label"])} <small>{mmss(dur)}</small></button>')
    panels.append(f'''<div class="panel" role="tabpanel" id="panel-{k}" aria-labelledby="tab-{k}"{"" if vi==0 else " hidden"}>
      <h3 class="ph">{html.escape(v["heading"])}</h3><p class="sub">{html.escape(v["blurb"])}</p>
      <div class="player">
        <video id="video-{k}" controls preload="metadata" playsinline poster="img/{k}-poster.jpg"><source src="/media/equityfoundry-howto-{k}.mp4" type="video/mp4"><track kind="captions" src="/media/equityfoundry-howto-{k}.vtt" srclang="en" label="English"></video>
        <ol class="chapters" data-v="{k}"><h4>Chapters</h4>{chapters}</ol>
      </div>
      <ol class="steps">{"".join(cards)}</ol>
    </div>''')
    ld.append({"@type": "VideoObject", "name": v['heading'], "description": v['blurb'], "thumbnailUrl": f"https://octopisceslabs.com/how-to/img/{k}-poster.jpg",
               "uploadDate": "2026-11-04T09:00:00-08:00", "duration": f"PT{int(dur//60)}M{int(dur%60)}S", "contentUrl": f"https://octopisceslabs.com/media/equityfoundry-howto-{k}.mp4"})
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>How-To: Video Walkthroughs | OctoPisces Labs</title>
<meta name="description" content="Step-by-step video walkthroughs for OctoPisces Labs apps. Learn to analyze long-term rentals, short-term rentals, BRRRR deals and fix and flips in EquityFoundry, and to track rental income, expenses and Schedule E totals with Ingot.">
<link rel="canonical" href="https://octopisceslabs.com/how-to/">
<meta property="og:type" content="website"><meta property="og:site_name" content="OctoPisces Labs">
<meta property="og:title" content="How to analyze a rental property in EquityFoundry"><meta property="og:description" content="Every listing tells a story. The numbers tell the truth. Video walkthroughs for long-term rentals, short-term rentals, BRRRR and fix and flips.">
<meta property="og:url" content="https://octopisceslabs.com/how-to/"><meta property="og:image" content="https://octopisceslabs.com/how-to/img/ltr-poster.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Michroma&display=swap">
<script type="application/ld+json">{json.dumps({"@context":"https://schema.org","@graph":ld})}</script>
<style>
:root{{--space:#070A1F;--panel:#10163B;--line:#262D63;--line2:#3A4290;--ink:#ECEBFA;--muted:#A4A7CE;--gold:#F4B23E;--gold2:#FFDB8C;color-scheme:dark;--body:"Figtree",system-ui,sans-serif;--wide:"Michroma","Eurostile",sans-serif}}
*{{box-sizing:border-box}}html{{background:var(--space)}}
body{{margin:0;background:var(--space);color:var(--ink);font:400 17px/1.6 var(--body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
a{{color:var(--gold)}}a:focus-visible,button:focus-visible{{outline:2px solid var(--gold);outline-offset:2px}}
.top,.foot,main{{max-width:68rem;margin:0 auto}}
.top{{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding-block:1rem 2rem}}
.brand{{display:flex;align-items:center;gap:.6rem;text-decoration:none;color:var(--ink);font-family:var(--wide);font-size:.78rem;letter-spacing:.12em}}.brand img{{width:36px;height:36px;border-radius:50%}}
.top nav{{display:flex;gap:1.1rem;flex-wrap:wrap}}.top nav a{{color:var(--muted);text-decoration:none;font-weight:600;font-size:.95rem}}.top nav a:hover,.top nav a[aria-current]{{color:var(--ink)}}
h1,h2,h3{{line-height:1.15;text-wrap:balance}}
h1{{font-family:var(--wide);font-weight:400;font-size:clamp(1.6rem,4.6vw,2.6rem);letter-spacing:.02em;color:var(--gold);margin:0 0 .5rem}}
h2{{font-size:1.6rem;margin:0 0 .4rem}}
.lede{{font-size:1.15rem;max-width:46rem;margin:0 0 2.4rem}}
.app{{border-top:1px solid var(--line);padding-top:2rem;margin-bottom:3rem}}
.app-head{{display:flex;align-items:center;gap:.8rem;margin-bottom:.4rem}}.app-head img{{width:40px;height:40px}}
.sub{{color:var(--muted);margin:0 0 1.2rem;max-width:46rem}}
.player{{display:grid;grid-template-columns:minmax(0,1fr) 17rem;gap:18px;align-items:start}}
video{{width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;border:1px solid var(--line)}}
.chapters{{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:.6rem;margin:0;list-style:none}}
.tabs{{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 1.4rem}}
.tabs button{{background:var(--panel);border:1px solid var(--line2);color:var(--muted);border-radius:9px;padding:.6rem 1rem;font:600 .95rem var(--body);cursor:pointer}}
.tabs button small{{font-weight:500;opacity:.75;margin-left:.3rem}}
.tabs button[aria-selected=true]{{background:var(--gold);border-color:var(--gold);color:#1A1203}}
.ph{{font-size:1.25rem;margin:0 0 .3rem}}
.chapters h4{{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:.3rem .5rem .5rem}}
.chapters h3{{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:.3rem .5rem .5rem}}
.chapters button{{all:unset;cursor:pointer;display:flex;gap:.7rem;width:100%;box-sizing:border-box;padding:.38rem .5rem;border-radius:7px;font-size:.93rem}}
.chapters button span{{color:var(--gold);font-variant-numeric:tabular-nums;min-width:2.4rem}}
.chapters button:hover,.chapters button.on{{background:var(--line)}}
.steps{{list-style:none;padding:0;margin:2.4rem 0 0;display:grid;gap:28px}}
.step{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:24px;align-items:center}}
.step img{{width:100%;height:auto;border-radius:10px;border:1px solid var(--line)}}
.num{{font-family:var(--wide);color:var(--gold);font-size:.85rem;letter-spacing:.1em}}
.step h3{{font-size:1.3rem;margin:.3rem 0 .4rem}}.step p{{margin:0 0 .7rem;color:var(--ink)}}
.jump{{background:none;border:1px solid var(--line2);color:var(--muted);border-radius:7px;padding:.35rem .7rem;font:600 .85rem var(--body);cursor:pointer}}.jump:hover{{color:var(--ink);border-color:var(--gold)}}
.cta{{display:flex;gap:12px;flex-wrap:wrap;margin:2.2rem 0 0}}
.btn{{display:inline-block;background:var(--gold);color:#1A1203;font-weight:700;text-decoration:none;border-radius:9px;padding:.85rem 1.3rem}}.btn.ghost{{background:none;color:var(--ink);border:1px solid var(--line2)}}
.soon{{background:var(--panel);border:1px dashed var(--line2);border-radius:12px;padding:1.2rem 1.4rem;color:var(--muted)}}
.foot{{border-top:1px solid var(--line);margin-top:3rem;padding-block:1.4rem 2.4rem;color:var(--muted);font-size:.9rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}}.foot nav{{display:flex;gap:1rem}}.foot a{{color:var(--muted)}}
@media (max-width:860px){{.player{{grid-template-columns:1fr}}.step{{grid-template-columns:1fr;gap:12px}}.step img{{order:-1}}}}
</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/"><img src="/img/logo-mark-128.png" alt="" width="36" height="36">OCTOPISCES LABS</a>
  <nav aria-label="Main"><a href="/">Studio</a><a href="/next-set/">Next Set</a><a href="/rental-calc/">EquityFoundry</a><a href="/how-to/" aria-current="page">How-To</a></nav>
</header>
<main>
  <h1>How-To</h1>
  <p class="lede">Every app here is meant to feel obvious after a few minutes. Watch the walkthrough, or read the steps beneath it at your own pace.</p>

  <section class="app" id="equityfoundry" aria-labelledby="ef-h">
    <div class="app-head"><img src="/rental-calc/icons/brand-mark-128.png" alt="" width="40" height="40"><h2 id="ef-h">EquityFoundry</h2></div>
    <p class="sub">Every listing tells a story. The numbers tell the truth. Pick the kind of deal you are weighing and follow along. Already own rentals? The Income &amp; expenses walkthrough covers Ingot.</p>
    <div class="tabs" role="tablist" aria-label="EquityFoundry walkthroughs">{"".join(tabs)}</div>
    {"".join(panels)}
    <div class="cta"><a class="btn" href="/rental-calc/">Run your first deal free</a><a class="btn ghost" href="/brrrr-calculator/">Read the BRRRR guide</a></div>
  </section>

  <section class="app" id="next-set" aria-labelledby="ns-h">
    <div class="app-head"><h2 id="ns-h">Next Set</h2></div>
    <p class="soon">The Next Set walkthrough arrives with the app. Until then, <a href="/next-set/">see what it does</a>.</p>
  </section>
</main>
<footer class="foot">
  <span>&copy; 2026 OctoPisces Labs LLC</span>
  <nav aria-label="Legal"><a href="/privacy.html">Privacy</a><a href="/#contact">Contact</a></nav>
</footer>
<script>
(function(){{var tabs=[].slice.call(document.querySelectorAll('[role=tab]'));
function show(k,focus){{tabs.forEach(function(t){{var on=t.dataset.k===k;t.setAttribute('aria-selected',on);document.getElementById('panel-'+t.dataset.k).hidden=!on;if(!on){{var v=document.getElementById('video-'+t.dataset.k);v.pause();}}}});if(focus)history.replaceState(null,'','#'+k);}}
tabs.forEach(function(t){{t.addEventListener('click',function(){{show(t.dataset.k,true);}});}});
var h=location.hash.slice(1);if(document.getElementById('panel-'+h))show(h,false);
document.querySelectorAll('.jump').forEach(function(b){{b.addEventListener('click',function(){{var v=document.getElementById('video-'+b.dataset.v);v.currentTime=parseFloat(b.dataset.t);v.play();v.scrollIntoView({{behavior:'smooth',block:'center'}});}});}});
document.querySelectorAll('video').forEach(function(v){{var k=v.id.slice(6);var btns=[].slice.call(document.querySelectorAll('.chapters[data-v="'+k+'"] .jump'));
v.addEventListener('timeupdate',function(){{var t=v.currentTime,on=-1;btns.forEach(function(b,i){{if(parseFloat(b.dataset.t)<=t)on=i;}});btns.forEach(function(b,i){{b.classList.toggle('on',i===on);}});}});}});}})();
</script>
</body>
</html>
'''
open(os.path.join(OUT, 'index.html'), 'w').write(page); print('wrote how-to with', len(panels), 'videos')
