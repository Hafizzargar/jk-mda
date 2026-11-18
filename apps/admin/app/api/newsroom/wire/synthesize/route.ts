import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateSlug } from '@/lib/newsroom/gemini-drafter';
import {
  synthesizeEnglishNewsDraft,
  type SynthesizedDraft,
} from '@/lib/newsroom/ai-synthesizer';
import { isGeminiInCooldown } from '@/lib/newsroom/gemini-circuit-breaker';

export const dynamic = 'force-dynamic';

interface WireSynthesizePayload {
  headline: string;
  summary?: string;
  source_name?: string;
  source_url?: string;
  category?: string;
  scope?: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley';
  auto_publish?: boolean;
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { user, service } = auth;
    let body: WireSynthesizePayload;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const {
      headline,
      summary = '',
      source_name = 'KJCPL Global Desk',
      source_url,
      category = 'International',
      auto_publish = true,
    } = body;

    if (!headline || typeof headline !== 'string' || headline.trim().length < 5) {
      return Response.json({ error: 'Headline is required (minimum 5 characters).' }, { status: 400 });
    }

    const breaker = await isGeminiInCooldown();
    if (breaker.inCooldown) {
      return Response.json(
        {
          error: `AI synthesizer circuit breaker is currently in cooldown until ${breaker.cooldownUntil} (${breaker.remainingMinutes}m remaining).`,
        },
        { status: 503 }
      );
    }

    const draft: SynthesizedDraft = await synthesizeEnglishNewsDraft({
      rawTitle: headline.trim(),
      rawDescription: summary.trim() || headline.trim(),
      channelName: source_name,
      category,
      region: category === 'International' ? 'International' : 'National',
    });

    if (!draft || !draft.headline || !draft.body_markdown) {
      return Response.json(
        { error: 'AI newsroom synthesizer was unable to draft article. Please try again.' },
        { status: 500 }
      );
    }

    const finalTitle = draft.headline.trim().slice(0, 250);
    const finalExcerpt = draft.summary.trim();
    const finalContent = draft.body_markdown.trim();
    const slug = generateSlug(finalTitle);

    // Get author display name
    const { data: profile } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    const authorDisplayName = profile?.display_name || user.email?.split('@')[0] || 'KJCPL World Desk';

    const status = auto_publish ? 'published' : 'review';
    const publishedAt = auto_publish ? new Date().toISOString() : null;

    const { data: article, error: insertError } = await service
      .from('articles')
      .insert({
        title: finalTitle,
        slug,
        excerpt: finalExcerpt,
        content: finalContent,
        category: draft.category || category,
        district: draft.district || null,
        author_id: user.id,
        author_display_name: authorDisplayName,
        featured_image_url: draft.featured_image_url || null,
        source_name,
        source_url: source_url || null,
        status,
        published_at: publishedAt,
      })
      .select('id, title, slug, category, status, published_at')
      .single();

    if (insertError) {
      console.error('[WireSynthesizer] Database insert error:', insertError);
      return Response.json({ error: `Database insert failed: ${insertError.message}` }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: `Story successfully synthesized and ${status === 'published' ? 'published' : 'queued for review'}!`,
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        category: article.category,
        status: article.status,
        url: `/en/international/${article.slug}`,
      },
    });
  } catch (error: any) {
    console.error('[WireSynthesizer] Unexpected error:', error);
    return Response.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
