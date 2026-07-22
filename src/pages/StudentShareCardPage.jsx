import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentShareCard from '../components/StudentShareCard';
import { fetchStudentProfileShareByToken } from '../services/studentProfileShares';
import { isStudentShareToken } from '../lib/studentProfileShare';

export default function StudentShareCardPage() {
  const { token } = useParams();
  const [share, setShare] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError('');
      setShare(null);

      if (!isStudentShareToken(token)) {
        if (!cancelled) {
          setError('This share link is invalid.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const result = await fetchStudentProfileShareByToken(token);
        if (!cancelled) {
          setShare(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this shared student card.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const title = share?.card?.title
    ? `${share.card.title} | Candidate card`
    : 'Shared candidate card';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50/30 to-white">
      <SEO title={title} description="Shared student candidate profile card." noindex />
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {isLoading ? (
          <LoadingSpinner label="Loading candidate card…" />
        ) : error ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Card unavailable</p>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <Link
              to="/"
              className="mt-6 inline-flex rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              Go to Jobs in Vizag
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-center text-sm text-slate-500">
              Candidate profile shared via Jobs in Vizag
              {share?.companyLabel ? ` for ${share.companyLabel}` : ''}.
            </p>
            <StudentShareCard
              card={share.card}
              companyLabel={share.companyLabel}
            />
            <p className="mt-6 text-center text-xs text-slate-500">
              This link shows only the details selected by the Jobs in Vizag admin team.
            </p>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
