export const DEFAULT_INSTAGRAM_CHANNEL_URL =
  'https://www.instagram.com/channel/Abb3Uh4CEdmuzv6D/';

export function normalizeCommunicationLink(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password || /\s/.test(text)) throw new Error();
    return url.href;
  } catch {
    throw new Error('Enter a valid HTTPS group or channel link.');
  }
}

export function getApplicationCommunication(job = {}) {
  let custom = '';
  try { custom = normalizeCommunicationLink(job.groupLink || job.group_link || ''); } catch { /* Invalid legacy links use the default channel. */ }
  if (!custom) return {
    url: DEFAULT_INSTAGRAM_CHANNEL_URL,
    title: 'Join our Instagram channel',
    description: 'Join Jobs in Vizag on Instagram for further communication and new job updates.',
    button: 'Join Instagram channel',
  };
  const host = new URL(custom).hostname.toLowerCase();
  const whatsapp = host === 'wa.me' || host === 'whatsapp.com' || host.endsWith('.whatsapp.com');
  const instagram = host === 'ig.me' || host === 'instagram.com' || host.endsWith('.instagram.com');
  return {
    url: custom,
    title: 'Join for further communication',
    description: 'Your application has been received. Join this group or channel for further communication about this job.',
    button: whatsapp ? 'Join WhatsApp group' : instagram ? 'Join Instagram group / channel' : 'Join recruitment group',
  };
}
