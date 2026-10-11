import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { readBoundedStream } from '../../../../lib/request-utils';
import * as Sentry from '@sentry/nextjs';

import { getCustomSummarizeGenerator } from '../../../../lib/ai-provider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SummarizeRequestSchema = z.object({
  content: z.string().min(10, 'Content must be at least 10 characters').max(20000, 'Content too long'),
});

export async function POST(request: Request) {
  try {
    const customSummarizeGenerator = getCustomSummarizeGenerator();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase configuration in AI summarize route');
      return NextResponse.json({ error: 'AI service configuration error' }, { status: 500 });
    }

    if (!customSummarizeGenerator && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY in AI summarize route');
      return NextResponse.json({ error: 'AI summarizing service is currently unavailable' }, { status: 503 });
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

    // 3. Read and enforce body stream size limit (max 50KB for content) BEFORE charging quota
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
    const parsed = SummarizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    // 6. Charge quota ONLY after request payload is verified valid
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

    // 7. Invoke Gemini AI model (or custom test generator)
    let generatedObject: { excerpt: string };

    if (customSummarizeGenerator) {
      generatedObject = await customSummarizeGenerator({ content: parsed.data.content });
    } else {
      const result = await generateObject({
        model: google('gemini-2.5-flash'),
        system: 'You are an expert news editor for KJIN. Summarize the provided article content into a punchy, engaging 1-2 sentence excerpt suitable for a news homepage or social media.',
        prompt: `Summarize this article:\n\n${parsed.data.content}`,
        schema: z.object({
          excerpt: z.string().describe('A 1-2 sentence summary of the article'),
        }),
      });
      generatedObject = result.object;
    }

    return NextResponse.json(generatedObject);
  } catch (error) {
    Sentry.captureException(error);
    console.error('AI Summarize Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary. Please try again later.' }, { status: 500 });
  }
}
