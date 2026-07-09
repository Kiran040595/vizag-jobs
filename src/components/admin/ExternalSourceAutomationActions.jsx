import { AUTOMATION_SEO_GAP_MS } from '../../lib/externalFetchAutomation';

export default function ExternalSourceAutomationActions({
  fetchDisabled,
  fetchOnlyLabel,
  onFetchOnly,
  onStartAutomation,
  automationRunning,
  activeAutomationChannel,
  channelId,
  fetchOnlyBusy = false,
}) {
  const isThisChannel = automationRunning && activeAutomationChannel === channelId;

  return (
    <>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={fetchDisabled || fetchOnlyBusy}
          onClick={onFetchOnly}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fetchOnlyBusy ? 'Fetching…' : fetchOnlyLabel}
        </button>
        <button
          type="button"
          disabled={fetchDisabled}
          onClick={onStartAutomation}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isThisChannel ? 'Automation running…' : 'Start automation →'}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Automation fetches listings, runs Make SEO every {Math.round(AUTOMATION_SEO_GAP_MS / 60_000)} minutes,
        and publishes new jobs with a valid apply link. Keep this tab open.
      </p>
    </>
  );
}
