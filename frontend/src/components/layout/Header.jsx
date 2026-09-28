import { ChevronDown, LayoutDashboard, LogIn, Menu, Moon, PenSquare, Search, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCategories } from '../../hooks/useCategories';
import Logo from '../brand/Logo';
import Button from '../ui/Button';

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-navy-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-gold-300 ${className}`}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function SearchForm({ autoFocus = false, onDone, className = '' }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [value, setValue] = useState(location.pathname === '/search' ? params.get('q') || '' : '');

  const submit = (e) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    onDone?.();
  };

  return (
    <form role="search" onSubmit={submit} className={`relative ${className}`}>
      <label htmlFor={autoFocus ? 'mobile-search' : 'header-search'} className="sr-only">
        Search news
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        id={autoFocus ? 'mobile-search' : 'header-search'}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search news…"
        autoFocus={autoFocus}
        maxLength={100}
        className="h-10 w-full rounded-full border border-slate-200 bg-slate-100/80 pr-4 pl-10 text-sm text-slate-900 transition placeholder:text-slate-500 focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-400/20 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-navy-900"
      />
    </form>
  );
}

function CategoriesMenu() {
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = location.pathname.startsWith('/category');
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold transition ${
          active ? 'text-navy-900 dark:text-gold-300' : 'text-slate-600 hover:text-navy-900 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        Categories <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-pop-in dark:border-white/10 dark:bg-navy-900">
          <ul className="grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/category/${c.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-gold-50 hover:text-navy-900 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  {c.name}
                  <span className="text-xs text-slate-400">{c.postCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const navLink = ({ isActive }) =>
  `relative inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold transition ${
    isActive
      ? 'text-navy-900 after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-gold-400 dark:text-gold-300'
      : 'text-slate-600 hover:text-navy-900 dark:text-slate-300 dark:hover:text-white'
  }`;

export default function Header() {
  const { isAdmin } = useAuth();
  const { categories } = useCategories();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu / search whenever the route changes.
  const routeKey = location.pathname + location.search;
  const [lastRouteKey, setLastRouteKey] = useState(routeKey);
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-lg dark:border-white/10 dark:bg-navy-950/85">
      {/* Gold broadcast strip */}
      <div className="h-1 bg-linear-to-r from-brand-blue via-gold-400 to-brand-red" aria-hidden="true" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="ml-4 hidden items-center lg:flex">
          <NavLink to="/" end className={navLink}>
            Home
          </NavLink>
          <NavLink to="/latest" className={navLink}>
            Latest News
          </NavLink>
          <CategoriesMenu />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <SearchForm className="hidden w-56 md:block xl:w-72" />
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search"
            aria-expanded={searchOpen}
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-white/10"
          >
            <Search className="h-5 w-5" />
          </button>
          <ThemeToggle />
          {isAdmin ? (
            <>
              <Button to="/admin/posts/new" variant="gold" size="sm" className="max-sm:hidden">
                <PenSquare className="h-4 w-4" aria-hidden="true" /> New post
              </Button>
              <Button to="/admin" variant="primary" size="sm" className="max-sm:hidden">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
              </Button>
            </>
          ) : (
            <Button to="/admin/login" variant="primary" size="sm" className="max-sm:hidden">
              <LogIn className="h-4 w-4" aria-hidden="true" /> Admin Login
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:hover:bg-white/10"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-slate-200 px-4 py-3 md:hidden dark:border-white/10">
          <SearchForm autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}

      {/* Mobile menu — portalled to <body>: the header's backdrop-blur would otherwise
          become the containing block for this fixed panel and clip it. */}
      {menuOpen &&
        createPortal(
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-[68px] bottom-0 z-40 overflow-y-auto border-t border-slate-200 bg-white px-4 pt-4 pb-10 animate-fade-in lg:hidden dark:border-white/10 dark:bg-navy-950"
        >
          <nav aria-label="Mobile" className="space-y-1">
            {[
              ['/', 'Home'],
              ['/latest', 'Latest News'],
              ['/search', 'Search'],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex h-12 items-center rounded-xl px-4 text-base font-semibold ${
                    isActive ? 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950' : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-6 mb-2 px-1 text-xs font-bold uppercase tracking-widest text-gold-600 dark:text-gold-400">Categories</p>
          <ul className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/category/${c.slug}`}
                  className="flex h-12 items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                >
                  {c.name}
                  <span className="text-xs text-slate-400">{c.postCount}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-2">
            {isAdmin ? (
              <>
                <Button to="/admin/posts/new" variant="gold" size="lg">
                  <PenSquare className="h-5 w-5" aria-hidden="true" /> New post
                </Button>
                <Button to="/admin" variant="primary" size="lg">
                  <LayoutDashboard className="h-5 w-5" aria-hidden="true" /> Dashboard
                </Button>
              </>
            ) : (
              <Button to="/admin/login" variant="primary" size="lg">
                <LogIn className="h-5 w-5" aria-hidden="true" /> Admin Login
              </Button>
            )}
          </div>
        </div>,
          document.body,
        )}
    </header>
  );
}
