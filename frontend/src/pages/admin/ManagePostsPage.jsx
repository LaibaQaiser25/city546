import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, FileSearch, Pencil, PenSquare, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SmartImage from '../../components/ui/SmartImage';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { invalidateCategories } from '../../hooks/useCategories';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce, useDocumentTitle } from '../../hooks/useUtils';
import { deletePost, fetchAdminPosts, toPayload, updatePost } from '../../services/postService';
import { compactNumber, formatDate, formatDateTime } from '../../utils/format';
import { StatusBadge } from './DashboardPage';

const STATUSES = [
  ['all', 'All'],
  ['published', 'Published'],
  ['draft', 'Drafts'],
];
const LIMIT = 10;

function RowActions({ post, onDelete, onToggle, busy }) {
  const iconBtn = 'grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-navy-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-40';
  return (
    <div className="flex items-center justify-end gap-0.5">
      {post.published && (
        <Link to={`/news/${post.id}`} target="_blank" rel="noopener" className={iconBtn} aria-label={`View “${post.heading}”`} title="View">
          <ExternalLink className="h-4 w-4" />
        </Link>
      )}
      <button type="button" onClick={onToggle} disabled={busy} className={iconBtn} aria-label={post.published ? 'Unpublish (move to drafts)' : 'Publish'} title={post.published ? 'Unpublish' : 'Publish'}>
        {post.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <Link to={`/admin/posts/${post.id}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50 dark:text-gold-300 dark:hover:bg-white/10">
        <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
      </Link>
      <button type="button" onClick={onDelete} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-red hover:bg-red-50 dark:hover:bg-red-500/10">
        <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
      </button>
    </div>
  );
}

export default function ManagePostsPage() {
  useDocumentTitle('Manage posts');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(params.get('q') || '');
  const query = useDebounce(search.trim(), 350);

  const { data, loading, error, reload } = useAsync(
    (signal) => fetchAdminPosts({ search: query, status, page, limit: LIMIT }, { signal }),
    [query, status, page],
  );
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const updateParams = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await deletePost(toDelete.id);
      toast.success(res.message || 'Post deleted successfully.');
      invalidateCategories();
      setToDelete(null);
      // Step back a page if we just emptied this one.
      if (data.posts.length === 1 && page > 1) updateParams({ page: String(page - 1) });
      else reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const togglePublished = async (post) => {
    setBusyId(post.id);
    try {
      await updatePost(post.id, toPayload(post, { published: !post.published }));
      toast.success(post.published ? 'Moved to drafts.' : 'Post published successfully.');
      invalidateCategories();
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const posts = data?.posts || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black text-navy-900 dark:text-white">Manage posts</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{meta ? `${meta.total} ${meta.total === 1 ? 'post' : 'posts'}` : 'Loading…'}</p>
        </div>
        <Button to="/admin/posts/new" variant="gold">
          <PenSquare className="h-4 w-4" aria-hidden="true" /> Create post
        </Button>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="admin-search" className="sr-only">
            Search posts
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="admin-search"
            type="search"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              updateParams({ q: e.target.value.trim(), page: '' });
            }}
            placeholder="Search headings and descriptions…"
            className="input pl-10"
          />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="group" aria-label="Filter by status">
          {STATUSES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => updateParams({ status: key === 'all' ? '' : key, page: '' })}
              className={`h-9 flex-1 rounded-lg px-4 text-sm font-semibold transition sm:flex-none ${
                status === key ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-800 dark:text-white' : 'text-slate-600 hover:text-navy-900 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="card divide-y divide-slate-100 dark:divide-white/5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="skeleton h-14 w-20 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title={query || status !== 'all' ? 'No matching posts' : 'No news yet.'}
          message={query || status !== 'all' ? 'Try a different search or filter.' : 'Create your first story to get the feed going.'}
          action={<Button to="/admin/posts/new">Create post</Button>}
        />
      ) : (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Post</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Created</th>
                  <th scope="col" className="hidden px-4 py-3 xl:table-cell">Updated</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="hidden px-4 py-3 text-right lg:table-cell">Views</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {posts.map((post) => (
                  <tr key={post.id} className="transition hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    <td className="min-w-64 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SmartImage src={post.imageUrl} alt="" aspect="aspect-[4/3]" className="w-20 shrink-0 rounded-lg" />
                        <div className="min-w-0">
                          <Link to={`/admin/posts/${post.id}/edit`} className="line-clamp-2 font-semibold text-navy-900 hover:text-navy-600 dark:text-white dark:hover:text-gold-300">
                            {post.heading}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {post.category?.name || 'Uncategorised'}
                            {post.blocks.length > 0 && ` · ${post.blocks.length} extra block${post.blocks.length > 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-slate-600 lg:table-cell dark:text-slate-300" title={formatDateTime(post.createdAt)}>
                      {formatDate(post.createdAt)}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-slate-600 xl:table-cell dark:text-slate-300" title={formatDateTime(post.updatedAt)}>
                      {formatDate(post.updatedAt)}
                    </td>
                    <td className="w-px px-4 py-3 whitespace-nowrap">
                      <StatusBadge published={post.published} />
                    </td>
                    <td className="hidden px-4 py-3 text-right text-slate-600 tabular-nums lg:table-cell dark:text-slate-300">{compactNumber(post.views)}</td>
                    <td className="w-px px-4 py-3 whitespace-nowrap">
                      <RowActions post={post} busy={busyId === post.id} onDelete={() => setToDelete(post)} onToggle={() => togglePublished(post)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {posts.map((post) => (
              <li key={post.id} className="card overflow-hidden">
                <div className="flex gap-3 p-3">
                  <SmartImage src={post.imageUrl} alt="" aspect="aspect-square" className="w-20 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold text-navy-900 dark:text-white">{post.heading}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <StatusBadge published={post.published} />
                      <span>Created {formatDate(post.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Updated {formatDate(post.updatedAt)}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-2 py-1.5 dark:border-white/5">
                  <RowActions post={post} busy={busyId === post.id} onDelete={() => setToDelete(post)} onToggle={() => togglePublished(post)} />
                </div>
              </li>
            ))}
          </ul>

          {meta && meta.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </Button>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Page <strong>{meta.page}</strong> of <strong>{meta.totalPages}</strong>
              </p>
              <Button variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => updateParams({ page: String(page + 1) })}>
                Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this post?"
        message={
          <>
            <strong className="text-navy-900 dark:text-white">“{toDelete?.heading}”</strong> will be permanently removed from the feed. This can’t be undone.
          </>
        }
        confirmLabel="Delete post"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
