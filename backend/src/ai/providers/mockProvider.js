/**
 * Offline DEMO provider — no real AI. Lets the whole workflow be developed and tested
 * without an API key. It derives a style profile from simple text statistics and
 * produces a lightly restructured post from the admin's own words (never new facts).
 * The UI labels this mode clearly as "Demo mode".
 */
const URDU = /[؀-ۿ]/;
const EMOJI = /\p{Extended_Pictographic}/u;

const sentencesOf = (s) =>
  String(s)
    .split(/(?<=[.!?۔؟])\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

function analyze(posts) {
  const all = posts.map((p) => p.content);
  const urduShare = all.filter((c) => URDU.test(c)).length / Math.max(1, all.length);
  const avgWords = Math.round(all.reduce((n, c) => n + c.split(/\s+/).length, 0) / Math.max(1, all.length));
  const emojiShare = all.filter((c) => EMOJI.test(c)).length / Math.max(1, all.length);
  const tagCounts = {};
  for (const c of all) for (const t of c.match(/#[\p{L}\p{N}_]+/gu) || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
  const commonHashtags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
  const lang = urduShare > 0.6 ? 'ur' : urduShare > 0.2 ? 'mixed' : 'en';

  return {
    summary: `Demo profile computed from ${posts.length} posts using simple text statistics (no real AI). Posts average about ${avgWords} words.`,
    primaryLanguage: lang,
    languageNotes: lang === 'en' ? 'Mostly English.' : 'Mostly Urdu script; English terms appear occasionally.',
    tone: ['informative', 'direct', 'local'],
    formality: 'Semi-formal news register.',
    headlineStyle: 'Short, factual headline leading with the key event.',
    headlineTechniques: ['Lead with the event', 'Mention the place early'],
    openingPattern: 'First sentence states the most important fact.',
    structure: 'Headline → key fact → supporting details.',
    paragraphStyle: avgWords > 120 ? '3-4 short paragraphs.' : '1-2 short paragraphs.',
    sentenceStyle: 'Short, simple sentences.',
    vocabularyTraits: ['Plain, accessible words'],
    emphasis: 'Key facts first; minimal adjectives.',
    factsPresentation: 'Facts stated plainly, attributed where possible.',
    namesDatesLocations: 'Locations named early; names given in full.',
    closingPattern: 'Ends with the latest status of the story.',
    captionStyle: 'One-line caption repeating the core fact.',
    emojiUsage: emojiShare > 0.3 ? 'Emoji are used regularly.' : 'Emoji are rare.',
    hashtagUsage: commonHashtags.length ? 'A few hashtags at the end.' : 'Hashtags are rarely used.',
    commonHashtags,
    typicalLength: `About ${avgWords} words.`,
    formattingRules: ['Short paragraphs', 'Most important information first'],
    editorialCharacteristics: ['Local focus', 'Fact-first reporting'],
    graphicStyle: {
      taglineStyle: lang === 'en' ? 'A one-word label such as "Breaking".' : 'A short label such as "اہم خبر".',
      headlineTreatment: 'Place/context line, then a 2-4 word highlight, then a short sub-line.',
      bulletStyle: 'Each bullet is one plain factual sentence.',
    },
    adminPreferences: [],
  };
}

function generate({ input, options, profile, previous }) {
  const lang = options.language === 'auto' ? (URDU.test(input.heading + input.description) ? 'ur' : 'en') : options.language;
  const sentences = sentencesOf(input.description);
  const perPara = options.length === 'short' ? 3 : 2;
  const paras = [];
  for (let i = 0; i < sentences.length; i += perPara) paras.push(sentences.slice(i, i + perPara).join(' '));
  const heading = input.heading.trim().replace(/\s+/g, ' ');
  const words = heading.split(' ');

  return {
    heading,
    description: (previous ? [...paras].reverse() : paras).join('\n\n'),
    caption: sentences[0] || heading,
    hashtags: ['#City546', ...(profile?.commonHashtags || []).slice(0, 2)],
    language: lang === 'ur' ? 'ur' : 'en',
    graphic: {
      tagline: lang === 'ur' ? 'اہم خبر' : 'Breaking',
      contextLine: words.slice(0, Math.ceil(words.length / 2)).join(' '),
      highlight: words.slice(Math.ceil(words.length / 2)).join(' ') || heading,
      subline: sentences[0]?.slice(0, 110) || '',
      bullets: sentences.slice(0, 4).map((s) => s.slice(0, 170)),
      theme: 'general',
    },
    missingInfo: ['(Demo mode — connect a real AI provider for styled writing.)'],
  };
}

export function createMockProvider() {
  return {
    name: 'mock',
    model: 'demo',
    label: 'Demo mode (no real AI)',
    isDemo: true,
    async structured({ kind, payload }) {
      await new Promise((r) => setTimeout(r, 400)); // feel like a network call
      const data = kind === 'analysis' ? analyze(payload.posts) : generate(payload);
      return { data, usage: { inputTokens: 0, outputTokens: 0 }, model: 'demo' };
    },
    supportsEmbeddings: false,
    async embed() {
      return null;
    },
  };
}
