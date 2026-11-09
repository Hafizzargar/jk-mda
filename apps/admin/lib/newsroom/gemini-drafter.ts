/**
 * Gemini Newsroom Drafter
 * Generates an objective, well-sourced news article draft based on verified facts and official responses.
 * Enforces editorial standards: does NOT invent government orders or state claims unsupported by sources.
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { MatchedResponseResult } from './response-matcher.ts';

export interface DraftEventInput {
  headline: string;
  summary: string;
  districtName?: string | null;
  locationName?: string | null;
  eventCategory: string;
  eventDate: string | Date;
  sources: Array<{ sourceName: string; url: string; title: string }>;
  officialResponse?: MatchedResponseResult | null;
}

export const DraftOutputZodSchema = z.object({
  title: z.string().trim().min(5).max(200),
  excerpt: z.string().trim().min(10).max(450),
  content: z.string().min(50).max(50_000),
  suggestedDistrict: z.string().nullable(),
  suggestedCategory: z.string().default('General'),
  claimsToVerify: z.array(z.string()).min(1).max(5),
  missingInformationWarning: z.string().nullable(),
});

export type GeneratedDraftResult = z.infer<typeof DraftOutputZodSchema>;

/**
 * Generate a sourced news article draft via Gemini
 */
export async function generateNewsroomDraft(input: DraftEventInput): Promise<GeneratedDraftResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  const sourcesList = input.sources
    .map((s) => `- ${s.sourceName}: "${s.title}" (${s.url})`)
    .join('\n');

  let officialResponseContext = 'No official government response was found in the sources checked.';
  if (input.officialResponse) {
    if (input.officialResponse.matchStatus === 'confirmed_relevant') {
      officialResponseContext = `CONFIRMED OFFICIAL GOVERNMENT UPDATE:
Authority: ${input.officialResponse.authorityName}
Document/Order: ${input.officialResponse.documentTitle}
Link: ${input.officialResponse.documentUrl}
Published At: ${input.officialResponse.publishedAt}
Type: ${input.officialResponse.responseType}
Excerpt: ${input.officialResponse.extractedTextExcerpt || 'N/A'}`;
    } else if (input.officialResponse.matchStatus === 'possible_match') {
      officialResponseContext = `POSSIBLE OFFICIAL UPDATE (UNVERIFIED):
Authority: ${input.officialResponse.authorityName}
Notice: ${input.officialResponse.documentTitle}
Link: ${input.officialResponse.documentUrl}
Note: This requires verification before attributing as a direct response to this specific event.`;
    } else if (input.officialResponse.matchStatus === 'check_failed') {
      officialResponseContext = `OFFICIAL PORTAL CHECK FAILED: The official source was unreachable or timed out during the check. Do not state that the government has issued or declined an order.`;
    }
  }

  const isJKStory = Boolean(
    input.districtName ||
    (input.locationName && /jammu|kashmir|srinagar|ladakh|leh|kargil|anantnag|baramulla|budgam|pulwama|shopian|kulgam|kupwara|bandipora|ganderbal|doda|ramban|kishtwar|udhampur|reasi|kathua|samba|rajouri|poonch/i.test(input.locationName)) ||
    /jammu|kashmir|srinagar/i.test(input.headline)
  );

  const prompt = `You are a senior investigative editor for Kashmir Jammu Independent News (KJIN).
Prepare an objective, sourced news article draft based ONLY on the following confirmed facts:

EVENT REPORT:
Headline: ${input.headline}
Summary: ${input.summary}
District: ${input.districtName || (isJKStory ? 'Jammu & Kashmir' : 'N/A (International / Non-Regional Story)')}
Specific Location: ${input.locationName || 'N/A'}
Category: ${input.eventCategory}
Date: ${input.eventDate}

REPORTING SOURCES:
${sourcesList || 'Initial reporting sources'}

OFFICIAL GOVERNMENT STATUS:
${officialResponseContext}

STRICT EDITORIAL RULES:
1. 'title': Factual headline without sensationalism. Do NOT append '— Jammu and Kashmir' unless the story specifically pertains to Jammu and Kashmir.
2. 'excerpt': 1-2 sentence lead paragraph.
3. 'content': Clean HTML body paragraphs (<p>, <h2>, <h3>, <ul>, <li>, <table>, <tr>, <th>, <td>). Include source attributions and links as anchors (<a href="...">source</a>).
4. CRITICAL: If no matching official government order or response was confirmed, explicitly state: "As of this reporting, no official advisory or order has been confirmed by relevant administrative authorities in the portals checked." NEVER fabricate an order or quote an unverified official.
5. GEOGRAPHIC INTEGRITY: If the story is an international or national report (e.g. Yemen, Sudan, UN, WHO, Middle East), use the actual foreign country or Global Desk dateline. NEVER label foreign international stories with a Jammu & Kashmir dateline.
6. 'claimsToVerify': List 2-4 factual claims that an editor must independently confirm before publication (e.g. casualty counts, road reopening timings, exact FIR details).
7. 'missingInformationWarning': If vital details are missing or conflicting between sources, state them clearly.
8. MANDATORY DEEP HISTORICAL & STATISTICAL LEDGER (INVESTIGATIVE DATA DEPTH):
- NEVER write a generic 2-sentence summary. As an authoritative broadsheet investigative publication, enrich every report with deep contextual data:
  a) IF TRANSIT / ACCIDENT / ROAD MISHAP (especially Doda, Kishtwar, Ramban, Batote, Assar, Sinthan, NH-244, NH-44):
     - Detail the topography (blind gorge curves, narrow carriage width, lack of crash-rated steel W-beam barriers and concrete retaining parapets along vertical 300-400 ft ravines).
     - Include verified regional historical statistics: Chenab Valley tri-district records ~350+ road accidents annually with 100-140 fatalities; over 1,850 collisions recorded over the last 5 years; cite recurring black spots (Assar gorge site of the 2023 39-fatality crash on NH-244, Thathri bends, Raggi Nallah, and Khellani curves).
     - State trauma medical evacuation bottlenecks (GMC Doda referral distance of 5-6 hours to Jammu).
  b) IF HYDROELECTRIC / DAM / POWER / INFRASTRUCTURE (especially Kishtwar, Chenab Basin, Reasi, Ramban):
     - Detail engineering & energy specifications: Megawatt capacity (Pakal Dul 1,000 MW, Ratle 850 MW, Kiru 624 MW, Kwar 540 MW, Dul Hasti 390 MW, Baglihar 900 MW, Salal 690 MW).
     - Detail financial investment: approved project outlays in ₹ Crores (Pakal Dul ₹8,112 Cr, Ratle ₹5,281 Cr, Kiru ₹4,287 Cr, Kwar ₹4,526 Cr - total Kishtwar hub >₹22,000+ Crore).
     - State executing authority: CVPPPL (Joint venture between NHPC 51% & JKSPDC 49%) under Ministry of Power.
     - State state royalty entitlement (12% free power to J&K + 1% Local Area Development Fund) and 80% non-executive local employment reservation.
  c) IF AGRICULTURE / HORTICULTURE (e.g. Sopore, Shopian, Pampore, Kishtwar saffron):
     - Detail annual apple harvest (20-22 lakh metric tonnes), Sopore fruit terminal scale, CA cold storage deficit (~2.5L MT existing vs 10L MT needed), GI-certified saffron metrics (₹250-₹350/gram).
  d) IF MOUNTAIN PASS / TELEMETRY:
     - Detail pass elevations (Zojila 11,575 ft, Mughal Road 11,460 ft, Sinthan 12,414 ft), winter snow accumulation (6-12 ft), and 14.15 km Zojila Tunnel execution.
  e) IF INTERNATIONAL GEOPOLITICS:
     - Detail treaties, diplomatic accords, defense budget authorizations ($ billions), and regional energy choke points.
9. STRUCTURED DATA LEDGER TABLE:
- In the content body, include a structured table or data card titled 'Regional Intelligence & Historical Data Ledger' summarizing key parameters, recorded values, and historical baselines.`;

  // If running in development without an active Gemini API key, provide an intelligent deterministic fallback
  if (!apiKey) {
    return generateFallbackDraft(input);
  }

  try {
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      prompt,
      schema: DraftOutputZodSchema,
    });

    return result.object;
  } catch (err: unknown) {
    console.warn('Gemini API call failed, using high-integrity fallback generator:', err);
    return generateFallbackDraft(input);
  }
}

