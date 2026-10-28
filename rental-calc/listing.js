// Reads a listing link (or text shared from a listing app) and pulls out the
// address. Zillow, Redfin, Realtor.com and Trulia put the address in the URL,
// so no request to their sites is needed.
(function (root) {
  'use strict';

  const SOURCES = [
    [/(^|\.)zillow\.com$/, 'Zillow'],
    [/(^|\.)redfin\.com$/, 'Redfin'],
    [/(^|\.)realtor\.com$/, 'Realtor.com'],
    [/(^|\.)trulia\.com$/, 'Trulia'],
    [/(^|\.)homes\.com$/, 'Homes.com'],
    [/(^|\.)loopnet\.com$/, 'LoopNet'],
    [/(^|\.)crexi\.com$/, 'Crexi'],
    [/(^|\.)apartments\.com$/, 'Apartments.com'],
    [/(^|\.)airbnb\.com$/, 'Airbnb'],
    [/(^|\.)vrbo\.com$/, 'Vrbo'],
  ];

  // Street types used to find where the street ends in a hyphenated slug.
  const STREET_TYPES = new Set(('st street ave avenue rd road dr drive ln lane ct court blvd boulevard way pl place ' +
    'cir circle ter terrace pkwy parkway hwy highway trl trail loop sq square aly alley xing cv cove run path pike ' +
    'row walk pt point holw hollow hl hill rdg ridge').split(' '));
  const UNIT_WORDS = new Set(['apt', 'unit', 'ste', 'suite', 'lot', 'bldg']);

  const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Ne|Nw|Se|Sw)\b/g, (m) => m.toUpperCase());

  function findUrl(text) {
    const m = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
    return m ? m[0].replace(/[).,;]+$/, '') : null;
  }

  function sourceFor(host) {
    const h = host.replace(/^www\./, '');
    for (const [re, name] of SOURCES) if (re.test(h)) return name;
    return h;
  }

  // "250-S-Taylor-St-Fallon-NV-89406" -> street, city, state, zip.
  function fromSlug(slug) {
    const parts = slug.split('-').filter(Boolean);
    let zip = '';
    if (/^\d{5}$/.test(parts[parts.length - 1])) zip = parts.pop();
    let state = '';
    if (parts.length && /^[a-z]{2}$/i.test(parts[parts.length - 1])) state = parts.pop().toUpperCase();
    // The street ends at the last street type (plus any unit that follows).
    let end = -1;
    parts.forEach((p, idx) => { if (idx > 0 && STREET_TYPES.has(p.toLowerCase())) end = idx; });
    if (end >= 0) {
      if (UNIT_WORDS.has((parts[end + 1] || '').toLowerCase()) && parts[end + 2]) end += 2;
      else if (/^#/.test(parts[end + 1] || '')) end += 1;
    }
    const street = (end >= 0 ? parts.slice(0, end + 1) : parts).join(' ');
    const city = end >= 0 ? parts.slice(end + 1).join(' ') : '';
    return { street: titleCase(street), city: titleCase(city), state, zip };
  }

  // "123 Main St, Fallon, NV 89406" in shared text.
  function fromText(text) {
    const m = String(text || '').match(/(\d+[^,\n]*?),\s*([A-Za-z .'-]+?),\s*([A-Z]{2})\s*(\d{5})?/);
    return m ? { street: m[1].trim(), city: m[2].trim(), state: m[3], zip: m[4] || '' } : null;
  }

  function parseListing(text) {
    const url = findUrl(text);
    if (!url) return null;
    let u;
    try { u = new URL(url); } catch (_) { return null; }
    const source = sourceFor(u.hostname);
    const segs = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    let addr = null;

    if (source === 'Zillow') {
      const i = segs.indexOf('homedetails');
      if (i >= 0 && segs[i + 1] && !/_zpid$/.test(segs[i + 1])) addr = fromSlug(segs[i + 1]);
    } else if (source === 'Redfin') {
      // /NV/Fallon/250-S-Taylor-St-89406/home/12345 (optionally /unit-2/ before /home)
      const h = segs.indexOf('home');
      if (h >= 3 && /^[A-Z]{2}$/i.test(segs[0])) {
        const streetSeg = segs[2].replace(/-(\d{5})$/, '');
        const zip = (segs[2].match(/-(\d{5})$/) || [])[1] || '';
        const unit = segs[3] && /^unit-/i.test(segs[3]) ? ' Unit ' + segs[3].slice(5) : '';
        addr = { street: titleCase(streetSeg.replace(/-/g, ' ')) + unit, city: titleCase(segs[1].replace(/-/g, ' ')), state: segs[0].toUpperCase(), zip };
      }
    } else if (source === 'Realtor.com') {
      // /realestateandhomes-detail/250-S-Taylor-St_Fallon_NV_89406_M12345-67890
      const i = segs.indexOf('realestateandhomes-detail');
      const parts = i >= 0 && segs[i + 1] ? segs[i + 1].split('_') : [];
      if (parts.length >= 4) {
        addr = { street: titleCase(parts[0].replace(/-/g, ' ')), city: titleCase(parts[1].replace(/-/g, ' ')), state: parts[2].toUpperCase(), zip: /^\d{5}$/.test(parts[3]) ? parts[3] : '' };
      }
    } else if (source === 'Trulia') {
      // /home/250-s-taylor-st-fallon-nv-89406-12345678
      const i = segs.indexOf('home');
      if (i >= 0 && segs[i + 1]) addr = fromSlug(segs[i + 1].replace(/-\d{6,}$/, ''));
    }

    const shared = fromText(text.replace(url, ''));
    if (shared && (!addr || !addr.city)) addr = shared;

    return {
      url,
      source,
      address: addr ? addr.street : '',
      cityState: addr && addr.city ? `${addr.city}, ${addr.state}` : addr && addr.state ? addr.state : '',
      zip: addr ? addr.zip : '',
    };
  }

  const api = { parseListing, findUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Listing = api;
})(typeof self !== 'undefined' ? self : this);
