'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

interface RichTextEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  minHeight?: string;
  onChange?: (html: string) => void;
}

export function RichTextEditor({
  name,
  defaultValue = '',
  placeholder = 'Write article body content...',
  required = false,
  minHeight = '360px',
  onChange,
}: RichTextEditorProps) {
  const [contentHtml, setContentHtml] = useState(defaultValue);
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-cyan-400 underline hover:text-cyan-300',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class:
          'prose max-w-none min-h-[320px] p-4 text-slate-800 dark:text-slate-200 text-base leading-relaxed focus:outline-none ' +
          'prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-800 prose-h2:pb-2 ' +
          'prose-h3:text-xl prose-h3:mt-5 prose-h3:mb-2 prose-p:my-2 prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-li:my-1 ' +
          'prose-blockquote:border-l-4 prose-blockquote:border-cyan-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContentHtml(html);
      if (onChange) onChange(html);
    },
  });

  // Keep editor in sync if external defaultValue changes (e.g. async fetch)
  useEffect(() => {
    if (editor && defaultValue && editor.getHTML() !== defaultValue) {
      editor.commands.setContent(defaultValue, { emitUpdate: false });
      setContentHtml(defaultValue);
    }
  }, [editor, defaultValue]);

  const handleRawCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    setContentHtml(raw);
    if (editor) {
      editor.commands.setContent(raw, { emitUpdate: false });
    }
    if (onChange) onChange(raw);
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter link URL (e.g. https://...):', previousUrl || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-2xs transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20">
      {/* Editor Top Navigation & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 px-3 py-2">
        {/* Formatting Actions (Visible in Visual Mode) */}
        {mode === 'visual' && editor ? (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {/* Paragraph / Headings */}
            <button
              type="button"
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={`rounded px-2.5 py-1 font-medium transition ${
                editor.isActive('paragraph') && !editor.isActive('heading')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Paragraph"
            >
              Paragraph
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                editor.isActive('heading', { level: 2 })
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                editor.isActive('heading', { level: 3 })
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Heading 3"
            >
              H3
            </button>

            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Text Styles */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`rounded px-2 py-1 font-bold transition ${
                editor.isActive('bold')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`rounded px-2 py-1 italic transition ${
                editor.isActive('italic')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`rounded px-2 py-1 line-through transition ${
                editor.isActive('strike')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Strikethrough"
            >
              S
            </button>

            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Lists */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`rounded px-2.5 py-1 transition ${
                editor.isActive('bulletList')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-medium'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Bullet List"
            >
              • List
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`rounded px-2.5 py-1 transition ${
                editor.isActive('orderedList')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-medium'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Numbered List"
            >
              1. List
            </button>

            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Link */}
            <button
              type="button"
              onClick={setLink}
              className={`rounded px-2 py-1 transition flex items-center gap-1 ${
                editor.isActive('link')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-medium'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Add or Edit Link"
            >
              <span>🔗</span> Link
            </button>
            {editor.isActive('link') && (
              <button
                type="button"
                onClick={() => editor.chain().focus().unsetLink().run()}
                className="rounded px-1.5 py-1 text-slate-500 hover:bg-slate-200/80 hover:text-red-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400 transition"
                title="Remove Link"
              >
                ✕
              </button>
            )}

            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Blockquote & Divider */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`rounded px-2 py-1 transition ${
                editor.isActive('blockquote')
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                  : 'text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
              title="Quote block"
            >
              ” Quote
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="rounded px-2 py-1 text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition"
              title="Horizontal Line"
            >
              ― Line
            </button>

            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* History */}
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="rounded px-2 py-1 text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-40 transition"
              title="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="rounded px-2 py-1 text-slate-700 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-40 transition"
              title="Redo"
            >
              ↷
            </button>
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1.5">
            <span>‹/›</span>
            <span>HTML Source Mode — Edit tags or paste rich HTML directly</span>
          </div>
        )}

        {/* Mode Switcher: Visual Editor (Default) vs HTML Code */}
        <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-950 p-1 border border-slate-300/80 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`rounded-[6px] px-3 py-1 font-medium transition flex items-center gap-1.5 ${
              mode === 'visual'
                ? 'bg-white text-slate-900 font-bold shadow-xs dark:bg-cyan-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>✨</span>
            <span>Visual Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('code')}
            className={`rounded-[6px] px-3 py-1 font-medium transition flex items-center gap-1.5 ${
              mode === 'code'
                ? 'bg-white text-slate-900 font-bold shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>‹/›</span>
            <span>HTML Code</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div style={{ minHeight }} className="relative bg-white dark:bg-slate-950">
        {mode === 'visual' ? (
          isMounted ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="p-4 text-sm text-slate-400">Loading visual editor...</div>
          )
        ) : (
          <textarea
            value={contentHtml}
            onChange={handleRawCodeChange}
            rows={15}
            className="w-full bg-slate-50 dark:bg-slate-950 p-4 text-slate-800 dark:text-emerald-400 font-mono text-sm leading-relaxed focus:outline-none resize-y"
            placeholder={placeholder}
          />
        )}
      </div>

      {/* Hidden input to ensure native form submission delivers the clean HTML */}
      <input type="hidden" name={name} value={contentHtml} required={required} />
    </div>
  );
}
