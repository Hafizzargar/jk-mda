'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DISTRICT_GROUPS } from '@/lib/taxonomy-options';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

interface SourceCitation {
  source_name: string;
  url: string;
  title: string;
  published_at?: string;
  excerpt?: string;
}

interface OfficialResponse {
  id: string;
  authority_name: string;
  document_title: string | null;
  document_url: string | null;
  published_at: string | null;
  response_type: string;
  match_status: 'confirmed_relevant' | 'possible_match' | 'no_official_update' | 'check_failed';
  match_explanation: string;
  extracted_text_excerpt: string | null;
  last_checked_at: string;
}

interface NewsroomEvent {
  id: string;
  headline: string;
  summary: string;
  district_slug: string | null;
  division: string | null;
  location_name: string | null;
  event_category: string;
  event_date: string;
  detected_at: string;
  verification_status: 'unverified_report' | 'confirmed_event' | 'official_announcement';
  original_sources: SourceCitation[];
  uncertainty_flags: string[];
  editor_notes: string | null;
  status: 'discovered' | 'reviewed' | 'draft_approved' | 'drafted' | 'dismissed';
  article_id: string | null;
  official_responses?: OfficialResponse[];
}

export default function EventGovernmentResponseMonitorPage() {
  const router = useRouter();
  const [events, setEvents] = useState<NewsroomEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);

  // Filters
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMatchStatus, setFilterMatchStatus] = useState('all');
  const [filterVerification, setFilterVerification] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Notification banners
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadEvents();
  }, [filterDistrict, filterCategory, filterVerification, filterMatchStatus]);

  async function loadEvents() {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (filterDistrict !== 'all') params.set('district', filterDistrict);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterVerification !== 'all') params.set('verification_status', filterVerification);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/newsroom/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      } else {
        setMessage({ text: 'Failed to load newsroom events.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network failure loading events.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshSources() {
    const toastId = toast.loading('⚡ Scanning configured RSS feeds & government portals...');
    try {
      setRefreshing(true);
      setMessage({ text: '⚡ Scanning configured RSS feeds & government portals...', type: 'info' });

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        const result = await res.json();
        const successMsg = `Scan complete: Checked ${result.sourcesChecked} sources. Found ${result.newEventsCount} new events and ${result.officialMatchesCount} official updates.`;
        setMessage({ text: successMsg, type: 'success' });
        toast.success(successMsg, { id: toastId, title: 'Sources Refreshed' });
        await loadEvents();
      } else {
        setMessage({ text: 'Error during source collection refresh.', type: 'error' });
        toast.error('Error during source collection refresh.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network failure refreshing sources.', type: 'error' });
      toast.error('Network failure refreshing sources.', { id: toastId });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRecheckOfficialSources(eventId: string) {
    const toastId = toast.loading('Rechecking official government sources...');
    try {
      setRecheckingId(eventId);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/recheck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ eventId }),
      });

      if (res.ok) {
        const result = await res.json();
        const msg = `Official recheck completed: ${result.matchResult.matchExplanation}`;
        setMessage({ text: msg, type: 'success' });
        toast.success(msg, { id: toastId, title: 'Recheck Complete' });
        await loadEvents();
      } else {
        setMessage({ text: 'Failed to recheck official sources.', type: 'error' });
        toast.error('Failed to recheck official sources.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network failure rechecking sources.', type: 'error' });
      toast.error('Network failure rechecking sources.', { id: toastId });
    } finally {
      setRecheckingId(null);
    }
  }

  async function handleApproveForDraft(eventId: string) {
    const toastId = toast.loading('Draft approved. Calling Gemini AI to generate sourced draft and verify checklist...');
    try {
      setDraftingId(eventId);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      setMessage({ text: 'Draft approved. Calling Gemini to generate sourced draft and fact-check checklist...', type: 'info' });

      const res = await fetch('/api/newsroom/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ eventId }),
      });

      if (res.ok) {
        const result = await res.json();
        const successMsg = `Draft successfully generated into articles queue (ID: ${result.articleId}). Redirecting to editor...`;
        setMessage({ text: successMsg, type: 'success' });
        toast.success('Draft generated! Redirecting to editor...', { id: toastId, title: 'AI Draft Ready' });
        await loadEvents();
        setTimeout(() => {
          router.push(`/articles/${result.articleId}/edit`);
        }, 1200);
      } else {
        const err = await res.json();
        const errorMsg = err.error || 'Failed to generate draft.';
        setMessage({ text: errorMsg, type: 'error' });
        toast.error(errorMsg, { id: toastId });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network failure during draft generation.', type: 'error' });
      toast.error('Network failure during draft generation.', { id: toastId });
    } finally {
      setDraftingId(null);
    }
  }

  async function handleDismissEvent(eventId: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/events', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ id: eventId, status: 'dismissed' }),
      });

      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        toast.info('Event dismissed from monitor.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  const filteredEvents = events.filter((ev) => {
    if (filterMatchStatus === 'all') return true;
    const match = ev.official_responses?.[0]?.match_status;
    return match === filterMatchStatus;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Event &amp; Government Response Monitor
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Detects J&amp;K district events and links them with verified official government orders, advisories, and disaster alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            href="/newsroom/sources"
            variant="secondary"
            size="md"
            icon="🔗"
          >
            Source Registry
          </Button>
          <Button
            type="button"
            variant="emerald"
            size="md"
            icon={refreshing ? '🔄' : '⚡'}
            isLoading={refreshing}
            onClick={handleRefreshSources}
          >
            {refreshing ? 'Scanning Portals...' : 'Refresh Sources'}
          </Button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`mt-4 rounded-xl border p-4 text-xs font-semibold flex items-center justify-between ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : message.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200'
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

      {/* Filter Toolbar */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {/* District filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              District
            </label>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Districts (J&amp;K)</option>
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

          {/* Event Category */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Event Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Categories</option>
              <option value="accidents">Accidents &amp; Collisions</option>
              <option value="road_closures">Road &amp; Highway Closures</option>
              <option value="weather_disaster">Weather &amp; Natural Disasters</option>
              <option value="public_safety">Public Safety Alerts</option>
              <option value="school_closures">School &amp; College Closures</option>
              <option value="public_services">Power, Water &amp; Public Services</option>
              <option value="demonstrations_restrictions">Demonstrations &amp; Restrictions</option>
              <option value="administration">Administrative Decisions</option>
              <option value="public_health">Public Health &amp; Outbreaks</option>
              <option value="global_humanitarian">Global &amp; Humanitarian</option>
            </select>
          </div>

          {/* Official Response Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Official Response Status
            </label>
            <select
              value={filterMatchStatus}
              onChange={(e) => setFilterMatchStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed_relevant">✅ Confirmed Relevant Response</option>
              <option value="possible_match">⚠️ Possible Match (Needs Check)</option>
              <option value="no_official_update">⚪ No Matching Update Found</option>
              <option value="check_failed">🔴 Portal Check Failed</option>
            </select>
          </div>

          {/* Verification Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Event Verification
            </label>
            <select
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Verifications</option>
              <option value="unverified_report">Unverified Report</option>
              <option value="confirmed_event">Confirmed Event</option>
              <option value="official_announcement">Official Announcement</option>
            </select>
          </div>

          {/* Search box */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Keyword Search
            </label>
            <input
              type="text"
              placeholder="Search headline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadEvents()}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Loading detected events &amp; official responses...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <span className="text-3xl block mb-2">📡</span>
            <p className="font-bold text-sm">No detected events match your filters.</p>
            <p className="text-xs mt-1">Click &quot;Refresh Sources&quot; above to scan configured feeds and official portals.</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const officialResp = event.official_responses?.[0];
            const isConfirmed = officialResp?.match_status === 'confirmed_relevant';
            const isPossible = officialResp?.match_status === 'possible_match';
            const isFailed = officialResp?.match_status === 'check_failed';
            const isDrafted = (event.status === 'drafted' || event.status === 'draft_approved') && Boolean(event.article_id);

            return (
              <div
                key={event.id}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  isDrafted
                    ? 'border-l-6 border-l-emerald-500 border-emerald-300/80 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/30 hover:border-emerald-400 dark:border-l-emerald-400 dark:border-emerald-800/80 dark:bg-gradient-to-br dark:from-emerald-950/35 dark:via-slate-900 dark:to-teal-950/25 shadow-emerald-500/5'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                {/* Event Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* District / Scope badge */}
                    <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-bold font-mono text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                      📍 {event.location_name || (event.district_slug ? event.district_slug.toUpperCase() : 'International')}
                    </span>

                    {/* Category badge */}
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      🏷️ {event.event_category.replace(/_/g, ' ')}
                    </span>

                    {/* Verification status */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        event.verification_status === 'confirmed_event'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : event.verification_status === 'official_announcement'
                          ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {event.verification_status.replace(/_/g, ' ')}
                    </span>

                    {/* Distinct badge when event already went to articles */}
                    {isDrafted && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800 shadow-2xs dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                        <span>📰</span>
                        <span>Already In Articles &amp; Stories</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    Detected {new Date(event.detected_at).toLocaleString()}
                  </span>
                </div>

                {/* Event Headline & Summary */}
                <div className="mt-3">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {event.headline}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {event.summary}
                  </p>
                </div>

                {/* Reporting Sources */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold">Sources:</span>
                  {event.original_sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-400 font-medium"
                    >
                      <span>{src.source_name}</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  ))}
                </div>

                {/* Official Response Section (The Core Feature) */}
                <div
                  className={`mt-4 rounded-xl border p-3.5 ${
                    isConfirmed
                      ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800/80 dark:bg-emerald-950/20'
                      : isPossible
                      ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800/80 dark:bg-amber-950/20'
                      : isFailed
                      ? 'border-rose-300 bg-rose-50/70 dark:border-rose-800/80 dark:bg-rose-950/20'
                      : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">
                        {isConfirmed ? '🛡️' : isPossible ? '⚠️' : isFailed ? '🔴' : '⚪'}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Official Government Response Status:
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isConfirmed
                            ? 'bg-emerald-600 text-white'
                            : isPossible
                            ? 'bg-amber-500 text-white'
                            : isFailed
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {officialResp
                          ? officialResp.match_status.replace(/_/g, ' ')
                          : 'Not checked yet'}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRecheckOfficialSources(event.id)}
                      disabled={recheckingId === event.id}
                      isLoading={recheckingId === event.id}
                      icon={recheckingId === event.id ? undefined : "⚡"}
                      className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                    >
                      {recheckingId === event.id ? 'Rechecking...' : 'Recheck Official Sources'}
                    </Button>
                  </div>

                  {officialResp && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {officialResp.match_explanation}
                      </p>

                      {officialResp.document_title && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {officialResp.authority_name}:
                          </span>
                          {officialResp.document_url ? (
                            <a
                              href={officialResp.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-cyan-700 hover:underline dark:text-cyan-400 inline-flex items-center gap-1"
                            >
                              <span>{officialResp.document_title}</span>
                              <span className="text-[10px]">↗</span>
                            </a>
                          ) : (
                            <span className="text-slate-800 dark:text-slate-200">
                              {officialResp.document_title}
                            </span>
                          )}
                          {officialResp.published_at && (
                            <span className="text-slate-500 font-mono text-[11px]">
                              ({new Date(officialResp.published_at).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {isDrafted ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          href={`/articles/${event.article_id}`}
                          variant="emerald"
                          size="sm"
                          icon="👁️"
                        >
                          View Story
                        </Button>
                        <Button
                          href={`/articles/${event.article_id}/edit`}
                          variant="primary"
                          size="sm"
                          icon="✏️"
                        >
                          Edit Draft
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon="✨"
                        onClick={() => handleApproveForDraft(event.id)}
                        isLoading={draftingId === event.id}
                      >
                        {draftingId === event.id ? 'Generating Draft...' : 'Approve for Gemini Draft'}
                      </Button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissEvent(event.id)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Dismiss Event
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
