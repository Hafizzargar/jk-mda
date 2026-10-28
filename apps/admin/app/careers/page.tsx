'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import {
  DEFAULT_CAREERS_SETTINGS,
  type CareersSettings,
  type JobPosting,
  type JobApplication,
} from '@/lib/careers';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

export default function CareersAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [activeTab, setActiveTab] = useState<'jobs' | 'applications' | 'settings'>('jobs');
  const [careers, setCareers] = useState<CareersSettings>(DEFAULT_CAREERS_SETTINGS);

  // Filter state for Applications
  const [appStatusFilter, setAppStatusFilter] = useState<string>('all');
  const [appJobFilter, setAppJobFilter] = useState<string>('all');
  const [appSearch, setAppSearch] = useState<string>('');

  // Editing / Creating Job Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    department: 'Editorial',
    role_type: 'Full-time',
    location: 'Srinagar Central Bureau (Hybrid)',
    experience_level: '2-4 Years',
    salary_range: '',
    description: '',
    requirements: '',
    responsibilities: '',
    status: 'active' as 'active' | 'closed' | 'draft',
    featured: false,
  });

  // Selected candidate for detailed view drawer
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [editingNote, setEditingNote] = useState<string>('');
  const [quickEmail, setQuickEmail] = useState<string>('careers@kjin.org');
  const [jobVisibilityFilter, setJobVisibilityFilter] = useState<'all' | 'active' | 'paused'>('all');

  useEffect(() => {
    async function loadCareers() {
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

        if (!profile || profile.status !== 'active') {
          router.push('/login');
          return;
        }

        const role = profile.role_key;
        if (!['owner', 'superadmin', 'admin', 'editor'].includes(role)) {
          router.push('/');
          return;
        }

        if (requiresMfa(role)) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.currentLevel !== 'aal2') {
            router.push('/mfa/challenge');
            return;
          }
        }

        const token = sessionData.session.access_token;
        const res = await fetch('/api/careers', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.careers_settings) {
            setCareers(json.careers_settings);
            setQuickEmail(json.careers_settings.contact_email || 'careers@kjin.org');
          }
          setCanManage(Boolean(json.can_manage));
        } else {
          setCanManage(['owner', 'superadmin', 'admin', 'editor'].includes(role));
        }
      } catch (err) {
        console.error('Failed to load careers configuration:', err);
        toast.error('Failed to load careers settings from server.');
      } finally {
        setLoading(false);
      }
    }

    loadCareers();
  }, [router]);

  // Persist careers configuration to server
  const saveCareersToServer = async (
    updated: CareersSettings,
    successMessage: string = 'Careers settings updated successfully.'
  ) => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/careers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updated),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update careers.');
      }

      setCareers(data.careers_settings);
      toast.success(successMessage);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating careers configuration.';
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Open Create Job Modal
  const handleOpenCreateJob = () => {
    setEditingJob(null);
    setJobForm({
      title: '',
      department: 'Editorial',
      role_type: 'Full-time',
      location: 'Srinagar Central Bureau (Hybrid)',
      experience_level: '2-4 Years',
      salary_range: '₹40,000 - ₹60,000 / month',
      description: '',
      requirements: '',
      responsibilities: '',
      status: 'active',
      featured: false,
    });
    setIsJobModalOpen(true);
  };

  // Open Edit Job Modal
  const handleOpenEditJob = (job: JobPosting) => {
    setEditingJob(job);
    setJobForm({
      title: job.title,
      department: job.department,
      role_type: job.role_type,
      location: job.location,
      experience_level: job.experience_level,
      salary_range: job.salary_range || '',
      description: job.description,
      requirements: job.requirements.join('\n'),
      responsibilities: job.responsibilities.join('\n'),
      status: job.status,
      featured: Boolean(job.featured),
    });
    setIsJobModalOpen(true);
  };

  // Submit Job Save (Create / Update)
  const handleSaveJob = async (e: FormEvent) => {
    e.preventDefault();
    if (!jobForm.title.trim()) {
      toast.error('Job title is required.');
      return;
    }

    const requirementsArr = jobForm.requirements
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);

    const responsibilitiesArr = jobForm.responsibilities
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);

    let updatedJobs: JobPosting[];
    if (editingJob) {
      updatedJobs = careers.jobs.map((j) => {
        if (j.id === editingJob.id) {
          return {
            ...j,
            title: jobForm.title.trim(),
            department: jobForm.department,
            role_type: jobForm.role_type,
            location: jobForm.location.trim(),
            experience_level: jobForm.experience_level.trim(),
            salary_range: jobForm.salary_range.trim() || undefined,
            description: jobForm.description.trim(),
            requirements: requirementsArr,
            responsibilities: responsibilitiesArr,
            status: jobForm.status,
            featured: jobForm.featured,
          };
        }
        return j;
      });
    } else {
      const newJob: JobPosting = {
        id: `job-${Date.now()}`,
        title: jobForm.title.trim(),
        department: jobForm.department,
        role_type: jobForm.role_type,
        location: jobForm.location.trim(),
        experience_level: jobForm.experience_level.trim(),
        salary_range: jobForm.salary_range.trim() || undefined,
        description: jobForm.description.trim(),
        requirements: requirementsArr,
        responsibilities: responsibilitiesArr,
        status: jobForm.status,
        featured: jobForm.featured,
        created_at: new Date().toISOString(),
      };
      updatedJobs = [newJob, ...careers.jobs];
    }

    const updatedSettings: CareersSettings = {
      ...careers,
      jobs: updatedJobs,
    };

    const success = await saveCareersToServer(
      updatedSettings,
      editingJob ? 'Job posting updated.' : 'New job posting published.'
    );
    if (success) {
      setIsJobModalOpen(false);
    }
  };

  // Toggle Job Status (active <-> closed)
  const handleToggleJobStatus = async (jobId: string) => {
    const updatedJobs = careers.jobs.map((j) => {
      if (j.id === jobId) {
        return {
          ...j,
          status: j.status === 'active' ? ('closed' as const) : ('active' as const),
        };
      }
      return j;
    });

    await saveCareersToServer({ ...careers, jobs: updatedJobs }, 'Job status toggled.');
  };

  // Delete Job Posting
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job posting? Past applications will still be preserved.')) {
      return;
    }

    const updatedJobs = careers.jobs.filter((j) => j.id !== jobId);
    await saveCareersToServer({ ...careers, jobs: updatedJobs }, 'Job posting deleted.');
  };

  // Update Candidate Application Status
  const handleUpdateAppStatus = async (appId: string, nextStatus: JobApplication['status']) => {
    const updatedApps = careers.applications.map((app) => {
      if (app.id === appId) {
        return { ...app, status: nextStatus };
      }
      return app;
    });

    const success = await saveCareersToServer(
      { ...careers, applications: updatedApps },
      `Applicant marked as ${nextStatus}.`
    );
    if (success && selectedApp && selectedApp.id === appId) {
      setSelectedApp({ ...selectedApp, status: nextStatus });
    }
  };

  // Save Candidate Notes
  const handleSaveAppNotes = async (appId: string) => {
    const updatedApps = careers.applications.map((app) => {
      if (app.id === appId) {
        return { ...app, admin_notes: editingNote.trim() };
      }
      return app;
    });

    const success = await saveCareersToServer(
      { ...careers, applications: updatedApps },
      'Applicant review note saved.'
    );
    if (success && selectedApp && selectedApp.id === appId) {
      setSelectedApp({ ...selectedApp, admin_notes: editingNote.trim() });
    }
  };

  // Open Application Drawer
  const handleOpenAppDetails = (app: JobApplication) => {
    setSelectedApp(app);
    setEditingNote(app.admin_notes || '');
  };

  // Quick Save Application / Resume Email
  const handleSaveQuickEmail = async () => {
    const trimmed = quickEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    const updated = {
      ...careers,
      contact_email: trimmed,
    };
    const success = await saveCareersToServer(
      updated,
      `Hiring and resume email updated to ${trimmed}`
    );
    if (success) {
      setCareers(updated);
    }
  };

  // Save Settings Tab
  const handleSaveSettingsTab = async (e: FormEvent) => {
    e.preventDefault();
    const success = await saveCareersToServer(careers, 'Careers page settings saved.');
    if (success) {
      setQuickEmail(careers.contact_email);
    }
  };

  // Filtered Applications list
  const filteredApps = careers.applications.filter((app) => {
    const matchStatus = appStatusFilter === 'all' || app.status === appStatusFilter;
    const matchJob = appJobFilter === 'all' || app.job_id === appJobFilter;
    const matchSearch =
      appSearch.trim() === '' ||
      app.full_name.toLowerCase().includes(appSearch.toLowerCase()) ||
      app.email.toLowerCase().includes(appSearch.toLowerCase()) ||
      app.city.toLowerCase().includes(appSearch.toLowerCase()) ||
      app.job_title.toLowerCase().includes(appSearch.toLowerCase());
    return matchStatus && matchJob && matchSearch;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading newsroom careers portal...</p>
        </div>
      </div>
    );
  }

  const activeJobsCount = careers.jobs.filter((j) => j.status === 'active').length;
  const newAppsCount = careers.applications.filter((a) => a.status === 'new').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Careers & Hiring</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>💼</span>
            <span>Careers & Newsroom Hiring</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Post newsroom job openings, hire reporters and editors, review candidate portfolios, and manage public application settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="http://localhost:3000/careers"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
          >
            <span>Preview Public Page</span>
            <span>↗</span>
          </a>
          {canManage && activeTab === 'jobs' && (
            <Button onClick={handleOpenCreateJob} variant="primary" className="text-xs py-2">
              <span>+ Post New Job</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Openings</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{careers.jobs.length}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            {activeJobsCount} Active on Website
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Candidate Applications</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{careers.applications.length}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across 5 regional corridors
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">New Submissions</div>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">{newAppsCount}</div>
          <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium mt-1">
            Pending editorial review
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Newsroom Status</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                careers.hiring_status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="capitalize">{careers.hiring_status}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {careers.contact_email}
          </div>
        </div>
      </div>

      {/* 2b. Quick Hiring Email Control Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-50 via-white to-slate-50 dark:from-cyan-950/20 dark:via-slate-900 dark:to-slate-900 border border-cyan-200 dark:border-cyan-800/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl">📧</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Hiring & Resume Receiving Email
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Connected to Public Website
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Candidates applying on <a href="http://localhost:3000/careers" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 underline font-medium">http://localhost:3000/careers</a> will be instructed to email their CV & resume to this address. Update or change it here anytime.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="email"
              value={quickEmail}
              onChange={(e) => setQuickEmail(e.target.value)}
              placeholder="e.g. careers@kjin.org"
              className="px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[240px] sm:min-w-[280px]"
            />
            {canManage && (
              <button
                type="button"
                onClick={handleSaveQuickEmail}
                disabled={saving || !quickEmail.trim() || quickEmail.trim() === careers.contact_email}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {saving ? 'Updating...' : 'Save Email'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Section Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'jobs'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <span>📰 Job Postings & Vacancies</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {careers.jobs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'applications'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <span>👥 Candidate Submissions</span>
          {newAppsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 font-bold">
              {newAppsCount} new
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'settings'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <span>⚙️ Page & Culture Settings</span>
        </button>
      </div>

      {/* 4. Tab Content */}

      {/* TAB 1: JOB POSTINGS */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Newsroom Vacancies ({activeJobsCount} Active on Website / {careers.jobs.length} Total)
              </h2>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Only active vacancies appear on the public website. Paused vacancies are hidden from readers.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setJobVisibilityFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  jobVisibilityFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-stone-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-stone-200'
                }`}
              >
                All ({careers.jobs.length})
              </button>
              <button
                type="button"
                onClick={() => setJobVisibilityFilter('active')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  jobVisibilityFilter === 'active'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-stone-200'
                }`}
              >
                Active on Site ({activeJobsCount})
              </button>
              <button
                type="button"
                onClick={() => setJobVisibilityFilter('paused')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  jobVisibilityFilter === 'paused'
                    ? 'bg-slate-700 text-white'
                    : 'bg-stone-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-stone-200'
                }`}
              >
                Paused / Hidden ({careers.jobs.length - activeJobsCount})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {careers.jobs
              .filter((j) => {
                if (jobVisibilityFilter === 'active') return j.status === 'active';
                if (jobVisibilityFilter === 'paused') return j.status !== 'active';
                return true;
              })
              .map((job) => {
                const jobApps = careers.applications.filter((a) => a.job_id === job.id);
                const isActive = job.status === 'active';

                return (
                  <div
                    key={job.id}
                    className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${
                      isActive
                        ? 'border-emerald-300/70 dark:border-emerald-500/30 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 opacity-90'
                    } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isActive ? (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live on Website
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Hidden / Paused
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300">
                          {job.department}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {job.role_type}
                        </span>
                        {job.featured && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                            ★ Priority Role
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {job.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>📍 {job.location}</span>
                        <span>•</span>
                        <span>⏱️ {job.experience_level}</span>
                        {job.salary_range && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              💼 {job.salary_range}
                            </span>
                          </>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-3xl">
                        {job.description}
                      </p>
                    </div>

                    {/* Actions & Applicant Count */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setAppJobFilter(job.id);
                          setActiveTab('applications');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-100 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <span>👥 {jobApps.length} Applicants</span>
                      </button>

                      {canManage && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleJobStatus(job.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              isActive
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                            }`}
                          >
                            {isActive ? 'Hide from Site' : '✓ Publish to Site'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditJob(job)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            title="Delete vacancy"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATE APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
              {['all', 'new', 'reviewing', 'shortlisted', 'hired', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setAppStatusFilter(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition ${
                    appStatusFilter === st
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={appJobFilter}
                onChange={(e) => setAppJobFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
              >
                <option value="all">All Roles & Pitches</option>
                <option value="general">General Expressions of Interest</option>
                {careers.jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search candidates..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none w-48"
              />
            </div>
          </div>

          {/* Applications Listing */}
          {filteredApps.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <p className="text-3xl mb-2">📬</p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No applications match this filter</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Candidate submissions from the public website will appear here for editorial review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredApps.map((app) => {
                const statusColors: Record<string, string> = {
                  new: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300',
                  reviewing: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
                  shortlisted: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
                  hired: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
                  rejected: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                };

                return (
                  <div
                    key={app.id}
                    onClick={() => handleOpenAppDetails(app)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-cyan-500 dark:hover:border-cyan-500/50 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusColors[app.status] || ''}`}>
                          {app.status}
                        </span>
                        <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                          {app.job_title}
                        </span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="text-xs text-slate-500">
                          Applied {new Date(app.applied_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {app.full_name}
                        </h3>
                        {app.city && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({app.city})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>📧 {app.email}</span>
                        {app.phone && <span>• 📞 {app.phone}</span>}
                        <span>• ⏱️ {app.experience_years}</span>
                        {app.current_role && <span>• 🏢 {app.current_role}</span>}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pt-1">
                        {app.cover_letter}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {app.portfolio_url && (
                        <a
                          href={app.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 flex items-center gap-1"
                        >
                          <span>Portfolio</span>
                          <span>↗</span>
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAppDetails(app);
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CAREERS PAGE SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettingsTab} className="space-y-6 max-w-4xl">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Public Page Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Page Title
                </label>
                <input
                  type="text"
                  value={careers.page_title}
                  onChange={(e) => setCareers({ ...careers, page_title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Public Contact Email
                </label>
                <input
                  type="email"
                  value={careers.contact_email}
                  onChange={(e) => setCareers({ ...careers, contact_email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Page Subtitle / Tagline
              </label>
              <input
                type="text"
                value={careers.page_subtitle}
                onChange={(e) => setCareers({ ...careers, page_subtitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Newsroom Hiring Status
              </label>
              <div className="flex gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hiring_status"
                    checked={careers.hiring_status === 'open'}
                    onChange={() => setCareers({ ...careers, hiring_status: 'open' })}
                    className="text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    🟢 Open (Accepting new candidate applications)
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hiring_status"
                    checked={careers.hiring_status === 'paused'}
                    onChange={() => setCareers({ ...careers, hiring_status: 'paused' })}
                    className="text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ⏸️ Paused (Displays paused notice to public)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Newsroom Mission & Culture Statement
              </label>
              <textarea
                rows={4}
                value={careers.culture_statement}
                onChange={(e) => setCareers({ ...careers, culture_statement: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving} variant="primary" className="text-xs py-2">
                {saving ? 'Saving Settings...' : 'Save Careers Page Settings'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* 5. MODAL: Create / Edit Job Posting */}
      {isJobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
            <button
              onClick={() => setIsJobModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-8 h-8 rounded-full flex items-center justify-center bg-stone-100 dark:bg-slate-800 text-sm"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingJob ? 'Edit Newsroom Job' : 'Post New Job Position'}
            </h3>

            <form onSubmit={handleSaveJob} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Job Role Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Copy Editor & Fact-Checker"
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={jobForm.department}
                    onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="Editorial">Editorial</option>
                    <option value="Reporting">Reporting & Newsdesk</option>
                    <option value="Investigation">Investigative Bureau</option>
                    <option value="Translation">Translation & Languages</option>
                    <option value="Multimedia">Photography & Multimedia</option>
                    <option value="Technology">Technology & Digital</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Role Type
                  </label>
                  <select
                    value={jobForm.role_type}
                    onChange={(e) => setJobForm({ ...jobForm, role_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Freelance / Contributor">Freelance / Contributor</option>
                    <option value="Fellowship / Internship">Fellowship / Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bureau / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Srinagar Central Bureau (Hybrid)"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                  >
                  </input>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Experience Level
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2–4 Years / Senior"
                    value={jobForm.experience_level}
                    onChange={(e) => setJobForm({ ...jobForm, experience_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Salary / Honorarium (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹45,000 - ₹65,000 / month"
                    value={jobForm.salary_range}
                    onChange={(e) => setJobForm({ ...jobForm, salary_range: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Publication Status
                  </label>
                  <select
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value as 'active' | 'closed' | 'draft' })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="active">Active (Visible on public site)</option>
                    <option value="closed">Closed (Hidden from public site)</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Role Overview & Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Summary of what this role entails..."
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Key Responsibilities (One per line)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Review daily ground dispatches&#10;Verify government circulars&#10;Coordinate with bureau chiefs"
                    value={jobForm.responsibilities}
                    onChange={(e) => setJobForm({ ...jobForm, responsibilities: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Qualifications & Requirements (One per line)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Bachelor's in Journalism&#10;Fluency in English & Urdu/Kashmiri&#10;3+ years newsroom experience"
                    value={jobForm.requirements}
                    onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jobForm.featured}
                    onChange={(e) => setJobForm({ ...jobForm, featured: e.target.checked })}
                    className="rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mark as Priority / Featured Role ★
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsJobModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <Button type="submit" disabled={saving} variant="primary" className="text-xs py-2">
                    {saving ? 'Saving Job...' : editingJob ? 'Update Job' : 'Publish Job'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DRAWER / MODAL: Candidate Application Review */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            <button
              onClick={() => setSelectedApp(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-8 h-8 rounded-full flex items-center justify-center bg-stone-100 dark:bg-slate-800 text-sm"
            >
              ✕
            </button>

            {/* Candidate Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Candidate Dossier
                </span>
                <span>•</span>
                <span className="text-xs text-slate-400">
                  Applied {new Date(selectedApp.applied_at).toLocaleString()}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {selectedApp.full_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Role Applied: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedApp.job_title}</span>
              </p>
            </div>

            {/* Status Selector Bar */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Editorial Review Status:
              </span>
              <div className="flex flex-wrap gap-2">
                {(['new', 'reviewing', 'shortlisted', 'hired', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateAppStatus(selectedApp.id, st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                      selectedApp.status === st
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-stone-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {selectedApp.email}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {selectedApp.phone || 'Not provided'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">City / Location</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {selectedApp.city}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Experience</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {selectedApp.experience_years}
                </span>
              </div>
            </div>

            {/* Portfolio Link Banner */}
            {selectedApp.portfolio_url && (
              <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-400 block">
                    Portfolio / Published Clips Link
                  </span>
                  <span className="text-xs font-mono text-cyan-900 dark:text-cyan-200 truncate max-w-md block">
                    {selectedApp.portfolio_url}
                  </span>
                </div>
                <a
                  href={selectedApp.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
                >
                  Open Clips ↗
                </a>
              </div>
            )}

            {/* Cover Letter / Statement */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cover Note & Work Experience Statement
              </h4>
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {selectedApp.cover_letter}
              </div>
            </div>

            {/* Admin Internal Review Notes */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Internal Editorial Notes
                </h4>
                <button
                  onClick={() => handleSaveAppNotes(selectedApp.id)}
                  disabled={saving}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Note'}
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="Write internal notes about this candidate (e.g. 'Strong ground clips on Chenab hydrology; scheduled interview for Thursday')..."
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
