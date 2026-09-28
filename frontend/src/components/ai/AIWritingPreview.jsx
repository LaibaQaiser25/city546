import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { aiApi } from '../../services/aiApi';
import { uploadImage } from '../../services/uploadService';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { dataUrlToFile, downloadDataUrl, renderGraphicPng } from './exportGraphic';
import { GraphicPreview } from './NewsGraphic';

const THEMES = ['breaking', 'crime', 'accident', 'politics', 'sports', 'business', 'weather', 'health', 'general'];
const URDU = /[؀-ۿ]/;

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/**
 * AI Generated Preview. Everything is editable; nothing is published from here —
 * "Apply to post" fills the normal form, and the admin publishes as usual.
 */
export default function AIWritingPreview({ open, onClose, result, photos, brand, onRegenerate, regenerating, onApply }) {
  const [draft, setDraft] = useState(() => structuredClone(result.post));
  const [tab, setTab] = useState('post');
  const [feedback, setFeedback] = useState(null);
  const [addHashtags, setAddHashtags] = useState(false);
  const [graphicBusy, setGraphicBusy] = useState(null); // 'download' | 'cover'
  const graphicRef = useRef(null);

  const rtl = URDU.test(`${draft.heading} ${draft.description}`);
  const dirAttr = rtl ? 'rtl' : 'ltr';
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setGraphic = (patch) => setDraft((d) => ({ ...d, graphic: { ...d.graphic, ...patch } }));

  const rate = async (rating) => {
    const next = feedback === rating ? null : rating;
    setFeedback(next);
    try {
      await aiApi.feedback(result.generationId, next);
      if (next === 'good') toast.success('Marked as good style');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const graphicPng = async () => {
    if (!graphicRef.current) throw new Error('Open the News graphic tab first.');
    return renderGraphicPng(graphicRef.current);
  };

  const download = async () => {
    setGraphicBusy('download');
    try {
      downloadDataUrl(await graphicPng(), `city546-news-${result.generationId}.png`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGraphicBusy(null);
    }
  };

  const useAsCover = async () => {
    setGraphicBusy('cover');
    try {
      const url = await uploadImage(dataUrlToFile(await graphicPng(), `news-graphic-${result.generationId}.png`));
      onApply({ imageUrl: url, keepOriginalAsBlock: true });
      toast.success('Graphic set as the cover image');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGraphicBusy(null);
    }
  };

  const apply = () => {
    const tags = addHashtags && draft.hashtags.length ? `\n\n${draft.hashtags.join(' ')}` : '';
    onApply({ heading: draft.heading.trim(), description: `${draft.description.trim()}${tags}`, generationId: result.generationId });
    toast.success('Applied to the post — review and publish when ready');
    onClose();
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText([draft.caption, draft.hashtags.join(' ')].filter(Boolean).join('\n\n'));
      toast.success('Caption copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const { style, provider, warnings } = result;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      busy={!!graphicBusy}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold-500" aria-hidden="true" /> AI generated preview
        </span>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          <span>Inherited news style v{style.version}</span>·<span>{style.accounts} reference accounts</span>·<span>{style.posts} analysed posts</span>
          {provider?.demo && <span className="rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">Demo mode</span>}
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Rate this style">
            <button
              type="button"
              onClick={() => rate('good')}
              aria-pressed={feedback === 'good'}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${feedback === 'good' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" /> Good style
            </button>
            <button
              type="button"
              onClick={() => rate('bad')}
              aria-pressed={feedback === 'bad'}
              aria-label="Not my style"
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${feedback === 'bad' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onRegenerate} loading={regenerating} disabled={!!graphicBusy}>
              {!regenerating && <RefreshCw className="h-4 w-4" aria-hidden="true" />} Regenerate
            </Button>
            <Button variant="gold" onClick={apply} disabled={regenerating || !!graphicBusy || draft.heading.trim().length < 3 || draft.description.trim().length < 10}>
              <Check className="h-4 w-4" aria-hidden="true" /> Apply to post
            </Button>
          </div>
        </div>
      }
    >
      <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] ${regenerating ? 'pointer-events-none opacity-50' : ''}`} aria-busy={regenerating}>
        {/* Editable content */}
        <div className="space-y-4">
          {warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {w.type === 'missing' && <strong>Not in your notes (left out): </strong>}
                    {w.message}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Field label="Heading">
            <input dir={dirAttr} value={draft.heading} onChange={(e) => set({ heading: e.target.value })} className={`input font-display text-lg font-bold ${rtl ? 'font-urdu leading-loose' : ''}`} />
          </Field>
          <Field label="Description" hint="Paragraphs are separated by a blank line.">
            <textarea dir={dirAttr} rows={9} value={draft.description} onChange={(e) => set({ description: e.target.value })} className={`input resize-y leading-relaxed ${rtl ? 'font-urdu text-lg leading-loose' : ''}`} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Social caption">
              <textarea dir={dirAttr} rows={3} value={draft.caption} onChange={(e) => set({ caption: e.target.value })} className="input resize-y text-sm" />
            </Field>
            <Field label="Hashtags" hint="Space-separated">
              <input
                value={draft.hashtags.join(' ')}
                onChange={(e) => set({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                className="input text-sm"
              />
              <span className="mt-2 flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={addHashtags} onChange={(e) => setAddHashtags(e.target.checked)} className="h-4 w-4 accent-gold-500" />
                  Add to post text
                </label>
                <button type="button" onClick={copyCaption} className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-gold-600 dark:text-gold-300">
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy caption
                </button>
              </span>
            </Field>
          </div>

          <details className="rounded-xl border border-slate-200 p-3 dark:border-white/10" open={tab === 'graphic'}>
            <summary className="cursor-pointer text-sm font-bold text-navy-900 dark:text-white">News graphic text</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Tagline">
                <input dir="auto" value={draft.graphic.tagline} onChange={(e) => setGraphic({ tagline: e.target.value })} className="input text-sm" />
              </Field>
              <Field label="Theme">
                <select value={draft.graphic.theme} onChange={(e) => setGraphic({ theme: e.target.value })} className="input text-sm">
                  {THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Context line">
                <input dir="auto" value={draft.graphic.contextLine} onChange={(e) => setGraphic({ contextLine: e.target.value })} className="input text-sm" />
              </Field>
              <Field label="Highlight">
                <input dir="auto" value={draft.graphic.highlight} onChange={(e) => setGraphic({ highlight: e.target.value })} className="input text-sm" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Sub-line">
                  <input dir="auto" value={draft.graphic.subline} onChange={(e) => setGraphic({ subline: e.target.value })} className="input text-sm" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Fact bullets" hint="One per line (up to 4 are shown).">
                  <textarea
                    dir="auto"
                    rows={4}
                    value={draft.graphic.bullets.join('\n')}
                    onChange={(e) => setGraphic({ bullets: e.target.value.split('\n') })}
                    className="input resize-y text-sm"
                  />
                </Field>
              </div>
            </div>
          </details>
        </div>

        {/* Preview */}
        <div className="min-w-0">
          <div className="mb-3 flex rounded-xl bg-slate-100 p-1 dark:bg-white/10" role="tablist" aria-label="Preview">
            {[
              ['post', 'Post', FileText],
              ['graphic', 'News graphic', ImageIcon],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${tab === key ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>

          {tab === 'post' ? (
            <article dir={dirAttr} className="card p-5">
              <h3 className={`font-display text-2xl font-black leading-snug text-navy-900 dark:text-white ${rtl ? 'font-urdu leading-[2]' : ''}`}>{draft.heading}</h3>
              <div className={`mt-3 space-y-3 whitespace-pre-line text-slate-700 dark:text-slate-300 ${rtl ? 'font-urdu text-lg leading-[2.1]' : 'leading-7'}`}>
                {draft.description}
              </div>
              {draft.hashtags.length > 0 && <p className="mt-4 text-sm font-medium text-brand-blue">{draft.hashtags.join(' ')}</p>}
            </article>
          ) : (
            <div>
              <GraphicPreview graphicRef={graphicRef} graphic={draft.graphic} photos={photos} brand={brand} />
              {!photos.length && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Add a cover photo to the post to show it on the graphic.</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={download} loading={graphicBusy === 'download'} disabled={!!graphicBusy}>
                  {graphicBusy !== 'download' && <Download className="h-4 w-4" aria-hidden="true" />} Download PNG
                </Button>
                <Button variant="primary" onClick={useAsCover} loading={graphicBusy === 'cover'} disabled={!!graphicBusy}>
                  {graphicBusy !== 'cover' && <ImageIcon className="h-4 w-4" aria-hidden="true" />} Use as cover
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                “Use as cover” keeps your original photo in the story as an extra image. Branding comes from AI Style → Graphic branding.
              </p>
            </div>
          )}
        </div>
      </div>
      {regenerating && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Writing a new version in the same style…
        </p>
      )}
    </Modal>
  );
}
