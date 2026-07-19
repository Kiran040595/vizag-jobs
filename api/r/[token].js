const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function text(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(message);
}

function wantsHtmlPage(req) {
  if (String(req.query?.dl || '') === '1') return false;
  const accept = String(req.headers.accept || '').toLowerCase();
  // Excel / curl / download managers often omit HTML preference.
  if (!accept || accept === '*/*') return false;
  return accept.includes('text/html');
}

function downloadPageHtml(token) {
  const fileUrl = `/r/${encodeURIComponent(token)}?dl=1`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Download resume | Vizag Jobs</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; background: #f8fafc; color: #0f172a; }
    main { max-width: 28rem; margin: 0 auto; padding: 3rem 1.25rem; text-align: center; }
    h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
    p { color: #475569; line-height: 1.5; margin: 0 0 1.5rem; }
    a { display: inline-block; background: #06b6d4; color: #0f172a; font-weight: 700; text-decoration: none; border-radius: 0.75rem; padding: 0.85rem 1.25rem; }
    a:hover { background: #22d3ee; }
  </style>
</head>
<body>
  <main>
    <h1>Your resume is ready</h1>
    <p>If the download does not start automatically, use the button below.</p>
    <a id="download" href="${escapeHtml(fileUrl)}">Download resume</a>
  </main>
  <script>
    setTimeout(function () {
      window.location.replace(${JSON.stringify(fileUrl)});
    }, 80);
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    text(res, 405, 'Method not allowed.');
    return;
  }

  const token = String(req.query?.token || '').trim();
  if (!UUID_RE.test(token)) {
    text(res, 400, 'Invalid resume link.');
    return;
  }

  if (wantsHtmlPage(req)) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(downloadPageHtml(token));
    return;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (!supabaseUrl) {
    text(res, 500, 'Resume sharing is not configured.');
    return;
  }

  const upstreamUrl = `${supabaseUrl}/functions/v1/resume-share?t=${encodeURIComponent(token)}`;
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
      redirect: 'follow',
    });
  } catch {
    text(res, 502, 'Could not reach resume service.');
    return;
  }

  if (!upstream.ok) {
    const message = (await upstream.text().catch(() => '')) || 'Resume not available.';
    text(res, upstream.status || 404, message);
    return;
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentDisposition =
    upstream.headers.get('content-disposition') || 'attachment; filename="resume.pdf"';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDisposition);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);
    res.end();
    return;
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Length', String(buffer.length));
  res.end(buffer);
}
