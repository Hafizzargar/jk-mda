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
  page_title: 'Work With Us • Careers at KJIN',
  page_subtitle: 'Join Jammu & Kashmir’s Premier Independent Journal of Record',
  hiring_status: 'open',
  contact_email: 'careers@kjin.org',
  culture_statement:
    'At Kashmir & Jammu Information Network (KJIN), we hold reporting integrity, verified sourcing, and ground public-interest documentation above all else. We are building an authoritative, multilingual editorial team across the Kashmir Valley, Jammu Plains, Chenab Valley, Pir Panjal, and Ladakh.',
  benefits: [
    'Comprehensive field insurance & high-altitude travel allowances',
    'Independent editorial freedom adhering strictly to PCI code of ethics',
    'Bylines credited globally with verified digital archiving & syndication',
    'Modern newsroom tooling: AI-assisted verification radar & secure whistleblowing desks',
    'Equal opportunity employer welcoming diverse voices from every district of J&K',
  ],
  jobs: [
    {
      id: 'job-copy-editor',
      title: 'Senior Copy Editor & Fact-Checker',
      department: 'Editorial',
      role_type: 'Full-time',
      location: 'Srinagar Central Bureau (Hybrid)',
      experience_level: '3-5 Years',
      salary_range: '₹45,000 - ₹65,000 / month',
      description:
        'We are seeking an exacting Senior Copy Editor to oversee English and bilingual newsroom dispatches, ensure strict factual accuracy, verify primary government notices, and maintain stylistic elegance.',
      requirements: [
        'Bachelor’s or Master’s in Journalism, English, Mass Communication, or related field',
        'Minimum 3 years of copy editing experience in a reputable print or digital newspaper',
        'Strong command of English grammar and AP/KJIN broadsheet house style',
        'Working familiarity with regional J&K terminology, geography, and administrative bodies',
      ],
      responsibilities: [
        'Review and line-edit 15-20 daily reports for factual integrity, clarity, and tone',
        'Verify quotes, official gazettes, and public grievance numbers before publication',
        'Collaborate with bureau chiefs and junior reporters on headline framing and SEO metadata',
        'Mentor trainee reporters on journalistic rigor and ethical sourcing',
      ],
      status: 'active',
      featured: true,
      created_at: '2026-10-20T08:00:00.000Z',
    },
    {
      id: 'job-kashmir-reporter',
      title: 'Kashmir Valley Investigative Field Reporter',
      department: 'Reporting',
      role_type: 'Full-time',
      location: 'Srinagar & Central Valley',
      experience_level: '2-4 Years',
      salary_range: '₹40,000 - ₹60,000 / month',
      description:
        'Ground-level investigative journalist responsible for covering civic infrastructure, Dal/Wular conservation, apple horticulture supply chains, and municipal public grievance issues.',
      requirements: [
        'Demonstrated portfolio of published ground reports and investigative features',
        'Fluency in Kashmiri and English; ability to conduct field interviews with diverse stakeholders',
        'Uncompromising dedication to on-the-ground verification and neutral reporting',
        'Valid driving license and willingness to travel across central and north Kashmir districts',
      ],
      responsibilities: [
        'Pitch and produce 3-4 deeply researched in-depth investigative reports per week',
        'Cover breaking civic developments and emergency administrative orders in real time',
        'Cultivate verified contacts across municipal councils, citizen groups, and local bureaus',
        'Provide multimedia field recordings and photo credits for the digital wire',
      ],
      status: 'active',
      featured: true,
      created_at: '2026-10-21T09:30:00.000Z',
    },
    {
      id: 'job-jammu-correspondent',
      title: 'Jammu Plains Bureau Correspondent',
      department: 'Reporting',
      role_type: 'Full-time',
      location: 'Jammu Plains Bureau (Rail Head Complex)',
      experience_level: '2-5 Years',
      salary_range: '₹40,000 - ₹58,000 / month',
      description:
        'Correspondent to lead our coverage from the winter capital, reporting on administrative secretariat directives, commercial trade logistics, highway infrastructure, and border community developments.',
      requirements: [
        '2+ years covering regional governance, judiciary, or commerce in Jammu region',
        'Deep understanding of Jammu, Samba, Kathua, and Shivalik foothill districts',
        'Bilingual proficiency in English and Hindi/Dogri',
        'Ability to file accurate dispatches under tight daily publication deadlines',
      ],
      responsibilities: [
        'File daily dispatches covering high court rulings, secretariat orders, and civic developments',
        'Conduct interviews with trade bodies, transit authorities, and citizen advocacy groups',
        'Coordinate with the Srinagar central desk for seamless provincial syndication',
      ],
      status: 'active',
      featured: false,
      created_at: '2026-10-22T10:00:00.000Z',
    },
    {
      id: 'job-opinion-author',
      title: 'Contributing Author & Long-Form Essayist',
      department: 'Editorial',
      role_type: 'Freelance / Contributor',
      location: 'Remote (J&K / Global)',
      experience_level: 'Published Authors / Scholars',
      salary_range: '₹8,000 - ₹20,000 per long-form dispatch',
      description:
        'We invite thoughtful essayists, historians, environmental scientists, and public policy researchers to write authoritative opinion essays examining contemporary socio-economic transformations in J&K.',
      requirements: [
        'Exceptional prose craftsmanship and demonstrated analytical depth in published work',
        'Domain expertise in Himalayan ecology, regional economics, literature, or constitutional law',
        'Commitment to rigorous evidence-based arguments free of partisan rhetoric',
      ],
      responsibilities: [
        'Produce 1,800 to 3,500 word long-form essays for our Sunday broadsheet edition',
        'Work with our senior editors during peer-review and fact-checking',
        'Participate in occasional digital roundtable webinars with our readership',
      ],
      status: 'active',
      featured: true,
      created_at: '2026-10-23T11:00:00.000Z',
    },
    {
      id: 'job-multilingual-editor',
      title: 'Urdu & Kashmiri Multilingual News Editor',
      department: 'Translation',
      role_type: 'Part-time / Remote',
      location: 'Remote / Hybrid (Srinagar)',
      experience_level: '2+ Years',
      salary_range: '₹30,000 - ₹45,000 / month',
      description:
        'Key role responsible for accurate, high-fidelity translation and stylistic editing of investigative stories from English into Urdu and Kashmiri Naskh/Nastaliq editions.',
      requirements: [
        'Native-level fluency in Urdu, Kashmiri, and English',
        'Proven translation experience in journalism or academic publishing',
        'Knowledge of InPage, Unicode Naskh/Nastaliq digital typography, and RTL layouts',
      ],
      responsibilities: [
        'Translate and adapt lead investigative stories with high cultural precision',
        'Maintain the bilingual terminology dictionary for J&K legal and civic institutions',
        'Proofread digital and print-ready Urdu articles before release',
      ],
      status: 'active',
      featured: false,
      created_at: '2026-10-24T12:00:00.000Z',
    },
  ],
  applications: [],
};

export function sanitizeCareersSettings(raw: unknown): CareersSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_CAREERS_SETTINGS;
  }

  const obj = raw as Record<string, unknown>;

  const jobs: JobPosting[] = Array.isArray(obj.jobs)
    ? obj.jobs.map((item) => {
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
      })
    : DEFAULT_CAREERS_SETTINGS.jobs;

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
    contact_email: typeof obj.contact_email === 'string' && obj.contact_email.trim() ? obj.contact_email.trim().slice(0, 150) : DEFAULT_CAREERS_SETTINGS.contact_email,
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
