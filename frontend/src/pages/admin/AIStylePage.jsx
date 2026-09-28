import { AlertTriangle, BrainCircuit, CheckCircle2, Clock, FileText, Loader2, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AIBrandSettings from '../../components/ai/AIBrandSettings';
import MetaConnectionPanel from '../../components/ai/MetaConnectionPanel';
import TikTokConnectionPanel from '../../components/ai/TikTokConnectionPanel';
import AIStatusIndicator from '../../components/ai/AIStatusIndicator';
import GenerationHistory from '../../components/ai/GenerationHistory';
import ReferenceAccountManager from '../../components/ai/ReferenceAccountManager';
import StyleProfileViewer from '../../components/ai/StyleProfileViewer';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useUtils';
import { aiApi, referenceApi } from '../../services/aiApi';
import { formatDateTime, timeAgo } from '../../utils/format';

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4 text-gold-600" aria-hidden="true" /> {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-black text-navy-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-navy-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AIStylePage() {
  useDocumentTitle('AI Style');
  const overview = useAsync((signal) => aiApi.style({ signal }), []);
  const accounts = useAsync((signal) => referenceApi.list({ signal }), []);
  const settings = useAsync((signal) => aiApi.settings({ signal }), []);
  const usage = useAsync((signal) => aiApi.usage({ signal }), []);
  const connectors = useAsync((signal) => referenceApi.connectors({ signal }), []);
  const [params, setParams] = useSearchParams();

  // Result of the TikTok authorisation redirect (…/admin/ai-style?tiktok=connected|error&message=…)
  const tiktokResult = params.get('tiktok');
  useEffect(() => {
    if (!tiktokResult) return;
    if (tiktokResult === 'connected') toast.success('TikTok account connected', { id: 'tiktok-result' });
    else toast.error(params.get('message') || 'TikTok connection failed', { id: 'tiktok-result', duration: 6000 });
    setParams({}, { replace: true });
  }, [tiktokResult, params, setParams]);

  const o = overview.data;
  const building = !!o?.building;
  const reloadOverview = overview.reload;

  // While a rebuild runs in the background, poll until it finishes.
  useEffect(() => {
    if (!building) return;
    const t = setInterval(reloadOverview, 2000);
    return () => clearInterval(t);
  }, [building, reloadOverview]);

  const rebuild = async () => {
    try {
      const res = await aiApi.rebuild();
      toast.success(res.message);
      reloadOverview();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onAccountsChanged = (info) => {
    accounts.reload();
    connectors.reload();
    reloadOverview();
    if (info?.rebuilding) toast('Updating your style profile in the background…', { icon: '✨' });
  };

  if (overview.error && !o) return <ErrorState message={overview.error.message} onRetry={reloadOverview} />;

  const status = o && {
    ...o.ai,
    hasProfile: !!o.profile,
    sourceAccounts: o.profile?.sourceAccountCount ?? 0,
    sourcePosts: o.profile?.sourcePostCount ?? 0,
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-600 dark:text-gold-400">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Teach it once — it writes that way every time
          </p>
          <h1 className="font-display text-3xl font-black text-navy-900 dark:text-white">AI Writing Style</h1>
          <div className="mt-2">
            <AIStatusIndicator status={status} loading={!o} />
          </div>
        </div>
        <Button onClick={rebuild} loading={building} disabled={!o?.ai.enabled || building || !o?.reference.posts} title={!o?.reference.posts ? 'Add reference posts first' : undefined}>
          {!building && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {building ? 'Learning your style…' : 'Rebuild style profile'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Reference accounts" value={o ? o.reference.accounts : '—'} sub={o && o.reference.totalAccounts !== o.reference.accounts ? `${o.reference.totalAccounts - o.reference.accounts} paused` : 'active'} />
        <Stat icon={FileText} label="Analysed posts" value={o?.profile ? o.profile.sourcePostCount : '—'} sub={o ? `${o.reference.posts} stored` : ''} />
        <Stat icon={Clock} label="Last analysis" value={o?.profile ? timeAgo(o.profile.lastGeneratedAt) : 'Never'} sub={o?.profile && formatDateTime(o.profile.lastGeneratedAt)} />
        <Stat
          icon={BrainCircuit}
          label="Style profile"
          value={building ? 'Updating…' : o?.profile ? `v${o.profile.version}` : 'None'}
          sub={building ? 'running in the background' : o?.needsUpdate ? 'Needs updating — new reference data' : o?.profile ? 'Up to date' : 'Add reference posts'}
        />
      </div>

      {o?.build?.status === 'failed' && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The last rebuild (v{o.build.version}) failed: {o.build.error}. {o.profile ? `Still using v${o.profile.version}.` : ''}
        </p>
      )}
      {o?.needsUpdate && !building && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
          <Clock className="h-4 w-4" aria-hidden="true" /> Your reference posts changed since the last analysis.
          <button type="button" onClick={rebuild} className="font-bold underline underline-offset-2">
            Update the style now
          </button>
        </p>
      )}

      {/* Profile */}
      <Section title="What the AI learned" subtitle="Your house style, in plain language. Used automatically for every generated post.">
        {building && !o?.profile ? (
          <div className="card flex items-center gap-3 p-6 text-slate-600 dark:text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-gold-500" aria-hidden="true" /> Analysing your reference posts…
          </div>
        ) : o?.profile ? (
          <StyleProfileViewer profile={o.profile} />
        ) : (
          <EmptyState icon={BrainCircuit} title="No style profile yet" message="Add public reference accounts and their posts below — the style profile is built automatically." />
        )}
        {o?.versions?.length > 1 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Version history</summary>
            <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
              {o.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2">
                  {v.isActive ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Active" /> : <span className="h-4 w-4" />}
                  <strong>v{v.version}</strong> · {v.status} · {v.sourcePostCount} posts · {formatDateTime(v.lastGeneratedAt || v.createdAt)} · {v.model}
                  {v.error && <span className="text-brand-red">— {v.error}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <ReferenceAccountManager
        accounts={accounts.data || []}
        loading={accounts.loading && !accounts.data}
        analyzedFingerprintOk={!!o?.profile && !o?.needsUpdate}
        connectors={connectors.data}
        onChanged={onAccountsChanged}
      />

      <Section title="Connections" subtitle="Official APIs used to sync reference accounts automatically.">
        <MetaConnectionPanel status={connectors.data?.meta} loading={connectors.loading && !connectors.data} />
        <TikTokConnectionPanel status={connectors.data?.tiktok} loading={connectors.loading && !connectors.data} onChanged={connectors.reload} />
      </Section>

      <Section title="Graphic branding & learning" subtitle="Applied to generated news graphics and future style updates.">
        {settings.data ? <AIBrandSettings initial={settings.data} /> : <div className="skeleton h-64 rounded-2xl" />}
      </Section>

      <Section title="Recent AI drafts" subtitle="Drafts are never published automatically — only what you publish goes live.">
        <GenerationHistory />
      </Section>

      <Section title="AI usage" subtitle="Last 30 days.">
        {usage.data?.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 dark:border-white/5">
                <tr>
                  <th className="px-4 py-2.5">Operation</th>
                  <th className="px-4 py-2.5 text-right">Calls</th>
                  <th className="px-4 py-2.5 text-right">Errors</th>
                  <th className="px-4 py-2.5 text-right">Input tokens</th>
                  <th className="px-4 py-2.5 text-right">Output tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-white/5">
                {usage.data.map((u) => (
                  <tr key={u.operation}>
                    <td className="px-4 py-2.5 font-medium">{u.operation.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-right">{u.calls}</td>
                    <td className="px-4 py-2.5 text-right">{u.errors}</td>
                    <td className="px-4 py-2.5 text-right">{u.inputTokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{u.outputTokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No AI calls yet.</p>
        )}
      </Section>
    </div>
  );
}
