// Old form address, kept only as a forwarder (3 Nov 2026).
// The site's forms now post JSON straight to the Accounting Baba portal (see script.js), which emails
// hire@boardroomcxo.com through ZeptoMail. This used to send through Resend, which had stopped working, so every
// submission was lost. A browser holding an older copy of script.js (cached for up to a day) still posts form data
// here, so it is turned into the same JSON and passed on, instead of being dropped.
const PORTAL = 'https://accountingbaba.com/api/portal/public/enquiry/boardroom';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Workers runtime has no Buffer; encode in chunks to avoid call-stack blowups on large files.
async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
  const { request } = context;
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ success: false, message: 'Invalid form submission' }, 400);
  }

  const body = { page: new URL(request.headers.get('Referer') || 'https://boardroomcxo.com/').pathname };
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') { body[key] = value; continue; }
    if (!value || !value.size) continue;
    if (value.size > MAX_ATTACHMENT_BYTES) {
      return json({ success: false, message: 'Photo is too large (max 8MB). Please use a smaller file.' }, 400);
    }
    body[key] = { name: value.name || 'photo.jpg', type: value.type || 'image/jpeg', content: await fileToBase64(value) };
  }

  try {
    const res = await fetch(PORTAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://boardroomcxo.com' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return json({ success: true });
    return json({ success: false, message: data.error || 'Mail could not be sent' }, res.status >= 400 ? res.status : 500);
  } catch {
    return json({ success: false, message: 'Mail could not be sent' }, 502);
  }
}

export async function onRequestGet() {
  return json({ success: false, message: 'Method not allowed' }, 405);
}
