/**
 * Single-company career page scraper & Gemini Vizag job extraction helpers
 * for `fetch-external-jobs` (`mode: 'company_careers'`).
 */

export type CompanyCareerTarget = {
  name: string;
  careers_url: string;
  website?: string | null;
  category?: string | null;
  location?: string | null;
};

export type ExtractedCompanyCareerJob = {
  title?: string;
  company?: string;
  location?: string;
  category?: string;
  job_type?: string;
  work_mode?: string;
  experience?: string;
  is_fresher?: boolean;
  salary?: string;
  apply_link?: string;
  short_description?: string;
  description?: string;
  responsibilities?: string[];
  eligibility?: string[];
  skills?: string[];
};

export const VERIFIED_VIZAG_PORTALS: Record<string, string> = {
  brandix: 'https://careers.brandix.com/search/?q=&locationsearch=Visakhapatnam',
  'gmr group': 'https://careers.gmrgroup.in/search/?q=&locationsearch=Visakhapatnam',
  wns: 'https://careers.smartrecruiters.com/WNSGlobalServices144?search=Visakhapatnam',
  'fluentgrid limited': 'https://fluentgrid.com/careers/?job__location_spec=visakhapatnam',
  fluentgrid: 'https://fluentgrid.com/careers/?job__location_spec=visakhapatnam',
  'asian paints': 'https://careers.asianpaints.com/search/?q=&locationsearch=Visakhapatnam',
  'idfc first bank': 'https://careers.idfcfirst.bank.in/in/en/search-results?keywords=Visakhapatnam',
  jll: 'https://jll.wd1.myworkdayjobs.com/JLLCareers?locations=38ccc50fa540014356996861e2cc9f0e',
  marriott: 'https://careers.marriott.com/jobs?filter%5Bcity%5D%5B0%5D=Visakhapatnam',
  accor: 'https://careers.accor.com/global/en/jobs?options=992&page=1',
  amazon: 'https://www.amazon.jobs/en/search?city=Visakhapatnam&country=IND&county=Visakhapatnam&latitude=17.7199&loc_query=Visakhapatnam%2C+Andhra+Pradesh%2C+India&longitude=83.26281&radius=24km&region=Andhra+Pradesh',
  'vodafone idea limited': 'https://careers.vodafoneidea.com/search/?q=&locationsearch=Visakhapatnam',
  'h&m': 'https://careers.smartrecruiters.com/HMGroup?search=Vishakhapatnam',
  'celestinfo software solutions pvt. ltd.': 'https://www.celestinfo.com/careers.html',
  xtglobal: 'https://xtglobal.zohorecruit.in/jobs/Careers',
  'sails software': 'https://careers.sailssoftware.com/sailssoftware/',
  'miracle software systems': 'https://careers.miraclesoft.com/open-positions/',
  'miracle software systems inc.': 'https://careers.miraclesoft.com/open-positions/',
  'miracle software systems inc': 'https://careers.miraclesoft.com/open-positions/',
  miraclesoft: 'https://careers.miraclesoft.com/open-positions/',
  innocito: 'https://innocito.com/careers',
};

function embeddedCareerData(html: string, key: string) {
  const marker = `"${key}":`;
  const offset = html.indexOf(marker);
  if (offset < 0) return null;
  const start = offset + marker.length;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function embeddedJsonArray(text: string, key: string): Record<string, unknown>[] {
  const marker = `"${key}":[`;
  const offset = text.indexOf(marker);
  if (offset < 0) return [];
  const start = offset + marker.length - 1;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) {
      try {
        const value = JSON.parse(text.slice(start, i + 1));
        return Array.isArray(value) ? value : [];
      } catch { return []; }
    }
  }
  return [];
}

/** Parse the employer's server-rendered Next.js vacancy records, not visible accordion text. */
export function parseInnocitoVizagJobs(html: string, url: string, company: string): ExtractedCompanyCareerJob[] {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].flatMap((match) => {
    try { return [JSON.parse(match[1]) as string]; } catch { return []; }
  });
  return embeddedJsonArray(chunks.join('\n'), 'jobs').flatMap((record) => {
    const location = String(record.location || '');
    const title = String(record.title || '').trim();
    const jobNumber = String(record.jobNumber || '').trim();
    const description = String(record.description || '').trim();
    if (!/^vizag$/i.test(location) || !title || !/^ATCI-[A-Z0-9-]+$/i.test(jobNumber) || description.length < 80) return [];
    return [{
      title,
      company,
      location: 'Visakhapatnam, Andhra Pradesh, India',
      job_type: String(record.type || ''),
      experience: String(record.experience || ''),
      skills: [String(record.requiredSkill || record.skill || '')].filter(Boolean),
      short_description: `Official Innocito vacancy ${jobNumber}.`,
      description,
      apply_link: url,
    }];
  });
}

