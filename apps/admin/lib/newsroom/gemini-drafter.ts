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

  const prompt = `You are a senior investigative editor for Kashmir Jammu Independent News (KJIN).
Prepare an objective, sourced news article draft based ONLY on the following confirmed facts:

EVENT REPORT:
Headline: ${input.headline}
Summary: ${input.summary}
District: ${input.districtName || 'Jammu and Kashmir'}
Specific Location: ${input.locationName || 'N/A'}
Category: ${input.eventCategory}
Date: ${input.eventDate}

REPORTING SOURCES:
${sourcesList || 'Initial reporting sources'}

OFFICIAL GOVERNMENT STATUS:
${officialResponseContext}

STRICT EDITORIAL RULES:
1. 'title': Factual headline without sensationalism.
2. 'excerpt': 1-2 sentence lead paragraph.
3. 'content': Clean HTML body paragraphs (<p>, <h2>, <ul>, <li>). Include source attributions and links as anchors (<a href="...">source</a>).
4. CRITICAL: If no matching official government order or response was confirmed, explicitly state: "As of this reporting, no official advisory or order has been confirmed by local administration." NEVER fabricate an order or quote an unverified official.
5. 'claimsToVerify': List 2-4 factual claims that an editor must independently confirm before publication (e.g. casualty counts, road reopening timings, exact FIR details).
6. 'missingInformationWarning': If vital details are missing or conflicting between sources, state them clearly.`;

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
  const district = input.districtName || 'Jammu and Kashmir';
  const cleanTitle = input.headline.replace(/["']/g, '');

  const hasConfirmedGovOrder = input.officialResponse?.matchStatus === 'confirmed_relevant';

  const govSection = hasConfirmedGovOrder
    ? `<p>In an official response, <strong>${input.officialResponse?.authorityName}</strong> issued a ${input.officialResponse?.responseType} titled <em>"${input.officialResponse?.documentTitle}"</em> (<a href="${input.officialResponse?.documentUrl}" target="_blank" rel="noopener noreferrer">view official notice</a>).</p>`
    : `<p><strong>Official Status:</strong> At the time of this dispatch, no matching official directive or advisory has been confirmed by district authorities in the portals checked.</p>`;

  const sourcesListHtml = input.sources
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.sourceName}</a>: ${s.title}</li>`)
    .join('');

  const bodyHtml = `
<p><strong>${district.toUpperCase()}</strong> — ${input.summary}</p>

<h2>Ground Developments</h2>
<p>Reports from regional sources indicate developments regarding ${input.eventCategory.replace(/_/g, ' ')} in the ${input.locationName || district} area on ${new Date(input.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>

${govSection}

<h2>Reporting Sources</h2>
<ul>
  ${sourcesListHtml || '<li>Regional Newsroom Dispatch</li>'}
</ul>
<p><em>KJIN Editorial Note: This draft was compiled under source-driven monitoring protocols and remains subject to editorial fact-checking prior to publication.</em></p>
`.trim();

  return {
    title: `${cleanTitle} — ${district}`,
    excerpt: input.summary.slice(0, 300),
    content: bodyHtml,
    suggestedDistrict: input.districtName || null,
    suggestedCategory: input.eventCategory === 'road_closures' ? 'Local' : 'General',
    claimsToVerify: [
      `Confirm the exact time and sequence of events in ${input.locationName || district}.`,
      hasConfirmedGovOrder
        ? `Verify the authenticity and reference number of the notice from ${input.officialResponse?.authorityName}.`
        : `Check with district emergency control room for any unreleased administrative advisory.`,
      `Verify whether any public transport or school disruptions have taken effect.`,
    ],
    missingInformationWarning: hasConfirmedGovOrder
      ? null
      : 'No official government response has been located yet. Ensure the article does not claim an order has been issued.',
  };
}

/**
 * Generate a URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base.slice(0, 60)}-${suffix}`;
}
