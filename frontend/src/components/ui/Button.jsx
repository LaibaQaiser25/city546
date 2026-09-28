import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary:
    'bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-950 dark:bg-gold-400 dark:text-navy-950 dark:hover:bg-gold-300',
  gold: 'bg-linear-to-b from-gold-300 to-gold-500 text-navy-950 shadow-sm shadow-gold-600/20 hover:from-gold-200 hover:to-gold-400',
  secondary:
    'border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-400 dark:border-white/15 dark:bg-navy-900 dark:text-slate-100 dark:hover:bg-navy-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
  danger: 'bg-brand-red text-white shadow-sm hover:bg-red-700 active:bg-red-800',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
};

export default function Button({
  as,
  to,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const classes = `inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-150
    disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  const Component = as || 'button';
  return (
    <Component
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...(Component === 'button' && { type: props.type || 'button' })}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Component>
  );
}