/** SuccessFactors repeats mobile/desktop links; read one record per result row. */
export function parseSuccessFactorsVizagJobs(html: string, baseUrl: string, company: string): ExtractedCompanyCareerJob[] {
  const jobs: ExtractedCompanyCareerJob[] = [];
  for (const row of html.match(/<tr\b[^>]*class=["'][^"']*\bdata-row\b[^"']*["'][^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const anchor = row.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    const href = anchor?.[1].match(/href=["']([^"']+)["']/i)?.[1];
    const location = row.match(/<span\b[^>]*class=["']jobLocation["'][^>]*>\s*([^<]+)/i)?.[1]?.trim();
    if (!href || !location || !/\bvisakhapatnam\b/i.test(location)) continue;
    const apply = new URL(href.replace(/&amp;/g, '&'), baseUrl);
    if (apply.origin !== new URL(baseUrl).origin || !apply.pathname.startsWith('/job/')) continue;
    jobs.push({ title: htmlToCleanMarkdown(anchor?.[2] || '', baseUrl), company, location, apply_link: apply.href });
  }
  return jobs;
}

/** Read official filtered listings and each posting's description directly. */
export async function scrapeVerifiedVizagPortal(url: string, company: string) {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname;
  const amazon = host === 'www.amazon.jobs' && parsedUrl.pathname === '/en/search' && parsedUrl.searchParams.get('city') === 'Visakhapatnam';
  const hm = host === 'careers.smartrecruiters.com' && parsedUrl.pathname === '/HMGroup' && parsedUrl.searchParams.get('search') === 'Vishakhapatnam';
  const celestinfo = ['celestinfo.com', 'www.celestinfo.com'].includes(host) && parsedUrl.pathname === '/careers.html';
  const successFactors = ['careers.brandix.com', 'careers.gmrgroup.in', 'careers.asianpaints.com', 'careers.vodafoneidea.com'].includes(host);
  const idfc = host === 'careers.idfcfirst.bank.in';
  const marriott = host === 'careers.marriott.com' && new URL(url).pathname === '/jobs';
  const accor = host === 'careers.accor.com' && new URL(url).pathname === '/global/en/jobs';
  const wns = host === 'careers.smartrecruiters.com' && new URL(url).pathname === '/WNSGlobalServices144';
  const fluentgrid = host === 'fluentgrid.com' && new URL(url).searchParams.get('job__location_spec') === 'visakhapatnam';
  const xtglobal = host === 'xtglobal.zohorecruit.in' && parsedUrl.pathname === '/jobs/Careers';
  const sailsSoftware = host === 'careers.sailssoftware.com' && parsedUrl.pathname.startsWith('/sailssoftware');
  const miracle = host === 'careers.miraclesoft.com' && parsedUrl.pathname === '/open-positions/';
  const innocito = ['innocito.com', 'www.innocito.com'].includes(host) && parsedUrl.pathname === '/careers';
  if (!successFactors && !wns && !fluentgrid && !idfc && !marriott && !accor && !amazon && !hm && !celestinfo && !xtglobal && !sailsSoftware && !miracle && !innocito) return null;
  if (hm) {
    const search = await fetch('https://api.smartrecruiters.com/v1/companies/HMGroup/postings?q=Vishakhapatnam', { signal: AbortSignal.timeout(20000) });
    if (!search.ok) throw new Error(`Official careers API returned ${search.status}`);
    const payload = await search.json();
    const rows = (Array.isArray(payload.content) ? payload.content : []).filter((posting: Record<string, unknown>) => {
      const location = posting.location as { city?: string } | undefined;
      return /\b(vishakhapatnam|visakhapatnam|vizag)\b/i.test(location?.city || '');
    });
    const jobs = (await Promise.all(rows.map(async (row: Record<string, unknown>) => {
      try {
        const response = await fetch(`https://api.smartrecruiters.com/v1/companies/HMGroup/postings/${row.id}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return null;
        const posting = await response.json();
        if (posting.company?.identifier !== 'HMGroup' || !/\b(vishakhapatnam|visakhapatnam|vizag)\b/i.test(posting.location?.city || '')) return null;
        const description = Object.values(posting.jobAd?.sections || {}).map((section) => htmlToCleanMarkdown((section as { text?: string }).text || '', url)).join('\n\n');
        if (!posting.name || description.length < 80) return null;
        const applyUrl = String(posting.postingUrl || '');
        if (!applyUrl.startsWith(`https://jobs.smartrecruiters.com/HMGroup/${posting.id}`)) return null;
        return {
          title: String(posting.name), company, location: String(posting.location.fullLocation || posting.location.city), description,
          apply_link: applyUrl,
        } as ExtractedCompanyCareerJob;
      } catch { return null; }
    }))).filter((job): job is ExtractedCompanyCareerJob => job !== null);
    return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_portal' as const };
  }
  if (sailsSoftware) {
    const fd = new FormData();
    fd.append('domain', 'careers.sailssoftware.com');
    fd.append('companyId', 'MTYyMzI=');
    fd.append('filterCri', JSON.stringify({ paginationStartNo: 0, selectedCall: 'sort', sortCriteria: { name: 'modifiedDate', isAscending: false }, anyOfTheseWords: '' }));
    const searchRes = await fetch('https://public.zwayam.com/jobs/search', {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', Origin: 'https://careers.sailssoftware.com', Referer: 'https://careers.sailssoftware.com/' },
      body: fd,
      signal: AbortSignal.timeout(20000),
    });
    if (!searchRes.ok) throw new Error(`Official careers API returned ${searchRes.status}`);
    const payload = await searchRes.json();
    const rawJobs = (payload.data?.data || []).map((j: { _source: Record<string, unknown> }) => j._source);
    const vizagJobs = rawJobs.filter((j: Record<string, unknown>) => /\b(visakhapatnam|vishakhapatnam|vizag)\b/i.test(`${j.location || ''} ${j.locationSeparatedbySlash || ''} ${j.city || ''}`));
    const jobs = (await Promise.all(vizagJobs.map(async (j: Record<string, unknown>) => {
      try {
        const detailRes = await fetch('https://public.zwayam.com/jobs-service/v1/jobs/careersite', {
          method: 'POST',
          headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json', Origin: 'https://careers.sailssoftware.com', Referer: 'https://careers.sailssoftware.com/' },
          body: JSON.stringify({ jobUrl: j.jobUrl, companyID: 'MTYyMzI=', domain: 'careers.sailssoftware.com' }),
          signal: AbortSignal.timeout(15000),
        });
        if (!detailRes.ok) return null;
        const d = await detailRes.json();
        const description = htmlToCleanMarkdown(String(d.longDescription || d.shortDescription || ''), url).slice(0, 20000);
        if (!d.jobTitle || description.length < 80) return null;
        const apply_link = `https://careers.sailssoftware.com/sailssoftware/jobview/${j.jobUrl}`;
        const salary = d.minJobSalary && d.maxJobSalary ? `${d.minJobSalary} - ${d.maxJobSalary}` : undefined;
        return {
          title: String(d.jobTitle),
          company,
          location: String(d.location || j.location || 'Visakhapatnam, Andhra Pradesh, India'),
          description,
          salary,
          apply_link,
        } as ExtractedCompanyCareerJob;
      } catch { return null; }
    }))).filter((job): job is ExtractedCompanyCareerJob => job !== null);
    return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_portal' as const };
  }
  const fetchUrl = amazon ? url.replace('/en/search?', '/en/search.json?') + '&result_limit=100' : url;
  const page = await fetch(fetchUrl, { signal: AbortSignal.timeout(20000) });
  if (!page.ok) throw new Error(`Official careers search returned ${page.status}`);
  if (amazon) {
    const payload = await page.json();
    const jobs = (Array.isArray(payload.jobs) ? payload.jobs : []).flatMap((posting: Record<string, unknown>) => {
      const locations = (Array.isArray(posting.locations) ? posting.locations : []).flatMap((entry) => {
        try { return [JSON.parse(String(entry))]; } catch { return []; }
      });
      const vizagLocations = locations.filter((entry) => /\b(visakhapatnam|vishakapatnam|vizag)\b/i.test(`${entry.city || ''} ${entry.normalizedLocation || ''}`));
      if (!vizagLocations.length || !posting.title || !posting.job_path) return [];
      const description = htmlToCleanMarkdown(`${posting.description || ''}\n${posting.basic_qualifications || ''}\n${posting.preferred_qualifications || ''}`, url).slice(0, 20000);
      if (description.length < 80) return [];
      return [{
        title: String(posting.title), company,
        location: vizagLocations.map((entry) => entry.city || entry.normalizedLocation).join(', '),
        description, apply_link: new URL(String(posting.job_path), url).href,
      } as ExtractedCompanyCareerJob];
    });
    return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_portal' as const };
  }
  const html = await page.text();
  if (innocito) {
    const jobs = parseInnocitoVizagJobs(html, url, company);
    return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_portal' as const };
  }
  if (miracle) {
    const detailUrls = [...new Set(
      [...html.matchAll(/href=["'](?:https:\/\/careers\.miraclesoft\.com\/)?(?:open-positions\/)?open-positions-sub\?jobId=(MSSJ\d+)[^"']*["']/gi)]
        .map((match) => `https://careers.miraclesoft.com/open-positions/open-positions-sub?jobId=${match[1]}`),
    )];
    const jobs = (await Promise.all(detailUrls.map(async (apply_link) => {
      try {
        const response = await fetch(apply_link, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return null;
        const detail = await response.text();
        const block = [...detail.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
          .map((match) => {
            try { return JSON.parse(match[1]); } catch { return null; }
          })
          .find((item) => item?.['@type'] === 'JobTitle');
        const jobId = new URL(apply_link).searchParams.get('jobId');
        if (!block || block.ID !== jobId || !/^India-Miracle Heights$/i.test(String(block.location || ''))) return null;
        const description = htmlToCleanMarkdown(String(block.description || ''), apply_link).slice(0, 20000);
        if (!block.title || description.length < 80) return null;
        return {
          title: String(block.title).trim(),
          company,
          location: 'Miracle Heights, Visakhapatnam, Andhra Pradesh, India',
          experience: String(block.experience || '').trim(),
          description,
          apply_link,
        } as ExtractedCompanyCareerJob;
      } catch { return null; }
    }))).filter((job): job is ExtractedCompanyCareerJob => job !== null);
    return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_portal' as const };
  }
  if (xtglobal) {
    const marker = '<input type="hidden" value="[{&#34;Remote_Job&#34;';
    const idx = html.indexOf(marker);
    if (idx < 0) return { content: JSON.stringify({ jobs: [] }), structuredJobs: [], count: 0, resolvedUrl: url, source: 'direct_portal' as const };
    const valueStart = idx + '<input type="hidden" value="'.length;
    const endIdx = html.indexOf('}]"', valueStart);
    if (endIdx < 0) return { content: JSON.stringify({ jobs: [] }), structuredJobs: [], count: 0, resolvedUrl: url, source: 'direct_portal' as const };
    const raw = html.slice(valueStart, endIdx + 2);
    const decoded = raw.replaceAll('&#34;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'");
    const records = JSON.parse(decoded);
    const vizagRecords = (Array.isArray(records) ? records : []).filter((r: Record<string, unknown>) => {
      const city = String(r.City || '');
      const desc = String(r.Job_Description || '');
      return /\b(visakhapatnam|vishakhapatnam|vizag)\b/i.test(`${city} ${desc}`);
    });
    const jobs: ExtractedCompanyCareerJob[] = vizagRecords.map((r: Record<string, unknown>) => {
      const title = String(r.Posting_Title || '');
      let location = String(r.City || 'Visakhapatnam');
      if (!/\b(visakhapatnam|vishakhapatnam|vizag)\b/i.test(location)) {
        location = `${location} / Visakhapatnam`;
      }
      const description = htmlToCleanMarkdown(String(r.Job_Description || ''), url).slice(0, 20000);
      const apply_link = `https://xtglobal.zohorecruit.in/jobs/Careers/${r.id}`;
      return { title, company, location, description, apply_link };
    }).filter((j: ExtractedCompanyCareerJob) => j.title && j.description.length >= 80);
    return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_portal' as const };
  }
  const rows = celestinfo ? [...new Set([...html.matchAll(/href=["'](https:\/\/nebula\.celestinfo\.com\/careers\/[^"'?]+)\/apply(?:\?[^"']*)?["']/gi)].map((m) => m[1]))]
    .map((apply_link) => ({ apply_link, company } as ExtractedCompanyCareerJob)) : marriott || accor ? [...new Set([...html.matchAll(/href=["'](\/[^"']*\/job\/[^"']+)["']/g)].map((m) => new URL(m[1], url).href))]
    .map((apply_link) => ({ apply_link, company } as ExtractedCompanyCareerJob)) : idfc ? parseConduentSearchJobs(html, { company, baseUrl: 'https://careers.idfcfirst.bank.in/in/en' }) : successFactors ? parseSuccessFactorsVizagJobs(html, url, company) : fluentgrid ?
    [...new Set([...html.matchAll(/href=["'](https:\/\/fluentgrid\.com\/jobs\/[^"'#]+)["']/g)].map((m) => m[1]))]
      .map((apply_link) => ({ apply_link, company } as ExtractedCompanyCareerJob)) :
    [...new Set([...html.matchAll(/href=["'](https:\/\/jobs\.smartrecruiters\.com\/WNSGlobalServices144\/[^"']+)["']/g)].map((m) => m[1]))]
      .map((apply_link) => ({ apply_link, company } as ExtractedCompanyCareerJob));
  const jobs: ExtractedCompanyCareerJob[] = [];
  // Bounded batches avoid overloading the employer's public site.
  for (let i = 0; i < rows.length; i += 4) {
    const batch = await Promise.all(rows.slice(i, i + 4).map(async (row) => {
      try {
        if (wns) {
          const id = new URL(row.apply_link!).pathname.split('/')[2].split('-')[0];
          if (!/^\d+$/.test(id)) return null;
          const response = await fetch(`https://api.smartrecruiters.com/v1/companies/WNSGlobalServices144/postings/${id}`, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) return null;
          const posting = await response.json();
          if (posting.company?.identifier !== 'WNSGlobalServices144' || !/\b(visakhapatnam|vizag)\b/i.test(posting.location?.city || '')) return null;
          const description = Object.values(posting.jobAd?.sections || {}).map((section) => htmlToCleanMarkdown((section as { text?: string }).text || '', row.apply_link!)).join('\n\n');
          if (description.length < 80 || !posting.name) return null;
          return { ...row, title: String(posting.name), location: String(posting.location.fullLocation || posting.location.city), description };
        }
        const response = await fetch(row.apply_link!, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return null;
        const detail = await response.text();
        let description = htmlToCleanMarkdown(detail, row.apply_link!).slice(0, 20000);
        let title = row.title;
        let location = row.location;
        if (idfc) {
          const posting = embeddedCareerData(detail, 'jobDetail')?.data?.job;
          if (!posting?.description || !posting?.title) return null;
          const expiry = Date.parse(posting.expiryDate || '');
          if (Number.isFinite(expiry) && expiry < Date.now()) return null;
          title = String(posting.title);
          location = String(posting.location || posting.city || '');
          description = htmlToCleanMarkdown(posting.description, row.apply_link!).slice(0, 20000);
        }
        if (fluentgrid || marriott || accor || celestinfo) {
          const blocks = [...detail.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
          for (const block of blocks) {
            try {
              const parsed = JSON.parse(block[1]);
              const records = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
              const posting = records.find((item) => item['@type'] === 'JobPosting');
              if (!posting) continue;
              if (celestinfo && posting.hiringOrganization?.name !== 'Celestinfo Software Solutions') return null;
              const expiry = Date.parse(posting.validThrough || '');
              if (Number.isFinite(expiry) && expiry < Date.now()) return null;
              title = posting.title;
              const places = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
              location = places.map((place: { address?: string | { addressLocality?: string } }) => typeof place?.address === 'string' ? place.address : place?.address?.addressLocality || '').join(', ');
              description = htmlToCleanMarkdown(posting.description || '', row.apply_link!).slice(0, 20000);
            } catch { /* Unrelated/malformed schema is not vacancy evidence. */ }
          }
        }
        if (!title || !location || !/\b(visakhapatnam|vizag)\b/i.test(location) || description.length < 80) return null;
        return { ...row, title, location, description };
      } catch { return null; }
    }));
    jobs.push(...batch.filter((item): item is NonNullable<typeof item> => item !== null));
  }
  return { content: JSON.stringify({ jobs }), structuredJobs: jobs, count: jobs.length, resolvedUrl: url, source: 'direct_html' as const };
}

/** Conduent renders its verified search results from embedded Phenom data. */
export function parseConduentSearchJobs(html: string, options = { company: 'Conduent', baseUrl: 'https://careers.conduent.com/us/en' }): ExtractedCompanyCareerJob[] {
  const marker = '"eagerLoadRefineSearch":';
  const offset = html.indexOf(marker);
  if (offset < 0) return [];
  const start = offset + marker.length;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const rows = JSON.parse(html.slice(start, i + 1))?.data?.jobs;
        if (!Array.isArray(rows)) return [];
        return rows.filter((row) => /^visakhapatnam$/i.test(String(row.city)) && row.title && /^(P-)?\d+$/.test(String(row.jobId)))
          .map((row) => ({
            title: String(row.title), company: options.company,
            location: String(row.location || row.city),
            apply_link: `${options.baseUrl}/job/${row.jobId}/${String(row.title).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
            description: String(row.descriptionTeaser || ''),
            skills: Array.isArray(row.ml_skills) ? row.ml_skills.map(String) : [],
          }));
      } catch { return []; }
    }
  }
  return [];
}

export const COMPANY_CAREERS_EXTRACT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    jobs: {
      type: 'ARRAY',
      description: 'List of open job vacancies located in or applicable to Visakhapatnam / Vizag.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          company: { type: 'STRING' },
          location: {
            type: 'STRING',
            description: 'Visakhapatnam / Vizag or Remote (open to Vizag)',
          },
          category: { type: 'STRING' },
          job_type: {
            type: 'STRING',
            enum: ['Full-Time', 'Part-Time', 'Internship', 'Contract'],
          },
          work_mode: {
            type: 'STRING',
            enum: ['On-site', 'Remote', 'Hybrid'],
          },
          experience: { type: 'STRING' },
          is_fresher: { type: 'BOOLEAN' },
          salary: { type: 'STRING' },
          apply_link: { type: 'STRING' },
          short_description: { type: 'STRING' },
          description: { type: 'STRING' },
          responsibilities: { type: 'ARRAY', items: { type: 'STRING' } },
          eligibility: { type: 'ARRAY', items: { type: 'STRING' } },
          skills: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'apply_link'],
      },
    },
  },
  required: ['jobs'],
};

export const PARSE_RAW_TEXT_JOBS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    jobs: {
      type: 'ARRAY',
      description: 'List of distinct job vacancies extracted from the raw text.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Clean job title' },
          company: { type: 'STRING', description: 'Company or hiring organization name' },
          location: { type: 'STRING', description: 'Visakhapatnam or specific locality' },
          category: { type: 'STRING', description: 'Job category' },
          job_type: {
            type: 'STRING',
            enum: ['Full-Time', 'Part-Time', 'Internship', 'Contract'],
          },
          work_mode: {
            type: 'STRING',
            enum: ['On-site', 'Remote', 'Hybrid'],
          },
          experience: { type: 'STRING', description: 'Experience requirements e.g. 0-1 Years, Fresher' },
          is_fresher: { type: 'BOOLEAN', description: 'True if freshers / 0-year can apply' },
          salary: { type: 'STRING', description: 'Salary or CTC' },
          short_description: { type: 'STRING', description: 'Concise summary' },
          description: { type: 'STRING', description: 'Comprehensive job description' },
          responsibilities: { type: 'ARRAY', items: { type: 'STRING' } },
          eligibility: { type: 'ARRAY', items: { type: 'STRING' } },
          skills: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title'],
      },
    },
  },
  required: ['jobs'],
};

const MAX_CAREER_PAGE_CHARS = 48_000;

/**
 * Rewrite known corporate marketing career URLs to their actual ATS / Workday portal URLs.
 */
export function resolveCanonicalCareerPortalUrl(rawUrl: string, companyName = ''): string {
  const trimmed = (rawUrl || '').trim();
  const lowerUrl = trimmed.toLowerCase();
  const lowerName = (companyName || '').trim().toLowerCase();
  if (VERIFIED_VIZAG_PORTALS[lowerName]) return VERIFIED_VIZAG_PORTALS[lowerName];

  const PFIZER_DEFAULT_VIZAG_WORKDAY_URL =
    'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers?locations=e2d3979e3af10195da701f58076c648f&startDate=a6e09e1f3296100014ae1d545f3c0098';

  if (
    lowerUrl.includes('pfizer.com/about/careers') ||
    lowerUrl.includes('pfizerhealthcareindiavizag.in') ||
    (lowerName.includes('pfizer') && !lowerUrl.includes('myworkdayjobs.com'))
  ) {
    return PFIZER_DEFAULT_VIZAG_WORKDAY_URL;
  }

  if (
    lowerUrl.includes('granulesindia.com/careers') ||
    (lowerName.includes('granules') && lowerUrl.includes('granulesindia.com'))
  ) {
    return 'https://careers.mygranules.com/';
  }

  if (
    lowerUrl.includes('apollohospitals.com/about-us/careers') ||
    (lowerName.includes('apollo') && lowerUrl.includes('apollohospitals.com/careers'))
  ) {
    return 'https://www.apollohospitals.com/corporate/careers/';
  }

  if (
    lowerUrl.includes('bajajfinserv.in/insights/careers') ||
    (lowerName.includes('bajaj') && lowerUrl.includes('bajajfinserv.in/careers'))
  ) {
    return 'https://www.bajajfinservmarkets.in/careers';
  }

  if (
    lowerName.includes('miracle') ||
    lowerUrl.includes('miraclesoftwaresystems.com')
  ) {
    return 'https://careers.miraclesoft.com/open-positions/';
  }

  if (
    lowerName.includes('fluentgrid') ||
    lowerUrl.includes('fluentgrid.com')
  ) {
    return 'https://fluentgrid.com/careers/';
  }

  if (
    lowerName.includes('symbiosys') ||
    lowerUrl.includes('symbiosystech.com')
  ) {
    return 'https://symbiosystech.com/';
  }

  if (
    lowerName.includes('tata consultancy') ||
    lowerName === 'tcs' ||
    lowerUrl === 'https://www.tcs.com/careers' ||
    lowerUrl === 'https://www.tcs.com/careers/'
  ) {
    return 'https://www.tcs.com/careers/india';
  }

  if (
    lowerName.includes('infosys') &&
    (lowerUrl.includes('infosys.com/careers') || !lowerUrl.includes('career.infosys.com'))
  ) {
    return 'https://career.infosys.com/joblist';
  }

  if (
    lowerName.includes('amazon') &&
    (lowerUrl === 'https://www.amazon.jobs' || lowerUrl === 'https://www.amazon.jobs/' || !lowerUrl.includes('base_query'))
  ) {
    return VERIFIED_VIZAG_PORTALS.amazon;
  }

  if (
    lowerName.includes('conduent') &&
    lowerUrl.includes('careers.conduent.com')
  ) {
    return 'https://careers.conduent.com/us/en/search-results?keywords=Visakhapatnam';
  }

  if (
    lowerName.includes('acn healthcare') ||
    lowerUrl.includes('acnhealthcare.com/careers')
  ) {
    return 'https://www.acnhealthcare.com/Careers.html';
  }

  if (
    lowerName.includes('arbhasoft') ||
    lowerUrl.includes('arbhasoft.com/careers')
  ) {
    return 'https://arbhasoft.com/career/';
  }

  if (
    lowerName.includes('celestinfo') ||
    lowerUrl.includes('celestinfo.com/careers')
  ) {
    return 'https://celestinfo.com/careers.html';
  }

  if (
    lowerName.includes('xtglobal') ||
    lowerUrl.includes('xtglobal.com') ||
    lowerUrl.includes('xtglobal.zohorecruit.in')
  ) {
    return 'https://xtglobal.zohorecruit.in/jobs/Careers';
  }

  if (
    lowerName.includes('sails software') ||
    lowerUrl.includes('sailssoftware.com')
  ) {
    return 'https://careers.sailssoftware.com/sailssoftware/';
  }

  if (
    lowerName.includes('cerebra consulting') ||
    lowerUrl.includes('cerebraconsulting.com')
  ) {
    return 'https://cerebra-consulting.com/';
  }

  if (
    lowerName.includes('credible consultancy') ||
    lowerUrl.includes('crediblejobs.in/careers')
  ) {
    return 'https://www.crediblejobs.in/p/current-openings.html';
  }

  if (
    lowerName.includes('cult fit') ||
    lowerName.includes('cult.fit') ||
    lowerUrl.includes('cult.fit/careers')
  ) {
    return 'https://careers.cult.fit/cult/';
  }

  if (
    lowerName.includes('deccan fine chemicals') ||
    lowerName.includes('deccan chemicals') ||
    lowerUrl.includes('deccanfinechemicals.com')
  ) {
    return 'https://www.deccanchemicals.com/';
  }

  if (
    lowerName.includes('homelane') ||
    lowerUrl.includes('homelane.darwinbox.in')
  ) {
    return 'https://www.homelane.com/careers';
  }

  if (
    lowerName.includes('cloudxtreme') ||
    lowerUrl.includes('cloudxtreme.com/careers')
  ) {
    return 'https://cloudxtreme.com/join-us/';
  }

  if (
    lowerName.includes('edge 3d') ||
    lowerUrl.includes('edge3d.in')
  ) {
    return 'https://www.edge3d.io/';
  }

  if (
    lowerName.includes('eprosoft') ||
    lowerUrl.includes('eprosoft.com/careers')
  ) {
    return 'https://www.eprosoft.com/';
  }

  if (
    lowerName.includes('growsin') ||
    lowerUrl.includes('growsin.com/careers')
  ) {
    return 'https://growsin.com/';
  }

  if (
    lowerName.includes('niyukti') ||
    lowerUrl.includes('niyukti.com')
  ) {
    return 'https://niyukti.ai/';
  }

  if (
    lowerName.includes('onliest') ||
    lowerUrl.includes('onliestllc.com')
  ) {
    return 'https://www.shop-onliest.com/';
  }

  if (
    lowerName.includes('sitaram motors') ||
    lowerUrl.includes('sitarammotors.royalenfield.com')
  ) {
    return 'https://www.sitarammotors.com/';
  }

  if (
    lowerName.includes('skillventory') ||
    lowerUrl.includes('skillventory.com/careers')
  ) {
    return 'https://jobs.skillventory.com/';
  }

  if (
    lowerName.includes('sri tech') ||
    lowerUrl.includes('sritechsolutions.com/careers')
  ) {
    return 'https://sritechsolutions.com/job-openings/';
  }

  if (
    lowerName.includes('synstack') ||
    lowerUrl.includes('synstack.in')
  ) {
    return 'https://www.synstacktech.com/';
  }

  if (
    lowerName.includes('teks academy') ||
    lowerUrl.includes('teksacademy.com/contact-us')
  ) {
    return 'https://teksacademy.com/';
  }

  if (
    lowerName.includes('sims college') ||
    lowerUrl.includes('simsvizag.com/contact-us')
  ) {
    return 'http://www.simsvizag.com/career';
  }

  if (
    lowerName.includes('tekwissen') ||
    lowerUrl.includes('tekwissen.com/careers')
  ) {
    return 'https://tekwissen.com/career/india/';
  }

  if (
    lowerName.includes('tilicho labs') ||
    lowerUrl.includes('tilicholabs.com/careers')
  ) {
    return 'https://www.tilicholabs.com/';
  }

  if (
    lowerName.includes('transasia') ||
    lowerUrl.includes('erbamannheim.com')
  ) {
    return 'https://transasia.co.in/';
  }

  if (
    lowerName.includes('urc construction') ||
    lowerUrl.includes('urcc.in')
  ) {
    return 'https://www.urcindia.com/';
  }

  if (
    lowerName.includes('winspire tech') ||
    lowerUrl.includes('winspiretech.com')
  ) {
    return 'https://winspiretech.co/careers/';
  }

  return trimmed;
}

/**
 * Parse a Workday career site URL (`https://<tenant>.wd1.myworkdayjobs.com/<site>`)
 * into its CXS JSON API endpoints and extract any applied facets/filters from query parameters.
 */
export function parseWorkdayPortalUrl(
  rawUrl: string,
): {
  origin: string;
  tenant: string;
  site: string;
  jobsApiUrl: string;
  appliedFacetsFromUrl: Record<string, string[]>;
  searchTextFromUrl: string;
} | null {
  try {
    const u = new URL(rawUrl);
    const hostMatch = u.hostname.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i);
    if (!hostMatch) return null;

    const tenant = hostMatch[1];
    const segments = u.pathname
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);

    // Strip optional locale prefix such as en-US or en-GB
    const cleanedSegments =
      segments.length > 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0])
        ? segments.slice(1)
        : segments;

    const site = cleanedSegments[0] || 'Careers';

    const appliedFacetsFromUrl: Record<string, string[]> = {};
    for (const [key, val] of u.searchParams.entries()) {
      if (['q', 'searchText', 'keyword'].includes(key)) {
        continue;
      }
      if (!appliedFacetsFromUrl[key]) {
        appliedFacetsFromUrl[key] = [];
      }
      if (!appliedFacetsFromUrl[key].includes(val)) {
        appliedFacetsFromUrl[key].push(val);
      }
    }
    const searchTextFromUrl = u.searchParams.get('q') || u.searchParams.get('searchText') || '';

    return {
      origin: u.origin,
      tenant,
      site,
      jobsApiUrl: `${u.origin}/wday/cxs/${tenant}/${site}/jobs`,
      appliedFacetsFromUrl,
      searchTextFromUrl,
    };
  } catch {
    return null;
  }
}

type WorkdayListPosting = {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
};

function isOldWorkdayPosting(postedOn: string | undefined): boolean {
  return /30\+\s*days/i.test(String(postedOn || ''));
}

function extractListUnderHeading(html: string, headingPattern: RegExp): string[] {
  if (!html) return [];
  const match = html.search(headingPattern);
  if (match === -1) return [];
  const afterHeading = html.slice(match);
  const ulMatch = afterHeading.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
  if (!ulMatch) return [];
  const items: string[] = [];
  const liMatches = ulMatch[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi);
  for (const m of liMatches) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&#\d+;/g, '')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 5 && text.length < 300) {
      items.push(text);
    }
  }
  return items.slice(0, 8);
}

/**
 * Native Workday CXS JSON API scraper for `*.myworkdayjobs.com` portals (e.g. Pfizer).
 * Queries Vizag / Visakhapatnam openings directly and fetches their full job descriptions.
 */
export async function scrapeWorkdayCareerPortal(
  portalUrl: string,
): Promise<{ content: string; count: number; structuredJobs?: ExtractedCompanyCareerJob[] } | null> {
  const parsed = parseWorkdayPortalUrl(portalUrl);
  if (!parsed) return null;

  let allPostings: WorkdayListPosting[] = [];

  // Strategy A: If the URL has appliedFacets (such as locations=... or startDate=...), query with them directly
  const hasUrlFacets = Object.keys(parsed.appliedFacetsFromUrl).length > 0;
  if (hasUrlFacets) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(parsed.jobsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          appliedFacets: parsed.appliedFacetsFromUrl,
          limit: 20,
          offset: 0,
          searchText: parsed.searchTextFromUrl,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const postings = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
        if (postings.length > 0) {
          allPostings = postings;
        }
      }
    } catch {
      /* ignore and fall through */
    } finally {
      clearTimeout(timer);
    }
  }

  // Strategy B: If no postings found or no URL facets, search with location keywords
  if (allPostings.length === 0) {
    const searchTerms = ['Vizag', 'Visakhapatnam'];
    for (const term of searchTerms) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const res = await fetch(parsed.jobsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            appliedFacets: {},
            limit: 20,
            offset: 0,
            searchText: term,
          }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const postings = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
          if (postings.length > 0) {
            allPostings = postings;
            break;
          }
        }
      } catch {
        /* ignore and try next search term */
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Filter to Vizag / Visakhapatnam roles if not already facet-filtered
  const vizagPostings = hasUrlFacets
    ? allPostings
    : allPostings.filter((p) => {
        const blob = `${p.locationsText || ''} ${p.externalPath || ''} ${p.title || ''}`;
        return /vizag|visakhapatnam/i.test(blob);
      });

  if (vizagPostings.length === 0) {
    return {
      content: 'No open Visakhapatnam / Vizag job postings found on Workday portal.',
      count: 0,
      structuredJobs: [],
    };
  }

  // Prioritize fresher postings (< 30 days) and deduplicate identical titles
  const sorted = [...vizagPostings].sort((a, b) => {
    const aOld = isOldWorkdayPosting(a.postedOn) ? 1 : 0;
    const bOld = isOldWorkdayPosting(b.postedOn) ? 1 : 0;
    return aOld - bOld;
  });

  const uniqueByTitle: WorkdayListPosting[] = [];
  const seenTitles = new Set<string>();
  for (const p of sorted) {
    const normTitle = String(p.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!normTitle || !p.externalPath) continue;
    if (seenTitles.has(normTitle)) continue;
    seenTitles.add(normTitle);
    uniqueByTitle.push(p);
    if (uniqueByTitle.length >= 8) break;
  }

  const structuredJobs: ExtractedCompanyCareerJob[] = [];
  const companyNameFromTenant = parsed.tenant
    ? parsed.tenant.charAt(0).toUpperCase() + parsed.tenant.slice(1)
    : 'Pfizer';

  const detailBlocks = await Promise.all(
    uniqueByTitle.map(async (p) => {
      const detailApiUrl = `${parsed.origin}/wday/cxs/${parsed.tenant}/${parsed.site}${p.externalPath}`;
      const fallbackPublicUrl = `${parsed.origin}/${parsed.site}${p.externalPath}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const res = await fetch(detailApiUrl, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const info = data?.jobPostingInfo || {};
        const title = String(info.title || p.title || '').trim();
        const rawLoc = String(info.location || p.locationsText || 'Visakhapatnam').trim();
        const timeType = String(info.timeType || 'Full-Time').trim();
        const postedOn = String(info.postedOn || p.postedOn || '').trim();
        const applyUrl = String(info.externalUrl || fallbackPublicUrl).trim();
        const rawDescHtml = String(info.jobDescription || '');
        const descMd = htmlToCleanMarkdown(rawDescHtml, applyUrl).slice(
          0,
          2_200,
        );

        const responsibilities = extractListUnderHeading(rawDescHtml, /achieve|responsibilit|duties|what you will do/i);
        const eligibility = extractListUnderHeading(rawDescHtml, /what you need|requirement|qualif|eligib/i);
        const normalizedJobType = /part[- ]?time/i.test(timeType)
          ? 'Part-Time'
          : /intern/i.test(timeType)
            ? 'Internship'
            : /contract/i.test(timeType)
              ? 'Contract'
              : 'Full-Time';

        const structuredJob: ExtractedCompanyCareerJob = {
          title,
          company: companyNameFromTenant,
          location: /vizag|visakhapatnam/i.test(rawLoc) ? 'Visakhapatnam' : rawLoc,
          job_type: normalizedJobType,
          work_mode: 'On-site',
          apply_link: applyUrl,
          description: descMd,
          short_description: `Join ${companyNameFromTenant} in Visakhapatnam as ${title}. Open role posted directly on official career portal.`,
          responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
          eligibility: eligibility.length > 0 ? eligibility : undefined,
        };
        structuredJobs.push(structuredJob);

        return [
          `### JOB OPENING: ${title}`,
          `- Location: Visakhapatnam, Andhra Pradesh, India (Site: ${rawLoc})`,
          `- Job Type: ${normalizedJobType}`,
          `- Posted: ${postedOn}`,
          `- Direct Apply Link: [${title}](${applyUrl})`,
          `- Apply URL: ${applyUrl}`,
          `- Job Description:`,
          descMd,
        ].join('\n');
      } catch {
        const fallbackJob: ExtractedCompanyCareerJob = {
          title: String(p.title || 'Role').trim(),
          company: companyNameFromTenant,
          location: 'Visakhapatnam',
          job_type: 'Full-Time',
          work_mode: 'On-site',
          apply_link: fallbackPublicUrl,
          description: `Open position at ${companyNameFromTenant} Vizag site: ${p.title}`,
          short_description: `Join ${companyNameFromTenant} in Visakhapatnam as ${p.title}.`,
        };
        structuredJobs.push(fallbackJob);

        return [
          `### JOB OPENING: ${p.title}`,
          `- Location: Visakhapatnam, Andhra Pradesh, India (Site: ${p.locationsText || 'Visakhapatnam'})`,
          `- Posted: ${p.postedOn || 'Recently'}`,
          `- Apply URL: ${fallbackPublicUrl}`,
        ].join('\n');
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return {
    content: detailBlocks.join('\n\n---\n\n').slice(0, MAX_CAREER_PAGE_CHARS),
    count: uniqueByTitle.length,
    structuredJobs,
  };
}

/**
 * Convert raw HTML into clean markdown while preserving hyperlinks as `[text](absoluteUrl)`.
 */
export function htmlToCleanMarkdown(html: string, baseUrl: string): string {
  if (!html) return '';
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  clean = clean.replace(
    /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, text: string) => {
      const linkText = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!linkText) return '';
      const rawHref = (href || '').trim();
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) {
        return ` ${linkText} `;
      }
      try {
        const fullUrl = new URL(rawHref, baseUrl).toString();
        return ` [${linkText}](${fullUrl}) `;
      } catch {
        return ` ${linkText} `;
      }
    },
  );

  clean = clean
    .replace(/<(?:h[1-6]|p|div|tr|li|section|article)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  return clean.slice(0, MAX_CAREER_PAGE_CHARS);
}

export async function scrapeCompanyCareerPage(
  url: string,
  options: {
    companyName?: string;
    firecrawlScrape?: (targetUrl: string) => Promise<string>;
    scrapflyScrape?: (targetUrl: string) => Promise<string>;
  } = {},
): Promise<{
  content: string;
  source: 'workday_cxs' | 'firecrawl' | 'direct_html' | 'scrapfly' | 'direct_portal';
  resolvedUrl: string;
  count?: number;
  structuredJobs?: ExtractedCompanyCareerJob[];
  requiresDirectVisit?: boolean;
  reason?: string;
}> {
  const resolvedUrl = resolveCanonicalCareerPortalUrl(url, options.companyName);
  const verifiedPortal = await scrapeVerifiedVizagPortal(resolvedUrl, options.companyName || '');
  if (verifiedPortal) return verifiedPortal;
  let lastError: Error | null = null;

  // Strategy 0: Native Workday CXS JSON API (for *.myworkdayjobs.com portals like Pfizer)
  if (parseWorkdayPortalUrl(resolvedUrl)) {
    try {
      const wd = await scrapeWorkdayCareerPortal(resolvedUrl);
      if (wd && (wd.content.trim().length >= 40 || (wd.structuredJobs && wd.structuredJobs.length > 0))) {
        return {
          content: wd.content,
          source: 'workday_cxs',
          resolvedUrl,
          count: wd.count,
          structuredJobs: wd.structuredJobs,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (options.firecrawlScrape) {
    try {
      const md = await options.firecrawlScrape(resolvedUrl);
      if (typeof md === 'string' && md.trim().length >= 80) {
        return {
          content: md.trim().slice(0, MAX_CAREER_PAGE_CHARS),
          source: 'firecrawl',
          resolvedUrl,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(resolvedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Direct HTTP fetch returned ${res.status}`);
      }
      const html = await res.text();
      if (new URL(resolvedUrl).hostname === 'careers.conduent.com') {
        const structuredJobs = parseConduentSearchJobs(html);
        if (structuredJobs.length) return {
          content: JSON.stringify({ jobs: structuredJobs }), source: 'direct_html', resolvedUrl,
          count: structuredJobs.length, structuredJobs,
        };
      }
      const markdown = htmlToCleanMarkdown(html, resolvedUrl);
      if (markdown.length >= 50) {
        return { content: markdown, source: 'direct_html', resolvedUrl };
      }
      lastError = new Error('Career page HTML contained too little readable text (<50 chars).');
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  if (options.scrapflyScrape) {
    try {
      const text = await options.scrapflyScrape(resolvedUrl);
      if (typeof text === 'string' && text.trim().length >= 50) {
        return {
          content: text.trim().slice(0, MAX_CAREER_PAGE_CHARS),
          source: 'scrapfly',
          resolvedUrl,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Graceful fallback: Do not throw 502 Bad Gateway to the user when bot protection,
  // single-page app frameworks, or expired SSL prevents automated extraction.
  return {
    content: '',
    source: 'direct_portal',
    resolvedUrl,
    requiresDirectVisit: true,
    reason: lastError?.message || `Could not scrape career page: ${resolvedUrl}`,
  };
}

export function resolveCompanyJobApplyLink(rawApplyLink: unknown, careersUrl: string): string {
  const candidate = typeof rawApplyLink === 'string' ? rawApplyLink.trim() : '';
  if (!candidate || /^(null|undefined|none|n\/a|na|#)$/i.test(candidate)) {
    return careersUrl;
  }
  try {
    const resolved = new URL(candidate, careersUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString();
    }
  } catch {
    /* fall back to careersUrl */
  }
  return careersUrl;
}

export function buildCompanyCareersExtractPrompt(
  company: CompanyCareerTarget,
  pageContent: string,
): string {
  const locationHint = (company.location || 'Visakhapatnam').trim();
  const categoryHint = (company.category || 'General').trim();

  return [
    `You are an expert recruiter for Jobs in Vizag (jobsinvizag.in), a verified job portal for Visakhapatnam (Vizag), Andhra Pradesh, India.`,
    `Below is the extracted text/markdown from the official careers page of "${company.name}" (Careers URL: ${company.careers_url}).`,
    `Company primary Vizag location: ${locationHint}. Industry/Category hint: ${categoryHint}.`,
    '',
    `TASK:`,
    `Extract all open job vacancies from this page that are located in Visakhapatnam / Vizag, or remote positions applicable to candidates in Visakhapatnam.`,
    '',
    `CRITICAL LOCATION RULES:`,
    `1. If a job explicitly states another city only (e.g. Hyderabad, Bangalore, Bengaluru, Chennai, Pune, Mumbai, Delhi, Noida, Gurgaon, Kolkata, Ahmedabad, USA, UK, Dubai) and does NOT mention Visakhapatnam or Vizag, DO NOT EXTRACT IT.`,
    `2. Extract jobs where the location includes Visakhapatnam, Vizag, "India - Vizag", or Andhra Pradesh, OR where "${company.name}" is listing roles for its Vizag site/plant/office, OR remote roles open to Visakhapatnam/India.`,
    `3. If the page content explicitly lists "### JOB OPENING: ...", extract each of those job openings!`,
    `4. If no Visag-eligible job openings are listed on the page, return an empty array: {"jobs": []}.`,
    `5. Never invent or hallucinate job openings that are not present in the provided career page content.`,
    `6. For apply_link: if a specific job detail/apply URL is present in the markdown links for that role, use that exact URL; otherwise use "${company.careers_url}".`,
    `7. Provide clean, informative descriptions, responsibilities, eligibility criteria, and skills based on the role details on the page.`,
    '',
    `--- CAREER PAGE CONTENT ---`,
    pageContent.slice(0, MAX_CAREER_PAGE_CHARS),
  ].join('\n');
}
