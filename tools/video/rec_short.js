// Vertical 1080x1920 short: screenshot sequence timed to voice durations. Usage: node rec_short.js <outdir> <durs.json> <str|brrrr|flip>
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2]; const DURS = JSON.parse(fs.readFileSync(process.argv[3])); const KEY = process.argv[4]; const PAD = 0.5; const SM = { onepct:'rental', str_slow:'str', brrrr2:'brrrr', flip2:'flip', flip3:'flip', capcoc:'rental', rate:'rental', hidden:'rental', dscr:'rental', duplex:'rental', strltr:'rental' };
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
  await scrollTo(`[data-strategy=${(SM[KEY] || KEY)}]`, 300, 6); await p.click(`[data-strategy=${(SM[KEY] || KEY)}]`); await p.waitForTimeout(300); await shot(0.8);
  const save = async () => { await scrollTo('body', 0, 10); await p.click('#btn-save'); await p.waitForTimeout(500); await shot(1); await p.click('[data-view=dash]'); await p.waitForTimeout(700); await shot(1.2); await endScene(); };
  if (KEY === 'str') {
    await fillAll([['purchasePrice', 350000], ['closingCosts', 10500], ['furnishing', 20000]]); await endScene();
    await fillAll([['nightlyRate', 185], ['occupancy', 62], ['avgStay', 3], ['cleaningFeeCharged', 95], ['cleaningCost', 85], ['platformFeePct', 3]]); await endScene();
    await fillAll([['downPaymentPct', 25], ['interestRate', 7.2], ['propertyTaxes', 3200], ['insurance', 2400], ['utilities', 4200], ['strSupplies', 120]]); await endScene();
    await hero(2); await tile('Cash-on-cash', 1.8); await tile('Revenue per night', 1.8); await endScene();
    await fillAll([['occupancy', 52]], 300); await hero(2.5); await endScene();
    await save();
  } else if (KEY === 'brrrr') {
    await fillAll([['purchasePrice', 150000], ['repairsUpfront', 45000], ['closingCosts', 4500]]); await endScene();
    await fillAll([['arv', 260000], ['rehabMonths', 6]]); await endScene();
    await fillAll([['refiLtv', 75], ['refiRate', 7.2], ['refiYears', 30], ['refiClosingCosts', 5000]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2100); await fillAll([['downPaymentPct', 20], ['interestRate', 11], ['propertyTaxes', 2200], ['insurance', 1300]]); await endScene();
    await hero(2); await tile('Cash left in deal', 2.4); await tile('Equity after refi', 2.2); await endScene();
    await save();
  } else if (KEY === 'str_slow') {
    await fillAll([['purchasePrice', 300000], ['closingCosts', 9000], ['furnishing', 18000]]); await endScene();
    await fillAll([['nightlyRate', 210], ['occupancy', 65], ['avgStay', 3], ['cleaningFeeCharged', 100], ['cleaningCost', 90], ['platformFeePct', 3]]); await endScene();
    await fillAll([['downPaymentPct', 25], ['interestRate', 7], ['propertyTaxes', 2800], ['insurance', 2200], ['utilities', 4000], ['strSupplies', 120]]); await endScene();
    await hero(2); console.log('HERO1', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES1', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await tile('Cash-on-cash', 1.8); await endScene();
    await fillAll([['occupancy', 52]], 300); await hero(2.5); console.log('HERO2', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES2', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await save();
  } else if (KEY === 'brrrr2') {
    await fillAll([['purchasePrice', 120000], ['repairsUpfront', 30000], ['closingCosts', 3600]]); await endScene();
    await fillAll([['arv', 200000], ['rehabMonths', 5]]); await endScene();
    await fillAll([['refiLtv', 75], ['refiRate', 7.2], ['refiYears', 30], ['refiClosingCosts', 4000]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 1800); await fillAll([['downPaymentPct', 20], ['interestRate', 11], ['propertyTaxes', 1800], ['insurance', 1100]]); await endScene();
    await hero(2); await tile('Cash left in deal', 2.4); await tile('Equity after refi', 2.2); console.log('HERO', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await save();
  } else if (KEY === 'flip2') {
    const PR = +(process.env.PR || 174000);
    await fillAll([['purchasePrice', 200000], ['repairsUpfront', 50000], ['closingCosts', 6000]]); await endScene();
    await fillAll([['arv', 320000], ['holdMonths', 6], ['sellingCostPct', 7]]); await endScene();
    await fillAll([['downPaymentPct', 10], ['interestRate', 10], ['propertyTaxes', 2400], ['insurance', 1300], ['utilities', 1800]]); await endScene();
    await hero(2); console.log('HERO_200', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); await tile('70% rule', 2.4); await endScene();
    await fillAll([['purchasePrice', PR]], 300); await hero(2.5); console.log('HERO_PR', PR, await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await save();
  } else if (KEY === 'flip3') {
    await fillAll([['purchasePrice', 190000], ['repairsUpfront', 45000], ['closingCosts', 5700]]); await endScene();
    await fillAll([['arv', 315000], ['holdMonths', 6], ['sellingCostPct', 7]]); await endScene();
    await fillAll([['downPaymentPct', 10], ['interestRate', 10], ['propertyTaxes', 2200], ['insurance', 1300], ['utilities', 1800]]); await endScene();
    await hero(2.5); console.log('HERO6', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES6', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await fillAll([['holdMonths', 9]], 300); await hero(2.5); console.log('HERO9', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES9', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await save();
  } else if (KEY === 'capcoc') {
    await fillAll([['propertyName', 'Cedar Ct Rental'], ['purchasePrice', 300000], ['closingCosts', 9000]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2600); await endScene();
    await fillAll([['downPaymentPct', 20], ['interestRate', 6.75], ['propertyTaxes', 3600], ['insurance', 1800]]); await endScene();
    await hero(1); await tile('Cap rate', 5.5); await tile('Cash-on-cash', 5.5); console.log('HERO', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene(); await save();
  } else if (KEY === 'rate') {
    await fillAll([['propertyName', 'Birch Ln Rental'], ['purchasePrice', 280000], ['closingCosts', 8400]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2500); await endScene();
    await fillAll([['downPaymentPct', 20], ['interestRate', 6.5], ['propertyTaxes', 3200], ['insurance', 1700]]); await endScene();
    await hero(2.5); console.log('HERO65', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES65', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await fillAll([['interestRate', 7.5]], 300); await hero(2.5); console.log('HERO75', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES75', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene(); await save();
  } else if (KEY === 'hidden') {
    await fillAll([['propertyName', 'Pine St Rental'], ['purchasePrice', 260000], ['closingCosts', 7800]]); await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2300); await endScene();
    await fillAll([['downPaymentPct', 20], ['interestRate', 6.75], ['propertyTaxes', 3100], ['insurance', 1700]]); await endScene();
    await hero(2); await scrollTo('#tables', 120, 10); await shot(3); await scrollTo('#tables', -250, 10); await shot(3); console.log('TABLES', await p.evaluate(() => document.getElementById('tables').innerText.replace(/\s+/g, ' ').slice(0, 900))); await endScene();
    await tile('Cash-on-cash', 2.5); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene(); await save();
  } else if (KEY === 'dscr') {
    await fillAll([['propertyName', 'Elm St Rental'], ['purchasePrice', 320000], ['closingCosts', 9600]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2800); await endScene();
    await fillAll([['downPaymentPct', 20], ['interestRate', 7], ['propertyTaxes', 3800], ['insurance', 1900]]); await endScene();
    await hero(1.5); await tile('DSCR', 3.5); console.log('HERO', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene(); await save();
  } else if (KEY === 'duplex') {
    await fillAll([['propertyName', 'Duplex on Grove'], ['purchasePrice', 380000], ['closingCosts', 11400]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 1450); await p.click('#btn-add-unit'); await p.waitForTimeout(300); await shot(0.4);
    const r2 = p.locator('#units [data-k=rent]').nth(1); await r2.fill('1250'); await r2.dispatchEvent('change'); await p.waitForTimeout(200); await shot(1); await endScene();
    await fillAll([['downPaymentPct', 25], ['interestRate', 6.9], ['propertyTaxes', 4200], ['insurance', 2400]]); await endScene();
    await hero(2.5); console.log('HERO', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await tile('Cap rate', 2); await endScene(); await save();
  } else if (KEY === 'strltr') {
    await fillAll([['propertyName', 'Lakeview House'], ['purchasePrice', 300000], ['closingCosts', 9000]]); await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2300); await fillAll([['downPaymentPct', 25], ['interestRate', 6.9], ['propertyTaxes', 3000], ['insurance', 1700]]); await endScene();
    await hero(2.5); console.log('HERO_LTR', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES_LTR', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene();
    await scrollTo('[data-strategy=str]', 300, 8); await p.click('[data-strategy=str]'); await p.waitForTimeout(400); await shot(1);
    await fillAll([['furnishing', 18000], ['nightlyRate', 200], ['occupancy', 60], ['avgStay', 3], ['cleaningFeeCharged', 95], ['cleaningCost', 85], ['platformFeePct', 3], ['utilities', 4000], ['strSupplies', 120]]); await endScene();
    await hero(2.5); console.log('HERO_STR', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' '))); console.log('TILES_STR', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' '))); await endScene(); await save();
  } else if (KEY === 'onepct') {
    await fillAll([['propertyName', 'Oak Ave Rental'], ['purchasePrice', 200000], ['closingCosts', 6000]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', 2000); await endScene();
    await fillAll([['downPaymentPct', 10], ['interestRate', 7.25], ['propertyTaxes', 3600], ['insurance', 1800]]); await endScene();
    await hero(2.5); await tile('1% rule', 2); await tile('Cash-on-cash', 2); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' ')));
    await endScene(); await save();
  } else if (KEY === 'rental') {
    const V = process.env.V || 'good'; const rent = V === 'good' ? 2400 : 1700;
    await fillAll([['propertyName', 'Maple St Rental'], ['purchasePrice', 250000], ['closingCosts', 7500]]); await endScene();
    await scrollTo('#units', 260, 6); await typeIn('#units [data-k=rent]', rent); await endScene();
    await fillAll([['downPaymentPct', 25], ['interestRate', 6.75], ['propertyTaxes', 3000], ['insurance', 1600]]); await endScene();
    await hero(2.5); console.log('HERO', await p.evaluate(() => document.getElementById('hero').innerText.replace(/\s+/g, ' ')));
    await tile('Cash-on-cash', 2); await tile('Cap rate', 2); console.log('TILES', await p.evaluate(() => document.getElementById('tiles').innerText.replace(/\s+/g, ' ')));
    await endScene(); await save();
  } else {
    await fillAll([['purchasePrice', 180000], ['repairsUpfront', 40000], ['closingCosts', 5400]]); await endScene();
    await fillAll([['arv', 285000], ['holdMonths', 6], ['sellingCostPct', 7]]); await endScene();
    await fillAll([['downPaymentPct', 10], ['interestRate', 10], ['propertyTaxes', 2000], ['insurance', 1200], ['utilities', 1800]]); await endScene();
    await hero(2); await tile('ROI', 1.6); await tile('Annualized ROI', 2); await endScene();
    await tile('70% rule', 2.2); await fillAll([['purchasePrice', 160000]], 300); await hero(2.5); await endScene();
    await save();
  }
  fs.writeFileSync(OUT + '/seq.json', JSON.stringify({ list, scenes }));
  console.log(JSON.stringify({ total: used().toFixed(1), scenes: scenes.map(s => [s[0], +s[1].toFixed(1), +s[2].toFixed(1)]) }));
  await b.close();
})();
