'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  JK_DISTRICTS_DATA,
  getJKDistrictsGeoJSON,
  type JKDistrictMetadata,
} from '@/lib/map/jk-districts-data';
import {
  getJKHighwaysGeoJSON,
  JK_NATIONAL_HIGHWAYS,
  type JKHighway,
} from '@/lib/map/jk-highways-data';
import {
  getAllLiveHazards,
  getLiveHazardsGeoJSON,
  BASELINE_HAZARDS,
  type LiveHazardAlert,
} from '@/lib/map/jk-live-hazards';
import type { NavbarBrandConfig } from '@/lib/navbar';

interface JKMapOverviewProps {
  lang?: string;
  initialDistrictId?: string;
  brand?: NavbarBrandConfig;
}

// Center of Jammu, Kashmir and Ladakh: Focused on J&K while connecting seamlessly to India
const JK_CENTER: [number, number] = [75.6, 33.8];
const DEFAULT_ZOOM = 7.0;

// Sovereign Map Viewport: Encompasses all of India, letting users zoom out to see India unhighlighted
const JK_BOUNDS: [[number, number], [number, number]] = [
  [68.0, 7.5], // Southwest: Kanyakumari / Gujarat extent
  [97.5, 37.8], // Northeast: Arunachal Pradesh / Karakoram northern frontier
];

