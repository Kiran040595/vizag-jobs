const DEFAULT_REPO = 'Kiran040595/vizag-jobs';
const WORKFLOW_FILE = 'auto-naukri-fetch.yml';
const DEFAULT_REF = 'develop';
const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const SUCCESS_WINDOW_MS = 12 * 60 * 60 * 1000;
const DEBOUNCE_MS = 20 * 60 * 1000;

export function githubNaukriDispatchConfig(env = process.env) {
  return {
    token: String(env.GITHUB_DISPATCH_TOKEN || '').trim(),
    repo: String(env.GITHUB_REPOSITORY || DEFAULT_REPO).trim() || DEFAULT_REPO,
    ref: String(env.GITHUB_WORKFLOW_REF || DEFAULT_REF).trim() || DEFAULT_REF,
    workflowFile: WORKFLOW_FILE,
  };
}

export function shouldSkipNaukriDispatch(runs, { now = Date.now() } = {}) {
  const list = Array.isArray(runs) ? runs : [];
  for (const run of list) {
    const status = String(run?.status || '').toLowerCase();
    const conclusion = String(run?.conclusion || '').toLowerCase();
    const created = Date.parse(run?.created_at || run?.createdAt || '');
    const ageMs = Number.isFinite(created) ? now - created : Number.POSITIVE_INFINITY;

    if (ACTIVE_STATUSES.has(status)) {
      return {
        skip: true,
        reason: `Naukri workflow already ${status}`,
        run,
      };
    }

    if (ageMs >= 0 && ageMs < DEBOUNCE_MS) {
      return {
        skip: true,
        reason: 'Naukri workflow already triggered in the last 20 minutes',
        run,
      };
    }

    if (conclusion === 'success' && ageMs >= 0 && ageMs < SUCCESS_WINDOW_MS) {
      return {
        skip: true,
        reason: 'Naukri workflow already succeeded in the last 12 hours',
        run,
      };
    }
  }

  return { skip: false };
}

export function githubApiHeaders(token, userAgent = 'jobsinvizag-naukri-dispatch') {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': userAgent,
  };
}

export async function listNaukriWorkflowRuns({ token, repo, workflowFile }, { fetchImpl = fetch } = {}) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?per_page=8`;
  const res = await fetchImpl(url, { headers: githubApiHeaders(token) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub list runs failed (${res.status}). ${text.slice(0, 280)}`);
  }
  const data = text ? JSON.parse(text) : {};
  return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
}

export async function dispatchNaukriWorkflow(
  { token, repo, ref, workflowFile },
  { fetchImpl = fetch } = {},
) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      ...githubApiHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub workflow dispatch failed (${res.status}). ${text.slice(0, 280)}`);
  }
  return {
    ok: true,
    queued: true,
    workflow: workflowFile,
    ref,
    actions_url: `https://github.com/${repo}/actions/workflows/${workflowFile}`,
  };
}

export async function triggerNaukriWorkflowIfIdle(config, options = {}) {
  const runs = await listNaukriWorkflowRuns(config, options);
  const decision = shouldSkipNaukriDispatch(runs, { now: options.now });
  if (decision.skip) {
    return {
      ok: true,
      queued: false,
      skipped: true,
      reason: decision.reason,
      workflow: config.workflowFile,
      ref: config.ref,
      actions_url: `https://github.com/${config.repo}/actions/workflows/${config.workflowFile}`,
    };
  }
  const dispatched = await dispatchNaukriWorkflow(config, options);
  return { ...dispatched, skipped: false };
}
