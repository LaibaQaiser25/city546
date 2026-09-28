import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SITE } from '../../config/site';
import { useCategories } from '../../hooks/useCategories';
import { LogoMark } from '../brand/Logo';
import { FacebookIcon, TiktokIcon, YoutubeIcon } from '../brand/SocialIcons';

export default function Footer() {
  const { categories } = useCategories();
  return (
    <footer className="mt-16 bg-navy-900 text-navy-100 dark:bg-black/30">
      <div className="h-1 bg-linear-to-r from-transparent via-gold-400 to-transparent" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="font-display text-2xl font-black text-white">city546</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-200">
            {SITE.tagline}. Home of <span className="font-semibold text-gold-300">{SITE.show.title}</span>.
          </p>
        </div>
        <nav aria-label="Footer categories">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400">Categories</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`} className="hover:text-gold-300">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400">Contact</h2>
          <a href={`tel:${SITE.phone}`} className="mt-4 inline-flex items-center gap-2 text-lg font-bold text-white hover:text-gold-300">
            <Phone className="h-4 w-4" aria-hidden="true" /> {SITE.phone}
          </a>
          <div className="mt-4 flex gap-2">
            {[
              [SITE.social.facebook, 'Facebook', FacebookIcon],
              [SITE.social.youtube, 'YouTube', YoutubeIcon],
              [SITE.social.tiktok, 'TikTok', TiktokIcon],
            ].map(([href, label, Icon]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-full border border-gold-400/50 text-white transition hover:bg-gold-400 hover:text-navy-950"
              >
                <Icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-navy-300 sm:px-6">
          © {new Date().getFullYear()} {SITE.channel}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
