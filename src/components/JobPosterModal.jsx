import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  POSTER_FORMATS,
  POSTER_THEMES,
  buildPosterFilename,
  buildPosterMetadata,
  renderJobPosterToCanvas,
} from '../lib/jobPosterGenerator';
import { buildInstagramJobCaption } from '../lib/instagramJobCaption';
import { pushToast } from '../lib/toast';

const FORMAT_LIST = Object.values(POSTER_FORMATS);
const THEME_LIST = Object.values(POSTER_THEMES);

/**
 * Accessible native <dialog> poster preview & export modal for Students,
 * Visitors, Employers, and Admins.
 */
export default function JobPosterModal({ job, isOpen, onClose }) {
  const dialogRef = useRef(null);
  const canvasRef = useRef(null);
  const pressedOutsideRef = useRef(false);
  const titleId = useId();

  const [formatId, setFormatId] = useState('portrait');
  const [themeId, setThemeId] = useState('cyan');
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);

  const meta = useMemo(() => buildPosterMetadata(job), [job]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Progressive fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) {
      return undefined;
    }

    const isOutside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    const handlePointerDown = (e) => {
      pressedOutsideRef.current = isOutside(e);
    };

    const handlePointerUp = (e) => {
      if (pressedOutsideRef.current && isOutside(e)) {
        dialog.close();
      }
      pressedOutsideRef.current = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !job || !canvasRef.current) return undefined;

    let cancelled = false;
    setIsRendering(true);

    renderJobPosterToCanvas(canvasRef.current, job, { format: formatId, theme: themeId })
      .then(() => {
        if (cancelled) return;
        const supportsFileShare =
          typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          typeof File === 'function';
        if (supportsFileShare) {
          try {
            const testFile = new File(['x'], 'poster.png', { type: 'image/png' });
            setCanShareFile(Boolean(navigator.canShare({ files: [testFile] })));
          } catch {
            setCanShareFile(false);
          }
        } else {
          setCanShareFile(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Could not render job poster:', error);
        }
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formatId, isOpen, job, themeId]);

  const handleDialogClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = '';
    }
    onClose?.();
  }, [onClose]);

  const exportBlob = useCallback(
    () =>
      new Promise((resolve, reject) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          reject(new Error('Poster preview is not ready.'));
          return;
        }
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not generate PNG image.'));
              return;
            }
            resolve(blob);
          },
          'image/png',
          1,
        );
      }),
    [],
  );

  const handleDownload = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await exportBlob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = buildPosterFilename(job, formatId);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      pushToast({ message: 'Job poster downloaded!', type: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : 'Download failed.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [exportBlob, formatId, isExporting, job]);

  const handleShareImage = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await exportBlob();
      const filename = buildPosterFilename(job, formatId);
      const file = new File([blob], filename, { type: 'image/png' });
      await navigator.share({
        files: [file],
        title: `${meta.title} at ${meta.company}`,
        text: `${meta.title} at ${meta.company} (${meta.location}) — Apply here: ${meta.shareUrl}`,
      });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        pushToast({ message: 'Could not open image share sheet. Try Download PNG.', type: 'error' });
      }
    } finally {
      setIsExporting(false);
    }
  }, [exportBlob, formatId, isExporting, job, meta]);

  const handleCopyCaption = useCallback(async () => {
    const captionWithUrl = `${buildInstagramJobCaption(job)}\n\nDirect link: ${meta.shareUrl}`;
    try {
      await navigator.clipboard.writeText(captionWithUrl);
      pushToast({ message: 'Caption & direct link copied!', type: 'success' });
    } catch {
      pushToast({ message: 'Could not copy caption.', type: 'error' });
    }
  }, [job, meta.shareUrl]);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      onClose={handleDialogClose}
      className="m-auto w-[min(94vw,44rem)] max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <h1 id={titleId} className="text-base font-extrabold text-slate-950 sm:text-lg">
            Job Share Poster
          </h1>
          <p className="truncate text-xs text-slate-500">
            Ready for WhatsApp groups, Status &amp; Instagram
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close poster dialog"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          <span aria-hidden="true" className="text-lg font-bold">✕</span>
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {/* Format & Color Selectors */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Poster Size
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_LIST.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormatId(fmt.id)}
                  className={`min-h-10 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    formatId === fmt.id
                      ? 'border-cyan-600 bg-cyan-50 text-cyan-900 ring-1 ring-cyan-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Color Theme
            </p>
            <div className="flex flex-wrap gap-1.5">
              {THEME_LIST.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setThemeId(th.id)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    themeId === th.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-white/40"
                    style={{ backgroundColor: th.accent }}
                    aria-hidden="true"
                  />
                  <span>{th.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Poster Canvas Preview */}
        <div className="relative flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 p-3 sm:p-4">
          <canvas
            ref={canvasRef}
            className="max-h-[48dvh] w-auto max-w-full rounded-xl shadow-lg"
            aria-label={`Generated job poster preview for ${meta.title} at ${meta.company}`}
          />
          {isRendering ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/35 backdrop-blur-[1px]">
              <span className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow">
                Rendering poster…
              </span>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            autoFocus
            disabled={isRendering || isExporting}
            onClick={handleDownload}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-cyan-400 disabled:opacity-60"
          >
            <span>⬇️</span>
            <span>Download PNG</span>
          </button>

          {canShareFile ? (
            <button
              type="button"
              disabled={isRendering || isExporting}
              onClick={handleShareImage}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <span>📤</span>
              <span>Share Image</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleCopyCaption}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <span>📋</span>
            <span>Copy Caption &amp; Link</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
