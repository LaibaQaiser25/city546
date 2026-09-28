import { ExternalLink, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { aiApi } from '../../services/aiApi';
import { timeAgo } from '../../utils/format';
import Button from '../ui/Button';

/** Recent AI drafts, their feedback, and whether they were published. */
export default function GenerationHistory() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync((signal) => aiApi.generations({ page, limit: 8 }, { signal }), [page]);

  if (error) return <p className="text-sm text-brand-red">{error.message}</p>;
  if (loading && !data) return <div className="skeleton h-40 rounded-2xl" />;
  if (!data.items.length) return <p className="card p-5 text-sm text-slate-500">No AI drafts yet. Use “Generate Styled Post” when creating a post.</p>;

  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {data.items.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p dir="auto" className="line-clamp-1 font-semibold text-navy-900 dark:text-white">
                {g.output.heading}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                <span>{timeAgo(g.createdAt)}</span>
                {g.profileVersion && <span>· style v{g.profileVersion}</span>}
                {g.parentId && <span>· regenerated</span>}
                {g.editRatio != null && <span>· {Math.round(g.editRatio * 100)}% edited before publishing</span>}
              </p>
            </div>
            {g.feedback === 'good' && <ThumbsUp className="h-4 w-4 text-emerald-500" aria-label="Rated good style" />}
            {g.feedback === 'bad' && <ThumbsDown className="h-4 w-4 text-brand-red" aria-label="Rated not my style" />}
            {g.finalPostId ? (
              <Link to={`/news/${g.finalPostId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                Published <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : (
              <span className="text-xs text-slate-400">Not published</span>
            )}
          </li>
        ))}
      </ul>
      {data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 dark:border-white/5">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span className="text-xs text-slate-500">
            {page} / {data.meta.totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
