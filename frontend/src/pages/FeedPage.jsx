import { Clock, Search, Tag } from 'lucide-react';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import CategoryPills from '../components/news/CategoryPills';
import NewsFeed from '../components/news/NewsFeed';
import { useCategories } from '../hooks/useCategories';
import { useDebounce, useDocumentTitle } from '../hooks/useUtils';
import { FeedShell } from './HomePage';
import NotFoundPage from './NotFoundPage';

function PageTitle({ icon: Icon, eyebrow, title, subtitle }) {
  return (
    <div className="card relative overflow-hidden px-5 py-6 sm:px-7">
      <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-gold-300/20 blur-3xl" />
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-600 dark:text-gold-400">
        <Icon className="h-4 w-4" aria-hidden="true" /> {eyebrow}
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-black text-navy-900 sm:text-4xl dark:text-white">{title}</h1>
      {subtitle && <p className="mt-1.5 text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function LatestPage() {
  useDocumentTitle('Latest News');
  return (
    <FeedShell
      header={
        <>
          <PageTitle icon={Clock} eyebrow="Updated continuously" title="Latest News" subtitle="Every story, newest first." />
          <div className="mt-5">
            <CategoryPills />
          </div>
        </>
      }
    >
      <NewsFeed />
    </FeedShell>
  );
}

export function CategoryPage() {
  const { slug } = useParams();
  const { categories, loading } = useCategories();
  const category = categories.find((c) => c.slug === slug);
  useDocumentTitle(category?.name || 'Category');

  if (!loading && categories.length && !category) return <NotFoundPage />;

  return (
    <FeedShell
      header={
        <>
          <PageTitle icon={Tag} eyebrow="Category" title={category?.name || '…'} subtitle={category && `${category.postCount} published ${category.postCount === 1 ? 'story' : 'stories'}`} />
          <div className="mt-5">
            <CategoryPills />
          </div>
        </>
      }
    >
      <NewsFeed key={slug} category={slug} emptyTitle="No stories in this category yet." emptyMessage="Check back soon for the latest updates." />
    </FeedShell>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') || '';
  const [value, setValue] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  // Keep the input in sync when the header search changes the URL.
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValue(initial);
  }
  const query = useDebounce(value.trim(), 350);
  useDocumentTitle(query ? `Search: ${query}` : 'Search');

  const onChange = (e) => {
    setValue(e.target.value);
    const q = e.target.value.trim();
    setLastInitial(q); // our own URL update — don't overwrite what the user is typing
    setParams(q ? { q } : {}, { replace: true });
  };

  return (
    <FeedShell
      header={
        <div className="card px-5 py-6 sm:px-7">
          <h1 className="font-display text-3xl font-black text-navy-900 dark:text-white">Search the news</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Searches headlines and story descriptions.</p>
          <div className="relative mt-4">
            <label htmlFor="page-search" className="sr-only">
              Search keywords
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="page-search"
              type="search"
              value={value}
              onChange={onChange}
              maxLength={100}
              autoFocus
              placeholder="e.g. market, cricket, health camp…"
              className="input h-13 rounded-2xl pl-12 text-base"
            />
          </div>
        </div>
      }
    >
      {query ? (
        <>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            Results for <strong className="text-navy-900 dark:text-white">“{query}”</strong>
          </p>
          <NewsFeed key={query} search={query} />
        </>
      ) : (
        <>
          <h2 className="mb-4 font-display text-xl font-bold text-navy-900 dark:text-white">Latest stories</h2>
          <NewsFeed />
        </>
      )}
    </FeedShell>
  );
}
