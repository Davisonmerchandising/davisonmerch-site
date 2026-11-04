/* ---------- Product list and prices: the ONE place to edit products ----------
   Used by the quote form, the Make payment page and the Apparel page.
   Keep netlify/lib/shared.mjs CATALOG identical (the server re-checks prices). */
window.DSS_CATALOG = {"socks": {"label": "Socks", "unit": "pairs", "one": "pair", "min": 100, "max": 4999, "crew": true, "tiers": [[100, 7.95], [250, 7.25], [500, 6.95], [1000, 6.25], [2000, 5.95]], "models": [{"id": "cotton", "name": "Premium Cotton Socks"}, {"id": "performance", "name": "Performance Socks", "extra": 1.5}, {"id": "merino", "name": "Merino Wool Blend Socks", "extra": 2.0}, {"id": "dress", "name": "Dress Socks 200 Needle"}, {"id": "sublimation", "name": "Sublimation Print Socks"}, {"id": "dtg", "name": "DTG Print Socks"}]}, "beanies": {"label": "Knit beanies", "unit": "units", "one": "unit", "min": 100, "max": 9999, "tiers": [[100, 12.0]], "models": [{"id": "beanie", "name": "Knit Beanie (cuffed)"}, {"id": "skullcap", "name": "Skullcap (cuffless)"}, {"id": "pom", "name": "Pom Beanie"}]}, "apparel": {"label": "T-shirts and apparel", "unit": "pieces", "one": "piece", "min": 144, "max": 9999, "models": [{"id": "ap0", "name": "Gildan G5000 · Short sleeve tee", "group": "Short sleeve tees", "price": 11.25}, {"id": "ap1", "name": "Optima 47265 · Logan Box short sleeve tee", "group": "Short sleeve tees", "price": 11.7}, {"id": "ap2", "name": "Cotton Collective 7.5 oz · Heavyweight box tee", "group": "Short sleeve tees", "price": 15.75}, {"id": "ap3", "name": "Comfort Colors 1717 · Short sleeve tee", "group": "Short sleeve tees", "price": 16.2}, {"id": "ap4", "name": "Optima 47356 · Montage long sleeve tee", "group": "Long sleeve tees", "price": 13.05}, {"id": "ap5", "name": "Gildan G5400 · Long sleeve tee", "group": "Long sleeve tees", "price": 15.75}, {"id": "ap6", "name": "Cotton Collective 7.5 oz · Heavyweight long sleeve box tee", "group": "Long sleeve tees", "price": 18.45}, {"id": "ap7", "name": "Comfort Colors 6014 · Long sleeve tee", "group": "Long sleeve tees", "price": 24.75}, {"id": "ap8", "name": "Independent Trading SS3000 · Lightweight crew", "group": "Crewneck fleece", "price": 21.6}, {"id": "ap9", "name": "Independent Trading IND3000 · Heavyweight crew", "group": "Crewneck fleece", "price": 27.9}, {"id": "ap10", "name": "Cotton Collective 17 oz · Heavyweight box crew", "group": "Crewneck fleece", "price": 40.95}, {"id": "ap11", "name": "Independent Trading SS4500 · 8.5 oz. Midweight Pullover Hood", "group": "Hoodies", "price": 23.4}, {"id": "ap12", "name": "Independent Trading IND4000 · Heavyweight hoodie", "group": "Hoodies", "price": 32.4}, {"id": "ap13", "name": "Cotton Collective 11 oz · Special hoodie", "group": "Hoodies", "price": 45.45}]}};
window.DSS_UNIT_PRICE = function (product, model, qty) {
  var c = window.DSS_CATALOG[product]; if (!c) return null;
  var m = c.models.filter(function (x) { return x.id === model; })[0]; if (!m) return null;
  if (m.price != null) return m.price;
  var p = c.tiers[0][1]; c.tiers.forEach(function (t) { if (qty >= t[0]) p = t[1]; });
  return Math.round((p + (m.extra || 0)) * 100) / 100;
};
window.AP_BLANKS = window.DSS_CATALOG.apparel.models.map(function (m) { return { cat: m.group, label: m.name, price: m.price }; });

