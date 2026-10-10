import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    // 1. Verify User Authentication
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

    // 2. Parse input facts/notes
    const { rawFacts } = await request.json();
    if (!rawFacts || typeof rawFacts !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid rawFacts parameter' }, { status: 400 });
    }

    // 3. Generate structured draft using AI
    const result = await generateObject({
      model: google('gemini-2.5-flash'), // Or your configured model
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
      prompt: `Draft a complete news article based on the following raw facts:\n\n${rawFacts}`,
      schema: z.object({
        title: z.string().describe('The headline of the article'),
        excerpt: z.string().describe('A short summary of the article'),
        content: z.string().describe('The main body of the article formatted as semantic HTML'),
        slug: z.string().describe('URL-friendly slug (e.g. this-is-a-slug)'),
        category: z.string().describe('News category'),
        district: z.string().nullable().describe('Relevant district, or null if global/national'),
      }),
    });

    // 4. Return the draft. 
    // IMPORTANT: We DO NOT insert it into the database here.
    // The CMS client will present this to the Reporter/Editor for MANDATORY human review and editing.
    // The human will then use the standard `create_article` workflow to save it as a draft.
    return NextResponse.json(result.object);

  } catch (error: any) {
    console.error('AI Draft Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
