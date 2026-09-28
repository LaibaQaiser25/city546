import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * One-line summary of whether AI styling is ready.
 * `status` is the /api/ai/status payload (or null while loading / on error).
 */
export default function AIStatusIndicator({ status, loading, error, compact = false }) {
  const base = 'flex items-start gap-2 text-sm';

  if (loading) {
    return (
      <p className={`${base} text-slate-500`}>
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> Checking AI style…
      </p>
    );
  }
  if (error || !status?.enabled) {
    return (
      <p className={`${base} text-amber-700 dark:text-amber-300`} role="status">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          AI styling is currently unavailable.{!compact && ' You can continue creating the post manually.'}
        </span>
      </p>
    );
  }
  if (!status.hasProfile) {
    return (
      <p className={`${base} text-slate-600 dark:text-slate-300`}>
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
        <span>
          No house style learned yet.{' '}
          <Link to="/admin/ai-style" className="font-semibold text-navy-700 underline underline-offset-2 hover:text-gold-600 dark:text-gold-300">
            Teach it once
          </Link>{' '}
          by adding reference accounts.
        </span>
      </p>
    );
  }
  return (
    <div className={`${base} flex-wrap text-emerald-700 dark:text-emerald-300`} role="status">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Automatically applied</strong>
        <span className="text-slate-600 dark:text-slate-300">
          {' '}
          · based on {status.sourceAccounts} public account{status.sourceAccounts === 1 ? '' : 's'}, {status.sourcePosts} analysed posts
        </span>
      </span>
      {status.demo && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
          <FlaskConical className="h-3 w-3" aria-hidden="true" /> Demo mode — not real AI
        </span>
      )}
    </div>
  );
}
