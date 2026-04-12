import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const Card = ({ className, children }) => (
  <div className={cn('bg-white rounded-2xl shadow-xl border border-gray-100 p-8', className)}>
    {children}
  </div>
);

export const Input = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    {Icon && (
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <Icon size={20} />
      </div>
    )}
    <input
      className={cn(
        'block w-full rounded-lg border-gray-300 bg-gray-50 border py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-200 outline-none',
        Icon && 'pl-10'
      )}
      {...props}
    />
  </div>
);

export const Button = ({ children, variant = 'primary', className, ...props }) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg'
  };
  return (
    <button
      className={cn(
        'flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    refunded: 'bg-gray-50 text-gray-700 border-gray-200'
  };

  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize',
      styles[status] || 'bg-gray-50 text-gray-600 border-gray-200'
    )}>
      {status}
    </span>
  );
};
