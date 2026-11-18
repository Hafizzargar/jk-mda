import { authenticateEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import {
  DEFAULT_EDITORIAL_OF_RECORD,
  DEFAULT_VOICES_OF_CORRIDORS,
  type EditorialOfRecordSetting,
  type CorridorVoiceItem,
} from '@/lib/editorial-desk';

const EDIT_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

const EditorialSchema = z.object({
  volume_badge: z.string().describe('Formal edition badge, e.g. "Vol. 1, No. 1 • Inaugural Edition" or "Vol. 1, No. 1 • Autumn 2026"'),
  title: z.string().describe('Deep, dignified, intellectual headline representing the newsroom collective editorial stance'),
  quote: z.string().describe('A profound 2-3 sentence institutional stance and analysis of regional federalism, public welfare, economy, or civic governance'),
  author_name: z.string().default('KJCPL Editorial Board'),
  author_initials: z.string().default('EB'),
  institution_subtext: z.string().default('Srinagar & Jammu Editorial Bureau'),
  article_id: z.string().nullable().optional(),
});

const VoiceItemSchema = z.object({
  speaker: z.string().describe('Authentic regional name, e.g. Ghulam Rasool Wani, Dr. Sunita Sharma, Tsewang Norboo'),
  location: z.string().describe('Specific regional village/town and district in J&K or Ladakh, e.g. "Padder, Kishtwar" or "Surankote, Poonch"'),
  district: z.string().describe('Standard lowercase district, e.g. kishtwar, poonch, doda, kupwara, srinagar, jammu, baramulla, kargil'),
  quote: z.string().describe('1-2 sentence compelling first-person testimony about agriculture, roads, power, education, or culture grounded in recent events'),
});

const FullDeskSchema = z.object({
  editorial: EditorialSchema,
  voices: z.array(VoiceItemSchema).min(3).max(5),
});

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!EDIT_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to generate AI editorial content.' },
      { status: 403 }
    );
  }

  let body: { mode?: 'editorial' | 'voices' | 'all'; topic?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = { mode: 'all' };
  }

  const mode = body.mode || 'all';

  // 1. Fetch recent published articles from database
  const { data: recentArticles } = await authorization.service
    .from('articles')
    .select('id, title, category, district, summary, content, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(8);

  const articlesSummary = (recentArticles && recentArticles.length > 0)
    ? recentArticles.map((a, i) =>
        `Story ${i + 1} [ID: ${a.id}]: "${a.title}" | Category: ${a.category} | District: ${a.district || 'Regional'}\nExcerpt: ${a.summary || a.content?.slice(0, 160) || 'Verified broadsheet dispatch'}`
      ).join('\n\n')
    : 'Recent regional reporting covers Chenab Valley infrastructure, winter power distribution protocols across Kashmir, border tourism revival along the Mughal Road, and horticulture pricing protections.';

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  // Fallback if AI service key is missing
  if (!apiKey) {
    const topArticle = recentArticles?.[0];
    const fallbackEditorial: EditorialOfRecordSetting = {
      ...DEFAULT_EDITORIAL_OF_RECORD,
      volume_badge: `Vol. 1, No. 1 • ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      title: topArticle ? `Regional Stance: ${topArticle.title}` : DEFAULT_EDITORIAL_OF_RECORD.title,
      article_id: topArticle?.id || null,
    };
    return Response.json({
      success: true,
      mode: 'fallback',
      editorial: fallbackEditorial,
      voices: DEFAULT_VOICES_OF_CORRIDORS,
    });
  }

  try {
    const systemPrompt = `You are the Editor-in-Chief and Head of the Editorial Board for KJCPL (KJCPL News Network).
You write for a historic broadsheet newspaper of record representing Jammu, Kashmir, Chenab Valley, and Ladakh.
Your editorial stance is balanced, intellectually rigorous, respectful of regional diversity, constitutional principles, and deeply attuned to grassroots realities.

Recent Stories on the Wire:
${articlesSummary}

${body.topic ? `Specific User Editorial Guidance: "${body.topic}"\n` : ''}

Generate structured content for the editorial desk:
- An "Editorial of Record" Op-Ed stance that addresses the overarching theme of current affairs.
- Authentic "Voices of the Corridors" citizen testimonies reflecting genuine grassroots feedback from districts like Kishtwar, Poonch, Doda, Baramulla, Kupwara, Kargil, or Jammu.`;

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      prompt: systemPrompt,
      schema: FullDeskSchema,
    });

    const generated = result.object;
    const topStoryId = recentArticles?.[0]?.id || null;

    const formattedEditorial: EditorialOfRecordSetting = {
      enabled: true,
      volume_badge: generated.editorial.volume_badge || 'Vol. 1, No. 1',
      title: generated.editorial.title,
      quote: generated.editorial.quote,
      author_name: generated.editorial.author_name || 'KJCPL Editorial Board',
      author_initials: generated.editorial.author_initials || 'EB',
      institution_subtext: generated.editorial.institution_subtext || 'Srinagar & Jammu Editorial Bureau',
      link_mode: generated.editorial.article_id ? 'article' : (topStoryId ? 'article' : 'opinion_category'),
      article_id: generated.editorial.article_id || topStoryId,
      custom_url: '/category/opinion',
    };

    const formattedVoices: CorridorVoiceItem[] = generated.voices.map((v, idx) => ({
      id: `voice-${Date.now()}-${idx + 1}`,
      speaker: v.speaker,
      location: v.location,
      district: v.district,
      quote: v.quote,
      enabled: true,
      order: idx + 1,
    }));

    return Response.json({
      success: true,
      mode: 'ai_gemini',
      editorial: formattedEditorial,
      voices: formattedVoices,
    });
  } catch (err: any) {
    console.error('AI Editorial Generation failed, using robust fallback:', err);
    const topArticle = recentArticles?.[0];
    const fallbackEditorial: EditorialOfRecordSetting = {
      ...DEFAULT_EDITORIAL_OF_RECORD,
      volume_badge: `Vol. LXXV • ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      title: topArticle ? `Editorial Review: ${topArticle.title}` : DEFAULT_EDITORIAL_OF_RECORD.title,
      article_id: topArticle?.id || null,
    };
    return Response.json({
      success: true,
      mode: 'fallback_error',
      editorial: fallbackEditorial,
      voices: DEFAULT_VOICES_OF_CORRIDORS,
      warning: err.message || 'AI request timed out; generated broadsheet default template.',
    });
  }
}
