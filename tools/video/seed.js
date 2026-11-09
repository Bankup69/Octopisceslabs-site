// Seeds a realistic Ingot portfolio (2 properties, Dec 2025 to Nov 2026) into localStorage.
window.__seedIngot = function (opts) {
  opts = opts || {};
  const I = window.IngotCore; const d = I.emptyData();
  const P1 = I.makeProperty({ name: 'Maple Duplex', address: '418 Maple St, Reno, NV', units: 2, occupied: 2, expectedRent: 2700, purchasePrice: 320000, purchaseDate: '2023-04-15' });
  const P2 = I.makeProperty({ name: 'Elm St House', address: '92 Elm St, Fallon, NV', units: 1, occupied: 1, expectedRent: 1850, purchasePrice: 245000, purchaseDate: '2024-09-01' });
  d.properties.push(P1); if (!opts.oneProperty) d.properties.push(P2);
  const E = (type, amount, date, propertyId, category, memo) => d.entries.push(I.makeEntry({ type, amount, date, propertyId, category, memo: memo || '' }));
  const months = []; for (let m = 12; m <= 12; m++) months.push('2025-12'); for (let m = 1; m <= (opts.throughMonth || 10); m++) months.push('2026-' + String(m).padStart(2, '0'));
  months.forEach((ym) => {
    const mm = +ym.slice(5);
    E('income', 1400, ym + '-01', P1.id, 'Rent', 'Unit A');
    if (ym !== '2026-08') E('income', 1300, ym + '-03', P1.id, 'Rent', 'Unit B');
    E('expense', 1150, ym + '-05', P1.id, 'Mortgage interest paid to banks', 'Mortgage payment');
    E('transfer', 420, ym + '-05', P1.id, 'Loan principal', 'Mortgage payment');
    E('expense', 95, ym + '-20', P1.id, 'Utilities', 'Water and trash');
    if (!opts.oneProperty) {
      E('income', 1850, ym + '-01', P2.id, 'Rent');
      E('expense', 980, ym + '-05', P2.id, 'Mortgage interest paid to banks', 'Mortgage payment');
      E('transfer', 360, ym + '-05', P2.id, 'Loan principal', 'Mortgage payment');
      E('expense', 148, ym + '-02', P2.id, 'Management fees', '8% of rent');
    }
    if (ym === '2026-01') E('expense', 1320, ym + '-10', P1.id, 'Insurance', 'Annual landlord policy');
    if (ym === '2026-02' && !opts.oneProperty) E('expense', 1080, ym + '-12', P2.id, 'Insurance', 'Annual landlord policy');
    if (mm === 4 || mm === 10) { if (ym.startsWith('2026')) { E('expense', 1750, ym + '-15', P1.id, 'Taxes', 'Property tax installment'); if (!opts.oneProperty) E('expense', 1240, ym + '-15', P2.id, 'Taxes', 'Property tax installment'); } }
    if (ym === '2026-03') E('expense', 420, ym + '-18', P1.id, 'Repairs', 'Kitchen sink leak');
    if (ym === '2026-07') E('expense', 285, ym + '-22', P1.id, 'Repairs', 'Water heater valve');
    if (ym === '2026-06' && !opts.oneProperty) E('expense', 640, ym + '-09', P2.id, 'Cleaning and maintenance', 'HVAC service');
    if (ym === '2026-05' && !opts.oneProperty) E('income', 75, ym + '-06', P2.id, 'Late fees');
    if ((mm === 3 || mm === 6 || mm === 9) && ym.startsWith('2026')) E('distribution', 1500, ym + '-28', P1.id, 'Owner draw');
  });
  if (!opts.oneProperty) {
    d.maint.push({ id: I.newId ? I.newId('m') : 'm1', propertyId: P2.id, date: '2026-06-09', vendor: 'Desert Air HVAC', cost: 640, notes: 'Spring service, replaced filter, unit B', photos: [], updatedAt: Date.now() });
    d.maint.push({ id: I.newId ? I.newId('m') : 'm2', propertyId: P1.id, date: '2026-07-22', vendor: 'Reno Rooter', cost: 285, notes: 'Water heater relief valve, Unit A', photos: [], updatedAt: Date.now() });
  }
  localStorage.setItem('ingot:v1', JSON.stringify(d));
  return { properties: d.properties.length, entries: d.entries.length };
};
