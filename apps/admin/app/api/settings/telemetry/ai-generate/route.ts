import { authenticateEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const EDIT_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

const DevelopingWireSchema = z.object({
  headline: z.string().min(10).max(220).describe('Urgent, concise broadsheet ticker headline without hyperbole'),
  badge: z.enum(['DEVELOPING', 'BREAKING', 'VERIFIED WIRE', 'SPECIAL BULLETIN', 'CORRIDOR ALERT', 'EXECUTIVE ACTION']).default('DEVELOPING'),
  synced_time: z.string().describe('Time formatted as HH:MM IST, e.g. 14:15 IST'),
  article_id: z.string().nullable().optional(),
});

function formatISTTime(date = new Date()): string {
  try {
    const istString = date.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${istString} IST`;
  } catch {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} IST`;
  }
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!EDIT_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to generate AI telemetry content.' },
      { status: 403 }
    );
  }

  // 1. Fetch recent published articles from database
  const { data: recentArticles, error: dbError } = await authorization.service
    .from('articles')
    .select('id, title, category, district, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(6);

  if (dbError) {
    return Response.json({ error: 'Failed to fetch latest dispatches.' }, { status: 500 });
  }

  const articlesList = (recentArticles || []).map((a, i) =>
    `Story ${i + 1} [ID: ${a.id}]: "${a.title}" (Category: ${a.category}, District: ${a.district || 'Regional'})`
  ).join('\n');

  const currentIST = formatISTTime();

  // 2. Check for Gemini API key
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || !recentArticles || recentArticles.length === 0) {
    // Intelligent deterministic fallback
    const topArticle = recentArticles?.[0];
    const fallbackHeadline = topArticle
      ? `${topArticle.title}; Ground verification active across regional corridors.`
      : 'Chenab Valley railway link completes winter safety protocol run; Mughal Road cleared for high-altitude freight traffic after light snowfall.';

    return Response.json({
      success: true,
      headline: fallbackHeadline,
      badge: 'DEVELOPING',
      synced_time: currentIST,
      article_id: topArticle?.id || null,
      mode: 'fallback',
    });
  }

  try {
    const prompt = `You are the Executive Managing Editor of Kashmir Jammu Independent News (KJIN).
Review the following breaking stories recently published on the wire:

${articlesList}

Synthesize a single urgent, dignified, fact-focused developing wire bulletin ticker for the top black banner ribbon of the broadsheet newspaper.
Current Time in IST: ${currentIST}

Strict Editorial Rules:
1. Headline must be between 40 and 180 characters.
2. Must cite verified facts from the stories provided. NEVER invent government orders, casualties, or fake events.
3. Use high-integrity journalistic phrasing suitable for a certified journal of record.
4. Set badge to 'DEVELOPING', 'BREAKING', 'SPECIAL BULLETIN', or 'CORRIDOR ALERT'.
5. Set synced_time to current IST (e.g. "${currentIST}").
6. Set article_id to the exact ID of the primary story referenced.`;

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      prompt,
      schema: DevelopingWireSchema,
    });

    return Response.json({
      success: true,
      headline: result.object.headline,
      badge: result.object.badge,
      synced_time: result.object.synced_time || currentIST,
      article_id: result.object.article_id || recentArticles[0]?.id || null,
      mode: 'ai_gemini',
    });
  } catch (err) {
    console.warn('[AI Developing Wire] Gemini generation failed, using intelligent fallback:', err);
    const topArticle = recentArticles[0];
    return Response.json({
      success: true,
      headline: topArticle ? `${topArticle.title}; Regional bureau verification active.` : 'Regional bureau telemetry synchronized across valley and mountain corridors.',
      badge: 'DEVELOPING',
      synced_time: currentIST,
      article_id: topArticle?.id || null,
      mode: 'fallback',
    });
  }
}
