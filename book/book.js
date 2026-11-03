// Boardroom CXO booking page: pick a day and a time, then confirm. Also change or cancel a booking.
// The scheduling itself runs on the Accounting Baba portal (same host, calendar and Teams account as the other sites);
// this page only talks to its public booking endpoints from boardroomcxo.com, with ?brand=brc.
// Adapted from earthoneaccounting.com/book/ (3 Nov 2026). Every class starts with bk- so the site's style.css cannot clash.
(() => {
'use strict';

const LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API = (LOCAL ? 'http://localhost:8787' : 'https://accountingbaba.com') + '/api/portal/public/';
const BRAND = 'Boardroom CXO';
const INBOX = 'hire@boardroomcxo.com';
const HOST_PHOTO = '/images/ketul-patel.jpg';
const EMBED = document.body.classList.contains('bk-embed');

const root = document.getElementById('book');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const icon = (path, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
const I = {
  check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  clock: icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  video: icon('<rect x="3" y="6.5" width="12" height="11" rx="2"/><path d="m15 10.5 6-3v9l-6-3"/>'),
  globe: icon('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>'),
  cal: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  user: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
  link: icon('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  left: icon('<path d="m15 6-6 6 6 6"/>'),
  right: icon('<path d="m9 6 6 6-6 6"/>'),
  back: icon('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  cursor: icon('<path d="M4 4l7.5 16 2.2-6.3L20 11.5z"/>', 'stroke-width="1.6"'),
  download: icon('<path d="M12 4v11M7 10l5 5 5-5M4 19h16"/>'),
  gcal: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h3v3H8z"/>')
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function api(path, body) {
  let res;
  try {
    res = await fetch(API + path, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  } catch {
    throw new Error(`The booking calendar could not be reached. Please try again in a moment, or email ${INBOX}.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status });
  return data;
}

const localZone = (() => { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; return z === 'Asia/Calcutta' ? 'Asia/Kolkata' : z; } catch { return 'Asia/Kolkata'; } })();
const ZONES = [...new Set([localZone, 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York'])];
const zoneLabel = tz => (tz === 'Asia/Kolkata' ? 'India Standard Time' : tz === 'Asia/Dubai' ? 'UAE (Gulf time)' : tz === 'Europe/London' ? 'United Kingdom' : tz.replace(/_/g, ' '));
const dayKey = (iso, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const timeText = (iso, tz) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
const longDay = (iso, tz) => new Date(iso).toLocaleDateString('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (iso, tz) => new Date(iso).toLocaleDateString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });

// Inside the Schedule a call page the card sits in an iframe: tell the page how tall it is, and when to scroll to it.
function tellParent(top) {
  if (!EMBED || window.parent === window) return;
  const send = () => window.parent.postMessage({ boardroomBook: document.documentElement.scrollHeight, top: Boolean(top) }, location.origin);
  send();
  setTimeout(send, 250);
}

// The step bar: 1 Date, 2 Time, 3 Details. `at` is the step in progress.
const steps = at => `<nav class="bk-steps" aria-label="Booking steps">${['Date', 'Time', 'Details'].map((label, i) => {
  const n = i + 1, state = n < at ? 'done' : n === at ? 'on' : '';
  return `<div class="bk-step ${state}" ${n === at ? 'aria-current="step"' : ''}><b>${n < at ? I.check : n}</b><span>${label}</span></div>`;
}).join('')}</nav>`;

const aside = (et, extra = '') => `
<aside class="bk-side">
  <div class="bk-host"><img src="${HOST_PHOTO}" alt="" width="48" height="48"><div><strong>${esc(et.host_name)}</strong><span>${BRAND}</span></div></div>
  <h1>${esc(et.name)}</h1>
  <p class="bk-fact">${I.clock}${et.duration_min} minutes</p>
  <p class="bk-fact">${I.video}${esc(et.location || et.how)}${et.location ? '. The joining link is in your confirmation email.' : ''}</p>
  <p class="bk-fact">${I.globe}Times are shown in your time zone</p>
  ${extra}
  ${et.description ? `<p class="bk-desc">${esc(et.description)}</p>` : ''}
  <p class="bk-note">No time that works? Email <a href="mailto:${INBOX}">${INBOX}</a> or WhatsApp <a href="https://wa.me/919856755000" target="_blank" rel="noopener">+91 98567 55000</a> with the role you are hiring for.</p>
</aside>`;

function message(title, text, link = ['#/', 'See available times']) {
  root.innerHTML = `<div class="bk-card bk-msg bk-fade"><h1>${esc(title)}</h1><p>${esc(text)}</p>${link ? `<a class="bk-btn bk-btn-primary" href="${link[0]}">${link[1]}</a>` : ''}</div>`;
}

// ── List of meetings (usually just the one, so it opens straight away) ──────
async function viewList() {
  const { event_types: types } = await api('book?brand=brc');
  document.title = `Book a call | ${BRAND}`;
  if (!types.length) return message('No times can be booked right now', `Please email ${INBOX} or call +91 98567 55000 and we will set up a time.`, null);
  if (types.length === 1) return viewBook(types[0].slug);
  root.innerHTML = `<div class="bk-card bk-list bk-fade"><h1>Book a call with ${BRAND}</h1><p class="bk-sub">Choose a meeting to see the free times.</p>
    ${types.map(t => `<a class="bk-type" href="#/${esc(t.slug)}"><strong>${esc(t.name)}</strong><span>${t.duration_min} min · ${esc(t.location)} · ${esc(t.host_name)}</span></a>`).join('')}</div>`;
}

// ── Pick a day and time, then the form ──────────────────────────────────────
async function viewBook(slug, tag) {
  const reschedule = /^r-[a-f0-9]+$/.test(tag || '') ? tag.slice(2) : '';
  const { event_type: et, slots } = await api(`book/${slug}/slots${reschedule ? '?reschedule=' + reschedule : ''}`);
  if (et.brand !== 'brc') throw new Error(`This meeting cannot be booked here. Please email ${INBOX}.`);
  const old = reschedule ? (await api('booking/' + reschedule)).booking : null;
  document.title = `${et.name} | ${BRAND}`;
  const state = { tz: localZone, day: '', slot: '', month: null };
  const oldNote = () => (old ? `<p class="bk-old">Currently booked for<br><s>${esc(longDay(old.starts_at, state.tz))}, ${esc(timeText(old.starts_at, state.tz))}</s></p>` : '');

  const draw = (animate = true) => {
    const byDay = {};
    slots.forEach(s => { (byDay[dayKey(s, state.tz)] = byDay[dayKey(s, state.tz)] || []).push(s); });
    const days = Object.keys(byDay).sort();
    const today = dayKey(new Date().toISOString(), state.tz);
    if (!state.month) state.month = (days[0] || today).slice(0, 7);
    const [y, m] = state.month.split('-').map(Number);
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;   // weeks start on Monday
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [...Array(lead).fill(''), ...Array.from({ length: count }, (_, i) => `${state.month}-${String(i + 1).padStart(2, '0')}`)];
    const months = [...new Set(days.map(d => d.slice(0, 7)))];
    const step = d => { const n = new Date(Date.UTC(y, m - 1 + d, 1)); return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`; };
    const dayPicked = state.day && byDay[state.day];

    root.innerHTML = `<div class="bk-card ${animate ? 'bk-fade' : ''}">${steps(dayPicked ? 2 : 1)}<div class="bk-pick">
${aside(et, oldNote())}
<section class="bk-cal" aria-label="Choose a date">
  <h2>${old ? 'Choose a new date' : 'Select a date'}</h2>
  ${slots.length ? '' : `<p class="bk-notice">There are no free times in the coming days. Please check again soon, or email ${INBOX}.</p>`}
  <div class="bk-month"><button type="button" class="bk-nav" data-month="${step(-1)}" ${months.some(x => x < state.month) ? '' : 'disabled'} aria-label="Previous month">${I.left}</button>
    <strong aria-live="polite">${MONTHS[m - 1]} ${y}</strong>
    <button type="button" class="bk-nav" data-month="${step(1)}" ${months.some(x => x > state.month) ? '' : 'disabled'} aria-label="Next month">${I.right}</button></div>
  <div class="bk-grid" role="grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="bk-dow">${d}</span>`).join('')}
    ${cells.map(d => (!d ? '<span></span>' : byDay[d]
      ? `<button type="button" class="bk-day ${state.day === d ? 'on' : ''} ${d === today ? 'today' : ''}" data-day="${d}" aria-label="${esc(longDay(byDay[d][0], state.tz))}, ${byDay[d].length} free times" aria-pressed="${state.day === d}">${Number(d.slice(8))}</button>`
      : `<span class="bk-day off ${d === today ? 'today' : ''}">${Number(d.slice(8))}</span>`)).join('')}</div>
  <div class="bk-legend"><span><i></i>Available</span><span><i class="sel"></i>Selected</span></div>
  <div class="bk-tz"><label class="bk-hint" for="bk-tz" style="display:block;margin-bottom:6px;font-weight:600">Time zone</label><div class="bk-tz-row">${I.globe}<select id="bk-tz">${ZONES.map(z => `<option value="${z}" ${z === state.tz ? 'selected' : ''}>${esc(zoneLabel(z))} (${esc(timeText(new Date().toISOString(), z))})</option>`).join('')}</select></div></div>
</section>
<section class="bk-times" aria-label="Choose a time">
  ${dayPicked ? `<h3>${esc(longDay(byDay[state.day][0], state.tz))}</h3><p class="bk-count">${byDay[state.day].length} free times · ${et.duration_min} min each</p>
  <div class="bk-slots">${byDay[state.day].map(s => `<div class="bk-slot-row ${state.slot === s ? 'sel' : ''}"><button type="button" class="bk-slot ${state.slot === s ? 'sel' : ''}" data-slot="${s}" aria-pressed="${state.slot === s}">${esc(timeText(s, state.tz))}</button>${state.slot === s ? '<button type="button" class="bk-next" id="bk-next">Next</button>' : ''}</div>`).join('')}</div>`
  : `<div class="bk-empty">${I.cursor}<br>Pick a date to see the free times.${slots.length ? `<br><span style="font-size:12.5px">Next free: ${esc(shortDay(slots[0], state.tz))}</span>` : ''}</div>`}
</section>
</div></div>`;
    $$('[data-month]').forEach(b => { b.onclick = () => { state.month = b.dataset.month; state.day = ''; state.slot = ''; draw(false); }; });
    $$('[data-day]').forEach(b => { b.onclick = () => { state.day = b.dataset.day; state.slot = ''; draw(false); const t = $('.bk-times'); if (t && !EMBED && innerWidth < 1025) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
    $$('[data-slot]').forEach(b => { b.onclick = () => { if (state.slot === b.dataset.slot) return form(); state.slot = b.dataset.slot; draw(false); const n = $('#bk-next'); if (n) n.focus({ preventScroll: true }); }; });
    const next = $('#bk-next'); if (next) next.onclick = form;
    $('#bk-tz').onchange = e => { state.tz = e.target.value; state.day = ''; state.slot = ''; state.month = null; draw(false); };
    tellParent(false);
  };

  const question = (q, i) => `<div class="bk-field"><label for="q-${i}">${esc(q.label)} ${q.required ? '<i>*</i>' : '<em>(optional)</em>'}</label>${i < 2 && q.required
    ? `<input id="q-${i}" data-answer="${i}" type="text" maxlength="600" required>` : `<textarea id="q-${i}" data-answer="${i}" maxlength="600" ${q.required ? 'required' : ''}></textarea>`}</div>`;

  function form() {
    root.innerHTML = `<div class="bk-card bk-fade">${steps(3)}<div class="bk-pick">
${aside(et, `<p class="bk-when"><strong>${esc(timeText(state.slot, state.tz))}</strong>${esc(longDay(state.slot, state.tz))}<br><span>${esc(zoneLabel(state.tz))} · ${et.duration_min} min</span></p>` + oldNote())}
<form class="bk-form" id="bk-form" novalidate>
  <button type="button" class="bk-back" id="bk-back">${I.back}Choose another time</button>
  <h2>${old ? 'Confirm the new time' : 'Your details'}</h2>
  <div class="bk-row2">
    <div class="bk-field"><label for="f-name">Name <i>*</i></label><input id="f-name" name="name" type="text" maxlength="100" autocomplete="name" required value="${esc(old ? old.name : '')}"></div>
    <div class="bk-field"><label for="f-phone">Phone or WhatsApp <em>(optional)</em></label><input id="f-phone" name="phone" type="tel" maxlength="30" autocomplete="tel" inputmode="tel"></div>
  </div>
  <div class="bk-field"><label for="f-email">Work email <i>*</i></label><input id="f-email" name="email" type="email" maxlength="160" autocomplete="email" inputmode="email" required><span class="bk-hint">The confirmation and joining link are sent here.</span></div>
  ${et.questions.map(question).join('')}
  <div class="bk-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="bk-errmsg" id="bk-err" role="alert"></div>
  <button class="bk-btn bk-btn-primary bk-btn-block" type="submit">${old ? 'Move my call' : 'Confirm call'}</button>
  <p class="bk-hint">By confirming you agree that ${BRAND} may use these details to arrange this call. See our <a href="/privacy-policy">privacy policy</a>.</p>
</form></div></div>`;
    if (EMBED) tellParent(true); else window.scrollTo({ top: root.offsetTop - 90, behavior: 'smooth' });
    $('#f-name').focus({ preventScroll: true });
    $('#bk-back').onclick = () => draw();
    $('#bk-form').onsubmit = async e => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target);
      const data = Object.fromEntries(new FormData(e.target));
      const answers = et.questions.map((q, i) => { const el = $(`[data-answer="${i}"]`, e.target); return el ? el.value.trim() : ''; });
      const missing = et.questions.findIndex((q, i) => q.required && !answers[i]);
      $('#bk-err').textContent = '';
      if (!data.name.trim()) return ($('#bk-err').textContent = 'Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) return ($('#bk-err').textContent = 'Please enter a valid email address. The confirmation goes there.');
      if (missing >= 0) return ($('#bk-err').textContent = `Please answer: ${et.questions[missing].label}`);
      btn.disabled = true;
      btn.textContent = 'Booking…';
      try {
        const result = await api('book/' + slug, { name: data.name, email: data.email, phone: data.phone, website: data.website, start: state.slot, tz: state.tz,
          tag: reschedule ? '' : tag || '', reschedule: reschedule || undefined, answers });
        if (window.gtag) gtag('event', 'call_booked', { page: location.pathname });
        location.hash = '#/booking/' + result.token + '/done';
      } catch (err) {
        $('#bk-err').textContent = err.message;
        btn.disabled = false;
        btn.textContent = old ? 'Move my call' : 'Confirm call';
        if (err.status === 409) { const i = slots.indexOf(state.slot); if (i >= 0) slots.splice(i, 1); }
        tellParent(false);
      }
    };
  }
  draw();
}

// ── One booking: confirmation, change, cancel ───────────────────────────────
async function viewBooking(token, done) {
  const { booking: b } = await api('booking/' + token);
  document.title = `${b.event_name} | ${BRAND}`;
  const past = new Date(b.starts_at).getTime() < Date.now();
  const live = b.status === 'scheduled' && !past;
  const row = (ic, label, value) => `<div>${ic}<div><dt>${label}</dt><dd>${value}</dd></div></div>`;
  root.innerHTML = `<div class="bk-card bk-done bk-fade">
  ${live ? `<b class="bk-tick"><span>${I.check}</span></b>` : ''}
  <h1>${b.status === 'cancelled' ? 'This call was cancelled' : past ? 'This call has passed' : done ? 'You are booked' : 'Your call'}</h1>
  <p class="bk-sub">${live ? `A confirmation has been emailed to you${done ? '' : ' earlier'}. ${b.location ? '' : 'The joining link follows before the call.'}` : ''}</p>
  <dl class="bk-dl">
    ${row(I.user, 'Meeting', `${esc(b.event_name)} with ${esc(b.host_name)}, ${BRAND}`)}
    ${row(I.cal, 'When', `${esc(longDay(b.starts_at, localZone))}<br>${esc(timeText(b.starts_at, localZone))} to ${esc(timeText(b.ends_at, localZone))} <span style="color:var(--ink-2)">· ${esc(zoneLabel(localZone))}</span>`)}
    ${row(I.video, 'How', esc(b.how))}
    ${b.location ? row(I.link, esc(b.where_label), /^https:\/\//.test(b.location) ? `<a href="${esc(b.location)}" target="_blank" rel="noopener noreferrer">${esc(b.location)}</a>` : esc(b.location)) : ''}
  </dl>
  ${live ? `<div class="bk-actions"><a class="bk-btn bk-btn-primary" href="${esc(b.calendar)}" target="_blank" rel="noopener noreferrer">${I.gcal}Add to Google Calendar</a>
    <a class="bk-btn" href="${API}booking/${esc(b.token)}/ics">${I.download}Download invite (.ics)</a></div>
  <div class="bk-actions"><a class="bk-btn" href="#/${esc(b.slug)}/r-${esc(b.token)}">Reschedule</a><button class="bk-btn bk-btn-danger" id="bk-cancel">Cancel call</button></div>
  <form id="bk-cform" hidden><div class="bk-field"><label for="bk-reason">Reason for cancelling <em>(optional)</em></label><textarea id="bk-reason" maxlength="300" style="min-height:70px"></textarea></div>
    <div class="bk-errmsg" id="bk-err" role="alert"></div><div class="bk-actions" style="justify-content:flex-start"><button class="bk-btn bk-btn-primary" type="submit">Yes, cancel this call</button><button class="bk-btn" type="button" id="bk-keep">Keep it</button></div></form>`
    : `<a class="bk-btn bk-btn-primary" href="#/${esc(b.slug)}">Book another time</a>`}
</div>`;
  tellParent(true);
  if (!live) return;
  $('#bk-cancel').onclick = () => { $('#bk-cform').hidden = false; $('#bk-reason').focus(); tellParent(false); };
  $('#bk-keep').onclick = () => { $('#bk-cform').hidden = true; tellParent(false); };
  $('#bk-cform').onsubmit = async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    try { await api(`booking/${token}/cancel`, { reason: $('#bk-reason').value }); viewBooking(token); }
    catch (err) { $('#bk-err').textContent = err.message; btn.disabled = false; }
  };
}

async function route() {
  document.body.classList.add('bk-loading');
  root.setAttribute('aria-busy', 'true');
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (parts[0] === 'booking' && /^[a-f0-9]+$/.test(parts[1] || '')) await viewBooking(parts[1], parts[2] === 'done');
    else if (/^[a-z0-9-]+$/.test(parts[0] || '')) await viewBook(parts[0], parts[1]);
    else await viewList();
  } catch (err) {
    message('This page is not available', err.message);
    tellParent(false);
  }
  document.body.classList.remove('bk-loading');
  root.setAttribute('aria-busy', 'false');
  // A shorter view after a long one (the confirmation after the form) must not leave the reader below the card.
  if (!EMBED && window.scrollY > root.offsetTop - 90) window.scrollTo({ top: root.offsetTop - 90 });
}

window.addEventListener('hashchange', route);
window.addEventListener('resize', () => tellParent(false));
route();
})();
