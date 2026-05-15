import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { supabase } from '../lib/supabaseClient';

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get('authorization_id');
  const { isLoading, session } = useEmployerAuth();
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loginRedirect = authorizationId
    ? `/employer/login?redirect=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`
    : '/employer/login';

  useEffect(() => {
    if (!authorizationId || !session || !supabase?.auth?.oauth?.getAuthorizationDetails) {
      return;
    }

    let ignore = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
        if (ignore) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setDetails(data);
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Could not load authorization request.');
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [authorizationId, session]);

  if (!authorizationId) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Invalid request</h1>
          <p className="mt-2 text-sm text-slate-600">Missing authorization_id.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-cyan-600">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={loginRedirect} replace />;
  }

  const oauthApi = supabase?.auth?.oauth;
  const hasOAuthApi = Boolean(
    oauthApi?.getAuthorizationDetails &&
      oauthApi?.approveAuthorization &&
      oauthApi?.denyAuthorization
  );

  const handleDecision = async (decision) => {
    if (!hasOAuthApi) return;

    setIsBusy(true);
    setLoadError('');
    setNotice('');

    try {
      if (decision === 'approve') {
        const { data, error } = await oauthApi.approveAuthorization(authorizationId);
        if (error) throw error;
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }
        setNotice('Authorization approved.');
      } else {
        const { data, error } = await oauthApi.denyAuthorization(authorizationId);
        if (error) throw error;
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }
        setNotice('Authorization denied.');
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not complete authorization.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <SEO title="Authorize application | Vizag Jobs" canonical="/oauth/consent" />
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-black text-slate-950">Authorize application</h1>
        <p className="mt-2 text-sm text-slate-600">
          A third-party app is requesting access through your Vizag Jobs account (Supabase OAuth Server).
        </p>

        {!hasOAuthApi ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            OAuth consent API is not available in this build yet. Update <code className="text-xs">@supabase/supabase-js</code>{' '}
            when your project supports <code className="text-xs">auth.oauth.*</code> helpers, then redeploy.
          </p>
        ) : loadError ? (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </p>
        ) : !details ? (
          <div className="mt-6">
            <LoadingSpinner message="Loading authorization details..." />
          </div>
        ) : (
          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Application:</span> {details.client?.name || 'Unknown app'}
            </p>
            {details.redirect_uri ? (
              <p>
                <span className="font-semibold">Redirect:</span> {details.redirect_uri}
              </p>
            ) : null}
            {details.scope ? (
              <div>
                <span className="font-semibold">Permissions:</span>
                <ul className="mt-1 list-inside list-disc">
                  {details.scope.split(' ').filter(Boolean).map((scope) => (
                    <li key={scope}>{scope}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {notice ? (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}

        {hasOAuthApi && details ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleDecision('approve')}
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleDecision('deny')}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70"
            >
              Deny
            </button>
          </div>
        ) : null}

        <p className="mt-6 text-sm text-slate-500">
          <Link to="/employer/jobs" className="font-semibold text-cyan-600">
            Employer dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
