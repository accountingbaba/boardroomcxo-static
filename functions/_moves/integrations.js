// Payments (Razorpay) and GST invoices (Zoho Books, Hopeberry Retail Private Limited).
import { str, nowIso, isDev, hmacHex, metaGet, metaSet, parseJson, fail } from './lib.js';

// ── Razorpay ─────────────────────────────────────────────────────────────────
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET. Until they are set, the leader sees
// "our team will send you a payment link" and the team can record a payment by hand after seeing it in Razorpay.
export const razorpayOn = env => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export async function razorpayOrder(env, order) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: order.total * 100, currency: 'INR', receipt: order.id.slice(0, 40), notes: { order_id: order.id, feature: order.tier } })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error('Razorpay: ' + ((data.error && data.error.description) || res.status));
  return data.id;
}
export async function razorpayVerify(env, orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  return (await hmacHex(env.RAZORPAY_KEY_SECRET, orderId + '|' + paymentId)) === signature;
}
export async function razorpayWebhookValid(env, raw, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  return (await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw)) === signature;
}

// ── Zoho Books ───────────────────────────────────────────────────────────────
// Same Zoho Self Client the Accounting Baba portal uses (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_BOOKS_REFRESH_TOKEN).
// A paid Plus feature becomes a GST invoice from Hopeberry Retail, with the payment recorded against it.
const BOOKS_API = 'https://www.zohoapis.com/books/v3';
const BOOKS_ORG_NAME = 'Hopeberry Retail Private Limited';
const HOME_STATE = 'GJ';
export const booksOn = env => Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_BOOKS_REFRESH_TOKEN);

