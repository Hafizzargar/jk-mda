'use client';

import React, { useEffect } from 'react';
import { Button, ButtonVariant } from './Button';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'emerald' | 'cyan' | 'amber' | 'red' | 'primary';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'cyan',
  icon,
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const headerColors: Record<string, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    cyan: 'text-cyan-700 dark:text-cyan-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-rose-700 dark:text-rose-400',
    primary: 'text-slate-900 dark:text-white',
  };

  const defaultIcons: Record<string, string> = {
    emerald: '🚀',
    cyan: '📨',
    amber: '⚠️',
    red: '🗑️',
    primary: 'ℹ️',
  };

  const buttonVariantMap: Record<string, ButtonVariant> = {
    emerald: 'emerald',
    cyan: 'cyan',
    amber: 'amber',
    red: 'danger',
    primary: 'primary',
  };

  const confirmVariant = buttonVariantMap[variant] || 'primary';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/80"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span className="text-xl" aria-hidden="true">
              {icon || defaultIcons[variant] || 'ℹ️'}
            </span>
            <h3 id="confirm-modal-title" className={`text-lg font-bold ${headerColors[variant] || 'text-slate-900 dark:text-white'}`}>
              {title}
            </h3>
          </div>

          <div className="text-sm text-slate-600 leading-relaxed dark:text-slate-300">
            {typeof description === 'string' ? <p>{description}</p> : description}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/80">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
