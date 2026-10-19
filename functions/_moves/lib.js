// Boardroom Moves platform: shared helpers (database, sign-in, email, settings).
// Data lives in D1 (env.MOVES_DB), photos and images in R2 (env.MOVES_FILES).
// The design follows the Accounting Baba portal (worker-portal.js in accountingbaba-website).

export const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers }
});
export const fail = (message, status = 400) => json({ error: message }, status);
export const nowIso = () => new Date().toISOString();
export const isDev = env => env.MOVES_DEV === '1';
export const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const todayIst = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
export const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const parseJson = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const randomToken = (bytes = 24) => [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
export const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
export const newId = prefix => prefix + '-' + Date.now().toString(36) + randomToken(3);
export const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

// ── Schema ───────────────────────────────────────────────────────────────────
// Applied on first use; bump SCHEMA_VERSION and add statements to change it. Never ask the owner to run SQL.
const SCHEMA_VERSION = 1;
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS staff (email TEXT PRIMARY KEY, name TEXT, role TEXT NOT NULL DEFAULT 'member', duty TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS login_codes (email TEXT PRIMARY KEY, code_hash TEXT, expires_at INTEGER, attempts INTEGER DEFAULT 0, sent_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, role_title TEXT, company TEXT, linkedin TEXT, sector TEXT, followers INTEGER,
     move_date TEXT, prev_role TEXT, source TEXT, source_url TEXT, score INTEGER, flags TEXT, stage TEXT NOT NULL DEFAULT 'ready',
     sent_date TEXT, accepted_date TEXT, m1_date TEXT, nudge_date TEXT, replied_at TEXT, closed_date TEXT, reply TEXT, note TEXT,
     email TEXT, phone TEXT, created_at TEXT, created_by TEXT, updated_at TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_linkedin ON leads(linkedin) WHERE linkedin IS NOT NULL AND linkedin <> ''`,
  `CREATE INDEX IF NOT EXISTS leads_stage ON leads(stage)`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, lead_id TEXT, pack_id TEXT, token TEXT UNIQUE NOT NULL, tier TEXT, status TEXT NOT NULL DEFAULT 'invited',
     name TEXT, role_title TEXT, company TEXT, email TEXT, phone TEXT, details TEXT, photo_key TEXT, consent_at TEXT, skip_questions INTEGER DEFAULT 0,
     price INTEGER, gst INTEGER, total INTEGER, payer_type TEXT, billing_name TEXT, gstin TEXT, billing_state TEXT, billing_email TEXT,
     rzp_order_id TEXT, payment_id TEXT, paid_at TEXT, pay_method TEXT, books_invoice_id TEXT, invoice_no TEXT, books_error TEXT,
     internal_ok INTEGER DEFAULT 0, approval_sent_at TEXT, approved_at TEXT, change_note TEXT, slot_date TEXT,
     linkedin_url TEXT, instagram_url TEXT, slug TEXT UNIQUE, live_at TEXT, wa_shared_at TEXT, proof_sent_at TEXT,
     ci30_at TEXT, ci60_at TEXT, removed_at TEXT, reminders TEXT, last_activity_at TEXT,
     moves_no INTEGER, features_total INTEGER, features_until TEXT, created_at TEXT, created_by TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS orders_status ON orders(status)`,
  `CREATE TABLE IF NOT EXISTS contents (order_id TEXT NOT NULL, platform TEXT NOT NULL, text TEXT, version INTEGER DEFAULT 1, updated_by TEXT, updated_at TEXT, PRIMARY KEY (order_id, platform))`,
  `CREATE TABLE IF NOT EXISTS images (order_id TEXT NOT NULL, kind TEXT NOT NULL, file_key TEXT NOT NULL, updated_by TEXT, updated_at TEXT, PRIMARY KEY (order_id, kind))`,
  `CREATE TABLE IF NOT EXISTS approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, round INTEGER, decision TEXT, comment TEXT, by_who TEXT, at TEXT)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, lead_id TEXT, at TEXT, by_who TEXT, text TEXT)`,
  `CREATE INDEX IF NOT EXISTS events_order ON events(order_id)`,
  `CREATE INDEX IF NOT EXISTS events_lead ON events(lead_id)`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, channel TEXT, template TEXT, to_addr TEXT, ok INTEGER, at TEXT)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`
];
let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.prepare(SCHEMA[0]).run();
  const row = await db.prepare("SELECT value FROM meta WHERE key = 'schema'").first();
  if (!row || Number(row.value) < SCHEMA_VERSION) {
    await db.batch(SCHEMA.slice(1).map(s => db.prepare(s)));
    await db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(SCHEMA_VERSION)).run();
  }
  schemaReady = true;
}

// ── Settings ─────────────────────────────────────────────────────────────────
// Defaults are the owner's decisions (19 Oct 2026). Admins change them on the Settings screen.
export const DEFAULTS = {
  prices: { plus: 3000, pack: 10000, gst_rate: 18 },
  price_from: '2026-10-27',
  pack: { features: 4, months: 12 },
  daily_requests: 6,
  slot_days: [2, 4],          // dedicated posts on Tuesday and Thursday
  carousel_day: 5,            // Friday "Moves of the week"
  // Who gets which tasks. Outreach and publishing: Paridhi. Replies and content: Soumavo. Approvals and check-ins: admins.
  duties: { outreach: 'paridhiwork28@gmail.com', content: 'ashokbhatt6960@gmail.com', approvals: 'ketul4nil@gmail.com', checkins: 'ketul4nil@gmail.com' },
  internal_approval_first: 10, // Ketul approves the first 10 paid features
  books_sac: '',              // SAC code for the Plus invoice: to be confirmed by the CA before invoices are made
  whatsapp_community: '100+ CXOs',
  moves_next: 88              // the next "Boardroom Moves #" number for dedicated posts (#87 was the last made in Canva)
};
export async function getSettings(db) {
  const rows = (await db.prepare('SELECT key, value FROM settings').all()).results || [];
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.key] = parseJson(r.value, out[r.key]);
  return out;
}
export const setSetting = (db, key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
export const metaGet = async (db, key) => ((await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first()) || {}).value || '';
export const metaSet = (db, key, value) => db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, String(value)).run();

export const logEvent = (db, { order_id = null, lead_id = null, by = 'system', text }) =>
  db.prepare('INSERT INTO events (order_id, lead_id, at, by_who, text) VALUES (?, ?, ?, ?, ?)').bind(order_id, lead_id, nowIso(), by, str(text, 500)).run();

// ── Sign-in (team) ───────────────────────────────────────────────────────────
const COOKIE = 'brc_moves';
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
export const admins = env => String(env.MOVES_ADMINS || 'ketul4nil@gmail.com,ketul@theaccountingbaba.com').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const readCookie = (request, name) => ((request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')) || [])[1] || null;
const cookie = (token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function getStaff(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const db = env.MOVES_DB;
  const s = await db.prepare('SELECT email FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(await sha256Hex(token), Date.now()).first();
  if (!s) return null;
  const st = await db.prepare('SELECT * FROM staff WHERE email = ? AND active = 1').bind(s.email).first();
  const isAdmin = admins(env).includes(s.email) || (st && st.role === 'admin');
  if (!st && !isAdmin) return null;
  return { email: s.email, name: (st && st.name) || s.email.split('@')[0], isAdmin };
}
export async function requestCode(env, body) {
  const db = env.MOVES_DB;
  const email = str(body.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter a valid email address.');
  const allowed = admins(env).includes(email) || await db.prepare('SELECT 1 FROM staff WHERE email = ? AND active = 1').bind(email).first();
  // Same answer either way, so the form does not reveal who is on the team.
  if (!allowed) return json({ ok: true });
  const prev = await db.prepare('SELECT sent_at FROM login_codes WHERE email = ?').bind(email).first();
  if (prev && Date.now() - prev.sent_at < 45000) return fail('A code was just sent. Wait a moment before asking again.', 429);
  const code = randomCode();
  await db.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`)
    .bind(email, await sha256Hex(email + ':' + code), Date.now() + CODE_MINUTES * 60000, Date.now()).run();
  const sent = await sendEmail(env, { to: email, subject: `${code} is your Boardroom Moves desk code`,
    html: shell('Your sign-in code', `<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:8px 0 14px">${code}</p><p style="color:#4A4D4A;font-size:14px">This code works for ${CODE_MINUTES} minutes.</p>`) });
  if (!sent && !isDev(env)) return fail('The code could not be sent right now. Try again shortly.', 500);
  return json(isDev(env) ? { ok: true, devCode: code } : { ok: true });
}
export async function verifyCode(env, body) {
  const db = env.MOVES_DB;
  const email = str(body.email, 160).toLowerCase(), code = str(body.code, 6);
  const row = await db.prepare('SELECT * FROM login_codes WHERE email = ?').bind(email).first();
  if (!row || row.expires_at < Date.now() || row.attempts >= 5) return fail('That code has expired. Ask for a new one.');
  if (row.code_hash !== await sha256Hex(email + ':' + code)) {
    await db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return fail('That code is not right. Check it and try again.');
  }
  await db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
  const token = randomToken(32);
  await db.prepare('INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), email, Date.now() + SESSION_DAYS * 86400000).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
}
export async function logout(request, env) {
  const token = readCookie(request, COOKIE);
  if (token) await env.MOVES_DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
}

// ── Email (Zoho ZeptoMail) ───────────────────────────────────────────────────
// From moves@boardroomcxo.com, replies to hire@boardroomcxo.com. Needs boardroomcxo.com verified in ZeptoMail.
export async function sendEmail(env, { to, subject, html, db = null, order_id = null, template = '' }) {
  const list = (Array.isArray(to) ? to : [to]).map(a => str(a, 160)).filter(a => /@/.test(a) && !/@example\.(com|org|net)$/i.test(a));
  if (!list.length) return false;
  let ok = false;
  if (env.ZEPTOMAIL_TOKEN) {
    try {
      const res = await fetch(`https://${env.ZEPTOMAIL_HOST || 'api.zeptomail.com'}/v1.1/email`, {
        method: 'POST',
        headers: { Authorization: 'Zoho-enczapikey ' + String(env.ZEPTOMAIL_TOKEN).replace(/^Zoho-enczapikey\s+/i, ''), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          from: { address: env.MOVES_FROM_EMAIL || 'moves@boardroomcxo.com', name: 'BoardRoom CXO' },
          reply_to: [{ address: env.MOVES_REPLY_TO || 'hire@boardroomcxo.com', name: 'BoardRoom CXO' }],
          to: list.map(address => ({ email_address: { address } })), subject, htmlbody: html
        })
      });
      ok = res.ok;
      if (!ok) console.error('[Moves][Email]', res.status, await res.text());
    } catch (e) { console.error('[Moves][Email]', e.message); }
  } else console.log('[Moves][Email not sent: no ZEPTOMAIL_TOKEN]', list.join(','), '|', subject);
  if (db) await db.prepare('INSERT INTO messages (order_id, channel, template, to_addr, ok, at) VALUES (?, ?, ?, ?, ?, ?)').bind(order_id, 'email', template, list.join(','), ok ? 1 : 0, nowIso()).run();
  return ok;
}
export function shell(title, body) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0F1110;background:#FFFFFF">
<div style="background:#172633;padding:16px 24px"><span style="color:#F7F6F2;font-family:Georgia,serif;font-size:20px;font-weight:700">BoardRoom CXO</span><span style="color:#D29A82;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-left:12px">Boardroom Moves</span></div>
<div style="padding:24px;border:1px solid #D1CFCA;border-top:0"><h2 style="margin:0 0 14px;font-size:20px;font-family:Georgia,serif">${esc(title)}</h2>${body}
<p style="color:#4A4D4A;font-size:12px;margin-top:24px;border-top:1px solid #EAE8E1;padding-top:12px">BoardRoom CXO, Surat. Reply to this email to reach our team.</p></div></div>`;
}
export const button = (href, label) => `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#172633;color:#F7F6F2;padding:12px 20px;text-decoration:none;font-weight:700;display:inline-block">${esc(label)}</a></p>`;
