// Phone-size Ingot Shorts (432x768 @2.5 = 1080x1920). Usage: node rec_ingot_short.js <dir> <durs.json> <key>
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2]; const DURS = JSON.parse(fs.readFileSync(process.argv[3])); const KEY = process.argv[4];
const PAD = 0.5, FPS = 20;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('rental-calc:launch-hidden', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  fs.rmSync(OUT + '/seq', { recursive: true, force: true }); fs.mkdirSync(OUT + '/seq', { recursive: true });
  const list = []; let n = 0, sceneStart = 0, si = 0; const scenes = [];
  const used = () => list.reduce((a, x) => a + x[1], 0);
  async function shot(h) { const f = `${OUT}/seq/${String(n++).padStart(5, '0')}.png`; await p.screenshot({ path: f }); list.push([f, h]); }
  async function endScene() { const target = Math.max(sceneStart + DURS[si] + PAD, used()); const extra = target - used(); if (extra > 0) list[list.length - 1][1] += extra; scenes.push([`s${si + 1}`, sceneStart, target]); sceneStart = target; si++; }
  async function ringAt(sel) {
    const [x, y] = await p.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    for (let i = 0; i < 6; i++) { await p.evaluate(([x, y, k]) => { let r = document.getElementById('vc-ring'); if (!r) { r = document.createElement('div'); r.id = 'vc-ring'; document.body.appendChild(r); } r.style.cssText = `position:fixed;z-index:99999;left:${x}px;top:${y}px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #f4c45c;pointer-events:none;opacity:${1 - k / 6};transform:scale(${0.6 + k * 0.12})`; }, [x, y, i]); await shot(1 / FPS); }
    await p.evaluate(() => { const r = document.getElementById('vc-ring'); if (r) r.style.opacity = '0'; });
  }
  async function tap(sel) { await p.locator(sel).first().scrollIntoViewIfNeeded(); await ringAt(sel); await p.click(sel); await p.waitForTimeout(350); await shot(0.3); }
  async function typeIn(sel, val) { await ringAt(sel); const el = p.locator(sel).first(); await el.fill(''); for (const ch of String(val)) { await el.type(ch); await shot(0.05); } await el.dispatchEvent('change'); await shot(0.3); }
  async function pick(sel, v) { await ringAt(sel); await p.selectOption(sel, v); await p.locator(sel).dispatchEvent('change'); await shot(0.4); }
  async function scrollTo(sel, off = 80, steps = 14) {
    const y = await p.evaluate(([s, o]) => { const e = document.querySelector(s); return e.getBoundingClientRect().top + scrollY - o; }, [sel, off]); const y0 = await p.evaluate(() => scrollY);
    for (let i = 1; i <= steps; i++) { const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.evaluate((v) => window.scrollTo(0, v), y0 + (y - y0) * e); await shot(1 / FPS); }
  }
  async function hl(sel, on) { await p.evaluate(([s, on]) => { document.querySelectorAll(s).forEach((e) => { e.style.outline = on ? '3px solid #f4c45c' : ''; e.style.outlineOffset = on ? '3px' : ''; e.style.borderRadius = on ? '8px' : ''; }); }, [sel, on]); }
  const D = 'dialog[open]';
  const logTiles = async (tag) => console.log(tag, await p.evaluate(() => [...document.querySelectorAll('#view-ingot .tiles > *')].map((e) => e.innerText.replace(/\s+/g, ' ')).join(' | ')));

  await p.goto('http://localhost:8790/?stats=off'); await p.waitForTimeout(800);
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/seed.js', 'utf8') });
  await p.evaluate(() => { window.__seedIngot({ throughMonth: 11 }); localStorage.setItem('ingot:ui', JSON.stringify({ period: 'ytd' })); });
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => { window.Pro._setForTesting(true); const b = document.getElementById('launch-banner'); if (b) b.hidden = true; });
  await p.click('[data-view=ingot]'); await p.waitForTimeout(600);

  if (KEY.startsWith('ingot_tax')) {
    await shot(1); await endScene();                                                     // s1 hook on dashboard
    await tap('[data-tab=month]'); await p.click('[data-act=month-prev]'); await p.waitForTimeout(300); await shot(0.5);
    await scrollTo('.ig-entries', 120, 14); await shot(1.5); await endScene();            // s2 entries with categories
    await scrollTo('body', 0, 8); await tap('[data-tab=taxes]'); await p.waitForTimeout(500); await shot(1); await endScene(); // s3 taxes
    await scrollTo('.ig-tax', 90, 16); await shot(1.2); await scrollTo('.ig-tax tr.total', 300, 22); await shot(1.2); await endScene(); // s4 lines
    await scrollTo('.ig-exports', 380, 14); await hl('[data-act=tax-csv],[data-act=tax-pdf]', true); await shot(1.5); await hl('[data-act=tax-csv],[data-act=tax-pdf]', false); await endScene(); // s5 downloads
    await scrollTo('body', 0, 10); await tap('[data-tab=dash]'); await shot(1); await endScene(); // s6 wrap
  } else if (KEY.startsWith('ingot_receipt')) {
    await shot(1); await endScene();                                                     // s1 hook
    await tap('[data-act=quick-add]'); await tap(`${D} [data-type=expense]`); await shot(0.6); await endScene(); // s2
    await typeIn(`${D} input[name=amount]`, 167.80); await pick(`${D} select[name=propertyId]`, { label: 'Elm St House' }); await pick(`${D} select[name=category]`, 'Repairs');
    await typeIn(`${D} input[name=memo]`, 'Garbage disposal'); await endScene();          // s3
    await ringAt(`${D} input[name=receipt]`); await p.setInputFiles(`${D} input[name=receipt]`, __dirname + '/receipt.jpg'); await shot(1.2);
    await tap(`${D} button[type=submit]`); await shot(1); await endScene();               // s4
    await tap('[data-tab=month]'); await p.waitForTimeout(400); await scrollTo('.ig-entries', 120, 12);
    await hl('.ig-entries [data-act=receipt]', true); await shot(1); await tap('.ig-entries [data-act=receipt]'); await p.waitForTimeout(600); await shot(2); await endScene(); // s5
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); await scrollTo('body', 0, 8); await tap('[data-tab=dash]'); await shot(1); await endScene(); // s6
  } else if (KEY.startsWith('ingot_compare')) {
    await shot(1); await endScene();                                                     // s1 hook
    await tap('[data-period=ytd]'); await hl('#view-ingot .tiles', true); await shot(1.5); await logTiles('YTD'); await endScene(); // s2 tiles
    await hl('#view-ingot .tiles', false); await scrollTo('.ig-panels', 70, 16); await shot(2); await endScene(); // s3 chart
    await p.evaluate(() => { const b = document.querySelector('#view-ingot .ig-h-link[data-tab=properties]'); if (b) b.closest('section').id = 'ig-ptable'; }); const tsel = '#ig-ptable'; await scrollTo(tsel, 70, 16); await shot(0.6);
    console.log('TABLE', await p.evaluate((s) => document.querySelector(s).innerText.replace(/\s+/g, ' '), tsel));
    await p.evaluate((s) => { const t = document.querySelector(s + ' .table-scroll, ' + s + ' table'); if (t && t.scrollWidth > t.clientWidth) t.scrollLeft = 0; }, tsel); await shot(1.5);
    await endScene(); // s4 table: names and net
    await p.evaluate((s) => { const t = document.querySelector(s + ' .table-scroll'); if (t) t.scrollLeft = t.scrollWidth; }, tsel); await hl(tsel, true); await shot(2); await hl(tsel, false); await endScene(); // s5 expected rent
    await scrollTo('body', 0, 10); await shot(1); await endScene();                       // s6 wrap
  }
  fs.writeFileSync(OUT + '/seq.json', JSON.stringify({ list, scenes }));
  console.log('total', used().toFixed(1)); await b.close();
})();
