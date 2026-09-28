import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Heading2,
  Image as ImageIcon,
  Pilcrow,
  Plus,
  RotateCcw,
  Send,
  Type,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useBlocker } from 'react-router-dom';
import { LIMITS } from '../../config/site';
import { useCategories } from '../../hooks/useCategories';
import { uid } from '../../utils/format';
import AIGenerationPanel from '../ai/AIGenerationPanel';
import BlockRenderer from '../news/BlockRenderer';
import PostCard from '../news/PostCard';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import SmartImage from '../ui/SmartImage';
import ImageField from './ImageField';
import { toApiPayload, validatePost } from './postValidation';

const EMPTY = { imageUrl: '', heading: '', description: '', categoryId: '', published: true, blocks: [] };

const BLOCK_META = {
  image: { label: 'Image', icon: ImageIcon, tint: 'text-sky-600 bg-sky-50 dark:bg-sky-400/10 dark:text-sky-300' },
  heading: { label: 'Heading', icon: Heading2, tint: 'text-violet-600 bg-violet-50 dark:bg-violet-400/10 dark:text-violet-300' },
  paragraph: { label: 'Description', icon: Pilcrow, tint: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-400/10 dark:text-emerald-300' },
};

function toFormValues(post) {
  if (!post) return EMPTY;
  return {
    imageUrl: post.imageUrl || '',
    heading: post.heading || '',
    description: post.description || '',
    categoryId: post.category?.id ? String(post.category.id) : '',
    published: post.published ?? true,
    blocks: (post.blocks || []).map((b) => ({ ...b, id: b.id || uid() })),
  };
}

function Counter({ value, max }) {
  const len = value.trim().length;
  return (
    <span className={`text-xs tabular-nums ${len > max ? 'font-semibold text-brand-red' : 'text-slate-400'}`} aria-live="polite">
      {len}/{max}
    </span>
  );
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-brand-red">
      {message}
    </p>
  );
}

/** Small "+" chip shown beside each primary field label. */
function PlusChip({ onClick, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-gold-300 bg-gold-50 pr-3 pl-1.5 text-xs font-bold text-gold-800 transition hover:border-gold-400 hover:bg-gold-100 dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-200 dark:hover:bg-gold-400/20"
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-gold-400 text-navy-950">
        <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      {children}
    </button>
  );
}

