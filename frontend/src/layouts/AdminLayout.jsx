import { ExternalLink, LayoutDashboard, ListChecks, LogOut, PenSquare, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/brand/Logo';
import { ThemeToggle } from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/posts', label: 'Manage posts', icon: ListChecks, end: true },
  { to: '/admin/posts/new', label: 'Create post', icon: PenSquare, end: true },
  { to: '/admin/ai-style', label: 'AI Style', icon: Sparkles, end: true },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    // Leave the protected area first so the route guard doesn't bounce us to the login page.
    navigate('/', { replace: true });
    await logout();
    toast.success('You have been signed out.');
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Sidebar (desktop) */}
      <aside className="hidden border-r border-white/10 bg-navy-900 text-navy-100 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex items-center gap-3 px-6 py-6">
          <LogoMark />
          <div className="leading-tight">
            <p className="font-display text-lg font-black text-white">city546</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400">Newsroom</p>
          </div>
        </div>
        <div className="gold-rule mx-6 opacity-50" />
        <nav aria-label="Admin" className="flex-1 space-y-1 px-3 py-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${
                  isActive ? 'bg-gold-400 text-navy-950 shadow-sm' : 'text-navy-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-3">
          <Link to="/" className="flex h-10 items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-navy-200 hover:bg-white/10 hover:text-white">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> View public site
          </Link>
          <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-400 font-bold text-navy-950">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-xs text-navy-300">{user?.email}</p>
            </div>
            <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="grid h-9 w-9 place-items-center rounded-lg text-navy-200 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-lg dark:border-white/10 dark:bg-navy-950/90">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Link to="/admin" className="lg:hidden" aria-label="Dashboard">
              <LogoMark size="sm" />
            </Link>
            <p className="hidden text-sm font-medium text-slate-500 sm:block dark:text-slate-400">
              Signed in as <span className="font-semibold text-navy-900 dark:text-white">{user?.email}</span>
            </p>
            <div className="ml-auto flex items-center gap-1">
              <Link to="/" className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex lg:hidden dark:text-slate-300 dark:hover:bg-white/10">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Site
              </Link>
              <ThemeToggle />
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
          {/* Mobile tabs */}
          <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${
                    isActive ? 'bg-navy-900 text-white dark:bg-gold-400 dark:text-navy-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
