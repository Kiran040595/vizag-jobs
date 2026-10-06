/**
 * Robust Career Portal Discovery Engine.
 *
 * Given a company website, visits the site, parses navigation, links, and ATS references,
 * checks subdomain & standard path fallbacks, and discovers the actual live career portal URL.
 */

const KNOWN_ATS_DOMAINS = [
  'myworkdayjobs.com',
  'greenhouse.io',
  'lever.co',
  'smartrecruiters.com',
  'bamboohr.com',
  'workable.com',
  'darwinbox.in',
  'darwinbox.com',
  'keka.com',
  'recruitee.com',
  'freshteam.com',
  'ashbyhq.com',
  'zoho.com/recruit',
  'jobvite.com',
  'icims.com',
  'taleo.net',
  'rippling.com',
  'cornerstoneondemand.com',
  'phenom.com',
  'csod.com',
  'turbohire.co',
  'eightfold.ai',
];

const SOCIAL_OR_MEDIA_DOMAINS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'pinterest.com',
  'tiktok.com',
  'github.com',
  'reddit.com',
  'maps.google.com',
  'goo.gl',
  'wa.me',
  'whatsapp.com',
  't.me',
  'telegram.org',
  'play.google.com',
  'apps.apple.com',
];

const IRRELEVANT_PATH_TOKENS = [
  'privacy-policy',
  'privacy',
  'terms-and-conditions',
  'terms-of-service',
  'terms',
  'cookie-policy',
  'cookies',
  'disclaimer',
  'refund-policy',
  'cancellation',
  'login',
  'signin',
  'sign-in',
  'signup',
  'sign-up',
  'register',
  'cart',
  'checkout',
  'sitemap',
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Normalizes input URL.
 */
export function normalizeWebsiteUrl(rawUrl = '') {
  let url = String(rawUrl || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

/**
 * Extracts root clean domain name (e.g. "swiggy.com" from "https://www.swiggy.com").
 */
export function getCleanDomain(rawUrl = '') {
  try {
    const parsed = new URL(normalizeWebsiteUrl(rawUrl));
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Attempts to fetch HTML with fallback to http and alternative hostnames.
 */
export async function fetchHtmlWithFallback(targetUrl, timeoutMs = 6000) {
  const normalized = normalizeWebsiteUrl(targetUrl);
  if (!normalized) return null;

  let urlObj;
  try {
    urlObj = new URL(normalized);
  } catch {
    return null;
  }
  const host = urlObj.hostname;

  // Try list: 1) https original, 2) https swap www, 3) http original
  const candidateUrls = [normalized];
  if (host.startsWith('www.')) {
    candidateUrls.push(normalized.replace('www.', ''));
  } else {
    candidateUrls.push(normalized.replace('://', '://www.'));
  }
  if (normalized.startsWith('https://')) {
    candidateUrls.push(normalized.replace('https://', 'http://'));
  }

  for (const testUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (res.ok || (res.status >= 200 && res.status < 400)) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text') || contentType.includes('html') || !contentType) {
          const html = await res.text();
          if (html && html.length > 100) {
            return {
              html,
              finalUrl: res.url || testUrl,
              status: res.status,
            };
          }
        }
      }
    } catch {
      // Continue to next fallback
    }
  }

  return null;
}

/**
 * Validates whether a candidate career URL is live and responsive.
 */
export async function verifyCandidateUrl(candidateUrl, timeoutMs = 4000) {
  if (!candidateUrl) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(candidateUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if ((res.status >= 200 && res.status < 400) || res.status === 403) {
      return res.url || candidateUrl;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts and scores career portal candidates from website HTML.
 */
export function extractCareerLinksFromHtml(html, finalUrl) {
  if (!html || !finalUrl) return [];

  const candidates = [];
  const seenUrls = new Set();
  const siteHost = new URL(finalUrl).hostname.toLowerCase().replace(/^www\./, '');

  const linkRegex = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    const anchorBody = match[2];
    const text = anchorBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

    processCandidate(rawHref, text);
  }

  const attrRegex = /<a\b[^>]*(?:aria-label|title)=["']([^"']+)["'][^>]*href=["']([^"'#][^"']*)["'][^>]*>/gi;
  while ((match = attrRegex.exec(html)) !== null) {
    const attrText = match[1].trim().toLowerCase();
    const rawHref = match[2].trim();
    processCandidate(rawHref, attrText);
  }

  function processCandidate(rawHref, text) {
    if (!rawHref) return;

    const lowerHref = rawHref.toLowerCase();
    if (
      lowerHref.startsWith('javascript:') ||
      lowerHref.startsWith('mailto:') ||
      lowerHref.startsWith('tel:') ||
      lowerHref.startsWith('sms:') ||
      lowerHref.startsWith('#') ||
      lowerHref.includes('void(0)')
    ) {
      return;
    }

    let fullUrl;
    try {
      fullUrl = new URL(rawHref, finalUrl).toString();
    } catch {
      return;
    }

    if (seenUrls.has(fullUrl)) return;

    let fullObj;
    try {
      fullObj = new URL(fullUrl);
    } catch {
      return;
    }

    const host = fullObj.hostname.toLowerCase();
    const pathname = fullObj.pathname.toLowerCase();

    // Skip social / media
    if (SOCIAL_OR_MEDIA_DOMAINS.some((d) => host.includes(d))) return;

    // Skip generic LinkedIn company home
    if (host.includes('linkedin.com') && !pathname.includes('/jobs')) return;

    // Skip irrelevant pages
    if (IRRELEVANT_PATH_TOKENS.some((t) => pathname.includes(t))) return;

    // Ignore exact home URL unless subdomain changed
    if ((pathname === '/' || pathname === '') && host.replace(/^www\./, '') === siteHost) {
      return;
    }

    let score = 0;

    // ATS domain match (highest trust)
    if (KNOWN_ATS_DOMAINS.some((d) => host.includes(d))) {
      score += 85;
    }

    // Careers subdomain match (e.g. careers.domain.com, jobs.domain.com)
    if (
      host.startsWith('careers.') ||
      host.startsWith('career.') ||
      host.startsWith('jobs.') ||
      host.startsWith('talent.') ||
      host.startsWith('recruitment.')
    ) {
      score += 65;
    }

    // High confidence exact text
    if (text === 'careers' || text === 'career' || text === 'jobs') {
      score += 75;
    } else if (
      text === 'current openings' ||
      text === 'job openings' ||
      text === 'join us' ||
      text === 'join our team' ||
      text === 'work with us' ||
      text === 'we are hiring' ||
      text === 'work at'
    ) {
      score += 70;
    } else if (/\bcareers?\b/i.test(text)) {
      score += 55;
    } else if (/\bjobs?\b/i.test(text)) {
      score += 45;
    } else if (/\b(openings|vacancies|hiring|opportunities|explore careers|career opportunities)\b/i.test(text)) {
      score += 50;
    }

    // URL path matches
    if (
      pathname.includes('/career') ||
      pathname.includes('/careers') ||
      pathname.includes('/job') ||
      pathname.includes('/jobs') ||
      pathname.includes('/join-us') ||
      pathname.includes('/work-with-us') ||
      pathname.includes('/openings') ||
      pathname.includes('/current-openings') ||
      pathname.includes('/career-opportunity') ||
      pathname.includes('/vacancies') ||
      pathname.includes('/recruitment')
    ) {
      score += 45;
    }

    if (score >= 40) {
      seenUrls.add(fullUrl);
      candidates.push({
        url: fullUrl,
        text,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Main function: visits website and discovers the company's career portal.
 */
export async function discoverCompanyCareerPortal(websiteUrl, options = {}) {
  const normalized = normalizeWebsiteUrl(websiteUrl);
  if (!normalized) {
    return { success: false, reason: 'Invalid or missing website URL' };
  }

  const { skipVerify = false, timeoutMs = 6000 } = options;
  const cleanDomain = getCleanDomain(normalized);

  // 1. Visit website and fetch HTML
  const fetchResult = await fetchHtmlWithFallback(normalized, timeoutMs);
  if (fetchResult && fetchResult.html) {
    const candidates = extractCareerLinksFromHtml(fetchResult.html, fetchResult.finalUrl);

    if (candidates.length > 0) {
      for (const cand of candidates.slice(0, 4)) {
        if (skipVerify) {
          return {
            success: true,
            careersUrl: cand.url,
            method: 'html_link_extracted',
            score: cand.score,
            text: cand.text,
          };
        }

        const verified = await verifyCandidateUrl(cand.url);
        if (verified) {
          return {
            success: true,
            careersUrl: typeof verified === 'string' ? verified : cand.url,
            method: 'html_link_verified',
            score: cand.score,
            text: cand.text,
          };
        }
      }
    }
  }

  // 2. Subdomain probe fallback (for SPAs like Swiggy, Foxconn, etc.)
  if (cleanDomain && !cleanDomain.includes('localhost') && cleanDomain.includes('.')) {
    const subdomains = [
      `https://careers.${cleanDomain}`,
      `https://jobs.${cleanDomain}`,
      `https://recruit.${cleanDomain}`,
      `https://talent.${cleanDomain}`,
    ];

    for (const sub of subdomains) {
      try {
        const subRes = await fetch(sub, {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
          signal: AbortSignal.timeout(3000),
          redirect: 'follow',
        });
        if (subRes.status >= 200 && subRes.status < 400) {
          const finalSubUrl = subRes.url || sub;
          let finalHost = '';
          let finalPath = '';
          try {
            const parsed = new URL(finalSubUrl);
            finalHost = parsed.hostname.toLowerCase();
            finalPath = parsed.pathname.toLowerCase();
          } catch {}

          // If subdomain redirected back to main domain without a career path, skip it!
          if (finalHost === cleanDomain || finalHost === `www.${cleanDomain}`) {
            if (!/\b(career|job|work|join|opening|hiring|opportunity|vacanc|recruit)\b/i.test(finalPath)) {
              continue;
            }
          }

          return {
            success: true,
            careersUrl: finalSubUrl,
            method: 'subdomain_detected',
            score: 70,
          };
        }
      } catch {
        // continue
      }
    }
  }

  // 3. Common path probe fallback ONLY IF homepage was reachable
  if (fetchResult && fetchResult.finalUrl) {
    let origin = '';
    try {
      origin = new URL(fetchResult.finalUrl).origin;
    } catch {
      origin = normalized;
    }

    const commonPaths = [
      '/careers',
      '/careers/',
      '/career',
      '/jobs',
      '/en/careers',
      '/en/jobs',
      '/en-us/careers',
      '/careers/openings',
      '/join-us',
      '/work-with-us',
      '/career-opportunity',
    ];

    for (const path of commonPaths) {
      const probeUrl = `${origin}${path}`;
      try {
        const probeRes = await fetch(probeUrl, {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
          signal: AbortSignal.timeout(3000),
          redirect: 'follow',
        });

        if (probeRes.status >= 200 && probeRes.status < 400) {
          const finalProbeUrl = probeRes.url || probeUrl;
          let resPath = '';
          try {
            resPath = new URL(finalProbeUrl).pathname.toLowerCase();
          } catch {}

          // Ensure it didn't redirect back to root homepage or generic language root
          if (
            resPath === '/' ||
            resPath === '' ||
            !/\b(career|job|work|join|opening|hiring|opportunity|vacanc|recruit)\b/i.test(finalProbeUrl)
          ) {
            continue;
          }

          const text = await probeRes.text();
          const lower = text.toLowerCase();
          const isNot404 =
            !lower.includes('page not found') &&
            !lower.includes('404 not found') &&
            !lower.includes('error 404');

          if (isNot404) {
            return {
              success: true,
              careersUrl: finalProbeUrl,
              method: 'common_path_probed',
              score: 55,
            };
          }
        }
      } catch {
        // Continue next path
      }
    }
  }

  return {
    success: false,
    reason: 'Could not detect an active career portal from website.',
  };
}
