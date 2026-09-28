import { ChevronDown, SearchX } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePostFeed } from '../../hooks/usePostFeed';
import Button from '../ui/Button';
import { EmptyState, ErrorState } from '../ui/States';
import PostCard, { PostCardSkeleton } from './PostCard';

/** Server-filtered, paginated feed of post cards. */
export default function NewsFeed({ search, category, emptyTitle, emptyMessage }) {
  const feed = usePostFeed({ search, category });

  if (feed.loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2" aria-busy="true" aria-label="Loading news">
        {Array.from({ length: 4 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (feed.failed) {
    return <ErrorState title="We couldn’t load the news" message={feed.error?.message} onRetry={feed.retry} />;
  }

  if (!feed.posts.length) {
    return search ? (
      <EmptyState
        icon={SearchX}
        title={`No results for “${search}”`}
        message="Try different keywords, or browse the latest stories instead."
      />
    ) : (
      <EmptyState title={emptyTitle} message={emptyMessage} />
    );
  }

  const onLoadMore = () => feed.loadMore().catch((err) => toast.error(err.message));

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {feed.posts.map((post, i) => (
          <div key={post.id} className={i === 0 && !search ? 'sm:col-span-2' : ''}>
            <PostCard post={post} priority={i < 2} />
          </div>
        ))}
        {feed.loadingMore && [0, 1].map((i) => <PostCardSkeleton key={`more-${i}`} />)}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        {feed.hasMore ? (
          <Button variant="secondary" size="lg" onClick={onLoadMore} loading={feed.loadingMore}>
            {!feed.loadingMore && <ChevronDown className="h-5 w-5" aria-hidden="true" />}
            Load more stories
          </Button>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">You’re all caught up ✨</p>
        )}
        <p className="text-xs text-slate-400" aria-live="polite">
          Showing {feed.posts.length} of {feed.meta?.total ?? feed.posts.length}
        </p>
      </div>
    </div>
  );
}
