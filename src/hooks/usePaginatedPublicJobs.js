import { useEffect, useState } from 'react';
import { PAGE_SIZE } from '../lib/jobFilters';
import { fetchPaginatedPublicJobs, readCachedPaginatedJobs } from '../services/jobs';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Fetch a single server-paginated slice of published jobs for public listing pages.
 * Debounces search input (300ms) and caches responses in-memory for 3 minutes.
 */
export function usePaginatedPublicJobs({
  tab = 'all',
  category = 'all',
  jobType = 'all',
  freshness = 'all',
  source = 'all',
  company = '',
  search = '',
  page = 1,
  pageSize = PAGE_SIZE,
  enabled = true,
} = {}) {
  const normalizedSearch = String(search || '').trim();
  const [debouncedSearch, setDebouncedSearch] = useState(normalizedSearch);

  useEffect(() => {
    if (!normalizedSearch) {
      setDebouncedSearch('');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedSearch]);

  const queryParams = {
    tab,
    category,
    jobType,
    freshness,
    source,
    company: String(company || '').trim(),
    q: debouncedSearch,
    page: Math.max(1, Math.floor(Number(page) || 1)),
    pageSize,
  };
  const activeKey = JSON.stringify(queryParams);

  const initialCached = enabled ? readCachedPaginatedJobs(queryParams) : null;

  const [state, setState] = useState(() => ({
    items: initialCached?.items || [],
    total: initialCached?.total || 0,
    page: initialCached?.page || queryParams.page,
    totalPages: initialCached?.totalPages || 1,
    isLoading: Boolean(enabled && !initialCached),
    isFetching: false,
    loadError: '',
    settledKey: initialCached ? activeKey : null,
  }));

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isMounted = true;
    const cached = readCachedPaginatedJobs(queryParams);
    if (cached) {
      setState((prev) => {
        if (prev.settledKey === activeKey && !prev.isLoading && !prev.isFetching) {
          return prev;
        }
        return {
          items: cached.items,
          total: cached.total,
          page: cached.page,
          totalPages: cached.totalPages,
          isLoading: false,
          isFetching: false,
          loadError: '',
          settledKey: activeKey,
        };
      });
      return undefined;
    }

    setState((prev) => ({
      ...prev,
      isLoading: prev.items.length === 0,
      isFetching: true,
      loadError: '',
    }));

    fetchPaginatedPublicJobs(queryParams)
      .then((result) => {
        if (!isMounted) return;
        setState({
          items: result.items,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          isLoading: false,
          isFetching: false,
          loadError: '',
          settledKey: activeKey,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isFetching: false,
          loadError:
            error instanceof Error
              ? error.message
              : 'Could not load jobs. Please check your connection.',
          settledKey: activeKey,
        }));
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeKey]);

  const isSettled = Boolean(enabled && state.settledKey === activeKey);

  return {
    ...state,
    isLoading: enabled ? (state.isLoading || (!isSettled && state.items.length === 0)) : false,
    isFetching: enabled ? (state.isFetching || !isSettled) : false,
    isSettled,
  };
}
