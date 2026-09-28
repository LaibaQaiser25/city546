import { AlertTriangle, CheckCircle2, CircleDashed, Link2, Unlink } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { referenceApi } from '../../services/aiApi';
import { timeAgo } from '../../utils/format';
import { TiktokIcon } from '../brand/SocialIcons';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

/**
 * TikTok Login Kit connection management. TikTok's official Display API only reads accounts
 * that authorise city546 (e.g. your own channel) — connecting sends you to TikTok to approve.
 */
export default function TikTokConnectionPanel({ status, loading, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await referenceApi.tiktokAuthorize();
      window.location.assign(url); // TikTok redirects back to /admin/ai-style when done
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    try {
      const res = await referenceApi.tiktokDisconnect(removing.id);
      toast.success(res.message);
      setRemoving(null);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="skeleton h-40 rounded-2xl" />;
  const connections = status?.connections || [];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white">
              <TiktokIcon className="h-4 w-4" />
            </span>
            TikTok (Display API)
          </h3>
          <p className="mt-0.5 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Connect TikTok accounts you control (e.g. City 546’s own). TikTok only lets apps read accounts that approve access — other accounts can be added with an export upload.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={connect} loading={busy} disabled={!status?.configured}>
          {!busy && <Link2 className="h-4 w-4" aria-hidden="true" />} Connect TikTok account
        </Button>
      </div>

      {!status?.configured ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <CircleDashed className="h-4 w-4" aria-hidden="true" /> Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI in .env.
        </p>
      ) : connections.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No TikTok accounts connected yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {connections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white">
                  <TiktokIcon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">{c.displayName || c.externalUserId}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Connected {timeAgo(c.createdAt)}</p>
              </div>
              {c.status === 'active' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Active
                </span>
              ) : (
                <button type="button" onClick={connect} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300" title={c.lastError || ''}>
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Reconnect needed
                </button>
              )}
              <button type="button" onClick={() => setRemoving(c)} aria-label={`Disconnect ${c.displayName || 'TikTok account'}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-500/10">
                <Unlink className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Disconnect this TikTok account?"
        message="city546 will revoke its access at TikTok and delete the stored tokens. Reference accounts using it stop syncing until you reconnect. Imported posts are kept."
        confirmLabel="Disconnect"
        onConfirm={disconnect}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
