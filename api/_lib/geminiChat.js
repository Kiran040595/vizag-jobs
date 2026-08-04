const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const getApiKeys = () => {
  const keys = [];
  const seen = new Set();

  const push = (value) => {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  push(process.env.GEMINI_API_KEY_CHAT);
  push(process.env.GEMINI_API_KEY);

  const extra = process.env.GEMINI_API_KEYS || '';
  for (const part of extra.split(/[\n,]+/)) {
    push(part);
  }

  return keys;
};

const getModels = () => {
  const preferred = String(process.env.GEMINI_CHAT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const models = [preferred];
  for (const model of FALLBACK_MODELS) {
    if (!models.includes(model)) models.push(model);
  }
  return models;
};

const extractText = (payload) => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
};

/**
 * @param {{ systemPrompt: string, messages: Array<{ role: 'user' | 'assistant', content: string }> }} input
 */
export async function generateChatReply({ systemPrompt, messages }) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    const error = new Error('Chat is not configured. Missing GEMINI_API_KEY on the server.');
    error.statusCode = 503;
    throw error;
  }

  const models = getModels();
  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  let lastError = 'Gemini chat request failed.';

  for (const apiKey of keys) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 700,
            },
          }),
          signal: controller.signal,
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            payload?.error?.message || res.statusText || `HTTP ${res.status}`;
          lastError = `Gemini failed (${res.status}): ${message}`;
          // Try next key/model on quota / overload.
          if (res.status === 429 || res.status === 503 || res.status === 500) {
            continue;
          }
          const error = new Error(lastError);
          error.statusCode = 502;
          throw error;
        }

        const text = extractText(payload);
        if (!text) {
          lastError = 'Gemini returned an empty reply.';
          continue;
        }

        return { text, model };
      } catch (error) {
        if (error?.statusCode) throw error;
        lastError =
          error?.name === 'AbortError'
            ? 'Gemini chat timed out. Please try again.'
            : error?.message || String(error);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  const error = new Error(lastError);
  error.statusCode = 502;
  throw error;
}

export const isChatConfigured = () => getApiKeys().length > 0;
