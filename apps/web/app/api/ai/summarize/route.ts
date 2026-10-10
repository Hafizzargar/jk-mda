import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

    const { content } = await request.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid content parameter' }, { status: 400 });
    }

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      system: 'You are an expert news editor for KJIN. Summarize the provided article content into a punchy, engaging 1-2 sentence excerpt suitable for a news homepage or social media.',
      prompt: `Summarize this article:\n\n${content}`,
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
