import { ArrowLeft, Compass } from 'lucide-react';
import Button from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useUtils';

export default function NotFoundPage({ title = 'Page not found', message = 'The page you’re looking for doesn’t exist or has been moved.' }) {
  useDocumentTitle(title);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-navy-900 text-gold-300 shadow-lg">
        <Compass className="h-10 w-10" aria-hidden="true" />
      </div>
      <p className="mt-6 font-display text-6xl font-black text-gold-400">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-navy-900 dark:text-white">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
      <Button to="/" className="mt-8" size="lg">
        <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back to the feed
      </Button>
    </div>
  );
}
