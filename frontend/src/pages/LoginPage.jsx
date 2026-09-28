import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/brand/Logo';
import { ThemeToggle } from '../components/layout/Header';
import Button from '../components/ui/Button';
import { PageSpinner } from '../components/ui/States';
import { SITE } from '../config/site';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useUtils';

export default function LoginPage() {
  useDocumentTitle('Admin Login');
  const { login, status, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname?.startsWith('/admin') ? location.state.from.pathname : '/admin';

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <PageSpinner />;
  if (isAdmin) return <Navigate to={from} replace />;

  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!/^[^@\s]+@[^@\s]+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Password is required';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      toast.success('Login successful. Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err.message);
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name) => ({
    id: name,
    name,
    value: form[name],
    onChange: (e) => {
      setForm((f) => ({ ...f, [name]: e.target.value }));
      if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
    },
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-navy-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-brand-blue/30 blur-3xl" />
        <Link to="/" className="relative inline-flex items-center gap-3 text-white">
          <LogoMark size="lg" />
        </Link>
        <div className="relative">
          <p className="font-display text-5xl font-black leading-tight text-white">
            Words <span className="font-script font-normal text-gold-300">with</span>
            <br /> Mirza
          </p>
          <p lang="ur" dir="rtl" className="mt-3 w-fit font-urdu text-3xl leading-loose text-gold-200">
            {SITE.show.hostUrdu}
          </p>
          <div className="gold-rule my-8 w-64" />
          <p className="max-w-sm text-navy-200">The newsroom desk for {SITE.channel}. Publish, edit and manage the daily feed.</p>
        </div>
        <p className="relative text-sm text-navy-300">© {new Date().getFullYear()} {SITE.channel}</p>
      </div>

      {/* Form */}
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:text-navy-900 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to news
          </Link>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-8 lg:hidden">
            <LogoMark size="lg" />
          </div>
          <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-800 dark:bg-gold-400/15 dark:text-gold-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Admin only
          </div>
          <h1 className="font-display text-3xl font-black text-navy-900 dark:text-white">Sign in to the newsroom</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Public readers don’t need an account — just head back to the news.</p>

          {serverError && (
            <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {serverError}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input {...field('email')} type="email" autoComplete="username" className={`input pl-11 ${errors.email ? 'input-error' : ''}`} placeholder="admin@example.com" autoFocus />
              </div>
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-sm text-brand-red">
                  {errors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  {...field('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input px-11 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-sm text-brand-red">
                  {errors.password}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {!submitting && <LogIn className="h-5 w-5" aria-hidden="true" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
