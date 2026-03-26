/**
 * GET /api/visit-stats?secret=VISITS_ADMIN_SECRET
 * Returns { ok, total, configured } — keep VISITS_ADMIN_SECRET long and private.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  const adminSecret = (process.env.VISITS_ADMIN_SECRET || '').trim();
  let qSecret = '';
  if (req.query && typeof req.query.secret === 'string') {
    qSecret = req.query.secret;
  } else if (typeof req.url === 'string') {
    const i = req.url.indexOf('?');
    if (i !== -1) {
      qSecret = new URLSearchParams(req.url.slice(i + 1)).get('secret') || '';
    }
  }

  if (!adminSecret || qSecret !== adminSecret) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'Forbidden' }));
  }

  const base = (process.env.PORTFOLIO_SUPABASE_URL || '').replace(/\/$/, '');
  const key = (process.env.PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!base || !key) {
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        ok: true,
        configured: false,
        total: null,
        message: 'Set PORTFOLIO_SUPABASE_URL and PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY',
      })
    );
  }

  try {
    const r = await fetch(`${base}/rest/v1/portfolio_visits?select=id`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });

    const cr = r.headers.get('content-range') || '';
    const m = cr.match(/\/(\d+)\s*$/);
    const total = m ? parseInt(m[1], 10) : 0;

    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        ok: true,
        configured: true,
        total,
      })
    );
  } catch {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'Count failed' }));
  }
};
