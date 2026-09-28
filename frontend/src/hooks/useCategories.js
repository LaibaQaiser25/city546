import { useEffect, useState } from 'react';
import { fetchCategories } from '../services/postService';

// Categories rarely change — fetch once per page load and share the result.
let cache = null;
let inflight = null;

export function useCategories() {
  const [categories, setCategories] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    inflight ??= fetchCategories().then((rows) => (cache = rows));
    let active = true;
    inflight
      .then((rows) => active && setCategories(rows))
      .catch(() => {
        inflight = null; // allow a retry on next mount
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { categories, loading };
}

/** Call after creating/deleting posts so counts refresh. */
export const invalidateCategories = () => {
  cache = null;
  inflight = null;
};
