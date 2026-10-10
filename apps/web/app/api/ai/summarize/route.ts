import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { readBoundedStream } from '../../../../lib/request-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Basic in-memory rate limiter: UserID -> { count, windowStart }
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 50; // max 50 requests
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // per 15 minutes

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

    // Rate Limiting
    const now = Date.now();
    const userLimit = rateLimitCache.get(user.id) || { count: 0, windowStart: now };
    if (now - userLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
      userLimit.count = 0;
      userLimit.windowStart = now;
    }
    if (userLimit.count >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Too many requests, please try again later.' }, { status: 429 });
    }
    userLimit.count++;
    rateLimitCache.set(user.id, userLimit);

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