/* ---------- every page opens at the top (unless the link points at a section) ---------- */
(function () {
  'use strict';
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  var loaded = false;
  function top() {
    if (location.hash && location.hash.length > 1) {
      var target = null;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
      if (target && loaded) target.scrollIntoView({ block: 'start' });
      return;
    }
    window.scrollTo(0, 0);
    var first = document.body && document.body.firstElementChild;
    if (first && first.scrollIntoView) first.scrollIntoView({ block: 'start' });
  }
  top();
  window.addEventListener('pageshow', top);
  window.addEventListener('load', function () { loaded = true; top(); setTimeout(top, 60); setTimeout(top, 500); setTimeout(top, 1200); });
})();

(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  $('#year').textContent = new Date().getFullYear();

  /* sticky menu */
  var bar = $('#bar'), toggle = $('.bar-toggle'), nav = $('#nav');
  function onScroll() { bar.classList.toggle('scrolled', window.scrollY > 260); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  toggle.addEventListener('click', function () {
    toggle.setAttribute('aria-expanded', nav.classList.toggle('open'));
  });
  $$('a', nav).forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); });
  });

  /* "Quote this sock" links pre-select the sock in the form */
  var styleSel = $('#f-style');
  $$('[data-style]').forEach(function (a) {
    a.addEventListener('click', function () { if (styleSel) styleSel.value = a.getAttribute('data-style'); });
  });

  /* quote form: fill in, review, then send */
  var form = $('#quote-form'), msg = $('#form-msg');
  if (!form) return;
  function say(text, cls) { msg.textContent = text; msg.className = 'form-msg ' + (cls || ''); }
  var fieldsBox = $('.qf-fields', form), review = $('#qf-review'), sum = $('#qf-sum'), count = $('#qf-count');
  var same = $('#f-ship-same'), ship = $('#f-ship');
  function g(n) { var el = form.elements[n]; return el && el.value ? String(el.value).trim() : ''; }
  function syncShip() { ship.hidden = same.checked; ship.disabled = same.checked; tally(); }
  function valid(el) {
    if (el.disabled || el.closest('fieldset[disabled]')) return true;
    var v = el.value.trim();
    if (!v) return false;
    if (el.type === 'email') return /^\S+@\S+\.\S+$/.test(v);
    if (el.name === 'quantity') return Number(v) >= Number(el.min || 100);
    return true;
  }
  function req() { return $$('[required]', form).filter(function (el) { return !el.closest('fieldset[disabled]'); }); }
  function tally() {
    var left = req().filter(function (el) { return !valid(el); }).length;
    count.textContent = left ? left + ' detail' + (left > 1 ? 's' : '') + ' to complete before review' : 'Ready to review';
  }
  same.addEventListener('change', syncShip);
  function clearBad(e) { if (e.target.classList && e.target.classList.contains('bad') && valid(e.target)) e.target.classList.remove('bad'); tally(); }
  form.addEventListener('input', clearBad); form.addEventListener('change', clearBad);
  form.addEventListener('reset', function () { setTimeout(function () { syncShip(); }, 0); });
  syncShip();

  function addr(p) {
    return [g(p + '-address1'), g(p + '-address2'), [g(p + '-city'), g(p + '-state')].filter(Boolean).join(', ') + (g(p + '-zip') ? ' ' + g(p + '-zip') : ''), g(p + '-country')].filter(Boolean).join(', ');
  }
  function rows() {
    var file = form.artwork.files[0];
    return [
      ['Project name', g('project')], ['Brand or company', g('company')], ['Your name', g('name')], ['Email', g('email')], ['Phone', g('phone')], ['Sales rep', g('rep')],
      ['Product', g('product') || (form.querySelector('input[name="product"]:checked') || {}).value], ['Style', g('style')], ['Height', g('height')], ['Quantity', g('quantity') ? Number(g('quantity')).toLocaleString('en-US') + ' ' + (window.dssUnit ? window.dssUnit() : 'pairs') : ''],
      ['Design ideas', g('details')], ['Art file', file ? file.name : ''],
      ['Billing address', addr('bill')], ['Shipping address', same.checked ? 'Same as billing' : [g('ship-name'), addr('ship')].filter(Boolean).join(', ')],
      ['In-hands date', g('inhands')], ['Budget', g('budget')], ['Notes', g('notes')]
    ].filter(function (r) { return r[1]; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    req().forEach(function (el) { var ok = valid(el); el.classList.toggle('bad', !ok); if (!ok && !bad) bad = el; });
    if (bad) {
      say(bad.name === 'quantity' && bad.value ? 'The minimum order is ' + bad.min + ' ' + (window.dssUnit ? window.dssUnit() : 'pairs') + ' per style.' : 'Complete the highlighted details to review your request.', 'err');
      bad.focus(); return;
    }
    var file = form.artwork.files[0];
    if (file && file.size > 5 * 1024 * 1024) { say('That file is over 5 MB. Leave it off and email it to sales@davisonmerch.com.', 'err'); return; }
    sum.innerHTML = '';
    rows().forEach(function (r) {
      var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = r[0]; dd.textContent = r[1]; d.appendChild(dt); d.appendChild(dd); sum.appendChild(d);
    });
    fieldsBox.hidden = true; review.hidden = false; say('');
    review.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#qf-edit').addEventListener('click', function () { review.hidden = true; fieldsBox.hidden = false; say(''); });

  function done() { form.reset(); review.hidden = true; fieldsBox.hidden = false; say('Quote request sent. Our customer service team will get back to you shortly.', 'ok'); }
  $('#qf-send').addEventListener('click', function () {
    var btn = this, file = form.artwork.files[0];
    btn.disabled = true; say('Sending your quote request…');
    // 1) quote-request function (emails sales@ with the file attached)
    // 2) Netlify Forms, when hosted on Netlify without functions
    // 3) otherwise open the customer's email app, filled in, so no request is lost
    function emailFallback() {
      var body = rows().map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + (file ? '\n\nI will attach my art file (' + file.name + ') to this email.' : '');
      var subject = 'QUOTE REQUEST: ' + g('company') + ' - ' + g('project') + ' - ' + g('quantity') + ' ' + (window.dssUnit ? window.dssUnit() : 'pairs');
      window.location.href = 'mailto:sales@davisonmerch.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      say('Your email app is opening with your quote request filled in.' + (file ? ' Attach your art file and press send.' : ' Press send to finish.'), 'ok');
    }
    fetch('/.netlify/functions/quote-request', { method: 'POST', body: new FormData(form) })
      .then(function (r) {
        if (r.ok) return done();
        if (r.status !== 404 && r.status !== 405) throw new Error(r.status);
        return fetch('/', { method: 'POST', body: new FormData(form) }).then(function (r2) {
          if (r2.ok && r2.headers.get('x-nf-request-id')) done(); else emailFallback();
        });
      })
      .catch(function () { emailFallback(); })
      .then(function () { btn.disabled = false; });
  });
})();


/* ---------- Pricing: edit the per-pair price for each quantity tier here ---------- */
(function () {
  'use strict';
  var SC = window.DSS_CATALOG.socks;
  var PRICES = SC.tiers;            // [minimum pairs, price per pair]
  var CUSTOM_FROM = SC.max + 1;     // this many pairs or more is quoted by a sales rep
  var EXTRA = {}; SC.models.forEach(function (m) { if (m.extra) EXTRA[m.id] = m.extra; });
  window.DSS_PRICING = { PRICES: PRICES, CUSTOM_FROM: CUSTOM_FROM, EXTRA: EXTRA }; // the Start order page reads these
  var type = 'cotton';
  var range = document.getElementById('calc-range'), num = document.getElementById('calc-num');
  if (!range) return;
  var unitEl = document.getElementById('calc-unit'), totalEl = document.getElementById('calc-total');
  var MIN = Number(range.min), MAX = Number(range.max);
  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function priceFor(q) { if (q >= CUSTOM_FROM) return null; var p = PRICES[0][1]; PRICES.forEach(function (t) { if (q >= t[0]) p = t[1]; }); return p + (EXTRA[type] || 0); }
  window.DSS_PRICE_FOR = priceFor;
  function clamp(q) { q = Math.round(Number(q)) || MIN; return Math.min(MAX, Math.max(MIN, q)); }
  function show(q) {
    var p = priceFor(q);
    unitEl.textContent = money(p);
    totalEl.textContent = money(p * q);
    range.style.setProperty('--fill', ((q - MIN) / (MAX - MIN) * 100) + '%');
  }
  range.addEventListener('input', function () { num.value = range.value; show(Number(range.value)); });
  num.addEventListener('input', function () { if (num.value === '') return; var q = clamp(num.value); range.value = q; show(q); });
  num.addEventListener('change', function () { var q = clamp(num.value); num.value = q; range.value = q; show(q); });
  document.getElementById('calc-go').addEventListener('click', function () {
    var f = document.getElementById('f-qty'); if (f) f.value = clamp(num.value);
    var s = document.getElementById('f-style'); if (s) s.value = typeName;
  });
  function showTiers() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tier-price]'), function (el) {
      el.textContent = money(priceFor(Number(el.getAttribute('data-tier-price'))));
    });
  }
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.price-tab')), typeName = 'Premium Cotton Socks';
  var pick = document.getElementById('tier-type'), photos = Array.prototype.slice.call(document.querySelectorAll('.tier-photo')), photoName = document.getElementById('tier-photo-name');
  function setType(t) {
    var tab = tabs.filter(function (x) { return x.getAttribute('data-type') === t; })[0]; if (!tab) return;
    type = t; typeName = tab.getAttribute('data-name');
    tabs.forEach(function (x) { x.classList.toggle('is-on', x === tab); x.setAttribute('aria-pressed', x === tab); });
    document.getElementById('price-for').textContent = typeName;
    if (pick) pick.value = t;
    photos.forEach(function (p) { p.hidden = p.getAttribute('data-type') !== t; });
    if (photoName) photoName.textContent = typeName;
    showTiers(); show(clamp(num.value));
  }
  tabs.forEach(function (tab) { tab.addEventListener('click', function () { setType(tab.getAttribute('data-type')); }); });
  if (pick) pick.addEventListener('change', function () { setType(pick.value); });
  showTiers();
  show(clamp(range.value));
})();


