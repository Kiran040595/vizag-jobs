export const STUDENT_AUTH_METHODS = {
  EMAIL: 'email',
  PHONE: 'phone',
};

const TAB_CLASS =
  'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300';

export default function StudentAuthMethodTabs({ value, onChange }) {
  return (
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange(STUDENT_AUTH_METHODS.EMAIL)}
        className={`${TAB_CLASS} ${
          value === STUDENT_AUTH_METHODS.EMAIL
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Email
      </button>
      <button
        type="button"
        onClick={() => onChange(STUDENT_AUTH_METHODS.PHONE)}
        className={`${TAB_CLASS} ${
          value === STUDENT_AUTH_METHODS.PHONE
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Mobile
      </button>
    </div>
  );
}
