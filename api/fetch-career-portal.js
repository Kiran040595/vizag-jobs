import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { createServiceClient, requireUser } from './_lib/supabaseAuth.js';
import { discoverCompanyCareerPortal } from '../scripts/lib/career-portal-finder.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    let website = '';
    let companyName = '';
    let companyId = '';
    let shouldSave = false;

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      website = url.searchParams.get('website') || '';
      companyName = url.searchParams.get('companyName') || '';
      companyId = url.searchParams.get('companyId') || '';
    } else {
      const body = await readJsonBody(req);
      website = body.website || body.url || '';
      companyName = body.companyName || body.name || '';
      companyId = body.companyId || body.id || '';
      shouldSave = Boolean(body.save || body.autoSave);
    }

    website = String(website || '').trim();
    if (!website) {
      sendJson(res, 400, { ok: false, error: 'website parameter is required.' });
      return;
    }

    // Discover the live career portal from website
    const result = await discoverCompanyCareerPortal(website);

    if (!result.success || !result.careersUrl) {
      sendJson(res, 404, {
        ok: false,
        error: result.reason || 'No career portal found on the company website.',
        website,
      });
      return;
    }

    // If requested and admin token present, save to Supabase
    let savedToDb = false;
    if (shouldSave && (companyId || companyName)) {
      try {
        const auth = await requireUser(req);
        if (!auth.error) {
          const admin = createServiceClient();
          if (admin) {
            let updateQuery = admin.from('companies').update({
              careers_url: result.careersUrl,
              updated_at: new Date().toISOString(),
            });

            if (companyId) {
              updateQuery = updateQuery.eq('id', companyId);
            } else {
              updateQuery = updateQuery.eq('name', companyName);
            }

            const { error: dbErr } = await updateQuery;
            if (!dbErr) {
              savedToDb = true;
            }
          }
        }
      } catch (err) {
        console.warn('Could not auto-save to database:', err.message);
      }
    }

    sendJson(res, 200, {
      ok: true,
      website,
      careersUrl: result.careersUrl,
      method: result.method,
      score: result.score,
      text: result.text,
      savedToDb,
    });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Internal server error while discovering career portal.',
    });
  }
}
