/**
 * Portfolio contact form — nothing sensitive in Portfolio.html.
 *
 * Configure ONE of these in Vercel → Environment Variables:
 *
 *   WEB3FORMS_ACCESS_KEY  — recommended: https://web3forms.com (free, no captcha for API)
 *   RESEND_API_KEY        — https://resend.com (also set CONTACT_TO_EMAIL or use default below)
 *
 * Optional: CONTACT_TO_EMAIL — recipient when using Resend only (Web3Forms uses your form’s email).
 * Optional: RESEND_FROM_EMAIL — verified sender for Resend.
 */

const DEFAULT_INBOX = 'preetjassgill11@gmail.com';

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
  }
  if (!body || typeof body !== 'object') {
    body = {};
  }

  const name = String(body.name || '')
    .trim()
    .slice(0, 200);
  const email = String(body.email || '')
    .trim()
    .slice(0, 320);
  const message = String(body.message || '')
    .trim()
    .slice(0, 8000);
  const hp = String(body._hp || '').trim();

  if (hp) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Invalid request' }));
  }

  if (!name || !email || !message) {
    res.statusCode = 400;
    return res.end(
      JSON.stringify({ ok: false, error: 'Name, email, and message are required.' })
    );
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Invalid email address.' }));
  }

  const resendKey = process.env.RESEND_API_KEY;
  const web3Key = process.env.WEB3FORMS_ACCESS_KEY;
  const recipient = (process.env.CONTACT_TO_EMAIL || DEFAULT_INBOX).trim();
  const from =
    process.env.RESEND_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>';

  if (resendKey) {
    return sendViaResend(res, {
      apiKey: resendKey,
      from,
      to: recipient,
      name,
      email,
      message,
    });
  }

  if (web3Key) {
    return sendViaWeb3Forms(res, {
      accessKey: web3Key,
      name,
      email,
      message,
    });
  }

  res.statusCode = 503;
  return res.end(
    JSON.stringify({
      ok: false,
      error:
        'Add WEB3FORMS_ACCESS_KEY in Vercel (free: web3forms.com) or RESEND_API_KEY. FormSubmit was removed — it blocks most server-side sends.',
    })
  );
};

async function sendViaResend(res, { apiKey, from, to, name, email, message }) {
  const html = `
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Reply to:</strong> ${escapeHtml(email)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;
  const text = `Name: ${name}\nReply to: ${email}\n\n${message}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Portfolio contact: ${name.slice(0, 80)}`,
        html,
        text,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      res.statusCode = 502;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'Could not send message. Try again later.',
        })
      );
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, id: data.id || null }));
  } catch {
    res.statusCode = 502;
    return res.end(
      JSON.stringify({ ok: false, error: 'Could not send message. Try again later.' })
    );
  }
}

async function sendViaWeb3Forms(res, { accessKey, name, email, message }) {
  try {
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `Portfolio contact: ${name.slice(0, 80)}`,
        name,
        email,
        message,
        from_name: name,
        replyto: email,
      }),
    });

    const data = await r.json().catch(() => ({}));
    const ok = r.ok && data.success === true;

    if (!ok) {
      res.statusCode = 502;
      return res.end(
        JSON.stringify({
          ok: false,
          error:
            typeof data.message === 'string' && data.message.length < 120
              ? data.message
              : 'Could not send message. Check WEB3FORMS_ACCESS_KEY in Vercel.',
        })
      );
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, id: null }));
  } catch {
    res.statusCode = 502;
    return res.end(
      JSON.stringify({ ok: false, error: 'Could not send message. Try again later.' })
    );
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
