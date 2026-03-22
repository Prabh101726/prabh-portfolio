/**
 * Portfolio contact form — inbox is server-side only (not exposed in Portfolio.html).
 *
 * Sending (first match wins):
 *   1) Resend — set RESEND_API_KEY (+ optional CONTACT_TO_EMAIL, RESEND_FROM_EMAIL)
 *   2) FormSubmit — no API key; uses CONTACT_TO_EMAIL or default inbox below
 *
 * Optional env: CONTACT_TO_EMAIL overrides the default recipient for both paths.
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

  const recipient = (process.env.CONTACT_TO_EMAIL || DEFAULT_INBOX).trim();
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>';

  if (apiKey) {
    return sendViaResend(res, { apiKey, from, to: recipient, name, email, message });
  }

  return sendViaFormSubmit(res, { recipient, name, email, message });
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

async function sendViaFormSubmit(res, { recipient, name, email, message }) {
  const url = `https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        message,
        _subject: `Portfolio contact: ${name.slice(0, 80)}`,
        _captcha: false,
        _template: 'table',
      }),
    });

    const data = await r.json().catch(() => ({}));
    const ok =
      r.ok && (data.success === true || data.success === 'true');

    if (!ok) {
      res.statusCode = 502;
      return res.end(
        JSON.stringify({
          ok: false,
          error:
            'Could not send message. If this is the first time, check the inbox for a FormSubmit activation link.',
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