/* ---------- FAQ search and topic filter ---------- */
(function () {
  'use strict';
  var list = document.getElementById('faq-list');
  if (!list || !document.getElementById('faq-search')) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.faq-item'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.faq-chip'));
  var search = document.getElementById('faq-search'), empty = document.getElementById('faq-empty');
  var cat = 'all';
  function apply() {
    var q = search.value.trim().toLowerCase(), shown = 0;
    items.forEach(function (it) {
      var ok = (cat === 'all' || it.getAttribute('data-cat') === cat) && (q === '' || it.textContent.toLowerCase().indexOf(q) !== -1);
      it.hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown !== 0;
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      cat = chip.getAttribute('data-cat');
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); c.setAttribute('aria-pressed', c === chip); });
      apply();
    });
  });
  search.addEventListener('input', apply);
})();


/* ---------- rotating announcement bar and "Our socks" menu ---------- */
(function () {
  'use strict';
  var bar = document.getElementById('announce');
  if (bar && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var items = bar.querySelectorAll('span'), i = 0;
    setInterval(function () {
      items[i].classList.remove('is-on');
      i = (i + 1) % items.length;
      items[i].classList.add('is-on');
    }, 3200);
  }
  var drop = document.querySelector('.drop'), btn = document.querySelector('.drop-btn');
  if (drop && btn) {
    btn.addEventListener('click', function () { btn.setAttribute('aria-expanded', drop.classList.toggle('open')); });
    document.addEventListener('click', function (e) { if (!drop.contains(e.target)) { drop.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { drop.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }
})();


/* ---------- browse our socks: style selector ---------- */
(function () {
  'use strict';
  var sel = document.getElementById('bw-select');
  if (!sel) return;
  function show(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.bw-slide, .bw-feats'), function (el) {
      el.classList.toggle('is-on', el.getAttribute('data-style-id') === id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.bw-icon'), function (b) {
      var on = b.getAttribute('data-browse') === id;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on);
    });
    sel.value = id;
  }
  sel.addEventListener('change', function () { show(sel.value); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-browse]'), function (a) {
    a.addEventListener('click', function () { show(a.getAttribute('data-browse')); });
  });
})();


/* ---------- quote form: drag and drop file ---------- */
(function () {
  'use strict';
  var zone = document.getElementById('drop-file'), input = document.getElementById('f-art'), name = document.getElementById('file-name');
  if (!zone || !input) return;
  function show() { name.textContent = input.files[0] ? input.files[0].name : ''; }
  input.addEventListener('change', show);
  ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove('over'); }); });
  zone.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files.length) { try { input.files = e.dataTransfer.files; } catch (err) {} show(); }
  });
  var form = document.getElementById('quote-form');
  if (form) form.addEventListener('reset', function () { name.textContent = ''; });
})();


