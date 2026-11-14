import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.edit');
    if (!isEmployeeAuthorization(auth)) {
      // Fallback check for article.create
      const authCreate = await authorizeEmployeeRequest(request, 'article.create');
      if (!isEmployeeAuthorization(authCreate)) {
        return auth;
      }
    }

    const body = await request.json();
    const { title, excerpt, content, category } = body;

    if (!title && !content) {
      return Response.json({ error: 'Please provide at least a title or article content to enhance.' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'Gemini API key is not configured.' }, { status: 503 });
    }

    const prompt = `You are the Chief Headline & Audience Engagement Editor for KJIN (Kashmir Jammu Independent News).
Your mission is to take the following draft story and generate 3 irresistible, attractive, and exciting headline options, along with a captivating, enticing description (lead excerpt).

CURRENT TITLE: ${title || 'Untitled'}
CURRENT EXCERPT: ${excerpt || 'None'}
CATEGORY: ${category || 'General'}
STORY CONTEXT / BODY:
${(content || '').slice(0, 3000)}

DIRECTIVES FOR ATTRACTIVE & EXCITING NEWS PACKAGING:
1. MAKE THE HEADLINES ATTRACTIVE & EXCITING (HIGH READER CURIOSITY):
   - Formulate 3 distinct styles:
     * Style 1 (High-Impact & Urgent): Fast-paced, action-driven, breaking news hook.
     * Style 2 (Narrative & Human Stakes): Evocative, curiosity-driven, highlighting human drama or behind-the-scenes reality.
     * Style 3 (Bold & Modern Broadsheet): Sharp, magnetic framing inspired by BBC, Axios, and The Economist.
   - Use active voice, strong power verbs, dramatic contrast, and vital stakes.
   - Eliminate dry government memo phrasing, passive voice, or boring acronyms.
   - Strictly 100% faithful to the facts — never make false clickbait claims.

2. CAPTIVATING & ENTICING DESCRIPTION / EXCERPT:
   - For each headline option, provide an irresistible 2 to 3-sentence excerpt (60-90 words) that hooks the reader.
   - Use the "Hook & Stakes" formula: plunge into the core drama, highlight what is on the line for citizens or authorities, and tease what lies ahead.

Return strictly a JSON block inside \`\`\`json ... \`\`\` with this format:
{
  "suggestions": [
    {
      "style": "High-Impact & Urgent",
      "title": "Exciting, action-driven headline",
      "excerpt": "Captivating 2-3 sentence teaser and summary."
    },
    {
      "style": "Narrative & Human Stakes",
      "title": "Compelling, curiosity-igniting headline",
      "excerpt": "Captivating 2-3 sentence teaser and summary."
    },
    {
      "style": "Bold & Modern Broadsheet",
      "title": "Sharp, prestigious digital journalism headline",
      "excerpt": "Captivating 2-3 sentence teaser and summary."
    }
  ]
}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[EnhanceTitleAPI] Gemini API error:', errText);
      return Response.json({ error: 'Failed to communicate with AI model. Please try again.' }, { status: 502 });
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return Response.json({ error: 'Gemini returned an empty response.' }, { status: 502 });
    }

    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const toParse = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
    const parsed = JSON.parse(toParse);

    return Response.json({
      success: true,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    });
  } catch (error: any) {
    console.error('[EnhanceTitleAPI] Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

