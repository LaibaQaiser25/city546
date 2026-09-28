import { ImagePlus, Link2, Loader2, Plus, RefreshCw, Smartphone, Trash2, UploadCloud, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LIMITS } from '../../config/site';
import { isAbort } from '../../services/api';
import { uploadImage } from '../../services/uploadService';
import { isValidHttpUrl } from '../../utils/format';
import SmartImage from '../ui/SmartImage';

/**
 * Image picker for posts. Three ways to add an image:
 *  1. "Choose photo" — opens the file picker on a computer, or the photo gallery / camera on a phone
 *  2. Drag & drop, or paste an image from the clipboard (desktop)
 *  3. Paste an image link and press (+)
 * Uploads go to POST /api/uploads (admin only); the form only ever stores the resulting URL/path.
 */
export default function ImageField({ id, value, onChange, error, compact = false, autoFocus = false, onBusyChange }) {
  const fileInputId = useId();
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(!value);
  const [localError, setLocalError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [upload, setUpload] = useState(null); // { preview, progress, name }

  // Cancel an in-flight upload and release the preview if this field goes away.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      onBusyChange?.(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => () => upload?.preview && URL.revokeObjectURL(upload.preview), [upload?.preview]);

  const startUpload = async (file) => {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setLocalError('That file isn’t an image. Choose a JPG, PNG, WebP or GIF.');
      return;
    }
    setLocalError('');
    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ preview: URL.createObjectURL(file), progress: 0, name: file.name });
    onBusyChange?.(true);
    try {
      const url = await uploadImage(file, {
        signal: controller.signal,
        onProgress: (progress) => setUpload((u) => u && { ...u, progress }),
      });
      onChange(url);
      setEditing(false);
      toast.success('Photo uploaded');
    } catch (err) {
      if (!isAbort(err)) {
        setLocalError(err.message || 'Upload failed. Please try again.');
        toast.error(err.message || 'Upload failed');
      }
    } finally {
      abortRef.current = null;
      setUpload(null);
      onBusyChange?.(false);
    }
  };

  const applyUrl = () => {
    const url = draft.trim();
    if (!url) return setLocalError('Paste an image link first');
    if (url.length > LIMITS.URL_MAX) return setLocalError('That link is too long');
    if (!isValidHttpUrl(url)) return setLocalError('Enter a valid image link starting with http:// or https://');
    setLocalError('');
    onChange(url);
    setEditing(false);
    setDraft('');
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    startUpload(e.dataTransfer.files?.[0]);
  };

  // Ctrl/Cmd+V of an image (e.g. a screenshot) anywhere in the field uploads it.
  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      startUpload(file);
    }
  };

  const shownError = localError || error;
  const errorId = `${id}-error`;

  // ── Uploading ──
  if (upload) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10" aria-live="polite">
        <div className={`relative ${compact ? 'aspect-[16/8]' : 'aspect-[16/9]'} bg-slate-100 dark:bg-navy-800`}>
          <img src={upload.preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 grid place-items-center bg-navy-950/40">
            <div className="flex w-3/4 max-w-xs flex-col items-center gap-3 rounded-2xl bg-white/95 p-4 text-center shadow-xl dark:bg-navy-900/95">
              <Loader2 className="h-6 w-6 animate-spin text-gold-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-navy-900 dark:text-white">
                {upload.progress < 100 ? `Uploading… ${upload.progress}%` : 'Finishing…'}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.progress}>
                <div className="h-full rounded-full bg-linear-to-r from-gold-300 to-gold-500 transition-all" style={{ width: `${upload.progress}%` }} />
              </div>
              <button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-red">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel upload
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Selected image ──
  if (value && !editing) {
    return (
      <div>
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          <SmartImage src={value} alt="Selected image preview" aspect={compact ? 'aspect-[16/8]' : 'aspect-[16/9]'} />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-linear-to-t from-navy-950/80 to-transparent p-3 pt-10">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/95 px-3 text-sm font-semibold text-navy-900 shadow hover:bg-white"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Replace
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setEditing(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-red px-3 text-sm font-semibold text-white shadow hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
            </button>
          </div>
        </div>
        <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400" title={value}>
          {value.startsWith('/uploads/') ? 'Uploaded photo' : value}
        </p>
      </div>
    );
  }

  // ── Picker ──
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      className={`rounded-xl border-2 border-dashed p-4 transition ${
        dragging
          ? 'border-gold-400 bg-gold-50 dark:bg-gold-400/10'
          : shownError
            ? 'border-brand-red/60 bg-red-50/50 dark:bg-red-500/5'
            : 'border-slate-300 bg-slate-50/60 dark:border-white/15 dark:bg-white/[0.02]'
      } ${compact ? '' : 'sm:p-6'}`}
    >
      {/* Hidden native input: on phones, accept="image/*" offers Photo Library / Gallery and Camera. */}
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          startUpload(e.target.files?.[0]);
          e.target.value = ''; // allow choosing the same file again
        }}
      />

      <div className={`flex flex-col items-center text-center ${compact ? 'gap-2' : 'gap-3'}`}>
        {!compact && (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-100 text-gold-700 dark:bg-gold-400/15 dark:text-gold-300">
            {dragging ? <UploadCloud className="h-6 w-6" aria-hidden="true" /> : <ImagePlus className="h-6 w-6" aria-hidden="true" />}
          </span>
        )}
        <button
          type="button"
          autoFocus={autoFocus}
          onClick={() => fileInputRef.current?.click()}
          aria-describedby={shownError ? errorId : undefined}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-b from-gold-300 to-gold-500 px-5 text-sm font-bold text-navy-950 shadow-sm shadow-gold-600/20 transition hover:from-gold-200 hover:to-gold-400"
        >
          <Plus className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
          {dragging ? 'Drop to upload' : 'Choose photo'}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="pointer-coarse:hidden">From your computer — or drag &amp; drop / paste an image here.</span>
          <span className="hidden items-center gap-1 pointer-coarse:inline-flex">
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> From your gallery or camera.
          </span>{' '}
          JPG, PNG, WebP or GIF.
        </p>
      </div>

      <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /> or paste a link <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor={id} className="sr-only">
            Image link
          </label>
          <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id={id}
            type="url"
            inputMode="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (localError) setLocalError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder="https://example.com/photo.jpg"
            aria-invalid={!!shownError}
            aria-describedby={shownError ? errorId : undefined}
            className={`input pl-9 ${shownError ? 'input-error' : ''}`}
          />
        </div>
        <button
          type="button"
          onClick={applyUrl}
          aria-label="Add image from link"
          title="Add image from link"
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-navy-900 transition hover:border-gold-400 hover:bg-gold-50 dark:border-white/15 dark:bg-navy-900 dark:text-white"
        >
          <Plus className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </button>
        {value && (
          <button type="button" onClick={() => setEditing(false)} className="h-[46px] rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            Cancel
          </button>
        )}
      </div>
      {shownError && (
        <p id={errorId} className="mt-2 text-sm text-brand-red">
          {shownError}
        </p>
      )}
    </div>
  );
}
