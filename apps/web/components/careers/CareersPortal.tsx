'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { CareersSettings } from '@/lib/careers';

interface CareersPortalProps {
  careersSettings: CareersSettings;
  brandName: string;
  brandFullName: string;
  langPrefix: string;
}

const JK_DISTRICT_SUGGESTIONS = [
  'Srinagar',
  'Jammu',
  'Doda',
  'Bhaderwah',
  'Kishtwar',
  'Ramban',
  'Poonch',
  'Rajouri',
  'Leh',
  'Kargil',
  'Baramulla',
  'Anantnag',
  'Kupwara',
  'Pulwama',
  'Shopian',
  'Budgam',
  'Kulgam',
  'Bandipora',
  'Ganderbal',
  'Udhampur',
  'Kathua',
  'Samba',
  'Reasi',
  'New Delhi / National Bureau',
  'Remote / Other',
];

const BEAT_OPTIONS = [
  'Ground Field Reporting & Investigations',
  'Chenab Valley Correspondent (Doda, Kishtwar, Bhaderwah, Ramban)',
  'Pir Panjal Border Affairs (Poonch & Rajouri)',
  'Kashmir Valley Civic & Environmental Reporter',
  'Jammu Plains Bureau Correspondent',
  'Civic Infrastructure & Public Grievances Reporter',
  'Copy Editing & Fact-Checking Desk',
  'Photojournalism, Video Wire & Multimedia',
  'Opinion Essayist, Academic & Long-Form Author',
  'General Newsroom Contributor / Expression of Interest',
];

const STORAGE_KEY = 'kjcpl_careers_application_submitted';

interface SubmittedRecord {
  submittedAt: string;
  email: string;
  fullName: string;
  refId: string;
  beat: string;
  city: string;
}

