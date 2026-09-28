import { CheckCircle2, CircleDashed, PlugZap, XCircle } from 'lucide-react';
import { useState } from 'react';
import { referenceApi } from '../../services/aiApi';
import { FacebookIcon, InstagramIcon } from '../brand/SocialIcons';
import Button from '../ui/Button';

function Row({ icon: Icon, color, label, ok, detail }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${color}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      {ok ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Configured" />
      ) : (
        <CircleDashed className="h-5 w-5 text-slate-400" aria-label="Not configured" />
      )}
    </div>
  );
}

/** Shows whether the official Meta connectors are configured, and lets the admin test the token. */
export default function MetaConnectionPanel({ status, loading }) {
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  const test = async () => {
    setChecking(true);
    try {
      setCheck(await referenceApi.checkMeta());
    } catch (err) {
      setCheck({ error: err.message });
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div className="skeleton h-40 rounded-2xl" />;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <PlugZap className="h-4.5 w-4.5 text-gold-600" aria-hidden="true" /> Meta Graph API
            {status?.version && <span className="text-xs font-medium text-slate-400">{status.version}</span>}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Credentials live only in the server’s .env — never in the browser.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={test} loading={checking} disabled={!status?.facebook}>
          Test connection
        </Button>
      </div>

      <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
        <Row
          icon={FacebookIcon}
          color="bg-[#1877f2] text-white"
          label="Facebook Pages"
          ok={status?.facebook}
          detail={status?.facebook ? 'Ready — choose “Official Meta API” when adding a Facebook account.' : 'Set META_ACCESS_TOKEN in .env.'}
        />
        <Row
          icon={InstagramIcon}
          color="bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"
          label="Instagram (Business Discovery)"
          ok={status?.instagram}
          detail={status?.instagram ? 'Ready — reads public Business/Creator accounts.' : 'Set META_ACCESS_TOKEN and META_IG_USER_ID in .env.'}
        />
      </div>

      {check && (
        <div
          role="status"
          className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${
            check.error ? 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'
          }`}
        >
          {check.error ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>
            {check.error
              ? check.error
              : `Token works (owner: ${check.tokenOwner}).${check.instagramAccount ? ` Instagram account: ${check.instagramAccount}.` : ''}`}
          </span>
        </div>
      )}
    </div>
  );
}
