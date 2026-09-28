import { NavLink } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';

const pill = ({ isActive }) =>
  `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${
    isActive
      ? 'border-navy-900 bg-navy-900 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950'
      : 'border-slate-200 bg-white text-slate-700 hover:border-gold-400 hover:text-navy-900 dark:border-white/10 dark:bg-navy-900 dark:text-slate-300 dark:hover:border-gold-400/60 dark:hover:text-white'
  }`;

/** Horizontally scrollable category filter (scrolls on mobile, wraps nothing). */
export default function CategoryPills() {
  const { categories, loading } = useCategories();
  return (
    <nav aria-label="News categories" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <NavLink to="/" end className={pill}>
            All
          </NavLink>
        </li>
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <div className="skeleton h-9 w-24 rounded-full" />
              </li>
            ))
          : categories.map((c) => (
              <li key={c.id}>
                <NavLink to={`/category/${c.slug}`} className={pill}>
                  {c.slug === 'breaking' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-red" aria-hidden="true" />}
                  {c.name}
                  {c.postCount > 0 && <span className="text-xs font-medium opacity-60">{c.postCount}</span>}
                </NavLink>
              </li>
            ))}
      </ul>
    </nav>
  );
}
