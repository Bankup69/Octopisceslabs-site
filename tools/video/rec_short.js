// Vertical 1080x1920 short: screenshot sequence timed to voice durations. Usage: node rec_short.js <outdir> <durs.json> <str|brrrr|flip>
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2]; const DURS = JSON.parse(fs.readFileSync(process.argv[3])); const KEY = process.argv[4]; const PAD = 0.5;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('rental-calc:launch-hidden', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  fs.rmSync(OUT + '/seq', { recursive: true, force: true }); fs.mkdirSync(OUT + '/seq', { recursive: true });
  const list = []; let n = 0, ss = 0, si = 0; const scenes = [];
  const used = () => list.reduce((a, x) => a + x[1], 0);
  async function shot(h) { const f = `${OUT}/seq/${String(n++).padStart(5, '0')}.png`; await p.screenshot({ path: f }); list.push([f, h]); }
  async function endScene() { const t = Math.max(ss + DURS[si] + PAD, used()); const e = t - used(); if (e > 0) list[list.length - 1][1] += e; scenes.push([`s${si + 1}`, ss, t]); ss = t; si++; }
  async function scrollTo(sel, off = 200, steps = 10) {
    const y = await p.evaluate(([s, o]) => { const e = document.querySelector(s); return e.getBoundingClientRect().top + scrollY - o; }, [sel, off]); const y0 = await p.evaluate(() => scrollY);
    for (let i = 1; i <= steps; i++) { const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.evaluate((v) => window.scrollTo(0, v), y0 + (y - y0) * e); await shot(1 / 24); }
  }
  async function typeIn(sel, val) { const el = p.locator(sel).first(); await el.click({ clickCount: 3 }); await el.fill(''); await shot(0.2); for (const ch of String(val)) { await el.type(ch); await shot(0.07); } await el.dispatchEvent('change'); await p.waitForTimeout(120); await shot(0.3); }
  async function fillAll(pairs, off) { for (const [f, v] of pairs) { await scrollTo(`input[name=${f}]`, off || 260, 6); await typeIn(`input[name=${f}]`, v); } }
  async function hl(sel, on) { await p.evaluate(([s, on]) => document.querySelectorAll(s).forEach((e) => e.classList.toggle('vc-hl', on)), [sel, on]); }
  async function tile(name, sec) { const idx = await p.$$eval('#tiles > *', (els, nm) => els.findIndex((e) => e.textContent.includes(nm)), name); if (idx < 0) return; const sel = `#tiles > :nth-child(${idx + 1})`; await scrollTo(sel, 300, 8); await hl(sel, true); await shot(sec); await hl(sel, false); }
  async function hero(sec) { await scrollTo('#hero', 70, 12); await hl('#hero', true); await shot(sec); await hl('#hero', false); }

  await p.goto('http://localhost:8790/'); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.Pro._setForTesting(true); const b = document.getElementById('launch-banner'); if (b) b.hidden = true; });
  await p.addStyleTag({ content: '.toast,#toast,[class*=toast]{display:none!important} .vc-hl{outline:3px solid #f4c45c !important;outline-offset:3px;border-radius:8px}' });
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await shot(1); await endScene();                                   // s1 hook
  await scrollTo(`[data-strategy=${KEY}]`, 300, 6); await p.click(`[data-strategy=${KEY}]`); await p.waitForTimeout(300); await shot(0.8);
  if (KEY === 'str') {
    await fillAll([['purchasePrice', 350000], ['nightlyRate', 185], ['occupancy', 62], ['cleaningFeeCharged', 95], ['platformFeePct', 3]]); await endScene();
    await fillAll([['downPaymentPct', 25], ['interestRate', 7.2], ['propertyTaxes', 3200], ['insurance', 2400], ['utilities', 4200]]); await endScene();
    await hero(2); await tile('Cash-on-cash', 1.8); await tile('Revenue per night', 1.8); await endScene();
    await fillAll([['occupancy', 52]], 300); await hero(2); await endScene();
  } else if (KEY === 'brrrr') {
    await fillAll([['purchasePrice', 150000], ['repairsUpfront', 45000], ['closingCosts', 4500], ['arv', 260000]]); await endScene();
    await fillAll([['rehabMonths', 6], ['refiLtv', 75], ['refiRate', 7.2], ['refiClosingCosts', 5000]]); await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2100); await fillAll([['downPaymentPct', 20], ['interestRate', 11], ['propertyTaxes', 2200], ['insurance', 1300]]); await endScene();
    await hero(2); await tile('Cash left in deal', 2.4); await tile('Equity after refi', 2.0); await endScene();
    await scrollTo('body', 0, 10); await p.click('#btn-save'); await p.waitForTimeout(500); await shot(1); await p.click('[data-view=dash]'); await p.waitForTimeout(700); await shot(1); await endScene();
  } else {
    await fillAll([['purchasePrice', 180000], ['repairsUpfront', 40000], ['arv', 285000]]); await endScene();
    await fillAll([['holdMonths', 6], ['sellingCostPct', 7], ['downPaymentPct', 10], ['interestRate', 10]]); await endScene();
    await hero(2); await tile('ROI', 1.6); await tile('70% rule', 2.4); await endScene();
    await fillAll([['purchasePrice', 160000]], 300); await hero(2); await endScene();
  }
  fs.writeFileSync(OUT + '/seq.json', JSON.stringify({ list, scenes }));
  console.log(JSON.stringify({ total: used().toFixed(1), scenes: scenes.map(s => [s[0], +s[1].toFixed(1), +s[2].toFixed(1)]) }));
  await b.close();
})();
