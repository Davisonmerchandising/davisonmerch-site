// Shared helpers for the Davison site functions.
//
// Netlify environment variables (Site configuration > Environment variables):
//   RESEND_API_KEY         email sending (resend.com), required for all notification emails
//   STRIPE_SECRET_KEY      Stripe secret key (sk_test_... or sk_live_...)
//   STRIPE_PUBLISHABLE_KEY Stripe publishable key (pk_test_... or pk_live_...), shown to the browser for the payment form
//   STRIPE_WEBHOOK_SECRET  signing secret of the Stripe webhook (whsec_...)
//   NOTIFY_EMAIL           optional, defaults to sales@davisonmerch.com
//   FROM_EMAIL             optional, defaults to "Davison Website <website@davisonmerch.com>"
//                          (the domain must be verified in Resend)

// Products and prices. Must match window.DSS_CATALOG at the top of script.js.
export const CATALOG = {"socks": {"label": "Socks", "unit": "pairs", "one": "pair", "min": 100, "max": 4999, "crew": true, "tiers": [[100, 7.95], [250, 7.25], [500, 6.95], [1000, 6.25], [2000, 5.95]], "models": [{"id": "cotton", "name": "Premium Cotton Socks"}, {"id": "performance", "name": "Performance Socks", "extra": 1.5}, {"id": "merino", "name": "Merino Wool Blend Socks", "extra": 2.0}, {"id": "dress", "name": "Dress Socks 200 Needle"}, {"id": "sublimation", "name": "Sublimation Print Socks"}, {"id": "dtg", "name": "DTG Print Socks"}]}, "beanies": {"label": "Knit beanies", "unit": "units", "one": "unit", "min": 100, "max": 9999, "tiers": [[100, 12.0]], "models": [{"id": "beanie", "name": "Knit Beanie (cuffed)"}, {"id": "skullcap", "name": "Skullcap (cuffless)"}, {"id": "pom", "name": "Pom Beanie"}]}, "apparel": {"label": "T-shirts and apparel", "unit": "pieces", "one": "piece", "min": 144, "max": 9999, "models": [{"id": "ap0", "name": "Gildan G5000 · Short sleeve tee", "group": "Short sleeve tees", "price": 11.25}, {"id": "ap1", "name": "Optima 47265 · Logan Box short sleeve tee", "group": "Short sleeve tees", "price": 11.7}, {"id": "ap2", "name": "Cotton Collective 7.5 oz · Heavyweight box tee", "group": "Short sleeve tees", "price": 15.75}, {"id": "ap3", "name": "Comfort Colors 1717 · Short sleeve tee", "group": "Short sleeve tees", "price": 16.2}, {"id": "ap4", "name": "Optima 47356 · Montage long sleeve tee", "group": "Long sleeve tees", "price": 13.05}, {"id": "ap5", "name": "Gildan G5400 · Long sleeve tee", "group": "Long sleeve tees", "price": 15.75}, {"id": "ap6", "name": "Cotton Collective 7.5 oz · Heavyweight long sleeve box tee", "group": "Long sleeve tees", "price": 18.45}, {"id": "ap7", "name": "Comfort Colors 6014 · Long sleeve tee", "group": "Long sleeve tees", "price": 24.75}, {"id": "ap8", "name": "Independent Trading SS3000 · Lightweight crew", "group": "Crewneck fleece", "price": 21.6}, {"id": "ap9", "name": "Independent Trading IND3000 · Heavyweight crew", "group": "Crewneck fleece", "price": 27.9}, {"id": "ap10", "name": "Cotton Collective 17 oz · Heavyweight box crew", "group": "Crewneck fleece", "price": 40.95}, {"id": "ap11", "name": "Independent Trading SS4500 · 8.5 oz. Midweight Pullover Hood", "group": "Hoodies", "price": 23.4}, {"id": "ap12", "name": "Independent Trading IND4000 · Heavyweight hoodie", "group": "Hoodies", "price": 32.4}, {"id": "ap13", "name": "Cotton Collective 11 oz · Special hoodie", "group": "Hoodies", "price": 45.45}]}};
// Older sock-only exports, kept for the other functions.
export const PRICES = CATALOG.socks.tiers;
export const EXTRA = Object.fromEntries(CATALOG.socks.models.filter((m) => m.extra).map((m) => [m.id, m.extra]));
export const MIN_PAIRS = CATALOG.socks.min;
export const MAX_ONLINE_PAIRS = CATALOG.socks.max;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const NAMES = Object.fromEntries(CATALOG.socks.models.map((m) => [m.id, m.name]));

export const NOTIFY_EMAIL = () => process.env.NOTIFY_EMAIL || 'sales@davisonmerch.com';
export const FROM_EMAIL = () => process.env.FROM_EMAIL || 'Davison Website <website@davisonmerch.com>';

export const json = (status, body) => Response.json(body, { status });
export const clip = (v, n) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e || '');

export function findModel(product, model) {
  const c = CATALOG[product]; if (!c) return null;
  const m = c.models.find((x) => x.id === model); return m ? { c, m } : null;
}
export function unitCents(product, model, qty) {
  if (qty === undefined) { qty = model; model = product; product = 'socks'; } // old (style, pairs) call
  const hit = findModel(product, model); if (!hit) return null;
  const { c, m } = hit;
  if (m.price != null) return Math.round(m.price * 100);
  let price = c.tiers[0][1];
  for (const [min, p] of c.tiers) if (qty >= min) price = p;
  return Math.round((price + (m.extra || 0)) * 100);
}

export function newRef() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `DSS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// Build an email body: a heading, a table of label/value rows, and optional notes.
export function emailBody(title, rows, notes = []) {
  const trs = rows.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">
<h2 style="margin:0 0 12px">${esc(title)}</h2><table style="border-collapse:collapse">${trs}</table>
${notes.map((n) => `<p style="margin:14px 0 0">${esc(n)}</p>`).join('')}</div>`;
  const text = [title, '', ...rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`), '', ...notes].join('\n');
  return { html, text };
}

// Send an email through Resend. attachments: [{ filename, content: Uint8Array|ArrayBuffer }]
export async function sendEmail({ subject, html, text, replyTo, attachments = [] }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const body = {
    from: FROM_EMAIL(), to: [NOTIFY_EMAIL()], subject: subject.slice(0, 250), html, text,
    attachments: attachments.filter((a) => a && a.content).map((a) => ({
      filename: a.filename || 'attachment', content: Buffer.from(a.content).toString('base64')
    }))
  };
  if (validEmail(replyTo)) body.reply_to = replyTo;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Email failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// Read an uploaded File from FormData. Returns null if none, throws if too large.
export async function readUpload(file) {
  if (!file || typeof file === 'string' || !file.size) return null;
  if (file.size > MAX_FILE_BYTES) throw Object.assign(new Error('File is over 5 MB'), { status: 413 });
  return { filename: clip(file.name, 150) || 'artwork', type: file.type || 'application/octet-stream', size: file.size, content: new Uint8Array(await file.arrayBuffer()) };
}
