import { buildPhoneDialUrl } from '../lib/whatsappContact';

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z" />
  </svg>
);

export default function PhoneDialLink({ phone, className = '' }) {
  const href = buildPhoneDialUrl(phone);
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${className}`}
      aria-label="Call this number"
      title="Call this number"
    >
      <PhoneIcon />
    </a>
  );
}