/* ---------- product pages: photo gallery; quote form: style from the link ---------- */
(function () {
  'use strict';
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.pd-thumb'));
  thumbs.forEach(function (t) {
    t.addEventListener('click', function () {
      var i = t.getAttribute('data-i');
      thumbs.forEach(function (x) { x.classList.toggle('is-on', x === t); x.setAttribute('aria-pressed', x === t); });
      Array.prototype.forEach.call(document.querySelectorAll('.pd-main'), function (m) { m.classList.toggle('is-on', m.getAttribute('data-i') === i); });
    });
  });
  var sel = document.getElementById('f-style'), m = /[?&]style=([^&#]+)/.exec(location.search);
  if (sel && m) sel.value = decodeURIComponent(m[1]);
})();


/* ---------- product pages: previous / next under the main photo, and a full-size viewer in a new window ---------- */
(function () {
  'use strict';
  var stage = document.querySelector('.pd-stage');
  if (!stage) return;
  var name = (document.querySelector('.pd-info h1') || {}).textContent || 'Photo';
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.pd-thumb'));
  var mains = Array.prototype.slice.call(stage.querySelectorAll('.pd-main'));
  function current() { for (var i = 0; i < mains.length; i++) if (mains[i].classList.contains('is-on')) return i; return 0; }
  function show(i) { i = (i + thumbs.length) % thumbs.length; if (thumbs[i]) thumbs[i].click(); }

  var CHEV_L = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

  if (thumbs.length > 1) {
    var nav = document.createElement('div');
    nav.className = 'pd-nav';
    nav.innerHTML = '<button type="button" class="pd-arrow" aria-label="Previous photo">' + CHEV_L + '</button><button type="button" class="pd-arrow" aria-label="Next photo">' + CHEV_R + '</button>';
    stage.appendChild(nav);
    nav.children[0].addEventListener('click', function () { show(current() - 1); });
    nav.children[1].addEventListener('click', function () { show(current() + 1); });
  }

  function open(img) {
    var list = [], start = 0;
    mains.forEach(function (m) {
      var im = m.querySelector('img');
      if (im && im.naturalWidth) { if (im === img) start = list.length; list.push(im.currentSrc || im.src); }
    });
    if (!list.length) return;
    var i = start, box = document.createElement('div');
    box.className = 'lbx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', name + ' photos');
    box.innerHTML = '<div class="lbx-frame"><img alt=""></div><nav aria-label="Photos"><button type="button" class="lbx-p" aria-label="Previous photo">' + CHEV_L + '</button><button type="button" class="lbx-x" aria-label="Close">' + CLOSE + '</button><button type="button" class="lbx-n" aria-label="Next photo">' + CHEV_R + '</button></nav>';
    var im = box.querySelector('img');
    function s(n) { i = (n + list.length) % list.length; im.src = list[i]; im.alt = name + ': photo ' + (i + 1) + ' of ' + list.length; }
    function close() { document.removeEventListener('keydown', key); box.remove(); document.documentElement.style.overflow = ''; img.focus(); }
    function key(e) { if (e.key === 'ArrowLeft') s(i - 1); else if (e.key === 'ArrowRight') s(i + 1); else if (e.key === 'Escape') close(); }
    box.querySelector('.lbx-p').onclick = function () { s(i - 1); };
    box.querySelector('.lbx-n').onclick = function () { s(i + 1); };
    box.querySelector('.lbx-x').onclick = close;
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    if (list.length < 2) { box.querySelector('.lbx-p').hidden = true; box.querySelector('.lbx-n').hidden = true; }
    document.addEventListener('keydown', key);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(box); s(i); box.querySelector('.lbx-x').focus();
  }
  mains.forEach(function (m) {
    var img = m.querySelector('img'); if (!img) return;
    img.tabIndex = 0; img.setAttribute('role', 'link'); img.setAttribute('aria-label', name + ': open this photo full size');
  });
  stage.addEventListener('click', function (e) { if (e.target.tagName === 'IMG') open(e.target); });
  stage.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'IMG') open(e.target); });
})();


