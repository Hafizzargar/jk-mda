'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { RegionalStationWeather } from '@/lib/weather';
import { REGIONAL_STATIONS } from '@/lib/weather';

interface TerritorialBureauTelemetrySliderProps {
  initialWeather?: RegionalStationWeather[];
  langPrefix?: string;
}

export function TerritorialBureauTelemetrySlider({
  initialWeather,
  langPrefix = '',
}: TerritorialBureauTelemetrySliderProps) {
  // Merge live weather records with our calibrated regional station telemetry
  const stations = React.useMemo(() => {
    return REGIONAL_STATIONS.map((base) => {
      const live = initialWeather?.find(
        (w) => w.station_id === base.id || w.name?.toLowerCase().includes(base.districtSlug)
      );
      return {
        id: base.id,
        name: base.name,
        district: base.district,
        districtSlug: base.districtSlug,
        region: base.region,
        elevation: base.elevation,
        coordinates: base.coordinates,
        temp_c: typeof live?.temp_c === 'number' ? live.temp_c : base.fallbackTemp,
        weather_desc: live?.weather_desc || 'Station Active',
        wind_kph: typeof live?.wind_kph === 'number' ? live.wind_kph : 5.0,
        status: live?.status || 'optimal',
      };
    });
  }, [initialWeather]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const SLIDE_DURATION_MS = 10000; // 10 seconds per slide as requested
  const PROGRESS_TICK_MS = 100;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % stations.length);
    setProgress(0);
  }, [stations.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + stations.length) % stations.length);
    setProgress(0);
  }, [stations.length]);

  // Auto-rotating 10-second timer with smooth progress bar
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextSlide();
          return 0;
        }
        return prev + (PROGRESS_TICK_MS / SLIDE_DURATION_MS) * 100;
      });
    }, PROGRESS_TICK_MS);

    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const currentStation = stations[currentIndex] || stations[0];

  return (
    <div
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans select-none"
      data-purpose="territorial-bureau-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header with Open-Meteo badge and station counter */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F172A] flex items-center gap-1.5">
          <span>🗺️</span>
          <span>Territorial Bureau Map</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Open-Meteo Live
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {currentIndex + 1}/{stations.length}
          </span>
        </div>
      </div>

      {/* Main Telemetry Terminal Screen */}
      <div className="relative w-full h-44 rounded-xl bg-slate-950 text-white overflow-hidden p-3.5 flex flex-col justify-between border border-slate-800 shadow-inner group">
        {/* Subtle decorative radar grid background */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent pointer-events-none" />
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full border border-slate-800/80 pointer-events-none" />
        <div className="absolute -right-2 -bottom-2 w-24 h-24 rounded-full border border-cyan-900/30 pointer-events-none" />

        {/* Top Status Indicators & Weather */}
        <div className="relative z-10 flex justify-between items-start gap-2">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              LIVE RADAR SYNC
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 text-[9px] font-mono border border-slate-700/60 uppercase">
              {currentStation.region}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-amber-300 block">
              {currentStation.temp_c}°C • {currentStation.weather_desc}
            </span>
            <span className="text-[9.5px] font-mono text-slate-400">
              Wind: {currentStation.wind_kph} km/h
            </span>
          </div>
        </div>

        {/* Middle / Bottom: Station Coordinates and Dynamic Details */}
        <div className="relative z-10 transition-opacity duration-300">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
              <span className="text-cyan-400 text-xs">◈</span>
              <span>{currentStation.name}</span>
            </p>
          </div>
          <p className="text-[10px] text-slate-300 font-mono tracking-tight">
            {currentStation.coordinates} • <span className="text-amber-300/90 font-medium">Elev {currentStation.elevation}</span>
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span className="text-slate-400">Telemetry: <strong className="text-emerald-400">Synchronized</strong></span>
            <Link
              href={`${langPrefix}/district/${currentStation.districtSlug}`}
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-0.5 font-bold"
            >
              <span>{currentStation.district} Filings</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* 10-Second Progress Bar Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800/80 overflow-hidden">
          <div
            className="h-full bg-cyan-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Next / Prev Quick Nav Arrows (revealed on hover) */}
        <button
          type="button"
          onClick={prevSlide}
          title="Previous District Station"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-md"
        >
          &lsaquo;
        </button>
        <button
          type="button"
          onClick={nextSlide}
          title="Next District Station"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-md"
        >
          &rsaquo;
        </button>
      </div>

      {/* Station Selector Pills / Carousel Dots */}
      <div className="flex items-center justify-center gap-1 mt-2.5 flex-wrap">
        {stations.map((st, idx) => (
          <button
            key={st.id}
            type="button"
            onClick={() => {
              setCurrentIndex(idx);
              setProgress(0);
            }}
            title={`${st.district} (${st.region}) - Click to inspect`}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono transition cursor-pointer ${
              idx === currentIndex
                ? 'bg-slate-900 text-cyan-300 font-bold shadow-xs border border-cyan-800/50'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
            }`}
          >
            {st.district}
          </button>
        ))}
      </div>

      {/* Explanatory telemetry footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <span>Auto-cycles every 10s across 9 key district stations</span>
        <Link
          href={`${langPrefix}/map`}
          className="text-cyan-600 font-bold hover:underline shrink-0"
        >
          Full Map &rarr;
        </Link>
      </div>
    </div>
  );
}
