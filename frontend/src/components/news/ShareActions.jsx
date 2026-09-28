import { Check, Link2, Share2, X as Close } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { postUrl } from '../../utils/format';
import { FacebookIcon, WhatsappIcon, XIcon } from '../brand/SocialIcons';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  }
}

export function CopyLinkButton({ postId, compact = false }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(postUrl(postId))) {
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy the link');
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy link to this story"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-navy-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      {!compact && <span>{copied ? 'Copied' : 'Copy link'}</span>}
    </button>
  );
}

/** Uses the native share sheet on mobile; falls back to a small share menu. */
export function ShareButton({ post, compact = false, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const url = postUrl(post.id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onShare = async () => {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: post.heading, text: post.description?.slice(0, 140), url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    setOpen((o) => !o);
  };

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(post.heading);
  const targets = [
    { label: 'WhatsApp', icon: WhatsappIcon, href: `https://wa.me/?text=${text}%20${encoded}`, color: 'text-emerald-500' },
    { label: 'Facebook', icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, color: 'text-blue-600' },
    { label: 'X (Twitter)', icon: XIcon, href: `https://x.com/intent/post?text=${text}&url=${encoded}`, color: 'text-slate-900 dark:text-white' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onShare}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Share this story"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-navy-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {!compact && <span>Share</span>}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute bottom-full z-30 mb-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-pop-in dark:border-white/10 dark:bg-navy-800 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Share to</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close share menu" className="rounded p-0.5 text-slate-400 hover:text-slate-700">
              <Close className="h-3.5 w-3.5" />
            </button>
          </div>
          {targets.map(({ label, icon: Icon, href, color }) => (
            <a
              key={label}
              role="menuitem"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <Icon className={`h-4.5 w-4.5 ${color}`} />
              {label}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              if (await copyText(url)) toast.success('Link copied to clipboard');
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Link2 className="h-4.5 w-4.5 text-gold-600" aria-hidden="true" />
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
