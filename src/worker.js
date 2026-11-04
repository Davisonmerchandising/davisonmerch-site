// Davison website server code (Cloudflare Worker).
// Serves the site from public/ and handles three form endpoints:
//   POST /api/create-checkout  "Make payment" page -> Stripe embedded checkout (price re-checked here)
//   POST /api/stripe-webhook   Stripe -> "ORDER PAID IN FULL" email to sales@
//   POST /api/quote-request    quote form and Talk to sales form -> email to sales@ with files attached
//
// Cloudflare > Workers & Pages > davisonmerch > Settings > Variables and Secrets:
//   STRIPE_PUBLISHABLE_KEY  pk_test_... (test) or pk_live_... (live)
//   STRIPE_SECRET_KEY       sk_test_... or sk_live_...   (type it in Cloudflare only, as a Secret)
//   STRIPE_WEBHOOK_SECRET   whsec_... from the Stripe webhook endpoint
//   RESEND_API_KEY          re_... from resend.com (davisonmerch.com verified there)
//   NOTIFY_EMAIL            optional, default sales@davisonmerch.com
//   FROM_EMAIL              optional, default "Davison Website <website@davisonmerch.com>"

// Products and prices. Must match window.DSS_CATALOG at the top of public/script.js.
const CATALOG = {"socks": {"label": "Socks", "unit": "pairs", "one": "pair", "min": 60, "max": 4999, "crew": true, "tiers": [[100, 7.95], [250, 7.25], [500, 6.95], [1000, 6.25], [2000, 5.95]], "models": [{"id": "cotton", "name": "Premium Cotton Socks"}, {"id": "performance", "name": "Performance Socks", "extra": 1.5}, {"id": "merino", "name": "Merino Wool Blend Socks", "extra": 2.0}, {"id": "dress", "name": "Dress Socks 200 Needle"}, {"id": "sublimation", "name": "Sublimation Print Socks"}, {"id": "dtg", "name": "DTG Print Socks"}], "small": {"below": 100, "mult": 1.2}}, "beanies": {"label": "Knit beanies", "unit": "units", "one": "unit", "min": 100, "max": 9999, "tiers": [[100, 12.0]], "models": [{"id": "beanie", "name": "Knit Beanie (cuffed)"}, {"id": "skullcap", "name": "Skullcap (cuffless)"}, {"id": "pom", "name": "Pom Beanie"}]}, "apparel": {"label": "T-shirts and apparel", "unit": "pieces", "one": "piece", "min": 144, "max": 9999, "models": [{"id": "ap0", "name": "Gildan G5000 · Short sleeve tee", "group": "Short sleeve tees", "price": 11.25}, {"id": "ap1", "name": "Optima 47265 · Logan Box short sleeve tee", "group": "Short sleeve tees", "price": 11.7}, {"id": "ap2", "name": "Cotton Collective 7.5 oz · Heavyweight box tee", "group": "Short sleeve tees", "price": 15.75}, {"id": "ap3", "name": "Comfort Colors 1717 · Short sleeve tee", "group": "Short sleeve tees", "price": 16.2}, {"id": "ap4", "name": "Optima 47356 · Montage long sleeve tee", "group": "Long sleeve tees", "price": 13.05}, {"id": "ap5", "name": "Gildan G5400 · Long sleeve tee", "group": "Long sleeve tees", "price": 15.75}, {"id": "ap6", "name": "Cotton Collective 7.5 oz · Heavyweight long sleeve box tee", "group": "Long sleeve tees", "price": 18.45}, {"id": "ap7", "name": "Comfort Colors 6014 · Long sleeve tee", "group": "Long sleeve tees", "price": 24.75}, {"id": "ap8", "name": "Independent Trading SS3000 · Lightweight crew", "group": "Crewneck fleece", "price": 21.6}, {"id": "ap9", "name": "Independent Trading IND3000 · Heavyweight crew", "group": "Crewneck fleece", "price": 27.9}, {"id": "ap10", "name": "Cotton Collective 17 oz · Heavyweight box crew", "group": "Crewneck fleece", "price": 40.95}, {"id": "ap11", "name": "Independent Trading SS4500 · 8.5 oz. Midweight Pullover Hood", "group": "Hoodies", "price": 23.4}, {"id": "ap12", "name": "Independent Trading IND4000 · Heavyweight hoodie", "group": "Hoodies", "price": 32.4}, {"id": "ap13", "name": "Cotton Collective 11 oz · Special hoodie", "group": "Hoodies", "price": 45.45}]}};
const MAX_FILE_BYTES = 5 * 1024 * 1024;   // payment page art file
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // all files on one quote / talk request

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const clip = (v, n) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e || '');

