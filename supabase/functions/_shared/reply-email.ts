const escapeHtml = (value: string) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const truncate = (value: string, max = 400) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

export type FeedbackReplyEmailInput = {
  siteName: string;
  siteUrl: string;
  authorName?: string | null;
  originalBody: string;
  adminReply: string;
};

export type JobQuestionReplyEmailInput = {
  siteName: string;
  siteUrl: string;
  askerName?: string | null;
  jobTitle: string;
  jobPath: string;
  company?: string | null;
  originalBody: string;
  answerBody: string;
};

export const buildFeedbackReplyEmail = (input: FeedbackReplyEmailInput) => {
  const greeting = input.authorName?.trim()
    ? `Hi ${input.authorName.trim()},`
    : 'Hi,';
  const feedbackUrl = `${input.siteUrl.replace(/\/+$/, '')}/feedback`;
  const subject = `We replied to your feedback on ${input.siteName}`;
  const original = truncate(input.originalBody);
  const reply = truncate(input.adminReply, 800);

  const text = [
    greeting,
    '',
    `Thanks for contacting ${input.siteName}. We have replied to your feedback:`,
    '',
    `Your message:`,
    original,
    '',
    `Our reply:`,
    reply,
    '',
    `View it here: ${feedbackUrl}`,
    '',
    `— ${input.siteName}`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#0f172a;max-width:560px">
      <p>${escapeHtml(greeting)}</p>
      <p>Thanks for contacting <strong>${escapeHtml(input.siteName)}</strong>. We have replied to your feedback.</p>
      <p style="margin:1.25rem 0 0.35rem;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b">Your message</p>
      <blockquote style="margin:0;padding:0.75rem 1rem;border-left:3px solid #cbd5e1;background:#f8fafc;color:#334155;white-space:pre-wrap">${escapeHtml(original)}</blockquote>
      <p style="margin:1.25rem 0 0.35rem;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b">Our reply</p>
      <blockquote style="margin:0;padding:0.75rem 1rem;border-left:3px solid #06b6d4;background:#ecfeff;color:#0f172a;white-space:pre-wrap">${escapeHtml(reply)}</blockquote>
      <p style="margin:1.5rem 0">
        <a href="${escapeHtml(feedbackUrl)}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:600;padding:0.7rem 1rem;border-radius:0.65rem">View on ${escapeHtml(input.siteName)}</a>
      </p>
      <p style="color:#64748b;font-size:13px">— ${escapeHtml(input.siteName)}</p>
    </div>
  `.trim();

  return { subject, html, text };
};

export const buildJobQuestionReplyEmail = (input: JobQuestionReplyEmailInput) => {
  const greeting = input.askerName?.trim()
    ? `Hi ${input.askerName.trim()},`
    : 'Hi,';
  const jobUrl = `${input.siteUrl.replace(/\/+$/, '')}${input.jobPath.startsWith('/') ? input.jobPath : `/${input.jobPath}`}`;
  const jobLabel = input.company?.trim()
    ? `${input.jobTitle} at ${input.company.trim()}`
    : input.jobTitle;
  const subject = `Answer to your question about ${input.jobTitle}`;
  const original = truncate(input.originalBody);
  const answer = truncate(input.answerBody, 800);

  const text = [
    greeting,
    '',
    `We answered your question about ${jobLabel}:`,
    '',
    `Your question:`,
    original,
    '',
    `Answer:`,
    answer,
    '',
    `View the job: ${jobUrl}`,
    '',
    `— ${input.siteName}`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#0f172a;max-width:560px">
      <p>${escapeHtml(greeting)}</p>
      <p>We answered your question about <strong>${escapeHtml(jobLabel)}</strong>.</p>
      <p style="margin:1.25rem 0 0.35rem;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b">Your question</p>
      <blockquote style="margin:0;padding:0.75rem 1rem;border-left:3px solid #cbd5e1;background:#f8fafc;color:#334155;white-space:pre-wrap">${escapeHtml(original)}</blockquote>
      <p style="margin:1.25rem 0 0.35rem;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b">Answer</p>
      <blockquote style="margin:0;padding:0.75rem 1rem;border-left:3px solid #06b6d4;background:#ecfeff;color:#0f172a;white-space:pre-wrap">${escapeHtml(answer)}</blockquote>
      <p style="margin:1.5rem 0">
        <a href="${escapeHtml(jobUrl)}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:600;padding:0.7rem 1rem;border-radius:0.65rem">View job &amp; answer</a>
      </p>
      <p style="color:#64748b;font-size:13px">— ${escapeHtml(input.siteName)}</p>
    </div>
  `.trim();

  return { subject, html, text };
};
