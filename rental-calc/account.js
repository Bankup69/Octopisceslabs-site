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
    return /access_token=|error_description=/.test(location.hash);
  }

  async function init() {
    if (!hasStoredSession()) return null;
    try {
      const c = await getClient();
      const { data } = await c.auth.getSession();
      setUser(data.session ? data.session.user : null);
      // Clean the sign-in details out of the address bar after a link sign-in.
      if (/access_token=/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    } catch (err) {
      console.warn('Accounts unavailable', err);
    }
    return user;
  }

  // ---- sign-in dialog -------------------------------------------------------

  let dialog;
  let resolveDialog = null;
  let pendingEmail = '';

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'account-dialog';
    dialog.innerHTML = `
      <button type="button" class="icon close" aria-label="Close">×</button>
      <section data-step="email">
        <h2>Sign in or create an account</h2>
        <p class="ac-reason"></p>
        <form class="ac-form" novalidate>
          <label>Email <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
          <button type="submit" class="primary">Email me a sign-in code</button>
        </form>
        <p class="hint">No password needed. Use the same email in the iPhone and Android apps to keep Pro on every device.</p>
      </section>
      <section data-step="code" hidden>
        <h2>Check your email</h2>
        <p>We sent a 6-digit code to <strong class="ac-email"></strong>. Enter it below, or tap the link in the email.</p>
        <form class="ac-form" novalidate>
          <label>Code <input type="text" name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="10" required></label>
          <button type="submit" class="primary">Sign in</button>
        </form>
        <p class="ac-links"><button type="button" class="link ac-resend">Send a new code</button> · <button type="button" class="link ac-change">Use a different email</button></p>
      </section>
      <section data-step="account" hidden>
        <h2>Your account</h2>
        <p>Signed in as <strong class="ac-email"></strong></p>
        <p class="ac-pro"></p>
        <button type="button" class="ac-signout">Sign out</button>
      </section>
      <p class="ac-status" role="status"></p>`;
    document.body.appendChild(dialog);

    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (resolveDialog) { resolveDialog(user); resolveDialog = null; }
    });
    const [emailForm, codeForm] = dialog.querySelectorAll('form');
    emailForm.addEventListener('submit', (ev) => { ev.preventDefault(); sendCode(emailForm.elements.email.value); });
    codeForm.addEventListener('submit', (ev) => { ev.preventDefault(); verify(codeForm.elements.code.value); });
    dialog.querySelector('.ac-resend').addEventListener('click', () => sendCode(pendingEmail));
    dialog.querySelector('.ac-change').addEventListener('click', () => step('email'));
    dialog.querySelector('.ac-signout').addEventListener('click', signOut);
  }

  function step(name) {
    dialog.querySelectorAll('[data-step]').forEach((s) => { s.hidden = s.dataset.step !== name; });
    status('');
    dialog.querySelectorAll('.ac-email').forEach((el) => { el.textContent = name === 'account' && user ? user.email : pendingEmail; });
    if (name === 'account') {
      dialog.querySelector('.ac-pro').textContent = window.Pro && window.Pro.isPro()
        ? 'Rental Calc Pro is active on this account.'
        : 'Free plan. Pro purchases are tied to this account.';
    }
    const input = dialog.querySelector(`[data-step="${name}"] input`);
    if (input) setTimeout(() => input.focus(), 30);
  }

  function status(msg, isError) {
    const el = dialog.querySelector('.ac-status');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function busy(on) {
    dialog.querySelectorAll('button[type=submit]').forEach((b) => { b.disabled = on; });
  }

  async function sendCode(email) {
    email = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { status('Enter a valid email address.', true); return; }
    busy(true);
    status('Sending…');
    try {
      const c = await getClient();
      const { error } = await c.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      pendingEmail = email;
      step('code');
    } catch (err) {
      // A server error means the email service failed, not the connection.
      status(/rate|limit/i.test(err.message || '') || err.status === 429
        ? 'Too many emails sent. Wait a minute and try again.'
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
      const { data, error } = await c.auth.verifyOtp({ email: pendingEmail, token: code, type: 'email' });
      if (error) throw error;
      setUser(data.user);
      status('');
      dialog.close();
    } catch (err) {
      status('That code didn’t work. Check it, or send a new one.', true);
    } finally {
      busy(false);
    }
  }

  async function signOut() {
    try { await (await getClient()).auth.signOut(); } catch (_) {}
    setUser(null);
    dialog.close();
  }

  function open(reason) {
    if (!dialog) build();
    dialog.querySelector('.ac-reason').textContent = reason || '';
    step(user ? 'account' : 'email');
    if (!dialog.open) dialog.showModal();
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
    if (ev.target.closest('#btn-account')) open();
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
  };
  renderButton();
})();
