import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateSlug } from '@/lib/newsroom/gemini-drafter';
import { getCanonicalCategory } from '@/lib/taxonomy-options';
import { determineDatelineForScope, sanitizeDatelineForScope } from '@/lib/newsroom/ai-synthesizer';

function cleanEditorialText(text: string, preserveLinebreaks = false): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip accidental JSON object wrappers
  if (cleaned.startsWith('{') || /^\s*\{\s*"(?:headline|title|summary|articleBodyMarkdown|bodyMarkdown)"/i.test(cleaned)) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'object' && parsed !== null) {
        cleaned = String(parsed.articleBodyMarkdown || parsed.bodyMarkdown || parsed.content || parsed.summary || parsed.headline || '');
      }
    } catch {
      const bodyMatch = cleaned.match(/"(?:articleBodyMarkdown|bodyMarkdown|content|body)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/);
      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/);
      const summaryTailMatch = cleaned.match(/"(?:summary|bodyMarkdown|articleBodyMarkdown|content|body)"\s*:\s*"?([\s\S]+)$/i);
      if (bodyMatch && bodyMatch[1] && bodyMatch[1].trim()) {
        cleaned = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else if (summaryMatch && summaryMatch[1] && summaryMatch[1].trim()) {
        cleaned = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else if (summaryTailMatch && summaryTailMatch[1]) {
        cleaned = summaryTailMatch[1].replace(/["}\]\s]+$/, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else {
        cleaned = cleaned
          .replace(/^\{\s*"(?:headline|title)"\s*:\s*(?:"(?:\\.|[^"\\])*"|'[^']*'),?\s*/i, '')
          .replace(/^"(?:summary|lead|description|body|content)"\s*:\s*"?/i, '')
          .replace(/["}\]\s]+$/, '');
      }
    }
  }

  const result = cleaned
    // Remove hashtags
    .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
    // Remove trailing social blocks and promotional text
    .replace(/(?:social\s*links|channel\s*link|join\s+.*?channel|follow\s+us|connect\s+with\s+us|subscribe\s+to)[\s\S]*$/gi, '')
    // Remove inline social media channels, handles, and WhatsApp calls
    .replace(/(?:facebook|instagram|twitter|telegram|whatsapp)\s*:\s*[^\s.,;]+/gi, '')
    .replace(/join\s+[^.,;]+\s*(?:whatsapp|telegram)\s*channel/gi, '')
    .replace(/channel\s*link\s*:\s*/gi, '')
    .replace(/\*+(?:Independent investigative dispatch|Report synthesized by).*?\*+/gi, '')
    // Remove markdown links while preserving text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove all URLs
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    // Remove long dashed dividers
    .replace(/[-=_~*]{3,}/g, ' ');

  if (preserveLinebreaks) {
    return result.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  }

  return result.replace(/\s+/g, ' ').trim();
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const {
      video_id,
      headline,
      summary,
      category,
      body_markdown,
      featured_image_url,
      scope,
      district,
      target_status = 'review'
    } = body;

    if (!video_id || typeof video_id !== 'string') {
      return Response.json({ error: 'Video record ID is required.' }, { status: 400 });
    }

    const { service, profile } = auth;

    // Fetch video record
    const { data: videoRecord, error: videoErr } = await service
      .from('youtube_videos')
      .select('*, youtube_sources(channel_name, country, region, category)')
      .eq('id', video_id)
      .single();

    if (videoErr || !videoRecord) {
      return Response.json({ error: 'Video record not found.' }, { status: 404 });
    }

    const finalTitle = cleanEditorialText(headline || videoRecord.proposed_headline || videoRecord.title);
    const rawSummary = cleanEditorialText(summary || videoRecord.proposed_summary || videoRecord.description || '').slice(0, 400);

    // Determine 2-way distribution: Scope (Tier 1) + Topic (Tier 2) + District
    const effectiveScope = scope || videoRecord.ai_analysis?.scope || 'National';
    const isLocalScope = effectiveScope.includes('Local') || effectiveScope.includes('State') || effectiveScope.includes('Jammu') || effectiveScope.includes('Chenab');

    const canonicalCat = getCanonicalCategory(category || videoRecord.proposed_category, effectiveScope);
    const finalCategory = canonicalCat.name;

    const targetDateline = determineDatelineForScope(effectiveScope, `${finalTitle} ${rawSummary}`);
    const finalSummary = sanitizeDatelineForScope(rawSummary, effectiveScope, targetDateline);

    // Resolve category_id from public.categories
    const { data: catRecord } = await service
      .from('categories')
      .select('id')
      .eq('slug', canonicalCat.slug)
      .maybeSingle();

    const rawContent = (body_markdown || videoRecord.ai_analysis?.articleBodyMarkdown || videoRecord.description || '').trim();

    // Ensure 100% clean, professional article script with correct dateline and preserved markdown formatting
    const linkFreeContent = sanitizeDatelineForScope(cleanEditorialText(rawContent, true), effectiveScope, targetDateline);

    // Priority for featured image:
    // If client explicitly sent featured_image_url (including "" or null to indicate text-only without image), respect it!
    // Only fall back to video thumbnail/AI image if featured_image_url was omitted (undefined).
    let finalImageUrl: string | null = null;
    if (featured_image_url !== undefined) {
      finalImageUrl = typeof featured_image_url === 'string' && featured_image_url.trim().length > 0
        ? featured_image_url.trim()
        : null;
    } else {
      finalImageUrl =
        videoRecord.ai_analysis?.featured_image_url ||
        videoRecord.thumbnail_url ||
        null;
    }

    const { data: profileRecord } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', profile.id)
      .maybeSingle();

    const baseSlug = generateSlug(finalTitle);
    const finalSlug = `${baseSlug || 'news-report'}-${Date.now().toString(36).slice(-4)}`;

    const authorName = profileRecord?.display_name?.trim() || auth.user.email?.split('@')[0] || 'KJIN Newsroom';
    const sourceChannelName = videoRecord.youtube_sources?.channel_name || 'Broadcast Surveillance';
    const finalDistrict = isLocalScope ? (district || videoRecord.ai_analysis?.district || null) : null;

    // Step 1: Create article in articles table as 'draft' (enforced by DB integrity trigger)
    const { data: newArticle, error: articleErr } = await service
      .from('articles')
      .insert({
        title: finalTitle.slice(0, 250),
        slug: finalSlug,
        excerpt: finalSummary,
        content: linkFreeContent,
        category: finalCategory,
        category_id: catRecord?.id || null,
        district: finalDistrict,
        status: 'draft',
        author_id: profile.id,
        author_display_name: authorName,
        source_name: sourceChannelName,
        source_url: videoRecord.video_url,
        featured_image_url: finalImageUrl,
      })
      .select()
      .single();

    if (articleErr || !newArticle) {
      console.error('Error creating article from YouTube draft:', articleErr);
      return Response.json({ error: articleErr?.message || 'Failed to create article record.' }, { status: 500 });
    }

    // Step 2: If target is review, transition status from 'draft' to 'review'
    if (target_status === 'review') {
      const { error: transitionErr } = await service
        .from('articles')
        .update({ status: 'review', updated_at: new Date().toISOString() })
        .eq('id', newArticle.id);

      if (transitionErr) {
        console.warn('Warning: Could not transition draft to review status:', transitionErr);
      }
    }

    // Step 3: Insert initial version into article_versions
    await service.from('article_versions').insert({
      article_id: newArticle.id,
      version_number: 1,
      title: finalTitle.slice(0, 250),
      excerpt: finalSummary,
      content: linkFreeContent,
      edited_by: profile.id,
    });

    // Update video record status to approved and link article
    await service
      .from('youtube_videos')
      .update({
        processing_status: 'approved',
        article_id: newArticle.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', video_id);

    // Record audit log
    await service.from('audit_logs').insert({
      actor_profile_id: profile.id,
      action: 'article.created_from_youtube',
      target_type: 'article',
      target_id: newArticle.id,
      result: 'success',
      details: {
        youtube_video_id: videoRecord.video_id,
        channel_name: videoRecord.youtube_sources?.channel_name,
        target_status,
      },
    });

    return Response.json({
      success: true,
      message: `Article drafted successfully and sent to editorial review.`,
      article: newArticle,
    });
  } catch (err) {
    console.error('Error approving YouTube video draft:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
