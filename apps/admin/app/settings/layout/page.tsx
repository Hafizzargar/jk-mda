'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Undo / Redo History State
  const [history, setHistory] = useState<HomepageLayoutConfig[]>([DEFAULT_HOMEPAGE_LAYOUT]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [lastAction, setLastAction] = useState<string>('');

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ id: HomepageSectionId; fromColumn: HomepageColumnId } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ id?: HomepageSectionId; column: HomepageColumnId } | null>(null);

  // View state
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Push new layout state to history stack
  const applyNewLayout = useCallback((nextLayout: HomepageLayoutConfig, actionLabel?: string) => {
    setLayout(nextLayout);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, nextLayout];
    });
    setHistoryIndex((prev) => prev + 1);
    if (actionLabel) {
      setLastAction(actionLabel);
    }
  }, [historyIndex]);

  // Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setLayout(history[targetIndex]);
      setFeedback({ type: 'success', message: '↩ Undone previous change' });
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setLayout(history[targetIndex]);
      setFeedback({ type: 'success', message: '↷ Redone change' });
    }
  }, [historyIndex, history]);

  // Global Keyboard Shortcuts (Ctrl+Z for Undo, Ctrl+Y or Ctrl+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

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
          const loaded = row.value as HomepageLayoutConfig;
          setLayout(loaded);
          setHistory([loaded]);
          setHistoryIndex(0);
        }
        return;
      }

      const data = await res.json();
      if (data.layout) {
        setLayout(data.layout);
        setHistory([data.layout]);
        setHistoryIndex(0);
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
        message: '✅ Homepage layout published live! Visit http://localhost:3000 to see your changes.',
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

    let actionLabel = `Moved ${HOMEPAGE_SECTION_META[sourceId]?.name || sourceId}`;

    // Case 1: Dropped directly onto another section -> SWAP THEM!
    if (targetId && targetId !== sourceId) {
      actionLabel = `Swapped ${HOMEPAGE_SECTION_META[sourceId]?.name} with ${HOMEPAGE_SECTION_META[targetId]?.name}`;
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
      actionLabel = `Moved ${HOMEPAGE_SECTION_META[sourceId]?.name} to ${targetColumn} column`;
      const fromList = nextCols[sourceCol];
      const toList = nextCols[targetColumn];
      const fromIdx = fromList.indexOf(sourceId);
      if (fromIdx !== -1) {
        fromList.splice(fromIdx, 1);
        toList.push(sourceId);
      }
    }

    applyNewLayout(
      {
        ...layout,
        columns: nextCols,
      },
      actionLabel
    );
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

    applyNewLayout(
      {
        ...layout,
        columns: {
          ...layout.columns,
          [col]: list,
        },
      },
      `Moved ${HOMEPAGE_SECTION_META[temp]?.name || temp} ${direction}`
    );
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
    const sectionName = HOMEPAGE_SECTION_META[id]?.name || id;
    applyNewLayout(
      {
        ...layout,
        columns: {
          ...layout.columns,
          [fromCol]: fromList,
          [toCol]: toList,
        },
      },
      `Moved "${sectionName}" from ${fromCol} to ${toCol}`
    );
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

      const nameA = HOMEPAGE_SECTION_META[idA]?.name || idA;
      const nameB = HOMEPAGE_SECTION_META[idB]?.name || idB;

      applyNewLayout(
        {
          ...layout,
          columns: updatedCols,
        },
        `Swapped "${nameA}" with "${nameB}"`
      );
    }
  };

  const toggleSectionVisibility = (id: HomepageSectionId) => {
    const hiddenSet = new Set(layout.hidden || []);
    const isNowHidden = !hiddenSet.has(id);
    if (hiddenSet.has(id)) {
      hiddenSet.delete(id);
    } else {
      hiddenSet.add(id);
    }
    const name = HOMEPAGE_SECTION_META[id]?.name || id;
    applyNewLayout(
      {
        ...layout,
        hidden: Array.from(hiddenSet),
      },
      isNowHidden ? `Hidden "${name}"` : `Restored "${name}"`
    );
  };

  // Quick Preset Actions
  const applyPresetBalancedBroadsheet = () => {
    applyNewLayout(DEFAULT_HOMEPAGE_LAYOUT, 'Restored Balanced Broadsheet (3-6-3)');
  };

  const applyPresetRestoreLeadHeroCenter = () => {
    // Find where lead_hero_group currently is
    const id: HomepageSectionId = 'lead_hero_group';
    const nextCols = {
      left: layout.columns.left.filter((s) => s !== id),
      center: [id, ...layout.columns.center.filter((s) => s !== id)],
      right: layout.columns.right.filter((s) => s !== id),
      full_width_bottom: layout.columns.full_width_bottom.filter((s) => s !== id),
    };
    applyNewLayout(
      {
        ...layout,
        columns: nextCols,
        hidden: (layout.hidden || []).filter((s) => s !== id),
      },
      'Placed Lead Hero in Center Column'
    );
  };

  const applyPresetInternationalTop = () => {
    const nextRight: HomepageSectionId[] = layout.columns.right.filter((id) => id !== 'international_wire');
    nextRight.unshift('international_wire');

    applyNewLayout(
      {
        ...layout,
        columns: {
          ...layout.columns,
          left: layout.columns.left.filter((id) => id !== 'international_wire'),
          center: layout.columns.center.filter((id) => id !== 'international_wire'),
          right: nextRight,
        },
      },
      'Moved International Wire to top of Right Rail'
    );
  };

  const applyPresetInternationalLeft = () => {
    const nextLeft: HomepageSectionId[] = layout.columns.left.filter((id) => id !== 'international_wire');
    nextLeft.unshift('international_wire');

    applyNewLayout(
      {
        ...layout,
        columns: {
          ...layout.columns,
          left: nextLeft,
          center: layout.columns.center.filter((id) => id !== 'international_wire'),
          right: layout.columns.right.filter((id) => id !== 'international_wire'),
        },
      },
      'Moved International Wire to Left Column'
    );
  };

  const applyPresetConflictRight = () => {
    const nextRight: HomepageSectionId[] = layout.columns.right.filter((id) => id !== 'conflict_radar');
    nextRight.splice(1, 0, 'conflict_radar');

    applyNewLayout(
      {
        ...layout,
        columns: {
          ...layout.columns,
          left: layout.columns.left.filter((id) => id !== 'conflict_radar'),
          center: layout.columns.center.filter((id) => id !== 'conflict_radar'),
          right: nextRight,
        },
      },
      'Moved Conflict & War to Right Rail'
    );
  };

  const handleResetToDefault = () => {
    if (!confirm('Reset entire broadsheet layout back to the factory newspaper configuration?')) {
      return;
    }
    applyNewLayout(DEFAULT_HOMEPAGE_LAYOUT, 'Reset to factory defaults');
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

  // Renders a single draggable, reorderable section card
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
        className={`p-3.5 rounded-xl border transition-all select-none relative ${
          isDragged
            ? 'opacity-30 scale-95 border-dashed border-purple-500 bg-purple-50/50'
            : isHoveredTarget
            ? 'ring-2 ring-purple-500 scale-[1.02] border-purple-500 bg-purple-50/40 dark:bg-purple-950/40'
            : isHidden
            ? 'opacity-50 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-400 hover:shadow-sm'
        }`}
      >
        {/* Swap indicator banner if dragged over this item */}
        {isHoveredTarget && draggedItem && draggedItem.id !== id && (
          <div className="absolute inset-0 bg-purple-600/15 border-2 border-purple-500 rounded-xl flex items-center justify-center z-20 pointer-events-none">
            <span className="bg-purple-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md animate-pulse flex items-center gap-1.5">
              <span>⇄</span>
              <span>Swap with {HOMEPAGE_SECTION_META[draggedItem.id]?.name}</span>
            </span>
          </div>
        )}

        {/* Card Header: Drag Handle, Icon, Title, Badge, Visibility */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-base font-mono cursor-grab active:cursor-grabbing shrink-0"
              title="Click & drag to reorder or drop onto another section to swap"
            >
              ⠿
            </span>
            <span className="text-lg shrink-0">{meta.icon}</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={meta.name}>
              {meta.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {meta.badge}
            </span>
            <button
              type="button"
              onClick={() => toggleSectionVisibility(id)}
              className={`p-1 rounded text-xs transition cursor-pointer ${
                isHidden
                  ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50'
              }`}
              title={isHidden ? 'Click to Show this section on homepage' : 'Click to Hide this section from homepage'}
            >
              {isHidden ? '🚫' : '👁️'}
            </button>
          </div>
        </div>

        {/* Section Mini Mockup / Description */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed line-clamp-2">
          {meta.description}
        </p>

        {/* Action Controls Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          {/* Row 1: Order Up/Down & Direct Move to Column */}
          <div className="flex items-center justify-between gap-1 flex-wrap text-xs">
            {/* Reorder in Column */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveSectionWithinColumn(col, index, 'up')}
                className="px-2 py-0.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white dark:hover:bg-slate-700 text-[11px] font-bold transition cursor-pointer"
                title="Move section higher in this column"
              >
                ▲ Up
              </button>
              <button
                type="button"
                disabled={index === layout.columns[col].length - 1}
                onClick={() => moveSectionWithinColumn(col, index, 'down')}
                className="px-2 py-0.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white dark:hover:bg-slate-700 text-[11px] font-bold transition cursor-pointer"
                title="Move section lower in this column"
              >
                ▼ Down
              </button>
            </div>

            {/* Quick 1-Click Move to Other Columns */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Move:</span>

              {col !== 'left' && (
                <button
                  type="button"
                  onClick={() => moveSectionToColumn(col, id, 'left')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  title="Move to Left Column (3 cols)"
                >
                  ← Left
                </button>
              )}

              {col !== 'center' && (
                <button
                  type="button"
                  onClick={() => moveSectionToColumn(col, id, 'center')}
                  className="px-2 py-0.5 rounded-md bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-[10px] font-bold text-purple-800 dark:text-purple-300 transition cursor-pointer flex items-center gap-0.5"
                  title="Move to Center Lead Column (6 cols wide)"
                >
                  <span>↔</span>
                  <span>Center</span>
                </button>
              )}

              {col !== 'right' && (
                <button
                  type="button"
                  onClick={() => moveSectionToColumn(col, id, 'right')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  title="Move to Right Column (3 cols)"
                >
                  Right →
                </button>
              )}

              {col !== 'full_width_bottom' && (
                <button
                  type="button"
                  onClick={() => moveSectionToColumn(col, id, 'full_width_bottom')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  title="Move to Full-Width Lower Desk (12 cols across bottom)"
                >
                  ↓ Full
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Swap Position Selector */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/60 dark:border-slate-800/60">
            <label className="text-[10px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
              <span>⇄</span>
              <span>Swap with:</span>
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  swapWithAnySection(id, e.target.value as HomepageSectionId);
                }
              }}
              className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer w-full max-w-[210px]"
              title="Instantly swap positions with any other section"
            >
              <option value="" disabled>
                Select section to swap...
              </option>
              {ALL_HOMEPAGE_SECTION_IDS.filter((otherId) => otherId !== id).map((otherId) => (
                <option key={otherId} value={otherId}>
                  {HOMEPAGE_SECTION_META[otherId]?.icon} {HOMEPAGE_SECTION_META[otherId]?.name}
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
      {/* 1. Header Bar with Undo, Redo, Reset, Preview & Save */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📰</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-serif">
              Broadsheet Section Drag &amp; Drop Builder
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Interactive Canvas
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Arrange and organize your broadsheet front page across Left (3 cols), Center Lead (6 cols), and Right (3 cols).
            Drag sections, use the direct Move buttons, or swap cards instantly.
          </p>
        </div>

        {/* Action Controls: Undo, Redo, Reset, Live Site, Save */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
              canUndo
                ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-purple-500 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title={canUndo ? `Undo last action (Ctrl+Z). ${historyIndex} step(s) available` : 'Nothing to undo'}
          >
            <span className="text-sm">↩</span>
            <span>Undo</span>
            {canUndo && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px]">
                {historyIndex}
              </span>
            )}
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
              canRedo
                ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-purple-500 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title={canRedo ? `Redo action (Ctrl+Y). ${history.length - 1 - historyIndex} step(s) available` : 'Nothing to redo'}
          >
            <span className="text-sm">↷</span>
            <span>Redo</span>
            {canRedo && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px]">
                {history.length - 1 - historyIndex}
              </span>
            )}
          </button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="↺"
            onClick={handleResetToDefault}
            title="Restore default broadsheet column order"
          >
            Reset
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            href="http://localhost:3000/en"
            external
            icon="↗"
          >
            Live Site
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
            {saving ? 'Publishing...' : 'Save & Publish'}
          </Button>
        </div>
      </div>

      {/* Editorial & Ad Workflow Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs overflow-x-auto">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mr-2 whitespace-nowrap">
          Workflows:
        </span>
        <span className="px-3 py-1 rounded-lg bg-purple-600 text-white font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap">
          <span>🔀</span>
          <span>1. Section Drag &amp; Drop Builder</span>
        </span>
        <Link
          href="/settings/ads"
          className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 font-medium flex items-center gap-1.5 transition whitespace-nowrap"
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

      {/* Status Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
            {lastAction && (
              <span className="text-[11px] opacity-75 italic font-normal">
                (Action: {lastAction})
              </span>
            )}
          </div>
          <button onClick={() => setFeedback(null)} className="text-sm font-bold opacity-70 hover:opacity-100 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Quick Action Presets Bar */}
      <div className="p-3.5 bg-slate-100/80 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px] uppercase tracking-wide">
            <span>⚡</span>
            <span>Quick Presets:</span>
          </span>

          <button
            type="button"
            onClick={applyPresetBalancedBroadsheet}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold hover:border-purple-500 hover:text-purple-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Restore balanced broadsheet: Left (Wire/Map), Center (Lead Hero Anchor), Right (Opinions/Transit)"
          >
            <span>🗞️</span>
            <span>Balanced Broadsheet (3-6-3)</span>
          </button>

          <button
            type="button"
            onClick={applyPresetRestoreLeadHeroCenter}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold hover:border-purple-500 hover:text-purple-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Restore Lead Hero & Sub-Leads into the Center 6-column position"
          >
            <span>🎯</span>
            <span>Lead Hero in Center</span>
          </button>

          <button
            type="button"
            onClick={applyPresetInternationalTop}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:border-purple-500 hover:text-purple-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>🌐</span>
            <span>International on Top</span>
          </button>

          <button
            type="button"
            onClick={applyPresetInternationalLeft}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:border-purple-500 hover:text-purple-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>←</span>
            <span>International to Left Rail</span>
          </button>

          <button
            type="button"
            onClick={applyPresetConflictRight}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:border-purple-500 hover:text-purple-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span>🚨</span>
            <span>Conflict Radar on Right Rail</span>
          </button>
        </div>

        {/* View Switcher: Desktop vs Mobile */}
        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewMode('desktop')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              previewMode === 'desktop'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>💻</span>
            <span>Desktop 3-Column</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('mobile')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              previewMode === 'mobile'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>📱</span>
            <span>Mobile Vertical Feed</span>
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
            {/* 1. LEFT COLUMN DROP ZONE (3 cols / 25% width)           */}
            {/* ======================================================= */}
            <div
              onDragOver={(e) => handleDragOver(e, 'left')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'left')}
              className={`lg:col-span-3 p-4 rounded-2xl border-2 transition-all space-y-3 min-h-[450px] ${
                dragOverItem?.column === 'left' && !dragOverItem.id
                  ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-400/50'
                  : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    <span>LEFT COLUMN</span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    3 of 12 cols (25%) • Wire &amp; Telemetry
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {layout.columns.left.length}
                </span>
              </div>

              {layout.columns.left.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400">
                  Drop sections here to place on Left rail
                </div>
              ) : (
                layout.columns.left.map((id, idx) => renderSectionCard(id, 'left', idx))
              )}
            </div>

            {/* ======================================================= */}
            {/* 2. CENTER COLUMN DROP ZONE (6 cols / 50% width)         */}
            {/* ======================================================= */}
            <div
              onDragOver={(e) => handleDragOver(e, 'center')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'center')}
              className={`lg:col-span-6 p-4 rounded-2xl border-2 transition-all space-y-3 min-h-[450px] ${
                dragOverItem?.column === 'center' && !dragOverItem.id
                  ? 'border-purple-500 bg-purple-50/30 ring-2 ring-purple-400/50'
                  : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-purple-200/80 dark:border-purple-900/40 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-purple-200/80 dark:border-purple-900/40">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                    <span>CENTER COLUMN (PRIMARY LEAD FOCUS)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    6 of 12 cols (50% wide) • Lead Hero &amp; Top Investigations
                  </span>
                </div>
                <span className="text-[11px] text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800">
                  {layout.columns.center.length}
                </span>
              </div>

              {layout.columns.center.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/20 rounded-xl text-center space-y-3">
                  <div className="text-3xl">🎯</div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Center Column is currently empty
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-0.5">
                      The Center Column is the heart of your newspaper broadsheet (6 columns wide).
                      Place &quot;Lead Hero &amp; Sub-Leads&quot; here for the authoritative broadsheet frontpage.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applyPresetRestoreLeadHeroCenter}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span>✨</span>
                    <span>Place Lead Hero in Center</span>
                  </button>
                </div>
              ) : (
                layout.columns.center.map((id, idx) => renderSectionCard(id, 'center', idx))
              )}
            </div>

            {/* ======================================================= */}
            {/* 3. RIGHT COLUMN DROP ZONE (3 cols / 25% width)          */}
            {/* ======================================================= */}
            <div
              onDragOver={(e) => handleDragOver(e, 'right')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'right')}
              className={`lg:col-span-3 p-4 rounded-2xl border-2 transition-all space-y-3 min-h-[450px] ${
                dragOverItem?.column === 'right' && !dragOverItem.id
                  ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-400/50'
                  : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>RIGHT COLUMN</span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    3 of 12 cols (25%) • Opinions, World Wire &amp; Transit
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {layout.columns.right.length}
                </span>
              </div>

              {layout.columns.right.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400">
                  Drop sections here to place on Right rail
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
                ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-400/50'
                : 'bg-[#FAF8F5] dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                  <span>FULL-WIDTH LOWER DESK (12 COLS / 100% WIDTH HORIZONTAL GRIDS)</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  These in-depth desks automatically expand horizontally into full-width 4-column newspaper sections beneath the top 3-column trifold.
                </p>
              </div>
              <span className="text-[11px] text-slate-500 font-bold px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
              Mobile Single-Column Vertical Feed (Top to Bottom)
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
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400">#{idx + 1}</span>
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
                  className="text-emerald-600 font-bold hover:underline text-[11px] cursor-pointer"
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
