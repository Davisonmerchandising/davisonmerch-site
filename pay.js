/* Make payment page. Prices come from script.js (window.DSS_PRICING).
   The server function (netlify/functions/create-checkout.mjs) recalculates the price itself,
   so the amount charged never depends on what the browser sends. */
(function () {
  'use strict';
  var form = document.getElementById('pay-form'); if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var C = window.DSS_CATALOG;
  var product = $('p-product'), style = $('p-style'), pairs = $('p-pairs'), art = $('p-art'), agree = $('p-agree'), btn = $('p-btn'), msg = $('p-msg');

  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function cat() { return C[product.value] || C.socks; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  Object.keys(C).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = C[k].label; product.appendChild(o); });
  function fillModels() {
    var c = cat(), keep = style.value, html = '<option value="">Select\u2026</option>', grp = null;
    c.models.forEach(function (m) {
      if (m.group && m.group !== grp) { html += (grp ? '</optgroup>' : '') + '<optgroup label="' + m.group + '">'; grp = m.group; }
      html += '<option value="' + m.id + '">' + m.name + (m.price != null ? ' \u2013 ' + money(m.price) : '') + '</option>';
    });
    style.innerHTML = html + (grp ? '</optgroup>' : '');
    if (c.models.some(function (m) { return m.id === keep; })) style.value = keep;
    var nm = { socks: 'Sock model', beanies: 'Beanie style', apparel: 'Apparel blank' }[product.value] || 'Model';
    $('p-style-lbl').textContent = nm; $('s-model-lbl').textContent = nm;
    $('p-qty-lbl').textContent = 'Number of ' + c.unit;
    $('p-qty-hint').textContent = c.min.toLocaleString('en-US') + ' to ' + c.max.toLocaleString('en-US') + ' ' + c.unit + (product.value === 'apparel' ? '. Add $1 per piece for 2XL and up.' : '');
    pairs.min = c.min; pairs.max = c.max; if (qty() < c.min) pairs.value = c.min;
    $('s-height-row').style.display = c.crew ? '' : 'none'; $('p-height-in').value = c.crew ? 'Crew' : '';
    $('s-qty-lbl').textContent = cap(c.unit); $('s-unit-lbl').textContent = 'Price per ' + c.one;
  }
  function qty() { return Math.round(Number(pairs.value)) || 0; }
  function say(t, c) { msg.textContent = t; msg.className = 'pay-msg ' + (c || ''); }
  function newRef() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return 'DSS-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }


  function state() {
    var c = cat(), q = qty(), t = style.value, inRange = q >= c.min && q <= c.max;
    var m = c.models.filter(function (x) { return x.id === t; })[0];
    var u = m && inRange ? window.DSS_UNIT_PRICE(product.value, t, q) : null;
    return { product: product.value, cat: c, type: t, name: m ? m.name : '', q: q, ok: !!(m && inRange), u: u, total: u === null ? null : Math.round(u * q * 100) / 100 };
  }

  function draw() {
    var s = state(), f = art.files[0];
    $('s-product').textContent = s.cat.label;
    $('s-model').textContent = s.name || 'Select a model';
    $('s-pairs').textContent = s.q ? s.q.toLocaleString('en-US') : '–';
    $('s-unit').textContent = s.u === null ? '–' : money(s.u);
    $('s-total').textContent = s.total === null ? '–' : money(s.total);
    $('s-art').textContent = f ? f.name : 'None yet';
    $('p-art-name').textContent = f ? f.name : '';
    btn.textContent = s.total === null ? 'Pay with card' : 'Pay ' + money(s.total) + ' with card';
    btn.disabled = !(s.ok && agree.checked);
    if (s.q > s.cat.max) say('More than ' + s.cat.max.toLocaleString('en-US') + ' ' + s.cat.unit + ' is custom priced. Your sales rep will send an invoice.', 'err');
    else if (s.q && s.q < s.cat.min) say('The minimum is ' + s.cat.min.toLocaleString('en-US') + ' ' + s.cat.unit + ' per style.', 'err');
    else if (msg.className.indexOf('err') !== -1 && !msg.dataset.keep) say('');
  }

  product.addEventListener('change', function () { fillModels(); draw(); });
  style.addEventListener('change', draw);
  [pairs, agree].forEach(function (el) { el.addEventListener('input', draw); el.addEventListener('change', draw); });

  var drop = $('p-drop');
  art.addEventListener('change', function () {
    var f = art.files[0];
    if (f && f.size > 5 * 1024 * 1024) { art.value = ''; msg.dataset.keep = '1'; say('That file is over 5 MB. Send a smaller version, or email it to sales@davisonmerch.com.', 'err'); delete msg.dataset.keep; }
    draw();
  });
  ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (ev) { if (ev.dataTransfer && ev.dataTransfer.files.length) { try { art.files = ev.dataTransfer.files; } catch (e) {} art.dispatchEvent(new Event('change')); } });

  /* back from Square */
  var qs = new URLSearchParams(location.search);
  if (qs.get('paid')) { var ok = $('pay-flash-ok'); ok.textContent = 'Thank you, your payment is in' + (qs.get('ref') ? ' (reference ' + qs.get('ref') + ')' : '') + '. Your receipt is on its way by email and we will confirm your production start date. Bank payments take a few business days to clear.'; ok.hidden = false; }
  if (qs.get('canceled')) $('pay-flash-warn').hidden = false;

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var bad = null;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var ok = el.type === 'checkbox' ? el.checked : el.type === 'file' ? el.files.length > 0 : el.value.trim() !== '' && (el.type !== 'email' || /^\S+@\S+\.\S+$/.test(el.value));
      var mark = el.type === 'file' ? drop : el;
      mark.classList.toggle('bad', !ok); if (!ok && !bad) bad = el;
    });
    var s = state();
    if (bad) { say(bad.type === 'file' ? 'Upload the art file for this order.' : 'Fill in the highlighted fields.', 'err'); (bad.type === 'file' ? drop : bad).scrollIntoView({ block: 'center' }); return; }
    if (!s.ok) { say('Check the product, model and quantity.', 'err'); return; }

    var ref = newRef();
    $('p-ref').value = ref; $('p-unit-in').value = money(s.u); $('p-total-in').value = money(s.total);
    btn.disabled = true; say('Saving your order and opening secure checkout…');
    var fd = new FormData(form);
    fd.set('product', s.product); fd.set('style', s.type); fd.set('pairs', String(s.q)); fd.set('height', s.cat.crew ? 'Crew' : '');
    fetch('/.netlify/functions/create-checkout', { method: 'POST', body: fd })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.clientSecret) throw new Error(j.error || 'checkout ' + r.status); return j; }); })
      .then(function (j) { return openCheckout(j, s); })
      .catch(function (err) { btn.disabled = false; msg.dataset.keep = '1'; say((err && err.message && err.message.indexOf('checkout') !== 0 && err.message !== 'Failed to fetch' ? err.message + '. ' : '') + 'Payment could not start. Please try again, or email sales@davisonmerch.com and we will send you a payment link.', 'err'); delete msg.dataset.keep; });
  });

  /* Stripe's payment form, shown right on this page */
  var co = $('pay-co'), coMount = $('pay-co-mount'), embedded = null;
  function loadStripe() {
    return new Promise(function (ok, fail) {
      if (window.Stripe) return ok();
      var sc = document.createElement('script'); sc.src = 'https://js.stripe.com/v3/'; sc.onload = ok; sc.onerror = function () { fail(new Error('checkout script')); };
      document.head.appendChild(sc);
    });
  }
  function openCheckout(j, s) {
    return loadStripe().then(function () {
      $('pay-co-sum').textContent = s.name + (s.cat.crew ? ', Crew height' : '') + ' • ' + s.q.toLocaleString('en-US') + ' ' + s.cat.unit + ' at ' + money(s.u) + ' = ' + money(s.total) + ' • Free shipping • Ref ' + j.ref;
      form.hidden = true; co.hidden = false; say('');
      window.scrollTo(0, co.getBoundingClientRect().top + window.scrollY - 140);
      return window.Stripe(j.publishableKey).initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(j.clientSecret); } });
    }).then(function (c) { embedded = c; coMount.innerHTML = ''; c.mount('#pay-co-mount'); });
  }
  $('pay-co-back').addEventListener('click', function () {
    if (embedded) { embedded.destroy(); embedded = null; }
    coMount.innerHTML = '<p class="pay-co-load">Loading secure payment…</p>';
    co.hidden = true; form.hidden = false; btn.disabled = false; draw();
  });

  var pre = new URLSearchParams(location.search).get('product'); if (pre && C[pre]) product.value = pre;
  fillModels(); draw();
})();
