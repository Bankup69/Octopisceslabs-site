// App settings: appearance, help buttons and the starting numbers for new
// properties. Saved on the device, and to the account when signed in so they
// follow the person to other devices.
(function () {
  'use strict';

  const KEY = 'rental-calc:settings';
  const listeners = [];

  // Fields a person can set their own starting value for. Percentages are
  // stored as fractions, like the calculator's inputs.
  const DEFAULT_FIELDS = [
    'vacancyRate', 'maintenancePct', 'capexPct', 'mgmtPct', 'downPaymentPct', 'interestRate',
    'loanYears', 'appreciationRate', 'rentGrowth', 'expenseGrowth', 'sellingCostPct',
  ];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
  }

  let settings = read();

  function apply() {
    const root = document.documentElement;
    if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme;
    else delete root.dataset.theme;
    document.body.classList.toggle('hide-help', settings.showHelp === false);
  }

  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
  }

  // Saves on the device right away; the account copy follows in the background.
  async function set(patch) {
    settings = Object.assign({}, settings, patch);
    store();
    apply();
    listeners.forEach((cb) => cb(settings));
    const Account = window.Account;
    if (Account && Account.user()) {
      try { await Account.saveProfile({ settings }); } catch (err) { console.warn('Settings not synced', err); }
    }
  }

  // When someone signs in, their account's settings win; a new account
  // starts from whatever they set on this device.
  async function syncFromAccount() {
    const Account = window.Account;
    if (!Account || !Account.user()) return;
    try {
      const profile = await Account.loadProfile();
      if (profile && profile.settings && Object.keys(profile.settings).length) {
        settings = Object.assign({}, profile.settings);
        store();
        apply();
        listeners.forEach((cb) => cb(settings));
      } else if (Object.keys(settings).length) {
        await Account.saveProfile({ settings });
      }
    } catch (err) {
      console.warn('Settings not loaded from account', err);
    }
  }

  function newPropertyDefaults() {
    const out = {};
    const d = settings.defaults || {};
    DEFAULT_FIELDS.forEach((k) => { if (typeof d[k] === 'number' && isFinite(d[k])) out[k] = d[k]; });
    if (settings.defaultStrategy) out.strategy = settings.defaultStrategy;
    return out;
  }

  apply();

  window.Settings = {
    DEFAULT_FIELDS,
    get: () => settings,
    set,
    syncFromAccount,
    newPropertyDefaults,
    onChange: (cb) => listeners.push(cb),
  };
})();
