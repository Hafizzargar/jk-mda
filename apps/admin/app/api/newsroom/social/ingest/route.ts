import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getCanonicalCategory } from '@/lib/taxonomy-options.ts';
import { getRecommendedEditorialImage } from '@/lib/newsroom/ai-synthesizer.ts';
import { sendNewsApprovalAlert } from '@/lib/newsroom/email-notifier.ts';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const { url, raw_text, source_name, platform = 'auto' } = body;

    if (!url && !raw_text) {
      return Response.json(
        { error: 'Please provide either a post URL (Facebook, Instagram, YouTube) or raw text.' },
        { status: 400 }
      );
    }

    let detectedPlatform = platform;
    let extractedText = raw_text || '';
    let extractedTitle = '';

    // Auto-detect platform from URL
    if (url) {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
        detectedPlatform = 'youtube';
      } else if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.com')) {
        detectedPlatform = 'facebook';
      } else if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
        detectedPlatform = 'instagram';
      } else {
        detectedPlatform = 'web';
      }

      // If no raw_text supplied, attempt OpenGraph metadata extraction
      if (!extractedText) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(6000),
          });

          if (res.ok) {
            const html = await res.text();
            
            // Extract og:description or meta description
            const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                                html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
            
            // Extract og:title or title tag
            const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                                 html.match(/<title>([^<]+)<\/title>/i);

            if (ogTitleMatch) extractedTitle = ogTitleMatch[1];
            if (ogDescMatch) extractedText = ogDescMatch[1];
          }
        } catch (fetchErr) {
          console.warn('[Social Ingestion] OpenGraph scrape failed, using URL context:', fetchErr);
        }
      }
    }

    const finalInputText = `${extractedTitle ? extractedTitle + '\n\n' : ''}${extractedText || url || 'Social news broadcast'}`;

    // Prompt Gemini with the 80/10/10 J&K mandate
    const prompt = `
You are a senior investigative editor at KJIN (Kashmir & Jammu Investigative Newsroom).
Your task is to analyze this breaking social broadcast from ${detectedPlatform.toUpperCase()} and formulate a 100% ORIGINAL, professional news article in English.

RAW SOCIAL BROADCAST:
Source Platform: ${detectedPlatform.toUpperCase()}
Source Identity: ${source_name || 'Social Wire Broadcast'}
URL Reference: ${url || 'Direct Ground Submission'}
Content Information:
"""${finalInputText.slice(0, 3500)}"""

EDITORIAL INSTRUCTIONS:
1. STRICT 80% J&K / 10% NATIONAL / 10% INTERNATIONAL GATEKEEPER:
   - J&K Core (80% target quota):
     * "Chenab Valley" (30% Target Weightage): Doda, Kishtwar, Ramban, Bhadarwah, Banihal, Sinthan, Padder, Thathri, NH-244.
     * "Srinagar" (30% Target Weightage): Srinagar & Kashmir Valley (Dal Lake, Budgam, Ganderbal, Anantnag, Pulwama, Shopian, Kulgam, Baramulla, Kupwara, Bandipora).
     * "Jammu" (30% Target Weightage): Jammu city, Samba, Kathua, Udhampur, Reasi (Jammu Plains).
     * "Pir Panjal" (10% Target Weightage): Rajouri, Poonch, Mendhar, Thannamandi, Surankote, Mughal Road.
     * "Leh & Ladakh" (10% Target Weightage): Leh, Kargil, Zanskar, Drass.
   - Outside:
     * "National" (10% Target): Supreme Court, Union Cabinet, macro-economy only.
     * "International" (10% Target - STRICT ZERO-BAKWAS MANDATE):
       - ALLOWED ONLY:
         1. Major Wars & Geopolitical Conflicts (Middle East, Russia-Ukraine, defense pacts, global security).
         2. High-Impact Scientific & Medical Breakthroughs (scientists discovering vaccines, disease cures, WHO emergency alerts).
         3. Macro Global Energy / Trade Chokepoints (crude oil, maritime blockades).
       - STRICTLY REJECTED:
         1. NO International Sports (European football, Premier League, Champions League, NBA, tennis - REJECT).
         2. NO Pop culture, Hollywood, celebrity gossip, royal family drama (REJECT).
         3. NO Foreign municipal affairs or petty local crime (REJECT).
   - "is_priority_eligible": boolean (true/false). Discard outer state local noise or trivial foreign gossip.

2. REWRITE HEADLINE & LEAD FROM ZERO:
   - No clickbait, no watermarks, no Hindi/Urdu idioms.
   - Formulate original AP Style headline and 2-3 sentence executive overview.

3. WRITE 4 STRUCTURED ARTICLE SECTIONS (Zero copied lines):
   ### Executive Overview
   ### Background & Regional Context
   ### Key Developments & Statements
   ### Strategic Implications & Next Steps

Output strictly valid JSON with keys:
{
  "headline": string,
  "summary": string,
  "category": "Politics" | "National" | "International" | "Local News" | "Economy" | "Investigation" | "Problems" | "Culture" | "Sports" | "Education" | "Opinion" | "General",
  "scope": "International" | "National" | "State (Jammu & Kashmir)" | "Chenab Valley",
  "division": "Srinagar" | "Chenab Valley" | "Jammu" | "Pir Panjal" | "Leh & Ladakh" | "National" | "International",
  "district": string | null,
  "keyFacts": string[],
  "articleBodyMarkdown": string,
  "uncertaintyNotes": string,
  "is_priority_eligible": boolean,
  "rejection_reason": string | null
}
`;

    const response = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      temperature: 0.2,
    });

    const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const canonical = getCanonicalCategory(parsed.category || 'General', parsed.scope || 'State (Jammu & Kashmir)');
    const imageContext = `${parsed.headline} ${parsed.summary} ${parsed.division || ''} ${canonical.name}`;
    const recommended = getRecommendedEditorialImage(parsed.scope || 'National', canonical.name, imageContext);

    const isEligible = parsed.is_priority_eligible !== false;

    // Send instant email notification to editor for verification
    if (isEligible) {
      sendNewsApprovalAlert({
        headline: (parsed.headline || 'Breaking Social News Report').trim(),
        summary: (parsed.summary || '').trim(),
        category: canonical.name,
        scope: parsed.scope || 'State (Jammu & Kashmir)',
        division: parsed.division || 'Jammu & Kashmir',
        district: parsed.district || null,
        platform: detectedPlatform.toUpperCase(),
        sourceName: source_name || `${detectedPlatform.toUpperCase()} Monitor`,
        sourceUrl: url || null,
      }).catch((mailErr) => console.warn('[Social Ingestion] Email alert warning:', mailErr));
    }

    return Response.json({
      success: true,
      platform: detectedPlatform,
      source_name: source_name || `${detectedPlatform.toUpperCase()} Monitor`,
      source_url: url || null,
      draft: {
        headline: (parsed.headline || 'Breaking Social News Report').trim(),
        summary: (parsed.summary || '').trim(),
        category: canonical.name,
        scope: parsed.scope,
        division: parsed.division || 'Jammu & Kashmir',
        district: parsed.district || null,
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
        articleBodyMarkdown: (parsed.articleBodyMarkdown || '').trim(),
        featured_image_url: recommended.featuredImage,
        alternative_images: recommended.alternatives,
        is_priority_eligible: isEligible,
        rejection_reason: parsed.rejection_reason || null,
      },
    });
  } catch (err: any) {
    console.error('Error in social ingestion route:', err);
    return Response.json(
      { error: err.message || 'Failed to synthesize social post.' },
      { status: 500 }
    );
  }
}

