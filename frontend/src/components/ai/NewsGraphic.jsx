import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SITE } from '../../config/site';
import { mediaUrl } from '../../utils/format';
import { ensureGraphicFonts, FONT_DISPLAY, FONT_SANS, FONT_URDU } from './graphicFonts';

/**
 * 1080×1350 (4:5) social news card, styled after the channel's "اہم خبر" graphics:
 * red tagline, subject photos, context line, big highlight, yellow sub-line,
 * fact bullets, reporter photo + name, and brand badges.
 *
 * The AI only supplies the TEXT (from the admin's facts). Photos are the admin's own
 * uploads — the design is rendered by the app, so text is always crisp and correct.
 */
export const GRAPHIC_WIDTH = 1080;
export const GRAPHIC_HEIGHT = 1350;

const THEMES = {
  crime: { accent: '#d7141d', glow: 'rgba(215,20,29,.55)', tape: true },
  breaking: { accent: '#e11d2e', glow: 'rgba(225,29,46,.5)' },
  accident: { accent: '#ea580c', glow: 'rgba(234,88,12,.5)' },
  politics: { accent: '#1d4ed8', glow: 'rgba(29,78,216,.55)' },
  sports: { accent: '#16a34a', glow: 'rgba(22,163,74,.5)' },
  business: { accent: '#c4952b', glow: 'rgba(196,149,43,.5)' },
  weather: { accent: '#0284c7', glow: 'rgba(2,132,199,.5)' },
  health: { accent: '#0d9488', glow: 'rgba(13,148,136,.5)' },
  general: { accent: '#e11d2e', glow: 'rgba(225,29,46,.45)' },
};

const URDU = /[؀-ۿ]/;
const isRtl = (...texts) => texts.some((t) => URDU.test(t || ''));

/** Shrinks long text so it always fits its box. */
const fit = (text, base, comfortableChars, min) => {
  const len = (text || '').length;
  if (len <= comfortableChars) return base;
  return Math.max(min, Math.round(base * Math.sqrt(comfortableChars / len)));
};

function Photo({ src, style, fadeTo = 'bottom' }) {
  const gradient =
    fadeTo === 'left'
      ? 'linear-gradient(to left, rgba(7,10,20,0) 55%, #070a14 100%)'
      : fadeTo === 'right'
        ? 'linear-gradient(to right, rgba(7,10,20,0) 55%, #070a14 100%)'
        : 'linear-gradient(to bottom, rgba(7,10,20,0) 45%, #070a14 100%)';
  return (
    <div style={{ position: 'absolute', overflow: 'hidden', ...style }}>
      <img src={mediaUrl(src)} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, background: gradient }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(7,10,20,0) 60%, #070a14 100%)' }} />
    </div>
  );
}

function PoliceTape({ top }) {
  const text = 'POLICE LINE DO NOT CROSS  •  '.repeat(6);
  return (
    <div
      style={{
        position: 'absolute', top, left: -120, width: 1320, height: 58, transform: 'rotate(-7deg)',
        background: '#facc15', borderTop: '4px solid #111', borderBottom: '4px solid #111',
        display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
        fontFamily: FONT_SANS, fontWeight: 900, fontSize: 30, letterSpacing: 2, color: '#111',
        boxShadow: '0 10px 30px rgba(0,0,0,.45)', opacity: 0.92,
      }}
    >
      {text}
    </div>
  );
}

