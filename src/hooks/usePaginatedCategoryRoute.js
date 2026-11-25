import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PAGE_SIZE } from '../lib/jobFilters';
import { usePaginatedPublicJobs } from './usePaginatedPublicJobs';

/**
 * Shared server-side pagination + search + URL `?page=` controller for
 * dedicated category/type listing pages (/jobs/it, /jobs/fresher, etc.).
 */
export function usePaginatedCategoryRoute({
  tab = 'all',
  category = 'all',
  jobType = 'all',
  pageSize = PAGE_SIZE,
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTermState] = useState('');
  const listRef = useRef(null);

  const rawPage = Number(searchParams.get('page'));
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const setSearchTerm = useCallback(
    (nextSearch) => {
      setSearchTermState(nextSearch);
      if (searchParams.has('page')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('page');
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const resetSearch = useCallback(() => {
    setSearchTerm('');
  }, [setSearchTerm]);

  const handlePageChange = useCallback(
    (nextPage) => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextPage > 1) {
        nextParams.set('page', String(nextPage));
      } else {
        nextParams.delete('page');
      }
      setSearchParams(nextParams);
      window.requestAnimationFrame(() => {
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [searchParams, setSearchParams],
  );

  const paginated = usePaginatedPublicJobs({
    tab,
    category,
    jobType,
    search: searchTerm,
    page: currentPage,
    pageSize,
  });

  return {
    searchTerm,
    setSearchTerm,
    resetSearch,
    handlePageChange,
    listRef,
    ...paginated,
  };
}
