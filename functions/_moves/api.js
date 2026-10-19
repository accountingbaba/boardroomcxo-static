// Boardroom Moves platform API (/api/moves/*).
// Leaders use a personal link (/feature/?t=TOKEN); the team signs in with an emailed code (/desk/).
import { json, fail, nowIso, isDev, str, esc, todayIst, addDays, parseJson, randomToken, newId, slugify,
  ensureSchema, getSettings, setSetting, logEvent, getStaff, requestCode, verifyCode, logout, admins, sendEmail, shell, button, DEFAULTS } from './lib.js';
import { razorpayOn, razorpayOrder, razorpayVerify, razorpayWebhookValid, booksOn, booksInvoice, booksInvoicePdf, STATES } from './integrations.js';

const DEDICATED = ['plus', 'pick', 'pack'];
const isDedicated = o => DEDICATED.includes(o.tier);
const needContent = o => (isDedicated(o) ? ['linkedin', 'instagram', 'website', 'whatsapp'] : ['carousel', 'website']);
const needImages = o => (isDedicated(o) ? ['linkedin', 'instagram', 'website'] : []);
export const QUESTIONS = [
  'What drew you to {company}?',
  'What are you building in your first 100 days?',
  'What did your last role teach you that you are bringing with you?',
  'What will success look like a year from now?',
  'One piece of advice for someone aiming for a role like yours?'
];
const PLATFORM = { linkedin: 'LinkedIn', instagram: 'Instagram', website: 'Website', whatsapp: 'WhatsApp', carousel: 'Carousel' };
const TIER_LABEL = { free: 'Moves of the week (free)', plus: 'Plus', pick: 'Editorial pick', pack: 'Company pack feature' };
const money = n => 'Rs ' + Number(n || 0).toLocaleString('en-IN');
const baseUrl = (env, request) => (env.MOVES_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
const featureLink = (env, request, o) => `${baseUrl(env, request)}/feature/?t=${o.token}`;
const waLink = (phone, text) => { const d = String(phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(text)}` : ''; };
const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'there';

// ── Messages (email and the WhatsApp text the team sends by hand until the WhatsApp API is live) ──
const MSG = {
  invite: (o, link) => ({
    subject: `Your Boardroom Moves feature, ${firstName(o.name)}`,
    html: shell(`Congratulations on ${o.company ? 'joining ' + o.company : 'your new role'}`, `<p>Hi ${esc(firstName(o.name))},</p><p>Thank you for agreeing to be featured in Boardroom Moves on the BoardRoom CXO page. It takes about five minutes: choose how you would like your move carried, share a few details and a photo, and you approve everything before it goes live.</p>${button(link, 'Start here')}<p style="color:#4A4D4A;font-size:13px">This link is personal to you. If you would rather skip the feature, just reply and say so.</p>`),
    wa: `Hi ${firstName(o.name)}, thank you for agreeing to be featured in Boardroom Moves. Here is your personal link to choose the feature, share your details and photo, and approve the draft before it goes live: ${link}`
  }),
  remindDetails: (o, link) => ({
    subject: `A few details for your Boardroom Moves feature`,
    html: shell('Your feature is waiting', `<p>Hi ${esc(firstName(o.name))},</p><p>Your Boardroom Moves feature is ready to start as soon as we have your details and photo. It takes about five minutes.</p>${button(link, 'Continue')}`),
    wa: `Hi ${firstName(o.name)}, a quick reminder: your Boardroom Moves feature is ready to start once we have your details and photo. It takes about five minutes: ${link}`
  }),
  remindPayment: (o, link) => ({
    subject: `Complete your Boardroom Moves Plus feature`,
    html: shell('One step left', `<p>Hi ${esc(firstName(o.name))},</p><p>Your details are in. The last step for your Plus feature is the payment, after which we prepare your post, profile page and images for your approval.</p>${button(link, 'Complete payment')}<p style="color:#4A4D4A;font-size:13px">Changed your mind? You can switch to the free feature on the same page.</p>`),
    wa: `Hi ${firstName(o.name)}, your details are in. The last step for your Plus feature is the payment: ${link}. You can also switch to the free feature on the same page.`
  }),
  paid: (o, link) => ({
    subject: `Payment received: Boardroom Moves ${o.tier === 'pack' ? 'Company pack' : 'Plus'}`,
    html: shell('Thank you, payment received', `<p>We have received ${money(o.total)} (including GST) for your Boardroom Moves ${o.tier === 'pack' ? 'Company pack' : 'Plus feature'}. Your GST invoice will be available on your page.</p><p>Next: we prepare your post, profile page and images and send them to you for approval.</p>${button(link, 'View your feature')}`),
    wa: `Thank you, ${firstName(o.name)}. We have received your payment. Your GST invoice is on your page, and we will send the draft for your approval shortly: ${link}`
  }),
  approval: (o, link) => ({
    subject: `Please approve your Boardroom Moves feature`,
    html: shell('Your draft is ready', `<p>Hi ${esc(firstName(o.name))},</p><p>Your Boardroom Moves feature is ready for your review: the LinkedIn post${isDedicated(o) ? ', Instagram caption, profile page and images' : ' line and website note'}. Approve it, or tell us what to change.</p>${button(link, 'Review and approve')}<p style="color:#4A4D4A;font-size:13px">Nothing goes live until you approve it.</p>`),
    wa: `Hi ${firstName(o.name)}, your Boardroom Moves feature is ready for your review. Please approve it or tell us what to change here: ${link}. Nothing goes live until you approve it.`
  }),
  remindApproval: (o, link) => ({
    subject: `Reminder: your Boardroom Moves draft is waiting`,
    html: shell('Waiting for your approval', `<p>Hi ${esc(firstName(o.name))},</p><p>Your draft is ready and waiting for your approval. It takes a minute to review.</p>${button(link, 'Review and approve')}`),
    wa: `Hi ${firstName(o.name)}, a gentle reminder: your Boardroom Moves draft is waiting for your approval: ${link}`
  }),
  scheduled: (o, link) => ({
    subject: `Your Boardroom Moves feature is scheduled`,
    html: shell('Approved and scheduled', `<p>Thank you for approving. Your feature goes live on ${esc(niceDate(o.slot_date))} at 6 pm India time. We will send you the links as soon as it is live.</p>${button(link, 'View your feature')}`),
    wa: `Thank you for approving, ${firstName(o.name)}. Your feature goes live on ${niceDate(o.slot_date)} at 6 pm. We will send you the links as soon as it is live.`
  }),
  live: (o, link, site) => ({
    subject: `You are live on Boardroom Moves`,
    html: shell('Your feature is live', `<p>Hi ${esc(firstName(o.name))},</p><p>Your Boardroom Moves feature is now live:</p><ul>${o.linkedin_url ? `<li><a href="${esc(o.linkedin_url)}">LinkedIn post</a></li>` : ''}${o.instagram_url ? `<li><a href="${esc(o.instagram_url)}">Instagram post</a></li>` : ''}${site ? `<li><a href="${esc(site)}">Your page on boardroomcxo.com</a></li>` : ''}</ul><p>A like or a comment from you on the LinkedIn post helps it reach more people.</p>${button(link, 'View your feature')}`),
    wa: `Hi ${firstName(o.name)}, your Boardroom Moves feature is live. LinkedIn: ${o.linkedin_url || '-'}${o.instagram_url ? ' Instagram: ' + o.instagram_url : ''}${site ? ' Your page: ' + site : ''}. A like or comment from you on the LinkedIn post helps it reach more people.`
  })
};
const niceDate = d => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '');

async function notify(env, request, order, kind, extra) {
  const link = featureLink(env, request, order);
  const m = MSG[kind](order, link, extra);
  const to = order.email || order.billing_email;
  const sent = to ? await sendEmail(env, { to, subject: m.subject, html: m.html, db: env.MOVES_DB, order_id: order.id, template: kind }) : false;
  return { emailed: sent, whatsapp_text: m.wa, whatsapp_link: waLink(order.phone, m.wa) };
}

// ── Loading and shaping orders ───────────────────────────────────────────────
const getOrder = (db, id) => db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
const getOrderByToken = (db, t) => (/^[a-f0-9]{48}$/.test(t) ? db.prepare('SELECT * FROM orders WHERE token = ?').bind(t).first() : null);
async function contentsOf(db, id) {
  const rows = (await db.prepare('SELECT platform, text, version, updated_by, updated_at FROM contents WHERE order_id = ?').bind(id).all()).results || [];
  return Object.fromEntries(rows.map(r => [r.platform, r]));
}
async function imagesOf(db, id) {
  const rows = (await db.prepare('SELECT kind, file_key, updated_at FROM images WHERE order_id = ?').bind(id).all()).results || [];
  return Object.fromEntries(rows.map(r => [r.kind, r]));
}
const detailsOf = o => parseJson(o.details, {});
function detailsComplete(o) {
  const d = detailsOf(o);
  const base = d.name && d.role_title && d.company && o.photo_key && o.consent_at && String(o.phone || '').replace(/\D/g, '').length >= 10;
  if (!base) return false;
  if (o.tier === 'plus' || o.tier === 'pick' || o.tier === 'pack') return o.skip_questions || Boolean(d.source_link) || (Array.isArray(d.answers) && d.answers.filter(a => String(a || '').trim()).length >= 3);
  return true;
}
async function needsInternal(db, o, settings) {
  if (o.internal_ok) return false;
  if (o.tier === 'pick') return true;
  if (o.tier !== 'plus' && o.tier !== 'pack') return false;
  const done = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE tier IN ('plus','pack') AND internal_ok = 1").first();
  return done.n < settings.internal_approval_first;
}
// The next free slot: a dedicated post gets the next Tuesday or Thursday not already taken; a free feature the next Friday carousel.
async function nextSlot(db, o, settings) {
  let d = addDays(todayIst(), 1);
  for (let i = 0; i < 60; i++, d = addDays(d, 1)) {
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    if (!isDedicated(o)) { if (wd === settings.carousel_day) return d; continue; }
    if (!settings.slot_days.includes(wd)) continue;
    const taken = await db.prepare("SELECT 1 FROM orders WHERE slot_date = ? AND tier IN ('plus','pick','pack') AND status NOT IN ('cancelled','removed') AND id <> ?").bind(d, o.id).first();
    if (!taken) return d;
  }
  return addDays(todayIst(), 7);
}
const touch = (db, id, patch) => {
  const keys = Object.keys(patch);
  return db.prepare(`UPDATE orders SET ${keys.map(k => k + ' = ?, ').join('')}updated_at = ? WHERE id = ?`).bind(...keys.map(k => patch[k]), nowIso(), id).run();
};

// What the leader's page may show. Prices only appear on this personal link, and Plus only from the price date.
async function leaderView(env, o) {
  const db = env.MOVES_DB, settings = await getSettings(db);
  const d = detailsOf(o);
  const priced = todayIst() >= settings.price_from;
  const plusPrice = settings.prices.plus, gst = Math.round(plusPrice * settings.prices.gst_rate / 100);
  const out = {
    id: o.id, status: o.status, tier: o.tier, tier_label: TIER_LABEL[o.tier] || '', name: o.name, role_title: o.role_title, company: o.company,
    email: o.email, phone: o.phone, details: d, has_photo: Boolean(o.photo_key), consent: Boolean(o.consent_at), skip_questions: Boolean(o.skip_questions),
    questions: QUESTIONS.map(q => q.replace('{company}', d.company || o.company || 'your new company')),
    packages: [
      { tier: 'free', title: 'Moves of the week', price: 0, includes: ['A place in our Friday "Moves of the week" post on the BoardRoom CXO LinkedIn page', 'A short note on boardroomcxo.com', 'You approve it before it goes live'] },
      ...(priced || o.tier === 'plus' ? [{ tier: 'plus', title: 'Plus', price: plusPrice, gst, total: plusPrice + gst, includes: ['Your own dedicated post on the BoardRoom CXO LinkedIn page, Tuesday or Thursday at 6 pm, with you and your company tagged', 'Instagram post', `A profile page under your name on boardroomcxo.com`, `A share in our WhatsApp community of ${settings.whatsapp_community}`, 'GST invoice to you or your company', 'You approve everything before it goes live'] }] : [])
    ],
    locked_tier: o.tier === 'pick' || o.tier === 'pack', community: settings.whatsapp_community,
    pack_buyer: o.tier === 'pack' && !o.pack_id, pack_terms: { features: settings.pack.features, months: settings.pack.months, used: 0, until: o.features_until },
    payer_type: o.payer_type, billing_name: o.billing_name, gstin: o.gstin, billing_state: o.billing_state, billing_email: o.billing_email, states: STATES,
    price: o.price, gst: o.gst, total: o.total, paid: Boolean(o.paid_at), paid_at: o.paid_at, invoice: Boolean(o.books_invoice_id), invoice_no: o.invoice_no,
    pay_online: razorpayOn(env) || isDev(env), slot_date: o.slot_date, linkedin_url: o.linkedin_url, instagram_url: o.instagram_url,
    site_url: o.live_at && !o.removed_at && o.slug ? `/moves/${o.slug}` : '', change_note: o.change_note
  };
  if (['approval', 'changes', 'approved', 'scheduled', 'live'].includes(o.status)) {
    const c = await contentsOf(db, o.id), im = await imagesOf(db, o.id);
    out.review = { contents: Object.fromEntries(needContent(o).filter(p => p !== 'whatsapp').map(p => [p, (c[p] || {}).text || ''])), images: needImages(o).filter(k => im[k]) };
  }
  return out;
}

// ── Leader endpoints ─────────────────────────────────────────────────────────
async function leader(request, env, token, action, body) {
  const db = env.MOVES_DB;
  const o = await getOrderByToken(db, token);
  if (!o || o.status === 'cancelled') return fail('This link is no longer active. Reply to our message and we will send a new one.', 404);
  const settings = await getSettings(db);
  const act = patch => touch(db, o.id, { ...patch, last_activity_at: nowIso() });

  if (request.method === 'GET' && !action) { if (!o.last_activity_at) await act({}); return json(await leaderView(env, o)); }
  if (action === 'photo' && request.method === 'GET') return serveFile(env, o.photo_key);
  if (action.startsWith('image/') && request.method === 'GET') {
    if (!['approval', 'changes', 'approved', 'scheduled', 'live'].includes(o.status)) return fail('Not available yet.', 404);
    const im = (await imagesOf(db, o.id))[action.slice(6)];
    return im ? serveFile(env, im.file_key) : fail('Not found.', 404);
  }
  if (action === 'invoice') return booksInvoicePdf(env, o);
  if (request.method !== 'POST') return fail('Not found.', 404);
  if (['live', 'removed'].includes(o.status) && action !== 'approve') return fail('This feature is already live.');

  if (action === 'choose') {
    if (o.tier === 'pick' || o.tier === 'pack') return fail('Your feature is already arranged.');
    const tier = body.tier === 'plus' ? 'plus' : 'free';
    if (tier === 'plus' && todayIst() < settings.price_from) return fail('That option is not available yet.');
    if (o.paid_at && tier !== 'plus') return fail('Your Plus feature is already paid.');
    if (!['invited', 'details', 'payment', 'ready'].includes(o.status)) return fail('Your feature is already being prepared. Reply to our message to change it.');
    const price = tier === 'plus' ? settings.prices.plus : 0, gst = Math.round(price * settings.prices.gst_rate / 100);
    await act({ tier, price, gst, total: price + gst, status: o.status === 'ready' && tier === 'plus' && !o.paid_at ? 'payment' : o.status === 'ready' ? 'ready' : 'details' });
    await logEvent(db, { order_id: o.id, by: 'leader', text: `Chose ${TIER_LABEL[tier]}` });
    return advance(request, env, o.id, 'leader');
  }
  if (action === 'details') {
    const d = { ...detailsOf(o) };
    for (const k of ['name', 'role_title', 'company', 'start_date', 'prev_role', 'linkedin', 'city']) if (k in body) d[k] = str(body[k], 200);
    if (Array.isArray(body.answers)) d.answers = body.answers.slice(0, 5).map(a => str(a, 1500));
    if ('source_link' in body) {
      const links = String(body.source_link || '').split(/\s+/).filter(u => /^https?:\/\/[^\s]+\.[^\s]+/i.test(u)).slice(0, 3);
      if (String(body.source_link || '').trim() && !links.length) return fail('That link does not look right. Paste the full address, starting with https://');
      d.source_link = links.join(' ');
    }
    if ('source_note' in body) d.source_note = str(body.source_note, 1500);
    const patch = { details: JSON.stringify(d), name: d.name || o.name, role_title: d.role_title || o.role_title, company: d.company || o.company };
    if ('email' in body) patch.email = str(body.email, 160).toLowerCase();
    if ('phone' in body) patch.phone = str(body.phone, 30);
    if ('skip_questions' in body) patch.skip_questions = body.skip_questions ? 1 : 0;
    if (body.consent) patch.consent_at = o.consent_at || nowIso();
    await act(patch);
    return advance(request, env, o.id, 'leader');
  }
  if (action === 'photo') {
    const form = await request.formData().catch(() => null);
    const file = form && form.get('photo');
    if (!file || typeof file === 'string') return fail('Choose a photo to upload.');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail('Use a JPG, PNG or WebP photo.');
    if (file.size > 10 * 1024 * 1024) return fail('That photo is over 10 MB. Use a smaller one.');
    const key = `photos/${o.id}/${randomToken(6)}.${file.type.split('/')[1]}`;
    await env.MOVES_FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    await act({ photo_key: key });
    await logEvent(db, { order_id: o.id, by: 'leader', text: 'Photo uploaded' });
    return advance(request, env, o.id, 'leader');
  }
  if (action === 'billing') {
    const payer = body.payer_type === 'company' ? 'company' : 'self';
    const gstin = str(body.gstin, 15).toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin)) return fail('That GSTIN does not look right. Check it, or leave it empty.');
    const state = STATES.includes(body.billing_state) ? body.billing_state : '';
    await act({ payer_type: payer, billing_name: str(body.billing_name, 160) || o.name, gstin, billing_state: state, billing_email: str(body.billing_email, 160).toLowerCase() || o.email });
    return json(await leaderView(env, await getOrder(db, o.id)));
  }
  if (action === 'pay') {
    const fresh = await getOrder(db, o.id);
    const packBuyer = fresh.tier === 'pack' && !fresh.pack_id;
    if ((fresh.tier !== 'plus' && !packBuyer) || fresh.paid_at || !fresh.total) return fail('Nothing to pay.');
    if (!packBuyer && !detailsComplete(fresh)) return fail('Finish your details first.');
    if (isDev(env) && !razorpayOn(env)) return json({ dev: true, amount: fresh.total });
    if (!razorpayOn(env)) return fail('Online payment opens shortly. Our team will send you a payment link on WhatsApp.', 503);
    const rid = await razorpayOrder(env, fresh);
    await act({ rzp_order_id: rid });
    return json({ key: env.RAZORPAY_KEY_ID, order_id: rid, amount: fresh.total * 100, name: fresh.billing_name || fresh.name, email: fresh.billing_email || fresh.email, phone: fresh.phone });
  }
  if (action === 'paid') {
    const fresh = await getOrder(db, o.id);
    if (fresh.paid_at) return json(await leaderView(env, fresh));
    if (isDev(env) && body.dev) return markPaid(request, env, fresh, 'DEV-' + Date.now(), 'dev');
    if (!(await razorpayVerify(env, fresh.rzp_order_id, str(body.razorpay_payment_id, 60), str(body.razorpay_signature, 200)))) return fail('We could not confirm the payment. If money left your account, our team will check and confirm it.');
    return markPaid(request, env, fresh, str(body.razorpay_payment_id, 60), 'razorpay');
  }
  if (action === 'approve') {
    if (o.status !== 'approval') return fail('There is nothing waiting for your approval right now.');
    const decision = body.decision === 'changes' ? 'changes' : 'approve';
    const comment = str(body.comment, 2000);
    if (decision === 'changes' && !comment) return fail('Tell us what to change.');
    const round = ((await db.prepare('SELECT MAX(round) AS r FROM approvals WHERE order_id = ?').bind(o.id).first()) || {}).r || 0;
    await db.prepare('INSERT INTO approvals (order_id, round, decision, comment, by_who, at) VALUES (?, ?, ?, ?, ?, ?)').bind(o.id, round + 1, decision, comment, 'leader', nowIso()).run();
    if (decision === 'changes') {
      await act({ status: 'changes', change_note: comment });
      await logEvent(db, { order_id: o.id, by: 'leader', text: 'Asked for changes: ' + comment });
    } else {
      const slot = await nextSlot(db, o, settings);
      await act({ status: 'approved', approved_at: nowIso(), slot_date: slot, change_note: null });
      await logEvent(db, { order_id: o.id, by: 'leader', text: 'Approved. Scheduled for ' + slot });
      await notify(env, request, await getOrder(db, o.id), 'scheduled');
    }
    return json(await leaderView(env, await getOrder(db, o.id)));
  }
  return fail('Not found.', 404);
}

// After any change on the leader's side: move the order on when its details (and payment) are complete.
async function advance(request, env, id, by) {
  const db = env.MOVES_DB;
  const o = await getOrder(db, id);
  if (['invited', 'details', 'payment'].includes(o.status) && o.tier) {
    if (detailsComplete(o)) {
      const next = o.tier === 'plus' && !o.paid_at ? 'payment' : 'ready';
      if (next !== o.status) {
        await touch(db, id, { status: next });
        await logEvent(db, { order_id: id, by, text: next === 'ready' ? 'Details complete: ready for drafting' : 'Details complete: waiting for payment' });
      }
    } else if (o.status === 'invited') await touch(db, id, { status: 'details' });
  }
  return json(await leaderView(env, await getOrder(db, id)));
}
async function markPaid(request, env, o, paymentId, method) {
  const db = env.MOVES_DB;
  await touch(db, o.id, { paid_at: nowIso(), payment_id: paymentId, pay_method: method, last_activity_at: nowIso() });
  await logEvent(db, { order_id: o.id, by: method === 'manual' ? 'team' : 'leader', text: `Payment received: ${money(o.total)} (${method})` });
  if (o.tier === 'pack' && !o.pack_id) {
    const s = await getSettings(db);
    await touch(db, o.id, { status: 'active', features_total: o.features_total || s.pack.features, features_until: addDays(todayIst(), Math.round(s.pack.months * 365 / 12)) });
  }
  const paid = await getOrder(db, o.id);
  await booksInvoice(env, paid, await getSettings(db));
  await notify(env, request, await getOrder(db, o.id), 'paid');
  return advance(request, env, o.id, 'system');
}
async function serveFile(env, key) {
  if (!key) return fail('Not found.', 404);
  const obj = await env.MOVES_FILES.get(key);
  if (!obj) return fail('Not found.', 404);
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, max-age=300' } });
}

// ── Team: the automatic to-do list ───────────────────────────────────────────
// Built from the state of every lead and order on each request, so it can never drift out of step.
async function today(env, staff) {
  const db = env.MOVES_DB, s = await getSettings(db), t = todayIst();
  const D = s.duties, tasks = [];
  const add = (duty, task) => tasks.push({ ...task, owner: D[duty] || D.approvals, duty });
  const leads = (await db.prepare("SELECT * FROM leads WHERE stage IN ('ready','sent','connected','replied')").all()).results || [];
  const sentToday = leads.filter(l => l.sent_date === t).length + ((await db.prepare("SELECT COUNT(*) AS n FROM leads WHERE sent_date = ? AND stage NOT IN ('ready','sent','connected','replied')").bind(t).first()).n);
  const ready = leads.filter(l => l.stage === 'ready').sort((a, b) => (b.score || 0) - (a.score || 0) || String(b.move_date || '').localeCompare(String(a.move_date || '')));
  const room = Math.max(0, s.daily_requests - sentToday);
  const from = `from ${s.linkedin_account || 'Sagar'}'s LinkedIn`;
  ready.slice(0, room).forEach(l => add('outreach', { type: 'send', from, lead_id: l.id, name: l.name, company: l.company, linkedin: l.linkedin, phone: l.phone, title: `Send connection request: ${l.name}`, sub: [l.role_title, l.company].filter(Boolean).join(' at '), due: t }));
  for (const l of leads.filter(l => l.stage === 'connected')) {
    if (!l.m1_date) add('outreach', { type: 'm1', from, lead_id: l.id, name: l.name, company: l.company, linkedin: l.linkedin, phone: l.phone, title: `Message 1: ${l.name}`, sub: 'Accepted ' + (l.accepted_date || ''), due: l.accepted_date || t });
    else if (!l.nudge_date && addDays(l.m1_date, 2) <= t) add('outreach', { type: 'nudge', from, lead_id: l.id, name: l.name, company: l.company, linkedin: l.linkedin, phone: l.phone, title: `Nudge: ${l.name}`, sub: 'Message 1 sent ' + l.m1_date, due: addDays(l.m1_date, 2) });
    else if (l.nudge_date && addDays(l.nudge_date, 3) <= t) add('outreach', { type: 'close', lead_id: l.id, name: l.name, company: l.company, linkedin: l.linkedin, phone: l.phone, title: `Close, no reply: ${l.name}`, sub: 'Nudge sent ' + l.nudge_date, due: addDays(l.nudge_date, 3) });
  }
  leads.filter(l => l.stage === 'replied').forEach(l => add('content', { type: 'reply', lead_id: l.id, name: l.name, company: l.company, linkedin: l.linkedin, phone: l.phone, title: `Reply and send the feature link: ${l.name}`, sub: l.reply || '', due: String(l.replied_at || '').slice(0, 10) || t }));

  const orders = (await db.prepare("SELECT * FROM orders WHERE status NOT IN ('cancelled','removed')").all()).results || [];
  for (const o of orders) {
    const who = o.name || 'New feature', c = ['ready', 'changes'].includes(o.status) ? await contentsOf(db, o.id) : {}, im = ['ready', 'changes'].includes(o.status) ? await imagesOf(db, o.id) : {};
    if (o.status === 'ready') {
      const missing = needContent(o).filter(p => !(c[p] && c[p].text)).concat(needImages(o).filter(k => !im[k]).map(k => k + ' image'));
      if (missing.length) add('content', { type: 'draft', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Draft the feature: ${who}`, sub: 'Still needed: ' + missing.join(', '), due: String(o.updated_at || '').slice(0, 10) });
      else if (!o.internal_ok && await needsInternal(db, o, s)) add('approvals', { type: 'internal', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Approve before it goes to ${firstName(who)}: ${who}`, sub: TIER_LABEL[o.tier], due: t });
      else add('content', { type: 'send_approval', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Send for approval: ${who}`, sub: 'Everything is drafted', due: t });
    }
    if (o.status === 'changes') add('content', { type: 'revise', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Revise and resend: ${who}`, sub: o.change_note || '', due: t });
    if (o.status === 'approved' || o.status === 'scheduled') {
      if (o.slot_date && o.slot_date <= t) add('outreach', { type: 'publish', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Publish today: ${who}`, sub: isDedicated(o) ? 'LinkedIn and Instagram post, then paste the links' : 'In this Friday\'s Moves of the week', due: o.slot_date });
    }
    if (o.status === 'live' && isDedicated(o) && o.tier !== 'pick' && !o.wa_shared_at) add('outreach', { type: 'wa_share', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Share in the WhatsApp community: ${who}`, sub: 'Use the WhatsApp text on the order', due: String(o.live_at).slice(0, 10) });
    if (o.status === 'live' && o.live_at) {
      const lv = String(o.live_at).slice(0, 10);
      if (!o.ci30_at && addDays(lv, 30) <= t) add('checkins', { type: 'ci30', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Day-30 check-in: ${who}`, sub: o.company || '', due: addDays(lv, 30) });
      else if (o.ci30_at && !o.ci60_at && addDays(lv, 60) <= t) add('checkins', { type: 'ci60', order_id: o.id, name: o.name, company: o.company, phone: o.phone, tier: o.tier, title: `Day-60 check-in: ${who}`, sub: o.company || '', due: addDays(lv, 60) });
    }
  }
  tasks.forEach(x => { x.overdue = x.due && x.due < t; });
  tasks.sort((a, b) => String(a.due).localeCompare(String(b.due)));
  return json({ today: t, me: staff.email, isAdmin: staff.isAdmin, duties: D, tasks, sent_today: sentToday, daily_requests: s.daily_requests });
}

// ── Team: fill a new person from their LinkedIn link ─────────────────────────
// Uses the public search result for the profile (title "Name - Role - Company | LinkedIn"), never a LinkedIn login.
// Needs FIRECRAWL_API_KEY; without it only the name is guessed from the address. The team always checks the result.
const titleCase = t => t.replace(/\b\w/g, c => c.toUpperCase());
export async function lookupLinkedIn(env, raw) {
  const m = String(raw || '').match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return { error: 'Paste a LinkedIn profile link, like https://www.linkedin.com/in/name' };
  const slug = decodeURIComponent(m[1]).toLowerCase(), url = `https://www.linkedin.com/in/${slug}`;
  const guess = titleCase(slug.replace(/-[0-9a-f]{5,}$/i, '').replace(/-\d+$/, '').replace(/[-_]+/g, ' ').trim());
  const out = { linkedin: url, name: guess, role_title: '', company: '', headline: '', source: 'address' };
  if (!env.FIRECRAWL_API_KEY) return out;
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/search', { method: 'POST', headers: { Authorization: 'Bearer ' + env.FIRECRAWL_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `"linkedin.com/in/${slug}"`, limit: 5, sources: ['web'] }) });
    const data = await res.json().catch(() => ({}));
    const hits = (data.data && (data.data.web || data.data)) || [];
    const hit = (Array.isArray(hits) ? hits : []).find(h => String(h.url || '').toLowerCase().includes('/in/' + slug));
    if (!hit) return out;
    const title = String(hit.title || '').replace(/\s*\|\s*LinkedIn\s*$/i, '').trim();
    const parts = title.split(/\s+[-–—|]\s+/).map(x => x.trim()).filter(Boolean);
    const desc = String(hit.description || '');
    if (parts[0]) out.name = parts[0];
    if (parts.length >= 3) { out.role_title = parts[1]; out.company = parts.slice(2).join(' - '); }
    else if (parts[1]) {
      out.headline = parts[1];
      const at = parts[1].match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
      if (at) { out.role_title = at[1].trim(); out.company = at[2].trim(); } else out.role_title = parts[1];
    }
    const exp = desc.match(/Experience:\s*([^·\n]+)/i);
    if (exp && !out.company) out.company = exp[1].trim();
    out.source = 'search';
    return out;
  } catch (e) { console.error('[Moves][lookup]', e.message); return out; }
}

// ── Team: leads ──────────────────────────────────────────────────────────────
const LEAD_FIELDS = ['name', 'role_title', 'company', 'linkedin', 'sector', 'followers', 'move_date', 'prev_role', 'source', 'source_url', 'score', 'flags', 'email', 'phone', 'note'];
function cleanLead(b) {
  const l = {};
  for (const k of LEAD_FIELDS) if (k in b) l[k] = k === 'followers' || k === 'score' ? (Number(b[k]) || null) : str(b[k], k === 'flags' || k === 'note' ? 600 : 300);
  if (l.linkedin && !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(l.linkedin)) l.linkedin = '';
  return l;
}
async function insertLeads(db, list, by) {
  let added = 0, skipped = 0;
  for (const raw of list.slice(0, 50)) {
    const l = cleanLead(raw);
    if (!l.name) { skipped++; continue; }
    if (l.linkedin && await db.prepare('SELECT 1 FROM leads WHERE linkedin = ?').bind(l.linkedin).first()) { skipped++; continue; }
    if (await db.prepare('SELECT 1 FROM leads WHERE lower(name) = lower(?) AND lower(COALESCE(company,\'\')) = lower(?)').bind(l.name, l.company || '').first()) { skipped++; continue; }
    const id = newId('ld'), keys = Object.keys(l);
    await db.prepare(`INSERT INTO leads (id, ${keys.join(', ')}, stage, created_at, created_by, updated_at) VALUES (?, ${keys.map(() => '?').join(', ')}, 'ready', ?, ?, ?)`)
      .bind(id, ...keys.map(k => l[k]), nowIso(), by, nowIso()).run();
    added++;
  }
  return { added, skipped };
}
async function leadAction(request, env, staff, id, body) {
  const db = env.MOVES_DB, t = todayIst();
  const l = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  if (!l) return fail('Not found.', 404);
  const set = (patch, text) => db.batch([
    db.prepare(`UPDATE leads SET ${Object.keys(patch).map(k => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...Object.values(patch), nowIso(), id),
    db.prepare('INSERT INTO events (lead_id, at, by_who, text) VALUES (?, ?, ?, ?)').bind(id, nowIso(), staff.email, text)
  ]);
  const a = body.act;
  if (a === 'sent') await set({ stage: 'sent', sent_date: t }, 'Connection request sent');
  else if (a === 'accepted') await set({ stage: 'connected', accepted_date: t }, 'Accepted');
  else if (a === 'm1') await set({ m1_date: t }, 'Message 1 sent');
  else if (a === 'nudge') await set({ nudge_date: t }, 'Nudge sent');
  else if (a === 'close') await set({ stage: 'noreply', closed_date: t }, 'Closed: no reply');
  else if (a === 'replied') await set({ stage: 'replied', replied_at: nowIso(), reply: str(body.reply, 1000) || l.reply }, 'Replied');
  else if (a === 'declined') await set({ stage: 'declined', closed_date: t }, 'Not interested');
  else if (a === 'reopen') await set({ stage: 'ready' }, 'Moved back to the send list');
  else if (a === 'edit') { const p = cleanLead(body.lead || {}); if (Object.keys(p).length) await set(p, 'Details edited'); }
  else return fail('Unknown action.');
  return json({ ok: true, lead: await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first() });
}
// Create the leader's personal link (an order) from a lead, or for someone added directly.
async function invite(request, env, staff, body) {
  const db = env.MOVES_DB, settings = await getSettings(db);
  const l = body.lead_id ? await db.prepare('SELECT * FROM leads WHERE id = ?').bind(body.lead_id).first() : null;
  if (l) { const open = await db.prepare("SELECT id FROM orders WHERE lead_id = ? AND status NOT IN ('cancelled','removed')").bind(l.id).first(); if (open) return fail('This person already has a feature link. Open it from Orders.'); }
  const tier = ['pick', 'pack'].includes(body.tier) ? body.tier : null;
  if (tier === 'pick' && !staff.isAdmin) return fail('Only an admin can make an editorial pick.');
  let pack = null;
  if (tier === 'pack') {
    pack = await getOrder(db, str(body.pack_id, 60));
    if (!pack || pack.tier !== 'pack' || !pack.paid_at) return fail('Choose a paid company pack.');
    const used = (await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE pack_id = ? AND status NOT IN ('cancelled')").bind(pack.id).first()).n;
    if (used >= (pack.features_total || settings.pack.features)) return fail('This company pack has no features left.');
    if (pack.features_until && pack.features_until < todayIst()) return fail('This company pack has expired.');
  }
  const o = {
    id: newId('mv'), lead_id: l ? l.id : null, pack_id: pack ? pack.id : null, token: randomToken(24), tier, status: tier ? 'details' : 'invited',
    name: str(body.name, 160) || (l && l.name) || '', role_title: str(body.role_title, 200) || (l && l.role_title) || '', company: str(body.company, 200) || (l && l.company) || '',
    email: str(body.email, 160).toLowerCase() || (l && l.email) || '', phone: str(body.phone, 30) || (l && l.phone) || '',
    price: 0, gst: 0, total: 0, created_at: nowIso(), created_by: staff.email, updated_at: nowIso(), last_activity_at: null
  };
  const li = str(body.linkedin, 300);
  o.details = JSON.stringify({ name: o.name, role_title: o.role_title, company: o.company, linkedin: (/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(li) ? li : '') || (l ? l.linkedin || '' : ''), prev_role: l ? l.prev_role || '' : '', start_date: l ? l.move_date || '' : '' });
  const keys = Object.keys(o);
  await db.prepare(`INSERT INTO orders (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map(k => o[k])).run();
  if (l) await db.prepare("UPDATE leads SET stage = 'linked', email = COALESCE(NULLIF(?, ''), email), phone = COALESCE(NULLIF(?, ''), phone), updated_at = ? WHERE id = ?").bind(o.email, o.phone, nowIso(), l.id).run();
  await logEvent(db, { order_id: o.id, lead_id: l ? l.id : null, by: staff.email, text: 'Feature link created' + (tier ? ` (${TIER_LABEL[tier]})` : '') });
  const n = await notify(env, request, o, 'invite');
  return json({ ok: true, order_id: o.id, link: featureLink(env, request, o), ...n });
}
// A company pack: the buyer pays (online or by hand) and gets 4 features over 12 months.
async function createPack(request, env, staff, body) {
  const db = env.MOVES_DB, s = await getSettings(db);
  const price = s.prices.pack, gst = Math.round(price * s.prices.gst_rate / 100);
  const o = { id: newId('pk'), token: randomToken(24), tier: 'pack', status: 'payment', name: str(body.name, 160), company: str(body.company, 200), role_title: str(body.role_title, 200),
    email: str(body.email, 160).toLowerCase(), phone: str(body.phone, 30), price, gst, total: price + gst, payer_type: 'company', billing_name: str(body.company, 200),
    features_total: s.pack.features, details: JSON.stringify({ name: str(body.name, 160), company: str(body.company, 200) }), consent_at: nowIso(),
    created_at: nowIso(), created_by: staff.email, updated_at: nowIso() };
  if (!o.company || !o.name) return fail('Enter the buyer\'s name and company.');
  const keys = Object.keys(o);
  await db.prepare(`INSERT INTO orders (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map(k => o[k])).run();
  await logEvent(db, { order_id: o.id, by: staff.email, text: 'Company pack created' });
  return json({ ok: true, order_id: o.id });
}

// ── Team: orders ─────────────────────────────────────────────────────────────
async function orderFull(env, request, o) {
  const db = env.MOVES_DB, settings = await getSettings(db);
  const [contents, images, events, approvals] = await Promise.all([contentsOf(db, o.id), imagesOf(db, o.id),
    db.prepare('SELECT at, by_who, text FROM events WHERE order_id = ? ORDER BY id DESC LIMIT 60').bind(o.id).all().then(r => r.results || []),
    db.prepare('SELECT round, decision, comment, at FROM approvals WHERE order_id = ? ORDER BY id DESC').bind(o.id).all().then(r => r.results || [])]);
  const link = featureLink(env, request, o);
  const pack = o.tier === 'pack' && !o.pack_id ? { used: (await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE pack_id = ? AND status <> 'cancelled'").bind(o.id).first()).n } : null;
  const checklist = isDedicated(o) || o.tier === 'free' ? [
    ['Details and photo', detailsComplete(o)], ...(o.tier === 'plus' ? [['Payment seen', Boolean(o.paid_at)], ['GST invoice', Boolean(o.books_invoice_id)]] : []),
    ...needContent(o).map(p => [PLATFORM[p] + ' text', Boolean(contents[p] && contents[p].text)]),
    ...needImages(o).map(k => [PLATFORM[k] + ' image', Boolean(images[k])]),
    ['Leader approved', Boolean(o.approved_at)], ['LinkedIn post link', Boolean(o.linkedin_url)], ...(isDedicated(o) ? [['Instagram post link', Boolean(o.instagram_url)]] : []),
    ['Website live', Boolean(o.live_at)], ...(isDedicated(o) && o.tier !== 'pick' ? [['WhatsApp community share', Boolean(o.wa_shared_at)]] : []), ['Proof sent', Boolean(o.proof_sent_at)]
  ] : [];
  return { order: { ...o, details: detailsOf(o), token: undefined }, link, contents, images: Object.keys(images), events, approvals, checklist,
    need_content: needContent(o), need_images: needImages(o), questions: QUESTIONS, needs_internal: await needsInternal(db, o, settings), pack,
    wa: { invite: MSG.invite(o, link).wa, remindDetails: MSG.remindDetails(o, link).wa, remindPayment: MSG.remindPayment(o, link).wa, approval: MSG.approval(o, link).wa, live: MSG.live(o, link, o.slug ? baseUrl(env, request) + '/moves/' + o.slug : '').wa },
    wa_phone: String(o.phone || '').replace(/\D/g, ''), brief: briefFor(o, contents) };
}
// The text the team pastes into the Content Studio to draft each platform.
function briefFor(o, contents) {
  const d = detailsOf(o);
  const answers = (d.answers || []).map((a, i) => a ? `${i + 1}. ${QUESTIONS[i].replace('{company}', d.company || o.company || '')}\n${a}` : '').filter(Boolean).join('\n\n');
  return [`Boardroom Moves feature: ${TIER_LABEL[o.tier] || ''}`, `Person: ${d.name || o.name}`, `New role: ${d.role_title || o.role_title} at ${d.company || o.company}`,
    d.prev_role ? `Previous role: ${d.prev_role}` : '', d.start_date ? `Start date: ${d.start_date}` : '', d.city ? `City: ${d.city}` : '', d.linkedin ? `LinkedIn: ${d.linkedin}` : '',
    d.source_link ? `\nThey shared an existing write-up about their move. Read it and write from it; confirm anything that is not in it:\n${d.source_link}${d.source_note ? '\nTheir note: ' + d.source_note : ''}` : '',
    answers ? `\nTheir answers:\n${answers}` : (o.skip_questions && !d.source_link ? '\nThey skipped the questions: use only public information and mark anything unverified.' : ''),
    `\nPlatforms needed: ${needContent(o).join(', ')}.`, o.change_note ? `\nChanges they asked for: ${o.change_note}` : ''].filter(Boolean).join('\n');
}
async function orderAction(request, env, staff, id, body) {
  const db = env.MOVES_DB, settings = await getSettings(db);
  const o = await getOrder(db, id);
  if (!o) return fail('Not found.', 404);
  const a = body.act, log = text => logEvent(db, { order_id: id, by: staff.email, text });
  const done = async extra => json({ ok: true, ...(extra || {}), ...(await orderFull(env, request, await getOrder(db, id))) });

  if (a === 'content') {
    const p = str(body.platform, 20);
    if (!['linkedin', 'instagram', 'website', 'whatsapp', 'carousel'].includes(p)) return fail('Unknown platform.');
    await db.prepare(`INSERT INTO contents (order_id, platform, text, version, updated_by, updated_at) VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(order_id, platform) DO UPDATE SET text = excluded.text, version = contents.version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(id, p, str(body.text, 20000), staff.email, nowIso()).run();
    await touch(db, id, {});
    return done();
  }
  if (a === 'internal_ok') { if (!staff.isAdmin) return fail('Only an admin can approve this.'); await touch(db, id, { internal_ok: 1 }); await log('Approved internally'); return done(); }
  if (a === 'send_approval') {
    if (!['ready', 'changes', 'approval'].includes(o.status)) return fail('This feature is not ready to send.');
    const c = await contentsOf(db, id), im = await imagesOf(db, id);
    const missing = needContent(o).filter(p => !(c[p] && c[p].text)).concat(needImages(o).filter(k => !im[k]).map(k => k + ' image'));
    if (missing.length) return fail('Still needed before sending: ' + missing.join(', '));
    if (await needsInternal(db, o, settings)) return fail('An admin needs to approve this one first.');
    await touch(db, id, { status: 'approval', approval_sent_at: nowIso(), reminders: JSON.stringify({ ...parseJson(o.reminders, {}), approval: 0 }) });
    await log('Sent for approval');
    return done(await notify(env, request, await getOrder(db, id), 'approval'));
  }
  if (a === 'schedule') { const d = str(body.date, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail('Pick a date.'); await touch(db, id, { slot_date: d, status: o.status === 'approved' ? 'scheduled' : o.status }); await log('Scheduled for ' + d); return done(); }
  if (a === 'publish') {
    if (!['approved', 'scheduled', 'live'].includes(o.status)) return fail('The leader has not approved this yet.');
    const li = str(body.linkedin_url, 400), ig = str(body.instagram_url, 400);
    if (li && !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(li)) return fail('The LinkedIn link should start with https://www.linkedin.com/');
    if (ig && !/^https:\/\/(www\.)?instagram\.com\//i.test(ig)) return fail('The Instagram link should start with https://www.instagram.com/');
    if (!li) return fail('Paste the LinkedIn post link.');
    let slug = o.slug;
    if (!slug) { const base = slugify(`${o.name}-${o.company}`) || o.id; slug = base; let i = 2; while (await db.prepare('SELECT 1 FROM orders WHERE slug = ? AND id <> ?').bind(slug, id).first()) slug = `${base}-${i++}`; }
    await touch(db, id, { linkedin_url: li, instagram_url: ig || o.instagram_url, slug, status: 'live', live_at: o.live_at || nowIso() });
    await log('Published. Website page live');
    const fresh = await getOrder(db, id), site = baseUrl(env, request) + '/moves/' + slug;
    let n = {};
    if (!o.proof_sent_at) { n = await notify(env, request, fresh, 'live', site); await touch(db, id, { proof_sent_at: nowIso() }); }
    return done(n);
  }
  if (a === 'number') {
    // Reserve the next "Boardroom Moves #" for this feature's images (once per feature).
    if (o.moves_no) return done();
    const n = Number(settings.moves_next) || 1;
    await setSetting(db, 'moves_next', n + 1);
    await touch(db, id, { moves_no: n }); await log('Numbered Boardroom Moves #' + n); return done();
  }
  if (a === 'wa_shared') { await touch(db, id, { wa_shared_at: nowIso() }); await log('Shared in the WhatsApp community'); return done(); }
  if (a === 'ci30' || a === 'ci60') { await touch(db, id, { [a + '_at']: nowIso() }); await log(a === 'ci30' ? 'Day-30 check-in sent' : 'Day-60 check-in sent'); return done(); }
  if (a === 'remove') { await touch(db, id, { status: 'removed', removed_at: nowIso() }); await log('Removed on request: website page taken down. Remove the LinkedIn and Instagram posts by hand.'); return done(); }
  if (a === 'cancel') { await touch(db, id, { status: 'cancelled' }); await log('Cancelled'); return done(); }
  if (a === 'manual_paid') {
    if (!staff.isAdmin) return fail('Only an admin can record a payment.');
    if (o.paid_at) return fail('Already paid.');
    if (!o.total) return fail('This order has no amount.');
    await markPaid(request, env, o, str(body.reference, 60) || 'manual', 'manual');
    return done();
  }
  if (a === 'retry_invoice') { await booksInvoice(env, await getOrder(db, id), settings); return done(); }
  if (a === 'notify') { const k = str(body.kind, 20); if (!['invite', 'remindDetails', 'remindPayment', 'approval', 'remindApproval'].includes(k)) return fail('Unknown message.'); return done(await notify(env, request, o, k)); }
  if (a === 'edit') {
    const p = {};
    for (const k of ['name', 'role_title', 'company', 'email', 'phone']) if (k in body) p[k] = str(body[k], 200);
    if ('tier' in body && staff.isAdmin && ['free', 'plus', 'pick'].includes(body.tier) && !o.paid_at) {
      p.tier = body.tier; const price = body.tier === 'plus' ? settings.prices.plus : 0; p.price = price; p.gst = Math.round(price * settings.prices.gst_rate / 100); p.total = p.price + p.gst;
    }
    await touch(db, id, p); await log('Order details edited'); return done();
  }
  return fail('Unknown action.');
}
async function uploadImage(request, env, staff, id, kind) {
  if (!['linkedin', 'instagram', 'website', 'carousel'].includes(kind)) return fail('Unknown image.');
  const blob = await request.blob();
  if (!/^image\/png/.test(blob.type) || blob.size > 8 * 1024 * 1024) return fail('Upload a PNG under 8 MB.');
  const key = `images/${id}/${kind}-${Date.now()}.png`;
  await env.MOVES_FILES.put(key, blob.stream(), { httpMetadata: { contentType: 'image/png' } });
  await env.MOVES_DB.prepare(`INSERT INTO images (order_id, kind, file_key, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(order_id, kind) DO UPDATE SET file_key = excluded.file_key, updated_by = excluded.updated_by, updated_at = excluded.updated_at`).bind(id, kind, key, staff.email, nowIso()).run();
  await logEvent(env.MOVES_DB, { order_id: id, by: staff.email, text: `${kind} image saved` });
  return json({ ok: true });
}

// ── Team: overview screens ───────────────────────────────────────────────────
async function revenue(env) {
  const db = env.MOVES_DB, month = todayIst().slice(0, 7);
  const paid = (await db.prepare("SELECT id, name, company, tier, price, total, paid_at, invoice_no, books_error FROM orders WHERE paid_at IS NOT NULL ORDER BY paid_at DESC").all()).results || [];
  const byMonth = {};
  for (const p of paid) { const m = String(p.paid_at).slice(0, 7); byMonth[m] = byMonth[m] || { revenue: 0, plus: 0, packs: 0 }; byMonth[m].revenue += p.price; byMonth[m][p.tier === 'pack' ? 'packs' : 'plus']++; }
  const count = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()).n;
  const funnel = {
    requests: await count('SELECT COUNT(*) AS n FROM leads WHERE substr(sent_date,1,7) = ?', month),
    accepted: await count('SELECT COUNT(*) AS n FROM leads WHERE substr(accepted_date,1,7) = ?', month),
    replied: await count('SELECT COUNT(*) AS n FROM leads WHERE substr(replied_at,1,7) = ?', month),
    links: await count("SELECT COUNT(*) AS n FROM orders WHERE substr(created_at,1,7) = ? AND (tier IS NULL OR tier <> 'pack' OR pack_id IS NOT NULL)", month),
    plus_chosen: await count("SELECT COUNT(*) AS n FROM orders WHERE tier = 'plus' AND substr(created_at,1,7) = ?", month),
    paid: await count("SELECT COUNT(*) AS n FROM orders WHERE substr(paid_at,1,7) = ?", month),
    live: await count("SELECT COUNT(*) AS n FROM orders WHERE substr(live_at,1,7) = ?", month)
  };
  return json({ month, by_month: byMonth, payments: paid.slice(0, 100), funnel, books: booksOn(env), razorpay: razorpayOn(env) });
}
async function calendar(env) {
  const db = env.MOVES_DB, s = await getSettings(db), t = todayIst();
  const rows = (await db.prepare("SELECT id, name, company, tier, status, slot_date FROM orders WHERE slot_date >= ? AND status NOT IN ('cancelled','removed') ORDER BY slot_date").bind(addDays(t, -7)).all()).results || [];
  const days = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(t, i), wd = new Date(d + 'T00:00:00Z').getUTCDay();
    if (s.slot_days.includes(wd) || wd === s.carousel_day) days.push({ date: d, kind: wd === s.carousel_day ? 'carousel' : 'dedicated', orders: rows.filter(r => r.slot_date === d) });
  }
  return json({ days });
}

// ── Reminders (called by the cron worker every hour) ─────────────────────────
async function cron(request, env) {
  const db = env.MOVES_DB, now = Date.now(), H = 3600e3;
  const rows = (await db.prepare("SELECT * FROM orders WHERE status IN ('invited','details','payment','approval') AND (email IS NOT NULL AND email <> '')").all()).results || [];
  let sent = 0;
  for (const o of rows) {
    const r = parseJson(o.reminders, {});
    if (o.status === 'approval') {
      const n = r.approval || 0, since = now - Date.parse(o.approval_sent_at || o.updated_at);
      if (n < 2 && since > (n === 0 ? 24 : 48) * H) { await notify(env, request, o, 'remindApproval'); r.approval = n + 1; sent++; }
    } else {
      if (!o.last_activity_at && o.status === 'invited') continue; // never opened: the team follows up on LinkedIn instead
      const key = o.status === 'payment' ? 'payment' : 'details', n = r[key] || 0, since = now - Date.parse(o.last_activity_at || o.created_at);
      const wait = [2, 24, 72][n];
      if (wait && since > wait * H) { await notify(env, request, o, key === 'payment' ? 'remindPayment' : 'remindDetails'); r[key] = n + 1; sent++; }
    }
    await db.prepare('UPDATE orders SET reminders = ? WHERE id = ?').bind(JSON.stringify(r), o.id).run();
  }
  return json({ ok: true, reminders: sent });
}

// ── Router ───────────────────────────────────────────────────────────────────
export async function handleApi(context) {
  const { request, env } = context;
  if (!env.MOVES_DB || !env.MOVES_FILES) return fail('The Boardroom Moves database is not connected yet.', 503);
  await ensureSchema(env.MOVES_DB);
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/moves\/?/, '').split('/').filter(Boolean);
  const method = request.method;
  const body = method === 'POST' && parts[0] !== 'razorpay' && (request.headers.get('Content-Type') || '').includes('application/json') ? await request.json().catch(() => ({})) : {};
  try {
    if (parts[0] === 'f' && parts[1]) return await leader(request, env, parts[1], parts.slice(2).join('/'), body);
    if (parts[0] === 'auth') {
      if (parts[1] === 'code' && method === 'POST') return await requestCode(env, body);
      if (parts[1] === 'verify' && method === 'POST') return await verifyCode(env, body);
      if (parts[1] === 'logout' && method === 'POST') return await logout(request, env);
    }
    if (parts[0] === 'razorpay' && parts[1] === 'webhook' && method === 'POST') {
      const raw = await request.text();
      if (!(await razorpayWebhookValid(env, raw, request.headers.get('X-Razorpay-Signature')))) return fail('Bad signature.', 401);
      const ev = parseJson(raw, {});
      const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
      if (pay && ['payment.captured', 'order.paid'].includes(ev.event)) {
        const o = await env.MOVES_DB.prepare('SELECT * FROM orders WHERE rzp_order_id = ?').bind(pay.order_id).first();
        if (o && !o.paid_at) await markPaid(request, env, o, pay.id, 'razorpay');
      }
      return json({ ok: true });
    }
    if (parts[0] === 'loader') {
      if (!env.MOVES_LOADER_KEY || request.headers.get('X-Loader-Key') !== env.MOVES_LOADER_KEY) return fail('Not allowed.', 401);
      if (parts[1] === 'leads' && method === 'POST') return json(await insertLeads(env.MOVES_DB, Array.isArray(body.leads) ? body.leads : [], 'loader'));
      if (parts[1] === 'seen' && method === 'GET') {
        const rows = (await env.MOVES_DB.prepare('SELECT name, company, linkedin, stage, move_date FROM leads').all()).results || [];
        return json({ leads: rows, fresh_ready: rows.filter(r => r.stage === 'ready' && r.move_date && r.move_date >= addDays(todayIst(), -7)).length });
      }
    }
    if (parts[0] === 'cron' && method === 'POST') {
      if (!env.MOVES_CRON_KEY || request.headers.get('X-Cron-Key') !== env.MOVES_CRON_KEY) return fail('Not allowed.', 401);
      return await cron(request, env);
    }
    // Everything below needs a team sign-in.
    const staff = await getStaff(request, env);
    if (parts[0] === 'me') return json(staff ? { signedIn: true, ...staff } : { signedIn: false });
    if (parts[0] !== 'team') return fail('Not found.', 404);
    if (!staff) return fail('Sign in first.', 401);
    if (staff.desks && !staff.desks.includes('mv')) return fail('You do not have access to the Moves desk. Ask Ketul to add it.', 403);
    const [, what, id, sub, sub2] = parts;
    const db = env.MOVES_DB;
    if (what === 'today') return await today(env, staff);
    if (what === 'leads' && !id && method === 'GET') {
      const stage = url.searchParams.get('stage');
      const rows = (await db.prepare(`SELECT * FROM leads ${stage ? 'WHERE stage = ?' : ''} ORDER BY updated_at DESC LIMIT 500`).bind(...(stage ? [stage] : [])).all()).results || [];
      return json({ leads: rows });
    }
    if (what === 'leads' && !id && method === 'POST') return json(await insertLeads(db, Array.isArray(body.leads) ? body.leads : [body], staff.email));
    if (what === 'leads' && id && sub === 'action') return await leadAction(request, env, staff, id, body);
    if (what === 'leads' && id && method === 'GET') {
      const l = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
      if (!l) return fail('Not found.', 404);
      const ev = (await db.prepare('SELECT at, by_who, text FROM events WHERE lead_id = ? ORDER BY id DESC LIMIT 40').bind(id).all()).results || [];
      const ord = await db.prepare('SELECT id, status, tier FROM orders WHERE lead_id = ? ORDER BY created_at DESC').bind(id).first();
      return json({ lead: l, events: ev, order: ord });
    }
    if (what === 'invite' && method === 'POST') return await invite(request, env, staff, body);
    if (what === 'lookup' && method === 'POST') { const r = await lookupLinkedIn(env, body.url); return r.error ? fail(r.error) : json(r); }
    if (what === 'packs' && method === 'POST') { if (!staff.isAdmin) return fail('Admins only.', 403); return await createPack(request, env, staff, body); }
    if (what === 'orders' && !id) {
      const st = url.searchParams.get('status');
      const rows = (await db.prepare(`SELECT id, name, company, role_title, tier, status, slot_date, paid_at, total, live_at, created_at, updated_at, pack_id, features_total FROM orders ${st ? 'WHERE status = ?' : ''} ORDER BY updated_at DESC LIMIT 500`).bind(...(st ? [st] : [])).all()).results || [];
      return json({ orders: rows });
    }
    if (what === 'orders' && id && !sub && method === 'GET') { const o = await getOrder(db, id); return o ? json(await orderFull(env, request, o)) : fail('Not found.', 404); }
    if (what === 'orders' && id && sub === 'action' && method === 'POST') return await orderAction(request, env, staff, id, body);
    if (what === 'orders' && id && sub === 'photo' && method === 'GET') { const o = await getOrder(db, id); return serveFile(env, o && o.photo_key); }
    if (what === 'orders' && id && sub === 'image' && sub2) {
      if (method === 'POST') return await uploadImage(request, env, staff, id, sub2);
      const im = (await imagesOf(db, id))[sub2]; return serveFile(env, im && im.file_key);
    }
    if (what === 'revenue') { if (!staff.isAdmin) return fail('Admins only.', 403); return await revenue(env); }
    if (what === 'calendar') return await calendar(env);
    if (what === 'settings' && method === 'GET') {
      const staffRows = (await db.prepare('SELECT email, name, role, active, desks FROM staff ORDER BY email').all()).results || [];
      return json({ settings: await getSettings(db), staff: staffRows, admins: admins(env), connections: { email: Boolean(env.ZEPTOMAIL_TOKEN), razorpay: razorpayOn(env), books: booksOn(env), loader: Boolean(env.MOVES_LOADER_KEY), lookup: Boolean(env.FIRECRAWL_API_KEY) } });
    }
    if (what === 'settings' && method === 'POST') {
      if (!staff.isAdmin) return fail('Admins only.', 403);
      if (body.staff) {
        // People are added and removed on the Accounting Baba portal's Team page. Here only their companies change.
        const e = str(body.staff.email, 160).toLowerCase();
        const known = await db.prepare('SELECT * FROM staff WHERE email = ?').bind(e).first();
        if (!known) return fail('Add people on the Accounting Baba portal Team page first.');
        body.staff = { ...body.staff, name: known.name, role: ['member', 'manager'].includes(body.staff.role) ? body.staff.role : known.role, active: Boolean(known.active) };
        if (!/@/.test(e)) return fail('Enter an email address.');
        const desks = Array.isArray(body.staff.desks) ? body.staff.desks.filter(d => ['uae', 'eo', 'cxo', 'mv'].includes(d)).join(',') : null;
        await db.prepare(`INSERT INTO staff (email, name, role, active, created_at, desks) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role, active = excluded.active, desks = COALESCE(?, staff.desks)`)
          .bind(e, str(body.staff.name, 80), ['admin', 'manager'].includes(body.staff.role) ? body.staff.role : 'member', body.staff.active === false ? 0 : 1, nowIso(), desks, desks).run();
      }
      for (const k of Object.keys(DEFAULTS)) if (k in (body.settings || {})) await setSetting(db, k, body.settings[k]);
      return json({ ok: true });
    }
    return fail('Not found.', 404);
  } catch (e) {
    console.error('[Moves]', url.pathname, e.stack || e.message);
    return fail('Something went wrong on our side. Please try again.', 500);
  }
}
export { leaderView, QUESTIONS as MOVE_QUESTIONS };
