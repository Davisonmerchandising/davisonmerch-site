// Stripe webhook -> "ORDER PAID IN FULL" email to sales@davisonmerch.com with the customer's art file attached.
// In Stripe: Developers > Webhooks > Add endpoint
//   URL:    https://YOUR-DOMAIN/.netlify/functions/stripe-webhook
//   Events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed
// Then put the endpoint's signing secret (whsec_...) in the STRIPE_WEBHOOK_SECRET environment variable.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { json, money, emailBody, sendEmail } from '../lib/shared.mjs';

function verify(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  const t = parts.t;
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex'));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected); });
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const raw = await req.text();
  if (!verify(raw, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) return json(400, { error: 'Bad signature' });

  const event = JSON.parse(raw);
  const s = event.data && event.data.object;
  if (!s || s.object !== 'checkout.session') return json(200, { ignored: true });

  let status;
  if (event.type === 'checkout.session.completed') status = s.payment_status === 'paid' ? 'paid' : 'pending';
  else if (event.type === 'checkout.session.async_payment_succeeded') status = 'paid';
  else if (event.type === 'checkout.session.async_payment_failed') status = 'failed';
  else return json(200, { ignored: true });

  const ref = s.client_reference_id || (s.metadata && s.metadata.ref);
  const store = getStore({ name: 'orders', consistency: 'strong' });
  const order = ref ? await store.get(`${ref}/order`, { type: 'json' }) : null;
  if (order && order.emailed && order.emailed[status]) return json(200, { duplicate: true }); // Stripe retries

  const m = s.metadata || {};
  const o = order || { ref, styleName: m.style, height: m.height, pairs: Number(m.pairs), company: m.company, quote: m.quote, rep: m.sales_rep, file: { filename: m.art_file } };
  const paidCents = s.amount_total;
  const discountCents = (s.total_details && s.total_details.amount_discount) || 0;
  let promo = '';
  if (discountCents > 0) { // look up which discount code was used
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${s.id}?expand[]=discounts.promotion_code&expand[]=discounts.coupon`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
      const full = await r.json();
      promo = (full.discounts || []).map((d) => (d.promotion_code && d.promotion_code.code) || (d.coupon && (d.coupon.name || d.coupon.id)) || '').filter(Boolean).join(', ');
    } catch (e) { console.error(e); }
  }
  const who = o.company || (s.customer_details && s.customer_details.name) || 'Customer';
  const email = (s.customer_details && s.customer_details.email) || o.email || '';

  const subjects = {
    paid: `ORDER PAID IN FULL: ${ref} - ${money(paidCents)} - ${who}${promo ? ` - code ${promo}` : ''}${(o.rep || m.sales_rep) ? ` - rep ${o.rep || m.sales_rep}` : ''}`,
    pending: `BANK PAYMENT PENDING: ${ref} - ${money(paidCents)} - ${who}`,
    failed: `BANK PAYMENT FAILED: ${ref} - ${money(paidCents)} - ${who}`
  };
  const titles = { paid: 'Order paid in full', pending: 'Bank payment started (not cleared yet)', failed: 'Bank payment failed' };
  const notes = {
    paid: ['Payment is complete. This order is ready for production.'],
    pending: ['The customer paid by bank transfer. Wait for the "ORDER PAID IN FULL" email before starting production.'],
    failed: ['The bank payment did not go through. Do not start production. Contact the customer.']
  };

  const { html, text } = emailBody(titles[status], [
    ['Reference', ref], ['Amount', money(paidCents)],
    ['List total', discountCents ? money(paidCents + discountCents) : ''],
    ['Discount', discountCents ? `-${money(discountCents)}${promo ? ` (code ${promo})` : ''}` : ''],
    ['Model', o.styleName], ['Height', o.height],
    ['Product', o.product || m.product || 'Socks'], ['Quantity', o.pairs ? `${o.pairs.toLocaleString('en-US')} ${o.unitName || m.unit || 'pairs'}` : ''], ['List price each', o.unitCents ? money(o.unitCents) : m.price_per_pair],
    ['Price each paid', discountCents && o.pairs ? money(Math.round(paidCents / o.pairs)) : ''],
    ['Name', o.name || (s.customer_details && s.customer_details.name)], ['Company', o.company], ['Email', email], ['Phone', o.phone],
    ['Ship to', o.shipTo ? [o.shipTo.name, o.shipTo.company, o.shipTo.address1, o.shipTo.address2, `${o.shipTo.city}, ${o.shipTo.state} ${o.shipTo.zip}`, o.shipTo.country].filter(Boolean).join(', ') : (m.ship_to || '')],
    ['Quote / proof number', o.quote], ['Sales rep', o.rep || m.sales_rep || 'Direct'], ['Art file', o.file && o.file.filename ? o.file.filename : 'Not found'],
    ['Stripe payment', s.payment_intent || s.id]
  ], notes[status]);

  let attachments = [];
  if (order && status !== 'failed') {
    const bytes = await store.get(`${ref}/file`, { type: 'arrayBuffer' });
    if (bytes) attachments = [{ filename: order.file.filename, content: new Uint8Array(bytes) }];
  }

  try {
    await sendEmail({ subject: subjects[status], html, text, replyTo: email, attachments });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'Email failed' }); // Stripe will retry
  }
  if (order) { order.emailed = { ...(order.emailed || {}), [status]: new Date().toISOString() }; await store.setJSON(`${ref}/order`, order); }
  return json(200, { ok: true });
};
