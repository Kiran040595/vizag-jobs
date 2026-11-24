import { useEffect, useState } from 'react';
import {
  fetchMyApplicationsCount,
  getCachedAppliedJobsCount,
  subscribeAppliedJobsCount,
} from '../services/jobApplications';
import { useStudentAuth } from './useStudentAuth';

export function useAppliedJobsCount() {
  const { isStudent, session } = useStudentAuth();
  const userId = session?.user?.id || null;

  const [count, setCount] = useState(() => {
    if (isStudent && userId) {
      const cached = getCachedAppliedJobsCount(userId);
      if (cached !== null) {
        return cached;
      }
    }
    return 0;
  });

  useEffect(() => {
    let ignore = false;

    if (!session || !isStudent || !userId) {
      setCount(0);
      return undefined;
    }

    // Subscribe to count updates across desktop and mobile components
    const unsubscribe = subscribeAppliedJobsCount((nextCount) => {
      if (!ignore) {
        setCount(nextCount);
      }
    });

    const cached = getCachedAppliedJobsCount(userId);
    if (cached !== null) {
      setCount(cached);
    } else {
      fetchMyApplicationsCount(userId)
        .then((total) => {
          if (!ignore) {
            setCount(total);
          }
        })
        .catch(() => {
          if (!ignore) {
            setCount(0);
          }
        });
    }

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [isStudent, session, userId]);

  return count;
}
