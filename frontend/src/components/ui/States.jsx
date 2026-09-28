import { AlertTriangle, Loader2, Newspaper, RefreshCw } from 'lucide-react';
import Button from './Button';

export function EmptyState({
  icon: Icon = Newspaper,
  title = 'No news yet.',
  message = 'Check back soon for the latest updates.',
  action,
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center animate-fade-in">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gold-50 text-gold-600 ring-1 ring-gold-200 dark:bg-gold-400/10 dark:text-gold-300 dark:ring-gold-400/20">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>
      <h3 className="font-display text-xl font-bold text-navy-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-slate-600 dark:text-slate-400">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'We couldn’t load this', message, onRetry }) {
  return (
    <div role="alert" className="card flex flex-col items-center px-6 py-12 text-center animate-fade-in">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-brand-red ring-1 ring-red-200 dark:bg-red-500/10 dark:ring-red-500/20">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="font-display text-xl font-bold text-navy-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 max-w-md text-slate-600 dark:text-slate-400">
        {message || 'Something went wrong. Please try again.'}
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      )}
    </div>
  );
}

export function PageSpinner({ label = 'Loading…' }) {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
