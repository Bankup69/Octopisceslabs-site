(function () {
  'use strict';

  const { STRATEGIES, DEFAULTS, analyze, normalizeUnits } = window.RentalCalc;
  const { parseListing } = window.Listing;
  const Pro = window.Pro;
  const config = window.APP_CONFIG;
  const STORAGE_KEY = 'rental-calc:properties';
  const DRAFT_KEY = STORAGE_KEY + ':draft';
  const PRO_STRATEGIES = new Set(['str', 'brrrr', 'flip']);
  const form = document.getElementById('form');
  const $ = (id) => document.getElementById(id);

  // Fields stored as fractions but shown to the user as percentages.
  const PCT_FIELDS = [
    'landPct', 'vacancyRate', 'downPaymentPct', 'interestRate', 'maintenancePct', 'capexPct', 'mgmtPct',
    'mortgageInsPct', 'appreciationRate', 'occupancy', 'platformFeePct', 'refiLtv', 'refiRate',
    'rentGrowth', 'expenseGrowth', 'sellingCostPct',
  ];
  const TEXT_FIELDS = ['propertyName', 'address', 'cityState', 'listingUrl', 'strategy'];

  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const money = (n) => (n === null || n === undefined || !isFinite(n) ? '—' : usd.format(Math.round(n) || 0));
  const pct = (n) => (n === Infinity ? '∞' : n === null || n === undefined || !isFinite(n) ? '—' : (n * 100).toFixed(2) + '%');
  const times = (n) => (n === null || n === undefined || !isFinite(n) ? '—' : n.toFixed(2) + '×');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isLocked = (input) => PRO_STRATEGIES.has(input.strategy) && !Pro.isPro();
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

  let currentName = null; // name of the saved property loaded in the calculator

  // ---- units editor ------------------------------------------------------

  const unitsEl = $('units');

  function unitRow(u) {
    const row = document.createElement('div');
    row.className = 'unit-row';
    row.innerHTML =
      '<input type="text" data-k="label" aria-label="Unit type">' +
      '<input type="number" data-k="count" min="0" step="1" inputmode="numeric" aria-label="Number of units">' +
      '<span class="money"><input type="number" data-k="rent" min="0" step="25" inputmode="decimal" aria-label="Monthly rent per unit"></span>' +
      '<button type="button" class="icon" aria-label="Remove unit type">×</button>';
    row.querySelector('[data-k=label]').value = u.label;
    row.querySelector('[data-k=count]').value = u.count;
    row.querySelector('[data-k=rent]').value = u.rent;
    return row;
  }

  function setUnits(units) {
    unitsEl.replaceChildren(...units.map(unitRow));
  }

  function readUnits() {
    return [...unitsEl.querySelectorAll('.unit-row')].map((row) => ({
      label: row.querySelector('[data-k=label]').value.trim(),
      count: parseInt(row.querySelector('[data-k=count]').value, 10) || 0,
      rent: parseFloat(row.querySelector('[data-k=rent]').value) || 0,
    }));
  }

  $('btn-add-unit').addEventListener('click', () => {
    const n = unitsEl.children.length + 1;
    unitsEl.appendChild(unitRow({ label: `Unit ${n}`, count: 1, rent: 0 }));
    unitsEl.lastChild.querySelector('[data-k=rent]').focus();
    render();
  });

  unitsEl.addEventListener('click', (ev) => {
    if (!ev.target.matches('button.icon')) return;
    if (unitsEl.children.length > 1) ev.target.closest('.unit-row').remove();
    else setUnits([{ label: 'Unit 1', count: 1, rent: 0 }]);
    render();
  });

  // ---- form <-> inputs -------------------------------------------------

  function readForm() {
    const data = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else if (TEXT_FIELDS.includes(el.name)) data[el.name] = el.value.trim();
      else {
        const n = parseFloat(el.value);
        data[el.name] = isNaN(n) ? 0 : PCT_FIELDS.includes(el.name) ? n / 100 : n;
      }
    }
    data.units = readUnits();
    return data;
  }

  function fillForm(input) {
    const i = Object.assign({}, DEFAULTS, input);
    if (!STRATEGIES[i.strategy]) i.strategy = 'rental';
    for (const el of form.elements) {
      const name = el.name || el.dataset.mirror;
      if (!name) continue;
      const v = i[name];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (PCT_FIELDS.includes(name)) el.value = +(v * 100).toFixed(4);
      else el.value = v ?? '';
    }
    setUnits(normalizeUnits(input || {}));
    showStrategy(i.strategy);
    updateListingLink();
  }

  // Some fields appear in more than one section; keep the copies in step.
  form.addEventListener('input', (ev) => {
    const name = ev.target.name || ev.target.dataset.mirror;
    if (!name) return;
    form.querySelectorAll(`[name="${name}"], [data-mirror="${name}"]`).forEach((el) => {
      if (el !== ev.target) el.value = ev.target.value;
    });
  });

  // ---- strategies --------------------------------------------------------

  function showStrategy(s) {
    form.elements.strategy.value = s;
    document.querySelectorAll('#strategies [data-strategy]').forEach((b) =>
      b.setAttribute('aria-checked', b.dataset.strategy === s));
    document.querySelectorAll('#view-calc [data-strategies]').forEach((el) => {
      el.hidden = !el.dataset.strategies.split(' ').includes(s);
    });
  }

  $('strategies').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-strategy]');
    if (!b) return;
    const s = b.dataset.strategy;
    showStrategy(s);
    render();
    if (PRO_STRATEGIES.has(s) && !Pro.isPro()) {
      Pro.paywall(`${STRATEGIES[s]} analysis is part of Pro.`);
    }
  });

  // ---- listing link -------------------------------------------------------

  function updateListingLink() {
    const url = safeUrl(form.elements.listingUrl.value.trim());
    const a = $('listing-open');
    a.hidden = !url;
    if (url) {
      const parsed = parseListing(url);
      a.href = url;
      a.textContent = `Open on ${parsed ? parsed.source : 'site'} ↗`;
    } else a.removeAttribute('href');
  }

  // Fills in the address from a listing link without overwriting what the
  // user has typed.
  function applyListing(text, { overwrite = false } = {}) {
    const parsed = parseListing(text);
    if (!parsed) return null;
    const f = form.elements;
    f.listingUrl.value = parsed.url;
    if (parsed.address && (overwrite || !f.address.value.trim())) f.address.value = parsed.address;
    if (parsed.cityState && (overwrite || !f.cityState.value.trim() || f.cityState.value === DEFAULTS.cityState)) f.cityState.value = parsed.cityState;
    if (parsed.address && (overwrite || !f.propertyName.value.trim())) f.propertyName.value = parsed.address;
    updateListingLink();
    render();
    return parsed;
  }

  form.elements.listingUrl.addEventListener('change', () => {
    if (!applyListing(form.elements.listingUrl.value)) updateListingLink();
  });

  $('btn-paste').addEventListener('click', async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (_) {}
    if (!text) { form.elements.listingUrl.focus(); toast('Paste the link into the box'); return; }
    const parsed = applyListing(text);
    toast(parsed ? (parsed.address ? `Added ${parsed.address}` : `Linked to ${parsed.source}`) : 'No link found on the clipboard');
  });

  // Text shared into the app from Zillow, Redfin, a browser, etc.
  function handleShared(text) {
    const parsed = parseListing(text);
    if (!parsed) { toast('No listing link found in what was shared'); return; }
    fillForm(DEFAULTS);
    setCurrent(null);
    applyListing(text, { overwrite: true });
    showView('calc');
    window.scrollTo(0, 0);
    toast(parsed.address ? `New property from ${parsed.source}: ${parsed.address}` : `New property linked to ${parsed.source}`);
  }

  // ---- results model (shared by the screen and the PDF report) ----------

  function describe(input, r) {
    const e = r.expenses || {};
    const s = input.strategy;
    const tables = [];

    if (s === 'flip') {
      tables.push({ title: 'Flip breakdown', rows: [
        ['After-repair value (sale price)', money(r.arv)],
        ['Selling costs', money(-r.sellingCosts), 'neg'],
        ['Loan payoff at sale', money(-r.payoff), 'neg'],
        ['Net from sale', money(r.saleProceeds), 'subtotal'],
        ['Down payment', money(-r.downPayment), 'neg'],
        ['Rehab', money(-input.repairsUpfront), 'neg'],
        ['Closing costs (purchase)', money(-input.closingCosts), 'neg'],
        [`Holding costs (${r.holdMonths} mo: loan, taxes, insurance, utilities)`, money(-r.holdingCosts), 'neg'],
        ['Total cash needed', money(-r.cashInvested), 'subtotal'],
        ['Profit', money(r.profit), 'total'],
        ['ROI', pct(r.roi)],
        ['Annualized ROI', pct(r.annualizedRoi)],
        ['Profit margin (of sale price)', pct(r.profitMargin)],
        ['Max offer by the 70% rule', money(r.maxOffer70)],
      ] });
      return {
        hero: { label: 'Projected profit', value: money(r.profit), unit: '', sub: `${pct(r.roi)} ROI · ${r.holdMonths} months`, negative: r.profit < 0 },
        tiles: [
          { label: 'ROI', value: pct(r.roi), hint: 'Profit ÷ cash needed', tone: tone(r.roi, 0.15, 0) },
          { label: 'Annualized ROI', value: pct(r.annualizedRoi), hint: 'ROI scaled to a year', tone: tone(r.annualizedRoi, 0.3, 0) },
          { label: 'Cash needed', value: money(r.cashInvested), hint: 'Down + rehab + closing + holding' },
          { label: '70% rule max offer', value: money(r.maxOffer70), hint: 'ARV × 70% − rehab', tone: input.purchasePrice <= r.maxOffer70 ? 'good' : 'bad' },
          { label: 'Holding costs', value: money(r.holdingCosts), hint: `${r.holdMonths} months` },
          { label: 'Selling costs', value: money(r.sellingCosts), hint: pct(input.sellingCostPct) + ' of ARV' },
        ],
        mini: [['Profit', money(r.profit), r.profit < 0], ['ROI', pct(r.roi)]],
        tables,
      };
    }

    const income = [['Gross rental income', money(r.grossRent)]];
    if (s === 'str') {
      income[0][0] = `Booking income (${Math.round(r.nightsBooked)} nights, ${Math.round(r.bookings)} stays)`;
    } else {
      income.push(['Vacancy / loss', money(r.vacancyLoss), 'neg']);
      if (s === 'rental') income.push(['Rent lost during repairs', money(r.repairLoss), 'neg']);
    }
    const opRows = income.concat([
      ['Gross adjusted income', money(r.grossAdjustedIncome), 'subtotal'],
      ['Property taxes', money(-e.propertyTaxes), 'neg'],
      ['Insurance', money(-e.insurance), 'neg'],
      ['Maintenance & repairs', money(-e.maintenance), 'neg'],
      ['Owner-paid utilities', money(-e.utilities), 'neg'],
      ['Property management (variable)', money(-e.mgmtVariable), 'neg'],
      ['Property management (fixed)', money(-e.mgmtFixed), 'neg'],
      ['Mortgage insurance', money(-e.mortgageInsurance), 'neg'],
      ['Capital expense reserve', money(-e.capex), 'neg'],
    ]);
    if (s === 'str') {
      opRows.push(['Platform fees', money(-e.platformFees), 'neg'], ['Cleaning', money(-e.cleaning), 'neg'], ['Supplies & extras', money(-e.supplies), 'neg']);
    }
    opRows.push(
      ['Total expenses', money(-r.totalExpenses), 'subtotal'],
      ['Expenses (incl. vacancy) as % of gross', pct(r.expenseRatio)],
      ['Net operating income (NOI)', money(r.noi), 'subtotal'],
      [s === 'brrrr' ? 'Mortgage payments after refinance' : 'Mortgage payments (P&I)', money(-r.annualMortgage), 'neg'],
      ['Cash flow', money(r.annualCashFlow), 'total'],
      ['Loan principal paydown', money(r.principalPaydown)],
      ['Total return (cash flow + amortization)', money(r.returnCashflowAmort)],
      ['ROI (cash flow + amortization)', pct(r.roiCashflowAmort)],
      ['Appreciation (year 1)', money(r.appreciation)],
      ['Total return (cash flow + amortization + appreciation)', money(r.returnTotal), 'total'],
      ['Total ROI', pct(r.roiTotal)],
    );

    if (s === 'brrrr') {
      const b = r.brrrr;
      tables.push({ title: 'Buy, rehab & refinance', rows: [
        ['Down payment', money(r.downPayment)],
        ['Rehab', money(input.repairsUpfront)],
        ['Closing costs (purchase)', money(input.closingCosts)],
        [`Holding costs during rehab (${input.rehabMonths} mo)`, money(b.holdingCosts)],
        ['Total cash put in', money(b.cashIn), 'subtotal'],
        [`Refinance loan (${pct(input.refiLtv)} of ARV)`, money(b.refiLoan)],
        ['Pays off purchase loan', money(-b.payoff), 'neg'],
        ['Refinance closing costs', money(-input.refiClosingCosts), 'neg'],
        ['Cash out at refinance', money(b.cashOut), 'subtotal'],
        ['Cash left in the deal', money(b.cashLeftInDeal), 'total'],
        ['Equity after refinance', money(b.equityAfterRefi)],
      ] });
    }
    tables.push({ title: 'Year 1 breakdown', rows: opRows });
    tables.push({ title: 'Deal summary', collapsed: true, rows: [
      ['Purchase price', money(input.purchasePrice)],
      ['Land value', money(r.landValue)],
      ['Building value', money(r.buildingValue)],
      ['Total cost (price + repairs + closing)', money(r.totalCost), 'subtotal'],
      ['Down payment', money(r.downPayment)],
      ['Loan amount', money(r.operatingLoanAmount)],
      ['Monthly mortgage payment', money(r.monthlyMortgage)],
      [s === 'str' ? 'Listings' : 'Units', r.doors.toLocaleString()],
      ['Price per unit', money(r.pricePerDoor)],
      ['Cash flow per unit / month', money(r.cashFlowPerDoor)],
      ['Monthly NOI', money(r.monthlyNoi)],
    ] });

    const tiles = [
      { label: 'Cash-on-cash return', value: pct(r.cashOnCash), hint: 'Cash flow ÷ cash invested', tone: tone(r.cashOnCash, 0.08, 0) },
      { label: 'Total ROI', value: pct(r.roiTotal), hint: 'Cash flow + paydown + appreciation', tone: tone(r.roiTotal, 0.1, 0) },
      { label: 'Cap rate', value: pct(r.capRate), hint: s === 'brrrr' ? 'NOI ÷ ARV' : 'NOI ÷ purchase price', tone: tone(r.capRate, 0.07, 0.05) },
      { label: 'DSCR', value: times(r.dscr), hint: 'NOI ÷ mortgage payments', tone: tone(r.dscr, 1.25, 1) },
    ];
    if (s === 'brrrr') {
      tiles.push(
        { label: 'Cash left in deal', value: money(r.brrrr.cashLeftInDeal), hint: 'After the refinance', tone: r.brrrr.cashLeftInDeal <= 0 ? 'good' : '' },
        { label: 'Equity after refi', value: money(r.brrrr.equityAfterRefi), hint: 'ARV − new loan' },
      );
    } else {
      tiles.push({ label: 'Cash invested', value: money(r.cashInvested), hint: s === 'str' ? 'Down + repairs + closing + furnishing' : 'Down payment + repairs + closing' });
      tiles.push(s === 'str'
        ? { label: 'Revenue per night booked', value: money(r.nightsBooked ? r.grossRent / r.nightsBooked : null), hint: 'Including cleaning fees' }
        : { label: '1% rule', value: pct(r.onePercentRule), hint: 'Monthly rent ÷ price', tone: tone(r.onePercentRule, 0.01, 0.007) });
    }

    return {
      hero: {
        label: s === 'brrrr' ? 'Cash flow after refinance' : 'Your cash flow',
        value: money(r.monthlyCashFlow), unit: '/ month',
        sub: `${money(r.annualCashFlow)} per year · net income after financing`,
        negative: r.monthlyCashFlow < 0,
      },
      tiles,
      mini: [['Cash flow', money(r.monthlyCashFlow) + '/mo', r.monthlyCashFlow < 0], ['Cash-on-cash', pct(r.cashOnCash)]],
      tables,
      projection: r.projection,
    };
  }

  function projectionTable(p) {
    const years = [...new Set([1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, p.holdYears])].filter((y) => y <= 30).sort((a, b) => a - b);
    return {
      head: ['Year', 'Rent', 'NOI', 'Cash flow', 'Total cash flow', 'Value', 'Loan', 'Equity'],
      body: years.map((y) => {
        const row = p.rows[y - 1];
        return [String(y), money(row.grossRent), money(row.noi), money(row.cashFlow), money(row.cumulativeCashFlow),
          money(row.value), money(row.loanBalance), money(row.equity)];
      }),
      highlight: years.indexOf(p.holdYears),
      summary: `Selling after ${p.holdYears} years: IRR ${pct(p.irr)} · equity multiple ${times(p.equityMultiple)} · ` +
        `total profit ${money(p.exit.totalProfit)} · net from sale ${money(p.exit.saleNet)}`,
    };
  }

  // ---- calculator rendering ----------------------------------------------

  // An (i) button that opens the explanation of a result (see help.js).
  function helpBtn(label) {
    const help = window.FieldHelp;
    if (!help || !help.resultHelp(label)) return '';
    const name = esc(String(label).replace(/\s*\(.*$/, ''));
    return ` <button type="button" class="help-btn rhelp" data-help="${esc(label)}" aria-label="What is ${name}?" aria-expanded="false">i</button>`;
  }

  function tile(t) {
    return `<div class="tile ${t.tone || ''}"><div class="tile-label">${esc(t.label)}${helpBtn(t.label)}</div>` +
      `<div class="tile-value">${esc(t.value)}</div>${t.hint ? `<div class="tile-hint">${esc(t.hint)}</div>` : ''}</div>`;
  }

  function tone(n, good, ok) {
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    return n >= good ? 'good' : n >= ok ? 'ok' : 'bad';
  }

  function tableHtml(rows) {
    return rows.map(([label, value, cls]) =>
      `<tr class="${cls || ''}"><th scope="row">${esc(label)}${helpBtn(label)}</th><td>${esc(value)}</td></tr>`).join('');
  }

  const openTables = new Set(['Year 1 breakdown', 'Flip breakdown', 'Buy, rehab & refinance']);

  function render() {
    const input = readForm();
    const r = analyze(input);
    const m = describe(input, r);
    const locked = isLocked(input);

    $('hero-label').innerHTML = esc(m.hero.label) + helpBtn(m.hero.label);
    $('hero-value').textContent = m.hero.value;
    $('hero-unit').textContent = m.hero.unit;
    $('hero-sub').textContent = m.hero.sub;
    $('hero').classList.toggle('negative', m.hero.negative);
    $('units-total').textContent = `${r.doors.toLocaleString()} ${r.doors === 1 ? 'unit' : 'units'} · ${money(r.monthlyRent)}/mo`;
    if (input.strategy === 'str') {
      $('str-summary').textContent = `≈ ${Math.round(r.nightsBooked)} nights and ${Math.round(r.bookings)} stays a year · ${money(r.grossRent / 12)}/mo gross`;
    }

    $('mini-label').textContent = m.mini[0][0];
    $('mini-main').textContent = locked ? 'PRO' : m.mini[0][1];
    $('mini-main').className = locked ? '' : m.mini[0][2] ? 'bad' : 'good';
    $('mini-label2').textContent = m.mini[1][0];
    $('mini-second').textContent = locked ? '—' : m.mini[1][1];

    $('tiles').innerHTML = m.tiles.map(tile).join('');
    $('tables').innerHTML = m.tables.map((t) =>
      `<details ${t.collapsed && !openTables.has(t.title) ? '' : 'open'} data-title="${esc(t.title)}"><summary>${esc(t.title)}</summary>` +
      `<table class="breakdown">${tableHtml(t.rows)}</table></details>`).join('');

    const results = document.querySelector('.results');
    results.classList.toggle('locked', locked);
    let gate = results.querySelector('.gate');
    if (locked && !gate) {
      gate = document.createElement('div');
      gate.className = 'gate';
      gate.innerHTML = '<div class="gate-card"><div class="pw-badge">PRO</div><p></p><button type="button" class="primary">Unlock Pro</button></div>';
      gate.querySelector('button').addEventListener('click', () => Pro.paywall());
      results.prepend(gate);
    }
    if (gate) {
      gate.hidden = !locked;
      gate.querySelector('p').textContent = `${STRATEGIES[input.strategy]} analysis is part of Pro.`;
    }

    renderProjection(m.projection);
    $('btn-report').querySelector('.lock').hidden = Pro.isPro();

    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: currentName, input })); } catch (_) {}
  }

  function renderProjection(p) {
    const box = $('projection');
    $('projection-box').querySelector('.lock').hidden = Pro.isPro();
    if (!p) { box.replaceChildren(); return; }
    if (!Pro.isPro()) {
      box.innerHTML = '<div class="projection-locked"><p>See cash flow, loan paydown, equity and IRR for every year you hold, ' +
        'and what you’d walk away with when you sell.</p><button type="button" class="primary">Unlock with Pro</button></div>';
      box.querySelector('button').addEventListener('click', () => Pro.paywall('Long-term projections are part of Pro.'));
      return;
    }
    const t = projectionTable(p);
    box.innerHTML = `<p class="projection-summary">${esc(t.summary)}${helpBtn('IRR over hold period')}</p>` +
      '<div class="table-scroll"><table class="projection-table"><thead><tr>' +
      t.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('') + '</tr></thead><tbody>' +
      t.body.map((row, k) => `<tr class="${k === t.highlight ? 'hold' : ''}">` +
        row.map((c, j) => (j === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  // Remember which tables are open across re-renders.
  $('tables').addEventListener('toggle', (ev) => {
    const t = ev.target.dataset && ev.target.dataset.title;
    if (!t) return;
    if (ev.target.open) openTables.add(t); else openTables.delete(t);
  }, true);

  function setCurrent(name) {
    currentName = name;
    $('current-name').textContent = name || 'New property';
    $('btn-delete').disabled = !name;
  }

  // ---- saved properties ----------------------------------------------------

  // Stored as { name: { input, savedAt } }; early versions stored the input directly.
  function loadSaved() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { raw = {}; }
    const out = {};
    for (const [name, v] of Object.entries(raw)) {
      out[name] = v && v.input ? v : { input: v, savedAt: 0 };
    }
    return out;
  }

  function writeSaved(all) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); return true; } catch (_) { return false; }
  }

  function updateSavedCount() {
    const n = Object.keys(loadSaved()).length;
    $('saved-count').textContent = n;
    $('limit-note').textContent = Pro.isPro() ? '' : `${Math.min(n, config.freeSaveLimit)} of ${config.freeSaveLimit} free`;
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function openProperty(name) {
    const entry = loadSaved()[name];
    if (!entry) return;
    fillForm(entry.input);
    setCurrent(name);
    render();
    showView('calc');
    window.scrollTo(0, 0);
  }

  $('btn-save').addEventListener('click', async () => {
    const input = readForm();
    const name = input.propertyName || input.address || currentName || prompt('Name this property:');
    if (!name) return;
    let all = loadSaved();
    const renaming = currentName && currentName !== name && all[currentName] && !all[name];
    const adding = !all[name] && !renaming;
    if (adding && Object.keys(all).length >= config.freeSaveLimit && !Pro.isPro()) {
      const ok = await Pro.paywall(`The free version saves up to ${config.freeSaveLimit} properties. Go Pro for unlimited.`);
      if (!ok) return;
      all = loadSaved();
    }
    // Renaming a loaded property moves it rather than leaving a copy behind.
    if (renaming) delete all[currentName];
    all[name] = { input, savedAt: Date.now() };
    if (writeSaved(all)) {
      setCurrent(name);
      updateSavedCount();
      render();
      toast(`Saved “${name}”`);
    } else toast('Could not save on this device');
  });

  $('btn-delete').addEventListener('click', () => {
    if (!currentName || !confirm(`Delete “${currentName}”?`)) return;
    const all = loadSaved();
    delete all[currentName];
    writeSaved(all);
    selected.delete(currentName);
    toast(`Deleted “${currentName}”`);
    newProperty();
  });

  function newProperty() {
    const keep = form.elements.strategy.value;
    // The person's own starting numbers (Account → Settings), keeping the
    // strategy they're on.
    fillForm(Object.assign({}, DEFAULTS, window.Settings.newPropertyDefaults(), { strategy: keep }));
    setCurrent(null);
    history.replaceState(history.state, '', location.pathname);
    updateSavedCount();
    render();
  }

  $('btn-new').addEventListener('click', newProperty);

  $('btn-share').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '?p=' + encodeURIComponent(JSON.stringify(readForm()));
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch (_) { history.replaceState(history.state, '', url); toast('Link is in the address bar'); }
  });

  $('btn-report').addEventListener('click', async () => {
    if (!(await Pro.require('PDF reports are part of Pro.'))) return;
    const input = readForm();
    const r = analyze(input);
    const m = describe(input, r);
    const btn = $('btn-report');
    btn.disabled = true;
    try {
      await window.Report.exportReport({
        title: input.propertyName || input.address || 'Rental analysis',
        subtitle: [input.address !== input.propertyName ? input.address : '', input.cityState].filter(Boolean).join(', '),
        listingUrl: safeUrl(input.listingUrl),
        strategy: STRATEGIES[input.strategy],
        hero: { label: m.hero.label, value: m.hero.value + (m.hero.unit ? ' ' + m.hero.unit : ''), sub: m.hero.sub, negative: m.hero.negative },
        tiles: m.tiles,
        tables: m.tables,
        projection: m.projection ? projectionTable(m.projection) : null,
      });
    } catch (err) {
      console.error(err);
      toast('Couldn’t create the report');
    } finally {
      btn.disabled = false;
    }
  });

  form.addEventListener('input', render);

  // ---- dashboard -------------------------------------------------------------

  const selected = new Set();
  const NEG = -Infinity;
  const num = (v) => (v === null || v === undefined || Number.isNaN(v) ? NEG : v);

  const SORTS = {
    cashflow: (a, b) => num(b.r.monthlyCashFlow ?? (b.r.profit / 12)) - num(a.r.monthlyCashFlow ?? (a.r.profit / 12)),
    coc: (a, b) => num(b.r.cashOnCash) - num(a.r.cashOnCash),
    roi: (a, b) => num(b.r.roiTotal) - num(a.r.roiTotal),
    cap: (a, b) => num(b.r.capRate) - num(a.r.capRate),
    price: (a, b) => b.input.purchasePrice - a.input.purchasePrice,
    name: (a, b) => a.name.localeCompare(b.name),
  };

  // Rows of the comparison table. `best` marks which direction wins; `pro`
  // rows only show values to Pro users.
  const COMPARE_ROWS = [
    ['Strategy', (p) => STRATEGIES[p.input.strategy] || STRATEGIES.rental],
    ['Location', (p) => p.input.cityState || '—'],
    ['Purchase price', (p) => p.input.purchasePrice, money],
    ['Units', (p) => p.r.doors, (n) => n.toLocaleString()],
    ['Price per unit', (p) => p.r.pricePerDoor, money, 'low'],
    ['Monthly rent / revenue', (p) => (p.r.grossRent !== undefined ? p.r.grossRent / 12 : null), money, 'high'],
    ['Cash invested', (p) => p.r.cashInvested, money],
    ['Monthly mortgage', (p) => p.r.monthlyMortgage, money],
    ['NOI (annual)', (p) => p.r.noi, money, 'high'],
    ['Cash flow / month', (p) => p.r.monthlyCashFlow, money, 'high'],
    ['Cash flow / year', (p) => p.r.annualCashFlow, money, 'high'],
    ['Cash flow per unit / mo', (p) => p.r.cashFlowPerDoor, money, 'high'],
    ['Cash-on-cash return', (p) => p.r.cashOnCash, pct, 'high'],
    ['Cap rate', (p) => p.r.capRate, pct, 'high'],
    ['DSCR', (p) => p.r.dscr, times, 'high'],
    ['Expense ratio', (p) => p.r.expenseRatio, pct, 'low'],
    ['Flip profit', (p) => (p.input.strategy === 'flip' ? p.r.profit : null), money, 'high'],
    ['Cash left in deal (BRRRR)', (p) => (p.r.brrrr ? p.r.brrrr.cashLeftInDeal : null), money, 'low'],
    ['Total return (yr 1)', (p) => p.r.returnTotal, money, 'high'],
    ['Total ROI', (p) => p.r.roiTotal, pct, 'high'],
    ['IRR over hold period', (p) => (p.r.projection ? p.r.projection.irr : null), pct, 'high', true],
    ['Equity multiple', (p) => (p.r.projection ? p.r.projection.equityMultiple : null), times, 'high', true],
  ];

  function portfolio() {
    return Object.entries(loadSaved()).map(([name, { input, savedAt }]) => ({
      name, input, savedAt, r: analyze(input), locked: isLocked(Object.assign({}, DEFAULTS, input)),
    }));
  }

  function renderDashboard() {
    const props = portfolio();
    for (const name of [...selected]) if (!props.some((p) => p.name === name)) selected.delete(name);
    props.sort(SORTS[$('sort').value]);
    updateSavedCount();

    $('empty').hidden = props.length > 0;
    document.querySelector('.dash-toolbar').hidden = props.length === 0;

    const holds = props.filter((p) => p.input.strategy !== 'flip' && !p.locked);
    const sum = (list, f) => list.reduce((a, p) => a + (f(p) || 0), 0);
    const invested = sum(holds, (p) => Math.max(0, p.r.cashInvested));
    const annualCf = sum(holds, (p) => p.r.annualCashFlow);
    const monthlyCf = annualCf / 12;
    $('portfolio').hidden = props.length === 0;
    $('portfolio').innerHTML = [
      { label: 'Properties', value: String(props.length) },
      { label: 'Total units', value: sum(props, (p) => p.r.doors).toLocaleString() },
      { label: 'Monthly cash flow', value: money(monthlyCf), hint: 'Rental properties', tone: monthlyCf >= 0 ? 'good' : 'bad' },
      { label: 'Cash invested', value: money(invested), hint: 'Rental properties' },
      { label: 'Blended cash-on-cash', value: pct(invested ? annualCf / invested : null), hint: 'Total cash flow ÷ total invested', tone: tone(invested ? annualCf / invested : null, 0.08, 0) },
      { label: 'Total purchase price', value: money(sum(props, (p) => p.input.purchasePrice)) },
    ].map(tile).join('');
    const flips = props.filter((p) => p.input.strategy === 'flip').length;
    $('portfolio-note').textContent = props.length && flips ? `Flips (${flips}) aren’t included in cash flow totals.` : '';

    $('cards').innerHTML = props.map((p) => {
      const on = selected.has(p.name);
      const flip = p.input.strategy === 'flip';
      const main = flip ? p.r.profit : p.r.monthlyCashFlow;
      const url = safeUrl(p.input.listingUrl);
      const source = url ? (parseListing(url) || {}).source : '';
      const lockedVal = (v) => (p.locked ? 'PRO' : v);
      const stats = flip
        ? [['Price', money(p.input.purchasePrice)], ['ARV', money(p.r.arv)], ['ROI', lockedVal(pct(p.r.roi))],
          ['Annualized', lockedVal(pct(p.r.annualizedRoi))], ['Cash needed', lockedVal(money(p.r.cashInvested))], ['Months', String(p.r.holdMonths)]]
        : [['Price', money(p.input.purchasePrice)], ['Units', p.r.doors.toLocaleString()], ['Cash-on-cash', lockedVal(pct(p.r.cashOnCash))],
          ['Cap rate', lockedVal(pct(p.r.capRate))], ['Total ROI', lockedVal(pct(p.r.roiTotal))], ['DSCR', lockedVal(times(p.r.dscr))]];
      return `<article class="card ${on ? 'selected' : ''}" data-name="${esc(p.name)}">
        <label class="card-check"><input type="checkbox" ${on ? 'checked' : ''} aria-label="Select ${esc(p.name)} for comparison"></label>
        <div class="card-head">
          <span class="chip">${esc(STRATEGIES[p.input.strategy] || STRATEGIES.rental)}</span>
          <h3>${esc(p.name)}</h3>
          <div class="card-sub">${esc([p.input.address !== p.name ? p.input.address : '', p.input.cityState].filter(Boolean).join(' · ') || '—')}</div>
        </div>
        <div class="card-cf ${p.locked ? '' : main < 0 ? 'bad' : 'good'}">${p.locked ? 'PRO' : money(main)}<small>${flip ? ' profit' : '/mo'}</small></div>
        <dl class="card-stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="card-actions">
          <button type="button" class="open">Open</button>
          ${url ? `<a class="button listing-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(source)} ↗</a>` : ''}
        </div>
      </article>`;
    }).join('');

    renderCompare(props);
  }

  function renderCompare(props) {
    const chosen = props.filter((p) => selected.has(p.name));
    const n = chosen.length;
    $('compare-bar').hidden = n === 0;
    $('compare-count').textContent = n === 1 ? '1 selected · pick one more' : `${n} selected`;
    $('btn-compare').hidden = n < 2;
    $('compare').hidden = n < 2;
    if (n < 2) return;

    $('compare-hint').textContent = 'Best value in each row is highlighted.';
    const head = '<thead><tr><th scope="col">Metric</th>' +
      chosen.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('') + '</tr></thead>';
    const rows = COMPARE_ROWS.filter(([, get]) => chosen.some((p) => {
      const v = get(p);
      return v !== null && v !== undefined;
    }));
    const body = rows.map(([label, get, fmt, best, proOnly]) => {
      const hide = (p) => p.locked || (proOnly && !Pro.isPro());
      const vals = chosen.map((p) => (hide(p) ? undefined : get(p)));
      const nums = vals.filter((v) => typeof v === 'number' && !Number.isNaN(v) && v !== null);
      const target = best && nums.length > 1 && new Set(nums).size > 1
        ? (best === 'high' ? Math.max(...nums) : Math.min(...nums)) : null;
      const cells = vals.map((v, k) => {
        const text = hide(chosen[k]) ? 'PRO' : v === null || v === undefined ? '—' : fmt ? fmt(v) : String(v);
        return `<td class="${target !== null && v === target ? 'best' : ''}">${esc(text)}</td>`;
      }).join('');
      return `<tr><th scope="row">${esc(label)}${helpBtn(label)}</th>${cells}</tr>`;
    }).join('');
    $('compare-table').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  $('cards').addEventListener('click', (ev) => {
    const card = ev.target.closest('.card');
    if (!card) return;
    const name = card.dataset.name;
    if (ev.target.closest('.open')) { openProperty(name); return; }
    if (ev.target.closest('.listing-link')) return;
    // Tapping anywhere else on the card toggles it for comparison. A click on
    // the checkbox's label is re-dispatched to the checkbox, so skip it here.
    if (ev.target.matches('.card-check')) return;
    if (ev.target.matches('input[type=checkbox]')) {
      if (ev.target.checked) selected.add(name); else selected.delete(name);
    } else if (selected.has(name)) selected.delete(name);
    else selected.add(name);
    renderDashboard();
  });

  $('sort').addEventListener('change', renderDashboard);
  $('btn-select-all').addEventListener('click', () => {
    Object.keys(loadSaved()).forEach((n) => selected.add(n));
    renderDashboard();
  });
  $('btn-clear').addEventListener('click', () => { selected.clear(); renderDashboard(); });
  $('btn-compare').addEventListener('click', () => $('compare').scrollIntoView({ behavior: 'smooth' }));

  // ---- views -----------------------------------------------------------------

  function showView(view, push = true) {
    $('view-calc').hidden = view !== 'calc';
    $('view-dash').hidden = view !== 'dash';
    $('view-account').hidden = view !== 'account';
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-pressed', t.dataset.view === view));
    if (view === 'dash') renderDashboard();
    if (push && history.state?.view !== view) history.pushState({ view }, '');
  }

  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.goto)));
  window.addEventListener('popstate', (ev) => {
    const view = ev.state?.view || 'calc';
    if (view === 'account' && window.AccountPage) window.AccountPage.open();
    else showView(view, false);
  });

  // The Account page restores backups and deletes accounts.
  document.addEventListener('rental-calc:saved-changed', () => {
    updateSavedCount();
    if (!$('view-dash').hidden) renderDashboard();
  });
  document.addEventListener('rental-calc:toast', (ev) => toast(ev.detail));

  window.App = { showView };

  // ---- Pro -------------------------------------------------------------------

  function updateProButton() {
    const b = $('btn-pro');
    b.textContent = Pro.isPro() ? 'Pro ✓' : 'Go Pro';
    b.classList.toggle('active', Pro.isPro());
  }

  $('btn-pro').addEventListener('click', () => {
    if (Pro.isPro()) toast('Pro is active. Thanks for your support!');
    else Pro.paywall();
  });

  Pro.onChange(() => {
    updateProButton();
    updateSavedCount();
    render();
    if (!$('view-dash').hidden) renderDashboard();
  });

  // ---- startup: shared listing > shared link > last draft > defaults ------

  const params = new URLSearchParams(location.search);
  const sharedText = ['title', 'text', 'url'].map((k) => params.get(k)).filter(Boolean).join(' ');

  let initial = Object.assign({}, DEFAULTS, window.Settings.newPropertyDefaults());
  let initialName = null;
  try {
    const shared = params.get('p') ||
      (location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : null);
    if (shared) initial = JSON.parse(shared);
    else {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (draft) {
        initial = draft.input || draft;
        initialName = draft.name && loadSaved()[draft.name] ? draft.name : null;
      }
    }
  } catch (_) { initial = Object.assign({}, DEFAULTS, window.Settings.newPropertyDefaults()); }

  fillForm(initial);
  setCurrent(initialName);
  updateSavedCount();
  updateProButton();
  render();
  history.replaceState({ view: 'calc' }, '', sharedText ? location.pathname : location.href);
  if (sharedText) handleShared(sharedText);

  Pro.init().then(() => { updateProButton(); render(); });

  // Listings shared from other apps into the Android app.
  const Cap = window.Capacitor;
  if (Pro.native && Cap.getPlatform() === 'android') {
    try {
      Cap.registerPlugin('CapacitorShareTarget').addListener('shareReceived', (ev) => {
        handleShared([ev.title].concat(ev.texts || []).filter(Boolean).join(' '));
      });
    } catch (err) { console.warn('Share target unavailable', err); }
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
