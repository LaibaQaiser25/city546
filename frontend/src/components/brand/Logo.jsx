import { Link } from 'react-router-dom';

/** "City 546 / NEWS HD" broadcast-style wordmark, modelled on the channel artwork. */
export function LogoMark({ size = 'md', className = '' }) {
  const s = {
    sm: { box: 'text-sm px-1.5 py-0.5', sub: 'text-[8px] px-1 py-px', gap: 'gap-0.5' },
    md: { box: 'text-lg px-2 py-0.5', sub: 'text-[9.5px] px-1.5 py-px', gap: 'gap-0.5' },
    lg: { box: 'text-3xl px-3 py-1', sub: 'text-sm px-2 py-0.5', gap: 'gap-1' },
  }[size];

  return (
    <span className={`inline-flex flex-col items-center ${s.gap} ${className}`} aria-hidden="true">
      <span className="flex items-stretch font-extrabold leading-none tracking-tight text-white shadow-sm">
        <span className={`rounded-l-md bg-brand-blue ${s.box}`}>City</span>
        <span className={`rounded-r-md bg-brand-red ${s.box}`}>546</span>
      </span>
      <span className={`rounded-sm bg-navy-950 font-black leading-none tracking-wider text-white ring-1 ring-white/20 dark:bg-white dark:text-navy-950 ${s.sub}`}>
        NEWS <span className="rounded-sm bg-brand-blue px-0.5 text-white">HD</span>
      </span>
    </span>
  );
}

export default function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-2.5 rounded-lg" aria-label="city546 home">
      <LogoMark className="transition-transform group-hover:scale-[1.03]" />
      <span className="hidden leading-tight sm:block">
        <span className="block font-display text-lg font-black tracking-tight text-navy-900 dark:text-white">city546</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-600 dark:text-gold-400">Daily News</span>
      </span>
    </Link>
  );
}
