'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_TELEMETRY_SETTINGS,
  type TelemetrySettings,
  type MountainPassItem,
  type MandiCommodityItem,
  type CorridorGlanceItem,
  type ConvoySlotItem,
  type FieldSensorItem,
} from '@/lib/telemetry';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

export default function TelemetrySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [activeTab, setActiveTab] = useState<'passes' | 'convoy' | 'sensors' | 'mandi' | 'corridors' | 'voices' | 'civic'>('passes');
  const [telemetry, setTelemetry] = useState<TelemetrySettings>(DEFAULT_TELEMETRY_SETTINGS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [recentArticles, setRecentArticles] = useState<Array<{ id: string; title: string; category: string }>>([]);

  useEffect(() => {
    // Check URL search params for tab jump (e.g. ?tab=corridors)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['passes', 'convoy', 'sensors', 'mandi', 'corridors', 'voices', 'civic'].includes(tabParam)) {
        setActiveTab(tabParam as 'passes' | 'convoy' | 'sensors' | 'mandi' | 'corridors' | 'voices' | 'civic');
      }
    }

    async function loadConfig() {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role_key, status')
          .eq('id', sessionData.session.user.id)
          .single();

        const role = profile?.role_key || '';
        const allowed = ['owner', 'superadmin', 'admin', 'editor'].includes(role);
        setCanManage(allowed);

        const res = await fetch('/api/settings/telemetry');
        if (res.ok) {
          const json = await res.json();
          if (json.telemetry) {
            setTelemetry(json.telemetry);
          }
        }

        // Fetch recent published articles for quick selection
        const { data: arts } = await supabase
          .from('articles')
          .select('id, title, category')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(6);
        if (arts) setRecentArticles(arts);
      } catch (err: unknown) {
        console.error('Failed to load telemetry settings:', err);
        setErrorMsg('Failed to load telemetry data. Using default baseline values.');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [router]);

  const handleGenerateAI = async () => {
    try {
      setIsGeneratingAI(true);
      const res = await fetch('/api/settings/telemetry/ai-generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI bulletin');

      setTelemetry(prev => ({
        ...prev,
        live_wire: {
          ...prev.live_wire,
          headline: data.headline,
          badge: data.badge || 'DEVELOPING',
          synced_time: data.synced_time,
          article_id: data.article_id || null,
          mode: 'manual', // AI generated is set as manual curated until toggled
          is_active: true,
        },
      }));
      toast.success('AI Developing Wire synthesized with Gemini!', { title: 'AI Wire Ready' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      toast.error(msg);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSetCurrentTime = () => {
    try {
      const now = new Date();
      const istString = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setTelemetry(prev => ({
        ...prev,
        live_wire: { ...prev.live_wire, synced_time: `${istString} IST` }
      }));
      toast.info(`Time updated to ${istString} IST`);
    } catch {
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} IST`;
      setTelemetry(prev => ({
        ...prev,
        live_wire: { ...prev.live_wire, synced_time: t }
      }));
    }
  };

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await fetch('/api/settings/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetry),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save telemetry settings');
      }

      setSuccessMsg('Regional telemetry, mountain passes & mandi data successfully updated!');
      toast.success('Telemetry updated successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while saving';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Quick Pass Status Switcher
  const updatePassStatus = (passId: string, newStatus: 'open' | 'caution' | 'closed', defaultLabel: string) => {
    setTelemetry(prev => ({
      ...prev,
      mountain_passes: prev.mountain_passes.map(p =>
        p.id === passId ? { ...p, status: newStatus, status_label: defaultLabel } : p
      ),
    }));
  };

  const updatePassField = <K extends keyof MountainPassItem>(passId: string, field: K, value: MountainPassItem[K]) => {
    setTelemetry(prev => ({
      ...prev,
      mountain_passes: prev.mountain_passes.map(p =>
        p.id === passId ? { ...p, [field]: value } : p
      ),
    }));
  };

  const updateMandiCommodity = <K extends keyof MandiCommodityItem>(id: string, field: K, value: MandiCommodityItem[K]) => {
    setTelemetry(prev => ({
      ...prev,
      mandi_commodities: prev.mandi_commodities.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addCommodity = () => {
    const newId = `commodity-${Date.now()}`;
    const newItem: MandiCommodityItem = {
      id: newId,
      market_name: 'New Regional Mandi',
      corridor: 'kashmir',
      commodity_name: 'Grade-A Produce',
      price: '₹1,000',
      unit: '/ quintal',
      change_pct: '+0.0%',
      trend: 'steady',
      stat_left: 'Daily Arrival: 50 MT',
      stat_right: 'Standard Demand',
    };
    setTelemetry(prev => ({
      ...prev,
      mandi_commodities: [...prev.mandi_commodities, newItem],
    }));
  };

  const removeCommodity = (id: string) => {
    setTelemetry(prev => ({
      ...prev,
      mandi_commodities: prev.mandi_commodities.filter(item => item.id !== id),
    }));
  };

  const updateCorridorGlance = <K extends keyof CorridorGlanceItem>(id: string, field: K, value: CorridorGlanceItem[K]) => {
    setTelemetry(prev => ({
      ...prev,
      corridors_at_a_glance: prev.corridors_at_a_glance.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const updateConvoySlot = <K extends keyof ConvoySlotItem>(id: string, field: K, value: ConvoySlotItem[K]) => {
    setTelemetry(prev => ({
      ...prev,
      convoy_slots: (prev.convoy_slots || []).map(slot =>
        slot.id === id ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const updateFieldSensor = <K extends keyof FieldSensorItem>(id: string, field: K, value: FieldSensorItem[K]) => {
    setTelemetry(prev => ({
      ...prev,
      field_sensors: (prev.field_sensors || []).map(sensor =>
        sensor.id === id ? { ...sensor, [field]: value } : sensor
      ),
    }));
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading regional telemetry engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
              Broadsheet Engine
            </span>
            <span className="text-xs text-slate-500">• 5 Regional Corridors</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Regional Telemetry &amp; Pass Transit Desk
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Control real-time road pass conditions, mountain weather advisories, mandi commodity spot rates, and emergency broadcast alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/transit"
            target="_blank"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition"
          >
            <span>Live Pass Topography View</span>
            <span>↗</span>
          </Link>
          {canManage && (
            <Button
              onClick={() => handleSave()}
              disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-sm"
            >
              {saving ? 'Syncing...' : 'Publish Telemetry'}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('passes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'passes'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>🏔️</span>
          <span>Mountain Passes ({telemetry.mountain_passes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('convoy')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'convoy'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>⏱️</span>
          <span>Convoy Timetable ({telemetry.convoy_slots?.length || 5})</span>
        </button>

        <button
          onClick={() => setActiveTab('sensors')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'sensors'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>📡</span>
          <span>Field Sensors ({telemetry.field_sensors?.length || 3})</span>
        </button>

        <button
          onClick={() => setActiveTab('mandi')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'mandi'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>📈</span>
          <span>Mandi Spot Telemetry ({telemetry.mandi_commodities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('corridors')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'corridors'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>⚡</span>
          <span>Live Wire &amp; 5 Corridors</span>
        </button>

        <button
          onClick={() => setActiveTab('voices')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'voices'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>🎙️</span>
          <span>Voices of the Corridors</span>
        </button>

        <button
          onClick={() => setActiveTab('civic')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'civic'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span>🏛️</span>
          <span>Civic &amp; Sponsored Mission</span>
        </button>
      </div>

      {/* TAB 1: MOUNTAIN PASSES */}
      {activeTab === 'passes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Strategic Himalayan Mountain Passes
            </h2>
            <span className="text-xs text-slate-500">Live arterial feeds for public broadsheet &amp; mobile offline cache</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {telemetry.mountain_passes.map((pass) => (
              <div
                key={pass.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-4"
              >
                {/* Header & Status selector */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block">
                      {pass.corridor}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {pass.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => updatePassStatus(pass.id, 'open', 'OPEN 2-WAY')}
                      className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg transition ${
                        pass.status === 'open'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePassStatus(pass.id, 'caution', 'CHAINS REQ.')}
                      className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg transition ${
                        pass.status === 'caution'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Caution
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePassStatus(pass.id, 'closed', 'CLOSED')}
                      className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg transition ${
                        pass.status === 'closed'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {/* Status Badge & Elevation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Status Badge Text</label>
                    <input
                      type="text"
                      value={pass.status_label}
                      onChange={(e) => updatePassField(pass.id, 'status_label', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Pass Elevation</label>
                    <input
                      type="text"
                      value={pass.elevation}
                      onChange={(e) => updatePassField(pass.id, 'elevation', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Advisory Notice */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Critical Advisory Headline</label>
                    <input
                      type="text"
                      value={pass.advisory_title}
                      onChange={(e) => updatePassField(pass.id, 'advisory_title', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Advisory Description</label>
                    <textarea
                      rows={2}
                      value={pass.advisory_desc}
                      onChange={(e) => updatePassField(pass.id, 'advisory_desc', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Telemetry Stats Quad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Surface Temp</label>
                    <input
                      type="text"
                      value={pass.road_surface_temp}
                      onChange={(e) => updatePassField(pass.id, 'road_surface_temp', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Snow Depth</label>
                    <input
                      type="text"
                      value={pass.snow_depth}
                      onChange={(e) => updatePassField(pass.id, 'snow_depth', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Avalanche Hazard</label>
                    <input
                      type="text"
                      value={pass.avalanche_hazard}
                      onChange={(e) => updatePassField(pass.id, 'avalanche_hazard', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Clearance Agency</label>
                    <input
                      type="text"
                      value={pass.clearance_agency}
                      onChange={(e) => updatePassField(pass.id, 'clearance_agency', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Projected Opening / Convoy Slot */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Convoy Slot / Projected Opening</label>
                  <input
                    type="text"
                    value={pass.projected_opening_or_slot}
                    onChange={(e) => updatePassField(pass.id, 'projected_opening_or_slot', e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Emergency Hotlines Directory */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Emergency Transit Control Room Hotlines
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {telemetry.emergency_hotlines.map((hotline, idx) => (
                <div key={hotline.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2">
                  <input
                    type="text"
                    value={hotline.title}
                    onChange={(e) => {
                      const updated = [...telemetry.emergency_hotlines];
                      updated[idx].title = e.target.value;
                      setTelemetry(prev => ({ ...prev, emergency_hotlines: updated }));
                    }}
                    className="w-full px-2 py-1 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={hotline.phone}
                    onChange={(e) => {
                      const updated = [...telemetry.emergency_hotlines];
                      updated[idx].phone = e.target.value;
                      setTelemetry(prev => ({ ...prev, emergency_hotlines: updated }));
                    }}
                    className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CONVOY TIMETABLE */}
      {activeTab === 'convoy' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Strategic Inter-Valley Convoy Slot Matrix
              </h2>
              <span className="text-xs text-slate-500">Live operational timetable broadcasted on the Transit Command page</span>
            </div>
          </div>

          <div className="space-y-4">
            {(telemetry.convoy_slots || []).map((slot) => (
              <div
                key={slot.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={slot.corridor_code}
                      onChange={(e) => updateConvoySlot(slot.id, 'corridor_code', e.target.value)}
                      className="w-20 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400"
                    />
                    <input
                      type="text"
                      value={slot.corridor_name}
                      onChange={(e) => updateConvoySlot(slot.id, 'corridor_name', e.target.value)}
                      className="px-3 py-1 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={slot.clearance_status}
                      onChange={(e) => updateConvoySlot(slot.id, 'clearance_status', e.target.value as ConvoySlotItem['clearance_status'])}
                      className="px-3 py-1.5 text-xs font-bold uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="verified">Verified Pass</option>
                      <option value="regulated">Regulated Convoy</option>
                      <option value="clear">Clear Green</option>
                      <option value="chains">Chains Required</option>
                      <option value="blocked">Red Blocked</option>
                    </select>

                    <input
                      type="text"
                      value={slot.clearance_label}
                      onChange={(e) => updateConvoySlot(slot.id, 'clearance_label', e.target.value)}
                      className="w-36 px-2.5 py-1.5 text-xs font-mono font-bold uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Directional Flow</label>
                    <input
                      type="text"
                      value={slot.directional_flow}
                      onChange={(e) => updateConvoySlot(slot.id, 'directional_flow', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Gate Open Time</label>
                    <input
                      type="text"
                      value={slot.open_time}
                      onChange={(e) => updateConvoySlot(slot.id, 'open_time', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Rigid Cutoff IST</label>
                    <input
                      type="text"
                      value={slot.cutoff_time}
                      onChange={(e) => updateConvoySlot(slot.id, 'cutoff_time', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-red-600 dark:text-red-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Vehicle Eligibility Tier</label>
                    <input
                      type="text"
                      value={slot.vehicle_tier}
                      onChange={(e) => updateConvoySlot(slot.id, 'vehicle_tier', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: FIELD SENSORS */}
      {activeTab === 'sensors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Multi-Source Telemetry Field Sensors
              </h2>
              <span className="text-xs text-slate-500">Live sensor nodes showing snowpack compaction, wind gusts, and road friction</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(telemetry.field_sensors || []).map((sensor) => (
              <div
                key={sensor.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={sensor.code}
                    onChange={(e) => updateFieldSensor(sensor.id, 'code', e.target.value)}
                    className="w-44 px-2 py-1 text-xs font-mono font-bold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />

                  <select
                    value={sensor.status}
                    onChange={(e) => updateFieldSensor(sensor.id, 'status', e.target.value as FieldSensorItem['status'])}
                    className="px-2 py-1 text-xs font-bold uppercase rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="calibrated">Calibrated</option>
                    <option value="warning">Warning</option>
                    <option value="alert">Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Sensor Location</label>
                  <input
                    type="text"
                    value={sensor.name}
                    onChange={(e) => updateFieldSensor(sensor.id, 'name', e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Metric Name</label>
                    <input
                      type="text"
                      value={sensor.metric_name}
                      onChange={(e) => updateFieldSensor(sensor.id, 'metric_name', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Metric Value</label>
                    <input
                      type="text"
                      value={sensor.metric_value}
                      onChange={(e) => updateFieldSensor(sensor.id, 'metric_value', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">Gauge Level</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{sensor.percent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sensor.percent}
                    onChange={(e) => updateFieldSensor(sensor.id, 'percent', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MANDI SPOT TELEMETRY */}
      {activeTab === 'mandi' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Agricultural &amp; Commodity Mandi Spot Telemetry
              </h2>
              <span className="text-xs text-slate-500">Live prices displayed on Homepage, Article Sidebar &amp; Broadsheet ticker</span>
            </div>

            <Button
              onClick={addCommodity}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-xl flex items-center gap-1.5"
            >
              <span>+ Add Commodity</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {telemetry.mandi_commodities.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <select
                      value={item.corridor}
                      onChange={(e) => updateMandiCommodity(item.id, 'corridor', e.target.value as MandiCommodityItem['corridor'])}
                      className="text-xs font-bold uppercase px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-300"
                    >
                      <option value="kashmir">Kashmir Valley</option>
                      <option value="jammu">Jammu Plains</option>
                      <option value="chenab">Chenab Valley</option>
                      <option value="ladakh">Leh &amp; Ladakh</option>
                    </select>
                    <input
                      type="text"
                      value={item.market_name}
                      onChange={(e) => updateMandiCommodity(item.id, 'market_name', e.target.value)}
                      className="px-2 py-1 text-xs font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="Mandi / Registry Name"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCommodity(item.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Commodity Name</label>
                  <input
                    type="text"
                    value={item.commodity_name}
                    onChange={(e) => updateMandiCommodity(item.id, 'commodity_name', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Spot Price</label>
                    <input
                      type="text"
                      value={item.price}
                      onChange={(e) => updateMandiCommodity(item.id, 'price', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Unit</label>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateMandiCommodity(item.id, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Trend &amp; %</label>
                    <div className="flex items-center gap-1">
                      <select
                        value={item.trend}
                        onChange={(e) => updateMandiCommodity(item.id, 'trend', e.target.value as MandiCommodityItem['trend'])}
                        className="px-1 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      >
                        <option value="up">▲ Up</option>
                        <option value="down">▼ Down</option>
                        <option value="steady">● Steady</option>
                      </select>
                      <input
                        type="text"
                        value={item.change_pct}
                        onChange={(e) => updateMandiCommodity(item.id, 'change_pct', e.target.value)}
                        className="w-full px-1.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Left Stat (Arrivals / Specs)</label>
                    <input
                      type="text"
                      value={item.stat_left}
                      onChange={(e) => updateMandiCommodity(item.id, 'stat_left', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Right Stat (Demand / Status)</label>
                    <input
                      type="text"
                      value={item.stat_right}
                      onChange={(e) => updateMandiCommodity(item.id, 'stat_right', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LIVE WIRE & 5 CORRIDORS */}
      {activeTab === 'corridors' && (
        <div className="space-y-6">
          {/* Live Developing Alert Command Center */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                  <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Top Developing Wire Banner Ticker
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  The primary black alert ribbon displayed across the top of localhost:3000 broadsheet homepage.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={telemetry.live_wire.is_active}
                    onChange={(e) => setTelemetry(prev => ({
                      ...prev,
                      live_wire: { ...prev.live_wire, is_active: e.target.checked },
                    }))}
                    className="rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>Display on Website</span>
                </label>
              </div>
            </div>

            {/* 1. Live Visual Preview Ribbon */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Live Broadsheet Preview (Homepage Ribbon)</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {telemetry.live_wire.mode === 'auto' ? 'Mode: Dynamic Auto-Sync' : 'Mode: Manual / AI Curated'}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-800 shadow-md">
                <div className="bg-[#0F172A] text-white py-2.5 px-4 font-sans flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <span className="flex items-center px-2 py-0.5 bg-[#DC2626] text-white text-[10px] font-bold tracking-widest uppercase rounded shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block mr-1.5" />
                      {telemetry.live_wire.badge || 'DEVELOPING'}
                    </span>
                    <p className="truncate font-medium text-white/90 text-xs">
                      {telemetry.live_wire.mode === 'auto'
                        ? (recentArticles[0]?.title || telemetry.live_wire.headline || 'Chenab Valley railway link completes winter safety protocol run...')
                        : (telemetry.live_wire.headline || 'Chenab Valley railway link completes winter safety protocol run; Mughal Road cleared for high-altitude freight traffic after light snowfall.')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-300 shrink-0 self-end md:self-center">
                    {telemetry.live_wire.verified && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        ✓ Verified Wire
                      </span>
                    )}
                    <span className="text-slate-600">|</span>
                    <span>Synced: {telemetry.live_wire.synced_time || 'LIVE'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Mode Selector: Auto vs Manual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTelemetry(prev => ({
                  ...prev,
                  live_wire: { ...prev.live_wire, mode: 'auto' },
                }))}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                  telemetry.live_wire.mode === 'auto'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-900 dark:text-cyan-200 ring-2 ring-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Dynamic Auto-Sync</span>
                  </span>
                  {telemetry.live_wire.mode === 'auto' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-600 text-white font-bold">Active</span>
                  )}
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Automatically pulls the title of the latest published article in real-time. Zero manual upkeep.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTelemetry(prev => ({
                  ...prev,
                  live_wire: { ...prev.live_wire, mode: 'manual' },
                }))}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                  telemetry.live_wire.mode !== 'auto'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>✍️</span>
                    <span>Manual &amp; AI-Curated Wire</span>
                  </span>
                  {telemetry.live_wire.mode !== 'auto' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white font-bold">Active</span>
                  )}
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Type a custom headline or click the AI button to synthesize a broadsheet bulletin from today&apos;s news.
                </p>
              </button>
            </div>

            {/* 3. AI Generation Action & Quick Chips */}
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-950/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                    <span>✨</span>
                    <span>AI Newsroom Wire Synthesizer</span>
                  </h4>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                    Queries recent verified dispatches and asks Gemini to write an urgent broadsheet bulletin ticker.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={isGeneratingAI}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-md transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isGeneratingAI ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Calling Gemini...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>AI Generate with Gemini</span>
                    </>
                  )}
                </button>
              </div>

              {recentArticles.length > 0 && (
                <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-400 block mb-1.5">
                    Or click a recent published article to populate headline:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentArticles.slice(0, 4).map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => {
                          setTelemetry(prev => ({
                            ...prev,
                            live_wire: {
                              ...prev.live_wire,
                              headline: art.title,
                              article_id: art.id,
                              mode: 'manual',
                            },
                          }));
                          toast.info(`Selected story: "${art.title.slice(0, 40)}..."`);
                        }}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 font-medium transition max-w-xs truncate"
                        title={art.title}
                      >
                        {art.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Detailed Manual Form Fields */}
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Alert Badge
                  </label>
                  <input
                    type="text"
                    value={telemetry.live_wire.badge || 'DEVELOPING'}
                    onChange={(e) => setTelemetry(prev => ({
                      ...prev,
                      live_wire: { ...prev.live_wire, badge: e.target.value.toUpperCase() },
                    }))}
                    placeholder="DEVELOPING"
                    className="w-full px-3 py-2 text-xs font-bold uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <div className="flex gap-1 mt-1 text-[9px]">
                    {['DEVELOPING', 'BREAKING', 'ALERT'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setTelemetry(prev => ({
                          ...prev,
                          live_wire: { ...prev.live_wire, badge: b },
                        }))}
                        className="text-cyan-600 hover:underline"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase">
                      Developing Wire Headline
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {telemetry.live_wire.headline.length}/180 chars
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={telemetry.live_wire.headline}
                    onChange={(e) => setTelemetry(prev => ({
                      ...prev,
                      live_wire: { ...prev.live_wire, headline: e.target.value },
                    }))}
                    placeholder="Enter urgent broadsheet developing headline..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase">
                      Sync Timestamp
                    </label>
                    <button
                      type="button"
                      onClick={handleSetCurrentTime}
                      className="text-[10px] font-bold text-cyan-600 hover:underline"
                    >
                      [⏰ Stamp Current IST]
                    </button>
                  </div>
                  <input
                    type="text"
                    value={telemetry.live_wire.synced_time}
                    onChange={(e) => setTelemetry(prev => ({
                      ...prev,
                      live_wire: { ...prev.live_wire, synced_time: e.target.value },
                    }))}
                    placeholder="14:30 IST"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center pt-3 sm:pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telemetry.live_wire.verified}
                      onChange={(e) => setTelemetry(prev => ({
                        ...prev,
                        live_wire: { ...prev.live_wire, verified: e.target.checked },
                      }))}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Show &quot;✓ Verified Wire&quot; Bureau Badge</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Territorial Corridors At A Glance */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Five Territorial Corridors At A Glance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {telemetry.corridors_at_a_glance.map((corridor) => (
                <div
                  key={corridor.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-2.5"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 block w-fit">
                    {corridor.name}
                  </span>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Headline</label>
                    <textarea
                      rows={2}
                      value={corridor.headline}
                      onChange={(e) => updateCorridorGlance(corridor.id, 'headline', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Operational Stats</label>
                    <input
                      type="text"
                      value={corridor.stats}
                      onChange={(e) => updateCorridorGlance(corridor.id, 'stats', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-semibold">Destination Article / Corridor Path</label>
                    <input
                      type="text"
                      value={corridor.link_path || ''}
                      onChange={(e) => updateCorridorGlance(corridor.id, 'link_path', e.target.value)}
                      placeholder="/category/slug or /region/kashmir"
                      className="w-full px-2 py-1 text-[11px] font-mono rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VOICES OF THE CORRIDORS */}
      {activeTab === 'voices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Citizen Voices &amp; Field Testimonies
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {telemetry.voices_of_corridors.map((voice, idx) => (
              <div
                key={voice.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-3"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Speaker Name</label>
                  <input
                    type="text"
                    value={voice.speaker}
                    onChange={(e) => {
                      const updated = [...telemetry.voices_of_corridors];
                      updated[idx].speaker = e.target.value;
                      setTelemetry(prev => ({ ...prev, voices_of_corridors: updated }));
                    }}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Location &amp; Sub-Region</label>
                  <input
                    type="text"
                    value={voice.location}
                    onChange={(e) => {
                      const updated = [...telemetry.voices_of_corridors];
                      updated[idx].location = e.target.value;
                      setTelemetry(prev => ({ ...prev, voices_of_corridors: updated }));
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Citizen Quote</label>
                  <textarea
                    rows={3}
                    value={voice.quote}
                    onChange={(e) => {
                      const updated = [...telemetry.voices_of_corridors];
                      updated[idx].quote = e.target.value;
                      setTelemetry(prev => ({ ...prev, voices_of_corridors: updated }));
                    }}
                    className="w-full px-3 py-2 text-xs italic rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CIVIC & SPONSORED MISSION */}
      {activeTab === 'civic' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Civic &amp; Public Initiative Spotlight Module
            </h3>
            <p className="text-xs text-slate-500">Configures the broadsheet right-rail sponsor and policy spotlight module.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Banner Tag</label>
                <input
                  type="text"
                  value={telemetry.civic_initiative.badge}
                  onChange={(e) => setTelemetry(prev => ({
                    ...prev,
                    civic_initiative: { ...prev.civic_initiative, badge: e.target.value },
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Initiative Title</label>
                <input
                  type="text"
                  value={telemetry.civic_initiative.title}
                  onChange={(e) => setTelemetry(prev => ({
                    ...prev,
                    civic_initiative: { ...prev.civic_initiative, title: e.target.value },
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Description</label>
              <textarea
                rows={3}
                value={telemetry.civic_initiative.description}
                onChange={(e) => setTelemetry(prev => ({
                  ...prev,
                  civic_initiative: { ...prev.civic_initiative, description: e.target.value },
                }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Button CTA Text</label>
                <input
                  type="text"
                  value={telemetry.civic_initiative.cta_text}
                  onChange={(e) => setTelemetry(prev => ({
                    ...prev,
                    civic_initiative: { ...prev.civic_initiative, cta_text: e.target.value },
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Button CTA Link</label>
                <input
                  type="text"
                  value={telemetry.civic_initiative.cta_link}
                  onChange={(e) => setTelemetry(prev => ({
                    ...prev,
                    civic_initiative: { ...prev.civic_initiative, cta_link: e.target.value },
                  }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save Bar */}
      {canManage && (
        <div className="pt-4 flex items-center justify-end border-t border-slate-200 dark:border-slate-800">
          <Button
            onClick={() => handleSave()}
            disabled={saving}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl shadow-md"
          >
            {saving ? 'Syncing Changes...' : 'Save & Broadcast Live Telemetry'}
          </Button>
        </div>
      )}
    </div>
  );
}
