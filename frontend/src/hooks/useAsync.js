import { useCallback, useEffect, useState } from 'react';
import { isAbort } from '../services/api';

/**
 * Runs `fn(signal)` whenever `deps` change; cancels stale requests.
 * While a new request is in flight, the previous `data` stays available
 * (handy for "stale while reloading" lists) and `loading` is true.
 * Returns { data, error, loading, reload, setData }.
 */
export function useAsync(fn, deps = []) {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([...deps, nonce]);
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    fn(controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error) => {
        if (!isAbort(error)) setState((s) => ({ key, data: s.data, error }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  const settled = state.key === key;
  return {
    data: settled && state.error ? null : state.data,
    error: settled ? state.error : null,
    loading: !settled,
    reload,
    setData,
  };
}
