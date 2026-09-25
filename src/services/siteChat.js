/**
 * Public FAQ chatbot client for the site-chat Edge Function.
 * Uses the existing Supabase GEMINI_API_KEY secret (no Vercel key required).
 */

export const DEFAULT_CHAT_SUGGESTIONS = [
  'How do I apply for a job?',
  'How do employers post a job?',
  'Where can I find fresher jobs in Vizag?',
  'How do I contact support?',
];

export function getSiteChatUrl() {
  const functionsOverride = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  if (functionsOverride) {
    const base = functionsOverride.replace(/\/$/, '');
    if (base.endsWith('/site-chat')) {
      return base;
    }
    if (base.endsWith('/fetch-external-jobs')) {
      return base.replace('/fetch-external-jobs', '/site-chat');
    }
    if (base.includes('/functions/v1')) {
      return `${base}/site-chat`;
    }
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!projectUrl) {
    return '';
  }
  return `${projectUrl}/functions/v1/site-chat`;
}

function getAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
}

/**
 * @returns {Promise<{ ok: boolean, configured?: boolean, suggestions: string[] }>}
 */
export async function fetchSiteChatMeta() {
  const url = getSiteChatUrl();
  const anon = getAnonKey();
  if (!url || !anon) {
    return { ok: false, suggestions: DEFAULT_CHAT_SUGGESTIONS };
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, suggestions: DEFAULT_CHAT_SUGGESTIONS };
  }
  return {
    ok: true,
    configured: Boolean(data?.configured),
    suggestions: Array.isArray(data?.suggestions) && data.suggestions.length > 0
      ? data.suggestions
      : DEFAULT_CHAT_SUGGESTIONS,
  };
}

/**
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @returns {Promise<{ reply: string, suggestions: string[], model?: string }>}
 */
export async function sendSiteChatMessage(messages) {
  const url = getSiteChatUrl();
  const anon = getAnonKey();

  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL.');
  }
  if (!anon) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not get a reply. Please try again.');
  }

  const reply = String(data?.reply || '').trim();
  if (!reply) {
    throw new Error('Empty reply from the assistant.');
  }

  return {
    reply,
    model: data?.model,
    suggestions:
      Array.isArray(data?.suggestions) && data.suggestions.length > 0
        ? data.suggestions
        : DEFAULT_CHAT_SUGGESTIONS,
  };
}
