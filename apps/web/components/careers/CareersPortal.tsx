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
];

const EXPERIENCE_OPTIONS = [
  'Fresher / Student Journalist',
  '1–3 Years Experience',
  '3–5 Years Experience',
  '5–10 Years Experience',
  'Veteran (10+ Years)',
];

const STORAGE_KEY = 'kjcpl_careers_application_submitted';

interface SubmittedRecord {
  submittedAt: string;
  email: string;
  fullName: string;
  phone: string;
  district: string;
  experience: string;
  refId: string;
  alreadySubmitted?: boolean;
}

interface PopupMessage {
  isOpen: boolean;
  title: string;
  badge: string;
  message: string;
  description: string;
  isAlreadySubmitted: boolean;
}

export function CareersPortal({
  careersSettings,
  brandName,
  brandFullName,
  langPrefix,
}: CareersPortalProps) {
  // Submission record for session view
  const [submittedRecord, setSubmittedRecord] = useState<SubmittedRecord | null>(null);

  // Pop up modal state
  const [popup, setPopup] = useState<PopupMessage>({
    isOpen: false,
    title: '',
    badge: '',
    message: '',
    description: '',
    isAlreadySubmitted: false,
  });

  // Only the required fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Doda');
  const [experience, setExperience] = useState(EXPERIENCE_OPTIONS[0]);
  const [statement, setStatement] = useState('');

  // 0 to 100% Loader & Live Timer State
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submissionClock, setSubmissionClock] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear legacy localStorage flags on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleResetForm = () => {
    setSubmittedRecord(null);
    setPopup({
      isOpen: false,
      title: '',
      badge: '',
      message: '',
      description: '',
      isAlreadySubmitted: false,
    });
    setFullName('');
    setEmail('');
    setPhone('');
    setDistrict('Doda');
    setExperience(EXPERIENCE_OPTIONS[0]);
    setStatement('');
    setErrorMessage(null);
    setProgress(0);
    setElapsedSeconds(0);
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
      setErrorMessage('Please enter a valid contact / WhatsApp phone number.');
      return;
    }

    const trimmedDistrict = district.trim();
    if (!trimmedDistrict || trimmedDistrict.length < 2) {
      setErrorMessage('Please select or specify your district of residence.');
      return;
    }

    const trimmedStatement = statement.trim();
    if (!trimmedStatement || trimmedStatement.length < 20) {
      setErrorMessage('Please provide a brief statement of interest (minimum 20 characters).');
      return;
    }

    // 1. Lock screen and start 0 to 100% progress & live timer
    setSubmitting(true);
    setProgress(0);
    setElapsedSeconds(0);
    setSubmissionClock(new Date().toLocaleTimeString());

    const startTime = Date.now();
    let currentProgress = 0;

    const timerInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedSeconds(elapsed);
      setSubmissionClock(new Date().toLocaleTimeString());

      // Realistic smooth progress pacing toward 92%
      if (currentProgress < 30) {
        currentProgress += 3.5;
      } else if (currentProgress < 65) {
        currentProgress += 2.2;
      } else if (currentProgress < 85) {
        currentProgress += 1.2;
      } else if (currentProgress < 94) {
        currentProgress += 0.4;
      }
      setProgress(Math.min(94, currentProgress));
    }, 60);

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
          city: trimmedDistrict,
          experience_years: experience,
          cover_letter: trimmedStatement,
          job_id: 'ground-reporting',
          job_title: 'Ground Field Reporting & Investigations',
        }),
      });

      const data = await response.json();

      // Jump to 100% immediately when server responds
      setProgress(100);
      clearInterval(timerInterval);

      // Brief 400ms pause so user clearly sees 100% complete
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Smooth scroll to top after submit
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      setSubmitting(false);

      if (!response.ok) {
        if (response.status === 409 || data.already_submitted) {
          // Already submitted case
          const record: SubmittedRecord = {
            submittedAt: new Date().toISOString(),
            email: trimmedEmail,
            fullName: trimmedName,
            phone: trimmedPhone,
            district: trimmedDistrict,
            experience,
            refId: data.application_id || 'REGISTERED',
            alreadySubmitted: true,
          };
          setSubmittedRecord(record);
          setPopup({
            isOpen: true,
            badge: 'APPLICATION ALREADY SUBMITTED',
            title: 'Our team will contact you for further procedure if u qualified',
            message: 'An application with this email has already been submitted and logged in our system.',
            description: 'Your dossier is already active in the Newsroom Editorial Desk. Multiple submissions are not needed.',
            isAlreadySubmitted: true,
          });
          return;
        }
        throw new Error(data.error || 'Failed to submit application. Please verify your details.');
      }

      // Successful first submission
      const record: SubmittedRecord = {
        submittedAt: new Date().toISOString(),
        email: trimmedEmail,
        fullName: trimmedName,
        phone: trimmedPhone,
        district: trimmedDistrict,
        experience,
        refId: data.application_id || `app-${Date.now()}`,
        alreadySubmitted: false,
      };
      setSubmittedRecord(record);
      setPopup({
        isOpen: true,
        badge: 'APPLICATION SUBMITTED & LOGGED',
        title: 'Our team will contact you for further procedure if u qualified',
        message: 'Your dossier has been transmitted directly to the KJCPL Editorial Board.',
        description: 'Each submission is carefully evaluated against our regional reporting beats across Jammu & Kashmir.',
        isAlreadySubmitted: false,
      });
    } catch (err: unknown) {
      clearInterval(timerInterval);
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : 'An error occurred while submitting your application.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 relative overflow-hidden py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-64 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* 1. FULLSCREEN BLOCKING 0 TO 100% LOADER WITH LIVE TIME DISPLAY */}
      {submitting && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-wait animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl shadow-amber-500/10 animate-in zoom-in-95 duration-200">
            {/* Top Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>TRANSMITTING DOSSIER</span>
            </div>

            {/* Giant 0 to 100% Percentage */}
            <div className="space-y-1">
              <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight bg-gradient-to-r from-amber-400 via-orange-300 to-emerald-400 bg-clip-text text-transparent">
                {Math.min(100, Math.round(progress))}%
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {progress < 30 && '🔒 Compiling and encrypting application dossier...'}
                {progress >= 30 && progress < 70 && '📡 Transmitting to KJCPL Editorial Administration...'}
                {progress >= 70 && progress < 100 && '📋 Registering dossier with Newsroom Board...'}
                {progress >= 100 && '✓ Transmission complete! Redirecting...'}
              </p>
            </div>

            {/* 0 to 100% Glowing Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 p-0.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 transition-all duration-100 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                style={{ width: `${Math.min(100, Math.max(3, progress))}%` }}
              />
            </div>

            {/* Live Time Display */}
            <div className="p-3 rounded-xl bg-black/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-amber-400">⏱️</span>
                <span>Time Elapsed:</span>
                <span className="font-bold text-amber-300">{elapsedSeconds.toFixed(1)}s</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                <span>Clock: </span>
                <span className="text-slate-200">{submissionClock}</span>
              </div>
            </div>

            {/* Security Guarantee Notice */}
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Screen is locked while transmitting. Please do not refresh or close this tab.
            </p>
          </div>
        </div>
      )}

      {/* 2. POP UP MESSAGE AFTER SUBMIT (ALREADY SUBMITTED OR SUCCESS) */}
      {popup.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl sm:rounded-3xl p-6 sm:p-7 max-w-md w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div
              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold shadow-lg ${
                popup.isAlreadySubmitted
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/20'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/20'
              }`}
            >
              {popup.isAlreadySubmitted ? 'ℹ' : '✓'}
            </div>

            <div className="space-y-2">
              <span
                className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  popup.isAlreadySubmitted
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {popup.badge}
              </span>

              <h2 className="font-serif text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                {popup.title}
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed font-sans px-2">
                {popup.message}
              </p>
              <p className="text-[11px] text-slate-400 leading-normal font-sans px-2">
                {popup.description}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPopup({ ...popup, isOpen: false })}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Understood / View Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-xl mx-auto relative z-10 space-y-5">
        {/* Header Bar */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            <span>2026 Newsroom Application Desk</span>
          </div>

          <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
            Apply to Join{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
              {brandName}
            </span>
          </h1>

          <p className="text-[11px] sm:text-xs text-slate-300/85 max-w-md mx-auto leading-normal px-2">
            {brandFullName} invites ground correspondents, investigative journalists, editors, and photographers across Jammu &amp; Kashmir to submit their application dossier.
          </p>
        </div>

        {/* SUBMISSION CONFIRMATION: SHOWN IMMEDIATELY AT TOP AFTER SUBMITTING */}
        {submittedRecord ? (
          <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/90 border-2 border-emerald-500/40 shadow-2xl backdrop-blur-md text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xl font-bold shadow-lg shadow-emerald-500/20">
              ✓
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Application Submitted &amp; Logged
              </span>
              <h2 className="font-serif text-base sm:text-lg font-bold text-white tracking-tight">
                Our team will contact you for further procedure if u qualified
              </h2>
              <p className="text-xs text-slate-300/80 max-w-md mx-auto leading-relaxed font-sans">
                Your dossier has been transmitted directly to the KJCPL Editorial Board in our Newsroom Admin Portal. Each submission is carefully reviewed against our regional reporting beats.
              </p>
            </div>

            {/* Submission Dossier Summary Card */}
            <div className="p-4 rounded-xl bg-black/50 border border-slate-800 text-left max-w-md mx-auto space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Applicant:</span>
                <span className="font-bold text-white">{submittedRecord.fullName}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-cyan-300">{submittedRecord.email}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Phone:</span>
                <span className="font-bold text-slate-200">{submittedRecord.phone}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">District:</span>
                <span className="font-bold text-slate-200">{submittedRecord.district}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Experience:</span>
                <span className="font-bold text-amber-300">{submittedRecord.experience}</span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-400">Submission ID:</span>
                <span className="font-mono text-slate-400 text-[11px]">{submittedRecord.refId}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                <span>Fill New Application</span>
                <span>✍️</span>
              </button>

              <Link
                href={langPrefix || '/'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
              >
                <span>Return to Homepage</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ) : (
          /* SMALL COMPACT APPLICATION FORM: ONLY THE 6 REQUIRED FIELDS */
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
            <div className="pb-3 mb-4 border-b border-slate-800">
              <h2 className="font-serif text-base sm:text-lg font-bold text-white">
                Official Newsroom Application Form
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Please complete all required fields accurately. Once submitted, your profile will be sent directly to the editorial administration desk for evaluation.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 animate-in fade-in">
                <span className="text-sm leading-none">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Full Legal Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Legal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tariq Ahmad Lone"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500 disabled:opacity-50"
                  />
                </div>

                {/* 2. Email Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={submitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tariq@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 3. Phone / WhatsApp */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Phone / WhatsApp Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    disabled={submitting}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500 disabled:opacity-50"
                  />
                </div>

                {/* 4. District */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    District <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    list="jk-districts-list"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Doda, Kishtwar, Bhaderwah..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition placeholder-slate-500 disabled:opacity-50"
                  />
                  <datalist id="jk-districts-list">
                    {JK_DISTRICT_SUGGESTIONS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 5. Experience */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Experience <span className="text-red-400">*</span>
                </label>
                <select
                  disabled={submitting}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition disabled:opacity-50"
                >
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Statement of Interest */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Statement of Interest <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  disabled={submitting}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="Describe your journalistic background, ground beats you cover, and local stories you would like to report for KJCPL..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-amber-500 text-xs text-white outline-none transition resize-y placeholder-slate-500 disabled:opacity-50"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                  <span>Minimum 20 characters required</span>
                  <span>{statement.length} chars</span>
                </div>
              </div>

              {/* Submit Action Row */}
              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[10px] text-slate-400">
                  🔒 Dossiers are transmitted directly to the Newsroom Admin Desk.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Transmitting ({Math.round(progress)}%)...</span>
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
        <div className="text-center pt-2 text-[11px] text-slate-500">
          <p>© 2026 {brandFullName} • Directorate of Editorial &amp; Field Operations</p>
          <p className="mt-0.5">
            General Inquiries:{' '}
            <span className="text-slate-400 font-mono">{careersSettings.contact_email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
