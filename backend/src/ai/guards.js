/**
 * Post-generation checks. They never block the admin — they produce warnings shown
 * in the preview so a human reviews anything suspicious before publishing.
 */

// Arabic-Indic (٠-٩) and Extended/Urdu (۰-۹) digits → ASCII
const toAsciiDigits = (s) =>
  String(s)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const numbersIn = (s) => new Set((toAsciiDigits(s).match(/\d+(?:[.,:]\d+)*/g) || []).map((n) => n.replace(/[,]/g, '')));

/** Numbers (ages, counts, dates, amounts…) that appear in the output but not in the admin's input. */
export function unsupportedNumbers(output, input) {
  const source = numbersIn(`${input.heading}\n${input.description}`);
  const produced = numbersIn(
    [output.heading, output.description, output.caption, output.graphic.contextLine, output.graphic.highlight, output.graphic.subline, ...output.graphic.bullets].join('\n'),
  );
  return [...produced].filter((n) => !source.has(n));
}

const normalizeWords = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

function shingles(words, size) {
  const out = new Set();
  for (let i = 0; i + size <= words.length; i += 1) out.add(words.slice(i, i + size).join(' '));
  return out;
}

/**
 * Long word sequences shared with the reference examples (but not present in the admin's
 * own input) — a sign the model copied wording instead of only learning style.
 */
export function copiedPhrases(output, examples, input, size = 8) {
  if (!examples.length) return [];
  const outWords = normalizeWords(`${output.heading} ${output.description} ${output.caption}`);
  const inputShingles = shingles(normalizeWords(`${input.heading} ${input.description}`), size);
  const exampleShingles = new Set();
  for (const e of examples) for (const sh of shingles(normalizeWords(e.content), size)) exampleShingles.add(sh);
  const hits = [];
  for (const sh of shingles(outWords, size)) {
    if (exampleShingles.has(sh) && !inputShingles.has(sh)) hits.push(sh);
    if (hits.length >= 3) break;
  }
  return hits;
}

export function buildWarnings(output, input, examples) {
  const warnings = [];
  const nums = unsupportedNumbers(output, input);
  if (nums.length) {
    warnings.push({
      type: 'facts',
      message: `Check these numbers — they don't appear in your notes: ${nums.slice(0, 6).join(', ')}`,
    });
  }
  const copied = copiedPhrases(output, examples, input);
  if (copied.length) {
    warnings.push({ type: 'copy', message: 'Some wording closely matches a reference post. Please rephrase before publishing.' });
  }
  for (const m of output.missingInfo) warnings.push({ type: 'missing', message: m });
  return warnings;
}
