'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import {
  DEFAULT_HOMEPAGE_LAYOUT,
  HOMEPAGE_SECTION_META,
  ALL_HOMEPAGE_SECTION_IDS,
  type HomepageLayoutConfig,
  type HomepageSectionId,
  type HomepageColumnId,
} from '@/lib/homepage-layout';

export default function HomepageLayoutBuilderPage() {
  const [layout, setLayout] = useState<HomepageLayoutConfig>(DEFAULT_HOMEPAGE_LAYOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ id: HomepageSectionId; fromColumn: HomepageColumnId } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ id?: HomepageSectionId; column: HomepageColumnId } | null>(null);

  // View state
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    fetchLayout();
  }, []);

  const fetchLayout = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/layout', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        // Fallback directly to client Supabase session
        const { data: row } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'homepage_layout')
          .maybeSingle();

        if (row?.value) {
          setLayout(row.value as HomepageLayoutConfig);
        }
        return;
      }

      const data = await res.json();
      if (data.layout) {
        setLayout(data.layout);
      }
    } catch (err: unknown) {
      console.warn('[LayoutBuilder] fetch error, using defaults:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setFeedback(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(layout),
      });

      if (!res.ok) {
        // Fallback to client-side write if staff has active session
        const payload: HomepageLayoutConfig = {
          ...layout,
          updated_at: new Date().toISOString(),
        };
        const { error: dbError } = await supabase
          .from('site_settings')
          .upsert(
            {
              key: 'homepage_layout',
              value: payload,
              description: 'Dynamic drag-and-drop section arrangement for the homepage broadsheet layout',
              updated_at: payload.updated_at,
            },
            { onConflict: 'key' }
          );

        if (dbError) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || dbError.message || 'Failed to save layout');
        }
        setLayout(payload);
      } else {
        const data = await res.json();
        if (data.layout) setLayout(data.layout);
      }

      setFeedback({
        type: 'success',
        message: 'Homepage section order and layout published live! Visit http://localhost:3000 to see changes.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving layout';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: HomepageSectionId, fromColumn: HomepageColumnId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, fromColumn }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ id, fromColumn });
  };

  const handleDragOver = (e: React.DragEvent, column: HomepageColumnId, id?: HomepageSectionId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverItem || dragOverItem.column !== column || dragOverItem.id !== id) {
      setDragOverItem({ column, id });
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumn: HomepageColumnId, targetId?: HomepageSectionId) => {
    e.preventDefault();
    setDragOverItem(null);

    let sourceId: HomepageSectionId | null = draggedItem?.id || null;
    let sourceCol: HomepageColumnId | null = draggedItem?.fromColumn || null;

    if (!sourceId || !sourceCol) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) {
          const parsed = JSON.parse(raw);
          sourceId = parsed.id;
          sourceCol = parsed.fromColumn;
        }
      } catch {
        // ignore parse error
      }
    }

    if (!sourceId || !sourceCol) {
      setDraggedItem(null);
      return;
    }

    // Clone columns
    const nextCols = {
      left: [...(layout.columns.left || [])],
      center: [...(layout.columns.center || [])],
      right: [...(layout.columns.right || [])],
      full_width_bottom: [...(layout.columns.full_width_bottom || [])],
    };

    // Case 1: Dropped directly onto another section -> SWAP THEM!
    if (targetId && targetId !== sourceId) {
      if (sourceCol === targetColumn) {
        // Same column swap
        const colList = nextCols[sourceCol];
        const fromIdx = colList.indexOf(sourceId);
        const toIdx = colList.indexOf(targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          colList[fromIdx] = targetId;
          colList[toIdx] = sourceId;
        }
      } else {
        // Cross-column SWAP: Section A takes B's spot, and Section B takes A's spot!
        const fromList = nextCols[sourceCol];
        const toList = nextCols[targetColumn];
        const fromIdx = fromList.indexOf(sourceId);
        const toIdx = toList.indexOf(targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          fromList[fromIdx] = targetId;
          toList[toIdx] = sourceId;
        }
      }
    } else if (sourceCol !== targetColumn) {
      // Case 2: Moved into a different column (appended to that column)
      const fromList = nextCols[sourceCol];
      const toList = nextCols[targetColumn];
      const fromIdx = fromList.indexOf(sourceId);
      if (fromIdx !== -1) {
        fromList.splice(fromIdx, 1);
        toList.push(sourceId);
      }
    }

    setLayout({
      ...layout,
      columns: nextCols,
    });
    setDraggedItem(null);
  };

  // Direct Button Operations
  const moveSectionWithinColumn = (col: HomepageColumnId, index: number, direction: 'up' | 'down') => {
    const list = [...layout.columns[col]];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    setLayout({
      ...layout,
      columns: {
        ...layout.columns,
        [col]: list,
      },
    });
  };

  const moveSectionToColumn = (fromCol: HomepageColumnId, id: HomepageSectionId, toCol: HomepageColumnId) => {
    if (fromCol === toCol) return;
    const fromList = [...layout.columns[fromCol]];
    const toList = [...layout.columns[toCol]];
    const idx = fromList.indexOf(id);
    if (idx !== -1) {
      fromList.splice(idx, 1);
      toList.push(id);
    }
    setLayout({
      ...layout,
      columns: {
        ...layout.columns,
        [fromCol]: fromList,
        [toCol]: toList,
      },
    });
  };

  const swapWithAnySection = (idA: HomepageSectionId, idB: HomepageSectionId) => {
    if (idA === idB) return;
    const nextCols: Record<HomepageColumnId, HomepageSectionId[]> = {
      left: [...layout.columns.left],
      center: [...layout.columns.center],
      right: [...layout.columns.right],
      full_width_bottom: [...layout.columns.full_width_bottom],
    };

    let colA: HomepageColumnId | null = null;
    let idxA = -1;
    let colB: HomepageColumnId | null = null;
    let idxB = -1;

    (Object.keys(nextCols) as HomepageColumnId[]).forEach((col) => {
      const posA = nextCols[col].indexOf(idA);
      if (posA !== -1) {
        colA = col;
        idxA = posA;
      }
      const posB = nextCols[col].indexOf(idB);
      if (posB !== -1) {
        colB = col;
        idxB = posB;
      }
    });

    if (colA && colB && idxA !== -1 && idxB !== -1) {
      const updatedCols = { ...nextCols };
      const arrA: HomepageSectionId[] = [...updatedCols[colA]];
      const arrB: HomepageSectionId[] = colA === colB ? arrA : [...updatedCols[colB]];
      arrA[idxA] = idB;
      arrB[idxB] = idA;
      (updatedCols as Record<string, HomepageSectionId[]>)[colA] = arrA;
      (updatedCols as Record<string, HomepageSectionId[]>)[colB] = arrB;
      setLayout({
        ...layout,
        columns: updatedCols,
      });
    }
  };

  const toggleSectionVisibility = (id: HomepageSectionId) => {
    const hiddenSet = new Set(layout.hidden || []);
    if (hiddenSet.has(id)) {
      hiddenSet.delete(id);
    } else {
      hiddenSet.add(id);
    }
    setLayout({
      ...layout,
      hidden: Array.from(hiddenSet),
    });
  };

  // Quick Preset Actions
  const applyPresetInternationalTop = () => {
    const nextRight: HomepageSectionId[] = layout.columns.right.filter((id) => id !== 'international_wire');
    // Put international_wire as first in right column above civic_problems
    nextRight.unshift('international_wire');

    // Also remove from left/center if it was there
    setLayout({
      ...layout,
      columns: {
        ...layout.columns,
        left: layout.columns.left.filter((id) => id !== 'international_wire'),
        center: layout.columns.center.filter((id) => id !== 'international_wire'),
        right: nextRight,
      },
    });
  };

  const applyPresetInternationalLeft = () => {
    const nextLeft: HomepageSectionId[] = layout.columns.left.filter((id) => id !== 'international_wire');
    nextLeft.unshift('international_wire');

    setLayout({
      ...layout,
      columns: {
        ...layout.columns,
        left: nextLeft,
        right: layout.columns.right.filter((id) => id !== 'international_wire'),
      },
    });
  };

  const applyPresetConflictRight = () => {
    const nextRight: HomepageSectionId[] = layout.columns.right.filter((id) => id !== 'conflict_radar');
    nextRight.splice(1, 0, 'conflict_radar');

    setLayout({
      ...layout,
      columns: {
        ...layout.columns,
        left: layout.columns.left.filter((id) => id !== 'conflict_radar'),
        right: nextRight,
      },
    });
  };

  const handleResetToDefault = () => {
    if (
      !confirm(
        'Reset entire broadsheet section layout to the factory broadsheet newspaper distribution?'
      )
    )
      return;
    setLayout(DEFAULT_HOMEPAGE_LAYOUT);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Loading Broadsheet Section Builder...</span>
        </div>
      </div>
    );
  }

  const renderSectionCard = (id: HomepageSectionId, col: HomepageColumnId, index: number) => {
    const meta = HOMEPAGE_SECTION_META[id];
    if (!meta) return null;

    const isHidden = (layout.hidden || []).includes(id);
    const isDragged = draggedItem?.id === id;
    const isHoveredTarget = dragOverItem?.column === col && dragOverItem?.id === id;

    return (
      <div
        key={id}
        draggable
        onDragStart={(e) => handleDragStart(e, id, col)}
        onDragOver={(e) => handleDragOver(e, col, id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, col, id)}
        className={`p-3.5 rounded-xl border transition-all select-none cursor-grab active:cursor-grabbing relative ${
          isDragged
            ? 'opacity-40 scale-95 border-dashed border-indigo-400 bg-indigo-50/50'
            : isHoveredTarget
            ? 'ring-2 ring-indigo-500 scale-[1.02] border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40'
            : isHidden
            ? 'opacity-50 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-400 hover:shadow-sm'
        }`}
      >
        {/* Swap indicator banner if dragged over this item */}
        {isHoveredTarget && draggedItem && draggedItem.id !== id && (
          <div className="absolute inset-0 bg-indigo-600/10 border-2 border-indigo-500 rounded-xl flex items-center justify-center z-20 pointer-events-none">
            <span className="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md animate-pulse">
              ⇄ Swap with {HOMEPAGE_SECTION_META[draggedItem.id]?.name}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-base font-mono cursor-grab" title="Drag to reorder or swap">
              ⠿
            </span>
            <span className="text-lg">{meta.icon}</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[170px] sm:max-w-[210px]">
              {meta.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {meta.badge}
            </span>
            <button
              type="button"
              onClick={() => toggleSectionVisibility(id)}
              className={`p-1 rounded text-xs transition ${
                isHidden
                  ? 'text-slate-400 hover:text-slate-600'
                  : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
              }`}
              title={isHidden ? 'Show section' : 'Hide section from homepage'}
            >
              {isHidden ? '🚫' : '👁️'}
            </button>
          </div>
        </div>

        {/* Section Mini Mockup / Description */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          {meta.description}
        </p>

        {/* Action Controls Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Up / Down Reorder */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => moveSectionWithinColumn(col, index, 'up')}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded"
              title="Move Up in column"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={index === layout.columns[col].length - 1}
              onClick={() => moveSectionWithinColumn(col, index, 'down')}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded"
              title="Move Down in column"
            >
              ▼
            </button>
          </div>

          {/* Quick Column Transfer Buttons */}
          <div className="flex items-center gap-1">
            {col !== 'left' && (
              <button
                type="button"
                onClick={() => moveSectionToColumn(col, id, 'left')}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                title="Send to Left Column"
              >
                ← Left
              </button>
            )}
            {col !== 'right' && (
              <button
                type="button"
                onClick={() => moveSectionToColumn(col, id, 'right')}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                title="Send to Right Column"
              >
                Right →
              </button>
            )}
            {col !== 'full_width_bottom' && (
              <button
                type="button"
                onClick={() => moveSectionToColumn(col, id, 'full_width_bottom')}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                title="Send to Full Width Desk below"
              >
                ↓ Full
              </button>
            )}
          </div>

          {/* Swap With Selector */}
          <div className="shrink-0">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  swapWithAnySection(id, e.target.value as HomepageSectionId);
                }
              }}
              className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none"
              title="Swap directly with another section"
            >
              <option value="" disabled>
                ⇄ Swap...
              </option>
              {ALL_HOMEPAGE_SECTION_IDS.filter((otherId) => otherId !== id).map((otherId) => (
                <option key={otherId} value={otherId}>
                  {HOMEPAGE_SECTION_META[otherId]?.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔀</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-serif">
              Broadsheet Section Drag &amp; Drop Builder
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
              Interactive Canvas
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Drag any news section to reorder, swap, or move between Left, Center, and Right columns. Dropping Section B onto Section A automatically swaps them.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="↺"
            onClick={handleResetToDefault}
            title="Restore default broadsheet column order"
          >
            Reset to Default
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            href="http://localhost:3000/en"
            external
            icon="↗"
          >
            Live Broadsheet
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon="💾"
            onClick={handleSave}
            disabled={saving}
            isLoading={saving}
          >
            {saving ? 'Publishing...' : 'Save & Publish Layout'}
          </Button>
        </div>
      </div>

      {/* Editorial & Ad Workflow Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs overflow-x-auto">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mr-2 whitespace-nowrap">Workflows:</span>
        <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap">
          <span>🔀</span>
          <span>1. Section Drag &amp; Drop Builder</span>
        </span>
        <Link
          href="/settings/ads"
          className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-600 font-medium flex items-center gap-1.5 transition whitespace-nowrap"
        >
          <span>📢</span>
          <span>2. Ads Drag &amp; Drop Placements &amp; Preview</span>
        </Link>
        <Link
          href="/settings/curation"
          className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium flex items-center gap-1.5 transition whitespace-nowrap"
        >
          <span>📰</span>
          <span>3. Story Slotting Desk</span>
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-sm font-bold opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Quick Action Presets Bar */}
      <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px] uppercase tracking-wide">
            <span>⚡</span>
            <span>Quick Layout Presets:</span>
          </span>
          <button
            type="button"
            onClick={applyPresetInternationalTop}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:border-indigo-500 hover:text-indigo-600 transition"
          >
            🌐 International on Top (Above Problems)
          </button>
          <button
            type="button"
            onClick={applyPresetInternationalLeft}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:border-indigo-500 hover:text-indigo-600 transition"
          >
            ← Move International to Left Column
          </button>
          <button
            type="button"
            onClick={applyPresetConflictRight}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:border-indigo-500 hover:text-indigo-600 transition"
          >
            🚨 Move Conflict &amp; War to Right Rail
          </button>
        </div>

        {/* View Switcher: Desktop vs Mobile */}
        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewMode('desktop')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
              previewMode === 'desktop'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>💻</span>
            <span>Desktop 3-Column</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('mobile')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
              previewMode === 'mobile'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>📱</span>
            <span>Mobile Stream</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN BROADSHEET CANVAS: LEFT (3 cols) | CENTER (6 cols) | RIGHT (3 cols)  */}
      {/* ========================================================================= */}
      {previewMode === 'desktop' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ======================================================= */}
            {/* 1. LEFT COLUMN DROP ZONE (3 cols)                       */}
            {/* ======================================================= */}
            <div
              onDragOver={(e) => handleDragOver(e, 'left')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'left')}
              className={`lg:col-span-3 p-4 rounded-2xl border-2 transition-all space-y-3 min-h-[450px] ${
                dragOverItem?.column === 'left' && !dragOverItem.id
                  ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-400/50'
                  : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>LEFT COLUMN (3 COLS)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {layout.columns.left.length} Sections
                </span>
              </div>

              {layout.columns.left.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400">
                  Drop sections here to place on Left side
                </div>
              ) : (
                layout.columns.left.map((id, idx) => renderSectionCard(id, 'left', idx))
              )}
            </div>

            {/* ======================================================= */}
            {/* 2. CENTER COLUMN DROP ZONE (6 cols)                     */}
            {/* ======================================================= */}
            <div
              onDragOver={(e) => handleDragOver(e, 'center')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'center')}
              className={`lg:col-span-6 p-4 rounded-2xl border-2 transition-all space-y-3 min-h-[450px] ${
                dragOverItem?.column === 'center' && !dragOverItem.id
                  ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-400/50'
                  : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>CENTER COLUMN (6 COLS)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {layout.columns.center.length} Sections
                </span>
              </div>

              {layout.columns.center.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400">
                  Drop sections here for Center Column
                </div>
              ) : (
                layout.columns.center.map((id, idx) => renderSectionCard(id, 'center', idx))
              )}
            </div>

            {/* ======================================================= */}
            {/* 3. RIGHT COLUMN DROP ZONE (3 cols)                      */}
            {/* ======================================================= */}
            <div
              onDragOver={(e) => handleDragOver(e, 'right')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'right')}
              className={`lg:col-span-3 p-4 rounded-2xl border-2 transition-all space-y-3 min-h-[450px] ${
                dragOverItem?.column === 'right' && !dragOverItem.id
                  ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-400/50'
                  : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>RIGHT COLUMN (3 COLS)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {layout.columns.right.length} Sections
                </span>
              </div>

              {layout.columns.right.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400">
                  Drop sections here to place on Right side
                </div>
              ) : (
                layout.columns.right.map((id, idx) => renderSectionCard(id, 'right', idx))
              )}
            </div>
          </div>

          {/* ======================================================= */}
          {/* 4. FULL-WIDTH LOWER DESK DROP ZONE (Across 12 cols)     */}
          {/* ======================================================= */}
          <div
            onDragOver={(e) => handleDragOver(e, 'full_width_bottom')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'full_width_bottom')}
            className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
              dragOverItem?.column === 'full_width_bottom' && !dragOverItem.id
                ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-400/50'
                : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>FULL-WIDTH LOWER DESK (SPANNING 100% OF PC/LAPTOP SCREEN)</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  These sections automatically expand into full-width 4-column broadsheet grids below the top trifold.
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {layout.columns.full_width_bottom.length} Sections
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {layout.columns.full_width_bottom.map((id, idx) =>
                renderSectionCard(id, 'full_width_bottom', idx)
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Mobile Device Preview Mockup */
        <div className="max-w-[420px] mx-auto bg-[#FAF8F5] dark:bg-stone-950 rounded-[40px] p-4 border-[6px] border-slate-800 shadow-2xl space-y-3 font-sans">
          <div className="text-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Mobile Single-Column Vertical Feed
            </span>
          </div>
          <div className="space-y-3">
            {[
              ...layout.columns.center,
              ...layout.columns.left,
              ...layout.columns.right,
              ...layout.columns.full_width_bottom,
            ]
              .filter((id) => !(layout.hidden || []).includes(id))
              .map((id, idx) => (
                <div
                  key={id}
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>
                    <span className="text-base">{HOMEPAGE_SECTION_META[id]?.icon}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                      {HOMEPAGE_SECTION_META[id]?.name}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-slate-400">
                    {HOMEPAGE_SECTION_META[id]?.badge}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 5. Hidden / Stashed Sections Drawer */}
      {layout.hidden && layout.hidden.length > 0 && (
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>🚫</span>
              <span>Hidden Sections ({layout.hidden.length})</span>
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400">
              These sections are currently omitted from the public homepage
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {layout.hidden.map((id) => (
              <div
                key={id}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs flex items-center gap-2 shadow-2xs"
              >
                <span>{HOMEPAGE_SECTION_META[id]?.icon}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {HOMEPAGE_SECTION_META[id]?.name}
                </span>
                <button
                  type="button"
                  onClick={() => toggleSectionVisibility(id)}
                  className="text-emerald-600 font-bold hover:underline text-[11px]"
                >
                  + Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
