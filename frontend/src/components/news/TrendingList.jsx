import { Eye, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { fetchPosts } from '../../services/postService';
import { compactNumber, timeAgo } from '../../utils/format';

/** Sidebar: most-viewed stories. */
export default function TrendingList({ excludeId }) {
  const { data, loading, error } = useAsync(
    (signal) => fetchPosts({ sort: 'popular', limit: 6 }, { signal }).then((r) => r.posts),
    [],
  );
  const posts = (data || []).filter((p) => p.id !== excludeId).slice(0, 5);

  if (error) return null;

  return (
    <section className="card p-5" aria-labelledby="trending-title">
      <h2 id="trending-title" className="flex items-center gap-2 font-display text-lg font-bold text-navy-900 dark:text-white">
        <TrendingUp className="h-5 w-5 text-brand-red" aria-hidden="true" /> Trending now
      </h2>
      <div className="gold-rule mt-3 mb-1" />
      <ol className="divide-y divide-slate-100 dark:divide-white/5">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex gap-3 py-3">
                <div className="skeleton h-6 w-6 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-full" />
                  <div className="skeleton h-3.5 w-2/3" />
                </div>
              </li>
            ))
          : posts.map((post, i) => (
              <li key={post.id}>
                <Link to={`/news/${post.id}`} className="group flex gap-3 py-3">
                  <span className="font-display text-2xl font-black leading-none text-gold-400">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 group-hover:text-navy-600 dark:text-slate-200 dark:group-hover:text-gold-300">
                      {post.heading}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {timeAgo(post.publishedAt)}
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Eye className="h-3 w-3" aria-hidden="true" /> {compactNumber(post.views)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
      </ol>
    </section>
  );
}