async function booksToken(env) {
  const db = env.MOVES_DB;
  const saved = parseJson(await metaGet(db, 'books_token'), null);
  if (saved && saved.expires > Date.now() + 120000) return saved.token;
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: env.ZOHO_BOOKS_REFRESH_TOKEN }) });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) throw new Error('Zoho Books did not accept the saved key' + (data.error ? ` (${data.error})` : ''));
  await metaSet(db, 'books_token', JSON.stringify({ token: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 }));
  return data.access_token;
}
async function books(env, method, path, body) {
  const token = await booksToken(env);
  const call = async p => {
    const res = await fetch(BOOKS_API + p, { method, headers: { Authorization: 'Zoho-oauthtoken ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data.code !== undefined && data.code !== 0)) throw new Error(`Zoho Books: ${data.message || res.status} (${method} ${p.split('?')[0]})`);
    return data;
  };
  let org = await metaGet(env.MOVES_DB, 'books_org');
  if (!org) {
    const list = (await call('/organizations')).organizations || [];
    const hit = list.find(o => o.name === BOOKS_ORG_NAME) || (list.length === 1 ? list[0] : null);
    if (!hit) throw new Error('Zoho Books: organisation not found');
    org = hit.organization_id;
    await metaSet(env.MOVES_DB, 'books_org', org);
  }
  return call(path + (path.includes('?') ? '&' : '?') + 'organization_id=' + org);
}
const GST_STATES = { '24': 'GJ', '27': 'MH', '07': 'DL', '29': 'KA', '33': 'TN', '36': 'TS', '09': 'UP', '19': 'WB', '06': 'HR', '08': 'RJ', '32': 'KL', '23': 'MP', '03': 'PB', '30': 'GA' };
export const STATES = ['AN','AP','AR','AS','BR','CH','CT','DL','DN','GA','GJ','HP','HR','JH','JK','KA','KL','LA','LD','MH','ML','MN','MP','MZ','NL','OR','PB','PY','RJ','SK','TN','TR','TS','UK','UP','WB'];

async function taxId(env, inter) {
  const key = inter ? 'books_tax_igst18' : 'books_tax_gst18';
  const saved = await metaGet(env.MOVES_DB, key);
  if (saved) return saved;
  const id = (((await books(env, 'GET', '/settings/taxes')).taxes || []).find(t => t.tax_name === (inter ? 'IGST18' : 'GST18')) || {}).tax_id;
  if (id) await metaSet(env.MOVES_DB, key, id);
  return id;
}
async function customer(env, order) {
  const name = order.billing_name || order.name;
  const look = async q => (((await books(env, 'GET', '/contacts?contact_type=customer&' + q)).contacts || [])[0] || {}).contact_id;
  let id = order.gstin ? await look('gst_no=' + encodeURIComponent(order.gstin)) : null;
  if (!id) id = await look('contact_name=' + encodeURIComponent(name));
  if (id) return id;
  const place = order.billing_state || (order.gstin && GST_STATES[order.gstin.slice(0, 2)]) || HOME_STATE;
  const made = await books(env, 'POST', '/contacts', {
    contact_name: name, company_name: order.payer_type === 'company' ? name : '', contact_type: 'customer',
    gst_treatment: order.gstin ? 'business_gst' : 'consumer', ...(order.gstin ? { gst_no: order.gstin } : {}), place_of_contact: place,
    billing_address: { state_code: place, country: 'India' },
    contact_persons: [{ first_name: order.name || name, email: order.billing_email || order.email || '', phone: order.phone || '', is_primary_contact: true }],
    notes: 'Created by the Boardroom Moves portal'
  });
  return made.contact.contact_id;
}
// Invoice plus payment for a paid order. Needs the SAC code in Settings. Never twice; failures are kept and retried by the team.
export async function booksInvoice(env, order, settings) {
  const db = env.MOVES_DB;
  if (isDev(env) || !booksOn(env) || order.books_invoice_id || !order.paid_at) return null;
  if (!settings.books_sac) {
    await db.prepare('UPDATE orders SET books_error = ? WHERE id = ?').bind('Invoice not made: the SAC code is not set in Settings.', order.id).run();
    return null;
  }
  try {
    const cust = await customer(env, order);
    const place = order.billing_state || (order.gstin && GST_STATES[order.gstin.slice(0, 2)]) || HOME_STATE;
    const inter = place !== HOME_STATE;
    const label = order.tier === 'pack' ? `Boardroom Moves Company pack: ${settings.pack.features} features over ${settings.pack.months} months` : `Boardroom Moves Plus feature: ${order.name}, ${order.role_title || ''} at ${order.company || ''}`;
    const inv = await books(env, 'POST', '/invoices', {
      customer_id: cust, date: String(order.paid_at).slice(0, 10), place_of_supply: place, reference_number: str(order.payment_id || order.id, 50),
      line_items: [{ name: order.tier === 'pack' ? 'Boardroom Moves Company pack' : 'Boardroom Moves Plus feature', description: label.slice(0, 2000),
        rate: order.price, quantity: 1, hsn_or_sac: settings.books_sac, tax_id: await taxId(env, inter) }]
    });
    const invoice = inv.invoice;
    await books(env, 'POST', `/invoices/${invoice.invoice_id}/status/sent`);
    await books(env, 'POST', '/customerpayments', {
      customer_id: cust, payment_mode: order.pay_method === 'manual' ? 'Bank Transfer' : 'Razorpay', amount: order.total, date: String(order.paid_at).slice(0, 10),
      reference_number: str(order.payment_id || order.id, 50), invoices: [{ invoice_id: invoice.invoice_id, amount_applied: order.total }]
    });
    await db.prepare('UPDATE orders SET books_invoice_id = ?, invoice_no = ?, books_error = NULL WHERE id = ?').bind(invoice.invoice_id, invoice.invoice_number, order.id).run();
    return invoice;
  } catch (e) {
    console.error('[Moves][Books]', order.id, e.message);
    await db.prepare('UPDATE orders SET books_error = ? WHERE id = ?').bind(str(e.message, 300), order.id).run();
    return null;
  }
}
export async function booksInvoicePdf(env, order) {
  if (!order.books_invoice_id) return fail('The invoice is not ready yet.', 404);
  const token = await booksToken(env);
  const org = await metaGet(env.MOVES_DB, 'books_org');
  const res = await fetch(`${BOOKS_API}/invoices/${order.books_invoice_id}?organization_id=${org}&accept=pdf`, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
  if (!res.ok) return fail('The invoice could not be fetched just now. Try again in a minute.', 500);
  return new Response(res.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Invoice-${order.invoice_no || order.id}.pdf"`, 'Cache-Control': 'private, no-store' } });
}
