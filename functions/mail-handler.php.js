const TO = 'hire@boardroomcxo.com';
const FROM = 'Boardroom CXO Website <no-reply@boardroomcxo.com>';

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

  if (formType === 'newsletter') {
    const email = cleanField(form.get('email'));
    if (!isValidEmail(email)) {
      return json({ success: false, message: 'Invalid email' }, 400);
    }
    subject = 'New Newsletter Signup - Boardroom CXO';
    body = `New newsletter signup:\n\nEmail: ${email}\n`;
    replyTo = email;
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

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: replyTo,
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    return json({ success: false, message: 'Mail could not be sent' }, 500);
  }

  return json({ success: true });
}

export async function onRequestGet() {
  return json({ success: false, message: 'Method not allowed' }, 405);
}
