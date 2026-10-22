import React from 'react';
import { type TemplateId } from '@/lib/templates';

interface TemplateMockupPreviewProps {
  templateId: TemplateId;
}

export function TemplateMockupPreview({ templateId }: TemplateMockupPreviewProps) {
  switch (templateId) {
    case 'classic-editorial':
      return (
        <div className="w-full h-44 bg-[#faf8f5] text-slate-900 p-3 rounded-xl border border-slate-300 font-serif overflow-hidden select-none flex flex-col justify-between shadow-inner">
          <div>
            {/* Newspaper Masthead */}
            <div className="border-b-2 border-double border-slate-900 pb-1 mb-2 text-center">
              <div className="text-[9px] font-sans font-bold tracking-widest uppercase text-slate-700">
                THE J&K BROADSHEET &bull; EST. 2026
              </div>
              <div className="text-xs font-serif font-black tracking-wider uppercase text-slate-950">
                KJIN JOURNAL OF RECORD
              </div>
            </div>

            {/* Lead Story */}
            <div className="space-y-1">
              <div className="text-[8px] font-sans font-bold uppercase tracking-wider text-red-800">
                LEAD DISPATCH &bull; JAMMU
              </div>
              <h4 className="text-[11px] font-serif font-bold leading-tight text-slate-950 line-clamp-2">
                Assembly Deliberations Focus on Industrial Allocation and Local Employment
              </h4>
            </div>
          </div>

          {/* Broadsheet Columns Simulation */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-300 pt-1.5 text-[8px] font-serif text-slate-600 leading-tight">
            <div className="space-y-0.5">
              <div className="h-1.5 bg-slate-400/40 rounded-sm w-full"></div>
              <div className="h-1.5 bg-slate-400/30 rounded-sm w-5/6"></div>
              <div className="h-1.5 bg-slate-400/30 rounded-sm w-full"></div>
            </div>
            <div className="space-y-0.5 border-l border-slate-200 pl-1.5">
              <div className="h-1.5 bg-slate-400/40 rounded-sm w-full"></div>
              <div className="h-1.5 bg-slate-400/30 rounded-sm w-4/6"></div>
              <div className="h-1.5 bg-slate-400/30 rounded-sm w-full"></div>
            </div>
          </div>
        </div>
      );

    case 'modern-magazine':
      return (
        <div className="w-full h-44 bg-slate-950 text-slate-100 p-2.5 rounded-xl border border-slate-800 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          {/* Top Bar with Glow Pill */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-[10px] font-black tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              KJIN MAGAZINE
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[8px] font-bold text-blue-300">
              ● LIVE FEED
            </span>
          </div>

          {/* Hero Visual Card */}
          <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-blue-900/60 via-slate-900 to-indigo-950 border border-slate-800 p-2.5 my-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500 text-white text-[7px] font-extrabold uppercase">
                POLITICS
              </span>
              <span className="text-[8px] text-slate-400">SRINAGAR</span>
            </div>
            <h5 className="text-[10px] font-bold leading-tight text-white line-clamp-2">
              High-Impact Visual Storytelling with Immersive Full-Bleed Imagery
            </h5>
          </div>

          {/* Bottom Card Strip */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-5 rounded bg-slate-900/80 border border-slate-800/60 flex items-center px-1.5 text-[7px] text-slate-400 truncate">
              ⚡ Dispatch #1
            </div>
            <div className="h-5 rounded bg-slate-900/80 border border-slate-800/60 flex items-center px-1.5 text-[7px] text-slate-400 truncate">
              📊 Policy Wire
            </div>
          </div>
        </div>
      );

    case 'minimal-focus':
      return (
        <div className="w-full h-44 bg-[#fafaf9] text-stone-900 p-3.5 rounded-xl border border-stone-200 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
            <span className="text-[10px] font-serif font-black tracking-tight text-stone-900">
              KJIN Focus
            </span>
            <span className="text-[8px] text-stone-500 uppercase tracking-widest font-mono">
              4 MIN READ
            </span>
          </div>

          <div className="space-y-1.5 my-auto">
            <div className="text-[7px] uppercase tracking-widest font-semibold text-stone-400">
              ESSAY &bull; CULTURE &bull; KASHMIR
            </div>
            <h4 className="text-xs font-serif font-bold leading-snug text-stone-900 line-clamp-2">
              Distraction-Free Reading on Traditional Kani Shawl Craftsmanship
            </h4>
            <div className="space-y-1 pt-1">
              <div className="h-1 bg-stone-300/60 rounded-full w-full"></div>
              <div className="h-1 bg-stone-300/40 rounded-full w-4/5"></div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[7px] text-stone-400 border-t border-stone-200 pt-1.5">
            <span>By Staff Reporter</span>
            <span>Uninterrupted Article Stream</span>
          </div>
        </div>
      );

    case 'breaking-wire':
      return (
        <div className="w-full h-44 bg-neutral-900 text-neutral-100 p-2.5 rounded-xl border border-neutral-800 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          {/* Pulsing Red Wire Banner */}
          <div className="bg-red-600 text-white px-2 py-1 rounded flex items-center justify-between text-[8px] font-black uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
              LIVE BREAKING WIRE
            </span>
            <span className="bg-red-800 px-1 py-0.2 rounded text-[7px]">FAST</span>
          </div>

          {/* Wire Chronological Feed */}
          <div className="space-y-1.5 my-1">
            <div className="border-l-2 border-red-500 pl-2 text-[8px]">
              <span className="font-mono text-red-400 font-bold">[19:42]</span>{' '}
              <span className="font-semibold text-white">NH-44 all-weather traffic clears Ramban</span>
            </div>
            <div className="border-l-2 border-neutral-700 pl-2 text-[8px] opacity-75">
              <span className="font-mono text-neutral-400">[19:15]</span>{' '}
              <span className="text-neutral-300">Zojila Pass light vehicle transit permitted</span>
            </div>
            <div className="border-l-2 border-neutral-800 pl-2 text-[8px] opacity-50">
              <span className="font-mono text-neutral-500">[18:50]</span>{' '}
              <span className="text-neutral-400">Weather radar predicts fresh upper precipitation</span>
            </div>
          </div>

          <div className="text-[7px] text-neutral-500 font-mono flex justify-between border-t border-neutral-800 pt-1">
            <span>VELOCITY: 12 DISPATCHES/HR</span>
            <span className="text-red-400 font-bold">REUTERS/BLOOMBERG STYLE</span>
          </div>
        </div>
      );

    case 'bento-grid':
      return (
        <div className="w-full h-44 bg-[#0f172a] text-slate-100 p-2.5 rounded-xl border border-slate-800 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          {/* Bento Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-bold text-white flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-cyan-400 text-slate-950 flex items-center justify-center font-mono font-black text-[7px]">
                B
              </span>
              Bento Media Matrix
            </span>
            <span className="text-[8px] font-mono text-cyan-400">2026 MODULAR</span>
          </div>

          {/* Modular Box Matrix */}
          <div className="grid grid-cols-3 gap-1.5 my-1 flex-1">
            {/* Box 1 (Span 2) */}
            <div className="col-span-2 rounded-lg bg-slate-800/90 border border-slate-700/60 p-2 flex flex-col justify-between">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                <span className="text-[7px] font-bold uppercase text-cyan-300">INVESTIGATION</span>
              </div>
              <h6 className="text-[9px] font-bold leading-tight text-white line-clamp-2">
                Apple Newsroom Style Bento Box Card Grid
              </h6>
            </div>

            {/* Box 2 (Stat Column) */}
            <div className="col-span-1 rounded-lg bg-cyan-950/60 border border-cyan-800/40 p-1.5 flex flex-col justify-between">
              <span className="text-[7px] font-bold text-cyan-300">PULSE</span>
              <span className="text-xs font-black text-cyan-100 font-mono">98%</span>
              <span className="text-[6px] text-slate-400">Verified</span>
            </div>
          </div>

          <div className="h-5 rounded-md bg-slate-800/60 border border-slate-700/40 flex items-center px-2 text-[7px] text-slate-400 justify-between">
            <span>🎙️ Audio Dispatch Pill</span>
            <span className="text-cyan-400">2:45 min</span>
          </div>
        </div>
      );

    case 'genz-neo-brutalist':
      return (
        <div className="w-full h-44 bg-[#fef08a] text-black p-2.5 rounded-xl border-2 border-black font-sans overflow-hidden select-none flex flex-col justify-between shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          {/* Brutalist Marquee */}
          <div className="bg-black text-lime-400 px-1.5 py-0.5 text-[8px] font-mono font-black uppercase tracking-wider flex items-center justify-between border border-black">
            <span>⚡ REAL TALK • NO BS</span>
            <span className="bg-lime-400 text-black px-1 rounded text-[7px]">LIVE</span>
          </div>

          {/* Sticker Card Stack */}
          <div className="space-y-1.5 my-1">
            <div className="bg-white border-2 border-black p-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="bg-lime-300 text-black font-black text-[7px] px-1 border border-black">
                  REAL TALK
                </span>
                <span className="bg-pink-300 text-black font-black text-[7px] px-1 border border-black">
                  🔥 VIRAL
                </span>
              </div>
              <h5 className="text-[9px] font-black uppercase leading-tight text-black">
                Chunky Borders &amp; 3D Hard Shadows for Next-Gen Readers
              </h5>
            </div>
          </div>

          {/* Bottom TL;DR pill */}
          <div className="bg-cyan-300 border-2 border-black px-2 py-0.5 text-[7px] font-black uppercase flex justify-between shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            <span>👀 TL;DR BULLET DISPATCHES</span>
            <span>100% POP</span>
          </div>
        </div>
      );

    case 'clean-nordic-white':
      return (
        <div className="w-full h-44 bg-white text-neutral-900 p-3 rounded-xl border border-neutral-200 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
            <span className="text-[10px] font-light tracking-widest uppercase text-neutral-900">
              K J I N &bull; N O R D I C
            </span>
            <span className="text-[7px] font-mono uppercase tracking-widest text-neutral-400">
              PURE PAPER
            </span>
          </div>

          <div className="my-auto space-y-1.5">
            <div className="text-[7px] font-medium tracking-widest uppercase text-neutral-400">
              HIGH-CONTRAST READABILITY
            </div>
            <h4 className="text-[11px] font-normal tracking-tight text-neutral-950 leading-snug">
              Scandinavian Clean Minimalism with Soft Hairline Rules and Airy Spacing
            </h4>
            <div className="h-0.5 w-12 bg-neutral-900"></div>
          </div>

          <div className="flex items-center justify-between text-[7px] text-neutral-400 border-t border-neutral-100 pt-1.5 font-medium">
            <span>CHARCOAL TYPOGRAPHY</span>
            <span>100% PURE WHITE</span>
          </div>
        </div>
      );

    case 'visual-stories-deck':
      return (
        <div className="w-full h-44 bg-[#0c0a09] text-stone-100 p-2 rounded-xl border border-stone-800 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          {/* Top Reels Avatars */}
          <div className="flex items-center gap-1.5 border-b border-stone-800/80 pb-1.5 overflow-hidden">
            {[
              { icon: '🏔️', ring: 'from-amber-400 to-rose-500' },
              { icon: '⚖️', ring: 'from-emerald-400 to-teal-600' },
              { icon: '🎨', ring: 'from-purple-500 to-pink-500' },
              { icon: '📊', ring: 'from-blue-500 to-cyan-400' },
            ].map((bubble, i) => (
              <div key={i} className={`p-[1.5px] rounded-full bg-gradient-to-tr ${bubble.ring} shrink-0`}>
                <div className="w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center text-[9px] border border-stone-950">
                  {bubble.icon}
                </div>
              </div>
            ))}
            <span className="text-[8px] text-stone-400 ml-auto font-mono">REELS</span>
          </div>

          {/* 9:16 Portrait Card Preview */}
          <div className="grid grid-cols-2 gap-1.5 my-1 flex-1">
            <div className="rounded-lg bg-gradient-to-b from-stone-800 to-rose-950/80 border border-stone-700/50 p-1.5 flex flex-col justify-end relative overflow-hidden">
              <span className="absolute top-1 left-1 text-[6px] font-black uppercase bg-black/60 px-1 py-0.2 rounded text-rose-300">
                STORY
              </span>
              <span className="text-[8px] font-bold text-white leading-tight">
                Mobile Reels Feed
              </span>
            </div>
            <div className="rounded-lg bg-gradient-to-b from-stone-800 to-purple-950/80 border border-stone-700/50 p-1.5 flex flex-col justify-end relative overflow-hidden">
              <span className="absolute top-1 left-1 text-[6px] font-black uppercase bg-black/60 px-1 py-0.2 rounded text-purple-300">
                VIDEO
              </span>
              <span className="text-[8px] font-bold text-white leading-tight">
                Vertical 9:16 Cards
              </span>
            </div>
          </div>

          <div className="text-[7px] text-stone-400 flex items-center justify-between border-t border-stone-800/80 pt-1">
            <span>INSTAGRAM / TIKTOK CAROUSEL</span>
            <span className="text-rose-400 font-bold">STORY RINGS</span>
          </div>
        </div>
      );

    case 'tech-terminal-wire':
      return (
        <div className="w-full h-44 bg-[#050805] text-[#22c55e] p-2.5 rounded-xl border border-[#14532d] font-mono overflow-hidden select-none flex flex-col justify-between shadow-inner">
          {/* CLI Prompt Bar */}
          <div className="flex items-center justify-between border-b border-[#14532d] pb-1 text-[7px] text-[#4ade80]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping"></span>
              $ kjin-wire --live
            </span>
            <span className="text-[#22c55e] font-bold">[ACTIVE]</span>
          </div>

          {/* Terminal Console Output */}
          <div className="space-y-1 my-1">
            <div className="text-[8px] text-neutral-300">
              <span className="text-[#22c55e] font-black">&gt;_</span> KJIN TELEMETRY DESK
            </div>
            <div className="text-[7px] text-[#22c55e] bg-[#020402] border border-[#14532d] p-1 rounded">
              [STATUS: VERIFIED] 20 NODES ONLINE<br />
              ENC: AES-GCM-256 &bull; PHOSPHOR MATRIX
            </div>
          </div>

          <div className="text-[7px] text-[#4ade80]/80 flex items-center justify-between border-t border-[#14532d] pt-1">
            <span>+--[ASCII CLI WIRE]--+</span>
            <span className="text-[#22c55e]">RETRO CRT</span>
          </div>
        </div>
      );

    case 'hyperlocal-community':
      return (
        <div className="w-full h-44 bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-300 font-sans overflow-hidden select-none flex flex-col justify-between shadow-inner">
          {/* Civic Advisory Banner */}
          <div className="bg-emerald-800 text-white px-2 py-0.5 rounded text-[7px] font-bold flex items-center justify-between">
            <span>CIVIC BULLETIN &bull; NH-44 NORMAL</span>
            <span className="text-emerald-300">20 DISTRICTS</span>
          </div>

          {/* District Quick Switcher Pills */}
          <div className="my-1 space-y-1">
            <div className="flex flex-wrap gap-1">
              {['Srinagar', 'Jammu', 'Baramulla', 'Anantnag'].map((d) => (
                <span
                  key={d}
                  className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[7px] font-semibold"
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="bg-white rounded border border-slate-200 p-1.5 shadow-sm text-[8px]">
              <span className="text-[6px] font-bold text-emerald-700 uppercase block">
                VOICES FROM THE VALLEY
              </span>
              <span className="text-slate-800 font-medium line-clamp-1">
                &ldquo;Local Saffron Farmers Adopt Drip Irrigation&rdquo;
              </span>
            </div>
          </div>

          <div className="text-[7px] text-slate-500 flex justify-between border-t border-slate-200 pt-1 font-medium">
            <span>GRASSROOTS CITIZEN WIRE</span>
            <span className="text-emerald-700 font-bold">COMMUNITY HUB</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
