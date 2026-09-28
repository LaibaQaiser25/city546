import { ArrowLeft, CalendarDays, Clock, Eye, EyeOff, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BlockRenderer from '../components/news/BlockRenderer';
import PostCard, { CategoryBadge, Publisher } from '../components/news/PostCard';
import { CopyLinkButton, ShareButton } from '../components/news/ShareActions';
import TrendingList from '../components/news/TrendingList';
import Button from '../components/ui/Button';
import SmartImage from '../components/ui/SmartImage';
import { ErrorState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useUtils';
import { fetchPost, fetchPosts, registerView } from '../services/postService';
import { compactNumber, formatDateTime, readTime, textProps } from '../utils/format';
import NotFoundPage from './NotFoundPage';

/** Counts one view per story per browser session. */
function useViewCounter(post) {
  const [views, setViews] = useState(null);
  useEffect(() => {
    if (!post?.published) return;
    const key = `city546-viewed-${post.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage unavailable — still count the view */
    }
    registerView(post.id).then(setViews).catch(() => {});
  }, [post?.id, post?.published]);
  return views ?? post?.views ?? 0;
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8" aria-busy="true" aria-label="Loading story">
      <div className="skeleton h-9 w-32 rounded-lg" />
      <div className="skeleton mt-8 h-5 w-24 rounded-full" />
      <div className="skeleton mt-4 h-10 w-full" />
      <div className="skeleton mt-2 h-10 w-3/4" />
      <div className="mt-6 flex gap-3">
        <div className="skeleton h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      <div className="skeleton mt-8 aspect-[16/9] w-full rounded-2xl" />
      <div className="mt-8 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: post, error, loading, reload } = useAsync((signal) => fetchPost(id, { signal }), [id, isAdmin]);
  const views = useViewCounter(post);
  const related = useAsync(
    (signal) =>
      post?.category
        ? fetchPosts({ category: post.category.slug, limit: 4 }, { signal }).then((r) => r.posts.filter((p) => p.id !== post.id).slice(0, 2))
        : Promise.resolve([]),
    [post?.id],
  );
  useDocumentTitle(post?.heading || (loading ? 'Loading…' : 'Story'));

  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  if (loading) return <DetailSkeleton />;
  if (error?.status === 404 || error?.status === 400) {
    return <NotFoundPage title="Story not found" message="This story may have been removed or is not published yet." />;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={error.message} onRetry={reload} />
      </div>
    );
  }

  const date = post.publishedAt || post.createdAt;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to feed
            </Button>
            {isAdmin && (
              <Button to={`/admin/posts/${post.id}/edit`} variant="secondary" size="sm">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit story
              </Button>
            )}
          </div>

          {!post.published && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
              <EyeOff className="h-4 w-4" aria-hidden="true" /> Draft — only you (the admin) can see this story.
            </p>
          )}

          <header className="mt-6">
            <CategoryBadge category={post.category} />
            <h1 dir={textProps(post.heading).dir} className={`mt-4 font-display text-3xl font-black leading-tight text-navy-900 sm:text-4xl lg:text-[44px] dark:text-white ${textProps(post.heading, { leading: 'leading-[1.8]' }).className}`}>
              {post.heading}
            </h1>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-4 dark:border-white/10">
              <Publisher post={post} size="lg" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <time dateTime={date}>{formatDateTime(date)}</time>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" /> {readTime(post)} min read
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" aria-hidden="true" /> {compactNumber(views)} views
                </span>
              </div>
            </div>
          </header>

          <SmartImage src={post.imageUrl} alt={post.heading} eager fitPortrait aspect="aspect-[16/9]" className="mt-6 rounded-2xl shadow-sm" />

          <div className="mx-auto mt-8 max-w-[70ch]">
            <p
              dir={textProps(post.description).dir}
              className={`mb-6 text-xl leading-9 font-medium whitespace-pre-line text-slate-800 dark:text-slate-200 ${
                textProps(post.description).className ||
                'first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-6xl first-letter:leading-[0.85] first-letter:font-black first-letter:text-gold-500'
              }`}
            >
              {post.description}
            </p>
            <BlockRenderer blocks={post.blocks} />

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900">
              <p className="text-sm font-semibold text-navy-900 dark:text-white">Found this useful? Share the story.</p>
              <div className="flex items-center">
                <CopyLinkButton postId={post.id} />
                <ShareButton post={post} />
              </div>
            </div>
          </div>

          {related.data?.length > 0 && (
            <section className="mt-12" aria-labelledby="related-title">
              <h2 id="related-title" className="mb-4 font-display text-2xl font-bold text-navy-900 dark:text-white">
                More in {post.category.name}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {related.data.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-10">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-gold-600 dark:text-gold-300">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to all news
            </Link>
          </div>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Trending stories">
          <TrendingList excludeId={post.id} />
        </aside>
      </div>
    </div>
  );
}
