import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const Card = ({ className, children, ...props }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8', className)} {...props}>
    {children}
  </div>
);

export const Input = ({ icon: Icon, className, ...props }) => (
  <div className={cn('relative mb-4', className)}>
    {Icon && (
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
        <Icon size={18} />
      </div>
    )}
    <input
      className={cn(
        'block w-full rounded-xl border-slate-200 bg-slate-50/50 border py-3 px-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none placeholder:text-slate-400',
        Icon && 'pl-11'
      )}
      {...props}
    />
  </div>
);

export const Button = ({ children, variant = 'primary', className, ...props }) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30 font-medium',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm font-medium',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20 font-medium',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 font-medium'
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variants[variant] || variants.primary,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const StatusBadge = ({ status, className }) => {
  const normalized = String(status || 'pending').toLowerCase();

  const styles = {
    pending: 'bg-amber-100 text-amber-700 border border-amber-200',
    confirmed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    completed: 'bg-blue-100 text-blue-700 border border-blue-200',
    cancelled: 'bg-rose-100 text-rose-700 border border-rose-200'
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize', styles[normalized] || styles.pending, className)}>
      {normalized}
    </span>
  );
};