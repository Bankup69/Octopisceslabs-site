// Desktop 1080p walkthrough: screenshot sequence with a drawn cursor, timed per scene to voice durations.
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2]; const DURS = JSON.parse(fs.readFileSync(process.argv[3])); const VID = process.argv[4];
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
  await p.addStyleTag({ content: '.toast,#toast,[class*=toast]{display:none!important}' });
  // seed two saved deals off camera
  async function quickDeal(name, price, rent, units) {
    await p.click('#btn-new'); await p.waitForTimeout(200);
    await p.fill('input[name=propertyName]', name); await p.fill('input[name=purchasePrice]', String(price));
    await p.fill('#units [data-k=rent]', String(rent)); if (units) await p.fill('#units [data-k=count]', String(units)).catch(() => {});
    await p.fill('input[name=downPaymentPct]', '25'); await p.fill('input[name=interestRate]', '6.75');
    await p.fill('input[name=propertyTaxes]', String(Math.round(price * 0.01))); await p.fill('input[name=insurance]', '1400');
    await p.locator('input[name=insurance]').dispatchEvent('change'); await p.waitForTimeout(200);
    await p.click('#btn-save'); await p.waitForTimeout(400);
  }
  await quickDeal('Elm St Single Family', 215000, 1650, 1);
  await quickDeal('Oak Ave Triplex', 340000, 1150, 3);
  await p.click('#btn-new'); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  // hide any toasts
  await p.addStyleTag({ content: '.toast{display:none!important}' });
  await cursorInit();


  async function tilesHl(names, secs) { for (const [name, sec] of names) { const idx = await p.$$eval('#tiles > *', (els, nm) => els.findIndex((e) => e.textContent.includes(nm)), name); if (idx < 0) { console.log('no tile', name); continue; } const sel = `#tiles > :nth-child(${idx + 1})`; await moveTo(sel, 12); await hl(sel, true); await hold(sec); await hl(sel, false); } }
  async function heroHl(sec) { await scrollTo('.results', 90, 12); await moveTo('#hero-value', 14); await hl('#hero', true); await hold(sec); await hl('#hero', false); }
  async function breakdown(summaryText) {
    await p.evaluate(() => { document.querySelector('.results').style.position = 'static'; });
    if (summaryText) { const sel = await p.evaluate((t) => { const s = [...document.querySelectorAll('#tables summary')].findIndex((e) => e.textContent.includes(t)); return s; }, summaryText);
      const ssel = `#tables details:nth-of-type(${sel + 1}) > summary`; await scrollTo('#tables', 80, 14);
      const open = await p.evaluate((i) => document.querySelectorAll('#tables details')[i].open, sel); if (!open) { await click(ssel, 10); await p.waitForTimeout(300); } await hold(1);
      await p.evaluate((i) => { const d = document.querySelectorAll('#tables details'); d[i].scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }, sel); await shot(0.8);
      await scrollTo(`#tables details:nth-of-type(${sel + 1})`, -150, 24); }
    else { await scrollTo('#tables', 80, 18); await hold(1); await scrollTo('#tables', -280, 30); }
    await hold(1); await endScene(); await p.evaluate(() => { document.querySelector('.results').style.position = ''; }); }
  async function saveDash() { await scrollTo('body', 0, 16); await click('#btn-save', 12); await p.waitForTimeout(500); await hold(0.8); await click('[data-view=dash]', 14); await p.waitForTimeout(700); await hold(1.5); await endScene(); }
  async function fillAll(pairs) { for (const [f, v] of pairs) await typeIn(`input[name=${f}]`, v); }
  async function pickStrategy(k) { await moveTo(`[data-strategy=${k}]`, 16); await p.click(`[data-strategy=${k}]`); await p.waitForTimeout(250); await ring(); await hold(1.2); await endScene(); }
  async function nameIt(n, link) { if (link) { await click('input[name=listingUrl]', 12); const l = p.locator('input[name=listingUrl]'); await l.fill(link); await l.dispatchEvent('input'); await l.dispatchEvent('change'); await p.waitForTimeout(400); await shot(0.8); } await typeIn('input[name=propertyName]', n); }

  if (VID === 'ltr') {
  // s1 intro
  await hold(1); await endScene();
  // s2 strategy
  await moveTo('[data-strategy=str]', 14); await hold(0.6); await moveTo('[data-strategy=brrrr]', 10); await hold(0.6); await moveTo('[data-strategy=flip]', 10); await hold(0.6);
  await click('[data-strategy=rental]', 14); await hold(1); await endScene();
  // s3 property
  await click('input[name=listingUrl]', 12);
  const link = p.locator('input[name=listingUrl]'); await link.fill('https://www.zillow.com/homedetails/418-Maple-St-Reno-NV-89501/'); await link.dispatchEvent('input'); await link.dispatchEvent('change'); await p.waitForTimeout(400); await shot(1.2);
  await typeIn('input[name=propertyName]', 'Maple St Duplex'); await hold(1); await endScene();
  // s4 purchase + help
  await scrollTo('input[name=purchasePrice]', 260);
  await typeIn('input[name=purchasePrice]', 285000); await typeIn('input[name=repairsUpfront]', 6000); await typeIn('input[name=closingCosts]', 7500);
  const helpSel = 'label:has(input[name=closingCosts]) .help-btn';
  if (await p.locator(helpSel).count()) { await click(helpSel, 12); await hold(4); await click(helpSel, 8); await p.waitForTimeout(200); await shot(0.3); }
  await endScene();
  // s5 rent
  await scrollTo('#units', 200);
  await typeIn('#units [data-k=label]', 'Each side').catch(() => {});
  await typeIn('#units [data-k=count]', 2).catch(() => {}); await typeIn('#units [data-k=rent]', 1250);
  await moveTo('input[name=vacancyRate]', 12).catch(() => {}); await hl('label:has(input[name=vacancyRate])', true); await hold(1.5); await hl('label:has(input[name=vacancyRate])', false); await endScene();
  // s6 financing
  await scrollTo('input[name=downPaymentPct]', 200); await typeIn('input[name=downPaymentPct]', 25); await typeIn('input[name=interestRate]', 6.75); await moveTo('input[name=loanYears]', 10).catch(() => {}); await hold(0.5); await endScene();
  // s7 expenses
  await scrollTo('input[name=propertyTaxes]', 200); await typeIn('input[name=propertyTaxes]', 3100); await typeIn('input[name=insurance]', 1650);
  await hl('label:has(input[name=maintenancePct]), label:has(input[name=capexPct])', true); await moveTo('input[name=capexPct]', 12); await hold(2.2); await hl('label:has(input[name=maintenancePct]), label:has(input[name=capexPct])', false);
  await typeIn('input[name=mgmtPct]', 8); await hold(0.8); await endScene();
  // s8 results
  await scrollTo('.results', 90, 14);
  await moveTo('#hero-value', 16); await hl('#hero', true); await hold(4.5); await hl('#hero', false);
  const tiles = await p.$$eval('#tiles > *', (els) => els.length);
  const order = ['Cash-on-cash', 'Cap rate', 'DSCR', '1%'];
  for (const name of order) { const idx = await p.$$eval('#tiles > *', (els, nm) => els.findIndex((e) => e.textContent.includes(nm)), name); if (idx < 0) continue; const sel = `#tiles > :nth-child(${idx + 1})`; await moveTo(sel, 12); await hl(sel, true); await hold(name === '1%' ? 2.4 : 3.4); await hl(sel, false); }
  await endScene();
  // s9 breakdown
  await p.evaluate(() => { const r = document.querySelector('.results'); r.style.position = 'static'; });
  await scrollTo('#tables', 80, 18); await hold(1.2); await scrollTo('#tables', -280, 30); await hold(1.2); await endScene();
  await p.evaluate(() => { document.querySelector('.results').style.position = ''; });
  // s10 adjust price
  await scrollTo('input[name=purchasePrice]', 260, 18); await typeIn('input[name=purchasePrice]', 265000, 14); await scrollTo('.results', 90, 12); await moveTo('#hero-value', 14); await hl('#hero', true); await hold(1.6); await hl('#hero', false); await endScene();
  // s11 pro: projection, strategies, pdf
  await p.evaluate(() => { document.querySelector('.results').style.position = 'static'; });
  await scrollTo('#projection-box', 90, 18); await click('#projection-box > summary', 12); await p.waitForTimeout(500); await hold(1.5);
  await scrollTo('#projection-box', -40, 20); await hold(3.0);
  await p.evaluate(() => { document.querySelector('.results').style.position = ''; });
  await scrollTo('body', 0, 18); await moveTo('[data-strategy=brrrr]', 12); await hold(0.6); await moveTo('#btn-report', 14); await hl('#btn-report', true); await hold(1.6); await hl('#btn-report', false); await endScene();
  // s12 save + dashboard
  await click('#btn-save', 12); await p.waitForTimeout(500); await hold(0.8);
  await click('[data-view=dash]', 14); await p.waitForTimeout(700); await hold(1.2);
  await moveTo('#sort', 12); await p.selectOption('#sort', 'cashflow'); await ring(); await hold(1.5); await endScene();
  // s13 outro
  await hold(1); await endScene();

  } else if (VID === 'str') {
    await hold(1); await endScene();
    await pickStrategy('str');
    await nameIt('Lakeview Cabin', 'https://www.zillow.com/homedetails/27-Lakeview-Dr-South-Lake-Tahoe-CA-96150/');
    await scrollTo('input[name=purchasePrice]', 260); await fillAll([['purchasePrice', 350000], ['closingCosts', 10500]]);
    await hl('label:has(input[name=furnishing])', true); await typeIn('input[name=furnishing]', 20000); await hold(0.8); await hl('label:has(input[name=furnishing])', false); await endScene();
    await scrollTo('input[name=nightlyRate]', 220); await fillAll([['nightlyRate', 185], ['occupancy', 62], ['avgStay', 3], ['cleaningFeeCharged', 95], ['cleaningCost', 85], ['platformFeePct', 3]]); await hold(0.6); await endScene();
    await scrollTo('input[name=downPaymentPct]', 220); await fillAll([['downPaymentPct', 25], ['interestRate', 7.2]]);
    await scrollTo('input[name=propertyTaxes]', 220); await fillAll([['propertyTaxes', 3200], ['insurance', 2400], ['utilities', 4200]]);
    await scrollTo('input[name=strSupplies]', 260, 16); await typeIn('input[name=strSupplies]', 120); await hold(0.5); await endScene();
    await heroHl(3.5); await tilesHl([['Cash-on-cash', 3.2], ['Revenue per night', 3.4]]); await endScene();
    await scrollTo('input[name=occupancy]', 260, 16); await typeIn('input[name=occupancy]', 52, 14); await heroHl(2.0); await endScene();
    await breakdown(null);
    await saveDash();
  } else if (VID === 'brrrr') {
    await hold(1); await endScene();
    await pickStrategy('brrrr');
    await nameIt('Cedar St Fixer'); await scrollTo('input[name=purchasePrice]', 260); await fillAll([['purchasePrice', 150000], ['repairsUpfront', 45000], ['closingCosts', 4500]]); await hold(0.4); await endScene();
    await scrollTo('input[name=arv]', 220); await hl('label:has(input[name=arv])', true); await typeIn('input[name=arv]', 260000); await hold(0.6); await hl('label:has(input[name=arv])', false);
    await fillAll([['rehabMonths', 6], ['refiLtv', 75], ['refiRate', 7.2], ['refiYears', 30], ['refiClosingCosts', 5000]]); await hold(0.5); await endScene();
    await scrollTo('#units', 200); await typeIn('#units [data-k=rent]', 2100);
    await scrollTo('input[name=downPaymentPct]', 220); await fillAll([['downPaymentPct', 20], ['interestRate', 11]]); await hold(0.5); await endScene();
    await scrollTo('input[name=propertyTaxes]', 220); await fillAll([['propertyTaxes', 2200], ['insurance', 1300]]);
    await hl('label:has(input[name=maintenancePct]), label:has(input[name=capexPct])', true); await moveTo('input[name=capexPct]', 12); await hold(1.4); await hl('label:has(input[name=maintenancePct]), label:has(input[name=capexPct])', false); await endScene();
    await heroHl(2.8); await tilesHl([['Cash left in deal', 4.2], ['Equity after refi', 3.6]]); await endScene();
    await breakdown('Buy, rehab');
    await saveDash();
  } else if (VID === 'flip') {
    await hold(1); await endScene();
    await pickStrategy('flip');
    await nameIt('Birch Ln Flip'); await scrollTo('input[name=purchasePrice]', 260); await fillAll([['purchasePrice', 180000], ['repairsUpfront', 40000], ['closingCosts', 5400]]); await hold(0.4); await endScene();
    await scrollTo('input[name=arv]', 220); await hl('label:has(input[name=arv])', true); await typeIn('input[name=arv]', 285000); await hold(0.6); await hl('label:has(input[name=arv])', false);
    await fillAll([['holdMonths', 6], ['sellingCostPct', 7]]); await hold(0.5); await endScene();
    await scrollTo('input[name=downPaymentPct]', 220); await fillAll([['downPaymentPct', 10], ['interestRate', 10]]);
    await scrollTo('input[name=propertyTaxes]', 220); await fillAll([['propertyTaxes', 2000], ['insurance', 1200], ['utilities', 1800]]); await hold(0.4); await endScene();
    await heroHl(3.4); await tilesHl([['ROI', 2.2], ['Annualized ROI', 3.4], ['70% rule', 5.5]]); await endScene();
    await scrollTo('input[name=purchasePrice]', 260, 16); await typeIn('input[name=purchasePrice]', 160000, 14); await heroHl(2.2); await endScene();
    await breakdown('Flip breakdown');
    await saveDash();
  }
  fs.writeFileSync(OUT + '/seq.json', JSON.stringify({ list, scenes }));
  console.log(JSON.stringify({ frames: list.length, total: used().toFixed(1), scenes: scenes.map(s => [s[0], +s[1].toFixed(1), +s[2].toFixed(1)]) }));
  await b.close();
})();
