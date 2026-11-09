// Anonymous usage counts, stored in Supabase through the log_event() database
// function: a page visit, the first calculation someone runs, and opening the
// Pro screen. Nothing personal is sent: no names, emails, account IDs,
// property numbers or cookies. Just the event name and, when the visit came
// from one of our links, which ad or post it was (utm_source, utm_content and
// the /deal/ example name).
(function () {
  'use strict';

  const config = window.APP_CONFIG || {};
  const sb = config.supabase || {};
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const params = new URLSearchParams(location.search);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const off = !config.stats || config.stats.enabled === false || !sb.url || !sb.publishableKey || local ||
    params.get('stats') === 'off' || navigator.webdriver === true;

  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} },
  };

  // Remember where this visit came from for the rest of the session, since
  // the app rewrites the address bar after it loads.
  const SRC_KEY = 'rental-calc:stats-src';
  let from = null;
  try { from = JSON.parse(ss.get(SRC_KEY) || 'null'); } catch (_) {}
  if (!from) {
    from = {
      src: params.get('utm_source') || (document.referrer ? hostOf(document.referrer) : null),
      content: params.get('utm_content'),
      deal: params.get('deal'),
    };
    ss.set(SRC_KEY, JSON.stringify(from));
  }

  function hostOf(url) {
    try { const h = new URL(url).hostname; return h === location.hostname ? null : h; } catch (_) { return null; }
  }

  function log(name, once) {
    if (off) return;
    if (once) { const k = 'rental-calc:stats-' + name; if (ss.get(k)) return; ss.set(k, '1'); }
    try {
      fetch(`${sb.url}/rest/v1/rpc/log_event`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: sb.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_name: name, p_src: from.src, p_content: from.content, p_deal: from.deal,
          p_platform: native ? 'app' : 'web' }),
      }).catch(() => {});
    } catch (_) {}
  }

  window.Stats = {
    log,
    // True when the visit came from an ad, a post or a /deal/ example link.
    fromCampaign: () => !!(from.deal || params.get('utm_source') || params.get('p')),
  };

  log('visit', true);
})();
