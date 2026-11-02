// Pro entitlement and paywall, through RevenueCat. In the iOS and Android
// apps purchases use App Store / Google Play billing; on the website they use
// RevenueCat Web Billing (Stripe). Both are tied to the person's account
// (see account.js), so Pro bought in one place works everywhere.
(function () {
  'use strict';

  const config = window.APP_CONFIG;
  const Account = window.Account;
  const CACHE_KEY = 'rental-calc:pro';
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const platform = native ? Cap.getPlatform() : 'web';
  const Purchases = native ? Cap.registerPlugin('Purchases') : null;
  const apiKey = platform === 'ios' ? config.revenueCat.iosApiKey
    : platform === 'android' ? config.revenueCat.androidApiKey : '';
  const webKey = native ? '' : config.revenueCat.webBillingKey;
  const CANCELLED = 1; // purchases-js ErrorCode.UserCancelledError

  let entitled = false;
  let configured = false;
  let web = null; // purchases-js instance on the website
  const listeners = [];

  // The last known state is cached per account so Pro works offline and
  // shows straight away, then it's refreshed from RevenueCat.
  const cacheKey = () => {
    const u = Account.user();
    return native ? CACHE_KEY : u ? `${CACHE_KEY}:${u.id}` : null;
  };

  function set(value) {
    const changed = value !== entitled;
    entitled = value;
    const key = cacheKey();
    if (key) { try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) {} }
    if (changed) listeners.forEach((cb) => cb(entitled));
  }

  function fromCached() {
    const key = cacheKey();
    let cached = false;
    try { cached = !!key && localStorage.getItem(key) === '1'; } catch (_) {}
    if (cached !== entitled) set(cached);
  }

  let lastInfo = null;

  function fromCustomerInfo(info) {
    lastInfo = info || lastInfo;
    const active = info && info.entitlements && info.entitlements.active;
    set(!!(active && active[config.revenueCat.entitlement]));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  // ---- website: RevenueCat Web Billing ----------------------------------------

  let webLoading = null;
  async function webInstance(user) {
    if (!webLoading) webLoading = loadScript('vendor/purchases.umd.js');
    await webLoading;
    const P = window.Purchases.Purchases;
    if (!web) web = P.configure({ apiKey: webKey, appUserId: user.id });
    else if (web.getAppUserId() !== user.id) await web.changeUser(user.id);
    return web;
  }

  async function refreshWeb(user) {
    if (!user) { set(false); return; }
    fromCached();
    if (!webKey) return;
    try {
      fromCustomerInfo(await (await webInstance(user)).getCustomerInfo());
    } catch (err) {
      console.warn('Couldn’t check Pro status', err);
    }
  }

  // ---- apps: RevenueCat native SDK ----------------------------------------------

  async function syncNativeUser(user) {
    if (!configured) return;
    try {
      if (user) fromCustomerInfo((await Purchases.logIn({ appUserID: user.id })).customerInfo);
      else fromCustomerInfo((await Purchases.logOut()).customerInfo);
    } catch (err) {
      // logOut fails when no one was logged in; the state is already right.
    }
  }

  async function init() {
    await Account.init();
    Account.onChange((user) => (native ? syncNativeUser(user) : refreshWeb(user)));
    if (!native) return refreshWeb(Account.user());

    fromCached();
    if (!apiKey) return;
    try {
      const user = Account.user();
      await Purchases.configure(user ? { apiKey, appUserID: user.id } : { apiKey });
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
  let checkingOut = false;

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'paywall';
    dialog.innerHTML = `
      <button type="button" class="icon close" aria-label="Close">×</button>
      <div class="pw-badge">PRO</div>
      <h2>EquityFoundry Pro</h2>
      <p class="pw-reason"></p>
      <ul class="pw-features">${FEATURES.map((f) => `<li>${f}</li>`).join('')}</ul>
      <div class="pw-plans"></div>
      <p class="pw-status" role="status"></p>
      <p class="pw-note"></p>
      <div class="pw-links">
        <button type="button" class="link restore">Restore purchases</button>
        <button type="button" class="link signin">Already have Pro? Sign in</button>
        <button type="button" class="link notify">Get notified when the apps launch</button>
      </div>
      <p class="pw-legal">Your subscription renews on its own unless you cancel at least 24 hours before the current
        period ends. Manage or cancel it in your App Store or Google Play settings. Bought it on the website? Use the
        link in your receipt email.
        <a href="${config.legal.termsUrl}" target="_blank" rel="noopener">Terms of Use</a> ·
        <a href="${config.legal.privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a></p>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      // Web checkout closes this dialog to show RevenueCat's; keep waiting.
      if (checkingOut) return;
      if (resolvePaywall) { resolvePaywall(entitled); resolvePaywall = null; }
    });
    dialog.querySelector('.restore').addEventListener('click', restore);
    dialog.querySelector('.signin').addEventListener('click', signInForPro);
    dialog.querySelector('.notify').addEventListener('click', () => { dialog.close(); window.Launch && window.Launch.open(); });
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

  function showLinks() {
    const user = Account.user();
    dialog.querySelector('.restore').hidden = !native;
    dialog.querySelector('.signin').hidden = !!user || !Account.enabled;
    dialog.querySelector('.notify').hidden = native || !window.Launch;
    dialog.querySelector('.pw-note').textContent = native
      ? (user ? `Signed in as ${user.email}. Pro is saved to this account.` : 'Sign in to use Pro you bought on the website.')
      : webKey
        ? (user
          ? `Signed in as ${user.email}. Pro will also work in the iPhone and Android apps when they launch.`
          : 'You’ll sign in with your email first, so Pro also works in the iPhone and Android apps when they launch.')
        : 'iPhone and Android apps are in the works.';
  }

  async function renderPlans() {
    const box = dialog.querySelector('.pw-plans');
    box.replaceChildren();
    status('');
    showLinks();

    if (!native && !webKey) {
      // No checkout on this site yet: list the plans and point to the apps.
      const links = config.storeLinks;
      config.plans.forEach((plan) => box.appendChild(planButton(plan, plan.price, () => {
        const url = /android/i.test(navigator.userAgent) ? links.android || links.ios : links.ios || links.android;
        if (url) window.open(url, '_blank', 'noopener');
        else status('Pro is coming soon. Tap “Get notified” below and we’ll email you at launch.');
      })));
      return;
    }

    if (!native) {
      const user = Account.user();
      if (!user) {
        // Prices come from RevenueCat once signed in; show the usual ones until then.
        config.plans.forEach((plan) => box.appendChild(planButton(plan, plan.price, () => buyWeb(plan.id))));
        return;
      }
      status('Loading prices…');
      try {
        const offerings = await (await webInstance(user)).getOfferings();
        const packages = (offerings.current && offerings.current.availablePackages) || [];
        status(packages.length ? '' : 'No plans are available right now.');
        config.plans.forEach((plan) => {
          const pkg = packages.find((p) => p.identifier === plan.id);
          if (pkg) box.appendChild(planButton(plan, pkg.product.currentPrice.formattedPrice, () => buyWeb(plan.id, pkg)));
        });
      } catch (err) {
        status('Couldn’t load prices. Check your connection and try again.');
      }
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
        if (pkg) box.appendChild(planButton(plan, pkg.product.priceString, () => buyNative(pkg)));
      });
    } catch (err) {
      status('Couldn’t reach the store. Check your connection and try again.');
    }
  }

  async function buyWeb(planId, pkg) {
    const user = await Account.require('Create a free account (or sign in) so Pro works on every device, including the apps when they launch.');
    if (!user) return;
    if (!pkg) {
      // Just signed in: they may already have Pro, otherwise find the package.
      await refreshWeb(user);
      if (entitled) { status('You already have Pro on this account.'); setTimeout(() => dialog.close(), 900); return; }
      try {
        const offerings = await (await webInstance(user)).getOfferings();
        pkg = ((offerings.current && offerings.current.availablePackages) || []).find((p) => p.identifier === planId);
      } catch (_) {}
      if (!pkg) { status('That plan isn’t available right now.'); renderPlans(); return; }
    }
    // RevenueCat shows its own checkout, which needs this dialog out of the way.
    checkingOut = true;
    dialog.close();
    try {
      const { customerInfo } = await web.purchase({ rcPackage: pkg, customerEmail: user.email });
      fromCustomerInfo(customerInfo);
    } catch (err) {
      if (!err || err.errorCode !== CANCELLED) console.warn('Purchase failed', err);
    } finally {
      checkingOut = false;
    }
    if (entitled) {
      if (resolvePaywall) { resolvePaywall(true); resolvePaywall = null; }
    } else {
      dialog.showModal();
      renderPlans();
    }
  }

  async function buyNative(pkg) {
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

  async function signInForPro() {
    const user = await Account.require('Sign in with the email you used to buy Pro.');
    if (!user) return;
    if (native) await syncNativeUser(user); else await refreshWeb(user);
    if (entitled) { status('Pro is active on this account.'); setTimeout(() => dialog.close(), 900); }
    else { renderPlans(); status('No Pro purchase was found for this account yet.'); }
  }

  function paywall(reason) {
    if (!dialog) build();
    dialog.querySelector('.pw-reason').textContent = reason || 'Everything you need to size up a deal.';
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
    // Where the person manages or cancels their subscription: the receipt
    // portal for website purchases, otherwise their store account.
    managementUrl: () => (lastInfo && lastInfo.managementURL) ||
      (platform === 'ios' ? 'https://apps.apple.com/account/subscriptions'
        : platform === 'android' ? 'https://play.google.com/store/account/subscriptions' : null),
    // For automated tests and local previews only; purchases set this for real.
    _setForTesting: set,
  };
})();
