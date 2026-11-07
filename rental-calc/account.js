// Accounts: email sign-in with a one-time code (or the link in the same
// email), using Supabase Auth. An account is what lets a Pro purchase made
// on the website work in the iPhone and Android apps, and vice versa.
(function () {
  'use strict';

  const config = window.APP_CONFIG.supabase;
  const ref = new URL(config.url).hostname.split('.')[0];
  const SESSION_KEY = `sb-${ref}-auth-token`;
  const listeners = [];
  let client = null;
  let loading = null;
  let user = null;
  let linkProblem = '';
  let choosePasswordNext = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  // The Supabase library is only loaded when it's needed: someone signs in,
  // or there's already a session from an earlier visit.
  function getClient() {
    if (client) return Promise.resolve(client);
    if (!loading) {
      loading = loadScript('vendor/supabase.js').then(() => {
        client = window.supabase.createClient(config.url, config.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        client.auth.onAuthStateChange((_event, session) => setUser(session ? session.user : null));
        return client;
      });
    }
    return loading;
  }

  function setUser(next) {
    const changed = (next && next.id) !== (user && user.id);
    user = next;
    if (changed) listeners.forEach((cb) => cb(user));
    renderButton();
  }

  function hasStoredSession() {
    try { if (localStorage.getItem(SESSION_KEY)) return true; } catch (_) {}
    return /access_token=|error_description=/.test(location.hash) || /error_description=/.test(location.search) || linkToken() !== null;
  }

  // The emails link to octopisceslabs.com with a one-time token, rather than
  // to a supabase.co address, so the link matches the sender (a mismatch is a
  // spam signal). The token is exchanged for a session here.
  function linkToken() {
    const q = new URLSearchParams(location.search);
    const tokenHash = q.get('token_hash');
    const type = q.get('type');
    return tokenHash && /^(email|magiclink|signup|email_change|recovery|invite)$/.test(type || '') ? { tokenHash, type } : null;
  }

  function cleanAddressBar() {
    const q = new URLSearchParams(location.search);
    ['token_hash', 'type'].forEach((k) => q.delete(k));
    const rest = q.toString();
    history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : ''));
  }

  async function init() {
    if (!hasStoredSession()) return null;
    try {
      const c = await getClient();
      const link = linkToken();
      if (link) {
        cleanAddressBar();
        const { data, error } = await c.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
        if (error) {
          linkProblem = /expired|invalid/i.test(error.message || '')
            ? 'That sign-in link has expired or was already used. Send yourself a new code.'
            : 'That sign-in link didn’t work. Send yourself a new code.';
        } else if (data && data.session) {
          setUser(data.session.user);
          // Reset-password and invite links go straight to choosing a password.
          if (link.type === 'recovery' || link.type === 'invite') choosePasswordNext = true;
        }
      }
      const { data } = await c.auth.getSession();
      setUser(data.session ? data.session.user : null);
      // Clean the sign-in details out of the address bar after a link or Google sign-in.
      if (/access_token=|error_description=/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
      const oauthError = new URLSearchParams(location.search).get('error_description') || new URLSearchParams(location.hash.slice(1)).get('error_description');
      if (oauthError && !data.session) linkProblem = 'Sign-in didn’t finish. Try again, or use your email instead.';
    } catch (err) {
      console.warn('Accounts unavailable', err);
    }
    if (new URLSearchParams(location.search).has('error_description')) {
      const q = new URLSearchParams(location.search);
      ['error', 'error_code', 'error_description'].forEach((k) => q.delete(k));
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
    if (linkProblem) setTimeout(() => open(linkProblem, { noAuto: true }), 0);
    else if (choosePasswordNext && user) setTimeout(() => { open('', { noAuto: true }); step('newpass'); }, 0);
    return user;
  }

  // ---- password rules -------------------------------------------------------
  // Same rules as Supabase's "lowercase, uppercase, digits and symbols"
  // setting with an 8-character minimum, so the app catches them first.
  const SYMBOLS = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;
  const PASSWORD_RULES = [
    ['At least 8 characters', (p) => p.length >= 8],
    ['An uppercase letter (A–Z)', (p) => /[A-Z]/.test(p)],
    ['A lowercase letter (a–z)', (p) => /[a-z]/.test(p)],
    ['A number (0–9)', (p) => /\d/.test(p)],
    ['A symbol, like ! ? # $ %', (p) => SYMBOLS.test(p)],
  ];
  const passwordProblems = (p) => PASSWORD_RULES.filter(([, ok]) => !ok(String(p || ''))).map(([label]) => label);
  const PASSWORD_HELP = 'Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.';

  // A live checklist under a new-password field.
  function attachRules(input, list) {
    list.classList.add('pw-rules');
    list.innerHTML = PASSWORD_RULES.map(([label]) => `<li>${label}</li>`).join('');
    const update = () => {
      const v = input.value;
      [...list.children].forEach((li, k) => li.classList.toggle('ok', PASSWORD_RULES[k][1](v)));
    };
    input.addEventListener('input', update);
    update();
    return update;
  }

  // ---- captcha (Cloudflare Turnstile) ------------------------------------------
  // Off until a site key is in config.js. Once Supabase's captcha protection is
  // on, every sign-up, password sign-in and emailed code needs a fresh token.
  const captchaKey = ((window.APP_CONFIG.captcha || {}).siteKey) || '';
  let captchaLoading = null;
  let captchaWidget = null;
  let captchaToken = '';
  let captchaWaiters = [];

  function renderCaptcha(el) {
    if (!captchaKey || !el) return;
    if (!captchaLoading) captchaLoading = loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    captchaLoading.then(() => {
      if (captchaWidget !== null) return;
      captchaWidget = window.turnstile.render(el, {
        sitekey: captchaKey,
        appearance: 'interaction-only',
        callback: (t) => { captchaToken = t; captchaWaiters.splice(0).forEach((f) => f(t)); },
        'expired-callback': () => { captchaToken = ''; },
        'error-callback': () => { captchaToken = ''; },
      });
    }).catch(() => {});
  }

  // A token for one request; the widget is reset so the next request gets a new one.
  function captchaFor() {
    if (!captchaKey) return Promise.resolve(undefined);
    const take = (t) => {
      captchaToken = '';
      setTimeout(() => { try { window.turnstile.reset(captchaWidget); } catch (_) {} }, 0);
      return t;
    };
    if (captchaToken) return Promise.resolve(take(captchaToken));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Please finish the quick “are you human” check above, then try again.')), 15000);
      captchaWaiters.push((t) => { clearTimeout(timer); resolve(take(t)); });
    });
  }

  // ---- sign-in dialog -------------------------------------------------------
  // Fastest first: Continue with Google (when it's switched on in Supabase),
  // then email + password (the browser can save it), with an emailed code as
  // the fallback for people who haven't set a password or forgot it.

  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  let authSettings = null;
  function loadAuthSettings() {
    if (!authSettings) {
      authSettings = fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.publishableKey } })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    }
    return authSettings;
  }

  const GOOGLE_G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  let dialog;
  let resolveDialog = null;
  let pendingEmail = '';
  let mode = 'signin'; // or 'signup'
  let afterCode = null; // 'newpass' when signing in to reset a password

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'account-dialog';
    dialog.innerHTML = `
      <button type="button" class="icon close" aria-label="Close">×</button>
      <section data-step="email">
        <h2 class="ac-title">Sign in</h2>
        <p class="ac-reason"></p>
        <button type="button" class="ac-google" hidden>${GOOGLE_G}<span>Continue with Google</span></button>
        <div class="ac-or" hidden><span>or use your email</span></div>
        <form class="ac-form ac-pass-form" novalidate>
          <label>Email <input type="email" name="email" autocomplete="username" inputmode="email" required></label>
          <label>Password <input type="password" name="password" autocomplete="current-password" minlength="8" required></label>
          <ul class="ac-rules" hidden></ul>
          <button type="submit" class="primary ac-submit">Sign in</button>
        </form>
        <p class="ac-links"><button type="button" class="link ac-mode">New here? Create an account</button></p>
        <p class="ac-links"><button type="button" class="link ac-forgot">Forgot password?</button><br><button type="button" class="link ac-code">Email me a sign-in code instead</button></p>
        <p class="hint ac-hint">Use the same account on every device, including the iPhone and Android apps when they’re in the stores, and Pro comes with you.</p>
      </section>
      <section data-step="code" hidden>
        <h2>Check your email</h2>
        <p class="ac-code-msg">We sent a 6-digit code to <strong class="ac-email"></strong>. Enter it below, or tap the link in the email.</p>
        <form class="ac-form" novalidate>
          <label>Code <input type="text" name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="10" required></label>
          <button type="submit" class="primary">Continue</button>
        </form>
        <p class="ac-links"><button type="button" class="link ac-resend">Send a new code</button> · <button type="button" class="link ac-change">Back</button></p>
      </section>
      <section data-step="newpass" hidden>
        <h2>Choose a new password</h2>
        <p>You’re signed in. Pick a password so next time you can skip the email.</p>
        <form class="ac-form" novalidate>
          <input type="email" name="email" autocomplete="username" hidden>
          <label>New password <input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
          <ul class="ac-newrules"></ul>
          <button type="submit" class="primary">Save password</button>
        </form>
        <p class="ac-links"><button type="button" class="link ac-skip">Skip for now</button></p>
      </section>
      <section data-step="account" hidden>
        <h2>Your account</h2>
        <p>Signed in as <strong class="ac-email"></strong></p>
        <p class="ac-pro"></p>
        <button type="button" class="ac-signout">Sign out</button>
      </section>
      <div class="ac-captcha"></div>
      <p class="ac-status" role="status"></p>`;
    document.body.appendChild(dialog);

    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (resolveDialog) { resolveDialog(user); resolveDialog = null; }
    });
    const passForm = dialog.querySelector('.ac-pass-form');
    const codeForm = dialog.querySelector('[data-step="code"] form');
    const newForm = dialog.querySelector('[data-step="newpass"] form');
    attachRules(passForm.elements.password, dialog.querySelector('.ac-rules'));
    attachRules(newForm.elements.password, dialog.querySelector('.ac-newrules'));
    passForm.addEventListener('submit', (ev) => { ev.preventDefault(); passwordSubmit(passForm.elements.email.value, passForm.elements.password.value); });
    codeForm.addEventListener('submit', (ev) => { ev.preventDefault(); verify(codeForm.elements.code.value); });
    newForm.addEventListener('submit', (ev) => { ev.preventDefault(); saveNewPassword(newForm.elements.password.value); });
    dialog.querySelector('.ac-google').addEventListener('click', googleSignIn);
    dialog.querySelector('.ac-mode').addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));
    dialog.querySelector('.ac-code').addEventListener('click', () => { afterCode = null; sendCode(passForm.elements.email.value); });
    dialog.querySelector('.ac-forgot').addEventListener('click', () => { afterCode = 'newpass'; sendCode(passForm.elements.email.value); });
    dialog.querySelector('.ac-resend').addEventListener('click', () => sendCode(pendingEmail));
    dialog.querySelector('.ac-change').addEventListener('click', () => step('email'));
    dialog.querySelector('.ac-skip').addEventListener('click', () => dialog.close());
    dialog.querySelector('.ac-signout').addEventListener('click', signOut);
    renderCaptcha(dialog.querySelector('.ac-captcha'));
  }

  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    dialog.querySelector('.ac-title').textContent = signup ? 'Create your account' : 'Sign in';
    dialog.querySelector('.ac-submit').textContent = signup ? 'Create account' : 'Sign in';
    dialog.querySelector('.ac-mode').textContent = signup ? 'Already have an account? Sign in' : 'New here? Create an account';
    dialog.querySelector('.ac-forgot').hidden = signup;
    const pw = dialog.querySelector('.ac-pass-form [name=password]');
    pw.autocomplete = signup ? 'new-password' : 'current-password';
    pw.placeholder = '';
    dialog.querySelector('.ac-rules').hidden = !signup;
    status('');
  }

  async function showGoogle() {
    const s = await loadAuthSettings();
    const on = !native && !!(s && s.external && s.external.google);
    dialog.querySelector('.ac-google').hidden = !on;
    dialog.querySelector('.ac-or').hidden = !on;
  }

  function step(name) {
    dialog.querySelectorAll('[data-step]').forEach((s) => { s.hidden = s.dataset.step !== name; });
    status('');
    dialog.querySelectorAll('.ac-email').forEach((el) => { el.textContent = name === 'account' && user ? user.email : pendingEmail; });
    if (name === 'account') {
      dialog.querySelector('.ac-pro').textContent = window.Pro && window.Pro.isPro()
        ? 'EquityFoundry Pro is active on this account.'
        : 'Free plan. Pro purchases are tied to this account.';
    }
    if (name === 'newpass') dialog.querySelector('[data-step="newpass"] [name=email]').value = (user && user.email) || pendingEmail;
    const input = dialog.querySelector(`[data-step="${name}"] input:not([hidden])`);
    if (input) setTimeout(() => input.focus(), 30);
  }

  function status(msg, isError) {
    const el = dialog.querySelector('.ac-status');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function busy(on) {
    dialog.querySelectorAll('button[type=submit], .ac-google').forEach((b) => { b.disabled = on; });
  }

  const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

  function finishSignIn(session) {
    if (session) setUser(session.user);
    status('');
    dialog.close();
  }

  // Lets Chrome, Safari and password managers offer to save the password.
  function rememberPassword(email, password) {
    try {
      if (window.PasswordCredential && navigator.credentials) {
        navigator.credentials.store(new window.PasswordCredential({ id: email, password, name: email })).catch(() => {});
      }
    } catch (_) {}
  }

  async function passwordSubmit(email, password) {
    email = String(email || '').trim();
    if (!validEmail(email)) { status('Enter a valid email address.', true); return; }
    if (mode === 'signup' && passwordProblems(password).length) { status(PASSWORD_HELP, true); return; }
    if (mode !== 'signup' && !password) { status('Enter your password.', true); return; }
    pendingEmail = email;
    busy(true);
    status(mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    try {
      const c = await getClient();
      if (mode === 'signup') {
        const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname, captchaToken: await captchaFor() } });
        if (error) {
          if (/registered|exists/i.test(error.message || '')) throw new Error('That email already has an account. Sign in instead, or tap “Forgot password?”.');
          throw error;
        }
        if (data.session) { rememberPassword(email, password); finishSignIn(data.session); return; }
        // Supabase hides whether an address is taken: no identities means it is.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('That email already has an account. Sign in instead, or tap “Forgot password?”.');
        }
        // Email confirmation is on: finish with the code from the email.
        rememberPassword(email, password);
        afterCode = null;
        step('code');
        dialog.querySelector('.ac-code-msg').innerHTML = 'To confirm it’s your email, enter the 6-digit code we sent to <strong class="ac-email"></strong>. You only do this once: after that, you sign in with your password.';
        dialog.querySelector('.ac-code-msg .ac-email').textContent = email;
        return;
      }
      const { data, error } = await c.auth.signInWithPassword({ email, password, options: { captchaToken: await captchaFor() } });
      if (error) {
        if (/captcha/i.test(error.message || '')) throw new Error('The “are you human” check didn’t go through. Try again.');
        if (/confirm/i.test(error.message || '')) throw new Error('Confirm your email first: tap “Email me a sign-in code instead”.');
        if (/invalid/i.test(error.message || '')) throw new Error('Wrong email or password. No password yet? Tap “Email me a sign-in code instead”, then set one.');
        throw error;
      }
      rememberPassword(email, password);
      finishSignIn(data.session);
    } catch (err) {
      status(err.status === 429 || /rate/i.test(err.message || '') ? 'Too many tries. Wait a minute and try again.'
        : err.message && !/fetch/i.test(err.message) ? err.message : 'Couldn’t reach the sign-in service. Check your connection and try again.', true);
    } finally {
      busy(false);
    }
  }

  async function googleSignIn() {
    busy(true);
    status('Opening Google…');
    try {
      const c = await getClient();
      const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (error) throw error;
      // The page now goes to Google and comes back signed in.
    } catch (err) {
      status('Google sign-in isn’t available right now. Use your email instead.', true);
      busy(false);
    }
  }

  async function sendCode(email) {
    email = String(email || '').trim();
    if (!validEmail(email)) { status('Enter your email address above first.', true); return; }
    busy(true);
    status('Sending…');
    try {
      const c = await getClient();
      const { error } = await c.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: afterCode !== 'newpass', emailRedirectTo: location.origin + location.pathname, captchaToken: await captchaFor() },
      });
      if (error) throw error;
      pendingEmail = email;
      step('code');
      dialog.querySelector('.ac-code-msg').innerHTML = 'We sent a 6-digit code to <strong class="ac-email"></strong>. Enter it below, or tap the link in the email.';
      dialog.querySelector('.ac-code-msg .ac-email').textContent = email;
    } catch (err) {
      // A server error means the email service failed, not the connection.
      status(/captcha|human/i.test(err.message || '')
        ? 'The “are you human” check didn’t go through. Try again.'
        : /rate|limit/i.test(err.message || '') || err.status === 429
        ? 'Too many emails sent. Wait a minute and try again.'
        : /not found|signups not allowed/i.test(err.message || '')
          ? 'There’s no account with that email yet. Tap “New here? Create an account”.'
          : err.status >= 500
            ? 'We couldn’t send the sign-in email right now. Please try again in a few minutes.'
            : 'Couldn’t reach the sign-in service. Check your connection and try again.', true);
    } finally {
      busy(false);
    }
  }

  async function verify(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(code)) { status('Enter the code from the email.', true); return; }
    busy(true);
    status('Signing in…');
    try {
      const c = await getClient();
      let res = await c.auth.verifyOtp({ email: pendingEmail, token: code, type: 'email' });
      if (res.error) res = await c.auth.verifyOtp({ email: pendingEmail, token: code, type: 'signup' });
      if (res.error) throw res.error;
      setUser(res.data.user);
      if (afterCode === 'newpass') { afterCode = null; step('newpass'); return; }
      status('');
      dialog.close();
    } catch (err) {
      status('That code didn’t work. Check it, or send a new one.', true);
    } finally {
      busy(false);
    }
  }

  async function saveNewPassword(password) {
    if (passwordProblems(password).length) { status(PASSWORD_HELP, true); return; }
    busy(true);
    status('Saving…');
    try {
      await setPassword(password);
      rememberPassword((user && user.email) || pendingEmail, password);
      status('');
      dialog.close();
      document.dispatchEvent(new CustomEvent('rental-calc:toast', { detail: 'Password saved. Next time, sign in with it.' }));
    } catch (err) {
      status(err.message || 'Couldn’t save the password. Try again.', true);
    } finally {
      busy(false);
    }
  }

  // Changing a password while signed in needs a code from the person's email
  // (Supabase "reauthentication"), so someone using an unlocked device can't
  // quietly change it.
  async function sendPasswordCode() {
    const c = await getClient();
    const { error } = await c.auth.reauthenticate();
    if (error) {
      if (error.status === 429 || /rate/i.test(error.message || '')) throw new Error('Too many emails sent. Wait a minute and try again.');
      throw error;
    }
  }

  async function setPassword(password, nonce) {
    if (passwordProblems(password).length) throw new Error(PASSWORD_HELP);
    const c = await getClient();
    const { error } = await c.auth.updateUser(nonce ? { password, nonce } : { password });
    if (error) {
      if (/nonce|reauthenticat/i.test(error.message || '') || error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') {
        throw new Error(nonce ? 'That code didn’t work. Check it, or send a new one.' : 'Enter the code we email you to change your password.');
      }
      if (/different/i.test(error.message || '')) throw new Error('That’s already your password. Pick a different one.');
      if (/weak|short|characters|contain/i.test(error.message || '') || error.code === 'weak_password') throw new Error(PASSWORD_HELP);
      throw error;
    }
  }

  // A saved password (Chrome, Android) can sign in with one tap.
  async function offerSavedPassword() {
    try {
      if (!window.PasswordCredential || !navigator.credentials) return;
      const cred = await navigator.credentials.get({ password: true, mediation: 'optional' });
      if (cred && cred.password && dialog.open && !user) {
        const f = dialog.querySelector('.ac-pass-form');
        f.elements.email.value = cred.id;
        f.elements.password.value = cred.password;
        setMode('signin');
        passwordSubmit(cred.id, cred.password);
      }
    } catch (_) {}
  }

  // scope 'global' also signs out every other device.
  async function signOut(scope = 'local') {
    try { await (await getClient()).auth.signOut({ scope }); } catch (_) {}
    profile = null;
    setUser(null);
    if (dialog && dialog.open) dialog.close();
  }

  // ---- profile (name, email preferences, settings) -------------------------

  let profile = null;

  async function loadProfile() {
    if (!user) return null;
    const c = await getClient();
    const { data, error } = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (data) { profile = data; return profile; }
    const created = await c.from('profiles').insert({ id: user.id }).select().single();
    if (created.error) throw created.error;
    profile = created.data;
    return profile;
  }

  async function saveProfile(patch) {
    if (!user) throw new Error('Not signed in');
    const c = await getClient();
    const { data, error } = await c.from('profiles').update(patch).eq('id', user.id).select().single();
    if (error) throw error;
    profile = data;
    return profile;
  }

  // Supabase emails a confirmation link to the new address; the change
  // takes effect once it's clicked.
  async function updateEmail(email) {
    const c = await getClient();
    const { error } = await c.auth.updateUser({ email }, { emailRedirectTo: location.origin + location.pathname });
    if (error) throw error;
  }

  async function onLaunchList() {
    const c = await getClient();
    const { data, error } = await c.from('launch_signups').select('email').limit(1);
    if (error) throw error;
    return data.length > 0;
  }

  async function leaveLaunchList() {
    const c = await getClient();
    const { error } = await c.from('launch_signups').delete().eq('email', user.email.toLowerCase());
    if (error) throw error;
  }

  async function deleteAccount() {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    const token = data.session && data.session.access_token;
    if (!token) throw new Error('Sign in again, then retry.');
    const res = await fetch(`${config.url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not delete the account.');
    await signOut('local');
  }

  function open(reason, opts = {}) {
    if (!dialog) build();
    dialog.querySelector('.ac-reason').textContent = reason || '';
    if (!user) { setMode(opts.signup ? 'signup' : 'signin'); showGoogle(); }
    step(user ? 'account' : 'email');
    if (!dialog.open) dialog.showModal();
    if (!user && !opts.noAuto) offerSavedPassword();
    return new Promise((resolve) => { resolveDialog = resolve; });
  }

  // ---- header button ---------------------------------------------------------

  function renderButton() {
    const b = document.getElementById('btn-account');
    if (!b) return;
    b.hidden = !config.accountsEnabled && !user;
    b.textContent = user ? 'Account' : 'Sign in';
    b.title = user ? user.email : 'Sign in or create an account';
    b.classList.toggle('signed-in', !!user);
  }

  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#btn-account')) return;
    if (user && window.AccountPage) window.AccountPage.open();
    else open();
  });

  window.Account = {
    // Off until sign-in emails can reach customers (see config.js).
    enabled: !!config.accountsEnabled,
    init,
    user: () => user,
    onChange: (cb) => listeners.push(cb),
    open,
    // Resolves with the signed-in user, asking them to sign in first if needed.
    require: (reason) => (user ? Promise.resolve(user) : open(reason)),
    signOut,
    profile: () => profile,
    loadProfile,
    saveProfile,
    updateEmail,
    onLaunchList,
    leaveLaunchList,
    deleteAccount,
    // The Supabase client, for features that store data (Ingot sync).
    client: getClient,
    setPassword,
    sendPasswordCode,
    passwordProblems,
    attachRules,
    PASSWORD_HELP,
    // Which sign-in methods Supabase has switched on (Google, email confirmation).
    authSettings: loadAuthSettings,
  };
  renderButton();
})();