export function CareersPortal({
  careersSettings,
  brandName,
  brandFullName,
  langPrefix,
}: CareersPortalProps) {
  // Submission result state (session-only, does NOT persist across refresh)
  const [submittedRecord, setSubmittedRecord] = useState<SubmittedRecord | null>(null);

  // Form input state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Srinagar');
  const [beat, setBeat] = useState(BEAT_OPTIONS[0]);
  const [experienceYears, setExperienceYears] = useState('1-3 Years');
  const [currentRole, setCurrentRole] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Automatically clear any legacy stuck localStorage flags on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('kjcpl_careers_application_submitted');
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleResetForm = () => {
    setSubmittedRecord(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setCity('Srinagar');
    setBeat(BEAT_OPTIONS[0]);
    setExperienceYears('1-3 Years');
    setCurrentRole('');
    setPortfolioUrl('');
    setCoverLetter('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please provide your full legal name (minimum 2 characters).');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.length < 7) {
      setErrorMessage('Please enter a valid contact/WhatsApp phone number.');
      return;
    }

    const trimmedCity = city.trim();
    if (!trimmedCity || trimmedCity.length < 2) {
      setErrorMessage('Please select or specify your district / town of residence.');
      return;
    }

    const trimmedPortfolio = portfolioUrl.trim();
    if (trimmedPortfolio && !/^https?:\/\//i.test(trimmedPortfolio)) {
      setErrorMessage('Portfolio / CV link must start with http:// or https://');
      return;
    }

    const trimmedPitch = coverLetter.trim();
    if (!trimmedPitch || trimmedPitch.length < 20) {
      setErrorMessage('Please provide a brief statement of interest or background summary (minimum 20 characters).');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          city: trimmedCity,
          job_id: beat.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
          job_title: beat,
          experience_years: experienceYears,
          current_role: currentRole.trim() || undefined,
          portfolio_url: trimmedPortfolio || undefined,
          cover_letter: trimmedPitch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 || data.already_submitted) {
          const rec: SubmittedRecord = {
            submittedAt: new Date().toISOString(),
            email: trimmedEmail,
            fullName: trimmedName,
            refId: data.application_id || 'REGISTERED',
            beat,
            city: trimmedCity,
          };
          setSubmittedRecord(rec);
          return;
        }
        throw new Error(data.error || 'Failed to submit application. Please verify your details.');
      }

      // Success: show confirmation card for this session
      const submissionRecord: SubmittedRecord = {
        submittedAt: new Date().toISOString(),
        email: trimmedEmail,
        fullName: trimmedName,
        refId: data.application_id || `app-${Date.now()}`,
        beat,
        city: trimmedCity,
      };

      setSubmittedRecord(submissionRecord);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while submitting your application.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 relative overflow-hidden py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-64 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[650px] left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10 space-y-5 sm:space-y-6">
        {/* Header Bar */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            <span>2026 Newsroom Application Desk</span>
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
            Apply to Join{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
              {brandName}
            </span>
          </h1>

          <p className="text-xs sm:text-[13px] text-slate-300/90 max-w-lg mx-auto leading-relaxed">
            {brandFullName} invites ground correspondents, investigative journalists, editors, and photographers across Jammu &amp; Kashmir to submit their application dossier.
          </p>
        </div>

        {/* SUBMISSION CONFIRMATION: SHOWN IMMEDIATELY AFTER SUBMITTING */}
        {submittedRecord ? (
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900/90 border-2 border-emerald-500/40 shadow-2xl backdrop-blur-md text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-2xl font-bold shadow-lg shadow-emerald-500/20">
              ✓
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Application Submitted &amp; Logged
              </span>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-white tracking-tight">
                Our team will contact you for further procedure if u qualified
              </h2>
              <p className="text-xs text-slate-300/80 max-w-md mx-auto leading-relaxed font-sans">
                Your dossier has been transmitted directly to the KJCPL Editorial Board in our Newsroom Admin Portal. Each submission is carefully reviewed against our regional reporting beats.
              </p>
            </div>

            {/* Submission Dossier Summary Card */}
            <div className="p-5 rounded-2xl bg-black/50 border border-slate-800 text-left max-w-md mx-auto space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Applicant:</span>
                <span className="font-bold text-white">{submittedRecord.fullName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Registered Email:</span>
                <span className="font-mono text-cyan-300">{submittedRecord.email}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Location:</span>
                <span className="font-bold text-slate-200">{submittedRecord.city}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Beat / Interest:</span>
                <span className="font-bold text-amber-300 truncate max-w-[200px]">{submittedRecord.beat}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Submission ID:</span>
                <span className="font-mono text-slate-400 text-[11px]">{submittedRecord.refId}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                <span>Fill New Application</span>
                <span>✍️</span>
              </button>

              <Link
                href={langPrefix || '/'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
              >
                <span>Return to Homepage</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ) : (
          /* APPLICATION FORM */
          <div className="p-5 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
            <div className="pb-4 mb-5 border-b border-slate-800">
              <h2 className="font-serif text-base sm:text-lg font-bold text-white">
                Official Newsroom Application Form
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Please complete all required fields accurately. Once submitted, your profile will be sent directly to the editorial administration desk for evaluation.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 animate-in fade-in">
                <span className="text-sm leading-none">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Legal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tariq Ahmad Lone"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tariq@example.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone / WhatsApp */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Phone / WhatsApp Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500"
                  />
                </div>

                {/* City / District */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    District / Town of Residence <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="jk-districts-list"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Doda, Bhaderwah, Kishtwar, Poonch..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500"
                  />
                  <datalist id="jk-districts-list">
                    {JK_DISTRICT_SUGGESTIONS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Preferred Beat */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Preferred Beat / Position <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={beat}
                    onChange={(e) => setBeat(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition"
                  >
                    {BEAT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Years of Experience */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Journalism / Writing Experience
                  </label>
                  <select
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition"
                  >
                    <option value="Fresher / Student">Fresher / Student Journalist</option>
                    <option value="1-3 Years">1–3 Years Experience</option>
                    <option value="3-5 Years">3–5 Years Experience</option>
                    <option value="5-10 Years">5–10 Years Experience</option>
                    <option value="Veteran (10+ Years)">Veteran Journalist (10+ Years)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Current Role */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Current Role / Organization (Optional)
                  </label>
                  <input
                    type="text"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    placeholder="e.g. Freelance Reporter, Sub-Editor, Student"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500"
                  />
                </div>

                {/* Portfolio / CV Link */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    CV / Portfolio / Story Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://drive.google.com/... or portfolio link"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Statement of Interest & Story Pitches */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Statement of Interest &amp; Story Pitches <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Describe your journalistic background, ground beats you cover, and 2-3 specific local stories or investigations you would like to report for KJCPL..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition resize-y placeholder-slate-500"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                  <span>Minimum 20 characters required</span>
                  <span>{coverLetter.length} chars</span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  🔒 Submissions are delivered directly to the Chief Editorial Desk in the Newsroom Admin Portal.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Transmitting Dossier...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application</span>
                      <span>🚀</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Minimal Footer Info */}
        <div className="text-center pt-4 text-xs text-slate-500">
          <p>© 2026 {brandFullName} • Directorate of Editorial &amp; Field Operations</p>
          <p className="mt-1">
            General Inquiries:{' '}
            <span className="text-slate-400 font-mono">{careersSettings.contact_email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
