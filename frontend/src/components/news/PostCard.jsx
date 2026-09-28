import { BadgeCheck, Clock, Eye, Heading2, Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SITE } from '../../config/site';
import { compactNumber, formatDateTime, mediaUrl, readTime, textProps, timeAgo } from '../../utils/format';
import SmartImage from '../ui/SmartImage';
import { CopyLinkButton, ShareButton } from './ShareActions';

export function CategoryBadge({ category, overlay = false }) {
  if (!category) return null;
  const breaking = category.slug === 'breaking';
  return (
    <Link
      to={`/category/${category.slug}`}
      className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
        breaking
          ? 'bg-brand-red text-white hover:bg-red-700'
          : overlay
            ? 'bg-navy-950/75 text-gold-200 backdrop-blur hover:bg-navy-950/90'
            : 'bg-gold-100 text-gold-800 hover:bg-gold-200 dark:bg-gold-400/15 dark:text-gold-300'
      }`}
    >
      {breaking && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />}
      {category.name}
    </Link>
  );
}

export function Publisher({ post, size = 'md' }) {
  const date = post.publishedAt || post.createdAt;
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`flex shrink-0 flex-col items-center justify-center rounded-full bg-navy-900 leading-none ring-2 ring-gold-400/70 ${size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'}`}
      >
        <span className={`rounded-[3px] bg-brand-red px-1 py-px font-black text-white ${size === 'lg' ? 'text-[11px]' : 'text-[9px]'}`}>546</span>
        <span className="mt-0.5 text-[6px] font-bold tracking-wider text-gold-300">NEWS</span>
      </span>
      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-1 text-sm font-bold text-navy-900 dark:text-white">
          {post.author?.name || SITE.authorLabel}
          <BadgeCheck className="h-4 w-4 text-gold-500" aria-label="Verified publisher" />
        </p>
        <time dateTime={date} title={formatDateTime(date)} className="text-xs text-slate-500 dark:text-slate-400">
          {timeAgo(date)}
        </time>
      </div>
    </div>
  );
}

/** Social-feed style news card. The whole card is clickable via a stretched link. */
export default function PostCard({ post, priority = false }) {
  const extraImages = post.blocks.filter((b) => b.type === 'image');
  const sections = post.blocks.filter((b) => b.type === 'heading').length;

  return (
    <article className="card group relative transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy-900/5 animate-fade-in">
      <div className="relative overflow-hidden rounded-t-2xl">
        <SmartImage src={post.imageUrl} alt="" eager={priority} imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-navy-950/50 to-transparent" />
        <div className="absolute top-3 left-3">
          <CategoryBadge category={post.category} overlay />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <Publisher post={post} />

        <h2 dir={textProps(post.heading).dir} className={`mt-3 font-display text-xl font-bold leading-snug ${textProps(post.heading, { leading: 'leading-[1.9]' }).className} text-navy-900 transition-colors group-hover:text-navy-600 dark:text-white dark:group-hover:text-gold-300 sm:text-[22px]`}>
          <Link to={`/news/${post.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {post.heading}
          </Link>
        </h2>
        <p dir={textProps(post.description).dir} className={`mt-2 line-clamp-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 ${textProps(post.description).className}`}>{post.description}</p>

        {/* Preview of the appended story blocks */}
        {(extraImages.length > 0 || sections > 0) && (
          <div className="mt-3.5 flex items-center gap-3">
            {extraImages.length > 0 && (
              <div className="flex -space-x-2">
                {extraImages.slice(0, 3).map((b) => (
                  <img
                    key={b.id || b.url}
                    src={mediaUrl(b.url)}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-lg border-2 border-white object-cover dark:border-navy-900"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {extraImages.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Images className="h-3.5 w-3.5" aria-hidden="true" /> +{extraImages.length} photo{extraImages.length > 1 && 's'}
                </span>
              )}
              {sections > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Heading2 className="h-3.5 w-3.5" aria-hidden="true" /> {sections} section{sections > 1 && 's'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="relative z-10 flex items-center justify-between border-t border-slate-100 px-2.5 py-1.5 dark:border-white/5 sm:px-3.5">
        <div className="flex items-center gap-3 pl-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1" title="Estimated reading time">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {readTime(post)} min read
          </span>
          <span className="inline-flex items-center gap-1" title={`${post.views} views`}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {compactNumber(post.views)}
            <span className="sr-only">views</span>
          </span>
        </div>
        <div className="flex items-center">
          <CopyLinkButton postId={post.id} compact />
          <ShareButton post={post} />
        </div>
      </footer>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2.5">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-16" />
          </div>
        </div>
        <div className="skeleton h-5 w-11/12" />
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
      </div>
      <div className="flex justify-between border-t border-slate-100 px-5 py-3.5 dark:border-white/5">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-3 w-16" />
      </div>
    </div>
  );
}
