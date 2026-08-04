import { CHAT_SUGGESTIONS, CHAT_SYSTEM_PROMPT } from './_lib/chatKnowledge.js';
import { checkRateLimit, getClientIp } from './_lib/chatRateLimit.js';
import { generateChatReply, isChatConfigured } from './_lib/geminiChat.js';
import { readJsonBody, sendJson, setCors } from './_lib/http.js';

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 10;

const normalizeMessages = (raw) => {
  if (!Array.isArray(raw)) return [];

  const cleaned = [];
  for (const item of raw) {
    const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
    const content = String(item?.content || '').trim();
    if (!role || !content) continue;
    if (content.length > MAX_MESSAGE_LENGTH) {
      const error = new Error(`Each message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
      error.statusCode = 400;
      throw error;
    }
    cleaned.push({ role, content });
  }

  return cleaned.slice(-MAX_HISTORY);
};

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      configured: isChatConfigured(),
      suggestions: CHAT_SUGGESTIONS,
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!isChatConfigured()) {
    sendJson(res, 503, {
      error: 'Chat is temporarily unavailable. Please email kkumardadi@gmail.com or use the Contact page.',
    });
    return;
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(`chat:${ip}`);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    sendJson(res, 429, {
      error: 'Too many chat messages. Please wait a few minutes and try again.',
      retryAfterSec: limit.retryAfterSec,
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body.' });
    return;
  }

  let messages;
  try {
    messages = normalizeMessages(body?.messages);
  } catch (error) {
    sendJson(res, error.statusCode || 400, { error: error.message || 'Invalid messages.' });
    return;
  }

  if (messages.length === 0) {
    sendJson(res, 400, { error: 'Send at least one message.' });
    return;
  }

  if (messages[messages.length - 1]?.role !== 'user') {
    sendJson(res, 400, { error: 'The last message must be from the user.' });
    return;
  }

  // Ensure conversation starts with a user turn for Gemini.
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }
  if (messages.length === 0) {
    sendJson(res, 400, { error: 'Send at least one user message.' });
    return;
  }

  try {
    const { text, model } = await generateChatReply({
      systemPrompt: CHAT_SYSTEM_PROMPT,
      messages,
    });

    sendJson(res, 200, {
      reply: text,
      model,
      suggestions: CHAT_SUGGESTIONS,
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    sendJson(res, status, {
      error: error?.message || 'Could not generate a reply. Please try again.',
    });
  }
}
