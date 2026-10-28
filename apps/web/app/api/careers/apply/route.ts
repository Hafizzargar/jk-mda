import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@kjin/config';
import { readBoundedStream } from '@/lib/request-utils';
import { DEFAULT_CAREERS_SETTINGS, sanitizeCareersSettings, type JobApplication } from '@/lib/careers';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 20000) {
      return NextResponse.json({ error: 'Application payload too large.' }, { status: 413 });
    }

    const streamResult = await readBoundedStream(request, 20000);
    if (streamResult.error) {
      return NextResponse.json({ error: streamResult.error }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(streamResult.text || '{}');
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request format.' }, { status: 400 });
    }

    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : 'Jammu & Kashmir';
    const jobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : 'general';
    const jobTitle = typeof body.job_title === 'string' && body.job_title.trim() ? body.job_title.trim() : 'General Expression of Interest';
    const experienceYears = typeof body.experience_years === 'string' ? body.experience_years.trim() : '1-3 Years';
    const currentRole = typeof body.current_role === 'string' ? body.current_role.trim().slice(0, 120) : undefined;
    const portfolioUrl = typeof body.portfolio_url === 'string' ? body.portfolio_url.trim().slice(0, 500) : undefined;
    const coverLetter = typeof body.cover_letter === 'string' ? body.cover_letter.trim() : '';

    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: 'Please provide your full legal name (2–120 characters).' }, { status: 400 });
    }

    if (!email || !EMAIL_REGEX.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!coverLetter || coverLetter.length < 20) {
      return NextResponse.json(
        { error: 'Please provide a short statement of interest or work experience (minimum 20 characters).' },
        { status: 400 }
      );
    }

    if (portfolioUrl && !/^https?:\/\//i.test(portfolioUrl)) {
      return NextResponse.json(
        { error: 'Portfolio / resume link must be a valid URL starting with http:// or https://' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: settingRow } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'careers_settings')
      .maybeSingle();

    const currentSettings = sanitizeCareersSettings(settingRow?.value || DEFAULT_CAREERS_SETTINGS);

    if (currentSettings.hiring_status === 'paused') {
      return NextResponse.json(
        { error: 'Newsroom applications are currently paused. Please check back later.' },
        { status: 403 }
      );
    }

    const newApplication: JobApplication = {
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      job_id: jobId,
      job_title: jobTitle,
      full_name: fullName,
      email,
      phone: phone.slice(0, 30),
      city: city.slice(0, 100),
      experience_years: experienceYears,
      current_role: currentRole,
      portfolio_url: portfolioUrl,
      cover_letter: coverLetter.slice(0, 6000),
      status: 'new',
      applied_at: new Date().toISOString(),
    };

    // Prepend application so newest appears first
    const updatedApplications = [newApplication, ...currentSettings.applications].slice(0, 500);

    const updatedSettings = {
      ...currentSettings,
      applications: updatedApplications,
    };

    const { error: updateError } = await supabase
      .from('site_settings')
      .upsert({
        key: 'careers_settings',
        value: updatedSettings,
        description: 'Public newspaper careers page, newsroom job openings, and candidate applications',
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('[Careers Application] Failed to save application:', updateError);
      return NextResponse.json({ error: 'Failed to record application. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your application has been submitted to the KJIN editorial desk.',
      application_id: newApplication.id,
    });
  } catch (err) {
    console.error('[Careers Application API] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error processing application.' }, { status: 500 });
  }
}
