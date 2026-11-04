/* Custom socks landing page: quote form, style picker, sticky button */
(function () {
  'use strict';
  var form = document.getElementById('lp-form'); if (!form) return;
  var msg = document.getElementById('lp-msg'), btn = document.getElementById('lp-send'), styleSel = document.getElementById('lp-style');
  function say(t, kind) { msg.textContent = t; msg.className = 'lp-msg lp-wide' + (kind ? ' is-' + kind : ''); }

  // clicking a style card picks it in the form
  Array.prototype.forEach.call(document.querySelectorAll('.sty-card[data-style]'), function (a) {
    a.addEventListener('click', function () { styleSel.value = a.getAttribute('data-style'); });
  });

  // sticky "Get a free quote" on phones, hidden while the form is on screen
  var sticky = document.getElementById('lp-sticky'), quote = document.getElementById('quote');
  if (sticky && quote && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { sticky.classList.toggle('is-hidden', e[0].isIntersecting); }, { rootMargin: '0px 0px -30% 0px' }).observe(quote);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var bad = null;
    ['name', 'company', 'email'].forEach(function (k) {
      var el = form.elements[k], ok = k === 'email' ? /^\S+@\S+\.\S+$/.test(el.value.trim()) : el.value.trim() !== '';
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = el;
    });
    if (bad) { say('Please add your name, company and a valid email.', 'err'); bad.focus(); return; }
    var files = Array.prototype.slice.call(form.artwork.files || []), total = files.reduce(function (n, f) { return n + f.size; }, 0);
    if (total > 10 * 1024 * 1024) { say('Your files are over 10 MB. Send a smaller version, or email them to sales@davisonmerch.com.', 'err'); return; }
    document.getElementById('lp-source').value = window.davlinSource ? window.davlinSource() : '';
    btn.disabled = true; say('Sending your request…');

    function thanks() {
      var ref = 'Q' + Date.now().toString(36).toUpperCase();
      try { sessionStorage.setItem('davlin_lead', ref); } catch (e) {}
      location.href = 'thank-you.html';
    }
    function emailFallback() {
      var g = function (k) { return (form.elements[k] && form.elements[k].value || '').trim(); };
      var body = ['Name: ' + g('name'), 'Company: ' + g('company'), 'Email: ' + g('email'), 'Phone: ' + g('phone'), 'Sock style: ' + (g('style') || 'Not sure'), 'Pairs: ' + (g('quantity') || 'Not sure'), '', g('details')].join('\n');
      location.href = 'mailto:sales@davisonmerch.com?subject=' + encodeURIComponent('QUOTE REQUEST: ' + g('company') + ' - custom socks') + '&body=' + encodeURIComponent(body);
      say('Your email app is opening with your request filled in.' + (files.length ? ' Attach your logo and press send.' : ' Press send to finish.'), 'ok');
      btn.disabled = false;
    }
    fetch('/api/quote-request', { method: 'POST', body: new FormData(form) })
      .then(function (r) {
        if (r.ok) return thanks();
        if (r.status === 400) return r.json().then(function (j) { say(j.error || 'Please check the form.', 'err'); btn.disabled = false; });
        emailFallback();
      })
      .catch(emailFallback);
  });
})();