function BrandBadges({ brand }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, direction: 'ltr' }}>
      {brand.showWordsWithMirza !== false && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 6px 18px rgba(0,0,0,.35)' }}>
          <div style={{ lineHeight: 0.95, fontFamily: FONT_DISPLAY, fontWeight: 900, color: '#0c1a3d', fontSize: 34 }}>
            Words
            <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontStyle: 'italic', fontSize: 20, color: '#c4952b', margin: '2px 0' }}>with Mirza</div>
          </div>
          <div style={{ width: 46, height: 46, borderRadius: 999, background: '#0c1a3d', border: '3px solid #d4a93d', display: 'grid', placeItems: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dfbd62" strokeWidth="2.4" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 6px 18px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34, lineHeight: 1, color: '#fff' }}>
          <span style={{ background: '#1d4ed8', padding: '4px 8px', borderRadius: '8px 0 0 8px' }}>City</span>
          <span style={{ background: '#e11d2e', padding: '4px 8px', borderRadius: '0 8px 8px 0' }}>546</span>
        </div>
        <div style={{ marginTop: 5, background: '#e11d2e', color: '#fff', fontFamily: FONT_SANS, fontWeight: 900, fontSize: 18, letterSpacing: 3, padding: '2px 22px', borderRadius: 4 }}>NEWS</div>
      </div>
      {(brand.partnerLogoUrl || brand.partnerLabel) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 14, padding: '8px 14px', minWidth: 150, boxShadow: '0 6px 18px rgba(0,0,0,.35)' }}>
          {brand.partnerLogoUrl && <img src={mediaUrl(brand.partnerLogoUrl)} alt="" crossOrigin="anonymous" style={{ maxHeight: brand.partnerLabel ? 58 : 84, maxWidth: 190, objectFit: 'contain' }} />}
          {brand.partnerLabel && (
            <div style={{ marginTop: brand.partnerLogoUrl ? 4 : 0, fontFamily: FONT_SANS, fontWeight: 900, fontSize: 22, color: '#0c1a3d', textAlign: 'center' }}>{brand.partnerLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

const NewsGraphic = forwardRef(function NewsGraphic({ graphic, photos = [], brand = {} }, ref) {
  const [fontsReady, setFontsReady] = useState(false);
  const bulletsRef = useRef(null);
  useEffect(() => {
    ensureGraphicFonts().then(() => setFontsReady(true));
  }, []);

  const theme = THEMES[graphic.theme] || THEMES.general;
  const rtl = isRtl(graphic.tagline, graphic.contextLine, graphic.highlight, graphic.subline, ...(graphic.bullets || []));
  const font = rtl ? FONT_URDU : FONT_SANS;
  // Nastaliq needs generous line height; Latin needs much less.
  const lh = rtl ? 1.75 : 1.15;
  const bullets = (graphic.bullets || []).filter(Boolean).slice(0, 4);
  const bulletChars = bullets.reduce((n, b) => n + b.length, 0);
  const bulletSize = rtl ? Math.max(24, Math.min(34, 34 - Math.max(0, bulletChars - 200) / 18)) : Math.max(24, Math.min(34, 34 - Math.max(0, bulletChars - 220) / 20));
  const [photoA, photoB] = photos.filter(Boolean);

  // Shrink the bullet text until it fits its box (measured after fonts load).
  const bulletKey = bullets.join('\n');
  useLayoutEffect(() => {
    const box = bulletsRef.current;
    if (!box) return;
    let size = bulletSize;
    box.style.fontSize = `${size}px`;
    while (box.scrollHeight > box.clientHeight + 1 && size > 18) {
      size -= 1;
      box.style.fontSize = `${size}px`;
    }
  }, [bulletKey, bulletSize, fontsReady]);
  const reporterName = brand.reporterName || SITE.show.hostUrdu;
  const tagline = graphic.tagline || brand.defaultTagline || (rtl ? 'اہم خبر' : 'BREAKING');

  return (
    <div
      ref={ref}
      style={{
        width: GRAPHIC_WIDTH, height: GRAPHIC_HEIGHT, position: 'relative', overflow: 'hidden',
        background: `radial-gradient(900px 600px at 15% 95%, ${theme.glow}, transparent 60%), radial-gradient(800px 500px at 90% 45%, rgba(29,78,216,.28), transparent 60%), #070a14`,
        color: '#fff', direction: rtl ? 'rtl' : 'ltr', fontFamily: font,
      }}
    >
      {/* Subject photos */}
      {photoA && photoB ? (
        <>
          <Photo src={photoA} fadeTo={rtl ? 'left' : 'right'} style={{ top: 0, [rtl ? 'right' : 'left']: 0, width: 560, height: 560 }} />
          <Photo src={photoB} fadeTo={rtl ? 'right' : 'left'} style={{ top: 0, [rtl ? 'left' : 'right']: 0, width: 560, height: 560 }} />
        </>
      ) : photoA ? (
        <Photo src={photoA} style={{ top: 0, left: 0, width: GRAPHIC_WIDTH, height: 600 }} />
      ) : null}

      {theme.tape && <PoliceTape top={345} />}

      {/* Tagline */}
      <div style={{ position: 'absolute', top: 34, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            transform: 'rotate(-2deg)', background: `linear-gradient(180deg, ${theme.accent}, #8f0b12)`, border: '5px solid #fff',
            borderRadius: 16, padding: rtl ? '0 44px 14px' : '10px 44px', boxShadow: `0 0 40px ${theme.glow}, 0 10px 30px rgba(0,0,0,.5)`,
            fontWeight: rtl ? 700 : 900, fontSize: fit(tagline, rtl ? 70 : 64, 10, 44), lineHeight: rtl ? 1.9 : 1.1,
            letterSpacing: rtl ? 0 : 2, textTransform: rtl ? 'none' : 'uppercase',
          }}
        >
          {tagline}
        </div>
      </div>

      {/* Headline stack */}
      <div style={{ position: 'absolute', top: 470, left: 50, right: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        {graphic.contextLine && (
          <div style={{ background: 'rgba(120,8,14,.82)', borderRadius: 10, padding: rtl ? '0 26px 10px' : '8px 26px', fontWeight: 700, fontSize: fit(graphic.contextLine, rtl ? 48 : 44, 28, 30), lineHeight: lh, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
            {graphic.contextLine}
          </div>
        )}
        {graphic.highlight && (
          <div
            style={{
              fontWeight: rtl ? 700 : 900, fontSize: fit(graphic.highlight, rtl ? 118 : 104, 12, 64), lineHeight: rtl ? 1.55 : 1,
              color: '#fff', textShadow: `0 0 2px ${theme.accent}, 0 4px 0 ${theme.accent}, 0 0 38px ${theme.glow}, 0 10px 30px rgba(0,0,0,.7)`,
              padding: rtl ? '0 10px' : '4px 10px',
            }}
          >
            {graphic.highlight}
          </div>
        )}
        {graphic.subline && (
          <div style={{ background: '#050505', border: '3px solid #fff', borderRadius: 10, padding: rtl ? '0 28px 10px' : '8px 28px', color: '#ffd400', fontWeight: 700, fontSize: fit(graphic.subline, rtl ? 50 : 44, 26, 30), lineHeight: lh, boxShadow: '0 10px 26px rgba(0,0,0,.5)' }}>
            {graphic.subline}
          </div>
        )}
      </div>

      {/* Fact bullets */}
      <div ref={bulletsRef} style={{ position: 'absolute', top: 870, bottom: 196, left: 44, right: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, overflow: 'hidden', fontSize: bulletSize }}>
        {bullets.map((b, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(9,20,52,.9)', borderRadius: 10,
              [rtl ? 'borderRight' : 'borderLeft']: `8px solid ${theme.accent}`, padding: rtl ? '0 22px 8px' : '12px 22px',
              fontWeight: 600, fontSize: '1em', lineHeight: lh, boxShadow: '0 6px 18px rgba(0,0,0,.35)', flexShrink: 0,
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: 999, background: theme.accent, flexShrink: 0, boxShadow: `0 0 12px ${theme.glow}`, marginTop: rtl ? 10 : 0 }} />
            <span>{b}</span>
          </div>
        ))}
      </div>

      {/* Footer: reporter + brands */}
      <div style={{ position: 'absolute', left: 36, right: 36, bottom: 26, height: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', direction: 'ltr' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ width: 132, height: 150, borderRadius: 12, overflow: 'hidden', border: '4px solid #fff', background: 'linear-gradient(180deg,#1a2f66,#0c1a3d)', boxShadow: '0 8px 24px rgba(0,0,0,.5)', display: 'grid', placeItems: 'center' }}>
            {brand.reporterPhotoUrl ? (
              <img src={mediaUrl(brand.reporterPhotoUrl)} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="70" height="70" viewBox="0 0 24 24" fill="#8199d6"><circle cx="12" cy="8" r="4.2" /><path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7z" /></svg>
            )}
          </div>
          <div
            style={{
              background: `linear-gradient(180deg, ${theme.accent}, #8f0b12)`, border: '3px solid #fff', borderRadius: 12,
              padding: isRtl(reporterName) ? '0 22px 10px' : '8px 22px', fontFamily: isRtl(reporterName) ? FONT_URDU : FONT_SANS,
              fontWeight: 700, fontSize: 32, lineHeight: isRtl(reporterName) ? 1.8 : 1.1, direction: isRtl(reporterName) ? 'rtl' : 'ltr',
              boxShadow: '0 8px 24px rgba(0,0,0,.45)', marginBottom: 6,
            }}
          >
            {reporterName}
          </div>
        </div>
        <BrandBadges brand={brand} />
      </div>
    </div>
  );
});

export default NewsGraphic;

/** Scaled on-screen preview; the ref points at the full-size node used for export. */
export function GraphicPreview({ graphicRef, maxWidth = 440, ...props }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(420);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.min(maxWidth, Math.floor(entry.contentRect.width))));
    ro.observe(box);
    return () => ro.disconnect();
  }, [maxWidth]);
  const scale = width / GRAPHIC_WIDTH;
  return (
    <div ref={boxRef} className="w-full">
      <div className="mx-auto overflow-hidden rounded-xl shadow-lg ring-1 ring-black/10" style={{ width, height: GRAPHIC_HEIGHT * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: GRAPHIC_WIDTH, height: GRAPHIC_HEIGHT }}>
          <NewsGraphic ref={graphicRef} {...props} />
        </div>
      </div>
    </div>
  );
}
