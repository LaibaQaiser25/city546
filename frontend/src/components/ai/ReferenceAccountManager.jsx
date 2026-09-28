import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileUp,
  Globe,
  PlugZap,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAsync } from '../../hooks/useAsync';
import { referenceApi } from '../../services/aiApi';
import { formatDateTime, timeAgo } from '../../utils/format';
import { parseFile, parseText } from '../../utils/referenceImport';
import { FacebookIcon, InstagramIcon, TiktokIcon, XIcon, YoutubeIcon } from '../brand/SocialIcons';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';
import { EmptyState } from '../ui/States';

export const PLATFORMS = {
  facebook: { label: 'Facebook', icon: FacebookIcon, color: 'bg-[#1877f2] text-white' },
  instagram: { label: 'Instagram', icon: InstagramIcon, color: 'bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white' },
  youtube: { label: 'YouTube', icon: YoutubeIcon, color: 'bg-[#ff0000] text-white' },
  tiktok: { label: 'TikTok', icon: TiktokIcon, color: 'bg-black text-white' },
  x: { label: 'X (Twitter)', icon: XIcon, color: 'bg-black text-white' },
  website: { label: 'Website', icon: Globe, color: 'bg-navy-700 text-white' },
  other: { label: 'Other', icon: Users, color: 'bg-slate-600 text-white' },
};

const EMPTY_FORM = { platform: 'facebook', accountName: '', profileUrl: '', description: '', sourceType: 'manual', feedUrl: '', active: true };

