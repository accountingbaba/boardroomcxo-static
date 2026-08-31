const TO = 'hire@boardroomcxo.com';
const FROM = 'Boardroom CXO Website <no-reply@boardroomcxo.com>';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cleanField(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Workers runtime has no Buffer; encode in chunks to avoid call-stack blowups
// on large files.
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
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ success: false, message: 'Invalid form submission' }, 400);
  }

  // Honeypot spam check — silently accept so bots don't learn it's blocked
  if (form.get('botcheck')) {
    return json({ success: true });
  }

  const formType = cleanField(form.get('form_type')) || 'contact';

  let subject, body, replyTo;
  let attachments;

  if (formType === 'newsletter') {
    const email = cleanField(form.get('email'));
    if (!isValidEmail(email)) {
      return json({ success: false, message: 'Invalid email' }, 400);
    }
    subject = 'New Newsletter Signup - Boardroom CXO';
    body = `New newsletter signup:\n\nEmail: ${email}\n`;
    replyTo = email;
  } else if (formType === 'joining_announcement') {
    const fullName = cleanField(form.get('full_name'));
    const title = cleanField(form.get('title'));
    const company = cleanField(form.get('company'));
    const mobile = cleanField(form.get('mobile'));
    const email = cleanField(form.get('email'));
    const paymentRef = cleanField(form.get('payment_ref'));
    const photo = form.get('photo');

    if (!fullName || !title || !company || !mobile || !isValidEmail(email) || !paymentRef) {
      return json({ success: false, message: 'Missing required fields' }, 400);
    }

    subject = 'New Joining Announcement Order - Boardroom CXO';
    body = 'New Joining Announcement order:\n\n'
      + `Name: ${fullName}\n`
      + `New Title: ${title}\n`
      + `Company: ${company}\n`
      + `Mobile: ${mobile}\n`
      + `Email: ${email}\n`
      + `Payment Reference: ${paymentRef}\n\n`
      + 'Reminder: verify this payment reference in the Razorpay dashboard before publishing.\n';
    replyTo = email;

    if (photo && typeof photo === 'object' && photo.size > 0) {
      if (photo.size > MAX_ATTACHMENT_BYTES) {
        return json({ success: false, message: 'Photo is too large (max 8MB). Please use a smaller file.' }, 400);
      }
      attachments = [{
        filename: photo.name || 'photo.jpg',
        content: await fileToBase64(photo),
      }];
    }
  } else {
    const firstName = cleanField(form.get('first_name'));
    const lastName = cleanField(form.get('last_name'));
    const email = cleanField(form.get('email'));
    const phone = cleanField(form.get('phone'));
    const company = cleanField(form.get('company'));
    const role = cleanField(form.get('role'));
    const service = cleanField(form.get('service'));
    const message = String(form.get('message') ?? '').trim();

    if (!firstName || !lastName || !isValidEmail(email) || !company || !service) {
      return json({ success: false, message: 'Missing required fields' }, 400);
    }

    subject = 'New Contact Form Submission - Boardroom CXO';
    body = 'New contact form submission:\n\n'
      + `Name: ${firstName} ${lastName}\n`
      + `Email: ${email}\n`
      + `Phone: ${phone}\n`
      + `Company: ${company}\n`
      + `Role: ${role}\n`
      + `Looking for: ${service}\n\n`
      + `Message:\n${message}\n`;
    replyTo = email;
  }

  if (!env.RESEND_API_KEY) {
    return json({ success: false, message: 'Mail could not be sent' }, 500);
  }

  const payload = {
    from: FROM,
    to: [TO],
    reply_to: replyTo,
    subject,
    text: body,
  };
  if (attachments) payload.attachments = attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return json({ success: false, message: 'Mail could not be sent' }, 500);
  }

  return json({ success: true });
}

export async function onRequestGet() {
  return json({ success: false, message: 'Method not allowed' }, 405);
}
