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

  // Form submission state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    experience_years: '1-3 Years',
    current_role: '',
    portfolio_url: '',
    cover_letter: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSubmitted, setSuccessSubmitted] = useState(false);

  const departments = [
    'all',
    ...Array.from(new Set(careersSettings.jobs.map((j) => j.department))),
  ];

  const filteredJobs = careersSettings.jobs.filter((job) => {
    if (job.status !== 'active') return false;
    const matchDept = selectedDepartment === 'all' || job.department.toLowerCase() === selectedDepartment.toLowerCase();
    const matchSearch =
      searchQuery.trim() === '' ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  });

  const openApplyModal = (job: JobPosting) => {
    setActiveJobForModal(job);
    setIsGeneralModalOpen(false);
    setErrorMessage(null);
    setSuccessSubmitted(false);
  };

  const openGeneralApply = () => {
    setActiveJobForModal(null);
    setIsGeneralModalOpen(true);
    setErrorMessage(null);
    setSuccessSubmitted(false);
  };

  const closeModal = () => {
    setActiveJobForModal(null);
    setIsGeneralModalOpen(false);
    setErrorMessage(null);
    setSuccessSubmitted(false);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      job_id: activeJobForModal ? activeJobForModal.id : 'general',
      job_title: activeJobForModal ? activeJobForModal.title : 'General Contributor / Author',
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      experience_years: formData.experience_years,
      current_role: formData.current_role,
      portfolio_url: formData.portfolio_url,
      cover_letter: formData.cover_letter,
    };

    try {
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application.');
      }

      setSuccessSubmitted(true);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        city: '',
        experience_years: '1-3 Years',
        current_role: '',
        portfolio_url: '',
        cover_letter: '',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while submitting your application.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isModalOpen = Boolean(activeJobForModal || isGeneralModalOpen);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. Newsroom Careers Hero */}
      <section className="relative overflow-hidden border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {careersSettings.hiring_status === 'open' ? 'We Are Hiring • Join Our Newsroom' : 'Newsroom Applications Paused'}
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

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#openings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white font-medium text-sm shadow-sm transition"
            >
              <span>Explore Open Roles</span>
              <span>↓</span>
            </a>
            <button
              onClick={openGeneralApply}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-sm transition"
            >
              <span>Submit General Pitch / Work Experience</span>
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
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
              Open Positions ({filteredJobs.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Filter by newsroom department or search by title, bureau location, or responsibilities.
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search roles or locations..."
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No active postings match your search</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              We frequently hire for reporters, editors, and stringers. You can also submit an open expression of interest below.
            </p>
            <button
              onClick={openGeneralApply}
              className="mt-4 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              Submit General Application
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
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

                    {/* Requirements & Responsibilities Expandable / Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs text-slate-600 dark:text-slate-400 border-t border-stone-100 dark:border-slate-800/80">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-1.5">Key Responsibilities:</h4>
                        <ul className="list-disc pl-4 space-y-1">
                          {job.responsibilities.slice(0, 3).map((resp, idx) => (
                            <li key={idx}>{resp}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-1.5">Requirements:</h4>
                        <ul className="list-disc pl-4 space-y-1">
                          {job.requirements.slice(0, 3).map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="lg:w-48 flex lg:flex-col items-center justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-stone-100 dark:border-slate-800">
                    <button
                      onClick={() => openApplyModal(job)}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition text-center"
                    >
                      Apply Now →
                    </button>
                    <span className="text-[11px] text-slate-400 text-center block">
                      Fast-track review
                    </span>
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
                We are continually looking for freelance authors, investigative researchers, photojournalists, and district stringers across all 22 districts of Jammu, Kashmir, and Ladakh. Share your portfolio and past work experience with our editorial board.
              </p>
            </div>
            <button
              onClick={openGeneralApply}
              className="px-6 py-3 rounded-xl bg-white hover:bg-stone-100 text-slate-950 font-bold text-xs whitespace-nowrap shadow-sm transition"
            >
              Submit Pitch / Portfolio
            </button>
          </div>
        </div>
      </section>

      {/* 5. Application Modal / Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-stone-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg w-8 h-8 rounded-full flex items-center justify-center bg-stone-100 dark:bg-slate-800"
              aria-label="Close"
            >
              ✕
            </button>

            {successSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto">
                  ✓
                </div>
                <h3 className="font-serif text-2xl font-bold text-slate-950 dark:text-white">
                  Application Received!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  Thank you for applying to {brandFullName}. Our editorial review team will evaluate your work experience and portfolio. If shortlisted, a bureau editor will reach out directly.
                </p>
                <div className="pt-4">
                  <button
                    onClick={closeModal}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs shadow-sm"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    Candidate Application
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-slate-950 dark:text-white mt-1">
                    {activeJobForModal ? activeJobForModal.title : 'General Expression of Interest'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeJobForModal
                      ? `${activeJobForModal.department} • ${activeJobForModal.location} • ${activeJobForModal.role_type}`
                      : `Tell us about your background, previous publications, and how you wish to contribute to ${brandName}.`}
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs">
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmitApplication} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Full Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="e.g. Farooq Ahmad"
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="journalist@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Phone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 94190..."
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        City / District
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Srinagar, Jammu, Anantnag"
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Years of Experience
                      </label>
                      <select
                        value={formData.experience_years}
                        onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="0-1 Years">0–1 Years (Entry / Student)</option>
                        <option value="1-3 Years">1–3 Years (Junior Reporter)</option>
                        <option value="3-5 Years">3–5 Years (Mid-level Journalist)</option>
                        <option value="5+ Years">5+ Years (Senior / Bureau Lead)</option>
                        <option value="Published Author">Published Author / Scholar</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Current Role / Publication (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.current_role}
                      onChange={(e) => setFormData({ ...formData, current_role: e.target.value })}
                      placeholder="e.g. Freelance Columnist at Kashmir Times / Graduate Scholar"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Portfolio / Published Clips / Resume URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.portfolio_url}
                      onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                      placeholder="https://drive.google.com/... or https://muckrack.com/..."
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Google Drive, Dropbox, LinkedIn, personal website, or published article link.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cover Note, Pitch & Work Experience Summary *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.cover_letter}
                      onChange={(e) => setFormData({ ...formData, cover_letter: e.target.value })}
                      placeholder="Describe your journalistic background, areas of reporting interest, relevant beats (investigative, civic, agriculture, politics), and why you want to join our newsroom..."
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-sm flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting Application...</span>
                        </>
                      ) : (
                        <span>Submit Application →</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
