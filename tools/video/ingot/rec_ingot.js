// Desktop 1080p walkthrough: screenshot sequence with a drawn cursor, timed per scene to voice durations.
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2]; const DURS = JSON.parse(fs.readFileSync(process.argv[3]));
const PAD = 0.8, FPS = 24;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1.6 });
  await ctx.addInitScript(() => { try { localStorage.setItem('rental-calc:launch-hidden', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  fs.rmSync(OUT + '/seq', { recursive: true, force: true }); fs.mkdirSync(OUT + '/seq', { recursive: true });
  const list = []; let n = 0, sceneStart = 0, si = 0; const scenes = [];
  const used = () => list.reduce((a, x) => a + x[1], 0);
  async function shot(hold) { const f = `${OUT}/seq/${String(n++).padStart(5, '0')}.png`; await p.screenshot({ path: f }); list.push([f, hold]); }
  async function endScene() { const target = Math.max(sceneStart + DURS[si] + PAD, used()); const extra = target - used(); if (extra > 0) list[list.length - 1][1] += extra; scenes.push([`s${si + 1}`, sceneStart, target]); sceneStart = target; si++; }
  async function hold(sec) { await shot(sec); }
  // cursor
  let cx = 1100, cy = 600;
  async function cursorInit() {
    await p.addStyleTag({ content: `#vc-cur{position:fixed;z-index:99999;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
      #vc-ring{position:fixed;z-index:99998;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f4c45c;pointer-events:none;opacity:0;transition:none}
      .vc-hl{outline:3px solid #f4c45c !important;outline-offset:3px;border-radius:8px}` });
    await p.evaluate(() => { const c = document.createElement('div'); c.id = 'vc-cur'; c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'; document.body.appendChild(c); const r = document.createElement('div'); r.id = 'vc-ring'; document.body.appendChild(r); });
    await setCur(cx, cy);
  }
  async function setCur(x, y) { await p.evaluate(([x, y]) => { const c = document.getElementById('vc-cur'); c.style.left = x + 'px'; c.style.top = y + 'px'; }, [x, y]); }
  async function center(sel) { return p.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [r.left + Math.min(r.width / 2, 60), r.top + r.height / 2]; }, sel); }
  async function moveTo(sel, frames = 12) {
    const [tx, ty] = await center(sel);
    for (let i = 1; i <= frames; i++) { const t = i / frames, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await setCur(cx + (tx - cx) * e, cy + (ty - cy) * e); await shot(1 / FPS); }
    cx = tx; cy = ty;
  }
  async function ring() { for (let i = 0; i < 6; i++) { await p.evaluate(([x, y, k]) => { const r = document.getElementById('vc-ring'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = String(1 - k / 6); r.style.transform = `scale(${0.6 + k * 0.12})`; }, [cx, cy, i]); await shot(1 / FPS); } await p.evaluate(() => { document.getElementById('vc-ring').style.opacity = '0'; }); }
  async function click(sel, frames) { await moveTo(sel, frames); await p.click(sel); await p.waitForTimeout(150); await ring(); }
  async function scrollTo(sel, offset = 90, steps = 14) {
    const y = await p.evaluate(([s, o]) => { const e = document.querySelector(s); return e.getBoundingClientRect().top + scrollY - o; }, [sel, offset]); const y0 = await p.evaluate(() => scrollY);
    for (let i = 1; i <= steps; i++) { const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.evaluate((v) => window.scrollTo(0, v), y0 + (y - y0) * e); await shot(1 / FPS); }
  }
  async function typeIn(sel, val, fr = 10) {
    await moveTo(sel, fr); const el = p.locator(sel).first(); await el.click({ clickCount: 3 }); await el.fill(''); await ring();
    for (const ch of String(val)) { await el.type(ch); await shot(0.06); }
    await el.dispatchEvent('change'); await p.waitForTimeout(120); await shot(0.3);
  }
  async function hl(sel, on) { await p.evaluate(([s, on]) => { document.querySelectorAll(s).forEach((e) => e.classList.toggle('vc-hl', on)); }, [sel, on]); }

  await p.goto('http://localhost:8790/'); await p.waitForTimeout(1200);
  await p.evaluate(() => { window.Pro._setForTesting(true); const b = document.getElementById('launch-banner'); if (b) b.hidden = true; document.querySelectorAll('.notify-banner,[class*=notify]').forEach(e => { if (e.closest('header')) return; if (e.textContent.includes('in the works')) e.hidden = true; }); });
  const D = 'dialog[open]';
  async function pick(sel, value) { await moveTo(sel, 10); await p.selectOption(sel, value); await p.locator(sel).dispatchEvent('change'); await ring(); await shot(0.4); }
  async function submit() { await click(`${D} button[type=submit]`, 12); await p.waitForTimeout(500); await shot(0.6); }
  const log = async (tag) => console.log(tag, await p.evaluate(() => [...document.querySelectorAll('#view-ingot .tile, #view-ingot .tiles > *')].map((e) => e.innerText.replace(/\s+/g, ' ')).join(' | ')));

  await p.goto('http://localhost:8790/?stats=off'); await p.waitForTimeout(800);
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/seed.js', 'utf8') });
  await p.evaluate(() => { window.__seedIngot(); localStorage.setItem('ingot:ui', JSON.stringify({ period: 'month' })); });
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => { window.Pro._setForTesting(true); const b = document.getElementById('launch-banner'); if (b) b.hidden = true; });
  await cursorInit();

  // s1 intro: calculator screen, Ingot tab highlighted
  await hl('[data-view=ingot]', true); await moveTo('[data-view=ingot]', 16); await hold(1.5); await endScene();
  // s2 open Ingot
  await hl('[data-view=ingot]', false); await click('[data-view=ingot]', 8); await p.waitForTimeout(600); await hold(1.2); await endScene();
  // s3 add a property
  await click('[data-tab=properties]', 14); await p.waitForTimeout(500); await hold(0.8);
  await click('[data-act=add-property]', 14); await p.waitForTimeout(400); await shot(0.5);
  await typeIn(`${D} input[name=name]`, 'Pine Ct Condo'); await typeIn(`${D} input[name=address]`, '7 Pine Ct, Carson City, NV');
  await typeIn(`${D} input[name=units]`, 1); await typeIn(`${D} input[name=occupied]`, 0); await typeIn(`${D} input[name=expectedRent]`, 1600); await typeIn(`${D} input[name=purchasePrice]`, 229000);
  await moveTo(`${D} input[name=purchaseDate]`, 8); await p.fill(`${D} input[name=purchaseDate]`, '2026-11-02'); await shot(0.6);
  await submit(); await hold(1.2); console.log('PROPS', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('ingot:v1')).properties.map((x) => [x.name, x.occupied, x.purchaseDate, x.expectedRent])))); await endScene();
  // s4 quick add: rent
  await click('[data-tab=dash]', 14); await p.waitForTimeout(500); await hold(0.5);
  await click('[data-act=quick-add]', 12); await p.waitForTimeout(400); await shot(0.5);
  for (const t of ['expense', 'distribution', 'transfer', 'income']) { await moveTo(`${D} [data-type=${t}]`, 8); await p.click(`${D} [data-type=${t}]`); await p.waitForTimeout(150); await shot(0.9); }
  await typeIn(`${D} input[name=amount]`, 1400);
  await moveTo(`${D} input[name=date]`, 8); await p.fill(`${D} input[name=date]`, '2026-11-01'); await shot(0.4);
  await pick(`${D} select[name=propertyId]`, { label: 'Maple Duplex' }); await pick(`${D} select[name=category]`, 'Rent');
  await typeIn(`${D} input[name=memo]`, 'Unit A, November'); await submit(); await hold(1); await endScene();
  // s5 expense: mortgage with principal split
  await click('[data-act=quick-add]', 12); await p.waitForTimeout(400); await click(`${D} [data-type=expense]`, 8); await shot(0.4);
  await typeIn(`${D} input[name=amount]`, 1150); await moveTo(`${D} input[name=date]`, 6); await p.fill(`${D} input[name=date]`, '2026-11-05'); await shot(0.3);
  await pick(`${D} select[name=propertyId]`, { label: 'Maple Duplex' }); await pick(`${D} select[name=category]`, 'Mortgage interest paid to banks');
  await typeIn(`${D} input[name=principal]`, 420); await hl(`${D} .ig-principal-hint`, true); await hold(2.5); await hl(`${D} .ig-principal-hint`, false);
  await submit(); await hold(1); await endScene();
  // s6 receipt photo
  await click('[data-act=quick-add]', 12); await p.waitForTimeout(400); await click(`${D} [data-type=expense]`, 8);
  await typeIn(`${D} input[name=amount]`, 167.80); await moveTo(`${D} input[name=date]`, 6); await p.fill(`${D} input[name=date]`, '2026-11-06'); await shot(0.3);
  await pick(`${D} select[name=propertyId]`, { label: 'Elm St House' }); await pick(`${D} select[name=category]`, 'Repairs');
  await typeIn(`${D} input[name=memo]`, 'Garbage disposal');
  await moveTo(`${D} input[name=receipt]`, 10); await p.setInputFiles(`${D} input[name=receipt]`, __dirname + '/receipt.jpg'); await ring(); await shot(1.2);
  await submit(); await hold(1); await endScene();
  // s7 dashboard year to date
  await click('[data-period=ytd]', 14); await p.waitForTimeout(500); await log('YTD'); await hold(1);
  await hl('#view-ingot .tiles', true); await hold(3); await hl('#view-ingot .tiles', false);
  await scrollTo('.ig-panels', 90, 16); await hold(3); await scrollTo('.ig-panels + .ig-panel, .ig-panel:last-of-type', 90, 14); await hold(3); await endScene();
  // s8 month view
  await scrollTo('body', 0, 12); await click('[data-tab=month]', 14); await p.waitForTimeout(500); await hold(1.5);
  await click('[data-act=month-prev]', 10); await p.waitForTimeout(400); await hold(1.2); await click('[data-act=month-next]', 10); await p.waitForTimeout(400); await hold(1);
  await scrollTo('.ig-entries', 140, 12); await moveTo('.ig-entries [data-act=receipt], .ig-entries [data-act=edit-entry]', 12); await hold(2); await endScene();
  // s9 taxes
  await scrollTo('body', 0, 10); await click('[data-tab=taxes]', 14); await p.waitForTimeout(500); await hold(1.5);
  await scrollTo('.ig-table', 100, 12); await hold(2.5); await scrollTo('[data-act=tax-csv]', 300, 16); await moveTo('[data-act=tax-csv]', 12); await hold(1.2); await moveTo('[data-act=tax-pdf]', 8); await hold(1.2); await endScene();
  // s10 maintenance log
  await scrollTo('body', 0, 10); await click('[data-tab=log]', 14); await p.waitForTimeout(500); await hold(1.5);
  await click('[data-act=add-maint]', 12); await p.waitForTimeout(400); await shot(0.4);
  await pick(`${D} select[name=propertyId]`, { label: 'Elm St House' }); await moveTo(`${D} input[name=date]`, 6); await p.fill(`${D} input[name=date]`, '2026-11-06'); await shot(0.3);
  await typeIn(`${D} input[name=vendor]`, 'Sierra Hardware'); await typeIn(`${D} input[name=cost]`, 167.80);
  await typeIn(`${D} input[name=notes]`, 'Replaced garbage disposal, 1/2 HP');
  await moveTo(`${D} input[name=asExpense]`, 8); await p.uncheck(`${D} input[name=asExpense]`); await ring(); await shot(0.8);
  await submit(); await hold(1.2); await endScene();
  // s11 import
  await click('[data-tab=import]', 14); await p.waitForTimeout(500); await hold(2.5); await endScene();
  // s12 free vs pro / wrap: back to dashboard
  await click('[data-tab=dash]', 14); await p.waitForTimeout(500); await hold(1.5); await endScene();
  // s13 end card
  await hold(1); await endScene();
  fs.writeFileSync(OUT + '/seq.json', JSON.stringify({ list, scenes }));
  console.log('total', used().toFixed(1)); await b.close();
})();
