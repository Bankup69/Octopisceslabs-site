// "Notify me" sign-ups for the iPhone and Android launch, stored in Supabase
// through the join_launch_list() database function. Visitors can add
// themselves but can't read the list.
(function () {
  'use strict';

  const config = window.APP_CONFIG;
  const DONE_KEY = 'rental-calc:launch-signup';
  const HIDE_KEY = 'rental-calc:launch-banner-hidden';
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

  const BELL = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>';

  const read = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

  async function join(email, source) {
    const res = await fetch(`${config.supabase.url}/rest/v1/rpc/join_launch_list`, {
      method: 'POST',
      headers: { apikey: config.supabase.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_email: email, p_source: source || 'rental-calc' }),
    });
    if (!res.ok) throw new Error(`Sign-up failed (${res.status})`);
  }

  // ---- dialog ---------------------------------------------------------------

  let dialog;
  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'launch-dialog';
    dialog.innerHTML = `
      <button type="button" class="icon close" aria-label="Close">×</button>
      <div class="launch-icon">${BELL}</div>
      <section data-state="ask">
        <h2>Rental Calc is coming to iPhone and Android</h2>
        <p>The apps are in the works. Leave your email and we’ll send you one note when they launch.</p>
        <form novalidate>
          <label>Email <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
          <button type="submit" class="primary">${BELL} Notify me</button>
        </form>
        <p class="hint">Just the launch announcement, no spam. If you buy Pro on the website, it carries over to the apps when you sign in with the same email.</p>
        <p class="launch-status" role="status"></p>
      </section>
      <section data-state="done" hidden>
        <h2>You’re on the list</h2>
        <p>We’ll send one email to <strong class="launch-email"></strong> when the iPhone and Android apps launch.</p>
        <p class="hint">If you buy Pro on the website before then, sign in to the apps with this same email and Pro carries over.</p>
        <button type="button" class="primary launch-close">Done</button>
      </section>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('.close, .launch-close').forEach((b) => b.addEventListener('click', () => dialog.close()));
    const form = dialog.querySelector('form');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = form.elements.email.value.trim();
      const out = dialog.querySelector('.launch-status');
      out.classList.remove('error');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        out.textContent = 'Enter a valid email address.';
        out.classList.add('error');
        return;
      }
      form.querySelector('button').disabled = true;
      out.textContent = 'Adding you…';
      try {
        await join(email, 'rental-calc-app');
        write(DONE_KEY, '1');
        out.textContent = '';
        dialog.querySelector('.launch-email').textContent = email;
        showState('done');
        renderBanner();
      } catch (err) {
        out.textContent = 'Couldn’t add you right now. Check your connection and try again.';
        out.classList.add('error');
      } finally {
        form.querySelector('button').disabled = false;
      }
    });
  }

  // "ask" shows the form; "done" replaces it with a confirmation.
  function showState(name) {
    dialog.querySelectorAll('[data-state]').forEach((el) => { el.hidden = el.dataset.state !== name; });
    if (name === 'done') dialog.querySelector('.launch-close').focus();
  }

  function open() {
    if (!dialog) build();
    const form = dialog.querySelector('form');
    showState('ask');
    dialog.querySelector('.launch-status').textContent = '';
    const user = window.Account && window.Account.user();
    if (user && !form.elements.email.value) form.elements.email.value = user.email;
    if (!dialog.open) dialog.showModal();
    setTimeout(() => form.elements.email.focus(), 30);
  }

  // ---- banner on the calculator ----------------------------------------------

  function renderBanner() {
    const slot = document.getElementById('launch-banner');
    if (!slot) return;
    const done = read(DONE_KEY) === '1';
    slot.hidden = native || read(HIDE_KEY) === '1';
    if (slot.hidden) return;
    slot.innerHTML = done
      ? `<span class="launch-icon">${BELL}</span><span>You’re on the list for the iPhone and Android apps. We’ll email you at launch.</span>` +
        '<button type="button" class="icon launch-hide" aria-label="Hide">×</button>'
      : `<span class="launch-icon">${BELL}</span><span><strong>iPhone and Android apps are in the works.</strong> Want to know when they launch?</span>` +
        `<button type="button" class="primary launch-open">${BELL} Notify me</button>` +
        '<button type="button" class="icon launch-hide" aria-label="Hide">×</button>';
  }

  document.addEventListener('click', (ev) => {
    if (ev.target.closest('.launch-open')) open();
    if (ev.target.closest('.launch-hide')) { write(HIDE_KEY, '1'); renderBanner(); }
  });

  renderBanner();
  // octopisceslabs.com links here with ?notify=1
  if (!native && new URLSearchParams(location.search).get('notify') === '1') open();

  window.Launch = { open, join };
})();
