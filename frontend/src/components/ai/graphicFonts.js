/**
 * Fonts for the news graphic, bundled with the app (same-origin, CSP-safe).
 * They are embedded as data URLs when exporting to PNG, so Urdu Nastaliq text renders
 * exactly as in the preview — no dependency on Google Fonts at export time.
 */
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import inter800 from '@fontsource/inter/files/inter-latin-800-normal.woff2?url';
import inter900 from '@fontsource/inter/files/inter-latin-900-normal.woff2?url';
import nastaliq600 from '@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-600-normal.woff2?url';
import nastaliq700 from '@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-700-normal.woff2?url';
import playfair900 from '@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff2?url';

export const FONT_URDU = "'C546 Urdu', 'C546 Sans', sans-serif";
export const FONT_SANS = "'C546 Sans', sans-serif";
export const FONT_DISPLAY = "'C546 Display', Georgia, serif";

const FACES = [
  { family: 'C546 Urdu', weight: 600, url: nastaliq600 },
  { family: 'C546 Urdu', weight: 700, url: nastaliq700 },
  { family: 'C546 Sans', weight: 600, url: inter600 },
  { family: 'C546 Sans', weight: 800, url: inter800 },
  { family: 'C546 Sans', weight: 900, url: inter900 },
  { family: 'C546 Display', weight: 900, url: playfair900 },
];

const face = (f, src) =>
  `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:block;src:url('${src}') format('woff2');}`;

/** Registers the fonts for on-screen preview (once). */
export function ensureGraphicFonts() {
  if (!document.getElementById('c546-graphic-fonts')) {
    const style = document.createElement('style');
    style.id = 'c546-graphic-fonts';
    style.textContent = FACES.map((f) => face(f, f.url)).join('\n');
    document.head.appendChild(style);
  }
  return Promise.all(FACES.map((f) => document.fonts.load(`${f.weight} 32px '${f.family}'`, 'اہم خبر Aa1'))).catch(() => {});
}

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

let embedCss;
/** @font-face CSS with the fonts inlined — passed to html-to-image. */
export function fontEmbedCSS() {
  embedCss ??= Promise.all(
    FACES.map(async (f) => face(f, await toDataUrl(await (await fetch(f.url)).blob()))),
  )
    .then((rules) => rules.join('\n'))
    .catch((err) => {
      embedCss = null;
      throw err;
    });
  return embedCss;
}
