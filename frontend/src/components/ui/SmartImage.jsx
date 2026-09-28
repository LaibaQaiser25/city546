import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { mediaUrl } from '../../utils/format';

/**
 * Image inside a fixed-aspect frame: shimmer while loading, graceful fallback on error.
 * `object-cover` keeps any source aspect ratio from breaking the layout.
 */
export default function SmartImage({ src, alt, aspect = 'aspect-[16/9]', className = '', imgClassName = '', eager = false, fitPortrait = false }) {
  // Keyed by src so a new URL resets the loading/error state.
  const [state, setState] = useState({ src, status: 'loading' });
  const status = state.src === src ? state.status : 'loading';
  const set = (s, portrait = false) => setState({ src, status: s, portrait });
  const portrait = state.src === src && state.portrait;

  return (
    // Portrait images (e.g. 4:5 news graphics) are shown whole on story pages.
    <div className={`relative overflow-hidden bg-slate-100 dark:bg-navy-800 ${portrait && fitPortrait ? 'mx-auto aspect-[4/5] w-full max-w-xl' : aspect} ${className}`}>
      {status === 'loading' && <div className="skeleton absolute inset-0 rounded-none" aria-hidden="true" />}
      {status === 'error' || !src ? (
        <div className="absolute inset-0 grid place-items-center bg-linear-to-br from-navy-800 to-navy-950 text-navy-300">
          <div className="flex flex-col items-center gap-1.5 text-xs font-medium">
            <ImageOff className="h-7 w-7" aria-hidden="true" />
            <span>Image unavailable</span>
          </div>
        </div>
      ) : (
        <img
          src={mediaUrl(src)}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => set('loaded', e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 1.05)}
          onError={() => set('error')}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
            portrait && !fitPortrait ? 'object-cover object-top' : 'object-cover'
          } ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      )}
    </div>
  );
}
