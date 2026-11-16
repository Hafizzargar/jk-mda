'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CareersSettings, JobPosting } from '@/lib/careers';

interface CareersPortalProps {
  careersSettings: CareersSettings;
  brandName: string;
  brandFullName: string;
  langPrefix: string;
}

export function CareersPortal({
  careersSettings,
  brandName,
  brandFullName,
  langPrefix,
}: CareersPortalProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeJobForModal, setActiveJobForModal] = useState<JobPosting | null>(null);
  const [isGeneralModalOpen, setIsGeneralModalOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const departments = useMemo(() => {
    return [
      'all',
      ...Array.from(new Set(careersSettings.jobs.map((j) => j.department))),
    ];
  }, [careersSettings.jobs]);

  const filteredJobs = useMemo(() => {
    return careersSettings.jobs.filter((job) => {
      if (job.status !== 'active') return false;
      const matchDept =
        selectedDepartment === 'all' ||
        job.department.toLowerCase() === selectedDepartment.toLowerCase();
      const matchSearch =
        searchQuery.trim() === '' ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [careersSettings.jobs, selectedDepartment, searchQuery]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(careersSettings.contact_email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      // Fallback
    }
  };

  const getMailtoUrl = (job?: JobPosting | null) => {
    const subject = job
      ? `Job Application: ${job.title} - [Your Full Name]`
      : `Newsroom Application & Contributor Pitch - [Your Full Name]`;
    const body = `Dear ${brandName} Editorial Board,\n\nI am writing to submit my application for the role of "${
      job ? job.title : 'Newsroom Contributor / Author'
    }".\n\nPlease find attached my updated Resume / CV and links to my published work.\n\nFull Name: \nContact Number / WhatsApp: \nCurrent Location (City/District): \nYears of Experience: \nPortfolio / Publication Links: \nEarliest Available Start Date: \n\nThank you for considering my application.\n\nBest regards,\n`;

    return `mailto:${careersSettings.contact_email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const openApplyModal = (job: JobPosting) => {
    setActiveJobForModal(job);
    setIsGeneralModalOpen(false);
  };

  const openGeneralApply = () => {
    setActiveJobForModal(null);
    setIsGeneralModalOpen(true);
  };

  const closeModal = () => {
    setActiveJobForModal(null);
    setIsGeneralModalOpen(false);
  };

  const isModalOpen = Boolean(activeJobForModal || isGeneralModalOpen);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 relative overflow-hidden">
      {/* Dynamic Animated Ambient Glow Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/15 rounded-full blur-[128px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-48 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[600px] left-1/3 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

      {/* 1. HERO SECTION WITH MODERN ANIMATIONS */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          {/* Animated Hiring Status Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-emerald-500/10 via-emerald-500/20 to-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-in fade-in zoom-in-95 duration-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>
              {careersSettings.hiring_status === 'open'
                ? 'We Are Hiring • 2026 Newsroom Recruitment'
                : 'Applications Paused'}
            </span>
          </div>

          {/* Impact Headline */}
          <h1 className="font-serif text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1] max-w-4xl mx-auto">
            Shape the Future of Ground Journalism at{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
              {brandName}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 font-sans max-w-3xl mx-auto leading-relaxed">
            {careersSettings.page_subtitle || 'Join Jammu & Kashmir’s Premier Independent Journal of Record'}
          </p>

          <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed font-serif italic">
            "{careersSettings.culture_statement}"
          </p>

          {/* Quick Action Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#openings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Explore Active Vacancies ({filteredJobs.length})</span>
              <span>↓</span>
            </a>
            <button
              type="button"
              onClick={openGeneralApply}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-500 font-bold text-sm transition-all transform hover:-translate-y-0.5 cursor-pointer backdrop-blur-sm"
            >
              <span>General Pitch &amp; Bylines</span>
              <span>✍️</span>
            </button>
          </div>
        </div>

        {/* 2. NEWSROOM STATS COUNTER BAR */}
        <div className="max-w-5xl mx-auto mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition group text-center">
            <div className="text-3xl font-black text-amber-400 font-mono tracking-tight group-hover:scale-105 transition-transform">
              5
            </div>
            <div className="text-xs font-bold text-slate-200 mt-1 uppercase tracking-wider">
              Regional Bureaus
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Kashmir, Chenab, Pir Panjal, Jammu, Ladakh</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition group text-center">
            <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight group-hover:scale-105 transition-transform">
              22
            </div>
            <div className="text-xs font-bold text-slate-200 mt-1 uppercase tracking-wider">
              Districts Covered
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Highland valleys &amp; remote ground corridors</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition group text-center">
            <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight group-hover:scale-105 transition-transform">
              100%
            </div>
            <div className="text-xs font-bold text-slate-200 mt-1 uppercase tracking-wider">
              Editorial Freedom
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Zero political or corporate influence</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition group text-center">
            <div className="text-3xl font-black text-purple-400 font-mono tracking-tight group-hover:scale-105 transition-transform">
              48h
            </div>
            <div className="text-xs font-bold text-slate-200 mt-1 uppercase tracking-wider">
              Fast-Track Review
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Direct editor review for every CV</p>
          </div>
        </div>
      </section>

      {/* 3. DIRECT FAST-TRACK APPLICATION CARD */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-500/20 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <span>⚡ Direct Fast-Track Application</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                No complex portals or tedious forms. Email your CV directly.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Send your resume, links to your best stories or ground clips, and preferred district/corridor directly to our editorial board:
              </p>
              <div className="pt-2 flex items-center gap-3">
                <span className="font-mono text-xs sm:text-sm font-bold text-amber-300 bg-black/40 px-3.5 py-1.5 rounded-xl border border-amber-500/30 shadow-inner">
                  {careersSettings.contact_email}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <a
                href={getMailtoUrl()}
                className="px-6 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all text-center flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02]"
              >
                <span>✉️ Email Your Resume</span>
              </a>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition text-center cursor-pointer"
              >
                {copiedEmail ? '✓ Copied to Clipboard!' : '📋 Copy Newsroom Email'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. WHY WORK WITH US (INTERACTIVE PILLARS) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-800/60">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            Why Practice Journalism at {brandName}?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Built for reporters who care about verifiable truth, deep field reporting, and public accountability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-amber-500/40 hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🛡️
            </div>
            <h3 className="font-bold text-base text-white mb-2">Uncompromised Editorial Independence</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              We operate strictly under the Press Council of India code of ethics. Our correspondents investigate civic failures, environmental concerns, and administrative delays without commercial interference.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-cyan-500/40 hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🏔️
            </div>
            <h3 className="font-bold text-base text-white mb-2">Granular 22-District Presence</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              From Srinagar and the Tawi valley to the rugged gorges of Doda, Kishtwar, Ramban, Poonch, and the Ladakh cold deserts — your work brings real voices to light from every pocket of the region.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-purple-500/40 hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              📜
            </div>
            <h3 className="font-bold text-base text-white mb-2">Permanent Digital Archive &amp; Bylines</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Every story, ground investigation, and civic dispatch is permanently archived with cryptographic and verified author credentials, syndication metadata, and global reach.
            </p>
          </div>
        </div>
      </section>

      {/* 5. CURRENT OPEN VACANCIES WITH INTERACTIVE FILTERS */}
      <section id="openings" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-800/60">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                Current Newsroom Vacancies ({filteredJobs.length})
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Active Listings
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Filter by department or search keywords to view criteria and apply directly.
            </p>
          </div>

          {/* Search Box */}
          <div className="w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles, locations, skills..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 text-xs text-white px-3.5 py-2.5 rounded-xl outline-none placeholder-slate-500 transition"
            />
          </div>
        </div>

        {/* Department Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {departments.map((dept) => {
            const isSelected = selectedDepartment === dept;
            const count =
              dept === 'all'
                ? careersSettings.jobs.filter((j) => j.status === 'active').length
                : careersSettings.jobs.filter(
                    (j) => j.status === 'active' && j.department.toLowerCase() === dept.toLowerCase()
                  ).length;

            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="capitalize">{dept === 'all' ? 'All Openings' : dept}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Jobs Grid */}
        {filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-xl hover:-translate-y-1 relative"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      {job.department}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {job.role_type}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-white group-hover:text-amber-400 transition-colors leading-snug mb-2">
                    {job.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span>📍</span>
                      <span>{job.location}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <span>💼</span>
                      <span>{job.experience_level}</span>
                    </span>
                    {job.salary_range && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400 font-mono text-[11px] font-semibold">
                          {job.salary_range}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {job.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openApplyModal(job)}
                    className="text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Requirements</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>

                  <a
                    href={getMailtoUrl(job)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Apply via Email</span>
                    <span>✉️</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="text-base font-bold text-slate-300">No active positions match your criteria.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              We always welcome talented investigative reporters, editors, and photographers across J&amp;K. Submit a general pitch below.
            </p>
            <button
              type="button"
              onClick={openGeneralApply}
              className="mt-4 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer"
            >
              Submit General Contributor Pitch
            </button>
          </div>
        )}
      </section>

      {/* 6. MODAL: JOB REQUIREMENTS & DIRECT APPLY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0F172A] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {activeJobForModal ? activeJobForModal.department : 'General Application'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mt-2 leading-snug">
                  {activeJobForModal ? activeJobForModal.title : 'General Newsroom Contributor / Author Pitch'}
                </h3>
                {activeJobForModal && (
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>📍 {activeJobForModal.location}</span>
                    <span>•</span>
                    <span>💼 {activeJobForModal.experience_level}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div>
                <h4 className="font-bold text-white text-sm mb-1.5">Overview</h4>
                <p>
                  {activeJobForModal
                    ? activeJobForModal.description
                    : 'We are looking for passionate journalists, grassroots field correspondents, translators, and investigators across Kashmir, Jammu, Chenab Valley, Pir Panjal, and Ladakh to join our expanding team.'}
                </p>
              </div>

              {activeJobForModal && activeJobForModal.responsibilities.length > 0 && (
                <div>
                  <h4 className="font-bold text-white text-sm mb-2">Key Responsibilities</h4>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                    {activeJobForModal.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeJobForModal && activeJobForModal.requirements.length > 0 && (
                <div>
                  <h4 className="font-bold text-white text-sm mb-2">Qualifications &amp; Criteria</h4>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                    {activeJobForModal.requirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Application Details */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-bold text-amber-400 text-xs">How to Apply:</div>
                <p className="text-[11px] text-slate-400">
                  Email your CV / Resume along with 2-3 links to your published work, district of residence, and earliest start date to:
                </p>
                <div className="font-mono text-xs font-bold text-white bg-black/40 px-3 py-1.5 rounded-lg border border-slate-700">
                  {careersSettings.contact_email}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeModal}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Close
              </button>
              <a
                href={getMailtoUrl(activeJobForModal)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <span>Send Application via Email</span>
                <span>✉️</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
