import { cleanCompanyForDedupe, cleanTitleForDedupe } from '../../src/lib/companyCareerFetchAutomation.js';

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 100);
}

export function rewriteJobForVizag(rawJob, company) {
  const companyName = String(company?.name || rawJob.company || '').trim();
  const rawTitle = String(rawJob.title || '').trim();

  // 1. Clean Title
  let cleanTitle = rawTitle
    .replace(/\s*-\s*visakhapatnam/i, '')
    .replace(/\s*-\s*vizag/i, '')
    .replace(/\s*\(\s*vizag\s*\)/i, '')
    .replace(/\s*\(\s*visakhapatnam\s*\)/i, '')
    .trim();

  if (!cleanTitle.toLowerCase().includes(companyName.toLowerCase())) {
    cleanTitle = `${cleanTitle} | ${companyName}`;
  }

  // 2. Slug
  const dateStr = new Date().toISOString().slice(0, 10);
  const baseSlug = slugify(`${rawJob.title} ${companyName} visakhapatnam`);
  const slug = `${baseSlug}-${dateStr}`;

  // 3. Location
  const location = 'Visakhapatnam, Andhra Pradesh';

  // 4. Category Classification
  let category = String(company?.category || rawJob.category || 'IT & Software').trim();
  const lowerText = `${rawTitle} ${rawJob.description || ''}`.toLowerCase();

  if (/\b(software|developer|engineer|java|python|react|frontend|backend|cloud|devops|full\s*stack|desktop\s*support|system\s*admin|dba|qa|tester)\b/.test(lowerText)) {
    category = 'IT & Software';
  } else if (/\b(bpo|customer\s*service|telecaller|voice|non-voice|call\s*center|operations\s*executive|process\s*associate)\b/.test(lowerText)) {
    category = 'BPO & Customer Support';
  } else if (/\b(pharma|healthcare|nurse|doctor|chemist|formulation|qc|qa|hospital|medical)\b/.test(lowerText)) {
    category = 'Healthcare & Pharma';
  } else if (/\b(finance|accountant|accounts|audit|banking|tax|tally|gst)\b/.test(lowerText)) {
    category = 'Finance & Banking';
  } else if (/\b(mechanical|civil|electrical|maintenance|production|fabrication|plant)\b/.test(lowerText)) {
    category = 'Core Engineering & Manufacturing';
  }

  // 5. Job Type & Work Mode
  const isContract = /\b(contract|contractual|temporary)\b/i.test(rawTitle);
  const isIntern = /\b(intern|internship|trainee)\b/i.test(rawTitle);
  const jobType = isIntern ? 'Internship' : isContract ? 'Contract' : 'Full-time';

  const isRemote = /\b(remote|work\s*from\s*home|wfh)\b/i.test(lowerText);
  const isHybrid = /\b(hybrid)\b/i.test(lowerText);
  const workMode = isRemote ? 'Remote' : isHybrid ? 'Hybrid' : 'On-site';

  // 6. Parse Responsibilities, Eligibility, Skills
  const responsibilities = [];
  const eligibility = [];
  const skills = [];

  const rawDesc = String(rawJob.description || '').replace(/\r/g, '');
  const lines = rawDesc.split('\n').map((l) => l.trim()).filter((l) => l.length > 5);

  let currentSection = 'general';
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (/responsibilit|key\s*tasks|duties|what\s*you.*do|deliver/i.test(lowerLine)) {
      currentSection = 'resp';
      continue;
    } else if (/requirement|eligibility|qualification|who\s*can\s*apply|education/i.test(lowerLine)) {
      currentSection = 'elig';
      continue;
    } else if (/skill|knowledge|technical\s*competenc/i.test(lowerLine)) {
      currentSection = 'skills';
      continue;
    }

    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line)) {
      const cleanLine = line.replace(/^[-•*\d.]+\s*/, '').trim();
      if (cleanLine.length > 10) {
        if (currentSection === 'resp' && responsibilities.length < 8) responsibilities.push(cleanLine);
        else if (currentSection === 'elig' && eligibility.length < 6) eligibility.push(cleanLine);
        else if (currentSection === 'skills' && skills.length < 8) skills.push(cleanLine);
        else if (responsibilities.length < 8) responsibilities.push(cleanLine);
      }
    }
  }

  // Fallbacks if structured bullets weren't explicitly found
  if (responsibilities.length === 0) {
    responsibilities.push(
      `Support day-to-day operations and service delivery for ${companyName} in Visakhapatnam.`,
      `Adhere strictly to standard operating procedures, quality guidelines, and client SLAs.`,
      `Collaborate with cross-functional teams to resolve client requests and operational tickets.`,
      `Maintain thorough documentation and logging of daily workflow activities.`,
    );
  }

  if (eligibility.length === 0) {
    eligibility.push(
      `Bachelor's degree or equivalent diploma in a relevant discipline.`,
      `Good verbal and written communication skills in English and regional languages.`,
      `Prior experience or relevant technical training matching the role requirements.`,
      `Candidates located in Visakhapatnam or willing to work on-site in Vizag.`,
    );
  }

  if (skills.length === 0) {
    skills.push('Problem Solving', 'Communication', 'Teamwork', 'SLA Management', 'Time Management');
  }

  // 7. Meta description (150-160 chars)
  const shortDesc = `${companyName} is hiring a ${rawTitle} in Visakhapatnam, Andhra Pradesh. Check eligibility, responsibilities, and apply directly today on VizagJobs.`.slice(0, 160);

  // 8. Markdown Job Description
  const markdownDescription = [
    `# ${cleanTitle} in Visakhapatnam`,
    '',
    `**${companyName}** has opened a vacancy for **${rawTitle}** located at their Visakhapatnam (Vizag) facility. Interested candidates meeting the eligibility criteria can apply directly through the official career portal link below.`,
    '',
    `## About the Role`,
    rawDesc ? rawDesc.slice(0, 800) : `${companyName} is seeking dedicated professionals in Visakhapatnam for the ${rawTitle} position.`,
    '',
    `## Key Responsibilities`,
    ...responsibilities.map((r) => `- ${r}`),
    '',
    `## Eligibility & Qualifications`,
    ...eligibility.map((e) => `- ${e}`),
    '',
    `## Required Skills`,
    ...skills.map((s) => `- ${s}`),
    '',
    `## How to Apply`,
    `Click the **Apply on Official Site** button below to complete your application directly on ${companyName}'s official careers portal. Applications are processed on a first-come, first-served basis.`,
    '',
    `## Frequently Asked Questions (FAQs)`,
    `**Q1: Where is this job located?**  `,
    `A: The role is located at ${companyName}'s Visakhapatnam office in Andhra Pradesh.`,
    '',
    `**Q2: Is this a full-time position?**  `,
    `A: Yes, this role is listed as a ${jobType} position (${workMode}).`,
    '',
    `**Q3: Are freshers eligible to apply?**  `,
    `A: Please review the eligibility section above. Both fresh graduates and experienced candidates matching the core skills are encouraged to apply.`,
    '',
    `**Q4: Is there any fee to apply for this job?**  `,
    `A: No. Neither ${companyName} nor VizagJobs ever charges any application or processing fees. Always apply directly on the verified official portal.`,
  ].join('\n');

  // 9. Schema.org JSON-LD for Google for Jobs
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: cleanTitle,
    description: shortDesc,
    datePosted: new Date().toISOString(),
    validThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    employmentType: jobType === 'Contract' ? 'CONTRACTOR' : jobType === 'Internship' ? 'INTERN' : 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      sameAs: company?.website || rawJob.apply_link,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Visakhapatnam',
        addressRegion: 'Andhra Pradesh',
        addressCountry: 'IN',
        postalCode: '530001',
      },
    },
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'India',
    },
  };

  return {
    slug,
    title: cleanTitle,
    company: companyName,
    location,
    category,
    job_type: jobType,
    work_mode: workMode,
    experience: rawJob.experience || 'Not specified',
    is_fresher: Boolean(rawJob.is_fresher || isIntern),
    salary: rawJob.salary || null,
    apply_link: rawJob.apply_link || company?.verified_careers_url,
    short_description: shortDesc,
    description: markdownDescription,
    responsibilities,
    eligibility,
    skills,
    warning: 'Verify job details on the employer site before sharing personal documents. Never pay any fee to apply.',
    source_name: 'Direct Company Website',
    source_url: company?.verified_careers_url,
    status: 'published',
    apply_mode: 'external',
    json_ld: jsonLd,
    seo_meta: {
      source: 'antigravity_verified_career_fetcher',
      generated_at: new Date().toISOString(),
    },
  };
}
