import { useState, useEffect } from 'react';
import {
  fetchUserAccountStatus,
  updateUserCredentials,
} from '../../services/adminAuthManagement.js';
import {
  formatAuthTimestamp,
  generateSuggestedPassword,
  formatLoginCredentialsForSharing,
  validateCredentialsUpdate,
} from '../../lib/adminUserCredentials.js';

export default function AdminUserCredentialsModal({
  open,
  onClose,
  user,
  onSuccess,
}) {
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const userId = user?.userId || user?.user_id;
  const displayName = user?.companyName || user?.fullName || user?.displayName || 'User';
  const role = user?.role || (user?.companyName ? 'employer' : 'student');

  useEffect(() => {
    if (!open || !userId) {
      setStatusData(null);
      setStatusError('');
      setFormError('');
      setSuccessInfo(null);
      setNewPassword('');
      return;
    }

    setNewEmail(user?.contactEmail || user?.email || '');
    setNewPassword('');
    setFormError('');
    setSuccessInfo(null);
    setCopiedSuccess(false);
    setLoadingStatus(true);
    setStatusError('');

    let isMounted = true;
    fetchUserAccountStatus(userId)
      .then((data) => {
        if (!isMounted) return;
        setStatusData(data);
        if (data?.email && !user?.contactEmail) {
          setNewEmail(data.email);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setStatusError(err.message || 'Could not fetch live account status.');
      })
      .finally(() => {
        if (isMounted) setLoadingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, userId, user]);

  if (!open || !user) return null;

  const handleGeneratePassword = () => {
    const generated = generateSuggestedPassword();
    setNewPassword(generated);
    setShowPassword(true);
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessInfo(null);

    const validation = validateCredentialsUpdate({
      newEmail: newEmail !== (statusData?.email || user?.contactEmail) ? newEmail : undefined,
      newPassword: newPassword || undefined,
    });

    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateUserCredentials({
        userId,
        newEmail: validation.cleanEmail,
        newPassword: validation.cleanPassword,
      });

      setSuccessInfo({
        savedEmail: result.email || newEmail,
        savedPassword: newPassword,
        emailUpdated: result.email_updated,
        passwordUpdated: result.password_updated,
      });

      // Refresh status data
      const updatedStatus = await fetchUserAccountStatus(userId).catch(() => null);
      if (updatedStatus) {
        setStatusData(updatedStatus);
      }

      if (onSuccess) {
        onSuccess({
          userId,
          newEmail: result.email || newEmail,
          emailUpdated: result.email_updated,
          passwordUpdated: result.password_updated,
        });
      }
    } catch (err) {
      setFormError(err.message || 'Failed to update credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCredentials = async () => {
    const shareText = formatLoginCredentialsForSharing({
      displayName,
      role: statusData?.account_type || role,
      email: successInfo?.savedEmail || newEmail,
      password: successInfo?.savedPassword || newPassword,
    });

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch {
      setFormError('Could not copy to clipboard. Please copy manually.');
    }
  };

  const phoneDigits = String(statusData?.phone || user?.phone || '').replace(/\D/g, '');
  const canWhatsApp = phoneDigits.length >= 10;
  const shareMessageText = formatLoginCredentialsForSharing({
    displayName,
    role: statusData?.account_type || role,
    email: successInfo?.savedEmail || newEmail,
    password: successInfo?.savedPassword || newPassword,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-credentials-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔑</span>
              <h2
                id="admin-credentials-modal-title"
                className="truncate text-lg font-black text-slate-950"
              >
                Account Credentials &amp; Status
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Manage login email and reset password for{' '}
              <strong className="text-slate-800">{displayName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Account Status Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{displayName}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    (statusData?.account_type || role) === 'employer'
                      ? 'border border-cyan-200 bg-cyan-100 text-cyan-900'
                      : 'border border-indigo-200 bg-indigo-100 text-indigo-900'
                  }`}
                >
                  {(statusData?.account_type || role) === 'employer'
                    ? '🏢 Employer'
                    : '🎓 Student'}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    (statusData?.is_active ?? user?.isActive ?? true)
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {(statusData?.is_active ?? user?.isActive ?? true) ? 'Active' : 'Deactivated'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                ID: {userId ? `${userId.slice(0, 8)}…` : 'N/A'}
              </span>
            </div>

            {loadingStatus ? (
              <div className="py-4 text-center text-xs text-slate-500">
                ⏳ Loading live Supabase auth status…
              </div>
            ) : statusError ? (
              <p className="mt-2 text-xs text-amber-800">⚠️ {statusError}</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Email Status</span>
                  <div className="mt-0.5 font-medium">
                    {statusData?.email_confirmed ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        ✓ Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                        ⚠️ Unconfirmed
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Last Sign-in</span>
                  <div className="mt-0.5 font-medium text-slate-800">
                    {formatAuthTimestamp(statusData?.last_sign_in_at)}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Registered</span>
                  <div className="mt-0.5 font-medium text-slate-800">
                    {formatAuthTimestamp(statusData?.created_at)}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Password Set</span>
                  <div className="mt-0.5 font-medium text-slate-800">
                    {statusData?.has_password ? '✓ Active password' : '⚠️ No password set'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Phone Number</span>
                  <div className="mt-0.5 font-medium text-slate-800">
                    {statusData?.phone || user?.phone || 'Not recorded'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Auth Email</span>
                  <div className="mt-0.5 font-medium text-slate-800 truncate" title={statusData?.email}>
                    {statusData?.email || user?.contactEmail || 'None'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Success Banner */}
          {successInfo && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="font-bold">Credentials updated successfully!</p>
                  <p className="text-xs text-emerald-800">
                    {successInfo.emailUpdated && successInfo.passwordUpdated
                      ? 'Both login email and password have been updated.'
                      : successInfo.emailUpdated
                      ? 'Login email updated and synchronized.'
                      : 'New password set successfully.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-50"
                >
                  {copiedSuccess ? '✓ Copied to clipboard!' : '📋 Copy Login Details'}
                </button>
                {canWhatsApp && (
                  <a
                    href={`https://wa.me/91${phoneDigits}?text=${encodeURIComponent(shareMessageText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800"
                  >
                    💬 Send to User on WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Form Error */}
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              ⚠️ {formError}
            </div>
          )}

          {/* Form */}
          <form id="admin-credentials-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="user-login-email" className="block text-xs font-bold text-slate-800">
                Login Email / Mail ID
              </label>
              <input
                id="user-login-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Updating this immediately updates the account login email and verifies it.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="user-login-password"
                  className="block text-xs font-bold text-slate-800"
                >
                  New Password
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  🎲 Generate Strong Password
                </button>
              </div>

              <div className="relative mt-1.5">
                <input
                  id="user-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (leave blank to keep current)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-20 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Must be at least 6 characters. Leave empty if you only want to change the email.
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="admin-credentials-form"
            disabled={isSaving}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isSaving ? '⏳ Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
