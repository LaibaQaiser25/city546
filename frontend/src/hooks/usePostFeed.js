import { useCallback, useEffect, useState } from 'react';
import { PAGE_SIZE } from '../config/site';
import { isAbort } from '../services/api';
import { fetchPosts } from '../services/postService';

/**
 * Paginated public feed with "load more".
 * Search / category filtering happens on the server (GET /api/posts?search=…).
 */
export function usePostFeed({ search, category, sort, limit = PAGE_SIZE } = {}) {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify({ search, category, sort, limit, nonce });
  const [state, setState] = useState({ key: null, posts: [], meta: null, error: null });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts({ search, category, sort, page: 1, limit }, { signal: controller.signal })
      .then(({ posts, meta }) => setState({ key, posts, meta, error: null }))
      .catch((error) => {
        if (!isAbort(error)) setState({ key, posts: [], meta: null, error });
      });
    return () => controller.abort();
    // `key` already encodes every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = state.key !== key;
  const { meta } = state;
  const hasMore = !loading && !!meta && meta.page < meta.totalPages;

  /** Loads the next page. Rejects on failure so the caller can show a toast. */
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPosts({ search, category, sort, page: meta.page + 1, limit });
      setState((s) => {
        if (s.key !== key) return s; // filters changed meanwhile
        const seen = new Set(s.posts.map((p) => p.id));
        return { ...s, posts: [...s.posts, ...next.posts.filter((p) => !seen.has(p.id))], meta: next.meta };
      });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, search, category, sort, meta, limit, key]);

  return {
    posts: loading ? [] : state.posts,
    meta: loading ? null : meta,
    error: loading ? null : state.error,
    loading,
    loadingMore,
    failed: !loading && !!state.error,
    hasMore,
    loadMore,
    retry: () => setNonce((n) => n + 1),
  };
}
