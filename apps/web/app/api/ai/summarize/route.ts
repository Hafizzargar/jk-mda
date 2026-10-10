import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { readBoundedStream } from '../../../../lib/request-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const SummarizeRequestSchema = z.object({
  content: z.string().min(10, 'Content must be at least 10 characters').max(20000, 'Content too long'),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Shared Database AI Rate Limiter (max 50 requests per 15 minutes)
    const { data: isAllowed, error: rateLimitError } = await supabase.rpc('check_ai_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'summarize',
      p_max_requests: 50,
      p_window_interval: '15 minutes'
    });
    
    if (rateLimitError || !isAllowed) {
      return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
    }

    // Permission check
    const { data: hasPerm } = await supabase.rpc('has_permission', { p_permission_key: 'article.create' });
    if (!hasPerm) {
      return NextResponse.json({ error: 'Permission denied: article.create required' }, { status: 403 });
    }

    // Input size limiting using bounded stream (max 50KB for content)
    const { text, error: streamError } = await readBoundedStream(request, 50 * 1024);
    if (streamError || !text) {
      return NextResponse.json({ error: streamError || 'Empty request body' }, { status: 413 });
    }

    // Zod validation
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = SummarizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      system: 'You are an expert news editor for KJIN. Summarize the provided article content into a punchy, engaging 1-2 sentence excerpt suitable for a news homepage or social media.',
      prompt: `Summarize this article:\n\n${parsed.data.content}`,
      schema: z.object({
        excerpt: z.string().describe('A 1-2 sentence summary of the article'),
      }),
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error('AI Summarize Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
