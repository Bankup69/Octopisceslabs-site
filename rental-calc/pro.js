// Pro entitlement and paywall. In the iOS and Android apps purchases go
// through RevenueCat (App Store / Google Play billing). On the web there is
// no checkout yet, so the paywall points people to the apps.
(function () {
  'use strict';

  const config = window.APP_CONFIG;
  const CACHE_KEY = 'rental-calc:pro';
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const platform = native ? Cap.getPlatform() : 'web';
  const Purchases = native ? Cap.registerPlugin('Purchases') : null;
  const apiKey = platform === 'ios' ? config.revenueCat.iosApiKey
    : platform === 'android' ? config.revenueCat.androidApiKey : '';

  let entitled = false;
  let configured = false;
  const listeners = [];

  function set(value) {
    const changed = value !== entitled;
    entitled = value;
    if (native) {
      try { localStorage.setItem(CACHE_KEY, value ? '1' : '0'); } catch (_) {}
    }
    if (changed) listeners.forEach((cb) => cb(entitled));
  }

  function fromCustomerInfo(info) {
    const active = info && info.entitlements && info.entitlements.active;
    set(!!(active && active[config.revenueCat.entitlement]));
  }

  async function init() {
    if (!native) return;
    // Start from the last known state so Pro works offline, then refresh.
    try { entitled = localStorage.getItem(CACHE_KEY) === '1'; } catch (_) {}
    if (!apiKey) return;
    try {
      await Purchases.configure({ apiKey });
      configured = true;
      const { customerInfo } = await Purchases.getCustomerInfo();
      fromCustomerInfo(customerInfo);
      Purchases.addCustomerInfoUpdateListener((info) => fromCustomerInfo(info));
    } catch (err) {
      console.warn('Purchases unavailable', err);
    }
  }

  // ---- paywall -------------------------------------------------------------

  const FEATURES = [
    'Unlimited saved properties',
    'Short-term rental (Airbnb), BRRRR and fix & flip analysis',
    '30-year projections with IRR, equity and exit value',
    'PDF reports to share with lenders and partners',
  ];

  let dialog;
  let resolvePaywall = null;

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'paywall';
    dialog.innerHTML = `
      <button type="button" class="icon close" aria-label="Close">×</button>
      <div class="pw-badge">PRO</div>
      <h2>Rental Calc Pro</h2>
      <p class="pw-reason"></p>
      <ul class="pw-features">${FEATURES.map((f) => `<li>${f}</li>`).join('')}</ul>
      <div class="pw-plans"></div>
      <p class="pw-status" role="status"></p>
      <div class="pw-links">
        <button type="button" class="link restore">Restore purchases</button>
      </div>
      <p class="pw-legal">Subscriptions renew automatically unless cancelled at least 24 hours before the end of the
        current period. Manage or cancel in your App Store or Google Play account settings.
        <a href="${config.legal.termsUrl}" target="_blank" rel="noopener">Terms of Use</a> ·
        <a href="${config.legal.privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a></p>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (resolvePaywall) { resolvePaywall(entitled); resolvePaywall = null; }
    });
    dialog.querySelector('.restore').addEventListener('click', restore);
    dialog.querySelector('.restore').hidden = !native;
  }

  function status(msg) {
    dialog.querySelector('.pw-status').textContent = msg || '';
  }

  function planButton(plan, price, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pw-plan' + (plan.note === 'Best value' ? ' featured' : '');
    b.innerHTML = '<span class="pw-plan-title"></span><span class="pw-plan-price"></span><span class="pw-plan-note"></span>';
    b.querySelector('.pw-plan-title').textContent = plan.title;
    b.querySelector('.pw-plan-price').textContent = price;
    b.querySelector('.pw-plan-note').textContent = plan.note || plan.period;
    b.addEventListener('click', onClick);
    return b;
  }

  async function renderPlans() {
    const box = dialog.querySelector('.pw-plans');
    box.replaceChildren();
    status('');

    if (!native) {
      const links = config.storeLinks;
      config.plans.forEach((plan) => box.appendChild(planButton(plan, plan.price, () => {
        const url = /android/i.test(navigator.userAgent) ? links.android || links.ios : links.ios || links.android;
        if (url) window.open(url, '_blank', 'noopener');
        else status('Pro is coming soon to the App Store and Google Play.');
      })));
      status('Pro is unlocked in the iPhone and Android apps.');
      return;
    }
    if (!configured) {
      config.plans.forEach((plan) => box.appendChild(planButton(plan, plan.price, () => status('Purchases are not set up yet.'))));
      return;
    }

    status('Loading prices…');
    try {
      const offerings = await Purchases.getOfferings();
      const packages = (offerings.current && offerings.current.availablePackages) || [];
      status(packages.length ? '' : 'No plans are available right now.');
      config.plans.forEach((plan) => {
        const pkg = packages.find((p) => p.identifier === plan.id);
        if (pkg) box.appendChild(planButton(plan, pkg.product.priceString, () => buy(pkg)));
      });
    } catch (err) {
      status('Couldn’t reach the store. Check your connection and try again.');
    }
  }

  async function buy(pkg) {
    status('Opening the store…');
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      fromCustomerInfo(customerInfo);
      if (entitled) { status('Thanks! Pro is unlocked.'); setTimeout(() => dialog.close(), 900); }
      else status('Purchase complete, but Pro isn’t active yet. Try Restore purchases.');
    } catch (err) {
      status(err && err.userCancelled ? '' : 'The purchase didn’t go through.');
    }
  }

  async function restore() {
    status('Restoring…');
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      fromCustomerInfo(customerInfo);
      status(entitled ? 'Pro restored.' : 'No previous Pro purchase was found for this account.');
      if (entitled) setTimeout(() => dialog.close(), 900);
    } catch (err) {
      status('Couldn’t restore purchases right now.');
    }
  }

  function paywall(reason) {
    if (!dialog) build();
    dialog.querySelector('.pw-reason').textContent = reason || 'Get the full toolkit for analyzing deals.';
    renderPlans();
    if (!dialog.open) dialog.showModal();
    return new Promise((resolve) => { resolvePaywall = resolve; });
  }

  window.Pro = {
    native,
    platform,
    init,
    isPro: () => entitled,
    onChange: (cb) => listeners.push(cb),
    paywall,
    // Resolves true when the user has Pro, showing the paywall if needed.
    require: (reason) => (entitled ? Promise.resolve(true) : paywall(reason)),
    // For automated tests and local previews only; purchases set this in the apps.
    _setForTesting: set,
  };
})();
