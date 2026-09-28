import { Mic, Phone } from 'lucide-react';
import { SITE } from '../../config/site';
import { LogoMark } from '../brand/Logo';
import { FacebookIcon, TiktokIcon, YoutubeIcon } from '../brand/SocialIcons';

/** Home-page show banner, styled after the "Words with Mirza" artwork. */
export default function HeroBanner() {
  return (
    <section
      aria-label={`${SITE.show.title} on ${SITE.channel}`}
      className="relative overflow-hidden rounded-3xl border border-gold-300/40 bg-white shadow-sm dark:border-gold-400/20 dark:bg-navy-900"
    >
      {/* Decorative studio glow + gold sweep */}
      <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-gold-300/25 blur-3xl dark:bg-gold-400/10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 bg-linear-to-l from-navy-100/70 to-transparent md:block dark:from-navy-800/60" />

      <div className="relative grid gap-6 px-5 pt-6 pb-24 sm:px-8 sm:pt-8 md:grid-cols-[1fr_auto] md:items-center md:pb-24">
        <div>
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-4xl font-black leading-[0.95] tracking-tight text-navy-900 sm:text-5xl lg:text-6xl dark:text-white">
                Words
              </h1>
              <div className="flex items-center gap-2 py-0.5">
                <span className="gold-rule w-10 sm:w-16" />
                <span className="-my-1 font-script text-4xl leading-none text-gold-500 sm:text-5xl">with</span>
                <span className="gold-rule w-10 sm:w-16" />
              </div>
              <p className="font-display text-4xl font-black leading-[0.95] tracking-tight text-navy-900 sm:text-5xl lg:text-6xl dark:text-white">
                Mirza
              </p>
            </div>
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-linear-to-br from-gold-200 via-gold-400 to-gold-600 p-1 shadow-lg shadow-gold-600/25 sm:h-24 sm:w-24">
              <div className="grid h-full w-full place-items-center rounded-full bg-navy-900 text-gold-300 ring-2 ring-navy-950/40">
                <Mic className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="mt-5 inline-flex rounded-xl bg-linear-to-b from-gold-300 to-gold-600 p-[2px] shadow-md">
            <p lang="ur" dir="rtl" className="rounded-[10px] bg-navy-900 px-5 pt-1 pb-3 font-urdu text-2xl leading-[2.1] text-white sm:text-3xl">
              {SITE.show.hostUrdu}
            </p>
          </div>

          <p className="mt-4 max-w-md text-[15px] text-slate-600 dark:text-slate-300">
            {SITE.tagline} — straight from the <strong className="text-navy-900 dark:text-white">{SITE.channel}</strong> newsroom.
          </p>
        </div>

        <div className="hidden flex-col items-center gap-3 md:flex">
          <span className="h-16 w-px bg-linear-to-b from-transparent to-gold-400" />
          <LogoMark size="lg" />
          <span className="h-16 w-px bg-linear-to-t from-transparent to-gold-400" />
        </div>
      </div>

      {/* Navy wave footer with contact + socials */}
      <div className="absolute inset-x-0 bottom-0">
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="block h-6 w-full text-navy-900 sm:h-8 dark:text-navy-950" aria-hidden="true">
          <path d="M0 60V28C220 4 420 0 640 18s420 34 560 0v42Z" fill="currentColor" />
          <path d="M0 30C220 6 420 2 640 20s420 34 560 2" fill="none" stroke="#d4a93d" strokeWidth="2.5" />
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-navy-900 px-5 pb-3.5 pt-1 text-white sm:px-8 dark:bg-navy-950">
          <a href={`tel:${SITE.phone}`} className="inline-flex items-center gap-2 font-bold tracking-wide hover:text-gold-300">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-gold-400/70">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {SITE.phone}
          </a>
          <span className="hidden h-5 w-px bg-white/30 sm:block" aria-hidden="true" />
          <div className="flex gap-2">
            {[
              { href: SITE.social.facebook, label: 'Facebook', Icon: FacebookIcon },
              { href: SITE.social.youtube, label: 'YouTube', Icon: YoutubeIcon },
              { href: SITE.social.tiktok, label: 'TikTok', Icon: TiktokIcon },
            ].map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SITE.channel} on ${label}`}
                className="grid h-8 w-8 place-items-center rounded-full border border-gold-400/70 transition hover:bg-gold-400 hover:text-navy-950"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
