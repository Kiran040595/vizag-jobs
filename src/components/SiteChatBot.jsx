import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';
import {
  DEFAULT_CHAT_SUGGESTIONS,
  fetchSiteChatMeta,
  sendSiteChatMessage,
} from '../services/siteChat.js';

const HIDDEN_PREFIXES = ['/admin', '/oauth'];

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    'Hi! I can help with Jobs in Vizag — applying for jobs, posting as an employer, accounts, and site pages. Ask a question below.',
};

function ChatIcon({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-5.1A8.5 8.5 0 1 1 21 11.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function linkifyText(text) {
  const parts = String(text || '').split(/(\bhttps?:\/\/[^\s]+|\b\/(?:jobs|student|employer|blog|contact|about|feedback|privacy-policy|terms|disclaimer|saved-jobs)[^\s]*)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-cyan-700 underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith('/')) {
      const path = part.replace(/[.,!?;:]+$/, '');
      const trailing = part.slice(path.length);
      return (
        <span key={`${part}-${index}`}>
          <Link to={path} className="font-semibold text-cyan-700 underline-offset-2 hover:underline">
            {path}
          </Link>
          {trailing}
        </span>
      );
    }
    return <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>;
  });
}

export default function SiteChatBot() {
  const location = useLocation();
  const cookieConsent = useOptionalCookieConsent();
  const titleId = useId();
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [suggestions, setSuggestions] = useState(DEFAULT_CHAT_SUGGESTIONS);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const isHidden = HIDDEN_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  const cookieBannerOpen = Boolean(cookieConsent?.isBannerOpen);
  const isJobDetailPage =
    /^\/jobs\/[^/]+\/[^/]+/.test(location.pathname) ||
    /^\/job\/[^/]+/.test(location.pathname) ||
    /^\/jobs\/[^/]+$/.test(location.pathname);
  const isCategoryListing =
    /^\/jobs\/(it|fresher|part-time|civil|mechanical|electrical|ece|engineering)$/.test(
      location.pathname,
    );
  const hasStickyApplyChrome = isJobDetailPage && !isCategoryListing && location.pathname !== '/jobs';

  const bottomClass = cookieBannerOpen
    ? 'bottom-[calc(11rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(8rem+env(safe-area-inset-bottom,0px))]'
    : hasStickyApplyChrome
      ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-6'
      : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-6';

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen, messages, isSending, error]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteChatMeta()
      .then((data) => {
        if (cancelled || !Array.isArray(data?.suggestions) || data.suggestions.length === 0) return;
        setSuggestions(data.suggestions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (isHidden) {
    return null;
  }

  const sendMessage = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || isSending) return;

    setError('');
    setInput('');
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const history = nextMessages
        .filter((message) => message !== WELCOME_MESSAGE)
        .map(({ role, content }) => ({ role, content }));

      const data = await sendSiteChatMessage(history);
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
      if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`fixed z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/35 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 right-[max(1rem,env(safe-area-inset-right))] ${bottomClass}`}
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-label="Open help chat"
          title="Help chat"
        >
          <ChatIcon />
        </button>
      ) : null}

      {isOpen ? (
        <div
          className={`fixed z-50 flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl right-[max(0.75rem,env(safe-area-inset-right))] ${bottomClass}`}
          style={{ maxHeight: 'min(32rem, calc(100dvh - 6rem))' }}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
            <div>
              <h2 id={titleId} className="text-sm font-bold">
                Jobs in Vizag Help
              </h2>
              <p className="mt-0.5 text-xs text-slate-300">Ask about applying, posting, or accounts</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close help chat"
            >
              <CloseIcon />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{linkifyText(message.content)}</p>
                </div>
              </div>
            ))}

            {isSending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500">
                  Thinking…
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {error}
              </div>
            ) : null}

            {!isSending && messages.length <= 2 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="site-chat-input">
                Your question
              </label>
              <input
                id="site-chat-input"
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={500}
                placeholder="Ask a question…"
                disabled={isSending}
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 disabled:opacity-60 sm:text-sm"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              AI answers use site help info. For account or listing issues, email{' '}
              <a href="mailto:kkumardadi@gmail.com" className="font-semibold text-cyan-700 hover:text-cyan-800">
                kkumardadi@gmail.com
              </a>
              .
            </p>
          </form>
        </div>
      ) : null}
    </>
  );
}