export function JKMapOverview({
  lang = 'en',
  initialDistrictId = 'doda',
  brand,
}: JKMapOverviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(initialDistrictId);
  const [mounted, setMounted] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'problems' | 'projects'>('overview');
  const [activeLayer, setActiveLayer] = useState<'all' | 'roads' | 'issues' | 'projects' | 'hazards'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time Earthquake & Weather Hazard Alerts (USGS & Open-Meteo Free APIs)
  const [liveHazards, setLiveHazards] = useState<LiveHazardAlert[]>(BASELINE_HAZARDS);
  const [selectedHazard, setSelectedHazard] = useState<LiveHazardAlert | null>(null);

  useEffect(() => {
    setMounted(true);
    let isMounted = true;
    getAllLiveHazards().then((data) => {
      if (isMounted) setLiveHazards(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Panel open/close states (Requested by user)
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileTelemetryOpen, setMobileTelemetryOpen] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState<{
    title: string;
    status: string;
    note: string;
    time: string;
    location: string;
  } | null>(null);

  const selectedDistrict: JKDistrictMetadata = useMemo(() => {
    return JK_DISTRICTS_DATA[selectedDistrictId] || JK_DISTRICTS_DATA.doda;
  }, [selectedDistrictId]);

  // Filtered districts for search
  const filteredDistricts = useMemo(() => {
    if (!searchQuery.trim()) return Object.values(JK_DISTRICTS_DATA);
    const q = searchQuery.toLowerCase().trim();
    return Object.values(JK_DISTRICTS_DATA).filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.division.toLowerCase().includes(q) ||
        d.headquarters.toLowerCase().includes(q) ||
        d.majorRoads.some((r) => r.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Initialize MapLibre GL Map with OpenFreeMap Positron (Clean Light Editorial Style)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Explicitly configure local worker to avoid cross-origin / bundler worker resolution failures
    if (typeof window !== 'undefined') {
      try {
        (maplibregl as any).config.WORKER_URL = '/maplibre-gl-worker.mjs';
      } catch (err) {
        console.warn('MapLibre worker config warning:', err);
      }
    }

    // OpenFreeMap Positron: Clean light editorial cartography strictly locked to Indian J&K and Ladakh
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: JK_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 6.2,
      maxZoom: 16,
      maxBounds: JK_BOUNDS,
      pitch: 0,
      attributionControl: false,
      localIdeographFontFamily: 'sans-serif',
      transformRequest: (url: string) => {
        if (url.includes('/fonts/')) {
          // If the font is not already a valid OpenFreeMap font (Noto Sans)
          if (!url.includes('Noto%20Sans') && !url.includes('Noto Sans')) {
            const isBold = /bold/i.test(url);
            const targetFont = isBold ? 'Noto%20Sans%20Bold' : 'Noto%20Sans%20Regular';
            return {
              url: url.replace(/\/fonts\/[^/]+\/([0-9]+-[0-9]+\.pbf)/, `/fonts/${targetFont}/$1`),
            };
          }
        }
        return { url };
      },
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    const handleWindowResize = () => {
      map.resize();
    };
    window.addEventListener('resize', handleWindowResize);

    map.on('error', (err) => {
      console.warn('MapLibre GL warning:', err);
    });

    // Fast unveil: display map within 600ms or on first render frame
    const unveilMap = () => {
      setMapLoaded(true);
      map.resize();
    };

    map.once('render', unveilMap);
    const fallbackTimer = setTimeout(unveilMap, 600);

    map.on('load', () => {
      clearTimeout(fallbackTimer);
      unveilMap();
      // 1. Sanitize basemap: Completely remove internal dispute / PoK / LoC lines and enforce English labels (Remove Urdu)
      const mapLayers = map.getStyle().layers;
      if (mapLayers) {
        mapLayers.forEach((layer) => {
          // Hide all default boundary layers (removes LoC, PoK division, disputed borders)
          if (
            layer.id.includes('boundary') ||
            layer.id.includes('admin') ||
            layer.id.includes('disputed') ||
            layer.id.includes('border')
          ) {
            try {
              map.setLayoutProperty(layer.id, 'visibility', 'none');
            } catch {
              // ignore
            }
          }

          // Enforce English/Latin script text on existing text labels (removes foreign/Urdu text labels)
          if (layer.type === 'symbol' && layer.layout && (layer.layout as any)['text-field']) {
            try {
              map.setLayoutProperty(layer.id, 'text-field', [
                'coalesce',
                ['get', 'name:en'],
                ['get', 'name_en'],
                ['get', 'name:latin'],
                ['get', 'name'],
              ]);
              const existingFont = (layer.layout as any)['text-font'];
              const isBold = Array.isArray(existingFont) ? existingFont.some((f: string) => /bold/i.test(f)) : false;
              map.setLayoutProperty(layer.id, 'text-font', [isBold ? 'Noto Sans Bold' : 'Noto Sans Regular']);
            } catch {
              // ignore
            }
          }
        });
      }

      // Explicitly ensure basemap boundary layers are invisible (NO internal PoK or LoC lines)
      ['boundary_disputed', 'boundary_2', 'boundary_3'].forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', 'none');
        }
      });

      // 2. Add J&K & Ladakh Districts Source & Fill Layers
      const geojsonData = getJKDistrictsGeoJSON();
      map.addSource('jk-districts', {
        type: 'geojson',
        data: geojsonData as any,
      });

      // Polygon Fill Layer (Clean Light Editorial Palette)
      map.addLayer({
        id: 'district-fills',
        type: 'fill',
        source: 'jk-districts',
        paint: {
          'fill-color': [
            'match',
            ['get', 'divisionKey'],
            'chenab-valley', '#0284c7', // Sky Blue for Chenab Valley
            'kashmir', '#059669',      // Emerald Green for Kashmir
            'jammu', '#d97706',        // Warm Amber for Jammu
            'pir-panjal', '#7c3aed',   // Royal Purple for Pir Panjal
            'leh', '#2563eb',          // Cobalt for Ladakh
            '#64748b',
          ],
          'fill-opacity': 0.16,
        },
      });

      // Selected District Highlight Fill
      map.addLayer({
        id: 'district-highlight-fill',
        type: 'fill',
        source: 'jk-districts',
        paint: {
          'fill-color': '#e11d48',
          'fill-opacity': 0.28,
        },
        filter: ['==', ['get', 'id'], selectedDistrictId],
      });

      // District Borders
      map.addLayer({
        id: 'district-borders',
        type: 'line',
        source: 'jk-districts',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'id'], selectedDistrictId],
            '#e11d48',
            ['match', ['get', 'divisionKey'],
              'chenab-valley', '#0369a1',
              'kashmir', '#047857',
              'jammu', '#b45309',
              'pir-panjal', '#6d28d9',
              'leh', '#1d4ed8',
              '#475569'
            ],
          ],
          'line-width': [
            'case',
            ['==', ['get', 'id'], selectedDistrictId],
            3.5,
            1.5,
          ],
        },
      });

      // 4. Add Bright National Highways Layers (NH-44, NH-244, NH-1, Mughal Rd, NH-144A)
      const highwaysData = getJKHighwaysGeoJSON();
      map.addSource('jk-highways', {
        type: 'geojson',
        data: highwaysData as any,
      });

      // Outer glow / casing for high visibility
      map.addLayer({
        id: 'highway-casing',
        type: 'line',
        source: 'jk-highways',
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.95,
        },
      });

      // Main Bright Vivid National Highway Line
      map.addLayer({
        id: 'highway-lines',
        type: 'line',
        source: 'jk-highways',
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'closed', '#dc2626', // Vivid Crimson Red if closed
            'partial', '#d97706', // Bright Amber/Orange if partial/caution
            '#0284c7', // Electric Blue for open National Highway
          ],
          'line-width': 4.5,
        },
      });

      // Highway Shields / Name Labels
      map.addLayer({
        id: 'highway-labels',
        type: 'symbol',
        source: 'jk-highways',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'ref'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-letter-spacing': 0.05,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      });

      // 5. District Labels
      map.addLayer({
        id: 'district-labels',
        type: 'symbol',
        source: 'jk-districts',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11.5,
          'text-font': ['Noto Sans Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      });

      // 6. Real-Time Earthquake, Rain & Disaster Danger Dots (USGS & Open-Meteo Free APIs)
      const hazardGeo = getLiveHazardsGeoJSON(liveHazards);
      map.addSource('hazard-alerts', {
        type: 'geojson',
        data: hazardGeo as any,
      });

      // Pulsing outer warning glow
      map.addLayer({
        id: 'hazard-glow',
        type: 'circle',
        source: 'hazard-alerts',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            6, 11,
            9, 16,
            12, 22,
          ],
          'circle-color': ['get', 'dotColor'],
          'circle-opacity': 0.4,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'dotColor'],
          'circle-stroke-opacity': 0.85,
        },
      });

      // Sharp inner warning dot
      map.addLayer({
        id: 'hazard-dots',
        type: 'circle',
        source: 'hazard-alerts',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            6, 5.5,
            9, 8,
            12, 11,
          ],
          'circle-color': ['get', 'dotColor'],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Danger Title & Magnitude Label
      map.addLayer({
        id: 'hazard-labels',
        type: 'symbol',
        source: 'hazard-alerts',
        layout: {
          'text-field': ['get', 'title'],
          'text-size': 10.5,
          'text-font': ['Noto Sans Bold'],
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#991b1b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      });

      // Danger dot click & hover handlers
      map.on('mouseenter', 'hazard-dots', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'hazard-dots', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'hazard-dots', (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const hId = f.properties?.id;
        const alert = liveHazards.find((h) => h.id === hId);
        if (alert) {
          setSelectedHazard(alert);
          setSelectedIncident(null);
          map.flyTo({ center: alert.coordinates, zoom: 9.5, speed: 1.2 });
        }
      });

      // Cursor pointer on district hover
      map.on('mouseenter', 'district-fills', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'district-fills', () => {
        map.getCanvas().style.cursor = '';
      });

      // Cursor pointer & click on highway lines
      map.on('mouseenter', 'highway-lines', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'highway-lines', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'highway-lines', (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (props) {
          setSelectedIncident({
            title: props.name || 'National Highway',
            status: props.status === 'closed' ? 'Corridor Closed' : props.status === 'partial' ? 'Traffic Advisory' : 'Corridor Open',
            note: props.advisory || props.route,
            time: 'Live Highway Telemetry',
            location: props.route || props.ref,
          });
        }
      });

      // District Click Handler
      map.on('click', 'district-fills', (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const distId = feature.properties?.id;
        if (distId) {
          handleDistrictSelect(distId);
        }
      });
    });

    mapRef.current = map;

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('resize', handleWindowResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Update live hazards GeoJSON when state refreshes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('hazard-alerts') as maplibregl.GeoJSONSource;
    if (src) {
      src.setData(getLiveHazardsGeoJSON(liveHazards) as any);
    }
  }, [liveHazards]);

  // Render animated HTML Danger Markers directly into the MapLibre canvas overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    liveHazards.forEach((h) => {
      const el = document.createElement('div');
      el.className = 'group relative cursor-pointer flex items-center justify-center';
      
      const isEq = h.type === 'earthquake';
      const isRain = h.type === 'rain' || h.type === 'flood';
      const pulseColor = isEq ? 'bg-red-500/50' : isRain ? 'bg-amber-500/50' : 'bg-purple-500/50';
      const dotColor = isEq ? 'bg-red-600' : isRain ? 'bg-amber-500' : 'bg-purple-600';
      const icon = isEq ? '⚡' : isRain ? '🌧️' : '❄️';

      el.innerHTML = `
        <span class="absolute w-8 h-8 rounded-full ${pulseColor} animate-ping pointer-events-none"></span>
        <span class="relative w-6 h-6 rounded-full ${dotColor} border-2 border-white shadow-xl flex items-center justify-center text-[11px] text-white font-bold select-none transition-transform group-hover:scale-125">
          ${icon}
        </span>
        <span class="hidden group-hover:flex items-center gap-1 absolute left-7 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-stone-900 text-white text-[10px] font-bold shadow-lg whitespace-nowrap z-40 pointer-events-none">
          <span>${icon}</span>
          <span>${h.title}</span>
        </span>
      `;

      el.onclick = (e) => {
        e.stopPropagation();
        setSelectedHazard(h);
        setSelectedIncident(null);
        map.flyTo({ center: h.coordinates, zoom: 9.5, speed: 1.2 });
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(h.coordinates)
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [mapLoaded, liveHazards]);

  // Trigger map resize when side panels are collapsed/expanded
  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLeftPanelOpen, isRightPanelOpen]);

  // Update highlight filter when selected district changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('district-highlight-fill')) {
      map.setFilter('district-highlight-fill', ['==', ['get', 'id'], selectedDistrictId]);
    }
    if (map.getLayer('district-borders')) {
      map.setPaintProperty('district-borders', 'line-color', [
        'case',
        ['==', ['get', 'id'], selectedDistrictId],
        '#e11d48',
        ['match', ['get', 'divisionKey'],
          'chenab-valley', '#0369a1',
          'kashmir', '#047857',
          'jammu', '#b45309',
          'pir-panjal', '#6d28d9',
          'leh', '#1d4ed8',
          '#475569'
        ],
      ]);
      map.setPaintProperty('district-borders', 'line-width', [
        'case',
        ['==', ['get', 'id'], selectedDistrictId],
        3.5,
        1.5,
      ]);
    }
  }, [selectedDistrictId]);

  // Adjust highway visibility/prominence when activeLayer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('highway-lines') && map.getLayer('highway-casing')) {
      if (activeLayer === 'roads') {
        map.setPaintProperty('highway-lines', 'line-width', 6);
        map.setPaintProperty('highway-casing', 'line-width', 10);
      } else {
        map.setPaintProperty('highway-lines', 'line-width', 4);
        map.setPaintProperty('highway-casing', 'line-width', 7);
      }
    }
  }, [activeLayer]);

  // Smooth cinematic flyTo when selecting a district
  const handleDistrictSelect = (districtId: string) => {
    setSelectedDistrictId(districtId);
    setIsRightPanelOpen(true);
    setMobileDrawerOpen(true);

    const dist = JK_DISTRICTS_DATA[districtId];
    const map = mapRef.current;
    if (dist && map) {
      map.flyTo({
        center: dist.center,
        zoom: districtId === 'leh' ? 7.2 : 9.0,
        pitch: 0,
        bearing: 0,
        speed: 1.2,
        curve: 1.4,
        essential: true,
      });
    }
  };

  const handleResetView = () => {
    setSelectedIncident(null);
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: JK_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 0,
        bearing: 0,
        speed: 1,
        essential: true,
      });
    }
  };

  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  return (
    <div className="relative w-full h-full bg-stone-50 text-stone-900 flex flex-col overflow-hidden font-sans select-none border-t border-stone-200">
      {/* 1. Single Unified Top Header (Replaces stacked toolbars, retains Item 1 Logo) */}
      <header className="h-13 px-2.5 sm:px-4 bg-white/95 backdrop-blur-md border-b border-stone-200 flex items-center justify-between gap-2 z-30 shrink-0 shadow-2xs">
        {/* Left: Brand Identity Item `1` (Logo + Brand Name + Map Subtitle) */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <Link
            href={`${langPrefix}/`}
            className="flex items-center gap-2 sm:gap-2.5 group transition-transform active:scale-95 shrink-0"
            title="KCPJLN Homepage"
          >
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-600 via-amber-200 to-amber-700 shadow-xs flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-stone-900 rounded-full flex items-center justify-center overflow-hidden relative">
                <Image
                  src={brand?.logo_url || '/kjin-emblem.png'}
                  alt={brand?.name || 'KCPJLN'}
                  fill
                  unoptimized
                  className="object-contain p-0.5"
                  loading="eager"
                  sizes="36px"
                />
              </div>
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-masthead text-base sm:text-lg font-black text-stone-950 tracking-tight leading-none group-hover:text-cyan-800 transition-colors">
                  {brand?.name || 'KCPJLN'}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-900 font-mono text-[9px] font-bold uppercase tracking-wider">
                  MAP
                </span>
              </div>
              <span className="text-[9px] font-mono text-stone-500 truncate hidden xs:inline">
                Jammu, Kashmir &amp; Ladakh
              </span>
            </div>
          </Link>

          {/* Quick Division > District breadcrumb on larger screens */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-stone-400 font-medium ml-2 pl-3 border-l border-stone-200">
            <span className="text-cyan-800 font-bold">{selectedDistrict.division}</span>
            <span>&gt;</span>
            <span className="text-stone-950 font-black">{selectedDistrict.name}</span>
          </div>
        </div>

        {/* Center: Layer Filters (Visible on tablet & desktop) */}
        <div className="hidden md:flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
          {[
            { id: 'all', label: 'All', icon: '🗺️' },
            { id: 'hazards', label: 'Hazards', icon: '🚨' },
            { id: 'roads', label: 'Highways', icon: '🛣️' },
            { id: 'issues', label: 'Problems', icon: '⚠️' },
            { id: 'projects', label: 'Projects', icon: '🏗️' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveLayer(mode.id as typeof activeLayer)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${
                activeLayer === mode.id
                  ? 'bg-white text-stone-950 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Right Side: Search + Telemetry/Inspector Toggles + Return to News */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Search */}
          <div className="relative w-20 xs:w-28 sm:w-36 md:w-48">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-2 py-1 bg-stone-50 border border-stone-300 rounded-lg text-[11px] sm:text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-cyan-600 focus:bg-white transition"
            />
          </div>

          {/* Telemetry Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsLeftPanelOpen((prev) => !prev);
              setMobileTelemetryOpen((prev) => !prev);
              setMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              isLeftPanelOpen || mobileTelemetryOpen
                ? 'bg-stone-100 text-stone-900 border-stone-300 font-bold'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
            title="Toggle Live Telemetry & Hazards"
          >
            <span>📊</span>
            <span className="hidden xl:inline">Telemetry</span>
          </button>

          {/* District Inspector Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsRightPanelOpen((prev) => !prev);
              setMobileDrawerOpen((prev) => !prev);
              setMobileTelemetryOpen(false);
            }}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              isRightPanelOpen || mobileDrawerOpen
                ? 'bg-cyan-50 text-cyan-900 border-cyan-300 font-bold'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
            title="Toggle District Inspector"
          >
            <span>📍</span>
            <span className="hidden xl:inline">{selectedDistrict.name}</span>
          </button>

          {/* Reset Map View */}
          <button
            type="button"
            onClick={handleResetView}
            className="p-1 sm:px-2 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 hover:text-stone-950 text-xs font-semibold transition"
            title="Reset Map View"
          >
            <span>🔄</span>
          </button>

          {/* Direct link back to News */}
          <Link
            href={`${langPrefix}/`}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition"
          >
            <span>📰</span>
            <span>News</span>
          </Link>
        </div>
      </header>

      {/* 2. Main Workspace: Collapsible Left Panel + Map Canvas + Collapsible Right Inspector */}
      <div className="relative flex-1 flex overflow-hidden min-h-0">
        {/* Mobile Backdrop for Drawers (z-40, rendered behind z-50 drawers, NO BLUR) */}
        {(mobileTelemetryOpen || mobileDrawerOpen) && (
          <div
            onClick={() => {
              setMobileTelemetryOpen(false);
              setMobileDrawerOpen(false);
            }}
            className="lg:hidden fixed inset-0 bg-stone-950/40 z-40 transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* LEFT PANEL: Telemetry, Filters & Live Incidents (Desktop Sidebar + Mobile Drawer) */}
        <aside
          className={`
            ${mobileTelemetryOpen ? 'fixed inset-y-0 left-0 z-50 w-[88vw] max-w-sm sm:w-80 shadow-2xl flex' : 'hidden'}
            ${isLeftPanelOpen ? 'xl:flex xl:relative xl:inset-auto xl:z-10 xl:w-72 2xl:w-80 shadow-xs' : 'xl:hidden'}
            flex-col border-r border-stone-200 bg-white p-3.5 shrink-0 overflow-y-auto space-y-3.5 transition-all
          `}
        >
          {/* Header with Close Button `✕` */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                <span>🇮🇳</span>
                <span>Republic of India</span>
              </p>
              <h2 className="text-sm font-bold text-stone-900">Jammu, Kashmir &amp; Ladakh</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLeftPanelOpen(false);
                setMobileTelemetryOpen(false);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-100 text-stone-600 hover:text-stone-950 hover:bg-stone-200 text-xs font-bold transition border border-stone-200"
              title="Close Telemetry Panel"
            >
              ✕
            </button>
          </div>

            {/* Active Layers Filter */}
            <div className="space-y-1 bg-stone-50 p-2.5 rounded-xl border border-stone-200/90">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Data Layers
              </p>
              {[
                { id: 'all', label: 'All News & Reports', count: 124, dot: 'bg-blue-600' },
                { id: 'hazards', label: 'Earthquake & Rain Danger', count: liveHazards.length, dot: 'bg-rose-600 animate-pulse' },
                { id: 'issues', label: 'Civic Problems', count: 42, dot: 'bg-rose-500' },
                { id: 'projects', label: 'Development Projects', count: 27, dot: 'bg-amber-600' },
                { id: 'roads', label: 'Road & Pass Alerts', count: 5, dot: 'bg-purple-600' },
              ].map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setActiveLayer(layer.id as typeof activeLayer)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition ${
                    activeLayer === layer.id
                      ? 'bg-white text-stone-950 font-bold shadow-2xs border border-stone-200'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${layer.dot}`} />
                    <span>{layer.label}</span>
                  </div>
                  <span className="font-mono text-[11px] text-stone-500 font-bold">{layer.count}</span>
                </button>
              ))}
            </div>

            {/* Real-time Earthquake & Weather Hazard Danger Alerts (USGS & Open-Meteo) */}
            <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  <span>Live Hazards &amp; Warnings</span>
                </p>
                <span className="text-[9px] font-mono text-rose-700 font-bold bg-white px-1.5 py-0.2 rounded border border-rose-200">
                  USGS • Met
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {liveHazards.slice(0, 3).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setSelectedHazard(h);
                      setSelectedIncident(null);
                      const map = mapRef.current;
                      if (map) {
                        map.flyTo({ center: h.coordinates, zoom: 9.5, speed: 1.2 });
                      }
                    }}
                    className="w-full p-2 rounded-lg bg-white border border-rose-200 hover:border-rose-400 cursor-pointer shadow-2xs text-left transition"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-rose-900">
                      <span className="flex items-center gap-1">
                        <span>{h.type === 'earthquake' ? '⚡' : h.type === 'rain' ? '🌧️' : '❄️'}</span>
                        <span className="truncate">{h.title}</span>
                      </span>
                      <span className="text-[9px] text-stone-400 font-mono shrink-0">{h.timeAgo}</span>
                    </div>
                    <p className="text-stone-600 text-[11px] mt-0.5 leading-tight line-clamp-2">
                      {h.message}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[9px] text-rose-700 font-mono">
                      <span>📍 {h.location}</span>
                      <span className="font-bold underline">Advisory ▶</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* National Highway Corridors (Bright Vivid Highway Corridors) */}
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1">
                  <span>🛣️</span>
                  <span>National Highways</span>
                </p>
                <span className="text-[9px] font-mono text-cyan-800 font-bold bg-cyan-100 px-1.5 py-0.2 rounded">Corridors</span>
              </div>
              <div className="space-y-1 text-xs">
                {JK_NATIONAL_HIGHWAYS.slice(0, 4).map((hw) => (
                  <button
                    key={hw.id}
                    type="button"
                    onClick={() => {
                      setActiveLayer('roads');
                      setSelectedIncident({
                        title: hw.name,
                        status: hw.status === 'closed' ? 'Corridor Closed' : hw.status === 'partial' ? 'Traffic Advisory' : 'Corridor Open',
                        note: hw.advisory,
                        time: 'Real-time Telemetry',
                        location: hw.route,
                      });
                      const map = mapRef.current;
                      if (map && hw.coordinates.length > 0) {
                        const mid = hw.coordinates[Math.floor(hw.coordinates.length / 2)];
                        map.flyTo({ center: mid, zoom: 8.5, speed: 1.2 });
                      }
                    }}
                    className="w-full flex items-center justify-between p-1.5 rounded-lg bg-white border border-stone-200 hover:border-cyan-400 hover:bg-cyan-50/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        hw.status === 'closed' ? 'bg-rose-600' : hw.status === 'partial' ? 'bg-amber-500' : 'bg-blue-600'
                      }`} />
                      <span className="font-bold text-stone-900 text-[11px] truncate">{hw.ref}</span>
                    </div>
                    <span className="text-[9px] font-mono text-stone-500 shrink-0 font-medium">{hw.lengthKm} km</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Road Status Legend */}
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/90 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Road Condition Legend
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-stone-700">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded-full bg-blue-600" />
                  <span>Highway Open</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded-full bg-amber-500" />
                  <span>Caution / Pass</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded-full bg-rose-600" />
                  <span>Closed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded-full bg-purple-600" />
                  <span>Landslide</span>
                </div>
              </div>
            </div>

            {/* Live Incidents Ticker */}
            <div className="flex-1 bg-stone-50 p-2.5 rounded-xl border border-stone-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  <span>Live Ground Incidents</span>
                </p>
                <span className="text-[9px] font-mono text-rose-700 font-bold bg-rose-100 px-1.5 py-0.2 rounded">Real-time</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div
                  onClick={() => {
                    handleDistrictSelect('doda');
                    setSelectedIncident({
                      title: 'Doda–Bhadarwah Road Closed',
                      status: 'Road Closed',
                      note: 'Landslide blocked corridor near Jakyas. Recovery machines on site.',
                      time: '10:24 AM',
                      location: 'Jakyas Corridor, Doda',
                    });
                  }}
                  className="p-2 rounded-lg bg-white border border-rose-200 hover:border-rose-400 cursor-pointer shadow-2xs transition"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-700">
                    <span>⚠️ Doda–Bhadarwah RD</span>
                    <span className="text-[9px] text-stone-400">10m ago</span>
                  </div>
                  <p className="text-stone-700 text-[11px] mt-0.5 leading-tight">
                    Landslide blocked near Jakyas. Diversion via Pul Doda.
                  </p>
                </div>

                <div
                  onClick={() => {
                    handleDistrictSelect('ramban');
                    setSelectedIncident({
                      title: 'NH-44 Shooting Stones',
                      status: 'Traffic Slowed',
                      note: 'Intermittent shooting stones at Mehar-Cafeteria Morh. Convoys moving slowly.',
                      time: '30m ago',
                      location: 'Mehar-Cafeteria Stretch, Ramban',
                    });
                  }}
                  className="p-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 cursor-pointer shadow-2xs transition"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700">
                    <span>🚧 Ramban NH-44</span>
                    <span className="text-[9px] text-stone-400">30m ago</span>
                  </div>
                  <p className="text-stone-700 text-[11px] mt-0.5 leading-tight">
                    Shooting stones at Mehar. Traffic moving under supervision.
                  </p>
                </div>

                <div
                  onClick={() => {
                    handleDistrictSelect('kishtwar');
                    setSelectedIncident({
                      title: 'Sinthan Top Frost Alert',
                      status: 'Advisory Active',
                      note: 'High altitude pass slippery due to sub-zero night freeze. Commercial 4x4 only.',
                      time: '1h ago',
                      location: 'Sinthan Top Summit (3,748m)',
                    });
                  }}
                  className="p-2 rounded-lg bg-white border border-sky-200 hover:border-sky-400 cursor-pointer shadow-2xs transition"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-sky-700">
                    <span>❄️ Sinthan Top (3,748m)</span>
                    <span className="text-[9px] text-stone-400">1h ago</span>
                  </div>
                  <p className="text-stone-700 text-[11px] mt-0.5 leading-tight">
                    Sub-zero morning frost. Commercial 4x4 permitted only.
                  </p>
                </div>
              </div>
            </div>
          </aside>

        {/* CENTER: Real WebGL MapLibre Canvas with Clean Light Positron Tiles */}
        <main className="relative flex-1 min-h-0 bg-stone-100 flex flex-col justify-between overflow-hidden">
          {/* Top Floating Controls */}
          <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
            {/* Left Toggle Button if Left Panel is collapsed */}
            <div>
              {!isLeftPanelOpen && (
                <button
                  type="button"
                  onClick={() => setIsLeftPanelOpen(true)}
                  className="pointer-events-auto px-3 py-1.5 rounded-lg bg-white/95 hover:bg-stone-50 border border-stone-300 text-stone-800 text-xs font-semibold shadow-xs backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
                  title="Expand Telemetry & Incidents Panel"
                >
                  <span>📊</span>
                  <span className="hidden sm:inline">Telemetry &amp; Reports</span>
                  <span className="text-[10px] text-stone-500 font-bold">▶</span>
                </button>
              )}
            </div>

            {/* Right Controls: Reset Map and Inspector Toggle if closed */}
            <div className="flex items-center gap-2 mr-12 pointer-events-auto">
              {!isRightPanelOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRightPanelOpen(true);
                    setMobileDrawerOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/95 hover:bg-stone-50 border border-stone-300 text-stone-800 text-xs font-semibold shadow-xs backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
                  title="Open District Inspector"
                >
                  <span>📍</span>
                  <span>{selectedDistrict.name}</span>
                  <span className="text-[10px] text-stone-500 font-bold">◀</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetView}
                className="px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-stone-50 border border-stone-300 text-stone-800 text-xs font-semibold shadow-xs backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
                title="Reset View to Full Jammu & Kashmir"
              >
                <span>🔄</span>
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* WebGL Map Container */}
          <div className="relative flex-1 min-h-0 w-full overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Loading Indicator while Vector Tiles and Cartography load */}
            {(!mounted || !mapLoaded) && (
              <div className="absolute inset-0 bg-stone-50/95 backdrop-blur-xs flex flex-col items-center justify-center z-10 pointer-events-none transition-opacity duration-300">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-stone-300 border-t-blue-600 rounded-full animate-spin" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">
                    Loading Sovereign Cartography &amp; National Highways...
                  </span>
                </div>
              </div>
            )}

            {/* Real-time Earthquake / Rain Danger Message Modal Card */}
            {selectedHazard && (
              <div className="absolute inset-x-3 bottom-18 sm:inset-x-auto sm:right-6 sm:bottom-22 w-auto sm:w-96 max-h-[75vh] overflow-y-auto rounded-2xl bg-white border-2 border-rose-500 p-3.5 sm:p-4 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-2 border-b border-rose-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 text-[10px] font-black uppercase tracking-wider">
                      {selectedHazard.categoryLabel}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      🕒 {selectedHazard.timeAgo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHazard(null)}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 text-xs font-bold transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                      <span>{selectedHazard.type === 'earthquake' ? '⚡' : selectedHazard.type === 'rain' ? '🌧️' : '❄️'}</span>
                      <span>{selectedHazard.title}</span>
                    </h3>
                    <span className="px-1.5 py-0.2 rounded bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-800 uppercase font-mono">
                      {selectedHazard.severity}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                    📍 {selectedHazard.location}
                  </p>

                  {/* Specific Telemetry Badges */}
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
                    {selectedHazard.magnitude && (
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200">
                        Magnitude: M {selectedHazard.magnitude}
                      </span>
                    )}
                    {selectedHazard.depthKm && (
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                        Depth: {selectedHazard.depthKm} km
                      </span>
                    )}
                    {selectedHazard.precipitationMm && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                        Rain: {selectedHazard.precipitationMm} mm/h
                      </span>
                    )}
                  </div>

                  {/* Safety Message */}
                  <div className="mt-2.5 bg-rose-50/70 p-2.5 rounded-xl border border-rose-200/80">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-900 mb-1 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>Danger &amp; Impact Advisory:</span>
                    </p>
                    <p className="text-xs text-stone-800 leading-relaxed font-sans">
                      {selectedHazard.message}
                    </p>
                  </div>

                  {/* Safety Instructions */}
                  {selectedHazard.safetyInstructions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        Actionable Protocol:
                      </p>
                      <ul className="text-[11px] text-stone-700 space-y-0.5 list-disc list-inside">
                        {selectedHazard.safetyInstructions.map((ins, i) => (
                          <li key={i} className="leading-tight">{ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-400">
                    <span className="font-mono">Source: {selectedHazard.source}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedHazard(null)}
                      className="px-3 py-1 rounded-lg bg-stone-900 text-white font-bold hover:bg-stone-800 transition"
                    >
                      Acknowledge &amp; Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Incident Popover */}
            {selectedIncident && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:bottom-24 w-76 sm:w-84 max-w-[92vw] rounded-xl bg-white border border-rose-300 p-3 shadow-xl z-20 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                      {selectedIncident.status}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      🕒 {selectedIncident.time}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="text-stone-400 hover:text-stone-800 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <h4 className="mt-1.5 text-xs font-bold text-stone-900">{selectedIncident.title}</h4>
                <p className="mt-0.5 text-[11px] text-stone-600 leading-snug">{selectedIncident.note}</p>
                <p className="mt-1 text-[10px] text-stone-400 font-mono">📍 {selectedIncident.location}</p>

                <div className="mt-2.5 flex items-center gap-2">
                  <Link
                    href={`${langPrefix}/district/${selectedDistrictId}`}
                    className="flex-1 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs text-center transition"
                  >
                    View Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition border border-stone-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom District Quick-Access Carousel Dock (Clean Light Theme) */}
          <div className="h-16 sm:h-20 bg-white/95 backdrop-blur-md border-t border-stone-200 px-3 sm:px-4 flex items-center z-20 shrink-0 shadow-xs">
            <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-1 touch-pan-x overscroll-x-contain">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold shrink-0 hidden md:block">
                Districts:
              </span>
              {filteredDistricts.map((d) => {
                const isSelected = selectedDistrictId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleDistrictSelect(d.id)}
                    className={`group flex items-center gap-2 p-1 pr-2.5 rounded-xl border transition-all shrink-0 ${
                      isSelected
                        ? 'bg-stone-100 border-rose-500 shadow-xs'
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden shrink-0 border border-stone-200">
                      <Image
                        src={d.image}
                        alt={d.name}
                        fill
                        unoptimized
                        loading="lazy"
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="36px"
                      />
                    </div>
                    <div className="text-left min-w-0">
                      <span className={`text-xs font-bold truncate block ${isSelected ? 'text-rose-700' : 'text-stone-800'}`}>
                        {d.name}
                      </span>
                      <span className="text-[9px] text-stone-500 font-mono block">
                        {d.stats.newsCount + d.stats.problemsCount} updates
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        {/* RIGHT PANEL: District Intelligence Inspector */}
        <aside
          className={`
            ${mobileDrawerOpen ? 'fixed inset-y-0 right-0 z-50 w-[88vw] max-w-sm sm:w-92 shadow-2xl flex' : 'hidden'}
            ${isRightPanelOpen ? 'lg:flex lg:relative lg:inset-auto lg:z-10 lg:w-92 xl:w-96 shadow-md' : 'lg:hidden'}
            flex-col bg-white border-l border-stone-200 shrink-0 overflow-y-auto transition-all
          `}
        >
          {/* Header with Title and Close Button `✕` */}
          <div className="p-2.5 px-3.5 flex items-center justify-between border-b border-stone-200 bg-stone-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-600" />
              <span className="text-xs font-bold text-stone-900 tracking-tight">District Intelligence</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRightPanelOpen(false);
                setMobileDrawerOpen(false);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-200 text-stone-700 hover:text-stone-950 hover:bg-stone-300 text-xs font-bold transition"
              title="Close District Inspector"
            >
              ✕
            </button>
          </div>

            {/* Scenic District Header Photo */}
            <div className="relative w-full h-36 sm:h-44 shrink-0">
              <Image
                src={selectedDistrict.image}
                alt={selectedDistrict.name}
                fill
                unoptimized
                className="object-cover"
                loading="lazy"
                sizes="384px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />

              {/* Division Badge & Elevation */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-white/90 backdrop-blur-md border border-stone-200 text-[10px] font-bold text-stone-800 shadow-xs">
                  {selectedDistrict.division}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/90 backdrop-blur-md border border-stone-200 text-[10px] font-mono text-stone-700 shadow-xs">
                  📍 {selectedDistrict.elevation}
                </span>
              </div>

              {/* Title */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                <h3 className="text-xl font-black tracking-tight leading-none drop-shadow">
                  {selectedDistrict.name} District
                </h3>
                <p className="text-[11px] text-stone-200 font-medium mt-0.5 drop-shadow">
                  HQ: {selectedDistrict.headquarters} &bull; {selectedDistrict.division}
                </p>
              </div>
            </div>

            {/* Inspector Body Content */}
            <div className="p-3.5 space-y-3 flex-1 bg-white">
              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-bold">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'news', label: `News (${selectedDistrict.stats.newsCount})` },
                  { id: 'problems', label: `Problems (${selectedDistrict.stats.problemsCount})` },
                  { id: 'projects', label: `Projects (${selectedDistrict.stats.projectsCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-1 py-1 rounded-md text-center transition ${
                      activeTab === tab.id
                        ? 'bg-white text-stone-900 font-bold shadow-2xs border border-stone-200'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-3">
                  {/* KPI Cards (Clean Light Palette) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                      <div className="flex items-center justify-between text-rose-800 text-xs font-bold">
                        <span>Key Problems</span>
                        <span>⚠️</span>
                      </div>
                      <p className="mt-1 text-xl font-black text-rose-950">
                        {selectedDistrict.stats.problemsCount}
                      </p>
                      <span className="text-[10px] text-rose-700 font-medium">Verified issues</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                        <span>Ongoing Projects</span>
                        <span>✅</span>
                      </div>
                      <p className="mt-1 text-xl font-black text-emerald-950">
                        {selectedDistrict.stats.projectsCount}
                      </p>
                      <span className="text-[10px] text-emerald-700 font-medium">Active works</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                      <div className="flex items-center justify-between text-sky-800 text-xs font-bold">
                        <span>Latest Stories</span>
                        <span>📰</span>
                      </div>
                      <p className="mt-1 text-xl font-black text-sky-950">
                        {selectedDistrict.stats.newsCount}
                      </p>
                      <span className="text-[10px] text-sky-700 font-medium">Articles</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                      <div className="flex items-center justify-between text-purple-800 text-xs font-bold">
                        <span>Trending</span>
                        <span>📈</span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-purple-950 truncate">
                        {selectedDistrict.trendingTopics[0] || 'Local'}
                      </p>
                      <span className="text-[10px] text-purple-700 font-medium">Top topic</span>
                    </div>
                  </div>

                  {/* Weather Widget */}
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-stone-500 font-semibold">Weather &bull; {selectedDistrict.name}</span>
                      <p className="text-lg font-black text-stone-900 mt-0.5">
                        {selectedDistrict.weather.temp}°C
                      </p>
                      <p className="text-stone-600">{selectedDistrict.weather.condition}</p>
                    </div>
                    <div className="text-right font-mono text-stone-500 text-[11px]">
                      <p>H: {selectedDistrict.weather.high}°C</p>
                      <p>L: {selectedDistrict.weather.low}°C</p>
                    </div>
                  </div>

                  {/* Top Issues */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                      <span>Top Verified Issues</span>
                      <span className="text-[10px] font-mono text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Ground Tracker</span>
                    </div>

                    {selectedDistrict.topIssues.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedDistrict.topIssues.map((issue) => (
                          <div
                            key={issue.id}
                            className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 hover:border-stone-300 transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  issue.severity === 'high'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                              >
                                {issue.category}
                              </span>
                              <span className="text-[9px] text-stone-400 font-mono">{issue.updatedAgo}</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-stone-900 leading-snug">
                              {issue.title}
                            </p>
                            <p className="mt-0.5 text-[10px] text-stone-500">📍 {issue.location}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-center text-xs text-stone-500">
                        No critical issues reported in this district today.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: NEWS */}
              {activeTab === 'news' && (
                <div className="space-y-2 text-xs">
                  <p className="text-stone-500 text-[11px]">
                    Published reporting and ground updates from {selectedDistrict.name}.
                  </p>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
                    <span className="text-[9px] font-mono text-cyan-800 font-bold">CHENAB CORRIDOR</span>
                    <h5 className="font-bold text-stone-900 hover:text-cyan-800 cursor-pointer">
                      Changthang &amp; Chenab Winter Stocking: Essential Rations Dispatched
                    </h5>
                    <p className="text-[11px] text-stone-600">District administration completes advance distribution.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
                    <span className="text-[9px] font-mono text-cyan-800 font-bold">INFRASTRUCTURE</span>
                    <h5 className="font-bold text-stone-900 hover:text-cyan-800 cursor-pointer">
                      Sudh Mahadev - Khellani Tunnel 68% Complete
                    </h5>
                    <p className="text-[11px] text-stone-600">All-weather bypass between Chenab Valley and Jammu advances.</p>
                  </div>
                </div>
              )}

              {/* TAB 3: PROBLEMS */}
              {activeTab === 'problems' && (
                <div className="space-y-2 text-xs">
                  <p className="text-stone-500 text-[11px]">
                    Verified ground problems tracked by KJIN desk in {selectedDistrict.name}.
                  </p>
                  {selectedDistrict.topIssues.map((issue) => (
                    <div key={issue.id} className="p-2.5 rounded-lg bg-white border border-rose-200 shadow-2xs">
                      <div className="flex items-center justify-between font-bold text-rose-800">
                        <span>{issue.category.toUpperCase()}</span>
                        <span className="text-[9px] font-mono bg-rose-50 px-1 rounded">{issue.status}</span>
                      </div>
                      <p className="mt-1 font-semibold text-stone-900">{issue.title}</p>
                      <p className="mt-0.5 text-[10px] text-stone-500 font-mono">📍 {issue.location}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: PROJECTS */}
              {activeTab === 'projects' && (
                <div className="space-y-2 text-xs">
                  <p className="text-stone-500 text-[11px]">
                    Development and infrastructure works tracked in {selectedDistrict.name}.
                  </p>
                  {selectedDistrict.projects.map((proj) => (
                    <div key={proj.id} className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-stone-900">
                        <span>{proj.title}</span>
                        <span className="text-cyan-800 font-mono">{proj.budget}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-600">
                        <span>Agency: {proj.agency}</span>
                        <span className="font-mono text-emerald-700 font-bold">{proj.completion}%</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-cyan-700 rounded-full"
                          style={{ width: `${proj.completion}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Direct Reporting Link */}
              <div className="pt-2">
                <Link
                  href={`${langPrefix}/district/${selectedDistrict.id}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs transition-all group"
                >
                  <span>View Full {selectedDistrict.name} District Reporting</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </Link>
              </div>
            </div>
          </aside>
      </div>
    </div>
  );
}
