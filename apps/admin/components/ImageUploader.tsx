'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  presets?: { label: string; url: string }[];
}

export function ImageUploader({
  value,
  onChange,
  presets = [
    { label: 'Srinagar Riverfront', url: 'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Highway & Roads', url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Valley Landscape', url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80' },
    { label: 'Civic Investigation', url: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?auto=format&fit=crop&w=1200&q=80' },
  ],
}: ImageUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    setImageError(false);

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP, GIF, or AVIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10 MB limit.');
      return;
    }

    setIsUploading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload image from system.');
      }

      setUploadedFileName(file.name);
      onChange(result.url);
    } catch (err: unknown) {
      console.error('File upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFile(e.target.files[0]);
    }
  };

  const clearImage = () => {
    onChange('');
    setUploadedFileName(null);
    setImageError(false);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden input to ensure native form submission captures the image URL */}
      <input type="hidden" name="featured_image_url" value={value} />

      {/* Mode Switcher: Upload from System vs Paste URL */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'upload'
                ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <span>💻</span>
            <span>Upload from System</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'url'
                ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
            }`}
          >
            <span>🔗</span>
            <span>Web Image URL</span>
          </button>
        </div>

        {value && (
          <button
            type="button"
            onClick={clearImage}
            className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium hover:underline flex items-center gap-1"
          >
            <span>✕</span> Clear image
          </button>
        )}
      </div>

      {uploadError && (
        <div className="rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>{uploadError}</span>
        </div>
      )}

      {/* Tab 1: Upload from System (Computer) */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition cursor-pointer ${
              isDragging
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 scale-[0.99]'
                : value
                  ? 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/70 hover:border-slate-400 dark:hover:border-slate-600'
                  : 'border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-950/50 hover:border-cyan-500/60 hover:bg-cyan-50/40 dark:hover:bg-slate-900/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              onChange={onFileChange}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                <p className="text-sm font-medium text-cyan-600 dark:text-cyan-300">
                  Uploading image from your system to cloud storage...
                </p>
                <p className="text-xs text-slate-500">Please wait while the file is processed</p>
              </div>
            ) : value ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <div className="flex items-center gap-2 rounded-full bg-cyan-100 dark:bg-cyan-500/20 px-3 py-1 border border-cyan-300 dark:border-cyan-500/40 text-xs font-semibold text-cyan-900 dark:text-cyan-300">
                  <span>✓</span> Image uploaded and attached
                </div>
                {uploadedFileName && (
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400 max-w-sm truncate">
                    {uploadedFileName}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Click or drag another image to replace
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xl shadow-xs group-hover:scale-105 transition">
                  📤
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className="text-cyan-600 dark:text-cyan-400 hover:underline">Choose a file</span> or drag and drop here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    PNG, JPG, WebP, GIF, or AVIF up to 10 MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Paste Web Image URL */}
      {activeTab === 'url' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Direct Public Image URL</span>
            <input
              type="url"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setUploadedFileName(null);
                setImageError(false);
              }}
              className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
              placeholder="https://images.unsplash.com/photo-..."
            />
          </label>

          {/* Quick Photo Presets */}
          {presets.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                Quick Photo Presets:
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onChange(preset.url);
                      setUploadedFileName(null);
                      setImageError(false);
                    }}
                    className="text-xs rounded-[6px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 px-2.5 py-1 transition shadow-2xs"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Image Preview (Shows for both tabs whenever value is set) */}
      {value && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/80 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
              <span>🖼️</span> Live Lead Image Preview
            </span>
            <span className="font-mono text-[11px] text-slate-500">Aspect 16:9</span>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Article featured preview"
              className={`h-full w-full object-cover transition duration-200 ${
                imageError ? 'hidden' : 'block'
              }`}
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
            {imageError && (
              <div className="p-6 text-center text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Unable to render preview from this URL. Please verify the URL or try uploading directly from your computer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
