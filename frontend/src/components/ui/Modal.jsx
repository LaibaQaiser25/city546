import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible modal on the native <dialog> element (focus trap, Esc, backdrop).
 * Portalled to <body> so it never sits inside a parent <form> (Enter can't submit it).
 */
export default function Modal({ open, onClose, title, subtitle, size = 'lg', children, footer, busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  const widths = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-6xl' };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className={`m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] ${widths[size]} overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm open:flex open:flex-col open:animate-pop-in dark:border-white/10 dark:bg-navy-900 dark:text-slate-100`}
    >
      {open && (
        <>
          <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-xl font-bold text-navy-900 dark:text-white">
                {title}
              </h2>
              {subtitle && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-white/10 dark:bg-white/[0.02]">{footer}</footer>}
        </>
      )}
    </dialog>,
    document.body,
  );
}
