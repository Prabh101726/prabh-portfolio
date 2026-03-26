/**
 * Anonymous visit counter — one row per page load (not unique visitors).
 *
 * 1) In Supabase: SQL Editor → run:
 *
 *    create table if not exists portfolio_visits (
 *      id uuid primary key default gen_random_uuid(),
 *      created_at timestamptz not null default now()
 *    );
 *
 *    (Optional) RLS on — service role used here bypasses RLS for inserts.
 *
 * 2) Vercel → Environment Variables (this project):
 *    PORTFOLIO_SUPABASE_URL     = https://xxxx.supabase.co
 *    PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY = eyJ... (service_role, never expose to browser)
 *
 * If those are missing, POST /api/visit returns 204 and does nothing (site still works).
 *
 * View totals: GET /api/visit-stats?secret=YOUR_SECRET after setting VISITS_ADMIN_SECRET in Vercel.
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  const base = (process.env.PORTFOLIO_SUPABASE_URL || '').replace(/\/$/, '');
  const key = (process.env.PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!base || !key) {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const r = await fetch(`${base}/rest/v1/portfolio_visits`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: '{}',
    });

    res.statusCode = r.ok ? 204 : 500;
    return res.end();
  } catch {
    res.statusCode = 500;
    return res.end();
  }
};
