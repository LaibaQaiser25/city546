import { Mic, Radio } from 'lucide-react';
import { SITE } from '../config/site';
import CategoryPills from '../components/news/CategoryPills';
import HeroBanner from '../components/news/HeroBanner';
import NewsFeed from '../components/news/NewsFeed';
import TrendingList from '../components/news/TrendingList';
import { useDocumentTitle } from '../hooks/useUtils';

export function FeedShell({ children, header }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {header}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">{children}</div>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Sidebar">
          <TrendingList />
          <div className="card overflow-hidden">
            <div className="bg-linear-to-br from-navy-800 to-navy-950 p-5 text-white">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-300">
                <Radio className="h-4 w-4 animate-pulse text-brand-red" aria-hidden="true" /> On air weekly
              </p>
              <p className="mt-2 font-display text-2xl font-black">
                Words <span className="font-script font-normal text-gold-300">with</span> Mirza
              </p>
              <p lang="ur" dir="rtl" className="mt-1 font-urdu text-lg leading-loose text-gold-100">
                {SITE.show.hostUrdu}
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 text-sm text-slate-600 dark:text-slate-300">
              <Mic className="h-5 w-5 shrink-0 text-gold-500" aria-hidden="true" />
              Current affairs, culture and community conversations on {SITE.channel}.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function HomePage() {
  useDocumentTitle();
  return (
    <FeedShell
      header={
        <>
          <HeroBanner />
          <div className="mt-6">
            <CategoryPills />
          </div>
        </>
      }
    >
      <h2 className="mb-4 flex items-center gap-3 font-display text-2xl font-bold text-navy-900 dark:text-white">
        <span className="h-6 w-1.5 rounded-full bg-gold-400" aria-hidden="true" /> Today’s feed
      </h2>
      <NewsFeed />
    </FeedShell>
  );
}
