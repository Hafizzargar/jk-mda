import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { readBoundedStream } from '../../../../lib/request-utils';
import * as Sentry from '@sentry/nextjs';

import { getTestSummarizeGenerator } from '../../../../lib/ai-provider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SummarizeRequestSchema = z.object({
  content: z.string().min(10, 'Content must be at least 10 characters').max(20000, 'Content too long'),
});

const SummarizeOutputSchema = z.object({
  excerpt: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const customSummarizeGenerator = getTestSummarizeGenerator();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase configuration in AI summarize route');
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
    const { data: hasPerm, error: permError } = await supabase.rpc('has_permission', { p_permission_key: 'article.create' });
    if (permError) {
      Sentry.captureException(permError);
      console.error('Authorization check RPC failure in summarize route:', permError);
      return NextResponse.json({ error: 'Authorization service temporarily unavailable' }, { status: 500 });
    }
    if (!hasPerm) {
      return NextResponse.json({ error: 'Permission denied: article.create required' }, { status: 403 });
    }

    // 3. Read and enforce body stream size limit (max 50KB for content) BEFORE charging quota
    const streamResult = await readBoundedStream(request, 50 * 1024);
    if (streamResult.error || !streamResult.text) {
      if (streamResult.code === 'PAYLOAD_TOO_LARGE') {
        return NextResponse.json({ error: streamResult.error }, { status: 413 });
      }
      return NextResponse.json({ error: streamResult.error || 'Empty request body' }, { status: 400 });
    }
    const text = streamResult.text;

    // 4. Validate JSON payload BEFORE charging quota
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 5. Validate schema bounds BEFORE charging quota
    const parsed = SummarizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    // 6. Verify AI provider availability before charging quota
    if (!customSummarizeGenerator && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY in AI summarize route');
      return NextResponse.json({ error: 'AI summarizing service is currently unavailable' }, { status: 503 });
    }

    // 7. Charge quota ONLY after request payload is verified valid and AI service is confirmed available
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAllowed, error: rateLimitError } = await serviceClient.rpc('check_ai_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'summarize',
      p_max_requests: 50,
      p_window_interval: '15 minutes'
    });
    
    // Distinguish rate limiter infrastructure errors (500) from quota exhaustion (429)
    if (rateLimitError) {
      Sentry.captureException(rateLimitError);
      console.error('AI rate limiter RPC failure in summarize:', rateLimitError);
      return NextResponse.json({ error: 'Rate limiter service temporarily unavailable' }, { status: 500 });
    }

    if (isAllowed === false) {
      return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
    }

    if (isAllowed !== true) {
      console.error('AI rate limiter RPC returned unexpected value in summarize:', isAllowed);
      return NextResponse.json({ error: 'Rate limiter service returned unexpected result' }, { status: 500 });
    }

    // 8. Invoke Gemini AI model (or custom test generator)
    let generatedObject: unknown;

    if (customSummarizeGenerator) {
      generatedObject = await customSummarizeGenerator({ content: parsed.data.content });
    } else {
      const result = await generateObject({
        model: google('gemini-2.5-flash'),
        system:
          'You are an expert news editor for KJIN. Summarize the article into a clear, accurate 1–2 sentence excerpt.',
        prompt: `Summarize this article:\n\n${parsed.data.content}`,
        schema: SummarizeOutputSchema,
      });
      generatedObject = result.object;
    }

    // 9. Validate AI summary output before returning
    const validatedSummary = SummarizeOutputSchema.safeParse(generatedObject);

    if (!validatedSummary.success) {
      console.error(
        'AI summary output failed validation:',
        validatedSummary.error.issues,
      );

      return NextResponse.json(
        { error: 'AI generated an invalid summary. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json(validatedSummary.data);
  } catch (error) {
    Sentry.captureException(error);
    console.error('AI Summarize Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary. Please try again later.' }, { status: 500 });
  }
}