function findModel(product, model) {
  const c = CATALOG[product]; if (!c) return null;
  const m = c.models.find((x) => x.id === model); return m ? { c, m } : null;
}
function unitCents(product, model, qty) {
  const hit = findModel(product, model); if (!hit) return null;
  const { c, m } = hit;
  if (m.price != null) return Math.round(m.price * 100);
  let price = c.tiers[0][1];
  for (const [min, p] of c.tiers) if (qty >= min) price = p;
  price += m.extra || 0;
  if (c.small && qty < c.small.below) price *= c.small.mult; // small runs (60-99 pairs): 120% of the 100-pair price
  return Math.round(price * 100);
}
function newRef() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `DSS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function emailBody(title, rows, notes = []) {
  const live = rows.filter(([, v]) => v !== '' && v != null);
  const trs = live.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:600;white-space:pre-line">${esc(v)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111"><h2 style="margin:0 0 12px">${esc(title)}</h2><table style="border-collapse:collapse">${trs}</table>${notes.map((n) => `<p style="margin:14px 0 0">${esc(n)}</p>`).join('')}</div>`;
  const text = [title, '', ...live.map(([k, v]) => `${k}: ${v}`), '', ...notes].join('\n');
  return { html, text };
}
function b64(bytes) {
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
async function sendEmail(env, { subject, html, text, replyTo, attachments = [] }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const body = {
    from: env.FROM_EMAIL || 'Davison Website <website@davisonmerch.com>', to: [env.NOTIFY_EMAIL || 'sales@davisonmerch.com'],
    subject: subject.slice(0, 250), html, text,
    attachments: attachments.filter((a) => a && a.content).map((a) => ({ filename: a.filename || 'attachment', content: b64(a.content) }))
  };
  if (validEmail(replyTo)) body.reply_to = replyTo;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Email failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
}
async function readFiles(list, maxEach, maxTotal) {
  const out = []; let total = 0;
  for (const f of list) {
    if (!f || typeof f === 'string' || !f.size) continue;
    if (f.size > maxEach) throw Object.assign(new Error('A file is over the size limit'), { status: 413 });
    total += f.size; if (total > maxTotal) throw Object.assign(new Error('Files are over the size limit'), { status: 413 });
    out.push({ filename: clip(f.name, 150) || 'artwork', size: f.size, content: new Uint8Array(await f.arrayBuffer()) });
  }
  return out;
}

// ---------- quote form + talk to sales ----------
async function quoteRequest(req, env) {
  if (!env.RESEND_API_KEY) return json(503, { error: 'Email is not set up yet' }); // browser falls back to the customer's email app
  let fd; try { fd = await req.formData(); } catch (e) { return json(400, { error: 'Bad request' }); }
  if (clip(fd.get('website'), 10)) return json(200, { ok: true }); // spam trap
  const f = (k, n = 200) => clip(fd.get(k), n);
  const name = f('name', 100), company = f('company', 120), email = f('email', 200);
  if (!name || !company || !validEmail(email)) return json(400, { error: 'Name, company and a valid email are required' });
  let files; try { files = await readFiles(fd.getAll('artwork'), MAX_TOTAL_BYTES, MAX_TOTAL_BYTES); } catch (e) { return json(e.status || 400, { error: e.message }); }
  const talk = f('form-name', 20) === 'talk';
  const rep = f('rep', 60);
  const addr = (p) => [f(`${p}-address1`, 150), f(`${p}-address2`, 100), [f(`${p}-city`, 80), f(`${p}-state`, 60)].filter(Boolean).join(', ') + (f(`${p}-zip`, 20) ? ` ${f(`${p}-zip`, 20)}` : ''), f(`${p}-country`, 60)].filter(Boolean).join(', ');
  const product = f('product', 30), qty = f('quantity', 10), units = ({ 'Knit beanies': 'units', Apparel: 'pieces' })[product] || 'pairs';
  const rows = talk ? [
    ['Name', name], ['Company or brand', company], ['Email', email], ['Phone', f('phone', 40)], ['Sales rep', rep],
    ['Timing', f('timing', 60)], ['Estimated quantity', qty], ['Question or idea', clip(fd.get('details'), 3000)]
  ] : [
    ['Project name', f('project', 120)], ['Brand or company', company], ['Name', name], ['Email', email], ['Phone', f('phone', 40)], ['Sales rep', rep || 'Direct'],
    ['Product', product || 'Socks'], ['Style', f('style', 60)], ['Height', f('height', 20)], ['Quantity', qty ? `${qty} ${units}` : ''],
    ['Design ideas', clip(fd.get('details'), 3000)],
    ['Billing address', addr('bill')], ['Shipping address', f('ship-same', 5) === 'yes' ? 'Same as billing' : [f('ship-name', 100), addr('ship')].filter(Boolean).join(', ')],
    ['In-hands date', f('inhands', 20)], ['Budget', f('budget', 60)], ['Notes', clip(fd.get('notes'), 3000)]
  ];
  rows.push(['Attached files', files.length ? files.map((x) => `${x.filename} (${Math.round(x.size / 1024)} KB)`).join(', ') : 'None']);
  const title = talk ? 'New message for sales' : 'New quote request';
  const subject = talk ? `TALK TO SALES: ${company}${rep ? ` [rep ${rep}]` : ''}` : `QUOTE REQUEST: ${company}${f('project', 120) ? ` - ${f('project', 120)}` : ''}${qty ? ` - ${qty} ${units}` : ''}${rep ? ` [rep ${rep}]` : ''}`;
  const { html, text } = emailBody(title, rows, ['Reply to this email to answer the customer directly.']);
  try { await sendEmail(env, { subject, html, text, replyTo: email, attachments: files }); }
  catch (e) { console.error(e); return json(502, { error: 'Your request could not be sent' }); }
  return json(200, { ok: true });
}

// ---------- make payment ----------
async function createCheckout(req, env) {
  const key = env.STRIPE_SECRET_KEY, pk = env.STRIPE_PUBLISHABLE_KEY;
  if (!key || !pk) return json(503, { error: 'Payments are not set up yet' });
  let fd; try { fd = await req.formData(); } catch (e) { return json(400, { error: 'Bad request' }); }
  if (clip(fd.get('website'), 10)) return json(400, { error: 'Bad request' });
  const f = (k, n = 200) => clip(fd.get(k), n);
  const product = f('product', 20) || 'socks', style = f('style', 20), qty = Math.round(Number(f('pairs', 10)));
  const hit = findModel(product, style);
  if (!hit) return json(400, { error: 'Choose a product and model' });
  const { c: cat, m: model } = hit;
  if (!(qty >= cat.min && qty <= cat.max)) return json(400, { error: `${cat.label} quantity must be ${cat.min.toLocaleString('en-US')} to ${cat.max.toLocaleString('en-US')} ${cat.unit}` });
  const height = cat.crew ? 'Crew' : '';
  const name = f('name', 100), company = f('company', 120), email = f('email', 200), rep = f('rep', 60), quote = f('quote-number', 60);
  if (!name || !company || !validEmail(email)) return json(400, { error: 'Name, company and a valid email are required' });
  const ship = [f('ship-name', 100), f('ship-company', 120), f('ship-address1', 150), f('ship-address2', 100), `${f('ship-city', 80)}, ${f('ship-state', 60)} ${f('ship-zip', 20)}`, f('ship-country', 60) || 'United States'].filter((x) => x && x.trim() !== ',').join(', ');
  if (!f('ship-name', 100) || !f('ship-address1', 150) || !f('ship-city', 80) || !f('ship-state', 60) || !f('ship-zip', 20)) return json(400, { error: 'Enter the full ship to address' });
  if (f('approved-proof', 5) !== 'yes') return json(400, { error: 'Confirm that you approved your proof' });
  let files; try { files = await readFiles([fd.get('artwork')], MAX_FILE_BYTES, MAX_FILE_BYTES); } catch (e) { return json(e.status || 400, { error: e.message }); }
  if (!files.length) return json(400, { error: 'Upload the art file for this order' });
  const file = files[0];

  const unit = unitCents(product, style, qty), total = unit * qty;
  const ref = /^DSS-\d{6}-[A-Z0-9]{4}$/.test(f('payment-ref', 20)) ? f('payment-ref', 20) : newRef();
  const productName = `Full production: ${model.name}${height ? `, ${height} height` : ''}`;
  const description = `${qty.toLocaleString('en-US')} ${cat.unit} at ${money(unit)} per ${cat.one} = ${money(total)}. Free shipping. Ref ${ref}${quote ? `. Quote ${quote}` : ''}. Art file: ${file.filename}`;
  const meta = { ref, sales_rep: rep, product: cat.label, style: model.name, height, pairs: String(qty), unit: cat.unit, price_per_pair: money(unit), total: money(total), art_file: file.filename, quote, company, name, phone: f('phone', 40), ship_to: ship };

  // The art file goes to sales@ now, so it is on file whether the customer pays by card today or by bank later.
  if (env.RESEND_API_KEY) {
    const { html, text } = emailBody('Payment started (not paid yet)', [
      ['Reference', ref], ['Sales rep', rep || 'Direct'], ['Product', cat.label], ['Model', model.name], ['Height', height],
      ['Quantity', `${qty.toLocaleString('en-US')} ${cat.unit}`], ['Price each', money(unit)], ['Total', money(total)],
      ['Name', name], ['Company', company], ['Email', email], ['Phone', f('phone', 40)], ['Ship to', ship], ['Quote / proof number', quote], ['Art file', file.filename]
    ], ['The customer opened checkout. Wait for the "ORDER PAID IN FULL" email with this reference before starting production.']);
    try { await sendEmail(env, { subject: `PAYMENT STARTED: ${ref} - ${money(total)} - ${company}${rep ? ` - rep ${rep}` : ''}`, html, text, replyTo: email, attachments: [file] }); }
    catch (e) { console.error(e); }
  }

  const p = new URLSearchParams();
  p.append('mode', 'payment'); p.append('ui_mode', 'embedded'); p.append('allow_promotion_codes', 'true'); p.append('submit_type', 'pay');
  p.append('client_reference_id', ref); p.append('customer_email', email);
  p.append('line_items[0][quantity]', String(qty));
  p.append('line_items[0][price_data][currency]', 'usd');
  p.append('line_items[0][price_data][unit_amount]', String(unit));
  p.append('line_items[0][price_data][product_data][name]', productName);
  p.append('line_items[0][price_data][product_data][description]', description.slice(0, 500));
  p.append('custom_text[submit][message]', `This is full payment for production of ${qty.toLocaleString('en-US')} ${cat.unit} of ${model.name}${height ? ` (${height})` : ''}. Free shipping. Production starts once payment clears. Reference ${ref}.`);
  for (const [k, v] of Object.entries(meta)) {
    if (!v) continue;
    p.append(`metadata[${k}]`, clip(v, 450)); p.append(`payment_intent_data[metadata][${k}]`, clip(v, 450));
  }
  p.append('payment_intent_data[description]', `${productName} - ${qty} ${cat.unit} - ${ref}`.slice(0, 500));
  p.append('return_url', `${new URL(req.url).origin}/pay.html?paid=1&ref=${encodeURIComponent(ref)}&session_id={CHECKOUT_SESSION_ID}`);
  let r, out;
  try {
    r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
    out = await r.json();
  } catch (e) { console.error(e); return json(502, { error: 'Checkout could not open' }); }
  if (!r.ok) { console.error(JSON.stringify(out)); return json(502, { error: 'Checkout could not open' }); }
  return json(200, { clientSecret: out.client_secret, publishableKey: pk, ref });
}

// ---------- stripe webhook ----------
async function verifyStripe(raw, header, secret) {
  if (!header || !secret) return false;
  const items = header.split(',').map((kv) => kv.split('='));
  const t = (items.find(([k]) => k === 't') || [])[1];
  const sigs = items.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => { if (s.length !== hex.length) return false; let d = 0; for (let i = 0; i < s.length; i++) d |= s.charCodeAt(i) ^ hex.charCodeAt(i); return d === 0; });
}
async function stripeWebhook(req, env) {
  const raw = await req.text();
  if (!(await verifyStripe(raw, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) return json(400, { error: 'Bad signature' });
  const event = JSON.parse(raw);
  const s = event.data && event.data.object;
  if (!s || s.object !== 'checkout.session') return json(200, { ignored: true });
  let status;
  if (event.type === 'checkout.session.completed') status = s.payment_status === 'paid' ? 'paid' : 'pending';
  else if (event.type === 'checkout.session.async_payment_succeeded') status = 'paid';
  else if (event.type === 'checkout.session.async_payment_failed') status = 'failed';
  else return json(200, { ignored: true });

  const m = s.metadata || {}, ref = s.client_reference_id || m.ref || '';
  const paidCents = s.amount_total, discountCents = (s.total_details && s.total_details.amount_discount) || 0;
  let promo = '';
  if (discountCents > 0) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${s.id}?expand[]=discounts.promotion_code&expand[]=discounts.coupon`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
      const full = await r.json();
      promo = (full.discounts || []).map((d) => (d.promotion_code && d.promotion_code.code) || (d.coupon && (d.coupon.name || d.coupon.id)) || '').filter(Boolean).join(', ');
    } catch (e) { console.error(e); }
  }
  const who = m.company || (s.customer_details && s.customer_details.name) || 'Customer';
  const email = (s.customer_details && s.customer_details.email) || '';
  const qty = Number(m.pairs) || 0;
  const subjects = {
    paid: `ORDER PAID IN FULL: ${ref} - ${money(paidCents)} - ${who}${promo ? ` - code ${promo}` : ''}${m.sales_rep ? ` - rep ${m.sales_rep}` : ''}`,
    pending: `BANK PAYMENT PENDING: ${ref} - ${money(paidCents)} - ${who}`,
    failed: `BANK PAYMENT FAILED: ${ref} - ${money(paidCents)} - ${who}`
  };
  const titles = { paid: 'Order paid in full', pending: 'Bank payment started (not cleared yet)', failed: 'Bank payment failed' };
  const notes = {
    paid: ['Payment is complete. This order is ready for production. The art file is in the "PAYMENT STARTED" email with the same reference.'],
    pending: ['The customer paid by bank transfer. Wait for the "ORDER PAID IN FULL" email before starting production.'],
    failed: ['The bank payment did not go through. Do not start production. Contact the customer.']
  };
  const { html, text } = emailBody(titles[status], [
    ['Reference', ref], ['Amount', money(paidCents)],
    ['List total', discountCents ? money(paidCents + discountCents) : ''],
    ['Discount', discountCents ? `-${money(discountCents)}${promo ? ` (code ${promo})` : ''}` : ''],
    ['Sales rep', m.sales_rep || 'Direct'], ['Product', m.product], ['Model', m.style], ['Height', m.height],
    ['Quantity', qty ? `${qty.toLocaleString('en-US')} ${m.unit || 'pairs'}` : ''], ['List price each', m.price_per_pair],
    ['Price each paid', discountCents && qty ? money(Math.round(paidCents / qty)) : ''],
    ['Name', m.name || (s.customer_details && s.customer_details.name)], ['Company', m.company], ['Email', email], ['Phone', m.phone],
    ['Ship to', m.ship_to], ['Quote / proof number', m.quote], ['Art file', m.art_file], ['Stripe payment', s.payment_intent || s.id]
  ], notes[status]);
  try { await sendEmail(env, { subject: subjects[status], html, text, replyTo: email }); }
  catch (e) { console.error(e); return json(500, { error: 'Email failed' }); } // Stripe retries
  return json(200, { ok: true });
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/api/')) {
      if (req.method !== 'POST') return json(405, { error: 'POST only' });
      try {
        if (path === '/api/quote-request') return await quoteRequest(req, env);
        if (path === '/api/create-checkout') return await createCheckout(req, env);
        if (path === '/api/stripe-webhook') return await stripeWebhook(req, env);
      } catch (e) { console.error(e); return json(500, { error: 'Something went wrong' }); }
      return json(404, { error: 'Not found' });
    }
    return env.ASSETS.fetch(req);
  }
};