function Section({ step, title, hint, action, children, required }) {
  return (
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-bold text-gold-300 dark:bg-gold-400 dark:text-navy-950">
            {step}
          </span>
          <div>
            <h2 className="font-bold text-navy-900 dark:text-white">
              {title} {required && <span className="text-brand-red" aria-hidden="true">*</span>}
            </h2>
            {hint && <p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BlockEditor({ block, index, total, errors, autoFocus, onChange, onMove, onRemove, onBusyChange }) {
  const meta = BLOCK_META[block.type];
  const Icon = meta.icon;
  const base = `block-${block.id}`;
  const textError = errors[`blocks.${index}.text`];
  const max = block.type === 'heading' ? LIMITS.BLOCK_HEADING_MAX : LIMITS.BLOCK_TEXT_MAX;

  return (
    <li className="card overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${meta.tint}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {meta.label} <span className="font-normal text-slate-400">· block {index + 1}</span>
        </span>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move block ${index + 1} up`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Move block ${index + 1} down`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} aria-label={`Remove block ${index + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-500/10">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {block.type === 'image' ? (
          <div className="space-y-3">
            <ImageField id={`${base}-url`} value={block.url} onChange={(url) => onChange({ url })} error={errors[`blocks.${index}.url`]} compact autoFocus={autoFocus} onBusyChange={onBusyChange} />
            <div>
              <label htmlFor={`${base}-caption`} className="sr-only">
                Caption (optional)
              </label>
              <input
                id={`${base}-caption`}
                value={block.caption || ''}
                onChange={(e) => onChange({ caption: e.target.value })}
                maxLength={LIMITS.CAPTION_MAX}
                placeholder="Caption (optional)"
                className="input text-sm"
              />
              <FieldError message={errors[`blocks.${index}.caption`]} />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor={`${base}-text`} className="sr-only">
              {block.type === 'heading' ? 'Sub-heading text' : 'Paragraph text'}
            </label>
            {block.type === 'heading' ? (
              <input
                id={`${base}-text`}
                value={block.text || ''}
                onChange={(e) => onChange({ text: e.target.value })}
                autoFocus={autoFocus}
                placeholder="Sub-heading…"
                aria-invalid={!!textError}
                className={`input font-display text-lg font-bold ${textError ? 'input-error' : ''}`}
              />
            ) : (
              <textarea
                id={`${base}-text`}
                value={block.text || ''}
                onChange={(e) => onChange({ text: e.target.value })}
                autoFocus={autoFocus}
                rows={4}
                placeholder="Write the next part of the story…"
                aria-invalid={!!textError}
                className={`input resize-y leading-relaxed ${textError ? 'input-error' : ''}`}
              />
            )}
            <div className="mt-1 flex justify-between gap-2">
              <FieldError message={textError} />
              <span className="ml-auto">
                <Counter value={block.text || ''} max={max} />
              </span>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Preview({ values, categories }) {
  const [mode, setMode] = useState('card');
  const category = categories.find((c) => String(c.id) === String(values.categoryId)) || null;
  const payload = toApiPayload(values);
  const post = {
    ...payload,
    id: 0,
    views: 0,
    category,
    author: null,
    publishedAt: new Date().toISOString(),
    heading: payload.heading || 'Your headline will appear here',
    description: payload.description || 'Your description will appear here. Keep it short and informative — it’s the first thing readers see in the feed.',
    blocks: payload.blocks.filter((b) => (b.type === 'image' ? b.url : b.text)),
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Eye className="h-4 w-4" aria-hidden="true" /> Live preview
        </h2>
        <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-semibold dark:bg-white/10" role="tablist" aria-label="Preview mode">
          {[
            ['card', 'Feed card'],
            ['story', 'Full story'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`rounded-md px-3 py-1.5 transition ${mode === key ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* `inert` keeps the preview non-interactive (no navigation away from the form) */}
      <div inert className="select-none">
        {mode === 'card' ? (
          <PostCard post={post} />
        ) : (
          <article className="card overflow-hidden">
            <SmartImage src={post.imageUrl} alt="" />
            <div className="p-5">
              {category && <p className="text-xs font-bold uppercase tracking-wider text-gold-600">{category.name}</p>}
              <h3 className="mt-1 font-display text-2xl font-black leading-tight text-navy-900 dark:text-white">{post.heading}</h3>
              <p className="mt-3 mb-4 text-[17px] leading-8 whitespace-pre-line text-slate-800 dark:text-slate-200">{post.description}</p>
              <BlockRenderer blocks={post.blocks} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

/**
 * Shared create/edit form.
 * Primary fields: Image, Heading, Description (all required), each with a (+) action
 * that appends an extra block of that type to the story.
 */
export default function PostForm({ initialPost, submitLabel, onSubmit, onCancel }) {
  const { categories } = useCategories();
  const initial = useMemo(() => toFormValues(initialPost), [initialPost]);
  const [values, setValues] = useState(initial);
  const [formKey, setFormKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [focusBlockId, setFocusBlockId] = useState(null);
  const [tab, setTab] = useState('edit');
  const [confirmReset, setConfirmReset] = useState(false);
  // Image fields report in-flight uploads so the post can't be saved half-finished.
  const [busyFields, setBusyFields] = useState({});
  const setBusy = useCallback((key, busy) => setBusyFields((b) => (!!b[key] === busy ? b : { ...b, [key]: busy })), []);
  const uploading = Object.values(busyFields).some(Boolean);
  // AI draft this post came from (for optional style feedback after publishing).
  const [aiGenerationId, setAiGenerationId] = useState(null);
  const [coverKey, setCoverKey] = useState(0);
  const allowLeave = useRef(false);
  const blocksEndRef = useRef(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const clientErrors = validatePost(values);
  const errors = submitted ? { ...clientErrors, ...serverErrors } : serverErrors;

  // Guard against losing unsaved work (in-app navigation + tab close).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = (patch) => {
    setValues((v) => ({ ...v, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((k) => serverErrors[k])) setServerErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));
  };

  const addBlock = (type) => {
    if (values.blocks.length >= LIMITS.BLOCKS_MAX) return;
    const block = type === 'image' ? { id: uid(), type, url: '', caption: '' } : { id: uid(), type, text: '' };
    setValues((v) => ({ ...v, blocks: [...v.blocks, block] }));
    setFocusBlockId(block.id);
    setTab('edit');
    requestAnimationFrame(() => blocksEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const updateBlock = (id, patch) => setValues((v) => ({ ...v, blocks: v.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const removeBlock = (id) => setValues((v) => ({ ...v, blocks: v.blocks.filter((b) => b.id !== id) }));
  const moveBlock = (index, dir) =>
    setValues((v) => {
      const blocks = [...v.blocks];
      const target = index + dir;
      if (target < 0 || target >= blocks.length) return v;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...v, blocks };
    });

  /** Applies AI output to the form. Nothing is published until the admin submits. */
  const applyAi = (patch) => {
    setValues((v) => {
      const next = { ...v };
      if (patch.heading != null) next.heading = patch.heading;
      if (patch.description != null) next.description = patch.description;
      if (patch.imageUrl) {
        // Keep the admin's original photo in the story when a graphic becomes the cover.
        if (patch.keepOriginalAsBlock && v.imageUrl && v.imageUrl !== patch.imageUrl && !v.blocks.some((b) => b.url === v.imageUrl)) {
          next.blocks = [{ id: uid(), type: 'image', url: v.imageUrl, caption: '' }, ...v.blocks];
        }
        next.imageUrl = patch.imageUrl;
      }
      return next;
    });
    if (patch.imageUrl) setCoverKey((k) => k + 1);
    if (patch.generationId) setAiGenerationId(patch.generationId);
  };

  const reset = () => {
    setAiGenerationId(null);
    setValues(initial);
    setSubmitted(false);
    setServerErrors({});
    setFormKey((k) => k + 1); // remount inputs (clears image drafts)
    setConfirmReset(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) {
      toast('Please wait for the photo upload to finish.', { icon: '⏳' });
      return;
    }
    setSubmitted(true);
    if (Object.keys(clientErrors).length) {
      setTab('edit');
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], .input-error')?.focus());
      return;
    }
    setSaving(true);
    setServerErrors({});
    try {
      allowLeave.current = true;
      await onSubmit(toApiPayload(values), { aiGenerationId });
    } catch (err) {
      allowLeave.current = false;
      const mapped = Object.fromEntries((err.details || []).map((d) => [d.field, d.message]));
      setServerErrors(mapped);
    } finally {
      setSaving(false);
    }
  };

  const errorCount = Object.keys(errors).length;
  const extraCount = values.blocks.length;

  return (
    <form onSubmit={handleSubmit} noValidate className="pb-28">
      {/* Mobile/tablet: Compose ↔ Preview */}
      <div className="mb-4 flex rounded-xl bg-slate-200/70 p-1 xl:hidden dark:bg-white/10" role="tablist" aria-label="Editor view">
        {[
          ['edit', 'Compose', Type],
          ['preview', 'Preview', Eye],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${tab === key ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div key={formKey} className={`space-y-5 ${tab === 'edit' ? '' : 'hidden xl:block'}`}>
          {submitted && errorCount > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              Please fix {errorCount} {errorCount === 1 ? 'issue' : 'issues'} before {values.published ? 'publishing' : 'saving'}.
            </div>
          )}

          {/* 1 — Image */}
          <Section
            step="1"
            title="Image"
            required
            hint="The cover photo shown at the top of the story."
            action={<PlusChip onClick={() => addBlock('image')} label="Add another image to the story">Another image</PlusChip>}
          >
            <ImageField key={coverKey} id="imageUrl" value={values.imageUrl} onChange={(imageUrl) => set({ imageUrl })} error={errors.imageUrl} onBusyChange={(busy) => setBusy('cover', busy)} />
          </Section>

          {/* 2 — Heading */}
          <Section
            step="2"
            title="Heading"
            required
            hint="A clear headline — or just the key facts for AI Style to polish."
            action={<PlusChip onClick={() => addBlock('heading')} label="Add a sub-heading to the story">Sub-heading</PlusChip>}
          >
            <label htmlFor="heading" className="sr-only">
              Heading
            </label>
            <input
              id="heading"
              value={values.heading}
              onChange={(e) => set({ heading: e.target.value })}
              placeholder="e.g. City council approves new emergency response hub"
              aria-invalid={!!errors.heading}
              aria-describedby={errors.heading ? 'heading-error' : undefined}
              className={`input font-display text-xl font-bold ${errors.heading ? 'input-error' : ''}`}
            />
            <div className="mt-1 flex justify-between gap-2">
              <FieldError id="heading-error" message={errors.heading} />
              <span className="ml-auto">
                <Counter value={values.heading} max={LIMITS.HEADING_MAX} />
              </span>
            </div>
          </Section>

          {/* 3 — Description */}
          <Section
            step="3"
            title="Description"
            required
            hint="The story, or raw facts and details for AI Style. Also used as the feed summary."
            action={<PlusChip onClick={() => addBlock('paragraph')} label="Add another paragraph to the story">Paragraph</PlusChip>}
          >
            <label htmlFor="description" className="sr-only">
              Description
            </label>
            <textarea
              id="description"
              value={values.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={6}
              placeholder="What happened, where, and why it matters…"
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : undefined}
              className={`input resize-y leading-relaxed ${errors.description ? 'input-error' : ''}`}
            />
            <div className="mt-1 flex justify-between gap-2">
              <FieldError id="description-error" message={errors.description} />
              <span className="ml-auto">
                <Counter value={values.description} max={LIMITS.DESCRIPTION_MAX} />
              </span>
            </div>
          </Section>

          {/* AI styling layer — uses Heading + Description above as raw facts */}
          <AIGenerationPanel values={values} onApply={applyAi} />

          {/* Extra blocks */}
          <section aria-labelledby="blocks-title" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 id="blocks-title" className="font-bold text-navy-900 dark:text-white">
                More story content <span className="font-normal text-slate-400">({extraCount}/{LIMITS.BLOCKS_MAX})</span>
              </h2>
            </div>
            {extraCount > 0 && (
              <ol className="space-y-3">
                {values.blocks.map((block, i) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    index={i}
                    total={extraCount}
                    errors={errors}
                    autoFocus={block.id === focusBlockId}
                    onChange={(patch) => updateBlock(block.id, patch)}
                    onMove={(dir) => moveBlock(i, dir)}
                    onRemove={() => removeBlock(block.id)}
                    onBusyChange={(busy) => setBusy(block.id, busy)}
                  />
                ))}
              </ol>
            )}
            <div ref={blocksEndRef} className="rounded-2xl border-2 border-dashed border-gold-300/70 bg-gold-50/40 p-4 dark:border-gold-400/25 dark:bg-gold-400/[0.03]">
              <p className="mb-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Add to the story</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {Object.entries(BLOCK_META).map(([type, { label, icon: Icon }]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addBlock(type)}
                    disabled={extraCount >= LIMITS.BLOCKS_MAX}
                    aria-label={`Add ${label.toLowerCase()} block`}
                    className="group flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm font-semibold text-navy-900 shadow-xs transition hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-md disabled:opacity-50 sm:flex-row sm:justify-center sm:py-3.5 dark:border-white/10 dark:bg-navy-900 dark:text-white"
                  >
                    <span className="relative grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-gold-300 transition group-hover:bg-gold-400 group-hover:text-navy-950 dark:bg-gold-400/15">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      <span className="absolute -top-1 -right-1 grid h-4.5 w-4.5 place-items-center rounded-full bg-gold-400 text-navy-950 ring-2 ring-white dark:ring-navy-900">
                        <Plus className="h-3 w-3" strokeWidth={3.5} aria-hidden="true" />
                      </span>
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <FieldError message={errors.blocks} />
            </div>
          </section>

          {/* Settings */}
          <section className="card grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
            <div>
              <label htmlFor="categoryId" className="label">
                Category
              </label>
              <select id="categoryId" value={values.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className="input">
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.categoryId} />
            </div>
            <fieldset>
              <legend className="label">Visibility</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  [true, 'Published', Eye, 'Visible to everyone'],
                  [false, 'Draft', EyeOff, 'Only you can see it'],
                ].map(([val, label, Icon, hint]) => (
                  <label
                    key={label}
                    className={`flex cursor-pointer flex-col rounded-xl border-2 px-3 py-2 transition has-focus-visible:ring-2 has-focus-visible:ring-gold-400 ${
                      values.published === val ? 'border-navy-900 bg-navy-50 dark:border-gold-400 dark:bg-gold-400/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10'
                    }`}
                  >
                    <input type="radio" name="published" aria-label={`${label}: ${hint}`} className="sr-only" checked={values.published === val} onChange={() => set({ published: val })} />
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-900 dark:text-white">
                      <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </div>

        <div className={`${tab === 'preview' ? '' : 'hidden xl:block'}`}>
          <div className="xl:sticky xl:top-24">
            <Preview values={values} categories={categories} />
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-lg lg:left-[260px] dark:border-white/10 dark:bg-navy-950/95">
        <div className="flex items-center gap-2 px-4 py-3 sm:px-6 lg:px-10">
          <p className="hidden text-sm text-slate-500 md:block dark:text-slate-400">
            {dirty ? <span className="font-medium text-amber-600 dark:text-amber-400">● Unsaved changes</span> : 'No changes yet'}
          </p>
          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={!dirty || saving} title="Reset form">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button type="submit" variant={values.published ? 'gold' : 'primary'} loading={saving} disabled={uploading} className="flex-1 sm:flex-none">
              {!saving && <Send className="h-4 w-4" aria-hidden="true" />}
              {uploading ? 'Uploading photo…' : submitLabel(values.published)}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the form?"
        message="All changes since the form was opened will be discarded."
        confirmLabel="Reset"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard unsaved changes?"
        message="You have unsaved changes to this story. If you leave now they’ll be lost."
        confirmLabel="Discard & leave"
        cancelLabel="Keep editing"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </form>
  );
}

