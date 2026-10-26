'use client';

import React, { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number; // ms, 0 = persistent (no auto-dismiss)
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: React.ReactNode;
  duration: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  private clearTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  dismiss(id: string) {
    this.clearTimer(id);
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }

  show(message: React.ReactNode, type: ToastType = 'info', options: ToastOptions = {}): string {
    const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = options.duration !== undefined ? options.duration : type === 'loading' ? 0 : 4500;

    this.clearTimer(id);

    const existingIndex = this.toasts.findIndex((t) => t.id === id);
    const toastItem: ToastItem = {
      id,
      type,
      title: options.title,
      message,
      duration,
      createdAt: Date.now(),
    };

    if (existingIndex >= 0) {
      // Update existing toast in place
      this.toasts[existingIndex] = toastItem;
    } else {
      // Prepend so newest is at the top
      this.toasts = [toastItem, ...this.toasts.slice(0, 4)];
    }

    this.notify();

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  success(message: React.ReactNode, options?: ToastOptions): string {
    return this.show(message, 'success', options);
  }

  error(message: React.ReactNode, options?: ToastOptions): string {
    return this.show(message, 'error', { duration: 6000, ...options });
  }

  info(message: React.ReactNode, options?: ToastOptions): string {
    return this.show(message, 'info', options);
  }

  warning(message: React.ReactNode, options?: ToastOptions): string {
    return this.show(message, 'warning', { duration: 5500, ...options });
  }

  loading(message: React.ReactNode, options?: ToastOptions): string {
    return this.show(message, 'loading', { duration: 0, ...options });
  }

  /**
   * Automatically handles asynchronous operations that take time:
   * displays a loading toast, then updates it to success or error.
   */
  async promise<T>(
    promiseFn: Promise<T> | (() => Promise<T>),
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
    options?: ToastOptions
  ): Promise<T> {
    const id = this.loading(messages.loading, options);
    try {
      const p = typeof promiseFn === 'function' ? promiseFn() : promiseFn;
      const data = await p;
      const successMsg =
        typeof messages.success === 'function' ? messages.success(data) : messages.success;
      this.success(successMsg, { id, title: options?.title || 'Success' });
      return data;
    } catch (err: unknown) {
      const errorMsg =
        typeof messages.error === 'function'
          ? messages.error(err)
          : err instanceof Error
          ? err.message
          : String(err);
      this.error(errorMsg, { id, title: options?.title || 'Action Failed' });
      throw err;
    }
  }
}

export const toast = new ToastManager();

export function useToast() {
  return toast;
}

export interface ToasterProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function Toaster({ position = 'top-right' }: ToasterProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => setToasts(updated));
  }, []);

  if (toasts.length === 0) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4 sm:top-5 sm:right-6',
    'top-left': 'top-4 left-4 sm:top-5 sm:left-6',
    'bottom-right': 'bottom-4 right-4 sm:bottom-5 sm:right-6',
    'bottom-left': 'bottom-4 left-4 sm:bottom-5 sm:left-6',
  }[position];

  return (
    <aside
      aria-live="polite"
      aria-label="Notifications"
      className={`fixed ${positionClasses} z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none`}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => toast.dismiss(item.id)} />
      ))}
    </aside>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
    }, 150);
  }, [onDismiss]);

  const typeConfig: Record<
    ToastType,
    {
      badgeBg: string;
      badgeText: string;
      icon: React.ReactNode;
      borderColor: string;
      defaultTitle: string;
      progressBarBg: string;
    }
  > = {
    success: {
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/70',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      borderColor: 'border-emerald-300 dark:border-emerald-800/80',
      defaultTitle: 'Success',
      progressBarBg: 'bg-emerald-500',
    },
    error: {
      badgeBg: 'bg-rose-50 dark:bg-rose-950/70',
      badgeText: 'text-rose-700 dark:text-rose-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      borderColor: 'border-rose-300 dark:border-rose-800/80',
      defaultTitle: 'Error',
      progressBarBg: 'bg-rose-500',
    },
    warning: {
      badgeBg: 'bg-amber-50 dark:bg-amber-950/70',
      badgeText: 'text-amber-800 dark:text-amber-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      borderColor: 'border-amber-300 dark:border-amber-800/80',
      defaultTitle: 'Warning',
      progressBarBg: 'bg-amber-500',
    },
    info: {
      badgeBg: 'bg-cyan-50 dark:bg-cyan-950/70',
      badgeText: 'text-cyan-700 dark:text-cyan-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      borderColor: 'border-cyan-300 dark:border-cyan-800/80',
      defaultTitle: 'Notice',
      progressBarBg: 'bg-cyan-500',
    },
    loading: {
      badgeBg: 'bg-cyan-50 dark:bg-cyan-950/70',
      badgeText: 'text-cyan-700 dark:text-cyan-400',
      icon: (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
      borderColor: 'border-cyan-400/80 dark:border-cyan-600/80',
      defaultTitle: 'Processing...',
      progressBarBg: 'bg-cyan-500',
    },
  };

  const config = typeConfig[item.type];
  const title = item.title || (item.type === 'loading' ? config.defaultTitle : undefined);

  return (
    <div
      role="alert"
      className={`pointer-events-auto relative overflow-hidden rounded-[8px] border ${config.borderColor} bg-white/95 text-slate-900 shadow-xl shadow-slate-950/10 backdrop-blur-md transition-all duration-200 dark:bg-slate-900/95 dark:text-white dark:shadow-2xl dark:shadow-black/70 ${
        isClosing
          ? 'opacity-0 translate-x-4 scale-95'
          : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-4 duration-200'
      }`}
    >
      <div className="flex items-start gap-3 p-3.5">
        {/* Left Indicator Icon with 8px radius */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-current/15 ${config.badgeBg} ${config.badgeText}`}
        >
          {config.icon}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pt-0.5">
          {title && (
            <p className="text-xs font-bold leading-tight tracking-wide text-slate-900 dark:text-white mb-0.5">
              {title}
            </p>
          )}
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium break-words">
            {item.message}
          </div>
        </div>

        {/* Dismiss Button (always 8px radius) */}
        {item.type !== 'loading' && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-[8px] p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition focus:outline-none"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Auto-Dismiss Countdown Bar */}
      {item.duration > 0 && (
        <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${config.progressBarBg} origin-left transition-all ease-linear`}
            style={{
              animation: `toast-progress ${item.duration}ms linear forwards`,
            }}
          />
        </div>
      )}

      {/* Keyframe style for the progress bar */}
      <style jsx>{`
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
