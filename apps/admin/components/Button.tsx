'use client';

import React from 'react';
import Link from 'next/link';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'emerald'
  | 'cyan'
  | 'amber'
  | 'danger'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  external?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  href,
  icon,
  isLoading = false,
  external = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  // Always 8px border radius (rounded-[8px]) across all buttons
  const radius = 'rounded-[8px]';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    // Primary Solid Cyan
    primary:
      'bg-cyan-600 text-white hover:bg-cyan-500 shadow-sm shadow-cyan-950/20 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 focus:ring-cyan-500',
    // Soft Cyan Accent
    cyan:
      'border border-cyan-300/80 bg-cyan-50/80 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20 focus:ring-cyan-400',
    // Secondary / Neutral Surface (high contrast in both light and dark mode)
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white focus:ring-slate-400',
    // Transparent Outline
    outline:
      'border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white focus:ring-slate-400',
    // Emerald / Publish
    emerald:
      'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-950/20 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 focus:ring-emerald-500',
    // Amber / Review / Inactive
    amber:
      'border border-amber-300/80 bg-amber-50/80 text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 focus:ring-amber-400',
    // Danger / Delete
    danger:
      'border border-rose-300/80 bg-rose-50/80 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 focus:ring-rose-400',
    // Ghost
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
  };

  const baseClasses = `inline-flex items-center justify-center font-semibold transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${radius} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClasses}
        >
          {icon && <span className="inline-flex shrink-0">{icon}</span>}
          <span>{children}</span>
        </a>
      );
    }

    return (
      <Link href={href} className={baseClasses}>
        {icon && <span className="inline-flex shrink-0">{icon}</span>}
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <button
      type={rest.type || 'button'}
      disabled={disabled || isLoading}
      className={baseClasses}
      {...rest}
    >
      {isLoading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