// ── Add / edit ───────────────────────────────────────────────
function AccountFormModal({ open, account, connectors, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    account
      ? { ...EMPTY_FORM, ...account, profileUrl: account.profileUrl || '', description: account.description || '', feedUrl: account.feedUrl || '', externalAccountId: account.externalAccountId || '' }
      : EMPTY_FORM,
  );
  const metaPlatform = form.platform === 'facebook' || form.platform === 'instagram';
  const tiktokConnections = connectors?.tiktok?.connections || [];
  const isTikTok = form.platform === 'tiktok';
  const apiPlatform = metaPlatform || isTikTok;
  const metaReady = isTikTok ? tiktokConnections.length > 0 : !!connectors?.meta?.[form.platform];
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      // The official-API source only exists for Facebook/Instagram.
      if (next.sourceType === 'api' && !['facebook', 'instagram', 'tiktok'].includes(next.platform)) next.sourceType = 'manual';
      // Default a TikTok account to the first connection, and name it after it.
      if (next.sourceType === 'api' && next.platform === 'tiktok' && !next.connectionId && tiktokConnections[0]) {
        next.connectionId = tiktokConnections[0].id;
        if (!next.accountName) next.accountName = tiktokConnections[0].displayName || '';
      }
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const body = {
        ...form,
        accountName: form.accountName.trim(),
        externalAccountId: form.externalAccountId?.trim() || null,
        connectionId: form.sourceType === 'api' && isTikTok ? Number(form.connectionId) || null : null,
      };
      const res = account ? await referenceApi.update(account.id, body) : await referenceApi.create(body);
      toast.success(res.message);
      onSaved(res.data, !account);
    } catch (err) {
      setErrors(Object.fromEntries((err.details || []).map((d) => [d.field, d.message])));
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <span className="mt-1 block text-sm text-brand-red">{errors[k]}</span>;

  return (
    <Modal open={open} onClose={onClose} busy={saving} size="md" title={account ? 'Edit reference account' : 'Add a public account'} subtitle="Its public posts become style examples for the AI.">
      <form id="account-form" onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">Platform</span>
          <select value={form.platform} onChange={(e) => set({ platform: e.target.value })} className="input">
            {Object.entries(PLATFORMS).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Account</span>
          <input value={form.accountName} onChange={(e) => set({ accountName: e.target.value })} placeholder="@example_news" className="input" required maxLength={120} />
          {err('accountName')}
        </label>
        <label className="block">
          <span className="label">Public profile URL <span className="font-normal text-slate-400">(optional)</span></span>
          <input type="url" value={form.profileUrl} onChange={(e) => set({ profileUrl: e.target.value })} placeholder="https://…" className="input" />
          {err('profileUrl')}
        </label>
        <label className="block">
          <span className="label">Description <span className="font-normal text-slate-400">(optional)</span></span>
          <input value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Regional crime & local news" className="input" maxLength={500} />
        </label>
        <fieldset>
          <legend className="label">How do posts get in?</legend>
          <div className={`grid gap-2 ${apiPlatform ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {[
              ['manual', 'I’ll add them', 'Paste posts, or upload a JSON/CSV export you’re allowed to use.', FileUp],
              ['feed', 'Public RSS/Atom feed', 'e.g. a news site’s RSS, or a YouTube channel feed.', Rss],
              ...(metaPlatform
                ? [['api', 'Official Meta API', metaReady ? 'Sync posts through the Facebook/Instagram Graph API.' : 'Not set up on the server yet (see below).', PlugZap]]
                : []),
              ...(isTikTok
                ? [['api', 'Connected TikTok account', metaReady ? 'Sync videos from an account you connected.' : 'Connect a TikTok account first (Connections below).', PlugZap]]
                : []),
            ].map(([val, title, hint, Icon]) => (
              <label key={val} className={`flex cursor-pointer gap-2 rounded-xl border-2 p-3 has-focus-visible:ring-2 has-focus-visible:ring-gold-400 ${form.sourceType === val ? 'border-navy-900 bg-navy-50 dark:border-gold-400 dark:bg-gold-400/10' : 'border-slate-200 dark:border-white/10'} ${val === 'api' && !metaReady ? 'opacity-60' : ''}`}>
                <input type="radio" name="sourceType" className="sr-only" disabled={val === 'api' && !metaReady} checked={form.sourceType === val} onChange={() => set({ sourceType: val })} />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {metaPlatform && !metaReady && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
            To sync {form.platform === 'facebook' ? 'Facebook Pages' : 'Instagram accounts'} automatically, set <code>META_ACCESS_TOKEN</code>
            {form.platform === 'instagram' && (
              <>
                {' '}
                and <code>META_IG_USER_ID</code>
              </>
            )}{' '}
            in the server’s <code>.env</code> (see README → Meta connectors). Until then, upload an export instead.
          </p>
        )}
        {isTikTok && !metaReady && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
            TikTok’s official API only reads accounts that approve city546. Connect one under AI Style → Connections → TikTok, or upload an export for other accounts.
          </p>
        )}
        {form.sourceType === 'api' && isTikTok && (
          <label className="block">
            <span className="label">Connected TikTok account</span>
            <select value={form.connectionId || ''} onChange={(e) => set({ connectionId: Number(e.target.value) || null })} className="input">
              {tiktokConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName || c.externalUserId}
                  {c.status !== 'active' ? ' (reconnect needed)' : ''}
                </option>
              ))}
            </select>
            {err('connectionId')}
          </label>
        )}
        {form.sourceType === 'api' && !isTikTok && (
          <label className="block">
            <span className="label">{form.platform === 'facebook' ? 'Facebook Page ID, username or URL' : 'Instagram username'}</span>
            <input
              value={form.externalAccountId}
              onChange={(e) => set({ externalAccountId: e.target.value })}
              placeholder={form.platform === 'facebook' ? 'e.g. citynews or https://facebook.com/citynews' : 'e.g. local_news'}
              className="input"
              maxLength={200}
            />
            <span className="mt-1 block text-xs text-slate-500">
              {form.platform === 'facebook'
                ? 'Pages you manage work with a Page token. Other public Pages need Meta’s “Page Public Content Access” feature.'
                : 'Must be a public Instagram Business or Creator account (read via Business Discovery).'}{' '}
              Leave blank to use the account / profile URL above.
            </span>
            {err('externalAccountId')}
          </label>
        )}
        {form.sourceType === 'feed' && (
          <label className="block">
            <span className="label">Feed URL</span>
            <input type="url" value={form.feedUrl} onChange={(e) => set({ feedUrl: e.target.value })} placeholder="https://example.com/rss.xml" className="input" />
            <span className="mt-1 block text-xs text-slate-500">YouTube channel feed: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID</span>
            {err('feedUrl')}
          </label>
        )}
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-400">
          Only use public content you’re permitted to access. city546 reads public feeds, the official Meta API, and datasets you supply — it never logs in to platforms, scrapes pages, or bypasses limits or restrictions.
        </p>
      </form>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form="account-form" loading={saving}>
          {account ? 'Save changes' : 'Add account'}
        </Button>
      </div>
    </Modal>
  );
}

// ── Import dataset ───────────────────────────────────────────
function ImportModal({ account, onClose, onImported }) {
  const [mode, setMode] = useState('paste');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const posts = mode === 'paste' ? parseText(text) : parsed || [];

  const onFile = async (file) => {
    setError('');
    setParsed(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError('That file is larger than 10 MB.');
    try {
      setParsed(parseFile(file.name, await file.text()));
    } catch (err) {
      setError(err.message);
    }
  };

  const doImport = async () => {
    setBusy(true);
    let added = 0;
    let rebuilding = false;
    try {
      // Send in batches to keep requests small.
      for (let i = 0; i < posts.length; i += 200) {
        const res = await referenceApi.importPosts(account.id, posts.slice(i, i + 200));
        added += res.data.added;
        rebuilding ||= res.data.rebuilding;
      }
      toast.success(added ? `Imported ${added} new post${added === 1 ? '' : 's'}` : 'All of these posts were already imported');
      onImported({ rebuilding });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={busy} size="lg" title={`Import posts · ${account.accountName}`} subtitle="Style examples only — the AI learns tone and format, never copies them.">
      <div className="mb-4 flex rounded-xl bg-slate-100 p-1 dark:bg-white/10" role="tablist">
        {[
          ['paste', 'Paste posts'],
          ['file', 'Upload file'],
        ].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-9 flex-1 rounded-lg text-sm font-semibold ${mode === k ? 'bg-white shadow-sm dark:bg-navy-800' : 'text-slate-600 dark:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'paste' ? (
        <label className="block">
          <span className="label">Posts</span>
          <textarea
            dir="auto"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input resize-y font-urdu text-base leading-loose"
            placeholder={'First post text…\n---\nSecond post text…\n---\nThird post text…'}
          />
          <span className="mt-1 block text-xs text-slate-500">Separate posts with a line containing only ---</span>
        </label>
      ) : (
        <div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-gold-400 dark:border-white/15">
            <FileUp className="h-8 w-8 text-gold-600" aria-hidden="true" />
            <span className="font-semibold">Choose a .json, .csv or .txt file</span>
            <span className="text-xs text-slate-500">JSON: an array of posts or strings (Facebook/Instagram exports work). CSV: a “content”, “text” or “message” column.</span>
            <input type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
        </div>
      )}
      {posts.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="text-sm font-semibold">{posts.length} post{posts.length === 1 ? '' : 's'} ready to import</p>
          <p dir="auto" className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            {posts[0].content}
          </p>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={doImport} loading={busy} disabled={!posts.length}>
          Import {posts.length || ''} post{posts.length === 1 ? '' : 's'}
        </Button>
      </div>
    </Modal>
  );
}

// ── View / remove posts ──────────────────────────────────────
function PostsModal({ account, onClose, onChanged }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, setData } = useAsync((signal) => referenceApi.posts(account.id, { page, limit: 15 }, { signal }), [account.id, page]);
  const state = { loading, items: data?.items || [], meta: data?.meta };

  const remove = async (id) => {
    try {
      await referenceApi.removePost(account.id, id);
      setData((d) => ({ ...d, items: d.items.filter((p) => p.id !== id) }));
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={`Reference posts · ${account.accountName}`} subtitle={state.meta ? `${state.meta.total} stored` : 'Loading…'}>
      {error ? (
        <p className="text-sm text-brand-red">{error.message}</p>
      ) : state.loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !state.items.length ? (
        <p className="text-sm text-slate-500">No posts yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {state.items.map((p) => (
            <li key={p.id} className="flex gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p dir="auto" className="line-clamp-3 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                  {p.content}
                </p>
                <p className="mt-1 text-xs text-slate-400">{p.publishedAt ? formatDateTime(p.publishedAt) : `Added ${timeAgo(p.createdAt)}`}</p>
              </div>
              <button type="button" onClick={() => remove(p.id)} aria-label="Remove this reference post" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.meta?.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {state.meta.totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= state.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </Modal>
  );
}

// ── Card ─────────────────────────────────────────────────────
export function ReferenceAccountCard({ account, analyzed, onSync, syncing, onImport, onView, onEdit, onToggle, onRemove }) {
  const p = PLATFORMS[account.platform] || PLATFORMS.other;
  const Icon = p.icon;
  return (
    <article className={`card flex flex-col p-4 transition ${account.active ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${p.color}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-navy-900 dark:text-white" title={account.accountName}>
            {account.accountName}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {p.label} ·{' '}
            {account.sourceType === 'feed'
              ? 'Public feed'
              : account.sourceType === 'api'
                ? account.platform === 'tiktok'
                  ? account.connectionId
                    ? 'Connected TikTok account'
                    : 'TikTok — not connected'
                  : 'Official Meta API'
                : 'Manual dataset'}
          </p>
        </div>
        {account.profileUrl && (
          <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" aria-label="Open public profile" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-navy-900 dark:hover:bg-white/10">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-navy-900 dark:text-white">{account.postCount} reference posts</span>
        {!account.active ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Pause className="h-3.5 w-3.5" aria-hidden="true" /> Paused
          </span>
        ) : account.postCount === 0 ? (
          <span className="text-xs font-semibold text-amber-600">Needs posts</span>
        ) : analyzed ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Analysed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Waiting for style update
          </span>
        )}
      </div>
      {account.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{account.description}</p>}
      {account.lastSyncError ? (
        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">Last sync: {account.lastSyncError}</p>
      ) : account.lastSyncedAt ? (
        <p className="mt-2 text-xs text-slate-400">Updated {timeAgo(account.lastSyncedAt)}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
        {account.sourceType === 'feed' || account.sourceType === 'api' ? (
          <Button size="sm" variant="secondary" onClick={onSync} loading={syncing}>
            {!syncing && <RefreshCw className="h-4 w-4" aria-hidden="true" />} Refresh posts
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onImport}>
            <FileUp className="h-4 w-4" aria-hidden="true" /> Import posts
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onView} disabled={!account.postCount}>
          View
        </Button>
        <div className="ml-auto flex">
          <button type="button" onClick={onToggle} aria-label={account.active ? 'Pause (exclude from style)' : 'Resume (include in style)'} title={account.active ? 'Pause' : 'Resume'} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            {account.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit account" title="Edit" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} aria-label="Remove account" title="Remove" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Manager ──────────────────────────────────────────────────
export default function ReferenceAccountManager({ accounts, loading, analyzedFingerprintOk, connectors, onChanged }) {
  const [form, setForm] = useState(null); // { account? }
  const [importing, setImporting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  const sync = async (a) => {
    setSyncingId(a.id);
    try {
      const res = await referenceApi.sync(a.id);
      toast.success(res.message);
      onChanged({ rebuilding: res.data.rebuilding });
    } catch (err) {
      toast.error(err.message);
      onChanged();
    } finally {
      setSyncingId(null);
    }
  };

  const toggle = async (a) => {
    try {
      await referenceApi.update(a.id, {
        ...a,
        profileUrl: a.profileUrl || null,
        feedUrl: a.feedUrl || null,
        externalAccountId: a.externalAccountId || null,
        connectionId: a.connectionId || null,
        active: !a.active,
      });
      toast.success(a.active ? 'Paused — excluded from the style' : 'Resumed — included in the style');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    try {
      await referenceApi.remove(removing.id);
      toast.success('Reference account removed');
      setRemoving(null);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section aria-labelledby="ref-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ref-title" className="font-display text-2xl font-bold text-navy-900 dark:text-white">
            Learned from
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Public accounts whose posts define your house style.</p>
        </div>
        <Button variant="gold" onClick={() => setForm({})}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add public account
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No reference accounts yet"
          message="Add one or more public news accounts. Their posts teach the AI your style — once."
          action={
            <Button onClick={() => setForm({})}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add public account
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <ReferenceAccountCard
              key={a.id}
              account={a}
              analyzed={analyzedFingerprintOk}
              syncing={syncingId === a.id}
              onSync={() => sync(a)}
              onImport={() => setImporting(a)}
              onView={() => setViewing(a)}
              onEdit={() => setForm({ account: a })}
              onToggle={() => toggle(a)}
              onRemove={() => setRemoving(a)}
            />
          ))}
        </div>
      )}

      {form && (
        <AccountFormModal
          open
          account={form.account}
          connectors={connectors}
          onClose={() => setForm(null)}
          onSaved={(saved, isNew) => {
            setForm(null);
            onChanged();
            if (isNew && saved.sourceType === 'manual') setImporting(saved);
            if (isNew && (saved.sourceType === 'feed' || saved.sourceType === 'api')) sync(saved);
          }}
        />
      )}
      {importing && (
        <ImportModal
          account={importing}
          onClose={() => setImporting(null)}
          onImported={(info) => {
            setImporting(null);
            onChanged(info);
          }}
        />
      )}
      {viewing && <PostsModal account={viewing} onClose={() => setViewing(null)} onChanged={() => onChanged()} />}
      <ConfirmDialog
        open={!!removing}
        title="Remove this reference account?"
        message={`“${removing?.accountName}” and its ${removing?.postCount ?? 0} stored posts will be deleted. The current style profile stays until you rebuild it.`}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
