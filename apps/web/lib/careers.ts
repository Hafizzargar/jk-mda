import type { SupabaseClient } from '@supabase/supabase-js';

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  role_type: string;
  location: string;
  experience_level: string;
  salary_range?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  status: 'active' | 'closed' | 'draft';
  featured?: boolean;
  created_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  job_title: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  experience_years: string;
  current_role?: string;
  portfolio_url?: string;
  cover_letter: string;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired';
  admin_notes?: string;
  applied_at: string;
}

export interface CareersSettings {
  page_title: string;
  page_subtitle: string;
  hiring_status: 'open' | 'paused';
  contact_email: string;
  culture_statement: string;
  benefits: string[];
  jobs: JobPosting[];
  applications: JobApplication[];
}

export const DEFAULT_CAREERS_SETTINGS: CareersSettings = {
  page_title: 'Work With Us • Careers at KJCPL',
  page_subtitle: 'Join Jammu & Kashmir’s Premier Independent Journal of Record',
  hiring_status: 'open',
  contact_email: 'h26412301@gmail.com',
  culture_statement:
    'At KJCPL News Network (KJCPL), we hold reporting integrity, verified sourcing, and ground public-interest documentation above all else. We are building an authoritative, multilingual editorial team across the Kashmir Valley, Jammu Plains, Chenab Valley, Pir Panjal, and Ladakh.',
  benefits: [
    'Comprehensive field insurance & high-altitude travel allowances',
    'Independent editorial freedom adhering strictly to PCI code of ethics',
    'Bylines credited globally with verified digital archiving & syndication',
    'Modern newsroom tooling: AI-assisted verification radar & secure whistleblowing desks',
    'Equal opportunity employer welcoming diverse voices from every district of J&K',
  ],
  jobs: [],
  applications: [],
};

export function sanitizeCareersSettings(raw: unknown): CareersSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_CAREERS_SETTINGS;
  }

  const obj = raw as Record<string, unknown>;

  const rawJobs = Array.isArray(obj.jobs)
    ? obj.jobs
    : [];

  const jobs: JobPosting[] = rawJobs.map((item) => {
        const j = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const validStatus = ['active', 'closed', 'draft'].includes(String(j.status))
          ? (j.status as 'active' | 'closed' | 'draft')
          : 'active';

        return {
          id: typeof j.id === 'string' && j.id.trim() ? j.id.trim().slice(0, 80) : `job-${Date.now()}`,
          title: typeof j.title === 'string' && j.title.trim() ? j.title.trim().slice(0, 150) : 'Untitled Role',
          department: typeof j.department === 'string' && j.department.trim() ? j.department.trim().slice(0, 60) : 'Editorial',
          role_type: typeof j.role_type === 'string' && j.role_type.trim() ? j.role_type.trim().slice(0, 60) : 'Full-time',
          location: typeof j.location === 'string' && j.location.trim() ? j.location.trim().slice(0, 100) : 'Srinagar / Hybrid',
          experience_level: typeof j.experience_level === 'string' && j.experience_level.trim() ? j.experience_level.trim().slice(0, 80) : '2+ Years',
          salary_range: typeof j.salary_range === 'string' ? j.salary_range.trim().slice(0, 100) : undefined,
          description: typeof j.description === 'string' ? j.description.trim().slice(0, 4000) : '',
          requirements: Array.isArray(j.requirements)
            ? j.requirements.map((r) => String(r || '').trim().slice(0, 300)).filter(Boolean)
            : [],
          responsibilities: Array.isArray(j.responsibilities)
            ? j.responsibilities.map((r) => String(r || '').trim().slice(0, 300)).filter(Boolean)
            : [],
          status: validStatus,
          featured: Boolean(j.featured),
          created_at: typeof j.created_at === 'string' && j.created_at ? j.created_at : new Date().toISOString(),
        };
      });

  const applications: JobApplication[] = Array.isArray(obj.applications)
    ? obj.applications.map((item) => {
        const a = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const validStatus = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'].includes(String(a.status))
          ? (a.status as 'new' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired')
          : 'new';

        return {
          id: typeof a.id === 'string' && a.id.trim() ? a.id.trim().slice(0, 80) : `app-${Date.now()}`,
          job_id: typeof a.job_id === 'string' && a.job_id.trim() ? a.job_id.trim().slice(0, 80) : 'general',
          job_title: typeof a.job_title === 'string' && a.job_title.trim() ? a.job_title.trim().slice(0, 150) : 'General Expression of Interest',
          full_name: typeof a.full_name === 'string' && a.full_name.trim() ? a.full_name.trim().slice(0, 120) : 'Anonymous Applicant',
          email: typeof a.email === 'string' && a.email.trim() ? a.email.trim().toLowerCase().slice(0, 150) : '',
          phone: typeof a.phone === 'string' ? a.phone.trim().slice(0, 30) : '',
          city: typeof a.city === 'string' && a.city.trim() ? a.city.trim().slice(0, 100) : 'Jammu & Kashmir',
          experience_years: typeof a.experience_years === 'string' && a.experience_years.trim() ? a.experience_years.trim().slice(0, 40) : '1-3 Years',
          current_role: typeof a.current_role === 'string' ? a.current_role.trim().slice(0, 120) : undefined,
          portfolio_url: typeof a.portfolio_url === 'string' && a.portfolio_url.trim() ? a.portfolio_url.trim().slice(0, 500) : undefined,
          cover_letter: typeof a.cover_letter === 'string' ? a.cover_letter.trim().slice(0, 6000) : '',
          status: validStatus,
          admin_notes: typeof a.admin_notes === 'string' ? a.admin_notes.trim().slice(0, 2000) : undefined,
          applied_at: typeof a.applied_at === 'string' && a.applied_at ? a.applied_at : new Date().toISOString(),
        };
      })
    : [];

  const hiring_status = obj.hiring_status === 'paused' ? 'paused' : 'open';

  return {
    page_title: typeof obj.page_title === 'string' && obj.page_title.trim() ? obj.page_title.trim().slice(0, 150) : DEFAULT_CAREERS_SETTINGS.page_title,
    page_subtitle: typeof obj.page_subtitle === 'string' && obj.page_subtitle.trim() ? obj.page_subtitle.trim().slice(0, 200) : DEFAULT_CAREERS_SETTINGS.page_subtitle,
    hiring_status,
    contact_email: typeof obj.contact_email === 'string' &&
      obj.contact_email.trim() &&
      !obj.contact_email.toLowerCase().includes('@kjcpl.site') &&
      !obj.contact_email.toLowerCase().includes('@kjin.org') &&
      !obj.contact_email.toLowerCase().includes('@kjin.in')
      ? obj.contact_email.trim().slice(0, 150)
      : 'h26412301@gmail.com',
    culture_statement: typeof obj.culture_statement === 'string' && obj.culture_statement.trim() ? obj.culture_statement.trim().slice(0, 1500) : DEFAULT_CAREERS_SETTINGS.culture_statement,
    benefits: Array.isArray(obj.benefits)
      ? obj.benefits.map((b) => String(b || '').trim().slice(0, 300)).filter(Boolean)
      : DEFAULT_CAREERS_SETTINGS.benefits,
    jobs,
    applications,
  };
}

export async function getCareersSettings(supabase: SupabaseClient): Promise<CareersSettings> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'careers_settings')
      .maybeSingle();

    if (data?.value) {
      return sanitizeCareersSettings(data.value);
    }
  } catch (err) {
    console.warn('[getCareersSettings] Falling back to default careers settings:', err);
  }
  return DEFAULT_CAREERS_SETTINGS;
}
