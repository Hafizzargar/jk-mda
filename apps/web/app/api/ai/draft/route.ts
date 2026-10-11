import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { readBoundedStream } from '../../../../lib/request-utils';
import { sanitizeArticleHtml } from '../../../../lib/sanitize';
import * as Sentry from '@sentry/nextjs';

import { getCustomDraftGenerator } from '../../../../lib/ai-provider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DraftRequestSchema = z.object({
  rawFacts: z.string().min(10, 'Input must be at least 10 characters').max(15000, 'Input too long'),
});

export async function POST(request: Request) {
  try {
    const customDraftGenerator = getCustomDraftGenerator();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase configuration in AI draft route');
      return NextResponse.json({ error: 'AI service configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Authorize user (article.create permission)
    const { data: hasPerm } = await supabase.rpc('has_permission', { p_permission_key: 'article.create' });
    if (!hasPerm) {
      return NextResponse.json({ error: 'Permission denied: article.create required' }, { status: 403 });
    }

    // 3. Read and enforce body stream size limit (max 50KB for raw facts) BEFORE charging quota
    const { text, error: streamError } = await readBoundedStream(request, 50 * 1024);
    if (streamError || !text) {
      return NextResponse.json({ error: streamError || 'Empty request body' }, { status: 413 });
    }

    // 4. Validate JSON payload BEFORE charging quota
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 5. Validate schema bounds BEFORE charging quota
    const parsed = DraftRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    // 6. Verify AI provider availability before charging quota
    if (!customDraftGenerator && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY in AI draft route');
      return NextResponse.json({ error: 'AI drafting service is currently unavailable' }, { status: 503 });
    }

    // 7. Charge quota ONLY after request payload is verified valid and AI service is confirmed available
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAllowed, error: rateLimitError } = await serviceClient.rpc('check_ai_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'draft',
      p_max_requests: 50,
      p_window_interval: '15 minutes'
    });
    
    // Distinguish rate limiter infrastructure errors (500) from quota exhaustion (429)
    if (rateLimitError) {
      Sentry.captureException(rateLimitError);
      console.error('AI rate limiter RPC failure:', rateLimitError);
      return NextResponse.json({ error: 'Rate limiter service temporarily unavailable' }, { status: 500 });
    }

    if (isAllowed === false) {
      return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
    }

    if (isAllowed !== true) {
      console.error('AI rate limiter RPC returned unexpected value:', isAllowed);
      return NextResponse.json({ error: 'Rate limiter service returned unexpected result' }, { status: 500 });
    }

    // 7. Invoke Gemini AI model (or custom test generator)
    let generatedObject: {
      title: string;
      excerpt: string;
      content: string;
      slug: string;
      category: string;
      district: string | null;
    };

    if (customDraftGenerator) {
      generatedObject = await customDraftGenerator({ rawFacts: parsed.data.rawFacts });
    } else {
      const result = await generateObject({
        model: google('gemini-2.5-flash'),
        system: `You are an expert news editor and journalist for KJIN (Kashmir Jammu Independent News). 
Your task is to take raw notes, facts, or press releases and draft a professional, objective, and clear news article.
- Output MUST be structured as a JSON object with title, excerpt, content, slug, category, and district.
- 'content' must be valid, clean HTML (using <p>, <h2>, <ul>, etc.) representing the body of the article. Do not include <html> or <body> tags.
- 'title' must be a catchy but objective headline.
- 'excerpt' must be a 1-2 sentence summary.
- 'slug' must be a URL-friendly version of the title.
- 'category' must be one of: Politics, Business, Sports, Technology, General.
- 'district' can be null or a valid district name in Kashmir/Jammu if applicable.
- The tone should be formal, unbiased, and journalistic.`,
        prompt: `Draft a complete news article based on the following raw facts:\n\n${parsed.data.rawFacts}`,
        schema: z.object({
          title: z.string().describe('The headline of the article'),
          excerpt: z.string().describe('A short summary of the article'),
          content: z.string().describe('The main body of the article formatted as semantic HTML'),
          slug: z.string().describe('URL-friendly slug (e.g. this-is-a-slug)'),
          category: z.string().describe('News category'),
          district: z.string().nullable().describe('Relevant district, or null if global/national'),
        }),
      });
      generatedObject = result.object;
    }

    // 8. Sanitize generated HTML content to prevent stored XSS from untrusted model outputs
    const sanitizedHtml = sanitizeArticleHtml(generatedObject.content);

    return NextResponse.json({
      ...generatedObject,
      content: sanitizedHtml,
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('AI Draft Error:', error);
    return NextResponse.json({ error: 'Failed to generate draft. Please try again later.' }, { status: 500 });
  }
}
