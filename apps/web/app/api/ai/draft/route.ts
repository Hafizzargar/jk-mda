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

const DraftRequestSchema = z.object({
  rawFacts: z.string().min(10, 'Input must be at least 10 characters').max(15000, 'Input too long'),
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

    // Input size limiting using bounded stream (max 50KB for raw facts)
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

    const parsed = DraftRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

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

    return NextResponse.json(result.object);

  } catch (error) {
    console.error('AI Draft Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
