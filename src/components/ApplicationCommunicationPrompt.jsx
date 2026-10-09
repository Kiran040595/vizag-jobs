import { getApplicationCommunication } from '../lib/applicationCommunication';

export default function ApplicationCommunicationPrompt({ job = {} }) {
  const communication = getApplicationCommunication(job);
  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Further communication">
      <h3 className="break-words text-lg font-bold text-emerald-950">{communication.title}</h3>
      <p className="mt-2 text-base leading-7 text-slate-700">{communication.description}</p>
      <a href={communication.url} target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-800">
        {communication.button}<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
