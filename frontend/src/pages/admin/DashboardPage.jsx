import { ArrowRight, Eye, FileText, FilePen, Newspaper, PenSquare, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import SmartImage from '../../components/ui/SmartImage';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useUtils';
import { fetchAdminStats } from '../../services/postService';
import { compactNumber, timeAgo } from '../../utils/format';

export function StatusBadge({ published }) {
  return published ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Published
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" /> Draft
    </span>
  );
}

function StatCard({ label, value, icon: Icon, tone, loading }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {loading ? <div className="skeleton mt-3 h-9 w-20" /> : <p className="mt-2 font-display text-4xl font-black text-navy-900 dark:text-white">{value}</p>}
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((signal) => fetchAdminStats({ signal }), []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold-600 dark:text-gold-400">{greeting},</p>
          <h1 className="font-display text-3xl font-black text-navy-900 dark:text-white">{user?.name}</h1>
        </div>
        <Button to="/admin/posts/new" variant="gold" size="lg">
          <PenSquare className="h-5 w-5" aria-hidden="true" /> Create post
        </Button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <>
          <section aria-label="Statistics" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Total posts" value={data?.total} icon={FileText} tone="bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-navy-200" loading={loading} />
            <StatCard label="Published" value={data?.published} icon={Radio} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300" loading={loading} />
            <StatCard label="Drafts" value={data?.drafts} icon={FilePen} tone="bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300" loading={loading} />
            <StatCard label="Total views" value={compactNumber(data?.views)} icon={Eye} tone="bg-gold-50 text-gold-700 dark:bg-gold-400/10 dark:text-gold-300" loading={loading} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="card" aria-labelledby="recent-title">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
                <h2 id="recent-title" className="font-bold text-navy-900 dark:text-white">
                  Recent posts
                </h2>
                <Link to="/admin/posts" className="inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-gold-600 dark:text-gold-300">
                  Manage all <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              {loading ? (
                <ul className="divide-y divide-slate-100 dark:divide-white/5">
                  {[1, 2, 3].map((i) => (
                    <li key={i} className="flex items-center gap-4 px-5 py-4">
                      <div className="skeleton h-14 w-20 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-3/4" />
                        <div className="skeleton h-3 w-1/3" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : data.recent.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No posts yet" message="Your published stories will appear here." action={<Button to="/admin/posts/new">Write the first story</Button>} />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.recent.map((post) => (
                    <li key={post.id}>
                      <Link to={`/admin/posts/${post.id}/edit`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                        <SmartImage src={post.imageUrl} alt="" aspect="aspect-[4/3]" className="w-20 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 font-semibold text-navy-900 dark:text-white">{post.heading}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <StatusBadge published={post.published} />
                            <span>{post.category?.name || 'Uncategorised'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{timeAgo(post.createdAt)}</span>
                          </p>
                        </div>
                        <span className="hidden items-center gap-1 text-sm text-slate-500 sm:flex">
                          <Eye className="h-4 w-4" aria-hidden="true" /> {compactNumber(post.views)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card overflow-hidden" aria-labelledby="quick-title">
              <div className="relative bg-linear-to-br from-navy-800 to-navy-950 p-6 text-white">
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gold-400/25 blur-2xl" />
                <Newspaper className="h-8 w-8 text-gold-300" aria-hidden="true" />
                <h2 id="quick-title" className="mt-3 font-display text-2xl font-bold">
                  Break the news
                </h2>
                <p className="mt-1 text-sm text-navy-200">Image + heading + description is all you need. Add more with the + buttons.</p>
              </div>
              <div className="space-y-2 p-4">
                <Button to="/admin/posts/new" variant="gold" className="w-full">
                  <PenSquare className="h-4 w-4" aria-hidden="true" /> Create post
                </Button>
                <Button to="/" variant="secondary" className="w-full">
                  View the public feed
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
