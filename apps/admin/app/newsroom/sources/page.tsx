'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DISTRICT_GROUPS } from '@/lib/taxonomy-options';
import { Button } from '@/components/Button';

interface SourceItem {
  id: string;
  name: string;
  authority: string;
  feed_url: string;
  source_type: 'rss' | 'official_portal' | 'api' | 'youtube_channel';
  division: string | null;
  district_slug: string | null;
  topics: string[];
  collection_frequency_minutes: number;
  is_active: boolean;
  last_successful_check: string | null;
  last_error: string | null;
  collection_status: 'idle' | 'checking' | 'healthy' | 'error' | 'unreachable';
  attribution_terms: string | null;
  youtube_channel_id: string | null;
  is_owner_approved: boolean;
  created_at: string;
}

export default function SourceManagerPage() {
  const router = useRouter();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formAuthority, setFormAuthority] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formType, setFormType] = useState<'rss' | 'official_portal' | 'api' | 'youtube_channel'>('official_portal');
  const [formDistrict, setFormDistrict] = useState('');
  const [formDivision, setFormDivision] = useState('');
  const [formFrequency, setFormFrequency] = useState(60);
  const [formAttribution, setFormAttribution] = useState('');
  const [formYoutubeId, setFormYoutubeId] = useState('');
  const [formOwnerApproved, setFormOwnerApproved] = useState(false);
  const [formTopics, setFormTopics] = useState<string[]>(['administration']);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/newsroom/sources', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      } else {
        setMessage({ text: 'Failed to load source registry.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network failure loading sources.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSource(source: SourceItem) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const nextActive = !source.is_active;
      const res = await fetch('/api/newsroom/sources', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ id: source.id, is_active: nextActive }),
      });

      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === source.id ? { ...s, is_active: nextActive } : s))
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteSource(id: string) {
    if (!confirm('Are you sure you want to remove this source from monitoring?')) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch(`/api/newsroom/sources?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== id));
        setMessage({ text: 'Source deleted successfully.', type: 'success' });
      } else {
        setMessage({ text: 'Failed to delete source.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateSource(e: FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          name: formName,
          authority: formAuthority,
          feed_url: formUrl,
          source_type: formType,
          district_slug: formDistrict || null,
          division: formDivision || null,
          topics: formTopics,
          collection_frequency_minutes: formFrequency,
          attribution_terms: formAttribution,
          youtube_channel_id: formYoutubeId,
          is_owner_approved: formOwnerApproved,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setMessage({ text: 'Source successfully registered and validated!', type: 'success' });
        setShowAddModal(false);
        // Reset form
        setFormName('');
        setFormAuthority('');
        setFormUrl('');
        setFormYoutubeId('');
        await loadSources();
      } else {
        setMessage({ text: result.error || 'Failed to create source.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network error saving source.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔗</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Official Government &amp; News Source Registry
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure authorized district administration portals, departmental notice boards, RSS feeds, and owner-approved YouTube channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            href="/newsroom"
            variant="secondary"
            size="md"
            icon="📡"
          >
            Back to Monitor
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            icon="+"
            onClick={() => setShowAddModal(true)}
          >
            Add Source
          </Button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`mt-4 rounded-xl border p-4 text-xs font-semibold flex items-center justify-between ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sources Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3.5">Source &amp; Authority</th>
              <th className="px-4 py-3.5">Type &amp; Region</th>
              <th className="px-4 py-3.5">Topics</th>
              <th className="px-4 py-3.5">Collection Status</th>
              <th className="px-4 py-3.5">Last Checked</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-semibold">
                  Loading source registry...
                </td>
              </tr>
            ) : sources.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No sources registered. Click &quot;Add Source&quot; to begin.
                </td>
              </tr>
            ) : (
              sources.map((src) => (
                <tr key={src.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  {/* Name & URL */}
                  <td className="px-4 py-3.5">
                    <p className="font-extrabold text-slate-900 dark:text-white">{src.name}</p>
                    <p className="text-[11px] text-slate-500">{src.authority}</p>
                    <a
                      href={src.feed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-600 hover:underline dark:text-cyan-400 font-mono truncate max-w-xs block"
                    >
                      {src.feed_url}
                    </a>
                  </td>

                  {/* Type & District */}
                  <td className="px-4 py-3.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {src.source_type.replace(/_/g, ' ')}
                    </span>
                    <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {src.district_slug ? `📍 ${src.district_slug.toUpperCase()}` : src.division || 'All Regions'}
                    </p>
                    {src.source_type === 'youtube_channel' && (
                      <span className={`inline-block mt-1 text-[10px] font-bold ${src.is_owner_approved ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {src.is_owner_approved ? '✓ Owner Approved' : '⚠️ Pending Approval'}
                      </span>
                    )}
                  </td>

                  {/* Topics */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {src.topics.map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Health status */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        src.collection_status === 'healthy'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : src.collection_status === 'error'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      <span>{src.collection_status}</span>
                    </span>
                    {src.last_error && (
                      <p className="mt-1 text-[10px] text-rose-600 truncate max-w-xs">{src.last_error}</p>
                    )}
                  </td>

                  {/* Last Checked */}
                  <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                    {src.last_successful_check
                      ? new Date(src.last_successful_check).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={src.is_active ? 'secondary' : 'amber'}
                      onClick={() => handleToggleSource(src)}
                    >
                      {src.is_active ? 'Active' : 'Disabled'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteSource(src.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Add Official or News Source
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSource} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. District Doda Administration"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Authority / Department</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. District Magistrate Doda / J&K Police"
                  value={formAuthority}
                  onChange={(e) => setFormAuthority(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Source Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'rss' | 'official_portal' | 'api' | 'youtube_channel')}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="official_portal">Official Government Portal</option>
                    <option value="rss">RSS Feed</option>
                    <option value="api">API Endpoint</option>
                    <option value="youtube_channel">YouTube Channel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Applicable District</label>
                  <select
                    value={formDistrict}
                    onChange={(e) => {
                      const dist = e.target.value;
                      setFormDistrict(dist);
                      if (dist === 'doda' || dist === 'kishtwar' || dist === 'ramban') {
                        setFormDivision('Chenab Valley');
                      } else if (dist === 'rajouri' || dist === 'poonch') {
                        setFormDivision('Pir Panjal');
                      } else if (dist === 'leh' || dist === 'kargil') {
                        setFormDivision('Leh & Ladakh');
                      } else {
                        setFormDivision('National');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">State / National / All</option>
                    {DISTRICT_GROUPS.map((grp) => (
                      <optgroup key={grp.region} label={grp.region}>
                        {grp.districts.map((d) => (
                          <option key={d.slug} value={d.slug}>
                            {d.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Check Frequency (mins)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(Number(e.target.value) || 60)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Attribution Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Official Government Notice"
                    value={formAttribution}
                    onChange={(e) => setFormAttribution(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Primary Topics (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. road_closures, accidents, weather_disaster"
                  value={formTopics.join(', ')}
                  onChange={(e) =>
                    setFormTopics(
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Feed / Portal URL (Strict SSRF Checked)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://doda.gov.in/ or https://pib.gov.in/..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {formType === 'youtube_channel' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-2">
                  <div>
                    <label className="block text-amber-900 dark:text-amber-200 mb-1 font-bold">
                      YouTube Channel ID
                    </label>
                    <input
                      type="text"
                      placeholder="UC..."
                      value={formYoutubeId}
                      onChange={(e) => setFormYoutubeId(e.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-mono text-xs dark:bg-slate-900 dark:border-amber-800"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formOwnerApproved}
                      onChange={(e) => setFormOwnerApproved(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      I confirm this channel is explicitly owner-approved for KJIN monitoring.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting}
                  isLoading={submitting}
                >
                  {submitting ? 'Validating URL...' : 'Register Source'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
