// Ingot screens: the portfolio tracker inside EquityFoundry. Logic lives in
// ingot-core.js. Data is stored on the device (localStorage, receipts in
// IndexedDB) and, when signed in, synced to the person's account in Supabase.
(function () {
  'use strict';

  const I = window.IngotCore;
  const Calc = window.RentalCalc;
  const Pro = window.Pro;
  const Account = window.Account;
  const KEY = 'ingot:v1';
  const UI_KEY = 'ingot:ui';
  const DEALS_KEY = 'rental-calc:properties';

  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => (n === null || n === undefined || !isFinite(n) ? '—' : usd.format(Math.round(n) || 0));
  const money2 = (n) => (n === null || n === undefined || !isFinite(n) ? '—' : usd2.format(n));
  const pct = (n) => (n === Infinity ? '∞' : n === null || n === undefined || !isFinite(n) ? '—' : (n * 100).toFixed(1) + '%');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  const isPro = () => Pro.isPro();
  const thisYear = () => new Date().getFullYear();
  const LOCK = '<span class="lock">PRO</span>';

  // ---- storage ---------------------------------------------------------------

  function load() {
    try { return I.normalize(JSON.parse(localStorage.getItem(KEY))); } catch (_) { return I.emptyData(); }
  }
  let data = load();

  function save({ sync = true } = {}) {
    data.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { toast('Could not save on this device. Storage may be full.'); }
    if (sync) scheduleSync();
  }

  let ui = { tab: 'dash', period: 'month', month: I.ym(new Date()), property: '', taxYear: thisYear(), logQuery: '' };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY)) || {}, { tab: 'dash', month: I.ym(new Date()), taxYear: thisYear() }); } catch (_) {}
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ period: ui.period, property: ui.property })); } catch (_) {} };

  const props = () => I.live(data.properties).sort((a, b) => a.name.localeCompare(b.name));
  const propName = (id) => (data.properties.find((p) => p.id === id) || {}).name || 'No property';
  const touch = (item, fields) => Object.assign(item, fields, { updatedAt: Date.now() });
  const remove = (item) => touch(item, { deleted: true });

  function deals() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(DEALS_KEY)) || {}; } catch (_) { raw = {}; }
    return Object.entries(raw).map(([name, v]) => ({ name, input: v && v.input ? v.input : v }));
  }
  const dealByName = (name) => deals().find((d) => d.name === name);

  function toast(msg) { document.dispatchEvent(new CustomEvent('rental-calc:toast', { detail: msg })); }

  async function proGate(reason) {
    if (isPro()) return true;
    return !!(await Pro.paywall(reason));
  }

  // ---- receipts (IndexedDB) -------------------------------------------------------

  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('ingot-receipts', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('receipts');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  async function putReceipt(id, blob) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('receipts', 'readwrite'); t.objectStore('receipts').put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
  async function getReceipt(id) {
    const d = await db();
    return new Promise((res, rej) => { const r = d.transaction('receipts').objectStore('receipts').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }

  // Photos are shrunk to about 1600px so they don't fill the phone.
  function shrinkImage(file) {
    return new Promise((resolve) => {
      if (!/^image\//.test(file.type)) { resolve(file); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.72);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function saveReceiptFiles(files) {
    const ids = [];
    for (const f of files) {
      const id = I.newId('r');
      await putReceipt(id, await shrinkImage(f));
      ids.push(id);
    }
    return ids;
  }

  async function openReceipt(id) {
    const blob = await getReceipt(id).catch(() => null);
    if (!blob) { toast('That photo is on another device. Receipt photos stay on the device that took them for now.'); return; }
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  }

  // ---- sync ----------------------------------------------------------------------

  let syncTimer = null;
  let syncing = false;
  let lastSync = null;
  let syncError = '';

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 2500);
  }

  async function sync() {
    const user = Account && Account.user();
    if (!user || syncing || !Account.client) return;
    syncing = true;
    try {
      const c = await Account.client();
      const got = await c.from('ingot_data').select('data').eq('user_id', user.id).maybeSingle();
      if (got.error) throw got.error;
      const merged = I.prune(got.data ? I.mergeData(data, got.data.data) : data);
      const changed = JSON.stringify(merged) !== JSON.stringify(data);
      data = merged;
      save({ sync: false });
      const put = await c.from('ingot_data').upsert({ user_id: user.id, data, updated_at: new Date().toISOString() });
      if (put.error) throw put.error;
      lastSync = new Date();
      syncError = '';
      if (changed && isOpen()) render();
    } catch (err) {
      console.warn('Ingot sync failed', err);
      syncError = 'Couldn’t sync just now. Your entries are saved on this device.';
    } finally {
      syncing = false;
      const el = document.getElementById('ig-sync');
      if (el) el.textContent = syncText();
    }
  }

  function syncText() {
    const user = Account && Account.user();
    if (!user) return 'Saved on this device. Sign in to keep it in sync across devices.';
    if (syncError) return syncError;
    if (lastSync) return `Synced to ${user.email} · ${lastSync.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    return `Syncing to ${user.email}…`;
  }

  // ---- shared bits -------------------------------------------------------------------

  const root = () => document.getElementById('ingot');
  const isOpen = () => { const v = document.getElementById('view-ingot'); return v && !v.hidden; };

  // goto: 'properties' or 'month' makes the tile open that screen.
  function tile(label, value, hint, tone, goto) {
    const link = goto ? ` ig-link" role="button" tabindex="0" data-goto="${goto}" aria-label="${esc(label)}: ${esc(value)}. Open ${goto === 'month' ? 'month view' : goto}` : '';
    return `<div class="tile ${tone || ''}${link}"><div class="tile-label">${esc(label)}${hb(label)}</div><div class="tile-value">${esc(value)}</div>${hint ? `<div class="tile-hint">${esc(hint)}</div>` : ''}</div>`;
  }

  const quickAddRow = (propertyId) => `<div class="ig-quick"><button type="button" class="primary" data-act="quick-add" data-id="${esc(propertyId || '')}">+ Quick add</button><span class="hint">Log rent, a bill or a distribution in seconds.</span></div>`;

  function propertyOptions(selected, { all = false, none = false } = {}) {
    const list = props();
    return (all ? `<option value="">All properties</option>` : '') +
      (none ? `<option value="">No property</option>` : '') +
      list.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  }

  function categoryOptions(type, selected) {
    return I.TYPES[type].categories.map((c) => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');
  }

  function typeOptions(selected) {
    return Object.entries(I.TYPES).map(([k, t]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(t.label)}</option>`).join('');
  }

  function dealOptions(placeholder) {
    const list = deals();
    if (!list.length) return '';
    return `<select data-act="${placeholder.act}"><option value="">${esc(placeholder.label)}</option>${list.map((d) => `<option>${esc(d.name)}</option>`).join('')}</select>`;
  }

  function lockedPanel(title, text, reason) {
    return `<div class="ig-locked"><h3>${esc(title)} ${LOCK}</h3><p>${esc(text)}</p><button type="button" class="primary" data-act="pro" data-reason="${esc(reason || text)}">See Pro</button></div>`;
  }


  // ---- help (ⓘ) ---------------------------------------------------------------------
  // Fields in forms get an ⓘ that opens the explanation under the field.
  // Keys are "<form>.<field name>" with a plain "<field name>" fallback.
  const FIELD_HELP = {
    type: { what: 'What kind of money this is. Income comes in, expenses go out to run the property, distributions are money you take out for yourself, and Other covers things that are neither, like the principal part of a loan payment.' },
    amount: { what: 'How much, in dollars. Always type it as a positive number: the type decides whether it counts as money in or out.', find: 'Your bank statement, the receipt, or the payment app (Zelle, Venmo, check).' },
    date: { what: 'The day the money moved. It decides which month and tax year the entry lands in.', note: 'For rent paid late, use the day you actually received it.' },
    propertyId: { what: 'Which property this belongs to. Each property gets its own totals and its own column in the Schedule E export.' },
    category: { what: 'What it was for. Expense categories match the lines on IRS Schedule E, so your tax totals add up by themselves.', note: 'Mortgage interest is only the interest part of your payment. Log the principal part as Other → Loan principal (or use the principal box that appears below).' },
    principal: { what: 'The part of your mortgage payment that pays down the loan balance. It isn’t an expense, so Ingot logs it separately as Other → Loan principal.', find: 'Your monthly mortgage statement splits each payment into principal, interest, and escrow (taxes and insurance).', note: 'Escrow for property taxes and insurance can be logged as Taxes and Insurance expenses.' },
    memo: { what: 'A short note to jog your memory later, like “Unit B, March rent” or “new water heater”. It shows in the month view and the CSV export.' },
    receipt: { what: 'A photo of the receipt or invoice. Handy if you’re ever asked to back up an expense.', note: 'Photos stay on the device that took them.' },
    'property.name': { what: 'A name you’ll recognize, like the street name or “Maple Duplex”.' },
    'property.address': { what: 'The street address. Optional, but useful on tax exports.' },
    'property.units': { what: 'How many rentable units the property has: 1 for a house, 2 for a duplex, and so on.' },
    'property.occupied': { what: 'How many units have a tenant right now. Leave it blank if they’re all rented.', note: 'Used for the “rented” figure on the dashboard.' },
    'property.expectedRent': { what: 'The total rent you should collect each month from all units when they’re rented.', find: 'Add up the rent on your current leases.', note: 'The dashboard compares rent collected to this, so a late or missing payment stands out.' },
    'property.purchasePrice': { what: 'What you paid for the property.', find: 'Your closing statement (the settlement statement or Closing Disclosure).' },
    'property.purchaseDate': { what: 'The day you closed on the property.', find: 'Your closing statement.' },
    'property.notes': { what: 'Anything you want to remember: lender, property manager, gate code, lease end dates.' },
    'watch.address': { what: 'The address of the property you’re considering.' },
    'watch.price': { what: 'The asking price on the listing.', find: 'The listing on Zillow, Redfin or your agent’s MLS link.' },
    'watch.rent': { what: 'The monthly rent you think it would bring in, for all units together.', find: 'Look at similar rentals nearby on Zillow, Rentometer or Craigslist, or ask a local property manager.', note: 'Optional. With it, Ingot makes a rough estimate so the property gets colors right away.' },
    'watch.url': { what: 'The link to the listing, so you can get back to it in one tap.' },
    'bought.price': { what: 'The final price you paid, after negotiating.', find: 'Your closing statement.' },
    'bought.date': { what: 'The day you closed.' },
    'bought.units': { what: 'How many rentable units it has.' },
    'bought.rent': { what: 'The total monthly rent you expect from all units. The dashboard compares what you collect to this.' },
    minCashFlow: { what: 'The least you want each property to put in your pocket every month, after the mortgage and all expenses.', typical: 'Many investors look for $100–$300 per unit per month.' },
    minCoc: { what: 'The yearly cash flow you want, as a percent of the cash you put in (down payment, closing costs, repairs).', typical: '8–12% is a common target.' },
    minCap: { what: 'The yearly net operating income (rent minus expenses, before the mortgage) as a percent of the price. It compares properties no matter how they’re financed.', typical: '5–8% in many markets; higher in cheaper areas.' },
    'maint.propertyId': { what: 'Which property the repair was done on.' },
    'maint.date': { what: 'The day the work was done.' },
    vendor: { what: 'Who did the work: the company or person you paid.', note: 'Searchable later, so you can find “who fixed the furnace last time”.' },
    cost: { what: 'What the repair cost in total.', find: 'The invoice or receipt.' },
    'maint.notes': { what: 'What was fixed, which unit, and any warranty details.' },
    photos: { what: 'Before and after photos, or the invoice. You can add more than one.', note: 'Photos stay on the device that took them.' },
    asExpense: { what: 'Also adds the cost as a Repairs expense, so it counts in your totals and Schedule E. Untick it if you already logged the payment.' },
    date_col: { what: 'The column in your bank file that holds the transaction date.' },
    description: { what: 'The column with the payee or description, like “HOME DEPOT #4521”. Saved rules match on this text.' },
    amount_col: { what: 'Pick this when your bank puts money in and out in one column, with spending as negative numbers.' },
    debit: { what: 'Pick this when your bank has separate columns: this is the money-out (debit or withdrawal) column.' },
    credit: { what: 'The money-in (credit or deposit) column, for banks that use separate columns.' },
    flip: { what: 'Some card exports show purchases as positive numbers. Tick this so they’re read as money out.' },
    'import-default': { what: 'Puts every row on this property to start with. You can still change any single row. Rows matched by a saved rule keep the rule’s property.' },
    'month-property': { what: 'Show one property or all of them together.' },
    'tax-year': { what: 'The tax year to total. Entries are counted by their date.' },
    depreciation: { what: 'The yearly depreciation figure for this property. Ingot doesn’t calculate it.', find: 'Ask your tax preparer, or use last year’s return (Form 4562).', note: 'Added to Schedule E line 18.' },
    'log-search': { what: 'Find a repair by vendor, notes or property.' },
  };

  // Tiles, tables and panels open the shared help sheet (from help.js).
  const SHEET_HELP = {
    'Properties': { what: 'How many properties and units you track, and how many units have a tenant right now.', note: 'Tap the tile to see your properties.' },
    'Income': { what: 'All money in for the period: rent plus fees and other income.', calc: 'Adds up every Income entry dated in the period.', note: 'Underneath, rent collected is compared to the rent you expect, so a late tenant stands out (the tile turns amber below 95%).' },
    'Expenses': { what: 'Every cost of running the properties in the period.', calc: 'Adds up every Expense entry dated in the period.', note: 'Distributions and loan principal are not expenses, so they’re left out.' },
    'Net': { what: 'What the properties earned in the period.', calc: 'Income minus expenses.', good: 'Positive (green) means the properties made money.' },
    'Distributions': { what: 'Money you or your partners took out of the properties: owner draws and partner payouts.', calc: 'Kept in the properties = net minus distributions.', note: 'Logged separately so they never lower your tax numbers.' },
    'Income vs expenses': { what: 'Money in (green) and money out (gold) for each of the last 12 months.', note: 'Hover or tap a bar for the exact numbers. Tap the chart to open the month view.' },
    'Expenses by category': { what: 'Your five biggest kinds of expense in the period, using the Schedule E names. Everything smaller is grouped at the end.' },
    'Properties table': { what: 'Each property side by side for the period.', note: 'Rent collected is Rent entries only. Rented is units with a tenant. “vs. expected rent” compares rent collected to the expected monthly rent times the months in the period. Tap a row to open that property’s month.' },
    'Month entries': { what: 'Everything logged in this month, newest first. Tap ✎ to edit, × to delete, 📎 to see a receipt.' },
    'Schedule E totals': { what: 'Your income and expenses per property, arranged like the lines on IRS Schedule E (Form 1040).', calc: 'Line 3 is all income. Lines 5–19 add up expenses by category. Line 20 is total expenses, line 21 is income minus expenses.', note: 'Totals of the categories you chose. Not tax advice: confirm with your tax preparer.' },
    'Your criteria': { what: 'The minimum numbers a property must hit for you to want it.', note: 'With Pro, each watchlist property shows green (meets them all), amber (close: within about 20%) or red (misses), plus a target price.' },
    'Target price': { what: 'The highest price at which this property would still meet all your criteria, keeping everything else the same.', note: 'A starting point for your offer. It’s blank when no price works, for example if the rent can’t cover the costs.' },
    'Watchlist': { what: 'Properties you’re thinking about buying, with live numbers from the calculator.', note: 'Change the status as you go. “Bought” moves it into your portfolio.' },
    'Maintenance log': { what: 'A history of every repair: when, who, how much and what was done, with photos.' },
    'Import': { what: 'Bring in transactions from a bank or card CSV file.', note: 'Map the columns once per bank. Tick Remember on a row to tag that payee the same way next time.' },
  };

  if (window.FieldHelp) {
    Object.entries(SHEET_HELP).forEach(([k, v]) => { window.FieldHelp.RESULT_HELP[`${k} (Ingot)`] = v; });
  }
  const hb = (key) => (SHEET_HELP[key]
    ? ` <button type="button" class="help-btn rhelp" data-help="${esc(key)} (Ingot)" aria-label="What is ${esc(key)}?" aria-expanded="false">i</button>` : '');

  // Adds an ⓘ to each label in the container that has help.
  function decorate(container, ctx) {
    container.querySelectorAll('label').forEach((label) => {
      if (label.querySelector('.ig-fhelp')) return;
      const input = label.querySelector('input, select');
      if (!input) return;
      let name = input.name || (input.dataset && (input.dataset.map || input.dataset.act)) || '';
      if (name === 'date' && input.dataset.map) name = 'date_col';
      if (input.dataset && input.dataset.map === 'amount') name = 'amount_col';
      const entry = FIELD_HELP[`${ctx}.${name}`] || FIELD_HELP[name];
      if (!entry) return;
      const textNode = [...label.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      const wrap = document.createElement('span');
      wrap.className = 'label-text';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'help-btn ig-fhelp';
      btn.textContent = 'i';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', `What is “${textNode ? textNode.textContent.trim() : name}”?`);
      if (textNode) {
        textNode.textContent = textNode.textContent.trim();
        label.insertBefore(wrap, textNode);
        wrap.append(textNode, ' ', btn);
      } else {
        const span = label.querySelector('span, b');
        if (span) span.append(' ', btn); else label.prepend(btn);
      }
      const panel = document.createElement('div');
      panel.className = 'help-panel';
      panel.hidden = true;
      [['What it is', entry.what], ['Where to find it', entry.find], ['Typical', entry.typical], ['Note', entry.note]].forEach(([t, text]) => {
        if (!text) return;
        const p = document.createElement('p');
        const b = document.createElement('strong');
        b.textContent = t + ': ';
        p.append(b, text);
        panel.appendChild(p);
      });
      panel.addEventListener('click', (ev) => ev.preventDefault());
      label.appendChild(panel);
    });
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.ig-fhelp');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const panel = btn.closest('label').querySelector('.help-panel');
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.closest('label').classList.toggle('help-open', open);
  }, true);

  // ---- dialog --------------------------------------------------------------------------

  let dialog;
  function openDialog(title, bodyHtml, onSubmit, { submitLabel = 'Save', onReady, ctx = '' } = {}) {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'account-dialog ig-dialog';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<button type="button" class="icon close" aria-label="Close">×</button><h2>${esc(title)}</h2>
      <form class="ig-form" novalidate>${bodyHtml}<p class="ig-msg" role="status"></p>
      <div class="ig-form-actions"><button type="submit" class="primary">${esc(submitLabel)}</button><button type="button" class="link ig-cancel">Cancel</button></div></form>`;
    const form = dialog.querySelector('form');
    dialog.querySelector('.close').onclick = () => dialog.close();
    dialog.querySelector('.ig-cancel').onclick = () => dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const msg = dialog.querySelector('.ig-msg');
      msg.textContent = '';
      try {
        const ok = await onSubmit(form);
        if (ok !== false) { dialog.close(); render(); }
      } catch (err) { msg.textContent = err.message || String(err); }
    };
    decorate(form, ctx);
    if (onReady) onReady(form);
    if (!dialog.open) dialog.showModal();
    const first = form.querySelector('input:not([type=hidden]):not([type=checkbox]), select');
    if (first) setTimeout(() => first.focus(), 30);
    return form;
  }

  const num = (v) => { const n = I.parseAmount(v); return n === null ? 0 : n; };

  // ---- quick add ----------------------------------------------------------------------

  function quickAdd(preset = {}, existing = null) {
    const list = props();
    const e = existing || {};
    const type = e.type || preset.type || 'income';
    const propertyId = e.propertyId || preset.propertyId || ui.property || (list[0] && list[0].id) || '';
    const body = `
      <div class="ap-seg ig-types" role="radiogroup" aria-label="Type">${Object.entries(I.TYPES).map(([k, t]) =>
        `<button type="button" role="radio" data-type="${k}" aria-checked="${k === type}">${esc(k === 'transfer' ? 'Other' : t.label)}</button>`).join('')}</div>
      <input type="hidden" name="type" value="${type}">
      <div class="ig-grid">
        <label>Amount <input type="text" name="amount" inputmode="decimal" required value="${e.amount ? esc(e.amount) : ''}" placeholder="0.00"></label>
        <label>Date <input type="date" name="date" value="${esc(e.date || I.today())}" required></label>
        <label>Property <select name="propertyId">${propertyOptions(propertyId, { none: !list.length })}</select></label>
        <label>Category <select name="category">${categoryOptions(type, e.category || preset.category)}</select></label>
      </div>
      <label class="ig-principal" style="display:none">Principal part <input type="text" name="principal" inputmode="decimal" placeholder="Optional: the loan-paydown part of the payment"></label>
      <p class="hint ig-principal-hint" style="display:none">Only the interest goes on Schedule E. Put your whole payment’s interest above and the principal here. Ingot logs the principal separately as Loan principal.</p>
      <label>Note <input type="text" name="memo" value="${esc(e.memo || '')}" placeholder="Optional, e.g. Unit B, March rent"></label>
      <label class="ig-file">Receipt photo ${isPro() ? '' : LOCK} <input type="file" name="receipt" accept="image/*,application/pdf" capture="environment" ${isPro() ? '' : 'disabled'}></label>
      ${e.receiptId ? '<p class="hint">A receipt is attached. Adding a new photo replaces it.</p>' : ''}
      <p class="hint" data-type-hint></p>`;
    const hints = {
      income: 'Rent and other money the property brings in.',
      expense: 'Costs of running the property. These go in your Schedule E totals.',
      distribution: 'Money you or a partner took out. Not an expense, so it never lowers your tax numbers.',
      transfer: 'Loan principal, deposits you hold, moving money between accounts. Left out of income and expenses.',
    };
    openDialog(existing ? 'Edit entry' : 'Quick add', body, async (form) => {
      const amount = Math.abs(num(form.elements.amount.value));
      if (!amount) throw new Error('Enter an amount.');
      if (!form.elements.date.value) throw new Error('Pick a date.');
      if (!isPro() && form.elements.date.value.slice(0, 4) < String(thisYear())) {
        if (!(await proGate('The free version tracks the current year. Go Pro to log earlier years.'))) return false;
      }
      const fields = {
        type: form.elements.type.value, amount, date: form.elements.date.value,
        propertyId: form.elements.propertyId.value, category: form.elements.category.value, memo: form.elements.memo.value.trim(),
      };
      const file = form.elements.receipt.files && form.elements.receipt.files[0];
      if (file) fields.receiptId = (await saveReceiptFiles([file]))[0];
      if (existing) touch(existing, fields);
      else data.entries.push(I.makeEntry(fields));
      const principal = Math.abs(num(form.elements.principal.value));
      if (principal && fields.type === 'expense' && /^Mortgage interest/.test(fields.category)) {
        data.entries.push(I.makeEntry({ type: 'transfer', category: 'Loan principal', amount: principal, date: fields.date, propertyId: fields.propertyId, memo: fields.memo || 'Mortgage payment' }));
      }
      save();
      toast(existing ? 'Entry updated' : `Added ${money2(amount)} ${I.TYPES[fields.type].label.toLowerCase()}${principal && /^Mortgage interest/.test(fields.category) ? ` and ${money2(principal)} principal` : ''}`);
    }, {
      submitLabel: existing ? 'Save' : 'Add',
      onReady: (form) => {
        const setType = (t) => {
          form.elements.type.value = t;
          form.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-checked', b.dataset.type === t));
          form.elements.category.innerHTML = categoryOptions(t);
          form.querySelector('[data-type-hint]').textContent = hints[t];
        };
        const showPrincipal = () => {
          const on = form.elements.type.value === 'expense' && /^Mortgage interest/.test(form.elements.category.value);
          form.querySelector('.ig-principal').style.display = on ? '' : 'none';
          form.querySelector('.ig-principal-hint').style.display = on ? '' : 'none';
        };
        form.elements.category.addEventListener('change', showPrincipal);
        form.querySelectorAll('[data-type]').forEach((b) => { b.onclick = () => { setType(b.dataset.type); showPrincipal(); }; });
        showPrincipal();
        form.querySelector('[data-type-hint]').textContent = hints[type];
      },
    });
  }

  // ---- properties --------------------------------------------------------------------

  function editProperty(existing, fromDeal) {
    if (!existing && props().length >= I.FREE_LIMITS.properties && !isPro()) {
      proGate('The free version tracks 1 property. Go Pro to track your whole portfolio.').then((ok) => { if (ok) editProperty(existing, fromDeal); });
      return;
    }
    let p = existing || {};
    if (fromDeal) {
      const d = dealByName(fromDeal);
      if (d) {
        const r = Calc.analyze(d.input);
        p = { name: d.name, address: [d.input.address, d.input.cityState].filter(Boolean).join(', '), units: r.doors || 1,
          expectedRent: Math.round(r.monthlyRent || 0), purchasePrice: d.input.purchasePrice || 0, listingUrl: d.input.listingUrl || '', calcName: d.name };
      }
    }
    const body = `
      <label>Name <input type="text" name="name" required value="${esc(p.name || '')}" placeholder="e.g. Maple Duplex"></label>
      <label>Address <input type="text" name="address" value="${esc(p.address || '')}"></label>
      <div class="ig-grid">
        <label>Units <input type="number" name="units" min="1" step="1" value="${esc(p.units || 1)}"></label>
        <label>Units rented now <input type="number" name="occupied" min="0" step="1" value="${esc(p.occupied != null ? p.occupied : '')}" placeholder="All of them"></label>
        <label>Expected rent a month (all units) <input type="text" name="expectedRent" inputmode="decimal" value="${esc(p.expectedRent || '')}"></label>
        <label>Purchase price <input type="text" name="purchasePrice" inputmode="decimal" value="${esc(p.purchasePrice || '')}"></label>
        <label>Purchase date <input type="date" name="purchaseDate" value="${esc(p.purchaseDate || '')}"></label>
      </div>
      <label>Notes <input type="text" name="notes" value="${esc(p.notes || '')}"></label>
      <input type="hidden" name="calcName" value="${esc(p.calcName || '')}">
      <input type="hidden" name="listingUrl" value="${esc(p.listingUrl || '')}">`;
    openDialog(existing ? 'Edit property' : 'Add a property', body, (form) => {
      const name = form.elements.name.value.trim();
      if (!name) throw new Error('Give the property a name.');
      const units = Math.max(1, Math.round(num(form.elements.units.value) || 1));
      const fields = {
        name, address: form.elements.address.value.trim(), units,
        occupied: form.elements.occupied.value.trim() === '' ? units : Math.min(units, Math.max(0, Math.round(num(form.elements.occupied.value)))),
        expectedRent: num(form.elements.expectedRent.value), purchasePrice: num(form.elements.purchasePrice.value),
        purchaseDate: form.elements.purchaseDate.value, notes: form.elements.notes.value.trim(),
        calcName: form.elements.calcName.value, listingUrl: form.elements.listingUrl.value,
      };
      if (existing) touch(existing, fields);
      else {
        const created = I.makeProperty(fields);
        data.properties.push(created);
        if (!ui.property) ui.property = '';
      }
      save();
      toast(existing ? 'Property updated' : `Added “${name}”`);
    }, { submitLabel: existing ? 'Save' : 'Add property', ctx: 'property' });
  }

  function deleteProperty(p) {
    const n = I.live(data.entries).filter((e) => e.propertyId === p.id).length;
    if (!confirm(`Delete “${p.name}”${n ? ` and its ${n} entries` : ''}? This can’t be undone.`)) return;
    remove(p);
    data.entries.forEach((e) => { if (e.propertyId === p.id && !e.deleted) remove(e); });
    data.maint.forEach((m) => { if (m.propertyId === p.id && !m.deleted) remove(m); });
    save();
    render();
  }

  // ---- watchlist helpers ---------------------------------------------------------------

  function watchInput(w) {
    const d = w.calcName && dealByName(w.calcName);
    return d ? d.input : w.input || {};
  }

  function watchRows() {
    return I.live(data.watch).map((w) => {
      const input = Object.assign({}, Calc.DEFAULTS, watchInput(w));
      const hasNumbers = (input.units || []).some((u) => u.rent > 0) || input.nightlyRate > 0;
      const r = hasNumbers ? Calc.analyze(input) : null;
      const check = r ? I.checkCriteria(r, data.criteria) : { status: null, checks: [] };
      return { w, input, r, check, hasNumbers };
    });
  }

  function watchDeal(name) {
    const d = dealByName(name);
    if (!d) return false;
    if (I.live(data.watch).some((w) => w.calcName === name)) { toast(`“${name}” is already on your watchlist`); return true; }
    if (I.live(data.watch).length >= I.FREE_LIMITS.watch && !isPro()) {
      proGate(`The free watchlist holds ${I.FREE_LIMITS.watch} properties. Go Pro for unlimited.`).then((ok) => { if (ok) watchDeal(name); });
      return true;
    }
    data.watch.push({ id: I.newId('w'), calcName: name, name, input: null, status: 'watching', passReason: '', addedAt: I.today(), updatedAt: Date.now() });
    save();
    toast(`Added “${name}” to your ${I.NAME} watchlist`);
    if (isOpen()) render();
    return true;
  }

  function addWatchByHand() {
    if (I.live(data.watch).length >= I.FREE_LIMITS.watch && !isPro()) {
      proGate(`The free watchlist holds ${I.FREE_LIMITS.watch} properties. Go Pro for unlimited.`).then((ok) => { if (ok) addWatchByHand(); });
      return;
    }
    openDialog('Add a property to watch', `
      <label>Address <input type="text" name="address" required placeholder="123 Main St, Reno NV"></label>
      <div class="ig-grid">
        <label>Asking price <input type="text" name="price" inputmode="decimal"></label>
        <label>Monthly rent you expect <input type="text" name="rent" inputmode="decimal" placeholder="Optional"></label>
      </div>
      <label>Listing link <input type="url" name="url" placeholder="Zillow, Redfin, etc."></label>
      <p class="hint">With a rent, Ingot makes a rough estimate (25% down at 7%, typical taxes, insurance and closing costs, unless your saved defaults say otherwise). Run the full numbers in the calculator any time.</p>`, (form) => {
      const address = form.elements.address.value.trim();
      if (!address) throw new Error('Enter an address.');
      const rent = num(form.elements.rent.value);
      const price = num(form.elements.price.value);
      const input = Object.assign({}, Calc.DEFAULTS, window.Settings ? window.Settings.newPropertyDefaults() : {}, {
        propertyName: address, address, purchasePrice: price, listingUrl: safeUrl(form.elements.url.value.trim()),
        units: [{ label: 'Unit 1', count: 1, rent }],
      });
      // A rough first look until the person runs the full numbers: typical
      // financing, taxes and insurance when their saved defaults leave them blank.
      if (!input.downPaymentPct) input.downPaymentPct = 0.25;
      if (!input.interestRate) input.interestRate = 0.07;
      if (!input.propertyTaxes) input.propertyTaxes = Math.round(price * 0.011);
      if (!input.insurance) input.insurance = Math.round(price * 0.005);
      if (!input.closingCosts) input.closingCosts = Math.round(price * 0.03);
      input.roughEstimate = true;
      data.watch.push({ id: I.newId('w'), calcName: '', name: address, input, status: 'watching', passReason: '', addedAt: I.today(), updatedAt: Date.now() });
      save();
    }, { submitLabel: 'Add to watchlist', ctx: 'watch' });
  }

  function markBought(row) {
    const { w, input, r } = row;
    if (props().length >= I.FREE_LIMITS.properties && !isPro()) {
      proGate('The free version tracks 1 property. Go Pro to add this one to your portfolio.').then((ok) => { if (ok) markBought(row); });
      return;
    }
    openDialog(`Bought “${w.name}”`, `
      <p>It moves into your portfolio. Fill in the purchase details:</p>
      <div class="ig-grid">
        <label>Price paid <input type="text" name="price" inputmode="decimal" value="${esc(input.purchasePrice || '')}"></label>
        <label>Closing date <input type="date" name="date" value="${I.today()}"></label>
        <label>Units <input type="number" name="units" min="1" value="${esc((r && r.doors) || 1)}"></label>
        <label>Expected rent a month <input type="text" name="rent" inputmode="decimal" value="${esc(Math.round((r && r.monthlyRent) || 0) || '')}"></label>
      </div>`, (form) => {
      const units = Math.max(1, Math.round(num(form.elements.units.value)));
      data.properties.push(I.makeProperty({
        name: w.name, address: [input.address, input.cityState].filter(Boolean).join(', '), units, occupied: units,
        expectedRent: num(form.elements.rent.value), purchasePrice: num(form.elements.price.value), purchaseDate: form.elements.date.value,
        listingUrl: input.listingUrl || '', calcName: w.calcName || '',
      }));
      touch(w, { status: 'bought' });
      save();
      toast(`Congratulations! “${w.name}” is in your portfolio.`);
    }, { submitLabel: 'Move to portfolio', ctx: 'bought' });
  }

  // ---- screens -----------------------------------------------------------------------

  const TABS = [
    ['dash', 'Dashboard'], ['properties', 'Properties'], ['month', 'Month'],
    ['taxes', 'Taxes'], ['log', 'Maintenance'], ['import', 'Import'],
  ];

  function render() {
    const el = root();
    if (!el) return;
    if (!TABS.some(([k]) => k === ui.tab)) ui.tab = 'dash';
    const body = { dash: renderDash, properties: renderProperties, month: renderMonth, watch: renderWatch, taxes: renderTaxes, log: renderLog, import: renderImport }[ui.tab]();
    el.innerHTML = `
      <div class="ig-head">
        <div>
          <h2 class="ig-title">${esc(I.NAME)}<span class="sr-only">:</span> <small>Income, expenses and receipts for your rentals</small></h2>
        </div>
      </div>
      <nav class="ig-tabs" aria-label="${esc(I.NAME)} sections">${TABS.map(([k, label]) =>
        `<button type="button" data-tab="${k}" aria-pressed="${ui.tab === k}">${esc(label)}${(k === 'log' || k === 'import') && !isPro() ? ' ' + LOCK : ''}</button>`).join('')}</nav>
      <div class="ig-body">${body}</div>
      <p class="hint ig-foot"><span id="ig-sync">${esc(syncText())}</span></p>`;
    if (ui.tab === 'import') wireImport();
    decorate(el, 'page');
    saveUi();
  }

  function emptyWelcome() {
    return `<div class="ig-welcome">
      <h3>Track the rentals you own</h3>
      <p>Log rent and costs in seconds, see how each property is doing, and get your Schedule E totals ready at tax time.</p>
      <div class="ig-row">
        <button type="button" class="primary" data-act="add-property">Add your first property</button>
        ${dealOptions({ act: 'property-from-deal', label: 'Or start from a saved deal…' })}
      </div>
      <ol class="ig-steps"><li>Add a property you own.</li><li>Log this month’s rent and bills with <b>Quick add</b>, or import a bank CSV.</li><li>Check the dashboard any time. Export totals for your tax preparer in spring.</li></ol>
    </div>`;
  }

  // Dashboard ----------------------------------------------------------------------------

  const PERIODS = [['month', 'This month'], ['quarter', 'Quarter'], ['ytd', 'Year to date'], ['last12', 'Last 12 months']];

  function renderDash() {
    const list = props();
    if (!list.length) return emptyWelcome();
    if (ui.period === 'last12' && !isPro()) ui.period = 'ytd';
    const range = I.periodRange(ui.period);
    const s = I.summarize(data, range);
    const rentHint = s.expectedRent ? `Rent ${money(s.rent)} of ${money(s.expectedRent)} expected` : 'Add expected rent to track late payments';
    const periodBtns = PERIODS.map(([k, label]) => {
      const locked = k === 'last12' && !isPro();
      return `<button type="button" role="radio" data-period="${k}" aria-checked="${ui.period === k}">${esc(label)}${locked ? ' ' + LOCK : ''}</button>`;
    }).join('');
    let out = `<div class="ig-row ig-period"><div class="ap-seg" role="radiogroup" aria-label="Period">${periodBtns}</div><span class="hint">${esc(range.label)}</span></div>
      <div class="tiles">
        ${tile('Properties', `${list.length} · ${s.units} unit${s.units === 1 ? '' : 's'}`, `${s.occupied} of ${s.units} rented`, '', 'properties')}
        ${tile('Income', money(s.income), rentHint, s.expectedRent && s.rent < s.expectedRent * 0.95 ? 'ok' : '', 'month')}
        ${tile('Expenses', money(s.expense), s.count ? '' : 'Nothing logged yet', '', 'month')}
        ${tile('Net', money(s.net), 'Income minus expenses', s.net >= 0 ? 'good' : 'bad', 'month')}
        ${tile('Distributions', money(s.distribution), `Kept in the properties: ${money(s.kept)}`, '', 'month')}
      </div>
      ${quickAddRow()}`;
    if (!s.count) {
      out += `<div class="ig-callout"><p><b>Nothing logged for ${esc(range.label.toLowerCase())} yet.</b> Add this month’s rent and bills with Quick add, or import a bank export.</p>
        <div class="ig-row"><button type="button" data-tab="import">Import a bank CSV</button></div></div>`;
    }
    if (isPro()) {
      const months = I.monthKeys(new Date(), 12);
      const series = I.monthlySeries(data, months);
      out += `<div class="ig-panels">
        <section class="ig-panel ig-link" data-goto="month" role="button" tabindex="0" aria-label="Income vs expenses. Open month view"><h3>Income vs expenses${hb('Income vs expenses')} <span class="ig-go">→</span></h3>${barChart(series)}</section>
        <section class="ig-panel ig-link" data-goto="month" role="button" tabindex="0" aria-label="Expenses by category. Open month view"><h3>Expenses by category${hb('Expenses by category')} <span class="ig-go">→</span></h3>${categoryBars(I.topCategories(s.byCategory, 5))}</section>
      </div>
      <section class="ig-panel"><h3><button type="button" class="ig-h-link" data-tab="properties">Properties · ${esc(range.label)} <span class="ig-go">→</span></button>${hb('Properties table')}</h3>${propertyTable(list, s)}</section>`;
    } else {
      out += lockedPanel('Charts and property table', 'See income vs expenses by month, your biggest costs, and how each property compares, including late rent.', 'Pro adds dashboard charts, the property table and unlimited properties.');
    }
    return out;
  }

  function barChart(series) {
    const max = Math.max(1, ...series.map((m) => Math.max(m.income, m.expense)));
    const W = 600, H = 200, pad = 24, slot = (W - pad) / series.length, bw = Math.max(4, slot * 0.32);
    const bars = series.map((m, k) => {
      const x = pad + k * slot + slot * 0.14;
      const hi = (m.income / max) * (H - 30), he = (m.expense / max) * (H - 30);
      return `<g><title>${esc(I.monthLabel(m.month, true))}: income ${money(m.income)}, expenses ${money(m.expense)}, net ${money(m.net)}</title>
        <rect class="ig-bar-in" x="${x.toFixed(1)}" y="${(H - 18 - hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="2"></rect>
        <rect class="ig-bar-out" x="${(x + bw + 2).toFixed(1)}" y="${(H - 18 - he).toFixed(1)}" width="${bw.toFixed(1)}" height="${he.toFixed(1)}" rx="2"></rect>
        <text x="${(x + bw).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(I.monthLabel(m.month))}</text></g>`;
    }).join('');
    return `<svg class="ig-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and expenses for the last 12 months">
      <line x1="${pad}" x2="${W}" y1="${H - 18}" y2="${H - 18}" class="ig-axis"></line>${bars}</svg>
      <p class="ig-legend"><span class="ig-key in"></span>Income <span class="ig-key out"></span>Expenses</p>`;
  }

  function categoryBars(top) {
    if (!top.length) return '<p class="hint">No expenses in this period.</p>';
    const max = Math.max(...top.map(([, v]) => v));
    return `<ul class="ig-cats">${top.map(([name, v]) => `<li><span class="ig-cat-name">${esc(name)}</span><span class="ig-cat-bar"><span style="width:${Math.max(3, (v / max) * 100).toFixed(1)}%"></span></span><span class="ig-cat-val">${money(v)}</span></li>`).join('')}</ul>`;
  }

  function propertyTable(list, s) {
    const rows = list.map((p) => {
      const b = s.byProperty[p.id] || { income: 0, expense: 0, rent: 0, net: 0 };
      const expected = (Number(p.expectedRent) || 0) * (I.periodRange(ui.period).months || 1);
      const short = expected && b.rent < expected * 0.95;
      return `<tr class="ig-link" data-goto="month" data-id="${esc(p.id)}"><th scope="row"><button type="button" class="link" data-act="open-month" data-id="${esc(p.id)}">${esc(p.name)}</button></th>
        <td>${money(b.rent)}</td><td>${money(b.expense)}</td><td class="${b.net >= 0 ? 'pos' : 'neg'}">${money(b.net)}</td>
        <td>${esc(p.occupied)}/${esc(p.units)}</td><td class="${short ? 'neg' : ''}">${expected ? `${Math.round((b.rent / expected) * 100)}% of ${money(expected)}` : '—'}</td></tr>`;
    }).join('');
    return `<div class="table-scroll"><table class="ig-table"><thead><tr><th>Property</th><th>Rent collected</th><th>Expenses</th><th>Net</th><th>Rented</th><th>vs. expected rent</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function watchStrip() {
    const rows = watchRows().filter((x) => x.w.status === 'watching' || x.w.status === 'offer');
    if (!rows.length) return '';
    const meeting = rows.filter((x) => x.check.status === 'green');
    const pool = (meeting.length ? meeting : rows).filter((x) => x.r);
    pool.sort((a, b) => b.r.monthlyCashFlow - a.r.monthlyCashFlow);
    const top = pool[0];
    const effect = top && isFinite(top.r.monthlyCashFlow)
      ? ` · Adding “${esc(top.w.name)}” ${top.r.monthlyCashFlow >= 0 ? 'adds' : 'costs'} about ${money(Math.abs(top.r.monthlyCashFlow))} a month` : '';
    return `<button type="button" class="ig-watch-strip" data-tab="watch"><b>Watchlist</b> · ${rows.length} propert${rows.length === 1 ? 'y' : 'ies'} · ${isPro() ? `${meeting.length} meet${meeting.length === 1 ? 's' : ''} your criteria` : 'criteria colors with Pro'}${effect} →</button>`;
  }

  // Properties -----------------------------------------------------------------------------

  function renderProperties() {
    const list = props();
    if (!list.length) return emptyWelcome();
    const s = I.summarize(data, I.periodRange('month'));
    const cards = list.map((p) => {
      const b = s.byProperty[p.id] || { income: 0, expense: 0, net: 0, rent: 0 };
      const url = safeUrl(p.listingUrl);
      return `<article class="card ig-card">
        <div class="card-head"><span class="chip">${esc(p.units)} unit${p.units === 1 ? '' : 's'} · ${esc(p.occupied)} rented</span><h3>${esc(p.name)}</h3>
          <div class="card-sub">${esc(p.address || '—')}</div></div>
        <div class="card-cf ${b.net >= 0 ? 'good' : 'bad'}">${money(b.net)}<small> net this month</small></div>
        <dl class="card-stats">
          <div><dt>Rent in</dt><dd>${money(b.rent)}</dd></div><div><dt>Costs out</dt><dd>${money(b.expense)}</dd></div>
          <div><dt>Expected rent</dt><dd>${money(p.expectedRent)}</dd></div>
        </dl>
        <div class="card-actions">
          <button type="button" class="open" data-act="open-month" data-id="${esc(p.id)}">Month view</button>
          <button type="button" data-act="quick-add" data-id="${esc(p.id)}">+ Add</button>
          <button type="button" data-act="edit-property" data-id="${esc(p.id)}">Edit</button>
          ${p.calcName && dealByName(p.calcName) ? `<button type="button" data-act="open-deal" data-name="${esc(p.calcName)}" title="Open the original analysis">Deal</button>` : ''}
          ${url ? `<a class="button" href="${esc(url)}" target="_blank" rel="noopener">Listing ↗</a>` : ''}
          <button type="button" class="icon" data-act="delete-property" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">🗑</button>
        </div>
      </article>`;
    }).join('');
    const atLimit = list.length >= I.FREE_LIMITS.properties && !isPro();
    return `<div class="ig-row ig-toolbar"><h3>Properties</h3>
      <div class="ig-row"><button type="button" data-act="add-property">+ Add property${atLimit ? ' ' + LOCK : ''}</button>
      ${dealOptions({ act: 'property-from-deal', label: 'From a saved deal…' })}</div></div>
      <div class="cards">${cards}</div>
      ${atLimit ? '<p class="hint">The free version tracks 1 property. Pro tracks as many as you own.</p>' : ''}`;
  }

  // Month view --------------------------------------------------------------------------------

  function renderMonth() {
    const list = props();
    if (!list.length) return emptyWelcome();
    const range = I.monthRange(ui.month);
    const s = I.summarize(data, range, ui.property || undefined);
    const entries = I.live(data.entries)
      .filter((e) => e.date >= range.start && e.date <= range.end && (!ui.property || e.propertyId === ui.property))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const rows = entries.map((e) => `<tr>
      <td>${esc(e.date.slice(5).replace('-', '/'))}</td>
      ${ui.property ? '' : `<td>${esc(propName(e.propertyId))}</td>`}
      <td><span class="ig-type ${e.type}">${esc(I.TYPES[e.type].label)}</span> ${esc(e.category)}${e.memo ? `<div class="hint">${esc(e.memo)}</div>` : ''}</td>
      <td class="num ${e.type === 'income' ? 'pos' : e.type === 'expense' ? 'neg' : ''}">${e.type === 'expense' ? '−' : ''}${money2(e.amount)}</td>
      <td class="ig-row-actions">${e.receiptId ? `<button type="button" class="icon" data-act="receipt" data-id="${esc(e.receiptId)}" aria-label="View receipt">📎</button>` : ''}
        <button type="button" class="icon" data-act="edit-entry" data-id="${esc(e.id)}" aria-label="Edit">✎</button>
        <button type="button" class="icon" data-act="delete-entry" data-id="${esc(e.id)}" aria-label="Delete">×</button></td></tr>`).join('');
    const p = ui.property && data.properties.find((x) => x.id === ui.property);
    return `<div class="ig-monthbar">
        <div class="ig-monthnav"><button type="button" class="icon" data-act="month-prev" aria-label="Previous month">‹</button>
          <h3 class="ig-month">${esc(range.label)}</h3>
          <button type="button" class="icon" data-act="month-next" aria-label="Next month">›</button></div>
        <label class="inline">Property <select data-act="month-property">${propertyOptions(ui.property, { all: true })}</select></label>
      </div>
      <div class="tiles">
        ${tile('Income', money(s.income), s.expectedRent ? `Rent ${money(s.rent)} of ${money(s.expectedRent)} expected` : '', s.expectedRent && s.rent < s.expectedRent * 0.95 ? 'ok' : '')}
        ${tile('Expenses', money(s.expense))}
        ${tile('Net', money(s.net), '', s.net >= 0 ? 'good' : 'bad')}
        ${tile('Distributions', money(s.distribution))}
      </div>
      ${p && p.notes ? `<p class="hint">${esc(p.notes)}</p>` : ''}
      ${entries.length ? `<h3 class="ig-subhead">Entries${hb('Month entries')}</h3><div class="table-scroll"><table class="ig-table ig-entries"><thead><tr><th>Date</th>${ui.property ? '' : '<th>Property</th>'}<th>What</th><th class="num">Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${quickAddRow(ui.property)}`
        : `<div class="empty"><p>Nothing logged for ${esc(range.label)}.</p>${quickAddRow(ui.property)}</div>`}`;
  }

  // Watchlist ------------------------------------------------------------------------------------

  function renderWatch() {
    const rows = watchRows();
    const c = data.criteria;
    const val = (v, scale) => (v === null || v === undefined || v === '' ? '' : esc(+(v * scale).toFixed(2)));
    const criteria = `<form class="ig-criteria" data-form="criteria">
      <h3>Your criteria${hb('Your criteria')} ${isPro() ? '' : LOCK}</h3>
      <div class="ig-grid">
        <label>Minimum cash flow a month <input type="text" name="minCashFlow" inputmode="decimal" value="${val(c.minCashFlow, 1)}" placeholder="$"></label>
        <label>Minimum cash-on-cash (%) <input type="text" name="minCoc" inputmode="decimal" value="${val(c.minCoc, 100)}"></label>
        <label>Minimum cap rate (%) <input type="text" name="minCap" inputmode="decimal" value="${val(c.minCap, 100)}"></label>
      </div>
      <div class="ig-row"><button type="submit">Save criteria</button><span class="hint">${isPro() ? 'Green meets all of them, amber is close, red misses.' : 'Pro shows green, amber or red against these, and the price to offer.'}</span></div>
    </form>`;
    const active = rows.filter((x) => x.w.status !== 'bought');
    const cards = active.map(({ w, input, r, check, hasNumbers }) => {
      const status = isPro() ? check.status : null;
      const tp = isPro() && hasNumbers ? I.targetPrice(input, data.criteria, Calc.analyze) : null;
      const url = safeUrl(input.listingUrl);
      const n = props().length;
      const checks = isPro() ? check.checks.map((k) => `<li class="${k.pass ? 'pass' : k.near ? 'near' : 'miss'}">${esc(k.label)}: ${k.money ? money(k.value) : pct(k.value)} <small>(want ${k.money ? money(k.target) : pct(k.target)})</small></li>`).join('') : '';
      return `<article class="card ig-card ig-watch ${status ? 'st-' + status : ''}">
        <div class="card-head"><span class="chip">${esc(I.WATCH_STATUS[w.status] || 'Watching')}</span>${status ? `<span class="ig-dot ${status}" title="${status}"></span>` : ''}
          <h3>${esc(w.name)}</h3><div class="card-sub">${esc(money(input.purchasePrice))} asking${w.passReason ? ' · Passed: ' + esc(w.passReason) : ''}</div></div>
        ${hasNumbers ? `<div class="card-cf ${r.monthlyCashFlow >= 0 ? 'good' : 'bad'}">${money(r.monthlyCashFlow)}<small>/mo</small></div>
          <dl class="card-stats"><div><dt>Cash-on-cash</dt><dd>${pct(r.cashOnCash)}</dd></div><div><dt>Cap rate</dt><dd>${pct(r.capRate)}</dd></div>
          <div><dt>Target price${hb('Target price')}</dt><dd>${isPro() ? (tp ? money(tp) : '—') : 'PRO'}</dd></div></dl>
          ${checks ? `<ul class="ig-checks">${checks}</ul>` : ''}
          ${input.roughEstimate && !w.calcName ? '<p class="hint"><b>Rough estimate.</b> Run the numbers for the real figures.</p>' : ''}
          <p class="hint">Adding it ${r.monthlyCashFlow >= 0 ? 'adds' : 'costs'} about ${money(Math.abs(r.monthlyCashFlow))} a month and takes you from ${n} to ${n + 1} propert${n + 1 === 1 ? 'y' : 'ies'}.</p>`
        : '<p class="hint">No rent yet. Open it in the calculator to run the numbers.</p>'}
        <div class="card-actions ig-wrap">
          <button type="button" class="open" data-act="watch-open" data-id="${esc(w.id)}">${w.calcName ? 'Open in calculator' : 'Run the numbers'}</button>
          ${url ? `<a class="button" href="${esc(url)}" target="_blank" rel="noopener">Listing ↗</a>` : ''}
          <select data-act="watch-status" data-id="${esc(w.id)}" aria-label="Status">${Object.entries(I.WATCH_STATUS).map(([k, l]) => `<option value="${k}" ${k === w.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <button type="button" class="icon" data-act="watch-remove" data-id="${esc(w.id)}" aria-label="Remove">×</button>
        </div>
      </article>`;
    }).join('');
    const bought = rows.filter((x) => x.w.status === 'bought');
    const atLimit = I.live(data.watch).length >= I.FREE_LIMITS.watch && !isPro();
    return `<div class="ig-row ig-toolbar"><h3>Watchlist${hb('Watchlist')}</h3><div class="ig-row">
        ${dealOptions({ act: 'watch-from-deal', label: 'Add a saved deal…' })}
        <button type="button" data-act="watch-add">+ Add by hand${atLimit ? ' ' + LOCK : ''}</button></div></div>
      ${criteria}
      ${active.length ? `<div class="cards">${cards}</div>` : `<div class="empty"><p>Properties you’re thinking about buying go here. Add one from your saved calculator deals, or by hand with an address and asking price.</p></div>`}
      ${bought.length ? `<p class="hint">Bought and moved to your portfolio: ${bought.map((x) => esc(x.w.name)).join(', ')}</p>` : ''}
      ${atLimit ? `<p class="hint">The free watchlist holds ${I.FREE_LIMITS.watch} properties. Pro holds as many as you like.</p>` : ''}`;
  }

  // Taxes --------------------------------------------------------------------------------------------

  function renderTaxes() {
    const list = props();
    if (!list.length) return emptyWelcome();
    if (!isPro()) ui.taxYear = thisYear();
    const years = [];
    for (let y = thisYear(); y >= thisYear() - 6; y--) years.push(y);
    const rows = I.scheduleE(data, ui.taxYear);
    const head = rows.map((r) => `<th>${esc(r.property.name)}</th>`).join('');
    const line = (label, f, cls) => `<tr class="${cls || ''}"><th scope="row">${label}</th>${rows.map((r) => `<td>${money(f(r))}</td>`).join('')}</tr>`;
    const body = [line('3 · Rents received', (r) => r.income)]
      .concat(I.SCHEDULE_E.map((c) => line(`${c.line} · ${esc(c.name)}`, (r) => r.lines[c.name] || 0)))
      .concat([line('20 · Total expenses', (r) => r.totalExpenses, 'total'), line('21 · Income or loss', (r) => r.net, 'total')]).join('');
    const dep = list.map((p) => `<label>${esc(p.name)} <input type="text" inputmode="decimal" data-act="depreciation" data-id="${esc(p.id)}" value="${esc(((p.depreciation || {})[ui.taxYear]) || '')}" placeholder="$ from your preparer"></label>`).join('');
    return `<div class="ig-row ig-toolbar"><h3>Schedule E totals${hb('Schedule E totals')}</h3>
        <label class="inline">Tax year <select data-act="tax-year">${years.map((y) => `<option ${y === ui.taxYear ? 'selected' : ''} ${y !== thisYear() && !isPro() ? 'disabled' : ''}>${y}${y !== thisYear() && !isPro() ? ' (Pro)' : ''}</option>`).join('')}</select></label></div>
      <p class="ig-taxnote">${esc(I.TAX_NOTE)}</p>
      <div class="table-scroll"><table class="ig-table ig-tax"><thead><tr><th>Line</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <details class="ig-dep"><summary>Depreciation (optional)</summary><p class="hint">EquityFoundry doesn’t calculate depreciation. If your preparer gives you a yearly figure, type it here and it’s added to line 18.</p><div class="ig-grid">${dep}</div></details>
      <div class="ig-row ig-exports">
        <button type="button" class="primary" data-act="tax-csv">Download CSV${isPro() ? '' : ' ' + LOCK}</button>
        <button type="button" data-act="tax-pdf">Download PDF${isPro() ? '' : ' ' + LOCK}</button>
        <button type="button" data-act="entries-csv">All ${ui.taxYear} entries (CSV)</button>
        <button type="button" class="link" data-act="export-all">Download everything (JSON backup)</button>
      </div>`;
  }

  // Maintenance log -------------------------------------------------------------------------------------

  function renderLog() {
    if (!isPro()) return lockedPanel('Maintenance log', 'Keep a searchable history of every repair: date, vendor, cost, notes and photos, per property.', 'Pro adds the maintenance log with photos.');
    const list = props();
    if (!list.length) return emptyWelcome();
    const q = (ui.logQuery || '').toLowerCase();
    const items = I.live(data.maint)
      .filter((m) => !q || [m.vendor, m.notes, propName(m.propertyId)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const rows = items.map((m) => `<tr><td>${esc(m.date)}</td><td>${esc(propName(m.propertyId))}</td><td>${esc(m.vendor || '—')}</td>
      <td>${esc(m.notes || '')}</td><td class="num">${money2(m.cost)}</td>
      <td class="ig-row-actions">${(m.photos || []).map((id) => `<button type="button" class="icon" data-act="receipt" data-id="${esc(id)}" aria-label="View photo">📷</button>`).join('')}
        <button type="button" class="icon" data-act="edit-maint" data-id="${esc(m.id)}" aria-label="Edit">✎</button>
        <button type="button" class="icon" data-act="delete-maint" data-id="${esc(m.id)}" aria-label="Delete">×</button></td></tr>`).join('');
    return `<div class="ig-row ig-toolbar"><h3>Maintenance log${hb('Maintenance log')}</h3>
        <div class="ig-row"><input type="search" data-act="log-search" placeholder="Search vendor, notes, property" value="${esc(ui.logQuery || '')}">
        <button type="button" class="primary" data-act="add-maint">+ Log a repair</button></div></div>
      ${items.length ? `<div class="table-scroll"><table class="ig-table"><thead><tr><th>Date</th><th>Property</th><th>Vendor</th><th>Notes</th><th class="num">Cost</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="empty"><p>${q ? 'No repairs match that search.' : 'No repairs logged yet. When something gets fixed, log it here: you’ll thank yourself when the water heater goes again.'}</p></div>`}`;
  }

  function editMaint(existing) {
    const m = existing || {};
    const list = props();
    openDialog(existing ? 'Edit repair' : 'Log a repair', `
      <div class="ig-grid">
        <label>Property <select name="propertyId">${propertyOptions(m.propertyId || ui.property || (list[0] && list[0].id))}</select></label>
        <label>Date <input type="date" name="date" value="${esc(m.date || I.today())}"></label>
        <label>Vendor <input type="text" name="vendor" value="${esc(m.vendor || '')}" placeholder="e.g. ABC Plumbing"></label>
        <label>Cost <input type="text" name="cost" inputmode="decimal" value="${esc(m.cost || '')}"></label>
      </div>
      <label>Notes <input type="text" name="notes" value="${esc(m.notes || '')}" placeholder="What was fixed, warranty, unit"></label>
      <label class="ig-file">Photos <input type="file" name="photos" accept="image/*" multiple></label>
      ${existing ? '' : '<label class="ap-toggle"><input type="checkbox" name="asExpense" checked><span><b>Also log the cost as a Repairs expense</b><small>So it counts in your totals and Schedule E.</small></span></label>'}`, async (form) => {
      const fields = {
        propertyId: form.elements.propertyId.value, date: form.elements.date.value || I.today(),
        vendor: form.elements.vendor.value.trim(), cost: Math.abs(num(form.elements.cost.value)), notes: form.elements.notes.value.trim(),
      };
      const files = [...(form.elements.photos.files || [])];
      const photos = files.length ? await saveReceiptFiles(files) : [];
      if (existing) touch(existing, Object.assign(fields, { photos: (existing.photos || []).concat(photos) }));
      else {
        data.maint.push(Object.assign({ id: I.newId('m'), photos, updatedAt: Date.now() }, fields));
        if (form.elements.asExpense && form.elements.asExpense.checked && fields.cost) {
          data.entries.push(I.makeEntry({ type: 'expense', category: 'Repairs', amount: fields.cost, date: fields.date, propertyId: fields.propertyId, memo: [fields.vendor, fields.notes].filter(Boolean).join(' · '), receiptId: photos[0] || '' }));
        }
      }
      save();
    }, { submitLabel: existing ? 'Save' : 'Log it', ctx: 'maint' });
  }

  // CSV import --------------------------------------------------------------------------------------------

  let imp = null; // { headers, rows, mapping, signature, txs, choices }

  function renderImport() {
    if (!isPro()) return lockedPanel('Import a bank CSV', 'Download a CSV from your bank, map the columns once, and tag each row to a property and category. Ingot remembers your rules, like “HOME DEPOT” = Repairs.', 'Pro adds CSV import with saved rules.');
    if (!props().length) return emptyWelcome();
    if (!imp) {
      return `<div class="ig-import">
        <h3>Import a bank or card export${hb('Import')}</h3>
        <p>In your bank’s website, find <b>Download</b> or <b>Export</b> on the account’s transactions and choose <b>CSV</b>. Then pick the file here.</p>
        <label class="ig-file big">Choose a CSV file <input type="file" accept=".csv,text/csv,text/plain" data-act="import-file"></label>
        <p class="hint">Nothing is uploaded: the file is read on your device. Rows you’ve imported before are flagged so you don’t double-count.</p>
        ${rulesList()}
      </div>`;
    }
    const m = imp.mapping;
    const colSelect = (key, label, optional) => `<label>${label} <select data-map="${key}">${optional ? '<option value="-1">—</option>' : ''}${imp.headers.map((h, k) => `<option value="${k}" ${m[key] === k ? 'selected' : ''}>${esc(h || `Column ${k + 1}`)}</option>`).join('')}</select></label>`;
    const txs = imp.txs;
    const existing = new Set(I.live(data.entries).map(I.dedupeKey));
    const rows = txs.map((t, k) => {
      const ch = imp.choices[k];
      const dup = existing.has(I.dedupeKey({ date: t.date, amount: t.amount, memo: t.description }));
      return `<tr class="${dup ? 'dup' : ''}" data-row="${k}">
        <td><input type="checkbox" data-ch="include" ${ch.include ? 'checked' : ''} aria-label="Import this row"></td>
        <td class="nowrap">${esc(t.date)}</td><td class="ig-desc">${esc(t.description)}${dup ? '<div class="hint">Looks already imported</div>' : ''}</td>
        <td class="num ${t.amount > 0 ? 'pos' : 'neg'}">${money2(t.amount)}</td>
        <td><select data-ch="propertyId">${propertyOptions(ch.propertyId, { none: true })}</select></td>
        <td><select data-ch="type">${typeOptions(ch.type)}</select></td>
        <td><select data-ch="category">${categoryOptions(ch.type, ch.category)}</select></td>
        <td><label class="ig-rule" title="Remember this for next time"><input type="checkbox" data-ch="rule" ${ch.rule ? 'checked' : ''}> ${esc(I.ruleKeyword(t.description) || '—')}</label></td></tr>`;
    }).join('');
    const count = imp.choices.filter((c) => c.include).length;
    return `<div class="ig-import">
      <div class="ig-row ig-toolbar"><h3>Map the columns</h3><button type="button" class="link" data-act="import-cancel">Start over</button></div>
      <div class="ig-grid">${colSelect('date', 'Date')}${colSelect('description', 'Description')}${colSelect('amount', 'Amount (one column)', true)}${colSelect('debit', 'Money out', true)}${colSelect('credit', 'Money in', true)}</div>
      <label class="ap-toggle"><input type="checkbox" data-map="flip" ${m.flip ? 'checked' : ''}><span><b>Spending shows as positive numbers</b><small>Tick this for card exports where purchases aren’t negative.</small></span></label>
      <div class="ig-row"><label class="inline">Put everything on <select data-act="import-default">${propertyOptions(imp.defaultProperty, { none: true })}</select></label>
        <span class="hint">${txs.length} rows read. Saved rules are applied automatically.</span></div>
      ${txs.length ? `<div class="table-scroll"><table class="ig-table ig-import-table"><thead><tr><th></th><th>Date</th><th>Description</th><th class="num">Amount</th><th>Property</th><th>Type</th><th>Category</th><th>Remember</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="hint">No rows with a date and amount yet. Check the column choices above.</p>'}
      <div class="ig-row"><button type="button" class="primary" data-act="import-go" ${count ? '' : 'disabled'}>Import ${count} row${count === 1 ? '' : 's'}</button>
        <span class="hint">Tick <b>Remember</b> to tag that payee the same way next time.</span></div>
    </div>`;
  }

  function rulesList() {
    const rules = I.live(data.rules);
    if (!rules.length) return '';
    return `<details class="ig-rules"><summary>Saved rules (${rules.length})</summary><ul>${rules.map((r) => `<li><b>${esc(r.match)}</b> → ${esc(r.category)}${r.propertyId ? ' · ' + esc(propName(r.propertyId)) : ''}
      <button type="button" class="icon" data-act="delete-rule" data-id="${esc(r.id)}" aria-label="Delete rule">×</button></li>`).join('')}</ul></details>`;
  }

  function buildImportRows() {
    imp.txs = I.rowsToTransactions(imp.rows, imp.mapping);
    const existing = new Set(I.live(data.entries).map(I.dedupeKey));
    imp.choices = imp.txs.map((t) => {
      const s = I.suggestEntry(t, data.rules, imp.defaultProperty);
      const dup = existing.has(I.dedupeKey({ date: t.date, amount: t.amount, memo: t.description }));
      return Object.assign(s, { include: !dup && s.type !== 'transfer' ? true : !dup, rule: false });
    });
  }

  function startImport(text) {
    const all = I.parseCsv(text);
    if (!all.length) { toast('That file looks empty.'); return; }
    const h = I.findHeaderRow(all);
    const headers = all[h];
    const signature = I.headerSignature(headers);
    const saved = data.mappings[signature];
    imp = { headers, rows: all.slice(h + 1), signature, mapping: Object.assign(I.guessMapping(headers), saved || {}), defaultProperty: props().length === 1 ? props()[0].id : '' };
    buildImportRows();
    render();
  }

  function wireImport() {
    const el = root();
    const file = el.querySelector('[data-act="import-file"]');
    if (file) file.onchange = () => { const f = file.files[0]; if (f) f.text().then(startImport); };
    el.querySelectorAll('[data-map]').forEach((s) => {
      s.onchange = () => {
        const key = s.dataset.map;
        imp.mapping[key] = key === 'flip' ? s.checked : Number(s.value);
        if (key === 'amount' && imp.mapping.amount >= 0) { imp.mapping.debit = -1; imp.mapping.credit = -1; }
        buildImportRows();
        render();
      };
    });
    el.querySelectorAll('tr[data-row]').forEach((tr) => {
      const k = Number(tr.dataset.row);
      tr.querySelectorAll('[data-ch]').forEach((input) => {
        input.onchange = () => {
          const ch = imp.choices[k];
          const key = input.dataset.ch;
          ch[key] = input.type === 'checkbox' ? input.checked : input.value;
          if (key === 'type') { ch.category = I.TYPES[ch.type].categories[0]; tr.querySelector('[data-ch=category]').innerHTML = categoryOptions(ch.type); }
          if (key === 'include') {
            const n = imp.choices.filter((c) => c.include).length;
            const go = el.querySelector('[data-act="import-go"]');
            go.textContent = `Import ${n} row${n === 1 ? '' : 's'}`;
            go.disabled = !n;
          }
        };
      });
    });
  }

  function finishImport() {
    let added = 0;
    const newRules = [];
    imp.txs.forEach((t, k) => {
      const ch = imp.choices[k];
      if (!ch.include) return;
      data.entries.push(I.makeEntry({ type: ch.type, category: ch.category, propertyId: ch.propertyId, amount: Math.abs(t.amount), date: t.date, memo: t.description, source: 'csv' }));
      added++;
      const kw = I.ruleKeyword(t.description);
      if (ch.rule && kw && !I.live(data.rules).some((r) => r.match.toLowerCase() === kw.toLowerCase()) && !newRules.some((r) => r.match === kw)) {
        newRules.push({ id: I.newId('r'), match: kw, type: ch.type, category: ch.category, propertyId: ch.propertyId, updatedAt: Date.now() });
      }
    });
    data.rules.push(...newRules);
    const { date, description, amount, debit, credit, flip } = imp.mapping;
    data.mappings[imp.signature] = { date, description, amount, debit, credit, flip: !!flip };
    imp = null;
    save();
    toast(`Imported ${added} row${added === 1 ? '' : 's'}${newRules.length ? ` and saved ${newRules.length} rule${newRules.length === 1 ? '' : 's'}` : ''}`);
    ui.tab = 'month';
    render();
  }

  // ---- exports ---------------------------------------------------------------------------------

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function taxPdf() {
    const year = ui.taxYear;
    const rows = I.scheduleE(data, year);
    await window.Report.loadLibs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: rows.length > 3 ? 'landscape' : 'portrait' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 22, 48); doc.rect(0, 0, W, 46, 'F');
    doc.setFillColor(196, 150, 72); doc.rect(0, 46, W, 2, 'F');
    doc.setFont('times', 'bold'); doc.setFontSize(17); doc.setTextColor(242, 238, 228);
    doc.text('Equity', 40, 29); doc.setTextColor(196, 150, 72); doc.text('Foundry', 40 + doc.getTextWidth('Equity'), 29);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20);
    doc.text(`Schedule E totals, ${year}`, 40, 80);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
    doc.text(I.TAX_NOTE, 40, 96);
    const body = [['3', 'Rents received'].concat(rows.map((r) => money2(r.income)))]
      .concat(I.SCHEDULE_E.map((c) => [String(c.line), c.name].concat(rows.map((r) => money2(r.lines[c.name] || 0)))))
      .concat([['20', 'Total expenses'].concat(rows.map((r) => money2(r.totalExpenses))), ['21', 'Income or loss'].concat(rows.map((r) => money2(r.net)))]);
    doc.autoTable({
      startY: 110, head: [['Line', 'Item'].concat(rows.map((r) => r.property.name))], body, theme: 'plain', margin: { left: 40, right: 40 },
      styles: { fontSize: 9, cellPadding: 4, textColor: 30 }, headStyles: { fillColor: [11, 22, 48], textColor: 255, fontStyle: 'bold' },
      didParseCell: (d) => {
        if (d.column.index > 1) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.row.index >= body.length - 2) d.cell.styles.fontStyle = 'bold';
      },
    });
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`Made with ${I.NAME} in EquityFoundry by OctoPisces Labs · ${new Date().toLocaleDateString()}`, 40, h - 20);
    const name = `schedule-e-${year}.pdf`;
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) {
      const Filesystem = Cap.registerPlugin('Filesystem');
      const Share = Cap.registerPlugin('Share');
      const { uri } = await Filesystem.writeFile({ path: name, data: doc.output('datauristring').split(',')[1], directory: 'CACHE' });
      await Share.share({ title: `Schedule E ${year}`, files: [uri], dialogTitle: 'Share Schedule E totals' });
    } else doc.save(name);
  }

  // ---- events ---------------------------------------------------------------------------------

  function find(list, id) { return data[list].find((x) => x.id === id); }

  // Tapping a dashboard tile, chart or table row opens the matching screen.
  function goTo(el) {
    if (el.dataset.goto === 'properties') ui.tab = 'properties';
    else { ui.tab = 'month'; ui.month = I.ym(new Date()); ui.property = el.dataset.id || ''; }
    render();
    window.scrollTo(0, 0);
  }
  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('#ingot [data-goto]')) { ev.preventDefault(); goTo(ev.target); }
  });

  document.addEventListener('click', async (ev) => {
    const el = root();
    if (!el || !el.contains(ev.target)) return;
    const tab = ev.target.closest('[data-tab]');
    if (tab) { ui.tab = tab.dataset.tab; render(); window.scrollTo(0, 0); return; }
    const period = ev.target.closest('[data-period]');
    if (period) {
      if (period.dataset.period === 'last12' && !(await proGate('Pro adds the last-12-months view and earlier years.'))) return;
      ui.period = period.dataset.period; render(); return;
    }
    const b = ev.target.closest('button[data-act]');
    const go = !b && ev.target.closest('[data-goto]');
    if (go) { goTo(go); return; }
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'quick-add':
        if (!props().length) { editProperty(); toast('Add a property first, then log its rent and bills.'); } else quickAdd({ propertyId: id || '' });
        break;
      case 'add-property': editProperty(); break;
      case 'edit-property': editProperty(find('properties', id)); break;
      case 'delete-property': deleteProperty(find('properties', id)); break;
      case 'open-month': ui.property = id; ui.month = I.ym(new Date()); ui.tab = 'month'; render(); break;
      case 'open-deal': window.App.openProperty(b.dataset.name); break;
      case 'month-prev': {
        const prev = I.shiftMonth(ui.month, -1);
        if (prev.slice(0, 4) < String(thisYear()) && !(await proGate('The free version shows the current year. Go Pro for earlier years.'))) return;
        ui.month = prev; render(); break;
      }
      case 'month-next': ui.month = I.shiftMonth(ui.month, 1); render(); break;
      case 'edit-entry': quickAdd({}, find('entries', id)); break;
      case 'delete-entry': {
        const e = find('entries', id);
        if (e && confirm(`Delete this ${money2(e.amount)} ${e.category} entry?`)) { remove(e); save(); render(); }
        break;
      }
      case 'receipt': openReceipt(id); break;
      case 'pro': Pro.paywall(b.dataset.reason); break;
      case 'watch-add': addWatchByHand(); break;
      case 'watch-remove': {
        const w = find('watch', id);
        if (w && confirm(`Remove “${w.name}” from your watchlist?`)) { remove(w); save(); render(); }
        break;
      }
      case 'watch-open': {
        const w = find('watch', id);
        if (!w) break;
        if (w.calcName && dealByName(w.calcName)) window.App.openProperty(w.calcName);
        else {
          window.App.startDeal(Object.assign({}, w.input || {}, { propertyName: w.name }));
          // Link the watch item to the deal once it's saved under this name.
          touch(w, { calcName: w.name }); save();
        }
        break;
      }
      case 'add-maint': editMaint(); break;
      case 'edit-maint': editMaint(find('maint', id)); break;
      case 'delete-maint': {
        const m = find('maint', id);
        if (m && confirm('Delete this repair from the log?')) { remove(m); save(); render(); }
        break;
      }
      case 'delete-rule': { const r = find('rules', id); if (r) { remove(r); save(); render(); } break; }
      case 'import-cancel': imp = null; render(); break;
      case 'import-go': finishImport(); break;
      case 'tax-csv':
        if (await proGate('Pro exports your Schedule E totals as CSV and PDF for your tax preparer.')) download(`schedule-e-${ui.taxYear}.csv`, I.scheduleECsv(data, ui.taxYear), 'text/csv');
        break;
      case 'tax-pdf':
        if (await proGate('Pro exports your Schedule E totals as CSV and PDF for your tax preparer.')) taxPdf().catch(() => toast('Couldn’t make the PDF. Check your connection and try again.'));
        break;
      case 'entries-csv': download(`ingot-entries-${ui.taxYear}.csv`, I.entriesCsv(data, I.periodRange('year', String(ui.taxYear))), 'text/csv'); break;
      case 'export-all': download(`ingot-backup-${I.today()}.json`, JSON.stringify(data, null, 2), 'application/json'); break;
      default: break;
    }
  });

  document.addEventListener('change', (ev) => {
    const el = root();
    if (!el || !el.contains(ev.target)) return;
    const t = ev.target;
    const act = t.dataset && t.dataset.act;
    if (act === 'property-from-deal' && t.value) editProperty(null, t.value);
    if (act === 'watch-from-deal' && t.value) { watchDeal(t.value); render(); }
    if (act === 'month-property') { ui.property = t.value; render(); }
    if (act === 'import-default') {
      imp.defaultProperty = t.value;
      imp.choices.forEach((c) => { if (!c.ruleId) c.propertyId = t.value; });
      render();
    }
    if (act === 'tax-year') { ui.taxYear = Number(t.value); render(); }
    if (act === 'depreciation') {
      const p = find('properties', t.dataset.id);
      if (p) { touch(p, { depreciation: Object.assign({}, p.depreciation, { [ui.taxYear]: Math.abs(num(t.value)) }) }); save(); render(); }
    }
    if (act === 'watch-status') {
      const w = find('watch', t.dataset.id);
      if (!w) return;
      if (t.value === 'bought') { const row = watchRows().find((x) => x.w.id === w.id); t.value = w.status; markBought(row); return; }
      if (t.value === 'passed') {
        const reason = prompt('Why did you pass? (optional, helps you remember)') || '';
        touch(w, { status: 'passed', passReason: reason.trim() });
      } else touch(w, { status: t.value, passReason: '' });
      save(); render();
    }
  });

  document.addEventListener('input', (ev) => {
    const el = root();
    if (!el || !el.contains(ev.target)) return;
    if (ev.target.dataset.act === 'log-search') {
      ui.logQuery = ev.target.value;
      const pos = ev.target.selectionStart;
      render();
      const s = root().querySelector('[data-act="log-search"]');
      if (s) { s.focus(); s.setSelectionRange(pos, pos); }
    }
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target;
    if (!form.matches || !form.matches('[data-form="criteria"]')) return;
    ev.preventDefault();
    const read = (name, scale) => { const v = form.elements[name].value.trim(); return v === '' ? null : num(v) / scale; };
    data.criteria = { minCashFlow: read('minCashFlow', 1), minCoc: read('minCoc', 100), minCap: read('minCap', 100), updatedAt: Date.now() };
    save();
    render();
    toast('Criteria saved');
  });

  // Saved deals changed in the calculator: watchlist numbers are live.
  ['rental-calc:saved-changed', 'rental-calc:deals-changed'].forEach((n) => document.addEventListener(n, () => { if (isOpen()) render(); }));
  if (Pro.onChange) Pro.onChange(() => { if (isOpen()) render(); });
  if (Account && Account.onChange) Account.onChange((user) => { if (user) sync(); if (isOpen()) render(); });
  window.addEventListener('storage', (ev) => { if (ev.key === KEY) { data = load(); if (isOpen()) render(); } });

  window.Ingot = {
    render,
    watchDeal,
    open(tab) { if (tab) ui.tab = tab; render(); },
    // Opening the Ingot tab always lands on the dashboard.
    show() { ui.tab = 'dash'; imp = null; render(); },
    data: () => data,
    sync,
  };
})();
