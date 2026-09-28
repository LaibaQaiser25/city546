import { textProps } from '../../utils/format';
import SmartImage from '../ui/SmartImage';

/** Renders the extra story blocks appended with the (+) actions. */
export default function BlockRenderer({ blocks = [] }) {
  if (!blocks.length) return null;
  return (
    <div className="prose-news">
      {blocks.map((block, i) => {
        const key = block.id || i;
        if (block.type === 'heading') {
          return (
            <h2 key={key} dir={textProps(block.text).dir} className={`mt-9 mb-3 font-display text-2xl font-bold leading-snug text-navy-900 dark:text-white sm:text-[26px] ${textProps(block.text, { leading: 'leading-[1.9]' }).className}`}>
              {block.text}
            </h2>
          );
        }
        if (block.type === 'image') {
          return (
            <figure key={key} className="my-8">
              <SmartImage src={block.url} alt={block.caption || 'Story image'} className="rounded-2xl" aspect="aspect-[16/10]" />
              {block.caption && (
                <figcaption className="mt-2.5 border-l-2 border-gold-400 pl-3 text-sm italic text-slate-500 dark:text-slate-400">
                  {block.caption}
                </figcaption>
              )}
            </figure>
          );
        }
        return (
          <p key={key} dir={textProps(block.text).dir} className={textProps(block.text, { leading: 'leading-[2.2]' }).className}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
