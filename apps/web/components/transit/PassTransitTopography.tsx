'use client';

import { useState } from 'react';
import type { TelemetrySettings, MountainPassItem, ConvoySlotItem, FieldSensorItem, BureauContactItem } from '@/lib/telemetry';

interface PassTransitTopographyProps {
  telemetry: TelemetrySettings;
  brandName: string;
  brandFullName: string;
}

function IconAdd({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconRemove({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconReset({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconPlay({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function IconPause({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function IconSync({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function IconWifi({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconPhone({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconCellTower({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v20M4.93 4.93a10 10 0 0 1 14.14 0M7.76 7.76a6 6 0 0 1 8.48 0" />
    </svg>
  );
}

function IconDownload({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconEmergency({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconShield({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconSatellite({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a10 10 0 0 1 10 10M12 6a6 6 0 0 1 6 6" />
    </svg>
  );
}

function IconShare({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconSwipe({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function PassTransitTopography({ telemetry, brandName, brandFullName }: PassTransitTopographyProps) {
  const [filter, setFilter] = useState<'all' | 'closed' | 'regulated' | 'open'>('all');
  const [currentZoom, setCurrentZoom] = useState(1);
  const [showContours, setShowContours] = useState(true);
  const [showAvalanche, setShowAvalanche] = useState(true);
  const [showSnowcutters, setShowSnowcutters] = useState(true);
  const [showMilitaryWindow, setShowMilitaryWindow] = useState(false);
  const [activeAudioPass, setActiveAudioPass] = useState<string | null>(null);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [showFieldReport, setShowFieldReport] = useState(false);
  const [copiedSmsSyntax, setCopiedSmsSyntax] = useState(false);
  const [hudToast, setHudToast] = useState<{ message: string; title?: string } | null>(null);

  const showHudToast = (message: string, title = 'Topographic Cache') => {
    setHudToast({ message, title });
    setTimeout(() => {
      setHudToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const passes = telemetry.mountain_passes || [];
  const filteredPasses = passes.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'regulated') return p.status === 'caution';
    return p.status === filter;
  });

  const closedCount = passes.filter(p => p.status === 'closed').length;
  const regulatedCount = passes.filter(p => p.status === 'caution').length;
  const openCount = passes.filter(p => p.status === 'open').length;

  const convoySlots: ConvoySlotItem[] = telemetry.convoy_slots || [
    {
      id: 'slot-1',
      corridor_code: 'NH-1D',
      corridor_name: 'Zoji La (Minamarg Gate)',
      directional_flow: 'Ladakh towards Kashmir (Downhill)',
      open_time: '06:00 IST',
      cutoff_time: '11:30 IST',
      vehicle_tier: 'LMVs & 4x4 Chains Mandated',
      clearance_status: 'verified',
      clearance_label: 'VERIFIED PASS',
    },
    {
      id: 'slot-2',
      corridor_code: 'NH-1D',
      corridor_name: 'Zoji La (Sonamarg/Baltal)',
      directional_flow: 'Kashmir towards Ladakh (Uphill)',
      open_time: '12:30 IST',
      cutoff_time: '16:00 IST',
      vehicle_tier: 'Petroleum Tankers & Military Essential',
      clearance_status: 'regulated',
      clearance_label: 'REGULATED CONVOY',
    },
    {
      id: 'slot-3',
      corridor_code: 'NH-44',
      corridor_name: 'Jammu - Srinagar Tunnel',
      directional_flow: 'Bi-Directional Continuous',
      open_time: '00:00 IST',
      cutoff_time: '24-HR UNBLOCKED',
      vehicle_tier: 'All Passenger & Commercial Cargo',
      clearance_status: 'clear',
      clearance_label: 'CLEAR GREEN',
    },
    {
      id: 'slot-4',
      corridor_code: 'NH-244',
      corridor_name: 'Sinthan Top (Chingam)',
      directional_flow: 'Kishtwar to Anantnag',
      open_time: '09:00 IST',
      cutoff_time: '14:00 IST',
      vehicle_tier: 'Light Motor Vehicles (4x4 ONLY)',
      clearance_status: 'chains',
      clearance_label: 'CHAINS REQUIRED',
    },
    {
      id: 'slot-5',
      corridor_code: 'MUGHAL',
      corridor_name: 'Peer Ki Gali (Bafliaz)',
      directional_flow: 'Shopian <--> Poonch / Rajouri',
      open_time: 'SUSPENDED',
      cutoff_time: 'SUSPENDED',
      vehicle_tier: 'Strictly No Civilian Vehicles Permitted',
      clearance_status: 'blocked',
      clearance_label: 'RED BLOCKED',
    },
  ];

  const fieldSensors: FieldSensorItem[] = telemetry.field_sensors || [
    {
      id: 'sensor-1',
      code: 'BRO SENSOR NODE: Z-44',
      status: 'calibrated',
      name: 'Baltal Avalanche Chute #12',
      metric_name: 'Snowpack Compaction',
      metric_value: '428 kg/m³',
      percent: 65,
      bar_color: 'jammu',
    },
    {
      id: 'sensor-2',
      code: 'AWS PIR PANJAL: PKG-02',
      status: 'warning',
      name: 'Peer Ki Gali Ridge Sensor',
      metric_name: 'Wind Gust Velocity',
      metric_value: '78 km/h (Blizzard)',
      percent: 88,
      bar_color: 'crimson',
    },
    {
      id: 'sensor-3',
      code: 'BRO VIJAYAK: MIN-07',
      status: 'calibrated',
      name: 'Minamarg Checkpoint Transponder',
      metric_name: 'Road Friction Coeff',
      metric_value: '0.24 µ (Icy Glaze)',
      percent: 40,
      bar_color: 'chenab',
    },
  ];

  const bureauContacts: BureauContactItem[] = telemetry.bureau_contacts || [
    {
      id: 'bureau-kashmir',
      name: 'Kashmir Bureau',
      corridor_color: 'kashmir',
      address: 'Press Enclave, Residency Road, Srinagar 190001',
      wire_phone: 'Wire Desk: +91 194 2452001',
      tele_freq: 'Tele-freq: KASH-NET 142.85 MHz',
    },
    {
      id: 'bureau-jammu',
      name: 'Jammu Bureau',
      corridor_color: 'jammu',
      address: 'Bahu Plaza Complex, Railhead, Jammu 180012',
      wire_phone: 'Wire Desk: +91 191 2471900',
      tele_freq: 'Central Feed: JM-DISP-02',
    },
    {
      id: 'bureau-chenab',
      name: 'Chenab Valley Bureau',
      corridor_color: 'chenab',
      address: 'Pul Doda Transit Centre, Doda 182202',
      wire_phone: 'Field Telemetry: Kishtwar / Ramban / Doda',
      tele_freq: 'Emergency Link: CH-TER-09',
    },
    {
      id: 'bureau-panjal',
      name: 'Pir Panjal Bureau',
      corridor_color: 'panjal',
      address: 'Dak Bungalow Road, Rajouri 185131',
      wire_phone: 'Poonch Border Wire: +91 1962 263110',
      tele_freq: 'Sector Pass Monitoring Cell',
    },
    {
      id: 'bureau-ladakh',
      name: 'Ladakh Bureau',
      corridor_color: 'ladakh',
      address: 'Old Road, Leh 194101 / Kargil Post',
      wire_phone: 'High-Altitude Link: +91 1982 252044',
      tele_freq: 'Z-Morh / Zojila Sensor Field',
    },
  ];

  const handleZoom = (delta: number) => {
    setCurrentZoom(prev => Math.min(2.2, Math.max(0.8, prev + delta)));
  };

  const resetZoom = () => {
    setCurrentZoom(1);
  };

  const handleHotspotClick = (passId: string) => {
    const el = document.getElementById(passId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#0891B2]');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#0891B2]'), 1800);
    }
  };

  const handleCacheRefresh = () => {
    setCacheRefreshing(true);
    setTimeout(() => {
      setCacheRefreshing(false);
      showHudToast('Offline Topographic Cache validated. 64.2 MB encrypted vector package intact.');
    }, 800);
  };

  const handleSos = () => {
    const confirmSos = confirm('Broadcast offline emergency SOS message with last known GPS altitude and telemetry to J&K Disaster Rapid Response Cell?');
    if (confirmSos) {
      window.location.href = `sms:112?body=${encodeURIComponent(telemetry.offline_sos_message || 'KCPJLN SOS HIGH-ALTITUDE PASS RESCUE NEEDED')}`;
    }
  };

  const copySmsSyntax = () => {
    navigator.clipboard.writeText('KCPJLN SOS [PASS_NAME] [VEHICLE_NO] [PERSONS]');
    setCopiedSmsSyntax(true);
    setTimeout(() => setCopiedSmsSyntax(false), 2000);
  };

  return (
    <div className="w-full bg-[#FAF8F5] text-[#1b1c1a] min-h-screen">
      {/* 1. Command Status Ticker & Operational Sub-Header */}
      <section className="w-full bg-[#0F172A] text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 text-xs font-mono">
          {/* Mobile Layout (sm:hidden) */}
          <div className="flex flex-col gap-2 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center space-x-1.5 bg-red-950/90 text-red-400 px-2 py-0.5 rounded border border-red-800/60 uppercase font-bold text-[10px] tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>ARTERY GIS COMMAND • LVL 4</span>
              </span>
              <button
                onClick={handleCacheRefresh}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] uppercase font-bold tracking-wider border border-slate-700"
              >
                <IconSync className={`w-3 h-3 ${cacheRefreshing ? 'animate-spin' : ''}`} />
                <span>Sync Cache</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <div>Vector Grid: <strong className="text-white">05:45 IST</strong></div>
              <div>Radar: <strong className="text-[#059669]">142 Nodes</strong></div>
              <div>BRO Fleet: <strong className="text-[#D97706]">48 GPS Active</strong></div>
              <div>Mesh Cache: <strong className="text-[#0891B2]">64.2 MB</strong></div>
            </div>
          </div>

          {/* Desktop/Tablet Layout (hidden sm:flex) */}
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-3 flex-wrap">
              <span className="flex items-center space-x-1.5 bg-red-950/80 text-red-400 px-2.5 py-0.5 rounded border border-red-800/60 uppercase font-bold tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>ARTERY GIS COMMAND • LEVEL 4 ACTIVE</span>
              </span>
              <span className="text-slate-300">VECTOR GRID: <strong className="text-white">05:45 IST SYNCED</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">RADAR SENSORS: <strong className="text-[#059669]">ONLINE (142 AWS NODES)</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">BRO FLEET GPS: <strong className="text-[#D97706]">48 APPARATUS TRACKED</strong></span>
            </div>

            <div className="flex items-center space-x-3 text-slate-300 text-xs">
              <span className="flex items-center space-x-1">
                <IconWifi className="w-3.5 h-3.5 text-[#0891B2]" />
                <span>MESH CACHE: 64.2 MB OFFLINE-READY</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-white uppercase font-semibold text-[11px]">SECTORS: BEACON • SAMPARK • HIMANK • VIJAYAK</span>
              <button
                onClick={handleCacheRefresh}
                className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] uppercase font-bold tracking-wider border border-slate-700"
              >
                <IconSync className={`w-3 h-3 ${cacheRefreshing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Editorial Command Header & Tactical Controls */}
      <section className="w-full bg-[#FAF8F5] py-5 sm:py-6 border-b border-[#CBD5E1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
            <span>Gazette Artery Bureau</span>
            <span>/</span>
            <span className="text-[#0F172A] font-bold">Territorial Transit Command</span>
            <span>/</span>
            <span className="text-[#059669] font-bold">Himalayan Passes Telemetry</span>
          </div>

          {/* Main Title & Pulse Badges */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-4xl space-y-2">
              <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] leading-tight tracking-tight">
                High-Altitude Mountain Pass Transit &amp; Highway GIS Command Center
              </h1>
              <p className="text-xs sm:text-base text-slate-600 leading-relaxed max-w-3xl font-sans">
                Real-time multi-spectral pass diagnostics, convoy clearance vectors, snow cutter fleet telemetry, and avalanche hazard contours across 7 vital territorial lifelines connecting the Kashmir Valley, Chenab Basin, Pir Panjal, Jammu, and the Trans-Himalayan plateau of Ladakh.
              </p>
            </div>

            {/* Metric Pulse Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-2 shrink-0 w-full lg:w-auto">
              <div className="bg-white border border-[#CBD5E1] px-3.5 py-2 rounded-xl shadow-sm flex lg:block items-center justify-between">
                <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-bold">Pass Operability</span>
                <div className="flex items-center justify-end space-x-2 mt-0.5">
                  <span className="text-[#D97706] font-mono font-bold text-xs sm:text-sm">42.8% ARTERIES CLEAR</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] shrink-0"></span>
                </div>
              </div>

              <div className="bg-white border border-[#CBD5E1] px-3.5 py-2 rounded-xl shadow-sm flex lg:block items-center justify-between">
                <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-bold">Worst Temperature</span>
                <span className="text-[#DC2626] font-mono font-bold text-xs sm:text-sm">-22.5°C @ Khardung La</span>
              </div>
            </div>
          </div>

          {/* Interactive Filter Ribbon */}
          <div className="mt-5 pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#CBD5E1] shadow-sm">
            {/* Filter Tabs - Horizontal Smooth Scroll on Mobile */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar w-full md:w-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center space-x-1.5 text-xs font-bold ${
                  filter === 'all'
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200'
                }`}
              >
                <span>All Strategic Passes</span>
                <span className="bg-white/20 px-1.5 py-0.2 rounded font-mono text-[10px]">{passes.length}</span>
              </button>

              <button
                onClick={() => setFilter('closed')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center space-x-1.5 text-xs font-bold ${
                  filter === 'closed'
                    ? 'bg-[#DC2626] text-white shadow-sm'
                    : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
                <span>Closed / Heavy Snow</span>
                <span className="bg-slate-300/60 px-1.5 py-0.2 rounded font-mono text-[10px]">{closedCount}</span>
              </button>

              <button
                onClick={() => setFilter('regulated')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center space-x-1.5 text-xs font-bold ${
                  filter === 'regulated'
                    ? 'bg-[#D97706] text-white shadow-sm'
                    : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#D97706]"></span>
                <span>Frost / Chains Only</span>
                <span className="bg-slate-300/60 px-1.5 py-0.2 rounded font-mono text-[10px]">{regulatedCount}</span>
              </button>

              <button
                onClick={() => setFilter('open')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center space-x-1.5 text-xs font-bold ${
                  filter === 'open'
                    ? 'bg-[#059669] text-white shadow-sm'
                    : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                <span>Open &amp; Monitored</span>
                <span className="bg-slate-300/60 px-1.5 py-0.2 rounded font-mono text-[10px]">{openCount}</span>
              </button>
            </div>

            {/* GIS Layer Matrix Toggles - Horizontal Smooth Scroll on Mobile */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar text-xs font-medium text-[#0F172A] pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
              <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={showAvalanche}
                  onChange={(e) => setShowAvalanche(e.target.checked)}
                  className="accent-[#0F172A] rounded w-3.5 h-3.5"
                />
                <span>Avalanche Red-Zones</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={showSnowcutters}
                  onChange={(e) => setShowSnowcutters(e.target.checked)}
                  className="accent-[#0F172A] rounded w-3.5 h-3.5"
                />
                <span>BRO Snowcutters GPS</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={showMilitaryWindow}
                  onChange={(e) => setShowMilitaryWindow(e.target.checked)}
                  className="accent-[#0F172A] rounded w-3.5 h-3.5"
                />
                <span>Military Window</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main GIS Workspace (Split-Pane Architecture) */}
      <section className="w-full py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Vector GIS Cartographic & Elevation Map Console (8 cols / ~66%) */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            {/* Map Container Plate */}
            <div className="relative bg-[#0F172A] rounded-2xl overflow-hidden shadow-xl aspect-[16/11] flex flex-col justify-between p-4 border border-slate-800">
              {/* Dynamic SVG Vector Relief & Artery Map */}
              <div className="absolute inset-0 w-full h-full overflow-hidden select-none">
                <svg
                  viewBox="0 0 1000 680"
                  className="w-full h-full object-cover transition-transform duration-300 origin-center"
                  style={{ transform: `scale(${currentZoom})` }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <radialGradient id="topographicGlow" cx="50%" cy="40%" r="65%">
                      <stop offset="0%" stopColor="#1E293B" stopOpacity="0.8" />
                      <stop offset="70%" stopColor="#0F172A" stopOpacity="1" />
                      <stop offset="100%" stopColor="#090D16" stopOpacity="1" />
                    </radialGradient>
                    <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Base Relief Background */}
                  <rect width="1000" height="680" fill="url(#topographicGlow)" />

                  {/* Topographic Relief Contours */}
                  {showContours && (
                    <g stroke="#334155" strokeWidth="0.75" fill="none" opacity="0.35">
                      <path d="M 50,120 Q 200,90 350,150 T 650,110 T 950,170" />
                      <path d="M 30,220 Q 220,180 400,240 T 700,200 T 980,260" />
                      <path d="M 60,330 Q 250,290 440,360 T 760,310 T 960,380" />
                      <path d="M 40,450 Q 280,410 490,480 T 800,430 T 970,500" />
                      <path d="M 80,560 Q 300,530 520,590 T 840,550 T 980,620" />
                      <ellipse cx="480" cy="280" rx="160" ry="90" strokeDasharray="4,4" />
                      <ellipse cx="490" cy="275" rx="110" ry="60" />
                      <ellipse cx="780" cy="180" rx="150" ry="80" strokeDasharray="2,3" />
                      <ellipse cx="250" cy="420" rx="120" ry="70" />
                    </g>
                  )}

                  {/* Avalanche Warning Hazard Zones (DGRE Red Corridors) */}
                  {showAvalanche && (
                    <g fill="#DC2626" fillOpacity="0.16">
                      <path d="M 570,220 L 640,200 L 680,260 L 610,290 Z" />
                      <path d="M 280,380 L 360,360 L 390,430 L 310,450 Z" />
                      <path d="M 390,130 L 460,110 L 490,180 L 420,200 Z" />
                    </g>
                  )}

                  {/* Major Regional River Lifelines */}
                  <g stroke="#0891B2" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.45">
                    {/* Chenab River Basin */}
                    <path d="M 700,450 Q 560,490 450,440 T 290,520 T 120,580" />
                    <text x="320" y="500" fill="#0891B2" opacity="0.8" fontSize="10" fontFamily="Inter" letterSpacing="2">CHENAB RIVER ARTERY</text>
                    {/* Jhelum River in Kashmir Basin */}
                    <path d="M 550,290 Q 460,260 410,230 T 280,210" strokeWidth="1.4" opacity="0.5" />
                    <text x="350" y="225" fill="#0891B2" opacity="0.7" fontSize="9" fontFamily="Inter" letterSpacing="1.5">JHELUM RIVER</text>
                    {/* Indus Artery in Ladakh */}
                    <path d="M 980,140 Q 860,180 750,220" strokeWidth="1.4" opacity="0.6" />
                    <text x="820" y="190" fill="#2563EB" opacity="0.8" fontSize="9" fontFamily="Inter" letterSpacing="1.5">INDUS VALLEY VECT</text>
                  </g>

                  {/* ARTERIAL HIGHWAYS */}
                  {/* 1. NH-44 Jammu to Srinagar (Green Open) */}
                  <g stroke="#059669" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#glowGreen)">
                    <path d="M 210,610 L 260,530 L 330,460 L 380,380 L 440,310 L 460,270" />
                  </g>
                  <text x="290" y="445" fill="#34D399" fontSize="10" fontWeight="700" fontFamily="Inter">NH-44 TRANSIT (OPEN)</text>

                  {/* 2. NH-1D Srinagar to Leh via Zojila (Amber Regulated) */}
                  <g stroke="#D97706" strokeWidth="3" strokeDasharray="7,3" fill="none" filter="url(#glowAmber)">
                    <path d="M 460,270 L 520,250 L 590,235 L 670,200 L 760,190 L 840,165" />
                  </g>
                  <text x="590" y="215" fill="#FBBF24" fontSize="10" fontWeight="700" fontFamily="Inter">NH-1D ZOJI LA CORRIDOR (CHAINS ONLY)</text>

                  {/* 3. Mughal Road (Red Closed) */}
                  <g stroke="#DC2626" strokeWidth="2.8" strokeDasharray="4,4" fill="none" filter="url(#glowRed)">
                    <path d="M 210,510 L 250,470 L 320,410 L 380,350 L 430,300" />
                  </g>
                  <text x="270" y="390" fill="#F87171" fontSize="10" fontWeight="700" fontFamily="Inter">MUGHAL ROAD (CLOSED)</text>

                  {/* 4. NH-244 Chenab-Sinthan Top (Amber) */}
                  <g stroke="#D97706" strokeWidth="2.5" strokeDasharray="6,4" fill="none">
                    <path d="M 420,480 L 490,440 L 530,380 L 470,320" />
                  </g>
                  <text x="495" y="405" fill="#FBBF24" fontSize="9" fontWeight="600" fontFamily="Inter">NH-244 SINTHAN (4x4)</text>

                  {/* 5. Razdan Corridor to Gurez (Red Closed) */}
                  <g stroke="#DC2626" strokeWidth="2.5" strokeDasharray="4,4" fill="none">
                    <path d="M 440,240 L 460,170 L 480,120" />
                  </g>

                  {/* 6. Ladakh High Passes to Nubra / Pangong (Blue) */}
                  <g stroke="#2563EB" strokeWidth="2.5" strokeDasharray="5,3" fill="none">
                    <path d="M 840,165 L 870,110" />
                    <path d="M 840,165 L 920,150" />
                  </g>

                  {/* STRATEGIC PASS HOTSPOT PINS */}
                  {/* Banihal Tunnel (Open) */}
                  <g transform="translate(380, 380)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-nh44')}>
                    <circle r="14" fill="#059669" fillOpacity="0.25" className="animate-ping" />
                    <circle r="8" fill="#059669" />
                    <circle r="4" fill="#FFFFFF" />
                    <rect x="12" y="-12" width="148" height="24" rx="4" fill="#0F172A" fillOpacity="0.9" />
                    <text x="18" y="4" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="Inter">BANIHAL TUNNEL 7,200ft</text>
                  </g>

                  {/* Peer Ki Gali (Closed) */}
                  <g transform="translate(320, 410)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-mughal')}>
                    <circle r="16" fill="#DC2626" fillOpacity="0.3" className="animate-ping" />
                    <circle r="8" fill="#DC2626" />
                    <path d="M -3,-3 L 3,3 M 3,-3 L -3,3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                    <rect x="12" y="-14" width="156" height="26" rx="4" fill="#0F172A" fillOpacity="0.95" />
                    <text x="18" y="3" fill="#F87171" fontSize="10" fontWeight="700" fontFamily="Inter">PEER KI GALI 11,450ft</text>
                  </g>

                  {/* Zoji La Pass (Regulated) */}
                  <g transform="translate(590, 235)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-zojila')}>
                    <circle r="15" fill="#D97706" fillOpacity="0.3" className="animate-ping" />
                    <circle r="8" fill="#D97706" />
                    <circle r="3" fill="#FFFFFF" />
                    <rect x="-170" y="-16" width="160" height="28" rx="4" fill="#0F172A" fillOpacity="0.95" />
                    <text x="-162" y="2" fill="#FBBF24" fontSize="10" fontWeight="700" fontFamily="Inter">ZOJI LA PASS 11,575ft</text>
                  </g>

                  {/* Sinthan Top (4x4) */}
                  <g transform="translate(530, 380)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-sinthan')}>
                    <circle r="7" fill="#D97706" />
                    <circle r="3" fill="#FFFFFF" />
                    <rect x="12" y="-12" width="140" height="24" rx="4" fill="#0F172A" fillOpacity="0.9" />
                    <text x="18" y="4" fill="#FBBF24" fontSize="10" fontWeight="700" fontFamily="Inter">SINTHAN TOP 12,414ft</text>
                  </g>

                  {/* Razdan Pass (Closed) */}
                  <g transform="translate(460, 170)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-razdan')}>
                    <circle r="7" fill="#DC2626" />
                    <circle r="3" fill="#FFFFFF" />
                    <rect x="12" y="-12" width="144" height="24" rx="4" fill="#0F172A" fillOpacity="0.9" />
                    <text x="18" y="4" fill="#F87171" fontSize="10" fontWeight="700" fontFamily="Inter">RAZDAN PASS 11,672ft</text>
                  </g>

                  {/* Sadhna Pass (Regulated) */}
                  <g transform="translate(340, 190)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-sadhna')}>
                    <circle r="7" fill="#D97706" />
                    <circle r="3" fill="#FFFFFF" />
                    <rect x="12" y="-12" width="148" height="24" rx="4" fill="#0F172A" fillOpacity="0.9" />
                    <text x="18" y="4" fill="#FBBF24" fontSize="10" fontWeight="700" fontFamily="Inter">SADHNA PASS 10,269ft</text>
                  </g>

                  {/* Khardung La (Military) */}
                  <g transform="translate(870, 110)" className="cursor-pointer" onClick={() => handleHotspotClick('pass-khardung')}>
                    <circle r="8" fill="#2563EB" />
                    <circle r="3" fill="#FFFFFF" />
                    <rect x="-182" y="-12" width="174" height="24" rx="4" fill="#0F172A" fillOpacity="0.9" />
                    <text x="-174" y="4" fill="#60A5FA" fontSize="10" fontWeight="700" fontFamily="Inter">KHARDUNG LA 17,582ft</text>
                  </g>

                  {/* BRO Heavy Snow Cutter Active Units (Oshkosh & Rolba) */}
                  {showSnowcutters && (
                    <>
                      <g transform="translate(565, 245)">
                        <rect x="0" y="0" width="16" height="16" rx="3" fill="#F59E0B" />
                        <text x="4" y="12" fill="#000" fontSize="10" fontWeight="bold" fontFamily="Inter">B</text>
                      </g>
                      <g transform="translate(330, 420)">
                        <rect x="0" y="0" width="16" height="16" rx="3" fill="#F59E0B" />
                        <text x="4" y="12" fill="#000" fontSize="10" fontWeight="bold" fontFamily="Inter">B</text>
                      </g>
                    </>
                  )}
                </svg>
              </div>

              {/* Top HUD Overlay Controls */}
              <div className="relative z-10 flex items-start justify-between pointer-events-none gap-2">
                <div className="bg-[#0F172A]/90 backdrop-blur-md p-2 rounded-lg border border-slate-700 shadow-lg pointer-events-auto">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider block font-mono hidden sm:block">VECTOR PROJECTION: LAMBERT CONICAL</span>
                  <span className="text-[10px] sm:text-xs text-white font-bold font-mono">INSAT-3DR • 33°17′N 75°01′E</span>
                </div>

                {/* Map HUD Controls */}
                <div className="flex items-center space-x-1.5 bg-[#0F172A]/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-lg text-white pointer-events-auto shrink-0">
                  <button
                    onClick={() => handleZoom(0.25)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition active:scale-95 text-white"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <IconAdd className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleZoom(-0.25)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition active:scale-95 text-white"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <IconRemove className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetZoom}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition active:scale-95 text-white"
                    title="Reset View"
                    aria-label="Reset View"
                  >
                    <IconReset className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom HUD Legend & Status Strip */}
              <div className="relative z-10 bg-[#0F172A]/90 backdrop-blur-md p-2 rounded-lg border border-slate-700 shadow-lg flex items-center justify-between gap-2 text-xs text-slate-300 overflow-x-auto no-scrollbar scrollbar-none">
                <div className="flex items-center space-x-3 whitespace-nowrap shrink-0 text-[11px]">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                    <span className="text-white">Open</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D97706]"></span>
                    <span className="text-white">Regulated / 4x4</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
                    <span className="text-white">Closed</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-3.5 h-3.5 rounded bg-amber-500 flex items-center justify-center text-[9px] font-bold text-slate-900">B</span>
                    <span className="text-white">BRO Unit</span>
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap shrink-0 hidden sm:block">
                  ELEVATION: 1k - 5.6k m
                </div>
              </div>
            </div>

            {/* Cartographic Elevation Cross-Section Profile Graphic */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CBD5E1] shadow-sm">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-[#0F172A] font-bold font-mono">
                    Vertical Elevation Profile: Jammu Plains to Ladakh Plateau
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cross-sectional terrain relief gradient illustrating vertical ascent hurdles and thermal inversion boundaries.
                  </p>
                </div>
                <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded text-[#0F172A] font-semibold border border-slate-200">
                  TRANSECT: SW to NE (438 KM)
                </span>
              </div>
              <div className="sm:hidden text-[11px] text-[#0891B2] font-mono flex items-center gap-1 mb-2">
                <IconSwipe className="w-3.5 h-3.5" />
                <span>Swipe horizontally to view full transect</span>
              </div>

              {/* Elevation Sparkline Profile Chart */}
              <div className="w-full bg-[#FAF8F5] p-3 rounded-xl border border-slate-200 overflow-x-auto">
                <svg viewBox="0 0 650 120" className="w-full h-32 min-w-[600px]" fill="none">
                  {/* Altitude Grid Lines */}
                  <line x1="50" y1="20" x2="630" y2="20" stroke="#E2E8F0" strokeDasharray="3,3" />
                  <text x="10" y="24" fill="#94A3B8" fontSize="9" fontFamily="Inter">5,500m</text>
                  <line x1="50" y1="50" x2="630" y2="50" stroke="#E2E8F0" strokeDasharray="3,3" />
                  <text x="10" y="54" fill="#94A3B8" fontSize="9" fontFamily="Inter">3,500m</text>
                  <line x1="50" y1="80" x2="630" y2="80" stroke="#E2E8F0" strokeDasharray="3,3" />
                  <text x="10" y="84" fill="#94A3B8" fontSize="9" fontFamily="Inter">2,000m</text>
                  <line x1="50" y1="110" x2="630" y2="110" stroke="#CBD5E1" strokeWidth="1.5" />
                  <text x="10" y="113" fill="#94A3B8" fontSize="9" fontFamily="Inter">300m</text>

                  {/* Mountain Relief Gradient Polygon */}
                  <path
                    d="M 50,110 L 90,108 L 160,95 L 230,78 L 290,48 L 340,65 L 420,52 L 480,47 L 540,68 L 590,18 L 630,72 L 630,110 Z"
                    fill="#0F172A"
                    fillOpacity="0.08"
                  />
                  <path
                    d="M 50,110 L 90,108 L 160,95 L 230,78 L 290,48 L 340,65 L 420,52 L 480,47 L 540,68 L 590,18 L 630,72"
                    stroke="#0F172A"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />

                  {/* Pass Labels along the Profile */}
                  <circle cx="50" cy="110" r="3.5" fill="#0F172A" />
                  <text x="50" y="102" fill="#475569" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="Inter">Jammu (327m)</text>

                  <circle cx="160" cy="95" r="3" fill="#475569" />
                  <text x="160" y="88" fill="#64748B" fontSize="8" textAnchor="middle" fontFamily="Inter">Ramban (1,156m)</text>

                  <circle cx="230" cy="78" r="4" fill="#059669" />
                  <text x="230" y="70" fill="#059669" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="Inter">Banihal (2,190m)</text>

                  <circle cx="290" cy="48" r="4.5" fill="#DC2626" />
                  <text x="290" y="40" fill="#DC2626" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="Inter">Peer Ki Gali (3,490m)</text>

                  <circle cx="340" cy="65" r="3" fill="#059669" />
                  <text x="340" y="58" fill="#475569" fontSize="8" textAnchor="middle" fontFamily="Inter">Srinagar (1,585m)</text>

                  <circle cx="480" cy="47" r="4.5" fill="#D97706" />
                  <text x="480" y="38" fill="#D97706" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="Inter">Zoji La (3,528m)</text>

                  <circle cx="540" cy="68" r="3" fill="#2563EB" />
                  <text x="540" y="60" fill="#64748B" fontSize="8" textAnchor="middle" fontFamily="Inter">Kargil (2,676m)</text>

                  <circle cx="590" cy="18" r="5" fill="#2563EB" />
                  <text x="590" y="12" fill="#2563EB" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Inter">Khardung La (5,359m)</text>
                </svg>
              </div>
            </div>

            {/* Multi-Source Telemetry Field Sensors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fieldSensors.map((sensor) => {
                const barBg =
                  sensor.bar_color === 'crimson'
                    ? 'bg-[#DC2626]'
                    : sensor.bar_color === 'chenab'
                    ? 'bg-[#0891B2]'
                    : sensor.bar_color === 'kashmir'
                    ? 'bg-[#059669]'
                    : 'bg-[#D97706]';

                const statusColor =
                  sensor.status === 'alert'
                    ? 'text-[#DC2626]'
                    : sensor.status === 'warning'
                    ? 'text-[#DC2626]'
                    : 'text-[#059669]';

                return (
                  <div key={sensor.id} className="bg-white p-4 rounded-xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                        <span>{sensor.code}</span>
                        <span className={`font-bold uppercase ${statusColor}`}>{sensor.status}</span>
                      </div>
                      <span className="text-xs font-bold text-[#0F172A] block">{sensor.name}</span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-xs font-mono">
                        <span className="text-slate-500">{sensor.metric_name}</span>
                        <span className="text-[#0F172A] font-bold">{sensor.metric_value}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div className={`h-full ${barBg}`} style={{ width: `${sensor.percent}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Pass Dossiers & Real-Time Intelligence Rail (4 cols / ~34%) */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            {/* Dossier Panel Header */}
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-[#CBD5E1] shadow-sm">
              <div>
                <h2 className="text-xs uppercase tracking-widest text-[#0F172A] font-bold font-mono">
                  Pass Dossiers &amp; Sector Bulletins
                </h2>
                <span className="text-xs text-slate-500">High-priority operational directives</span>
              </div>
              <IconShare className="w-4 h-4 text-slate-600" />
            </div>

            {/* Filtered Pass Cards */}
            <div className="space-y-4 lg:max-h-[960px] lg:overflow-y-auto lg:pr-1.5 scrollbar-thin">
              {filteredPasses.map((pass) => {
                const isClosed = pass.status === 'closed';
                const isCaution = pass.status === 'caution';
                const isOpen = pass.status === 'open';

                const statusBg = isClosed
                  ? 'bg-red-50 text-[#DC2626] border-red-200'
                  : isCaution
                  ? 'bg-amber-50 text-[#D97706] border-amber-200'
                  : 'bg-emerald-50 text-[#059669] border-emerald-200';

                const pingBg = isClosed
                  ? 'bg-[#DC2626]'
                  : isCaution
                  ? 'bg-[#D97706]'
                  : 'bg-[#059669]';

                const isPlaying = activeAudioPass === pass.id;

                return (
                  <article
                    key={pass.id}
                    id={pass.id}
                    className="pass-card bg-white rounded-2xl p-5 border border-[#CBD5E1] shadow-sm transition hover:shadow-md space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-[#0F172A]">
                        {pass.corridor}
                      </span>
                      <span className={`flex items-center space-x-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${statusBg}`}>
                        <span className={`w-2 h-2 rounded-full ${pingBg} ${isClosed ? 'animate-ping' : ''}`}></span>
                        <span>{pass.status_label}</span>
                      </span>
                    </div>

                    <div>
                      <h3 className="font-serif text-xl font-bold text-[#0F172A] leading-tight">
                        {pass.name} ({pass.elevation})
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        Clearance Agency: {pass.clearance_agency}
                      </p>
                    </div>

                    {/* Core Telemetry Metric Pillbox */}
                    <div className="grid grid-cols-3 gap-2 bg-[#FAF8F5] p-2.5 rounded-xl border border-slate-200 text-center">
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Surface Temp</span>
                        <span className="font-mono text-xs font-bold text-[#0891B2]">{pass.road_surface_temp}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Snow Depth</span>
                        <span className="font-mono text-xs font-bold text-[#0F172A]">{pass.snow_depth}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Hazard Index</span>
                        <span className={`font-mono text-xs font-bold ${isClosed ? 'text-[#DC2626]' : isCaution ? 'text-[#D97706]' : 'text-[#059669]'}`}>
                          {pass.avalanche_hazard}
                        </span>
                      </div>
                    </div>

                    {/* Operational Directive */}
                    <div className="text-xs text-slate-600 leading-relaxed font-sans bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      <strong className="text-[#0F172A] block mb-0.5">{pass.advisory_title}</strong>
                      <span>{pass.advisory_desc}</span>
                    </div>

                    {/* Convoy Slot or Opening timing */}
                    {pass.projected_opening_or_slot && (
                      <div className="flex items-center justify-between text-xs bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
                        <span className="text-slate-500 text-[11px] uppercase">Transit Window:</span>
                        <strong className="text-[#0F172A]">{pass.projected_opening_or_slot}</strong>
                      </div>
                    )}

                    {/* Audio Field Memo */}
                    {pass.audio_memo && (
                      <div className="bg-slate-100 p-2.5 rounded-xl flex items-center justify-between gap-3 border border-slate-200">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={() => setActiveAudioPass(isPlaying ? null : pass.id)}
                            className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center shrink-0 hover:scale-105 transition"
                            title="Play Field Audio"
                          >
                            {isPlaying ? <IconPause className="w-4 h-4" /> : <IconPlay className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-[#0F172A] block truncate">{pass.audio_memo.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Recorded {pass.audio_memo.time} • {pass.audio_memo.duration}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D97706] shrink-0">
                          {isPlaying ? 'Playing...' : 'Audio Wire'}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Real-Time Convoy Slot Schedule & Timetable Matrix */}
      <section className="w-full bg-[#FAF8F5] py-8 border-t border-[#CBD5E1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#D97706] font-bold font-mono block mb-1">
                CONVOY REGULATION DIRECTIVE • T-24 HOUR WINDOW
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#0F172A]">
                Strategic Inter-Valley Convoy Slot Matrix
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-2 md:mt-0">
              Authority: Joint Inter-State Traffic Police &amp; BRO Beacon Desk
            </div>
          </div>

          <div className="sm:hidden text-[11px] text-[#0891B2] font-mono flex items-center gap-1 mb-2">
            <IconSwipe className="w-3.5 h-3.5" />
            <span>Swipe horizontally to inspect all corridor slots</span>
          </div>

          {/* Broadsheet Style Timetable Grid */}
          <div className="w-full bg-white rounded-2xl overflow-hidden border border-[#CBD5E1] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm min-w-[620px]">
                <thead className="bg-slate-100 font-mono text-xs uppercase tracking-wider text-[#0F172A] border-b border-[#CBD5E1]">
                  <tr>
                    <th className="py-3 px-4">Pass &amp; Highway Corridor</th>
                    <th className="py-3 px-4">Directional Flow</th>
                    <th className="py-3 px-4">Entry Gate Open</th>
                    <th className="py-3 px-4">Rigid Cutoff IST</th>
                    <th className="py-3 px-4">Vehicle Eligibility Tier</th>
                    <th className="py-3 px-4 text-right">Clearance Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {convoySlots.map((slot) => {
                    const statusBadge =
                      slot.clearance_status === 'verified'
                        ? 'bg-emerald-50 text-[#059669] border-emerald-200'
                        : slot.clearance_status === 'regulated'
                        ? 'bg-amber-50 text-[#D97706] border-amber-200'
                        : slot.clearance_status === 'clear'
                        ? 'bg-emerald-50 text-[#059669] border-emerald-200'
                        : slot.clearance_status === 'chains'
                        ? 'bg-amber-50 text-[#D97706] border-amber-200'
                        : 'bg-red-50 text-[#DC2626] border-red-200';

                    return (
                      <tr key={slot.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#0F172A]">
                          <span className="text-[#2563EB] mr-1.5 font-mono">{slot.corridor_code}</span>
                          {slot.corridor_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{slot.directional_flow}</td>
                        <td className="py-3 px-4 font-mono font-semibold">{slot.open_time}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#DC2626]">{slot.cutoff_time}</td>
                        <td className="py-3 px-4 text-slate-600">{slot.vehicle_tier}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${statusBadge}`}>
                            {slot.clearance_label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Emergency Transit Control Rooms & Offline Mesh Dispatch Bar */}
      <section className="w-full bg-[#FAF8F5] py-8 border-t border-[#CBD5E1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Direct Transit Control Trunk Lines (8 cols) */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-[#DC2626] text-xs uppercase font-mono font-bold tracking-wider mb-2">
                  <IconPhone className="w-4 h-4" />
                  <span>High-Altitude Transit Control Rooms &amp; SOS Trunk Lines</span>
                </div>
                <p className="text-xs text-slate-600 mb-4 font-sans">
                  Immediate satellite tele-links and dedicated traffic PCR wire desks for emergency vehicle distress or pass blockades.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {telemetry.emergency_hotlines.map((hotline) => (
                    <a
                      key={hotline.id}
                      href={`tel:${hotline.phone.replace(/[^0-9]/g, '')}`}
                      className="bg-[#FAF8F5] p-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition shadow-inner block"
                    >
                      <span className="text-slate-500 block text-[10px] font-mono uppercase truncate">{hotline.title}</span>
                      <strong className="text-[#0F172A] font-bold text-sm block mt-0.5 font-mono">{hotline.phone}</strong>
                      <span className="text-[#059669] text-[10px] font-semibold uppercase">24-Hr Live Desk</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-mono gap-2">
                <span>HAM Radio Secondary Disaster Frequency: <strong>145.500 MHz</strong></span>
                <span>All emergency links synchronized with State Disaster Response Force (SDRF).</span>
              </div>
            </div>

            {/* Offline Emergency Beacon & Mesh Relay Box (4 cols) */}
            <div className="lg:col-span-4 bg-[#0F172A] text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between border border-slate-800">
              <div>
                <div className="flex items-center space-x-2 text-[#0891B2] text-xs font-mono uppercase tracking-widest font-bold mb-2">
                  <IconCellTower className="w-4 h-4" />
                  <span>Offline SMS Beacon Protocol</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-white leading-tight">
                  Stranded Without Internet Signal?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-2 font-sans">
                  In deep gorges or zero-data high passes (Zojila, Sinthan, Peer Ki Gali), transmit low-frequency geo-coded SMS beacons to our central autonomous relay node.
                </p>

                <div className="bg-slate-800/80 p-3.5 rounded-xl mt-3 space-y-2 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400 uppercase">Emergency Beacon Syntax:</span>
                    <button
                      onClick={copySmsSyntax}
                      className="text-[10px] font-mono text-[#0891B2] hover:underline"
                    >
                      {copiedSmsSyntax ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-[#0F172A] p-2 rounded font-mono text-xs text-[#0891B2] select-all border border-slate-900">
                    KCPJLN SOS [PASS_NAME] [VEHICLE_NO] [PERSONS]
                  </div>
                  <span className="text-[11px] text-slate-400 block font-mono">
                    SMS Gateway Toll-Free: <strong>56161</strong> or <strong>+91 94190 00112</strong>
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={handleSos}
                  className="w-full bg-[#DC2626] hover:bg-red-700 text-white font-mono text-xs uppercase tracking-wider font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-md active:scale-95"
                >
                  <IconEmergency className="w-4 h-4" />
                  <span>Broadcast Emergency SOS SMS</span>
                </button>

                <button
                  onClick={() => showHudToast('Offline Vector Map Package (64.2 MB) cached successfully for 48h offline navigation.')}
                  className="w-full bg-[#0891B2] hover:bg-cyan-600 text-slate-900 font-mono text-xs uppercase tracking-wider font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-md active:scale-95"
                >
                  <IconDownload className="w-4 h-4" />
                  <span>Download Offline Vector Map Pack (64 MB)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. 5-Column Regional Bureau Directory Footer */}
      <footer className="w-full bg-[#0F172A] text-slate-300 border-t-2 border-[#0F172A] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 border-b border-slate-800 pb-8">
            {bureauContacts.map((bureau) => {
              const borderCol =
                bureau.corridor_color === 'kashmir'
                  ? 'border-[#059669] text-[#059669]'
                  : bureau.corridor_color === 'jammu'
                  ? 'border-[#D97706] text-[#D97706]'
                  : bureau.corridor_color === 'chenab'
                  ? 'border-[#0891B2] text-[#0891B2]'
                  : bureau.corridor_color === 'panjal'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-[#2563EB] text-[#60A5FA]';

              return (
                <div key={bureau.id} className={`border-l-2 ${borderCol} pl-3`}>
                  <span className={`text-xs uppercase font-mono font-bold block mb-1 ${borderCol}`}>
                    {bureau.name}
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    {bureau.address}<br />
                    {bureau.wire_phone}<br />
                    {bureau.tele_freq}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400">
            <div>
              <h4 className="font-bold text-white uppercase font-mono mb-1 flex items-center gap-1.5">
                <IconEmergency className="w-4 h-4 text-[#DC2626]" />
                <span>BRO &amp; Disaster Response Lines</span>
              </h4>
              <p className="leading-relaxed">
                Project Beacon (Srinagar-Baramulla-Uri): 0194-2311200<br />
                Project Sampark (Jammu-Rajouri-Poonch): 0191-2433010<br />
                Project Vijayak (Kargil-Zanskar): 01985-232201<br />
                Project Himank (Leh-Khardung La): 01982-258012
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase font-mono mb-1 flex items-center gap-1.5">
                <IconShield className="w-4 h-4 text-[#0891B2]" />
                <span>Editorial Charter &amp; Press Compliance</span>
              </h4>
              <p className="leading-relaxed">
                Regulated under the Press Council of India &amp; RNI Guidelines.<br />
                Independent Geographic &amp; Telemetric Verification Standards.<br />
                Ombudsman Contact: ombudsman@kcpjln-gazette.org
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase font-mono mb-1 flex items-center gap-1.5">
                <IconSatellite className="w-4 h-4 text-[#D97706]" />
                <span>GIS Sensor Infrastructure</span>
              </h4>
              <p className="leading-relaxed">
                Automated Weather Stations (AWS): 142 Active Nodes<br />
                DGRE Avalanche Telemetry Transponders: Operational<br />
                Border Road Infra Ground Sentinel Sync: T-04 Mins
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-mono">
            <span>© 2026 {brandFullName || brandName || 'KCPJLN'}. Broadsheet Telemetry Edition.</span>
            <div className="flex items-center space-x-3 mt-2 md:mt-0 uppercase">
              <span>Editorial Code</span>
              <span>•</span>
              <span>Telemetry Feed API</span>
              <span>•</span>
              <span>Bureaux Archive</span>
            </div>
          </div>
        </div>
      </footer>
      {hudToast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm rounded-2xl border border-cyan-500/50 bg-slate-900/95 p-4 text-white shadow-2xl shadow-cyan-950/70 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold text-sm">
            ✓
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
              {hudToast.title}
            </p>
            <p className="mt-1 text-xs text-slate-200 leading-relaxed font-sans">
              {hudToast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHudToast(null)}
            className="text-slate-400 hover:text-white text-xs font-mono p-1 rounded-md hover:bg-slate-800 transition"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
