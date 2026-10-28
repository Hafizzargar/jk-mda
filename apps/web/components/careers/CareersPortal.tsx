'use client';

import React, { useState } from 'react';
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
}: CareersPortalProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeJobForModal, setActiveJobForModal] = useState<JobPosting | null>(null);
  const [isGeneralModalOpen, setIsGeneralModalOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const departments = [
    'all',
    ...Array.from(new Set(careersSettings.jobs.map((j) => j.department))),
  ];

  const filteredJobs = careersSettings.jobs.filter((job) => {
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
    const body = `Dear KJIN Editorial Board,\n\nI am writing to submit my application for the role of "${
      job ? job.title : 'Newsroom Contributor / Author'
    }".\n\nPlease find attached my updated Resume / CV and links to my work.\n\nFull Name: \nContact Number / WhatsApp: \nCurrent Location (City/District): \nYears of Experience: \nPortfolio / Publication Links: \nEarliest Available Start Date: \n\nThank you for considering my application.\n\nBest regards,\n`;

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
  const currentModalJob = activeJobForModal;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. Newsroom Careers Hero */}
      <section className="relative overflow-hidden border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {careersSettings.hiring_status === 'open'
              ? 'We Are Hiring • Join Our Newsroom'
              : 'Newsroom Applications Paused'}
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white max-w-4xl mx-auto leading-tight">
            {careersSettings.page_title}
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto font-sans leading-relaxed">
            {careersSettings.page_subtitle}
          </p>

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {careersSettings.culture_statement}
          </p>

          {/* Quick Resume Direct Email Banner */}
          <div className="max-w-4xl mx-auto mt-10 p-6 rounded-2xl bg-gradient-to-r from-cyan-50 via-white to-emerald-50 dark:from-cyan-950/40 dark:via-slate-900 dark:to-emerald-950/30 border border-cyan-200 dark:border-cyan-800/60 shadow-sm text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📧</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                    Direct Resume Submissions
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white">
                  No forms required. Send your Resume & CV directly to our newsroom.
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Review open vacancies below and send your resume, portfolio links, and clips directly to:
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <span className="font-mono text-xs sm:text-sm font-bold text-cyan-700 dark:text-cyan-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-700 shadow-xs">
                    {careersSettings.contact_email}
                  </span>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end gap-2.5 shrink-0">
                <a
                  href={getMailtoUrl()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white shadow-sm transition text-center flex items-center justify-center gap-1.5"
                >
                  <span>✉️ Email Your Resume</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl font-semibold text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-stone-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition text-center"
                >
                  {copiedEmail ? '✓ Copied Email!' : '📋 Copy Email'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#openings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white font-medium text-sm shadow-sm transition"
            >
              <span>Explore Open Roles ({filteredJobs.length})</span>
              <span>↓</span>
            </a>
            <button
              onClick={openGeneralApply}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-sm transition"
            >
              <span>General Contributor / Pitch</span>
              <span>✍️</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Newsroom Pillars & Benefits */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h2 className="text-center font-serif text-2xl font-bold mb-8 text-slate-900 dark:text-white">
          Why Practice Journalism at {brandName}?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-xl mb-4">
              🛡️
            </div>
            <h3 className="font-bold text-base mb-2">Editorial Integrity & Independence</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              We operate strictly under the Press Council of India code of ethics. Our journalists have full editorial freedom to uncover public-interest stories without corporate or political interference.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl mb-4">
              🏔️
            </div>
            <h3 className="font-bold text-base mb-2">Granular 22-District Regional Reach</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              From the Dal Lake to the Tawi plains, the Chenab gorges, the Pir Panjal highland passes, and the Ladakh plateau, your reporting gives voice to every corridor of the region.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl mb-4">
              📜
            </div>
            <h3 className="font-bold text-base mb-2">Permanent Digital Archive & Bylines</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every story, essay, and investigative photo is permanently preserved in our Journal of Record with verified author credentials, syndication links, and multilingual translation.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Open Job Positions Listing */}
      <section id="openings" className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-slate-800 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
                Current Newsroom Vacancies ({filteredJobs.length})
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Active Roles
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select a position below to view details and email your resume directly to our editorial board.
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search roles, bureaus, skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Department Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDepartment(dept)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
                selectedDepartment.toLowerCase() === dept.toLowerCase()
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              {dept === 'all' ? 'All Departments' : dept}
            </button>
          ))}
        </div>

        {/* Job Cards Grid */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            <p className="text-3xl mb-2">🔍</p>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No active postings match your search
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              We frequently hire for reporters, copy editors, and district stringers. You can send a spontaneous resume submission anytime.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <a
                href={getMailtoUrl()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                Email Resume to {careersSettings.contact_email}
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-cyan-100 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30">
                        {job.department}
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {job.role_type}
                      </span>
                      {job.featured && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
                          ★ Priority Role
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">
                      {job.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span>📍</span> {job.location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <span>⏱️</span> {job.experience_level}
                      </span>
                      {job.salary_range && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                            <span>💼</span> {job.salary_range}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
                      {job.description}
                    </p>

                    {/* Requirements & Responsibilities Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs text-slate-600 dark:text-slate-400 border-t border-stone-100 dark:border-slate-800/80">
                      {job.responsibilities && job.responsibilities.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-1.5">
                            Key Responsibilities:
                          </h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {job.responsibilities.slice(0, 3).map((resp, idx) => (
                              <li key={idx}>{resp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {job.requirements && job.requirements.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-1.5">
                            Key Requirements:
                          </h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {job.requirements.slice(0, 3).map((req, idx) => (
                              <li key={idx}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Direct Action Box */}
                  <div className="lg:w-60 flex flex-col items-stretch justify-center gap-2.5 pt-4 lg:pt-0 border-t lg:border-t-0 border-stone-100 dark:border-slate-800 shrink-0">
                    <a
                      href={getMailtoUrl(job)}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition text-center flex items-center justify-center gap-1.5"
                    >
                      <span>📧 Send Resume via Email</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => openApplyModal(job)}
                      className="w-full py-2 px-3 rounded-xl font-semibold text-xs border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/80 hover:bg-stone-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition text-center flex items-center justify-center gap-1"
                    >
                      <span>ℹ️ Application Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 text-center transition pt-0.5"
                    >
                      {copiedEmail ? '✓ Email copied!' : `Send to ${careersSettings.contact_email}`}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. General Open Expression of Interest Box */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/10 text-cyan-300">
                Spontaneous Submissions & Authors
              </span>
              <h3 className="font-serif text-2xl font-bold">
                Don’t see your exact role listed?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                We are continually looking for freelance authors, investigative researchers, photojournalists, and district stringers across all 22 districts of Jammu, Kashmir, and Ladakh. Send your portfolio and past clips directly to our desk: <strong className="text-cyan-300">{careersSettings.contact_email}</strong>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <a
                href={getMailtoUrl()}
                className="px-6 py-3 rounded-xl bg-white hover:bg-stone-100 text-slate-950 font-bold text-xs whitespace-nowrap shadow-sm transition flex items-center gap-1.5"
              >
                <span>✉️ Email Your CV & Clips</span>
              </a>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-4 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-white font-semibold text-xs transition"
              >
                {copiedEmail ? '✓ Copied!' : 'Copy Email'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Direct Email Application Instructions Modal (No form needed to fill) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-stone-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg w-8 h-8 rounded-full flex items-center justify-center bg-stone-100 dark:bg-slate-800"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Direct Newsroom Application
              </span>
              <h3 className="font-serif text-2xl font-bold text-slate-950 dark:text-white mt-1">
                {currentModalJob ? currentModalJob.title : 'General Expression of Interest'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {currentModalJob
                  ? `${currentModalJob.department} • ${currentModalJob.location} • ${currentModalJob.role_type}`
                  : `Join ${brandFullName} (${brandName}) as a reporter, writer, or district contributor.`}
              </p>
            </div>

            {/* Email Destination Card */}
            <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Official Hiring & Resume Email:
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="font-mono text-base font-bold text-cyan-700 dark:text-cyan-300 select-all">
                  {careersSettings.contact_email}
                </span>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-cyan-300 dark:border-cyan-700 text-slate-800 dark:text-slate-200 shadow-xs hover:bg-stone-50"
                >
                  {copiedEmail ? '✓ Copied to Clipboard!' : '📋 Copy Address'}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                How to Submit Your Application:
              </h4>
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  Click the <strong>&quot;Open in Email Client&quot;</strong> button below to open your default mail app with the subject and outline pre-filled.
                </li>
                <li>
                  Attach your updated <strong>Resume / Curriculum Vitae (CV)</strong> in PDF or DOCX format.
                </li>
                <li>
                  Include links to <strong>2–3 published articles, news reports, or clips</strong> showcasing your reporting quality.
                </li>
                <li>
                  Mention your current <strong>district / city</strong> and your earliest available start date.
                </li>
                <li>
                  Send directly to <strong className="text-cyan-600 dark:text-cyan-400">{careersSettings.contact_email}</strong>. Our editorial board reviews submissions on a rolling basis.
                </li>
              </ol>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <a
                href={getMailtoUrl(currentModalJob)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition text-center flex items-center justify-center gap-2"
              >
                <span>✉️ Open in Email Client</span>
                <span>→</span>
              </a>
              <button
                type="button"
                onClick={closeModal}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
