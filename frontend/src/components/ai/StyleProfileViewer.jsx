import {
  AlignLeft,
  BookOpen,
  CalendarClock,
  Hash,
  Heading1,
  Image as ImageIcon,
  Languages,
  ListChecks,
  MessageSquareQuote,
  Quote,
  Sparkles,
  UserCheck,
} from 'lucide-react';

const LANG = { ur: 'Urdu', en: 'English', mixed: 'Urdu + English', other: 'Other' };

function Chips({ items }) {
  if (!items?.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-800 dark:bg-white/10 dark:text-slate-200">
          {t}
        </span>
      ))}
    </span>
  );
}

function Bullets({ items }) {
  if (!items?.length) return <span className="text-slate-400">—</span>;
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Item({ icon: Icon, title, children, wide }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-white p-4 dark:border-white/5 dark:bg-white/[0.02] ${wide ? 'sm:col-span-2' : ''}`}>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-700 dark:text-gold-300">
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </h3>
      <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
    </div>
  );
}

/** Plain-language view of what the AI learned — no AI jargon needed. */
export default function StyleProfileViewer({ profile }) {
  const p = profile.profile;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-linear-to-br from-navy-800 to-navy-950 p-5 text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-300">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> In a nutshell
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-navy-100">{p.summary}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Item icon={MessageSquareQuote} title="Overall tone">
          <Chips items={p.tone} />
          {p.formality && <p className="mt-2 text-xs text-slate-500">{p.formality}</p>}
        </Item>
        <Item icon={Heading1} title="Headline style">
          <p>{p.headlineStyle}</p>
          {p.headlineTechniques?.length > 0 && (
            <div className="mt-2">
              <Chips items={p.headlineTechniques} />
            </div>
          )}
        </Item>
        <Item icon={AlignLeft} title="Description style">
          <p>{p.structure}</p>
          <p className="mt-1 text-slate-500">
            {p.paragraphStyle} {p.typicalLength && `· ${p.typicalLength}`}
          </p>
        </Item>
        <Item icon={Quote} title="Opening & closing">
          <p>
            <strong>Opens:</strong> {p.openingPattern}
          </p>
          <p className="mt-1">
            <strong>Closes:</strong> {p.closingPattern}
          </p>
        </Item>
        <Item icon={BookOpen} title="Vocabulary & sentences">
          <Bullets items={p.vocabularyTraits} />
          {p.sentenceStyle && <p className="mt-2 text-slate-500">{p.sentenceStyle}</p>}
        </Item>
        <Item icon={ListChecks} title="Formatting">
          <Bullets items={p.formattingRules} />
          {p.emphasis && <p className="mt-2 text-slate-500">Emphasis: {p.emphasis}</p>}
        </Item>
        <Item icon={CalendarClock} title="Facts, names, dates & places">
          <p>{p.factsPresentation}</p>
          <p className="mt-1 text-slate-500">{p.namesDatesLocations}</p>
        </Item>
        <Item icon={Hash} title="Captions, hashtags & emoji">
          <p>{p.captionStyle}</p>
          <p className="mt-1 text-slate-500">
            {p.hashtagUsage} {p.emojiUsage}
          </p>
          {p.commonHashtags?.length > 0 && (
            <div className="mt-2">
              <Chips items={p.commonHashtags} />
            </div>
          )}
        </Item>
        <Item icon={Languages} title="Language">
          <p className="font-semibold">{LANG[p.primaryLanguage] || p.primaryLanguage}</p>
          <p className="mt-1 text-slate-500">{p.languageNotes}</p>
        </Item>
        <Item icon={ImageIcon} title="News graphic wording" wide>
          <p>
            <strong>Tagline:</strong> {p.graphicStyle?.taglineStyle}
          </p>
          <p className="mt-1">
            <strong>Headline:</strong> {p.graphicStyle?.headlineTreatment}
          </p>
          <p className="mt-1">
            <strong>Bullets:</strong> {p.graphicStyle?.bulletStyle}
          </p>
        </Item>
        <Item icon={UserCheck} title="Your preferences">
          {p.adminPreferences?.length ? <Bullets items={p.adminPreferences} /> : <span className="text-slate-400">None learned yet (enable “Learn from my edits” below).</span>}
        </Item>
        {p.editorialCharacteristics?.length > 0 && (
          <Item icon={Sparkles} title="Editorial characteristics" wide>
            <Bullets items={p.editorialCharacteristics} />
          </Item>
        )}
      </div>
    </div>
  );
}