/* ---------- talk to sales form ---------- */
(function () {
  'use strict';
  var form = document.getElementById('talk-form'); if (!form) return;
  var msg = document.getElementById('talk-msg'), btn = form.querySelector('button[type="submit"]');
  var art = document.getElementById('t-art'), drop = document.getElementById('t-drop'), list = document.getElementById('t-files');
  var picked = [];
  function files() { return picked; }
  function sync() {
    try { var dt = new DataTransfer(); picked.forEach(function (f) { dt.items.add(f); }); art.files = dt.files; } catch (e) {}
    list.innerHTML = '';
    picked.forEach(function (f, i) {
      var li = document.createElement('li'), x = document.createElement('button');
      li.textContent = f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB) ';
      x.type = 'button'; x.textContent = 'Remove'; x.setAttribute('aria-label', 'Remove ' + f.name);
      x.addEventListener('click', function () { picked.splice(i, 1); sync(); });
      li.appendChild(x); list.appendChild(li);
    });
  }
  function add(fl) { Array.prototype.forEach.call(fl, function (f) { if (picked.length < 5) picked.push(f); }); sync(); }
  if (art) {
    art.addEventListener('change', function () { var fl = Array.prototype.slice.call(art.files); picked = []; add(fl); });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) add(e.dataTransfer.files); });
  }
  function say(t, c) { msg.textContent = t; msg.className = 'form-msg ' + (c || ''); }
  function g(n) { var el = form.elements[n]; return el && el.value ? el.value.trim() : ''; }
  var pkg = new URLSearchParams(location.search).get('package');
  if (pkg && form.elements.details && !form.elements.details.value) {
    form.elements.details.value = pkg === 'Design brief' ? 'I have an idea I would like help designing: ' : 'I am interested in the ' + pkg + ' design package. ';
  }
  var topic = new URLSearchParams(location.search).get('topic');
  if (topic && form.elements.details && !form.elements.details.value) form.elements.details.value = 'I would like a quote for ' + topic + '. ';
  function emailFallback(fl) {
    var body = ['Name: ' + g('name'), 'Company or brand: ' + g('company'), 'Email: ' + g('email'), 'Phone: ' + g('phone'),
      'Timing: ' + g('timing'), 'Estimated quantity: ' + g('quantity'), '', 'Question or idea:', g('details'), '',
      (fl.length ? 'I will attach my files to this email: ' + fl.map(function (f) { return f.name; }).join(', ') : '')].join('\n');
    window.location.href = 'mailto:sales@davisonmerch.com?subject=' + encodeURIComponent('TALK TO SALES: ' + g('company')) + '&body=' + encodeURIComponent(body);
    say('Your email app is opening with your message filled in.' + (fl.length ? ' Attach your files and press send.' : ' Press send to finish.'), 'ok');
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var ok = el.value.trim() !== '' && (el.type !== 'email' || /^\S+@\S+\.\S+$/.test(el.value));
      el.classList.toggle('bad', !ok); if (!ok && !bad) bad = el;
    });
    if (bad) { say('Add your name, company, a valid email and your question so we can reply.', 'err'); bad.focus(); return; }
    var fl = files(), total = fl.reduce(function (n, f) { return n + f.size; }, 0);
    if (total > 10 * 1024 * 1024) { say('Your files are over 10 MB in total. Remove some or email them to sales@davisonmerch.com.', 'err'); return; }
    btn.disabled = true; say('Sending\u2026');
    fetch('/', { method: 'POST', body: new FormData(form) })
      .then(function (r) {
        if (r.ok && r.headers.get('x-nf-request-id')) { form.reset(); picked = []; sync(); say('Message sent. Our customer service team will get back to you shortly.', 'ok'); }
        else emailFallback(fl);
      })
      .catch(function () { emailFallback(fl); })
      .then(function () { btn.disabled = false; });
  });
})();

