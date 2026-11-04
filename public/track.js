/* Davlin ad tracking: Google Ads + Meta Pixel.
   Paste the IDs below once the ad accounts exist; empty = nothing loads.
   Also remembers which ad a visitor came from (utm_*, gclid, fbclid) so it can be added to quote emails. */
window.DAVLIN_TRACKING = {
  googleAdsId: '',        // e.g. 'AW-123456789'
  googleAdsLeadLabel: '', // conversion label for "Quote submitted", e.g. 'AbCdEfGhIjK'
  metaPixelId: ''         // e.g. '123456789012345'
};

(function () {
  'use strict';
  var T = window.DAVLIN_TRACKING;

  // remember where the visitor came from (first ad click this session wins)
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  try {
    var q = new URLSearchParams(location.search), got = {};
    KEYS.forEach(function (k) { if (q.get(k)) got[k] = q.get(k).slice(0, 120); });
    if (Object.keys(got).length && !sessionStorage.getItem('davlin_src')) {
      got.landing = location.pathname;
      sessionStorage.setItem('davlin_src', JSON.stringify(got));
    }
  } catch (e) {}
  window.davlinSource = function () {
    var s = {};
    try { s = JSON.parse(sessionStorage.getItem('davlin_src') || '{}'); } catch (e) {}
    var out = [];
    if (s.utm_source || s.utm_medium) out.push((s.utm_source || '?') + ' / ' + (s.utm_medium || '?'));
    if (s.utm_campaign) out.push('campaign: ' + s.utm_campaign);
    if (s.utm_term) out.push('keyword: ' + s.utm_term);
    if (s.utm_content) out.push('ad: ' + s.utm_content);
    if (s.gclid) out.push('Google Ads click');
    if (s.fbclid) out.push('Facebook/Instagram click');
    if (!out.length && document.referrer && document.referrer.indexOf(location.host) < 0) out.push('referrer: ' + document.referrer.slice(0, 120));
    if (s.landing) out.push('landing page: ' + s.landing);
    return out.join(' · ');
  };

  // Google Ads tag
  if (T.googleAdsId) {
    var g = document.createElement('script'); g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(T.googleAdsId);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', T.googleAdsId);
  }

  // Meta Pixel
  if (T.metaPixelId) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', T.metaPixelId);
    window.fbq('track', 'PageView');
  }

  // call when a quote request is sent
  window.davlinLead = function (ref) {
    try {
      if (window.gtag && T.googleAdsId && T.googleAdsLeadLabel) window.gtag('event', 'conversion', { send_to: T.googleAdsId + '/' + T.googleAdsLeadLabel, transaction_id: ref || '' });
      if (window.fbq) window.fbq('track', 'Lead', { content_name: 'Custom socks quote' }, ref ? { eventID: ref } : undefined);
      window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'quote_submitted' });
    } catch (e) {}
  };
})();
