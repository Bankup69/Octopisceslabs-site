// The Account page: profile, plan, email preferences, settings, data export,
// security and account deletion. Opened from the Account button once signed in.
(function () {
  'use strict';

  const { STRATEGIES, DEFAULTS, analyze } = window.RentalCalc;
  const config = window.APP_CONFIG;
  const Account = window.Account;
  const Pro = window.Pro;
  const Settings = window.Settings;
  const STORAGE_KEY = 'rental-calc:properties';
  const $ = (sel, root = document) => root.querySelector(sel);

  const DEFAULT_LABELS = {
    vacancyRate: ['Vacancy rate', '%'],
    maintenancePct: ['Maintenance & repairs', '% of rent'],
    capexPct: ['Capital expense reserve', '% of rent'],
    mgmtPct: ['Property management', '% of income'],
    downPaymentPct: ['Down payment', '%'],
    interestRate: ['Interest rate', '%'],
    loanYears: ['Loan term', 'years'],
    appreciationRate: ['Appreciation', '% / year'],
    rentGrowth: ['Rent growth', '% / year'],
    expenseGrowth: ['Expense growth', '% / year'],
    sellingCostPct: ['Selling costs', '% of sale'],
  };
  const isPct = (k) => k !== 'loanYears';

  // ---- layout ----------------------------------------------------------------

  function build() {
    const page = document.getElementById('account-page');
    page.innerHTML = `
      <header class="ap-head">
        <div class="ap-avatar" aria-hidden="true"></div>
        <div class="ap-who"><h2 class="ap-name"></h2><p class="ap-sub"></p></div>
        <span class="ap-plan-chip"></span>
      </header>

      <section class="ap-card" aria-labelledby="ap-profile-h">
        <h3 id="ap-profile-h">Profile</h3>
        <form class="ap-form" id="ap-profile-form" novalidate>
          <label>Name <input type="text" id="ap-full-name" name="full_name" maxlength="100" autocomplete="name" placeholder="Your name"></label>
          <div class="ap-row"><button type="submit" class="primary">Save name</button><span class="ap-msg" role="status"></span></div>
        </form>
        <div class="ap-field">
          <div><div class="ap-label">Email</div><div class="ap-email"></div></div>
          <button type="button" class="link" id="ap-email-change">Change email</button>
        </div>
        <form class="ap-form" id="ap-email-form" hidden novalidate>
          <label>New email <input type="email" id="ap-new-email" autocomplete="email" inputmode="email"></label>
          <p class="hint">We’ll send a confirmation link to the new address. Your email changes once you click it.</p>
          <div class="ap-row"><button type="submit" class="primary">Send confirmation</button><button type="button" class="link" id="ap-email-cancel">Cancel</button><span class="ap-msg" role="status"></span></div>
        </form>
      </section>

      <section class="ap-card" aria-labelledby="ap-plan-h">
        <h3 id="ap-plan-h">Plan</h3>
        <p class="ap-plan-text"></p>
        <div class="ap-row ap-plan-actions"></div>
      </section>

      <section class="ap-card" aria-labelledby="ap-email-h">
        <h3 id="ap-email-h">Email preferences</h3>
        <p class="hint">Sign-in codes and purchase receipts are always sent. Everything else is up to you.</p>
        <label class="ap-toggle"><input type="checkbox" id="ap-pref-launch"><span><b>App launch announcement</b><small>One email when EquityFoundry arrives on iPhone and Android.</small></span></label>
        <label class="ap-toggle"><input type="checkbox" id="ap-pref-updates"><span><b>Product updates</b><small>New features and improvements, a few times a year.</small></span></label>
        <label class="ap-toggle"><input type="checkbox" id="ap-pref-tips"><span><b>Investing tips</b><small>Occasional how-tos on analyzing rental deals.</small></span></label>
        <span class="ap-msg" id="ap-pref-msg" role="status"></span>
      </section>

      <section class="ap-card" aria-labelledby="ap-settings-h">
        <h3 id="ap-settings-h">Settings</h3>
        <div class="ap-setting">
          <div class="ap-label" id="ap-theme-label">Appearance</div>
          <div class="ap-seg" role="radiogroup" aria-labelledby="ap-theme-label">
            <button type="button" role="radio" data-theme-choice="system">System</button>
            <button type="button" role="radio" data-theme-choice="light">Light</button>
            <button type="button" role="radio" data-theme-choice="dark">Dark</button>
          </div>
        </div>
        <label class="ap-toggle"><input type="checkbox" id="ap-show-help"><span><b>Show ⓘ help buttons</b><small>Turn off once you know the terms.</small></span></label>
        <div class="ap-setting">
          <label class="ap-label" for="ap-default-strategy">Strategy for new properties</label>
          <select id="ap-default-strategy"></select>
        </div>
        <details class="ap-defaults">
          <summary>Starting numbers for new properties</summary>
          <p class="hint">New properties start with these values. Existing properties don’t change.</p>
          <form id="ap-defaults-form" class="ap-defaults-grid" novalidate></form>
          <div class="ap-row"><button type="submit" form="ap-defaults-form" class="primary">Save starting numbers</button><button type="button" class="link" id="ap-defaults-reset">Reset to app defaults</button><span class="ap-msg" role="status"></span></div>
        </details>
      </section>

      <section class="ap-card" aria-labelledby="ap-data-h">
        <h3 id="ap-data-h">Your data</h3>
        <p class="ap-data-text"></p>
        <div class="ap-row">
          <button type="button" id="ap-export-json">Download backup (.json)</button>
          <button type="button" id="ap-export-csv">Download summary (.csv)</button>
          <button type="button" id="ap-import">Restore from backup</button>
          <input type="file" id="ap-import-file" accept="application/json,.json" hidden>
        </div>
        <span class="ap-msg" id="ap-data-msg" role="status"></span>
      </section>

      <section class="ap-card" aria-labelledby="ap-security-h">
        <h3 id="ap-security-h">Security</h3>
        <div class="ap-row">
          <button type="button" id="ap-signout">Sign out</button>
          <button type="button" id="ap-signout-all">Sign out on all devices</button>
        </div>
      </section>

      <section class="ap-card ap-danger" aria-labelledby="ap-delete-h">
        <h3 id="ap-delete-h">Delete account</h3>
        <p>This permanently deletes your account, your settings and your email preferences, and takes you off the launch list. Properties saved on this device stay unless you choose to remove them.</p>
        <p class="ap-delete-sub hint"></p>
        <button type="button" id="ap-delete-start" class="danger">Delete my account…</button>
        <form id="ap-delete-form" class="ap-form" hidden novalidate>
          <label>Type <b>DELETE</b> to confirm <input type="text" id="ap-delete-confirm" autocomplete="off" autocapitalize="characters"></label>
          <label class="ap-toggle"><input type="checkbox" id="ap-delete-local"><span><b>Also remove saved properties from this device</b></span></label>
          <div class="ap-row"><button type="submit" class="danger">Permanently delete</button><button type="button" class="link" id="ap-delete-cancel">Cancel</button><span class="ap-msg" role="status"></span></div>
        </form>
      </section>

      <p class="ap-foot">EquityFoundry is made by OctoPisces Labs LLC. Questions? Email <span class="ap-support">support@octopisceslabs.com</span> ·
        <a href="${config.legal.termsUrl}" target="_blank" rel="noopener">Terms of Sale</a> ·
        <a href="${config.legal.privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a></p>`;

    wire(page);
  }

  // ---- helpers ---------------------------------------------------------------

  function msg(el, text, isError) {
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
    clearTimeout(el._t);
    if (text && !isError) el._t = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { return {}; }
  }

  function savedChanged() {
    document.dispatchEvent(new CustomEvent('rental-calc:saved-changed'));
  }

  // Downloads a file the person can keep. Works in browsers; in the apps the
  // share sheet is used instead (see report.js for the same pattern).
  async function download(name, type, text) {
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) {
      const Filesystem = Cap.registerPlugin('Filesystem');
      const Share = Cap.registerPlugin('Share');
      const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      await Share.share({ title: name, files: [uri] });
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const csvCell = (v) => {
    const s = v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const round = (n, d = 2) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

  // ---- render ----------------------------------------------------------------

  function render() {
    const page = document.getElementById('account-page');
    if (!page.firstElementChild) build();
    const user = Account.user();
    if (!user) return;
    const profile = Account.profile() || {};
    const name = profile.full_name || '';

    $('.ap-avatar', page).textContent = (name || user.email).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    $('.ap-name', page).textContent = name || 'Your account';
    const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';
    $('.ap-sub', page).textContent = [user.email, since && `Member since ${since}`].filter(Boolean).join(' · ');
    const pro = Pro.isPro();
    const chip = $('.ap-plan-chip', page);
    chip.textContent = pro ? 'PRO' : 'FREE';
    chip.classList.toggle('pro', pro);

    const nameInput = $('#ap-full-name', page);
    if (document.activeElement !== nameInput) nameInput.value = name;
    $('.ap-email', page).textContent = user.email;
    if (user.new_email) {
      $('.ap-email', page).textContent = `${user.email} (changing to ${user.new_email}, check that inbox)`;
    }

    // Plan
    const saved = Object.keys(loadSaved()).length;
    $('.ap-plan-text', page).textContent = pro
      ? 'EquityFoundry Pro is active: every strategy, projections, PDF reports and unlimited saved properties.'
      : `Free plan: long-term rental analysis, the dashboard and comparison, and up to ${config.freeSaveLimit} saved properties (${Math.min(saved, config.freeSaveLimit)} used).`;
    const actions = $('.ap-plan-actions', page);
    actions.replaceChildren();
    if (pro) {
      const url = Pro.managementUrl();
      if (url) {
        const a = document.createElement('a');
        a.className = 'button';
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Manage subscription ↗';
        actions.appendChild(a);
      }
      const note = document.createElement('span');
      note.className = 'hint';
      note.textContent = 'Lifetime purchases have nothing to manage.';
      actions.appendChild(note);
    } else {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pro-btn';
      b.textContent = 'Upgrade to Pro';
      b.addEventListener('click', () => Pro.paywall());
      actions.appendChild(b);
    }

    // Email preferences
    $('#ap-pref-updates', page).checked = !!profile.email_product_updates;
    $('#ap-pref-tips', page).checked = !!profile.email_tips;
    $('#ap-pref-launch', page).checked = !!profile.email_launch;

    // Settings
    const s = Settings.get();
    page.querySelectorAll('[data-theme-choice]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.themeChoice === (s.theme || 'system'))));
    $('#ap-show-help', page).checked = s.showHelp !== false;
    const sel = $('#ap-default-strategy', page);
    if (!sel.options.length) {
      sel.append(new Option('Whatever I used last', ''));
      Object.entries(STRATEGIES).forEach(([k, v]) => sel.append(new Option(v, k)));
    }
    sel.value = s.defaultStrategy || '';
    renderDefaults(page);

    // Data
    $('.ap-data-text', page).textContent = saved
      ? `${saved} saved ${saved === 1 ? 'property is' : 'properties are'} stored on this device. Download a backup to move them to another device or keep a copy.`
      : 'No saved properties on this device yet.';
    $('#ap-export-json', page).disabled = !saved;
    $('#ap-export-csv', page).disabled = !saved;

    $('.ap-delete-sub', page).textContent = pro
      ? 'If you have a subscription, cancel it first under Plan → Manage subscription; deleting your account doesn’t stop billing.'
      : '';
  }

  function renderDefaults(page) {
    const form = $('#ap-defaults-form', page);
    const d = (Settings.get().defaults) || {};
    if (!form.children.length) {
      form.innerHTML = Settings.DEFAULT_FIELDS.map((k) => {
        const [label, unit] = DEFAULT_LABELS[k];
        return `<label>${label}<span class="ap-num"><input type="number" name="${k}" step="${isPct(k) ? 0.25 : 1}" min="0" inputmode="decimal"><span>${unit}</span></span></label>`;
      }).join('');
    }
    Settings.DEFAULT_FIELDS.forEach((k) => {
      const v = typeof d[k] === 'number' ? d[k] : DEFAULTS[k];
      form.elements[k].value = isPct(k) ? +(v * 100).toFixed(4) : v;
    });
  }

  // ---- events ----------------------------------------------------------------

  function wire(page) {
    // Profile
    $('#ap-profile-form', page).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = $('.ap-msg', ev.target);
      try {
        await Account.saveProfile({ full_name: $('#ap-full-name', page).value.trim() || null });
        msg(out, 'Saved');
        render();
      } catch (err) { msg(out, 'Couldn’t save. Try again.', true); }
    });

    const emailForm = $('#ap-email-form', page);
    $('#ap-email-change', page).addEventListener('click', () => { emailForm.hidden = false; $('#ap-new-email', page).focus(); });
    $('#ap-email-cancel', page).addEventListener('click', () => { emailForm.hidden = true; });
    emailForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = $('.ap-msg', emailForm);
      const email = $('#ap-new-email', page).value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg(out, 'Enter a valid email address.', true); return; }
      try {
        await Account.updateEmail(email);
        msg(out, `Check ${email} for a confirmation link.`);
      } catch (err) {
        msg(out, /already/i.test(err.message || '') ? 'That email is already used by another account.' : 'Couldn’t start the change. Try again.', true);
      }
    });

    // Email preferences
    const prefMsg = $('#ap-pref-msg', page);
    [['#ap-pref-updates', 'email_product_updates'], ['#ap-pref-tips', 'email_tips']].forEach(([id, col]) => {
      $(id, page).addEventListener('change', async (ev) => {
        try { await Account.saveProfile({ [col]: ev.target.checked }); msg(prefMsg, 'Saved'); }
        catch (err) { ev.target.checked = !ev.target.checked; msg(prefMsg, 'Couldn’t save. Try again.', true); }
      });
    });
    $('#ap-pref-launch', page).addEventListener('change', async (ev) => {
      const on = ev.target.checked;
      try {
        if (on) await window.Launch.join(Account.user().email, 'rental-calc-account');
        else await Account.leaveLaunchList();
        await Account.saveProfile({ email_launch: on });
        msg(prefMsg, on ? 'You’re on the launch list.' : 'Removed from the launch list.');
      } catch (err) { ev.target.checked = !on; msg(prefMsg, 'Couldn’t save. Try again.', true); }
    });

    // Settings
    page.querySelectorAll('[data-theme-choice]').forEach((b) => b.addEventListener('click', async () => {
      await Settings.set({ theme: b.dataset.themeChoice === 'system' ? undefined : b.dataset.themeChoice });
      render();
    }));
    $('#ap-show-help', page).addEventListener('change', (ev) => Settings.set({ showHelp: ev.target.checked }));
    $('#ap-default-strategy', page).addEventListener('change', (ev) => Settings.set({ defaultStrategy: ev.target.value || undefined }));

    const defaultsForm = $('#ap-defaults-form', page);
    const defaultsMsg = $('.ap-defaults .ap-msg', page);
    defaultsForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = {};
      for (const k of Settings.DEFAULT_FIELDS) {
        const n = parseFloat(defaultsForm.elements[k].value);
        if (isNaN(n) || n < 0) { msg(defaultsMsg, `Check the value for ${DEFAULT_LABELS[k][0]}.`, true); return; }
        out[k] = isPct(k) ? n / 100 : n;
      }
      await Settings.set({ defaults: out });
      msg(defaultsMsg, 'Saved. New properties will start with these numbers.');
    });
    $('#ap-defaults-reset', page).addEventListener('click', async () => {
      await Settings.set({ defaults: undefined });
      renderDefaults(page);
      msg(defaultsMsg, 'Back to the app’s defaults.');
    });

    // Data
    const dataMsg = $('#ap-data-msg', page);
    $('#ap-export-json', page).addEventListener('click', async () => {
      const backup = { app: 'rental-calc', version: 1, exportedAt: new Date().toISOString(), properties: loadSaved() };
      await download(`equityfoundry-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(backup, null, 2));
    });
    $('#ap-export-csv', page).addEventListener('click', async () => {
      const head = ['Name', 'Strategy', 'City/State', 'Listing', 'Purchase price', 'Units', 'Monthly cash flow', 'Annual cash flow',
        'Cash invested', 'Cash-on-cash %', 'Cap rate %', 'DSCR', 'Total ROI %', 'Flip profit'];
      const rows = Object.entries(loadSaved()).map(([name, entry]) => {
        const input = entry && entry.input ? entry.input : entry;
        const r = analyze(input);
        const pctv = (n) => round(n === null || n === undefined ? null : n * 100);
        return [name, STRATEGIES[input.strategy] || STRATEGIES.rental, input.cityState, input.listingUrl, input.purchasePrice, r.doors,
          round(r.monthlyCashFlow, 0), round(r.annualCashFlow, 0), round(r.cashInvested, 0), pctv(r.cashOnCash), pctv(r.capRate),
          round(r.dscr), pctv(r.roiTotal), input.strategy === 'flip' ? round(r.profit, 0) : null];
      });
      const csv = [head].concat(rows).map((r) => r.map(csvCell).join(',')).join('\n');
      await download(`equityfoundry-properties-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', csv);
    });
    const fileInput = $('#ap-import-file', page);
    $('#ap-import', page).addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const incoming = data && data.app === 'rental-calc' && data.properties && typeof data.properties === 'object' ? data.properties : null;
        if (!incoming) throw new Error('not a backup');
        const all = loadSaved();
        const names = Object.keys(incoming).filter((n) => incoming[n] && typeof incoming[n] === 'object');
        const total = new Set(Object.keys(all).concat(names)).size;
        if (!Pro.isPro() && total > config.freeSaveLimit) {
          msg(dataMsg, `This backup would bring you to ${total} saved properties. The free plan keeps ${config.freeSaveLimit}; go Pro to restore them all.`, true);
          Pro.paywall(`Restoring this backup needs room for ${total} properties.`);
          return;
        }
        names.forEach((n) => { all[n] = incoming[n].input ? incoming[n] : { input: incoming[n], savedAt: Date.now() }; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        savedChanged();
        render();
        msg(dataMsg, `Restored ${names.length} ${names.length === 1 ? 'property' : 'properties'}.`);
      } catch (err) {
        msg(dataMsg, 'That file isn’t an EquityFoundry backup.', true);
      }
    });

    // Security
    $('#ap-signout', page).addEventListener('click', () => Account.signOut('local'));
    $('#ap-signout-all', page).addEventListener('click', () => Account.signOut('global'));

    // Delete
    const delForm = $('#ap-delete-form', page);
    $('#ap-delete-start', page).addEventListener('click', () => { delForm.hidden = false; $('#ap-delete-start', page).hidden = true; $('#ap-delete-confirm', page).focus(); });
    $('#ap-delete-cancel', page).addEventListener('click', () => { delForm.hidden = true; $('#ap-delete-start', page).hidden = false; });
    delForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = $('.ap-msg', delForm);
      if ($('#ap-delete-confirm', page).value.trim().toUpperCase() !== 'DELETE') { msg(out, 'Type DELETE to confirm.', true); return; }
      const removeLocal = $('#ap-delete-local', page).checked;
      msg(out, 'Deleting…');
      try {
        await Account.deleteAccount();
        if (removeLocal) {
          try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY + ':draft'); } catch (_) {}
          savedChanged();
        }
        delForm.hidden = true;
        $('#ap-delete-start', page).hidden = false;
        $('#ap-delete-confirm', page).value = '';
        document.dispatchEvent(new CustomEvent('rental-calc:toast', { detail: 'Your account was deleted.' }));
      } catch (err) {
        msg(out, err.message || 'Could not delete the account.', true);
      }
    });
  }

  // ---- open -------------------------------------------------------------------

  async function open() {
    if (!Account.user()) { Account.open(); return; }
    window.App.showView('account');
    window.scrollTo(0, 0);
    render();
    try {
      await Account.loadProfile();
      // Keep the launch switch in step with the actual list.
      const onList = await Account.onLaunchList();
      if (onList !== !!Account.profile().email_launch) await Account.saveProfile({ email_launch: onList });
    } catch (err) { console.warn('Profile not loaded', err); }
    render();
  }

  Pro.onChange(() => { if (!document.getElementById('view-account').hidden) render(); });
  Account.onChange((user) => {
    if (user) Settings.syncFromAccount();
    else if (!document.getElementById('view-account').hidden) window.App.showView('calc');
  });
  if (Account.user()) Settings.syncFromAccount();

  window.AccountPage = { open, render };
})();
