import { toSvg } from 'html-to-image';
import { ensureGraphicFonts, fontEmbedCSS } from './graphicFonts';
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from './NewsGraphic';

const EXPORT_TIMEOUT_MS = 30_000;

const waitForImages = (node) =>
  Promise.all(
    [...node.querySelectorAll('img')].map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
    ),
  );

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The graphic could not be rasterised.'));
    img.decoding = 'sync';
    img.src = src;
  });
}

/**
 * Renders the graphic DOM node to a full-size PNG (data URL).
 * html-to-image builds an SVG snapshot (fonts + photos inlined); we rasterise it ourselves
 * because the library's own rasteriser can wait forever if the browser declines to decode.
 */
export async function renderGraphicPng(node) {
  await ensureGraphicFonts();
  const fontCss = await fontEmbedCSS();
  await waitForImages(node);

  let timer;
  const work = (async () => {
    // cacheBust: photos already shown on the page (loaded without CORS) are re-fetched fresh.
    const svg = await toSvg(node, { width: GRAPHIC_WIDTH, height: GRAPHIC_HEIGHT, fontEmbedCSS: fontCss, cacheBust: true });
    const img = await loadImage(svg);
    await img.decode?.().catch(() => {}); // best effort — never block on it
    await new Promise((r) => setTimeout(r, 30)); // let the SVG's embedded content settle
    const canvas = document.createElement('canvas');
    canvas.width = GRAPHIC_WIDTH;
    canvas.height = GRAPHIC_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#070a14';
    ctx.fillRect(0, 0, GRAPHIC_WIDTH, GRAPHIC_HEIGHT);
    ctx.drawImage(img, 0, 0, GRAPHIC_WIDTH, GRAPHIC_HEIGHT);
    return canvas.toDataURL('image/png');
  })();

  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), EXPORT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    throw new Error('Could not render the graphic. If you used an image link, upload the photo instead and try again.');
  } finally {
    clearTimeout(timer);
  }
}

/** data:image/png;base64,… → File (decoded locally; no network request). */
export function dataUrlToFile(dataUrl, name = 'news-graphic.png') {
  const [, b64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/png' });
}

export function downloadDataUrl(dataUrl, name) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
