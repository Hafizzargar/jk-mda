import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { getOrderedKeyCascade, markKeyCooldown, markKeySuccess } from '@/lib/newsroom/gemini-keys';
import { getCategorySlug } from '@/lib/taxonomy-options';

interface PublicFigureItem {
  id: string;
  name: string;
  title: string;
  region: string;
  district: string;
  defaultDateline: string;
  category: string;
  topics: string[];
  searchQuery?: string;
  bio?: string;
  trackingMode?: 'auto' | 'manual';
  approvalPolicy?: 'mandatory_review' | 'auto_publish';
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { user, service } = auth;
    const body = await request.json();
    const { figureId, statementText, customTopic, autoPublish = false } = body;

    if (!figureId) {
      return Response.json({ error: 'Public figure ID is required.' }, { status: 400 });
    }

    // 1. Fetch public figures registry
    const { data: settingData } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_public_figures')
      .maybeSingle();

    const figures: PublicFigureItem[] = Array.isArray(settingData?.value) ? settingData.value : [];
    const figure = figures.find((f) => f.id === figureId);

    if (!figure) {
      return Response.json({ error: `Public figure "${figureId}" not found in registry.` }, { status: 404 });
    }

    // 2. Prepare prompt for Gemini
    const now = new Date();
    const nowIso = now.toISOString();
    const nowIst = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });

    let promptContext = '';
    if (statementText && statementText.trim().length > 15) {
      promptContext = `The editor provided the following raw statement / speech excerpt / press note from ${figure.name}:
"""
${statementText.trim()}
"""
Synthesize this raw statement into an objective, magnetic, and thoroughly reported news story. Place ${figure.name}'s statements and demands in accurate ground context, explain the civic stakes for ${figure.district || figure.region}, and include administrative or opposing perspective.`;
    } else {
      promptContext = `Search the web for the latest verified news, assembly statements, public speeches, press interventions, or civic inspections made by ${figure.name} (${figure.title}, ${figure.district}, ${figure.region}).
Search query to ground: ${figure.searchQuery || `${figure.name} ${figure.district} statement OR speech OR assembly OR video`}
Focus particularly on topics: ${customTopic || figure.topics.join(', ')}.`;
    }

    const systemPrompt = `You are a Senior Political & Regional News Editor for KJCPL News Network (Jammu, Kashmir, Chenab Valley, Pir Panjal, Ladakh).
Your task is to craft a factual, high-impact news report centered on prominent public representative **${figure.name}** (${figure.title}).

PUBLIC FIGURE METADATA:
- Name: ${figure.name}
- Title/Role: ${figure.title}
- District: ${figure.district}
- Region: ${figure.region}
- Mandatory Opening Dateline: "${figure.defaultDateline || 'DODA –'} "
- Current Reference Date: ${nowIst}

EDITORIAL INSTRUCTIONS:
1. HEADLINE: Magnetic, compelling, active voice, 50-85 characters. Highlight the core issue or confrontation (e.g. "Mehraj Malik Confronts Health Officials Over GMC Doda Equipment Deficits").
2. SUMMARY / EXCERPT: 300-450 characters (60-85 words). Must start with "${figure.defaultDateline || 'DODA –'} ". Evocative 3-sentence hook detailing the core statement, civic context, and official ramifications.
3. BODY MARKDOWN: 400-650 words.
   - Opening paragraph starting immediately with "${figure.defaultDateline || 'DODA –'} ".
   - Quick Highlights Box:
     **Key Highlights:**
     - **The Statement:** [Core public claim or demand by ${figure.name}]
     - **Civic Impact:** [Direct effect on local residents of ${figure.district || figure.region}]
     - **What's Next:** [Upcoming official action, deadline, or assembly response]
   - Subheadings (## ...): Story-specific (e.g. "## Public Interventions on the Ground", "## Official Response and Counter-Perspectives", "## Political and Administrative Stakes").
   - Include direct blockquotes (> "...") of ${figure.name}'s exact or reported remarks.
   - Balance & Objectivity: Never output uncritical PR or party propaganda. Balance political assertions with administrative realities, official verification, and opposing viewpoints.

Return your synthesis strictly as valid JSON inside \`\`\`json ... \`\`\` with schema:
{
  "title": string,
  "summary": string,
  "bodyMarkdown": string,
  "category": "Politics" | "Local News" | "Problems" | "Economy" | "General",
  "district": "${figure.district}",
  "claimsToVerify": string[],
  "sourceName": string,
  "sourceUrl": string
}`;

    // 3. Call Gemini with cascade across keys and models
    const keys = getOrderedKeyCascade();
    if (keys.length === 0) {
      return Response.json({ error: 'No Gemini API keys are configured.' }, { status: 500 });
    }

    const models = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
    let generatedStory: any = null;
    let lastError: string | null = null;

    keyLoop: for (const apiKey of keys) {
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: `${systemPrompt}\n\nTASK:\n${promptContext}` },
                    ],
                  },
                ],
                tools: [{ googleSearch: {} }],
                generationConfig: {
                  temperature: 0.25,
                  maxOutputTokens: 8192,
                },
              }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                if (parsed.title && parsed.bodyMarkdown) {
                  markKeySuccess(apiKey);
                  generatedStory = parsed;
                  break keyLoop;
                }
              }
            }
          } else if (res.status === 429) {
            console.warn(`[PublicFiguresSynthesizer] Key hit 429 on model ${model}. Quarantining key.`);
            markKeyCooldown(apiKey, 15);
            break; // Move to next key
          } else {
            const errText = await res.text();
            lastError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
          }
        } catch (fetchErr: any) {
          lastError = fetchErr.message;
        }
      }
    }

    if (!generatedStory) {
      return Response.json(
        { error: lastError || 'Failed to generate story with Gemini. Please try again.' },
        { status: 502 }
      );
    }

    // 4. Generate unique slug
    const baseSlug = generatedStory.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Enforce strict editorial review by default; political figure statements require human verification
    const shouldAutoPublish = autoPublish === true && figure.approvalPolicy === 'auto_publish';

    // 5. Store in Supabase: either directly published or into review queue
    const articlePayload = {
      title: generatedStory.title,
      slug: uniqueSlug,
      excerpt: generatedStory.summary || generatedStory.excerpt,
      content: generatedStory.bodyMarkdown,
      category: generatedStory.category || figure.category || 'Politics',
      district: generatedStory.district || figure.district,
      status: 'draft',
      author_id: user.id,
      author_display_name: 'KJCPL Editorial Bureau',
      source_name: generatedStory.sourceName || `${figure.name} Public Briefing`,
      source_url: generatedStory.sourceUrl || 'https://www.kjcpl.site/en',
      created_at: new Date().toISOString(),
      published_at: shouldAutoPublish ? new Date().toISOString() : null,
      published_by: shouldAutoPublish ? user.id : null,
    };

    const { data: inserted, error: insertErr } = await service
      .from('articles')
      .insert([articlePayload])
      .select('id, title, slug, category, district')
      .single();

    if (insertErr) {
      console.error('[PublicFiguresSynthesizer] Insert error:', insertErr);
      return Response.json({ error: insertErr.message }, { status: 500 });
    }

    // Transition draft -> review
    await service.from('articles').update({ status: 'review' }).eq('id', inserted.id);

    let isLive = false;
    let liveUrl: string | null = null;
    if (shouldAutoPublish) {
      const { error: pubErr } = await service
        .from('articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user.id,
        })
        .eq('id', inserted.id);

      if (!pubErr) {
        isLive = true;
        const catSlug = getCategorySlug(inserted.category);
        liveUrl = `https://www.kjcpl.site/en/${catSlug}/${inserted.slug}`;
      }
    }

    return Response.json({
      success: true,
      article: {
        id: inserted.id,
        title: inserted.title,
        slug: inserted.slug,
        category: inserted.category,
        district: inserted.district,
        excerpt: articlePayload.excerpt,
        content: articlePayload.content,
        claimsToVerify: generatedStory.claimsToVerify || [],
        isLive,
        liveUrl,
      },
    });
  } catch (err: any) {
    console.error('[PublicFiguresSynthesizer] Unexpected error:', err);
    return Response.json({ error: err.message || 'Synthesis failed.' }, { status: 500 });
  }
}
