/**
 * Portfolio contact — mail is sent only from this server (not exposed in HTML).
 *
 * Use ONE of these in Vercel → Environment Variables (then redeploy):
 *
 *   Gmail (simple if you use Google Mail)
 *     GMAIL_USER              — full address, e.g. preetjassgill11@gmail.com
 *     GMAIL_APP_PASSWORD      — 16-char App Password (Google Account → Security → 2-Step → App passwords)
 *     CONTACT_TO_EMAIL        — optional; where to deliver (defaults to GMAIL_USER)
 *
 *   Resend
 *     RESEND_API_KEY
 *     CONTACT_TO_EMAIL        — inbox (optional default in code for Resend only)
 *     RESEND_FROM_EMAIL       — optional verified sender
 *
 * Web3Forms from Vercel serverless is not supported on the free plan (their docs: paid + IP allowlist).
 */

const nodemailer = require('nodemailer');

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

  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const gmailUser = (process.env.GMAIL_USER || '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  const from =
    process.env.RESEND_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>';

  if (resendKey) {
    return sendViaResend(res, {
      apiKey: resendKey,
      from,
      to: process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_INBOX,
      name,
      email,
      message,
    });
  }

  if (gmailUser && gmailPass) {
    const to = (process.env.CONTACT_TO_EMAIL || gmailUser).trim();
    return sendViaGmail(res, {
      user: gmailUser,
      pass: gmailPass,
      to,
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
        'Mail not configured. In Vercel add GMAIL_USER + GMAIL_APP_PASSWORD (Gmail), or RESEND_API_KEY. Redeploy after saving.',
    })
  );
};

async function sendViaGmail(res, { user, pass, to, name, email, message }) {
  const html = `
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Reply to:</strong> ${escapeHtml(email)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Portfolio contact" <${user}>`,
      to,
      replyTo: email,
      subject: `Portfolio contact: ${name.slice(0, 80)}`,
      text: `Name: ${name}\nReply to: ${email}\n\n${message}`,
      html,
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, id: null }));
  } catch (err) {
    console.error('Gmail send error:', err.message);
    res.statusCode = 502;
    return res.end(
      JSON.stringify({
        ok: false,
        error:
          'Could not send email. Check GMAIL_USER / GMAIL_APP_PASSWORD in Vercel and that 2-Step Verification + App Password are enabled.',
      })
    );
  }
}

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

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
