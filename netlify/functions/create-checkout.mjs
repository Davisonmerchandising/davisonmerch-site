// "Make payment" form -> saves the order and art file, then starts Stripe's embedded checkout (shown inside pay.html)
// for the full production amount.
// The paid-in-full email is sent by stripe-webhook.mjs once Stripe confirms the payment.
import { getStore } from '@netlify/blobs';
import { json, clip, validEmail, money, unitCents, newRef, readUpload, findModel } from '../lib/shared.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const key = process.env.STRIPE_SECRET_KEY, pk = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key || !pk) return json(500, { error: 'Payments are not set up yet' });

  let fd;
  try { fd = await req.formData(); } catch (e) { return json(400, { error: 'Bad request' }); }
  if (clip(fd.get('website'), 10)) return json(400, { error: 'Bad request' });
  const f = (k, n = 200) => clip(fd.get(k), n);

  const product = f('product', 20) || 'socks';
  const style = f('style', 20);
  const pairs = Math.round(Number(f('pairs', 10)));
  const hit = findModel(product, style);
  if (!hit) return json(400, { error: 'Choose a product and model' });
  const { c: cat, m: model } = hit;
  if (!(pairs >= cat.min && pairs <= cat.max)) return json(400, { error: `${cat.label} quantity must be ${cat.min.toLocaleString('en-US')} to ${cat.max.toLocaleString('en-US')} ${cat.unit}` });
  const height = cat.crew ? 'Crew' : ''; // every sock style is crew height
  const modelName = model.name;
  const name = f('name', 100), company = f('company', 120), email = f('email', 200);
  if (!name || !company || !validEmail(email)) return json(400, { error: 'Name, company and a valid email are required' });
  const shipTo = { name: f('ship-name', 100), company: f('ship-company', 120), address1: f('ship-address1', 150), address2: f('ship-address2', 100),
    city: f('ship-city', 80), state: f('ship-state', 60), zip: f('ship-zip', 20), country: f('ship-country', 60) || 'United States' };
  if (!shipTo.name || !shipTo.address1 || !shipTo.city || !shipTo.state || !shipTo.zip) return json(400, { error: 'Enter the full ship to address' });
  if (f('approved-proof', 5) !== 'yes') return json(400, { error: 'Confirm that you approved your proof' });

  let file;
  try { file = await readUpload(fd.get('artwork')); } catch (e) { return json(e.status || 400, { error: e.message }); }
  if (!file) return json(400, { error: 'Upload the art file for this order' });

  const unit = unitCents(product, style, pairs), total = unit * pairs;
  const ref = /^DSS-\d{6}-[A-Z0-9]{4}$/.test(f('payment-ref', 20)) ? f('payment-ref', 20) : newRef();
  const order = {
    ref, product, style, styleName: modelName, height, pairs, unitName: cat.unit, unitCents: unit, totalCents: total,
    name, company, email, phone: f('phone', 40), quote: f('quote-number', 60), rep: f('rep', 60),
    shipTo, file: { filename: file.filename, type: file.type, size: file.size }, created: new Date().toISOString(), emailed: {}
  };

  // Save order + file so the payment-confirmed email can attach it.
  const store = getStore({ name: 'orders', consistency: 'strong' });
  await store.setJSON(`${ref}/order`, order);
  await store.set(`${ref}/file`, file.content.buffer.slice(file.content.byteOffset, file.content.byteOffset + file.content.byteLength));

  const origin = new URL(req.url).origin;
  const productName = `Full production: ${modelName}${height ? `, ${height} height` : ''}`;
  const description = `${pairs.toLocaleString('en-US')} ${cat.unit} at ${money(unit)} per ${cat.one} = ${money(total)}. Free shipping. Ref ${ref}` + (order.quote ? `. Quote ${order.quote}` : '') + `. Art file: ${file.filename}`;

  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('ui_mode', 'embedded');
  p.append('allow_promotion_codes', 'true'); // discount codes created in the Stripe dashboard (Products > Coupons)
  p.append('submit_type', 'pay');
  p.append('client_reference_id', ref);
  p.append('customer_email', email);
  p.append('line_items[0][quantity]', String(pairs));
  p.append('line_items[0][price_data][currency]', 'usd');
  p.append('line_items[0][price_data][unit_amount]', String(unit));
  p.append('line_items[0][price_data][product_data][name]', productName);
  p.append('line_items[0][price_data][product_data][description]', description.slice(0, 500));
  p.append('custom_text[submit][message]', `This is full payment for production of ${pairs.toLocaleString('en-US')} ${cat.unit} of ${modelName}${height ? ` (${height})` : ''}. Free shipping. Production starts once payment clears. Reference ${ref}.`);
  const meta = { ref, sales_rep: order.rep, product: cat.label, style: modelName, height, pairs: String(pairs), unit: cat.unit, price_per_pair: money(unit), total: money(total), art_file: file.filename, quote: order.quote, company,
    ship_to: [shipTo.name, shipTo.company, shipTo.address1, shipTo.address2, `${shipTo.city}, ${shipTo.state} ${shipTo.zip}`, shipTo.country].filter(Boolean).join(', ') };
  for (const [k, v] of Object.entries(meta)) {
    if (!v) continue;
    p.append(`metadata[${k}]`, clip(v, 450));
    p.append(`payment_intent_data[metadata][${k}]`, clip(v, 450));
  }
  p.append('payment_intent_data[description]', `${productName} - ${pairs} ${cat.unit} - ${ref}`.slice(0, 500));
  p.append('return_url', `${origin}/pay.html?paid=1&ref=${encodeURIComponent(ref)}&session_id={CHECKOUT_SESSION_ID}`);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString()
  });
  const out = await r.json();
  if (!r.ok) { console.error(out); return json(502, { error: 'Checkout could not open' }); }
  return json(200, { clientSecret: out.client_secret, publishableKey: pk, ref });
};
