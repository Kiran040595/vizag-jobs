import { downloadR2Object, getR2Config } from '../_lib/r2.js';
import { isR2ResumePath, toR2ObjectKey } from '../_lib/resumeStoragePath.js';
import { createServiceClient } from '../_lib/supabaseAuth.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const fileNameFromPath = (resumePath) => {
  const key = toR2ObjectKey(resumePath);
  const base = key.split('/').pop() || 'resume';
  return base.replace(/[^\w.\-]+/g, '_') || 'resume';
};

const contentTypeForFileName = (fileName) => {
  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  return CONTENT_TYPES[extension] || 'application/octet-stream';
};

const contentDisposition = (fileName) => {
  const safe = String(fileName || 'resume').replace(/"/g, '');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

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
    p { color: #475569; line-height: 1.5; margin: 0 0 1.25rem; }
    .status { min-height: 1.25rem; font-size: 0.95rem; color: #0e7490; margin-bottom: 1.25rem; }
    .error { color: #b91c1c; }
    button, a.button {
      display: inline-block; border: 0; cursor: pointer;
      background: #06b6d4; color: #0f172a; font-weight: 700; font-size: 1rem;
      text-decoration: none; border-radius: 0.75rem; padding: 0.85rem 1.25rem;
    }
    button:hover, a.button:hover { background: #22d3ee; }
    button:disabled { opacity: 0.7; cursor: wait; }
  </style>
</head>
<body>
  <main>
    <h1>Your resume is ready</h1>
    <p>Tap the button if the file does not download automatically.</p>
    <p id="status" class="status">Starting download…</p>
    <p>
      <button id="download" type="button">Download resume</button>
    </p>
    <p style="margin-top:1.5rem">
      <a class="button" id="fallback" href="${escapeHtml(fileUrl)}">Open file directly</a>
    </p>
  </main>
  <script>
    (function () {
      var fileUrl = ${JSON.stringify(fileUrl)};
      var statusEl = document.getElementById('status');
      var button = document.getElementById('download');

      function setStatus(message, isError) {
        statusEl.textContent = message;
        statusEl.className = isError ? 'status error' : 'status';
      }

      function filenameFromDisposition(value) {
        if (!value) return 'resume.pdf';
        var utf = /filename\\*=UTF-8''([^;]+)/i.exec(value);
        if (utf && utf[1]) {
          try { return decodeURIComponent(utf[1].trim()); } catch (e) {}
        }
        var plain = /filename=\"?([^\";]+)\"?/i.exec(value);
        return (plain && plain[1]) ? plain[1].trim() : 'resume.pdf';
      }

      async function downloadResume() {
        button.disabled = true;
        setStatus('Starting download…', false);
        try {
          var response = await fetch(fileUrl, {
            credentials: 'omit',
            cache: 'no-store',
            headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
          });
          if (!response.ok) {
            throw new Error('Download failed (' + response.status + ').');
          }
          var blob = await response.blob();
          if (!blob || !blob.size) {
            throw new Error('The resume file was empty.');
          }
          var objectUrl = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = objectUrl;
          link.download = filenameFromDisposition(response.headers.get('Content-Disposition'));
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 2000);
          setStatus('Download started. Check your Downloads folder.', false);
        } catch (error) {
          setStatus((error && error.message) || 'Could not download. Use “Open file directly”.', true);
        } finally {
          button.disabled = false;
        }
      }

      button.addEventListener('click', function () { downloadResume(); });
      downloadResume();
    })();
  </script>
</body>
</html>`;
}

async function serveR2Resume(req, res, resumePath) {
  if (!getR2Config()) {
    return false;
  }

  const fileName = fileNameFromPath(resumePath);
  const downloaded = await downloadR2Object(toR2ObjectKey(resumePath));

  res.statusCode = 200;
  res.setHeader('Content-Type', downloaded.contentType || contentTypeForFileName(fileName));
  res.setHeader('Content-Disposition', contentDisposition(fileName));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', String(downloaded.contentLength));

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  res.end(downloaded.body);
  return true;
}

async function proxyResumeFile(req, res, token) {
  // Prefer serving R2 resumes from Vercel when credentials are present.
  const serviceClient = createServiceClient();
  if (serviceClient && getR2Config()) {
    try {
      const { data: application, error } = await serviceClient
        .from('job_applications')
        .select('resume_path')
        .eq('resume_share_token', token)
        .maybeSingle();

      if (!error) {
        const resumePath = String(application?.resume_path || '').trim();
        if (resumePath && isR2ResumePath(resumePath)) {
          await serveR2Resume(req, res, resumePath);
          return;
        }
      }
    } catch (error) {
      console.error('local R2 resume serve failed:', error?.message || error);
      // Fall through to the edge function proxy.
    }
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
  const disposition =
    upstream.headers.get('content-disposition') || 'attachment; filename="resume.pdf"';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', disposition);
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

  // Always show an HTML download page for /r/:token.
  // Excel opens raw .docx/.pdf links itself and fails; the page forces a real browser download.
  if (String(req.query?.dl || '') !== '1') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(downloadPageHtml(token));
    return;
  }

  await proxyResumeFile(req, res, token);
}
