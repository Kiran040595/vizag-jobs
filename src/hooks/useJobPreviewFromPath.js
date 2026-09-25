import { useEffect, useState } from 'react';
import { displayCompanyName } from '../lib/jobDisplayLabels';
import { parseApplyRouteJobId, parseJobRouteIdentifier } from '../lib/parseJobRouteIdentifier';
import { fetchJobById } from '../services/jobs';

export const useJobPreviewFromPath = (pathname = '') => {
  const [preview, setPreview] = useState({
    title: '',
    company: '',
    isLoading: Boolean(pathname),
  });

  useEffect(() => {
    const identifier = parseJobRouteIdentifier(pathname) || parseApplyRouteJobId(pathname);
    if (!identifier) {
      setPreview({ title: '', company: '', isLoading: false });
      return undefined;
    }

    let cancelled = false;
    setPreview((current) => ({ ...current, isLoading: true }));

    fetchJobById(identifier)
      .then((job) => {
        if (cancelled) {
          return;
        }
        setPreview({
          title: job?.title || '',
          company: job ? displayCompanyName(job.company) : '',
          isLoading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ title: '', company: '', isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return preview;
};
