// "Get your quote" form -> email to sales@davisonmerch.com with the customer's file attached.
import { json, clip, validEmail, emailBody, sendEmail, readUpload } from '../lib/shared.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  let fd;
  try { fd = await req.formData(); } catch (e) { return json(400, { error: 'Bad request' }); }
  if (clip(fd.get('website'), 10)) return json(200, { ok: true }); // spam trap

  const f = (k, n = 200) => clip(fd.get(k), n);
  const name = f('name', 100), company = f('company', 120), email = f('email', 200);
  if (!name || !company || !validEmail(email)) return json(400, { error: 'Name, company and a valid email are required' });

  let file;
  try { file = await readUpload(fd.get('artwork')); } catch (e) { return json(e.status || 400, { error: e.message }); }

  const style = f('style', 60) || 'Not selected', qty = f('quantity', 10), height = f('height', 20), project = f('project', 120);
  const addr = (p) => [f(`${p}-address1`, 150), f(`${p}-address2`, 100), [f(`${p}-city`, 80), f(`${p}-state`, 60)].filter(Boolean).join(', ') + (f(`${p}-zip`, 20) ? ` ${f(`${p}-zip`, 20)}` : ''), f(`${p}-country`, 60)].filter(Boolean).join(', ');
  const shipping = f('ship-same', 5) === 'yes' ? 'Same as billing' : [f('ship-name', 100), addr('ship')].filter(Boolean).join(', ');
  const { html, text } = emailBody('New quote request', [
    ['Project name', project], ['Brand or company', company], ['Name', name], ['Email', email], ['Phone', f('phone', 40)], ['Sales rep', f('rep', 120)],
    ['Product', f('product', 30) || 'Socks'], ['Style', style], ['Height', height], ['Quantity', qty ? `${qty} ${({ 'Knit beanies': 'units', Apparel: 'pieces' })[f('product', 30)] || 'pairs'}` : ''],
    ['Design ideas', clip(fd.get('details'), 3000)], ['Attached file', file ? `${file.filename} (${Math.round(file.size / 1024)} KB)` : 'None'],
    ['Billing address', addr('bill')], ['Shipping address', shipping],
    ['In-hands date', f('inhands', 20)], ['Budget', f('budget', 60)], ['Notes', clip(fd.get('notes'), 3000)]
  ], ['Reply to this email to answer the customer directly.']);

  try {
    await sendEmail({
      subject: `QUOTE REQUEST RECEIVED: ${company}${f('rep', 60) ? ` [rep ${f('rep', 60)}]` : ''}${project ? ` - ${project}` : ''} - ${style}${qty ? ` - ${qty} pairs` : ''}`,
      html, text, replyTo: email, attachments: file ? [file] : []
    });
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Your request could not be sent' });
  }
  return json(200, { ok: true });
};
