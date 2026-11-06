// Ingot: the rental portfolio tracker inside EquityFoundry. This file is the
// logic only (no screen code), so it can be tested in Node: the data model,
// period math, dashboard totals, CSV import, Schedule E totals, watchlist
// criteria and sync merging. The screens are in ingot.js.
(function (root) {
  'use strict';

  const NAME = 'Ingot';

  // ---- categories -----------------------------------------------------------

  // Expense categories follow the IRS Schedule E (Form 1040) lines 5–19.
  // Check them against the current form before each tax season.
  const SCHEDULE_E = [
    { line: 5, name: 'Advertising' },
    { line: 6, name: 'Auto and travel' },
    { line: 7, name: 'Cleaning and maintenance' },
    { line: 8, name: 'Commissions' },
    { line: 9, name: 'Insurance' },
    { line: 10, name: 'Legal and other professional fees' },
    { line: 11, name: 'Management fees' },
    { line: 12, name: 'Mortgage interest paid to banks' },
    { line: 13, name: 'Other interest' },
    { line: 14, name: 'Repairs' },
    { line: 15, name: 'Supplies' },
    { line: 16, name: 'Taxes' },
    { line: 17, name: 'Utilities' },
    { line: 18, name: 'Depreciation expense or depletion' },
    { line: 19, name: 'Other' },
  ];

  const TYPES = {
    income: { label: 'Income', categories: ['Rent', 'Late fees', 'Pet fees', 'Laundry and parking', 'Kept deposit', 'Other income'] },
    expense: { label: 'Expense', categories: SCHEDULE_E.map((c) => c.name) },
    // Money taken out by owners. Kept apart so it never lowers the tax numbers.
    distribution: { label: 'Distribution', categories: ['Owner draw', 'Partner payout'] },
    // Neither income nor an expense: loan principal, moving money between accounts.
    transfer: { label: 'Not income or expense', categories: ['Loan principal', 'Security deposit held', 'Transfer between accounts', 'Capital improvement'] },
  };

  const FREE_LIMITS = { properties: 1, watch: 3 };

  // ---- ids, dates and money --------------------------------------------------

  let idSeq = 0;
  function newId(prefix) {
    idSeq = (idSeq + 1) % 1e6;
    return (prefix || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + idSeq.toString(36);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const today = () => ymd(new Date());

  function parseYmd(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function lastDayOfMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function monthKeys(endDate, count) {
    const out = [];
    for (let k = count - 1; k >= 0; k--) out.push(ym(new Date(endDate.getFullYear(), endDate.getMonth() - k, 1)));
    return out;
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthLabel(key, long) {
    const [y, m] = key.split('-').map(Number);
    if (long) return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return MONTH_NAMES[m - 1];
  }

  // Dashboard periods. Dates are inclusive YYYY-MM-DD strings, so they compare
  // as text.
  function periodRange(kind, now) {
    const d = now ? new Date(now) : new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    if (kind === 'quarter') {
      const q = Math.floor(m / 3);
      return { kind, start: `${y}-${pad(q * 3 + 1)}-01`, end: `${y}-${pad(q * 3 + 3)}-${lastDayOfMonth(y, q * 3 + 2)}`, months: 3, label: `Q${q + 1} ${y}` };
    }
    if (kind === 'ytd') return { kind, start: `${y}-01-01`, end: ymd(d), months: m + 1, label: `${y} so far` };
    if (kind === 'last12') {
      const s = new Date(y, m - 11, 1);
      return { kind, start: ymd(s), end: `${y}-${pad(m + 1)}-${lastDayOfMonth(y, m)}`, months: 12, label: 'Last 12 months' };
    }
    if (kind === 'year') {
      const yr = now && /^\d{4}$/.test(String(now)) ? +now : y;
      return { kind, start: `${yr}-01-01`, end: `${yr}-12-31`, months: 12, label: String(yr) };
    }
    return { kind: 'month', start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${lastDayOfMonth(y, m)}`, months: 1, label: monthLabel(ym(d), true) };
  }

  function monthRange(key) {
    const [y, m] = key.split('-').map(Number);
    return { kind: 'month', start: `${key}-01`, end: `${key}-${pad(lastDayOfMonth(y, m - 1))}`, months: 1, label: monthLabel(key, true) };
  }

  function shiftMonth(key, delta) {
    const [y, m] = key.split('-').map(Number);
    return ym(new Date(y, m - 1 + delta, 1));
  }

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // "$1,234.56", "(12.00)", "-12", "12.00-", "1.234,56" (European) → number
  function parseAmount(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    s = s.replace(/[^\d.,-]/g, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  // Bank dates: 2026-03-04, 03/04/2026, 3/4/26, 2026/03/04, 04.03.2026 (DMY)
  function parseDate(v) {
    const s = String(v == null ? '' : v).trim();
    let m;
    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s))) {
      let y = +m[3];
      if (y < 100) y += 2000;
      return `${y}-${pad(+m[1])}-${pad(+m[2])}`;
    }
    if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s))) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    const t = Date.parse(s);
    return isFinite(t) ? ymd(new Date(t)) : null;
  }

  // ---- data -------------------------------------------------------------------

  function emptyData() {
    return {
      version: 1,
      properties: [],
      entries: [],
      watch: [],
      maint: [],
      rules: [],
      mappings: {},
      criteria: { minCashFlow: 200, minCoc: 0.08, minCap: 0.06, updatedAt: 0 },
      updatedAt: 0,
    };
  }

  function normalize(raw) {
    const d = Object.assign(emptyData(), raw && typeof raw === 'object' ? raw : {});
    ['properties', 'entries', 'watch', 'maint', 'rules'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.mappings || typeof d.mappings !== 'object') d.mappings = {};
    d.criteria = Object.assign(emptyData().criteria, d.criteria || {});
    return d;
  }

  const live = (list) => list.filter((x) => !x.deleted);

  function makeProperty(fields) {
    const units = Math.max(1, Math.round(Number(fields.units) || 1));
    return Object.assign({
      id: newId('p'), name: 'Property', address: '', units, occupied: units,
      expectedRent: 0, purchasePrice: 0, purchaseDate: '', listingUrl: '', calcName: '', notes: '',
    }, fields, { units, updatedAt: Date.now() });
  }

  function makeEntry(fields) {
    const type = TYPES[fields.type] ? fields.type : 'expense';
    return Object.assign({
      id: newId('e'), propertyId: '', date: today(), amount: 0, category: TYPES[type].categories[0],
      memo: '', receiptId: '', source: 'manual',
    }, fields, { type, amount: Math.abs(round2(fields.amount)), updatedAt: Date.now() });
  }

  // ---- dashboard math ---------------------------------------------------------

  const inRange = (date, r) => date >= r.start && date <= r.end;

  function summarize(data, range, propertyId) {
    const out = {
      income: 0, expense: 0, distribution: 0, transfer: 0, rent: 0, count: 0,
      byCategory: {}, byProperty: {},
    };
    const props = live(data.properties);
    props.forEach((p) => { out.byProperty[p.id] = { income: 0, expense: 0, rent: 0, distribution: 0 }; });
    for (const e of live(data.entries)) {
      if (!inRange(e.date, range)) continue;
      if (propertyId && e.propertyId !== propertyId) continue;
      out.count += 1;
      out[e.type] += e.amount;
      const bp = out.byProperty[e.propertyId] || (out.byProperty[e.propertyId] = { income: 0, expense: 0, rent: 0, distribution: 0 });
      if (e.type === 'income') {
        bp.income += e.amount;
        if (e.category === 'Rent') { out.rent += e.amount; bp.rent += e.amount; }
      }
      if (e.type === 'expense') {
        bp.expense += e.amount;
        out.byCategory[e.category] = (out.byCategory[e.category] || 0) + e.amount;
      }
      if (e.type === 'distribution') bp.distribution += e.amount;
    }
    out.net = out.income - out.expense;
    out.kept = out.net - out.distribution;
    Object.values(out.byProperty).forEach((b) => { b.net = b.income - b.expense; });
    const scope = propertyId ? props.filter((p) => p.id === propertyId) : props;
    out.expectedRent = scope.reduce((a, p) => a + (Number(p.expectedRent) || 0), 0) * (range.months || 1);
    out.units = scope.reduce((a, p) => a + (Number(p.units) || 0), 0);
    out.occupied = scope.reduce((a, p) => a + Math.min(Number(p.units) || 0, Number(p.occupied) || 0), 0);
    return out;
  }

  function topCategories(byCategory, n) {
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, n);
    const rest = sorted.slice(n).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) top.push(['Everything else', rest]);
    return top;
  }

  function monthlySeries(data, months, propertyId) {
    return months.map((key) => {
      const s = summarize(data, monthRange(key), propertyId);
      return { month: key, income: s.income, expense: s.expense, net: s.net };
    });
  }

  // ---- Schedule E ----------------------------------------------------------------

  function scheduleE(data, year) {
    const range = periodRange('year', String(year));
    const props = live(data.properties);
    const rows = props.map((p) => ({ property: p, rents: 0, otherIncome: 0, lines: {}, totalExpenses: 0, net: 0 }));
    const byId = Object.fromEntries(rows.map((r) => [r.property.id, r]));
    const unassigned = { property: { id: '', name: 'Not assigned to a property' }, rents: 0, otherIncome: 0, lines: {}, totalExpenses: 0, net: 0 };
    for (const e of live(data.entries)) {
      if (!inRange(e.date, range)) continue;
      const row = byId[e.propertyId] || unassigned;
      if (e.type === 'income') {
        if (e.category === 'Rent') row.rents += e.amount; else row.otherIncome += e.amount;
      } else if (e.type === 'expense') {
        row.lines[e.category] = (row.lines[e.category] || 0) + e.amount;
        row.totalExpenses += e.amount;
      }
    }
    // Depreciation the person typed in for the year (the app doesn't calculate it).
    props.forEach((p) => {
      const dep = Number((p.depreciation || {})[year]) || 0;
      if (dep > 0) {
        const row = byId[p.id];
        row.lines['Depreciation expense or depletion'] = (row.lines['Depreciation expense or depletion'] || 0) + dep;
        row.totalExpenses += dep;
      }
    });
    const all = unassigned.rents || unassigned.otherIncome || unassigned.totalExpenses ? rows.concat([unassigned]) : rows;
    all.forEach((r) => { r.income = r.rents + r.otherIncome; r.net = r.income - r.totalExpenses; });
    return all;
  }

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

  const TAX_NOTE = 'Totals of the categories you chose. Not tax advice: confirm with your tax preparer.';

  function scheduleECsv(data, year) {
    const rows = scheduleE(data, year);
    const out = [[`Schedule E totals ${year}`, TAX_NOTE], []];
    out.push(['Line', 'Item'].concat(rows.map((r) => r.property.name)));
    out.push(['3', 'Rents received'].concat(rows.map((r) => round2(r.income).toFixed(2))));
    SCHEDULE_E.forEach((c) => out.push([String(c.line), c.name].concat(rows.map((r) => round2(r.lines[c.name] || 0).toFixed(2)))));
    out.push(['20', 'Total expenses'].concat(rows.map((r) => round2(r.totalExpenses).toFixed(2))));
    out.push(['21', 'Income or loss'].concat(rows.map((r) => round2(r.net).toFixed(2))));
    return toCsv(out);
  }

  function entriesCsv(data, range) {
    const props = Object.fromEntries(data.properties.map((p) => [p.id, p.name]));
    const rows = [['Date', 'Property', 'Type', 'Category', 'Amount', 'Memo']];
    live(data.entries)
      .filter((e) => !range || inRange(e.date, range))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .forEach((e) => rows.push([e.date, props[e.propertyId] || '', TYPES[e.type].label, e.category, round2(e.amount).toFixed(2), e.memo || '']));
    return toCsv(rows);
  }

  // ---- CSV import -------------------------------------------------------------------

  function detectDelimiter(text) {
    const first = (text.split(/\r?\n/).find((l) => l.trim()) || '');
    const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 1 ? counts[0][0] : ',';
  }

  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    const delim = detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === delim) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()));
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()));
    return rows;
  }

  // Many bank exports put a few lines of account info above the real header.
  function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const lower = rows[i].map((c) => c.toLowerCase());
      if (lower.some((c) => /date/.test(c)) && lower.some((c) => /amount|debit|credit|withdraw|deposit/.test(c))) return i;
    }
    return 0;
  }

  const headerSignature = (headers) => headers.map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim()).join('|');

  function guessMapping(headers) {
    const find = (re) => headers.findIndex((h) => re.test(h.toLowerCase()));
    const m = {
      date: find(/^(transaction |posted |posting |trans\.? )?date|date$/),
      description: find(/desc|payee|merchant|name|memo|details|narrative/),
      amount: find(/^amount|amount$|^amt/),
      debit: find(/debit|withdraw|money out|paid out/),
      credit: find(/credit|deposit|money in|paid in/),
    };
    if (m.date < 0) m.date = find(/date/);
    if (m.amount >= 0) { m.debit = -1; m.credit = -1; }
    return m;
  }

  // Signed amounts: positive is money in, negative is money out.
  function rowsToTransactions(rows, mapping) {
    const out = [];
    for (const r of rows) {
      const date = parseDate(r[mapping.date]);
      let amount = null;
      if (mapping.amount >= 0) {
        amount = parseAmount(r[mapping.amount]);
        if (amount !== null && mapping.flip) amount = -amount;
      } else {
        const debit = mapping.debit >= 0 ? parseAmount(r[mapping.debit]) : null;
        const credit = mapping.credit >= 0 ? parseAmount(r[mapping.credit]) : null;
        if (debit) amount = -Math.abs(debit);
        else if (credit) amount = Math.abs(credit);
      }
      if (!date || amount === null || amount === 0) continue;
      out.push({ date, amount: round2(amount), description: mapping.description >= 0 ? (r[mapping.description] || '') : '' });
    }
    return out;
  }

  function matchRule(description, rules) {
    const d = String(description || '').toLowerCase();
    return live(rules || []).find((rule) => rule.match && d.includes(String(rule.match).toLowerCase())) || null;
  }

  // What an imported row becomes before the person reviews it.
  function suggestEntry(tx, rules, defaultPropertyId) {
    const rule = matchRule(tx.description, rules);
    if (rule) {
      return { type: rule.type, category: rule.category, propertyId: rule.propertyId || defaultPropertyId || '', ruleId: rule.id };
    }
    return tx.amount > 0
      ? { type: 'income', category: 'Rent', propertyId: defaultPropertyId || '' }
      : { type: 'expense', category: 'Repairs', propertyId: defaultPropertyId || '' };
  }

  // A short, reusable keyword from a bank description: "HOME DEPOT #4521 RENO NV" → "HOME DEPOT"
  function ruleKeyword(description) {
    const words = String(description || '').toUpperCase().replace(/[#*]\S*/g, ' ').replace(/\d+/g, ' ').split(/\s+/).filter((w) => w.length > 1);
    return words.slice(0, 2).join(' ').trim();
  }

  const dedupeKey = (e) => `${e.date}|${round2(Math.abs(e.amount)).toFixed(2)}|${String(e.memo || e.description || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;

  // ---- watchlist ---------------------------------------------------------------------

  const CRITERIA = [
    { key: 'minCashFlow', metric: 'monthlyCashFlow', label: 'Cash flow', money: true },
    { key: 'minCoc', metric: 'cashOnCash', label: 'Cash-on-cash' },
    { key: 'minCap', metric: 'capRate', label: 'Cap rate' },
  ];

  const isSet = (v) => v !== null && v !== undefined && v !== '' && isFinite(v);

  function checkCriteria(result, criteria) {
    const checks = [];
    for (const c of CRITERIA) {
      const target = criteria[c.key];
      if (!isSet(target)) continue;
      const value = result ? result[c.metric] : null;
      const known = value !== null && value !== undefined && (isFinite(value) || value === Infinity);
      const pass = known && value >= target;
      const margin = Math.max(Math.abs(target) * 0.2, c.money ? 50 : 0.01);
      const near = known && !pass && value >= target - margin;
      checks.push({ key: c.key, label: c.label, value: known ? value : null, target: Number(target), pass, near, money: !!c.money });
    }
    let status = null;
    if (checks.length) {
      if (checks.every((c) => c.pass)) status = 'green';
      else if (checks.every((c) => c.pass || c.near)) status = 'amber';
      else status = 'red';
    }
    return { status, checks };
  }

  const meets = (result, criteria) => {
    const r = checkCriteria(result, criteria);
    return r.checks.length > 0 && r.status === 'green';
  };

  // The highest price at which the deal still meets every criterion, holding the
  // rest of the inputs fixed. Null when no price works (rent can't cover it).
  function targetPrice(input, criteria, analyze) {
    if (!input || !(input.purchasePrice > 0) || !CRITERIA.some((c) => isSet(criteria[c.key]))) return null;
    const at = (price) => {
      const i = Object.assign({}, input, { purchasePrice: price });
      if (!input.fullValue || input.fullValue === input.purchasePrice) i.fullValue = price;
      return analyze(i);
    };
    let lo = 1000;
    if (!meets(at(lo), criteria)) return null;
    let hi = Math.max(input.purchasePrice * 2, 50000);
    if (meets(at(hi), criteria)) return hi;
    for (let k = 0; k < 40 && hi - lo > 100; k++) {
      const mid = (lo + hi) / 2;
      if (meets(at(mid), criteria)) lo = mid; else hi = mid;
    }
    return Math.floor(lo / 500) * 500;
  }

  const WATCH_STATUS = { watching: 'Watching', offer: 'Offer made', passed: 'Passed', bought: 'Bought' };

  // ---- sync merge ----------------------------------------------------------------------

  // Each list item carries an id and updatedAt; deletes keep a tombstone
  // ({ deleted: true }) so they sync too. The newer copy of each item wins.
  function mergeLists(a, b) {
    const byId = new Map();
    for (const item of (a || []).concat(b || [])) {
      if (!item || !item.id) continue;
      const prev = byId.get(item.id);
      if (!prev || (item.updatedAt || 0) > (prev.updatedAt || 0)) byId.set(item.id, item);
    }
    return [...byId.values()];
  }

  function mergeData(local, remote) {
    const a = normalize(local);
    const b = normalize(remote);
    const out = normalize({});
    ['properties', 'entries', 'watch', 'maint', 'rules'].forEach((k) => { out[k] = mergeLists(a[k], b[k]); });
    out.mappings = Object.assign({}, b.mappings, a.mappings);
    out.criteria = (a.criteria.updatedAt || 0) >= (b.criteria.updatedAt || 0) ? a.criteria : b.criteria;
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    return out;
  }

  // Tombstones older than 90 days have synced everywhere that matters.
  function prune(data, now) {
    const cutoff = (now || Date.now()) - 90 * 864e5;
    ['properties', 'entries', 'watch', 'maint', 'rules'].forEach((k) => {
      data[k] = data[k].filter((x) => !x.deleted || (x.updatedAt || 0) > cutoff);
    });
    return data;
  }

  const api = {
    NAME, SCHEDULE_E, TYPES, FREE_LIMITS, CRITERIA, WATCH_STATUS, TAX_NOTE,
    newId, today, ymd, ym, parseYmd, monthKeys, monthLabel, periodRange, monthRange, shiftMonth,
    parseAmount, parseDate, round2,
    emptyData, normalize, live, makeProperty, makeEntry,
    summarize, topCategories, monthlySeries,
    scheduleE, scheduleECsv, entriesCsv, toCsv,
    parseCsv, findHeaderRow, headerSignature, guessMapping, rowsToTransactions, matchRule, suggestEntry, ruleKeyword, dedupeKey,
    checkCriteria, targetPrice,
    mergeLists, mergeData, prune,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IngotCore = api;
})(typeof self !== 'undefined' ? self : this);
