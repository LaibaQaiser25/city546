import { ChevronDown, Sparkles, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAsync } from '../../hooks/useAsync';
import { aiApi } from '../../services/aiApi';
import Button from '../ui/Button';
import AIStatusIndicator from './AIStatusIndicator';
import AIWritingPreview from './AIWritingPreview';

const OPTIONS = {
  length: [
    ['auto', 'Style default'],
    ['short', 'Short'],
    ['medium', 'Medium'],
    ['long', 'Long'],
  ],
  tone: [
    ['default', 'Style default'],
    ['formal', 'More formal'],
    ['urgent', 'More urgent'],
    ['neutral', 'Calmer'],
  ],
  language: [
    ['auto', 'Same as my notes'],
    ['ur', 'Urdu'],
    ['en', 'English'],
  ],
};

/**
 * The invisible styling layer inside Create/Edit Post: the admin's Heading and
 * Description act as raw facts; one click applies the learned house style.
 * No prompt writing, ever. Optional controls are just that — optional.
 */
export default function AIGenerationPanel({ values, onApply }) {
  const status = useAsync((signal) => aiApi.status({ signal }), []);
  const settings = useAsync((signal) => aiApi.settings({ signal }).catch(() => ({ graphic: {} })), []);
  const [options, setOptions] = useState({ length: 'auto', tone: 'default', language: 'auto' });
  const [showOptions, setShowOptions] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null); // 'generate' | 'regenerate'
  const [error, setError] = useState('');

  const ready = status.data?.enabled && status.data?.hasProfile;
  const heading = values.heading.trim();
  const description = values.description.trim();
  const hasFacts = heading.length >= 3 && description.length >= 10;
  // Graphics we generated become the cover; never feed them back in as "photos".
  const [generatedGraphics, setGeneratedGraphics] = useState(() => new Set());
  const photos = [values.imageUrl, ...values.blocks.filter((b) => b.type === 'image').map((b) => b.url)]
    .filter((url) => url && !generatedGraphics.has(url))
    .slice(0, 2);
  const applyPatch = (patch) => {
    if (patch.imageUrl) setGeneratedGraphics((set) => new Set(set).add(patch.imageUrl));
    onApply(patch);
  };

  const request = () => ({ heading, description, imageUrl: values.imageUrl || null, options });

  const generate = async () => {
    setBusy('generate');
    setError('');
    try {
      setResult(await aiApi.generate(request()));
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy('regenerate');
    try {
      setResult(await aiApi.regenerate({ ...request(), previousGenerationId: result.generationId }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="ai-style-title" className="relative overflow-hidden rounded-2xl border border-gold-300/60 bg-linear-to-br from-gold-50 via-white to-navy-50 p-4 shadow-sm sm:p-5 dark:border-gold-400/25 dark:from-gold-400/[0.06] dark:via-navy-900 dark:to-navy-900">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gold-300/30 blur-2xl dark:bg-gold-400/10" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="ai-style-title" className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-gold-300 dark:bg-gold-400 dark:text-navy-950">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            AI Style
          </h2>
          <div className="mt-2">
            <AIStatusIndicator status={status.data} loading={status.loading} error={status.error} />
          </div>
        </div>
        {ready && (
          <button
            type="button"
            onClick={() => setShowOptions((s) => !s)}
            aria-expanded={showOptions}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Options <ChevronDown className={`h-4 w-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {ready && (
        <>
          {showOptions && (
            <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(OPTIONS).map(([key, list]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">{key}</span>
                  <select value={options[key]} onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.value }))} className="input py-2 text-sm">
                    {list.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" onClick={generate} loading={busy === 'generate'} disabled={!hasFacts || !!busy} className="sm:w-auto">
              {busy !== 'generate' && <WandSparkles className="h-5 w-5" aria-hidden="true" />}
              {busy === 'generate' ? 'Writing in your house style…' : 'Generate Styled Post'}
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasFacts
                ? 'Uses the Heading and Description above as raw facts. Nothing is published until you do.'
                : 'Fill in the Heading and Description above with the basic facts first.'}
            </p>
          </div>
          {error && (
            <p className="relative mt-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
              {error} You can continue creating the post manually.
            </p>
          )}
        </>
      )}

      {result && (
        <AIWritingPreview
          key={result.generationId}
          open
          result={result}
          photos={photos}
          brand={settings.data?.graphic || {}}
          regenerating={busy === 'regenerate'}
          onRegenerate={regenerate}
          onClose={() => setResult(null)}
          onApply={applyPatch}
        />
      )}
    </section>
  );
}
