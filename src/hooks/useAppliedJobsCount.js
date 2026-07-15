import { useEffect, useState } from 'react';
import { fetchMyApplications } from '../services/jobApplications';
import { useStudentAuth } from './useStudentAuth';

export function useAppliedJobsCount() {
  const { isStudent, session } = useStudentAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    if (!session || !isStudent) {
      setCount(0);
      return undefined;
    }

    fetchMyApplications()
      .then((rows) => {
        if (!ignore) {
          setCount(rows.length);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCount(0);
        }
      });

    return () => {
      ignore = true;
    };
  }, [isStudent, session]);

  return count;
}