/* ---------- knit beanie estimator (price comes from DSS_CATALOG.beanies) ---------- */
(function () {
  'use strict';
  var r = document.getElementById('k-range'); if (!r) return;
  var Q = [100, 200, 300, 500, 1000, 3000, 5000];
  var money = function (n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function draw() {
    var n = Q[+r.value], price = window.DSS_UNIT_PRICE('beanies', 'beanie', n), q = n.toLocaleString('en-US') + (+r.value === Q.length - 1 ? '+' : '') + ' units';
    document.getElementById('k-qty').textContent = q;
    document.getElementById('k-price').textContent = money(price);
    document.getElementById('k-total').textContent = q + ' \u00b7 Estimated order total ' + money(n * price);
    document.getElementById('k-pub').textContent = money(price) + ' per unit at every quantity';
    document.getElementById('k-incl').textContent = n >= 2000 ? 'Design and retail finishing included, with scope confirmed in your brief. Tax is separate.' : 'Design, retail finishing and tax are separate below 2,000 units. Final pricing is confirmed with your specification.';
    document.getElementById('k-go').href = 'talk.html?topic=' + encodeURIComponent('knit beanies (' + q + ')');
    r.setAttribute('aria-valuetext', q);
    r.style.setProperty('--fill', (+r.value / (Q.length - 1) * 100) + '%');
  }
  r.addEventListener('input', draw); draw();
})();

/* ---------- apparel estimator ---------- */
(function () {
  'use strict';
  var B = window.AP_BLANKS, sel = document.getElementById('ap-blank'); if (!B || !sel) return;
  var num = document.getElementById('ap-num'), r = document.getElementById('ap-range');
  var BREAKS = [144, 300, 600, 1200, 2400, 3600];
  var money = function (n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function draw() {
    var b = B[+sel.value], q = Math.max(144, Math.round(+num.value) || 144);
    document.getElementById('ap-name').textContent = b.label;
    document.getElementById('ap-price').textContent = money(b.price);
    document.getElementById('ap-total').textContent = money(b.price * q);
    document.getElementById('ap-meta').textContent = q.toLocaleString('en-US') + ' pieces \u00b7 USD \u00b7 standard setup included';
    document.getElementById('ap-go').href = 'talk.html?topic=' + encodeURIComponent(q.toLocaleString('en-US') + ' pieces of ' + b.label);
    var i = 0; BREAKS.forEach(function (x, k) { if (q >= x) i = k; }); r.value = i;
    r.style.setProperty('--fill', (i / (BREAKS.length - 1) * 100) + '%');
  }
  sel.addEventListener('change', draw);
  num.addEventListener('input', draw);
  num.addEventListener('blur', function () { if ((+num.value || 0) < 144) { num.value = 144; draw(); } });
  r.addEventListener('input', function () { num.value = BREAKS[+r.value]; draw(); });
  draw();
})();

/* ---------- category bar: keep the current tab in view on phones ---------- */
(function () {
  var a = document.querySelector('.catbar a[aria-current="page"]'); if (!a) return;
  var row = a.parentNode; row.scrollLeft = a.offsetLeft - (row.clientWidth - a.offsetWidth) / 2;
})();

/* ---------- quote form: product type (socks, knit beanies, apparel) ---------- */
(function () {
  'use strict';
  var form = document.getElementById('quote-form'); if (!form) return;
  var sel = document.getElementById('f-style'), qty = document.getElementById('f-qty'), hint = document.getElementById('qty-hint');
  var lbl = document.getElementById('f-style-lbl'), height = document.getElementById('f-height');
  var C = window.DSS_CATALOG, groups = [];
  C.apparel.models.forEach(function (m) { if (groups.indexOf(m.group) < 0) groups.push(m.group); });
  var P = {
    'Socks': { label: 'Sock style', unit: C.socks.unit, min: C.socks.min, hint: 'Pairs per style, minimum ' + C.socks.min + '. All styles are crew height.',
      styles: C.socks.models.map(function (m) { return m.name; }) },
    'Knit beanies': { label: 'Beanie style', unit: C.beanies.unit, min: C.beanies.min, hint: 'Units per style, minimum ' + C.beanies.min + '.',
      styles: C.beanies.models.map(function (m) { return m.name; }) },
    'Apparel': { label: 'Apparel style', unit: C.apparel.unit, min: C.apparel.min, hint: 'Pieces per style, minimum ' + C.apparel.min + '. Tell us your preferred blank in your design ideas.',
      styles: groups }
  };
  function cur() { var r = form.querySelector('input[name="product"]:checked'); return r ? r.value : 'Socks'; }
  window.dssUnit = function () { return P[cur()].unit; };
  function setProduct(p) {
    var r = form.querySelector('input[name="product"][value="' + p + '"]'); if (r) r.checked = true;
    var c = P[p], keep = sel.value;
    sel.innerHTML = '<option value="">Please select\u2026</option>' + c.styles.map(function (s) { return '<option>' + s + '</option>'; }).join('');
    if (c.styles.indexOf(keep) > -1) sel.value = keep;
    lbl.firstChild.nodeValue = c.label;
    qty.min = c.min; qty.placeholder = c.min; hint.textContent = c.hint;
    height.value = p === 'Socks' ? 'Crew' : '';
    qty.classList.remove('bad'); sel.classList.remove('bad');
    form.dispatchEvent(new Event('change'));
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="product"]'), function (r) { r.addEventListener('change', function () { setProduct(r.value); }); });
  // sock links (product pages, pricing calculator) always switch the form back to socks first
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-style], #calc-go'); if (t && cur() !== 'Socks') setProduct('Socks');
  }, true);
  form.addEventListener('reset', function () { setTimeout(function () { setProduct('Socks'); }, 0); });
  var m = /[?&]product=(socks|beanies|apparel)/i.exec(location.search);
  setProduct(m ? { socks: 'Socks', beanies: 'Knit beanies', apparel: 'Apparel' }[m[1].toLowerCase()] : cur());
})();

