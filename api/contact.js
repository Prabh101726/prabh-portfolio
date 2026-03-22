/**
 * Portfolio contact form — recipient and API keys only in Vercel Environment Variables.
 *
 * Required (Vercel → Project → Settings → Environment Variables):
 *   CONTACT_TO_EMAIL   — inbox for submissions (e.g. preetjassgill11@gmail.com)
 *   RESEND_API_KEY     — from https://resend.com/api-keys
 *
 * Optional:
 *   RESEND_FROM_EMAIL  — verified sender, e.g. "Portfolio <mail@yourdomain.com>"
 *                        Defaults to Resend onboarding sender (see Resend docs for limits).
 */

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  const to = process.env.CONTACT_TO_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>';

  if (!to || !apiKey) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'Contact form is not configured. Set CONTACT_TO_EMAIL and RESEND_API_KEY on the server.',
      })
    );
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
};

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