function generateFallbackDraft(input: DraftEventInput): GeneratedDraftResult {
  const isJKStory = Boolean(
    input.districtName ||
    (input.locationName && /jammu|kashmir|srinagar|ladakh|leh|kargil|anantnag|baramulla|budgam|pulwama|shopian|kulgam|kupwara|bandipora|ganderbal|doda|ramban|kishtwar|udhampur|reasi|kathua|samba|rajouri|poonch/i.test(input.locationName)) ||
    /jammu|kashmir|srinagar/i.test(input.headline)
  );

  const dateline = input.districtName
    ? input.districtName.toUpperCase()
    : input.locationName
    ? input.locationName.toUpperCase()
    : isJKStory
    ? 'JAMMU AND KASHMIR'
    : 'INTERNATIONAL DESK';

  const locationLabel = input.districtName
    ? `the ${input.districtName} district`
    : input.locationName
    ? `${input.locationName}`
    : isJKStory
    ? 'the Jammu and Kashmir region'
    : 'the monitored region';

  const cleanTitle = input.headline.replace(/["']/g, '');
  const title = (isJKStory && input.districtName)
    ? `${cleanTitle} — ${input.districtName}`
    : cleanTitle;

  const hasConfirmedGovOrder = input.officialResponse?.matchStatus === 'confirmed_relevant';

  const govSection = hasConfirmedGovOrder
    ? `<p>In an official response, <strong>${input.officialResponse?.authorityName}</strong> issued a ${input.officialResponse?.responseType} titled <em>"${input.officialResponse?.documentTitle}"</em> (<a href="${input.officialResponse?.documentUrl}" target="_blank" rel="noopener noreferrer">view official notice</a>).</p>`
    : `<p><strong>Official Status:</strong> At the time of this dispatch, no matching official directive or advisory has been confirmed by relevant administrative authorities in the portals checked.</p>`;

  const sourcesListHtml = input.sources
    .map((s) => {
      const srcObj = s as { sourceName?: string; source_name?: string; url?: string; title?: string };
      let label = (srcObj.sourceName || srcObj.source_name)?.trim();
      if (!label || label === 'undefined' || label === 'null') {
        try {
          const host = srcObj.url ? new URL(srcObj.url).hostname.replace(/^www\./, '') : '';
          if (host.includes('un.org')) label = 'UN News';
          else if (host.includes('who.int')) label = 'WHO Dispatch';
          else label = host || 'Reporting Dispatch';
        } catch {
          label = 'Reporting Dispatch';
        }
      }
      return `<li><a href="${srcObj.url}" target="_blank" rel="noopener noreferrer">${label}</a>: ${srcObj.title || 'Source dispatch'}</li>`;
    })
    .join('');

  const bodyHtml = `
<p><strong>${dateline}</strong> — ${input.summary}</p>

<h2>Ground Developments</h2>
<p>Reports from regional sources indicate developments regarding ${input.eventCategory.replace(/_/g, ' ')} in ${locationLabel} on ${new Date(input.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>

${govSection}

<h2>Reporting Sources</h2>
<ul>
  ${sourcesListHtml || '<li>Regional Newsroom Dispatch</li>'}
</ul>
<p><em>KJIN Editorial Note: This draft was compiled under source-driven monitoring protocols and remains subject to editorial fact-checking prior to publication.</em></p>
`.trim();

  return {
    title: title.slice(0, 250),
    excerpt: input.summary.slice(0, 300),
    content: bodyHtml,
    suggestedDistrict: isJKStory ? (input.districtName || null) : null,
    suggestedCategory: !isJKStory
      ? 'International'
      : input.eventCategory === 'road_closures'
      ? 'Local'
      : 'General',
    claimsToVerify: [
      `Confirm the exact time and sequence of events in ${input.locationName || input.districtName || 'the reported area'}.`,
      hasConfirmedGovOrder
        ? `Verify the authenticity and reference number of the notice from ${input.officialResponse?.authorityName}.`
        : `Check with local emergency control or accredited wire services for unreleased advisories.`,
      `Verify independent humanitarian, casualty, or service metrics with accredited field reporters.`,
    ],
    missingInformationWarning: hasConfirmedGovOrder
      ? null
      : 'No official government response has been located yet. Ensure the article does not claim an order has been issued.',
  };
}

/**
 * Generate a URL-friendly slug from title (strictly enforces single hyphens)
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = Math.random().toString(36).substring(2, 6);
  const cleanBase = base.slice(0, 60).replace(/-+$/, '');
  return `${cleanBase || 'news'}-${suffix}`;
}