/* ---------- home: shop socks by style arrows ---------- */
(function () {
  var row = document.getElementById('sty-row'); if (!row) return;
  function step(dir) { var c = row.querySelector('.sty-card'); row.scrollBy({ left: dir * (c ? c.offsetWidth + 14 : 300), behavior: 'smooth' }); }
  var p = document.querySelector('.sty-prev'), n = document.querySelector('.sty-next');
  if (p) p.addEventListener('click', function () { step(-1); });
  if (n) n.addEventListener('click', function () { step(1); });
})();

/* ---------- "Upload your design" opens the file picker on the quote form ---------- */
(function () {
  var b = document.getElementById('upload-design'), art = document.getElementById('f-art'); if (!b || !art) return;
  b.addEventListener('click', function (e) {
    e.preventDefault();
    var socks = document.querySelector('#f-product input[value="Socks"]'); if (socks && !socks.checked) socks.click();
    try { art.click(); } catch (err) {}
    var q = document.getElementById('quote'); if (q) q.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  art.addEventListener('change', function () {
    var d = document.getElementById('drop-file'); if (d && art.files.length) setTimeout(function () { d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
  });
})();

/* ---------- Sales reps: edit this list to add or remove reps (code shows in emails and Stripe for commission tracking) ---------- */
window.DSS_REPS = [
  // Format: initials - rep number. Example rep (placeholder):
  { code: 'CW - 005', name: 'Chris Wagaman' },
];
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('[data-rep]'), function (box) {
    var sel = box.querySelector('.rep-sel'), other = box.querySelector('.rep-other'), txt = box.querySelector('.rep-txt'), val = box.querySelector('.rep-val');
    window.DSS_REPS.forEach(function (r) { var o = document.createElement('option'); o.value = r.code + ' ' + r.name; o.textContent = r.code + '  ' + r.name; sel.appendChild(o); });
    var o = document.createElement('option'); o.value = '__other'; o.textContent = 'Other rep: type initials and rep number'; sel.appendChild(o);
    function sync() {
      var isOther = sel.value === '__other';
      other.hidden = !isOther;
      val.value = isOther ? txt.value.trim() : sel.value;
      var sum = document.getElementById('s-rep'); if (sum) sum.textContent = val.value || 'Direct';
      val.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sel.addEventListener('change', function () { sync(); if (sel.value === '__other') txt.focus(); });
    txt.addEventListener('input', sync);
    var pre = new URLSearchParams(location.search).get('rep');
    if (pre) { var hit = Array.prototype.filter.call(sel.options, function (op) { return op.value.replace(/\s+/g, '').toLowerCase().indexOf(pre.replace(/[\s-]+/g, '').toLowerCase()) === 0 || op.value.replace(/[\s-]+/g, '').toLowerCase().indexOf(pre.replace(/[\s-]+/g, '').toLowerCase()) === 0; })[0];
      if (hit) sel.value = hit.value; else { sel.value = '__other'; txt.value = pre; } }
    var form = box.closest('form'); if (form) form.addEventListener('reset', function () { setTimeout(function () { sel.value = ''; txt.value = ''; sync(); }, 0); });
    sync();
  });
})();
