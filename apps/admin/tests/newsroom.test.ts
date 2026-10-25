import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateSourceUrl } from '../lib/newsroom/ssrf-guard.ts';
import { classifyDistrict, classifyEventCategory } from '../lib/newsroom/district-classifier.ts';
import { matchEventWithOfficialResponses } from '../lib/newsroom/response-matcher.ts';
import { generateNewsroomDraft, generateSlug } from '../lib/newsroom/gemini-drafter.ts';
import { collectApprovedYouTubeChannel } from '../lib/newsroom/source-collector.ts';

describe('AI Newsroom — Acceptance Tests', () => {
  // 1. SSRF Protection Tests
  test('SSRF Guard: rejects loopback and internal metadata hosts', () => {
    assert.equal(validateSourceUrl('http://localhost:3000/feed').isValid, false);
    assert.equal(validateSourceUrl('http://127.0.0.1/rss').isValid, false);
    assert.equal(validateSourceUrl('http://169.254.169.254/latest/meta-data').isValid, false);
    assert.equal(validateSourceUrl('http://metadata.google.internal/computeMetadata/v1/').isValid, false);
    assert.equal(validateSourceUrl('http://192.168.1.1/router').isValid, false);
    assert.equal(validateSourceUrl('http://10.0.0.1/admin').isValid, false);
  });

  test('SSRF Guard: rejects protocol-relative URLs, credentials, and non-http protocols', () => {
    assert.equal(validateSourceUrl('ftp://example.com/feed').isValid, false);
    assert.equal(validateSourceUrl('file:///etc/passwd').isValid, false);
    assert.equal(validateSourceUrl('http://admin:secret@example.com/rss').isValid, false);
    assert.equal(validateSourceUrl('http://example.com:8080/feed').isValid, false); // Non-standard port
  });

  test('SSRF Guard: permits valid public government and news URLs', () => {
    assert.equal(validateSourceUrl('https://doda.gov.in/').isValid, true);
    assert.equal(validateSourceUrl('https://pib.gov.in/ViewRss.aspx?lang=1&reg=1').isValid, true);
    assert.equal(validateSourceUrl('https://news.un.org/feed/subscribe/en/news/all/rss.xml').isValid, true);
  });

  // 2. District & Division Taxonomy Classification
  test('District Classification: extracts J&K districts and assigns correct division', () => {
    const dodaMatch = classifyDistrict('Major cloudburst reported near Kahara tehsil in Doda district');
    assert.ok(dodaMatch);
    assert.equal(dodaMatch?.districtSlug, 'doda');
    assert.equal(dodaMatch?.districtName, 'Doda');
    assert.equal(dodaMatch?.division, 'Chenab Valley');

    const kishtwarMatch = classifyDistrict('Heavy snowfall suspends movement near Sinthan Top');
    assert.ok(kishtwarMatch);
    assert.equal(kishtwarMatch?.districtSlug, 'kishtwar');
    assert.equal(kishtwarMatch?.division, 'Chenab Valley');

    const poonchMatch = classifyDistrict('Cross-border movement halts at Chakan Da Bagh in Poonch');
    assert.ok(poonchMatch);
    assert.equal(poonchMatch?.districtSlug, 'poonch');
    assert.equal(poonchMatch?.division, 'Pir Panjal');
  });

  // 3. Event Categorization
  test('Category Classification: correctly categorizes distinct event types', () => {
    assert.equal(
      classifyEventCategory('Landslide blocks traffic on Jammu-Srinagar Highway at Panthyal'),
      'road_closures'
    );
    assert.equal(
      classifyEventCategory('Tragic road accident as cab plunges into gorge, 4 passengers injured'),
      'accidents'
    );
    assert.equal(
      classifyEventCategory('IMD alert warns of heavy snowfall and avalanche threat in higher reaches'),
      'weather_disaster'
    );
    assert.equal(
      classifyEventCategory('District administration issues order declaring schools closed due to severe cold'),
      'school_closures'
    );
    assert.equal(
      classifyEventCategory('WHO releases epidemiological alert regarding disease outbreak'),
      'public_health'
    );
  });

  // 4. Official Government Response Matching
  test('Response Matcher: confirms relevance when official order matches district, subject, and time window', () => {
    const event = {
      headline: 'Heavy snowfall blocks Batote-Kishtwar highway near Pul Doda',
      summary: 'Vehicular traffic halted following overnight snowfall and shooting stones.',
      districtSlug: 'doda',
      division: 'Chenab Valley',
      eventCategory: 'road_closures' as const,
      eventDate: new Date().toISOString(),
    };

    const notices = [
      {
        title: 'District Magistrate Doda issues traffic advisory for Batote-Kishtwar road',
        url: 'https://doda.gov.in/orders/traffic-closure-2026',
        publishedAt: new Date().toISOString(),
        excerpt: 'In view of shooting stones in Doda, vehicular movement suspended until clearance.',
        sourceName: 'District Doda Administration',
        sourceAuthority: 'District Magistrate, Doda',
      },
    ];

    const match = matchEventWithOfficialResponses(event, notices, false);
    assert.equal(match.matchStatus, 'confirmed_relevant');
    assert.equal(match.authorityName, 'District Magistrate, Doda');
    assert.ok(match.documentUrl);
    assert.ok(match.matchExplanation.includes('Confirmed Relevant'));
  });

  test('Response Matcher: marks possible match (needs verification) if notice is proximate but unconfirmed', () => {
    const event = {
      headline: 'Accident reported near Assar in Doda',
      summary: 'Vehicle skidded off the road.',
      districtSlug: 'doda',
      division: 'Chenab Valley',
      eventCategory: 'accidents' as const,
      eventDate: new Date().toISOString(),
    };

    const notices = [
      {
        title: 'General police administrative transfer list issued',
        url: 'https://jkpolice.gov.in/transfers',
        publishedAt: new Date().toISOString(),
        excerpt: 'Police officers transferred across Jammu and Doda ranges.',
        sourceName: 'J&K Police',
        sourceAuthority: 'J&K Police HQ',
      },
    ];

    const match = matchEventWithOfficialResponses(event, notices, false);
    // Unrelated notice mentioning Doda range is NOT treated as confirmed response!
    assert.notEqual(match.matchStatus, 'confirmed_relevant');
  });

  test('Response Matcher: returns no_official_update when no relevant notice exists in sources', () => {
    const event = {
      headline: 'Water supply pipeline burst in Banihal',
      summary: 'Residents face water disruption.',
      districtSlug: 'ramban',
      division: 'Chenab Valley',
      eventCategory: 'public_services' as const,
      eventDate: new Date().toISOString(),
    };

    const match = matchEventWithOfficialResponses(event, [], false);
    assert.equal(match.matchStatus, 'no_official_update');
    assert.equal(match.matchExplanation, 'No matching official update found in the sources checked.');
  });

  test('Response Matcher: distinguishes check_failed when official source was unreachable', () => {
    const event = {
      headline: 'Bridge damaged in Kishtwar',
      summary: 'Flash flood damages wooden bridge.',
      districtSlug: 'kishtwar',
      division: 'Chenab Valley',
      eventCategory: 'weather_disaster' as const,
      eventDate: new Date().toISOString(),
    };

    const match = matchEventWithOfficialResponses(
      event,
      [],
      true,
      'Connection timed out after 8000ms'
    );

    assert.equal(match.matchStatus, 'check_failed');
    assert.ok(match.matchExplanation.includes('Source check failed'));
    // Crucial rule: source failure must NOT be reported as "no government response exists"
    assert.notEqual(match.matchStatus, 'no_official_update');
  });

  // 5. YouTube Monitor Ownership Gate
  test('YouTube Monitor: rejects unapproved channels', async () => {
    const result = await collectApprovedYouTubeChannel(
      'UC12345678901234567890',
      'Test News Channel',
      false // Not owner approved
    );
    assert.equal(result.success, false);
    assert.ok(result.error?.includes('not marked as owner-approved'));
  });

  // 6. Gemini Drafter & Fact-Check Generation
  test('Gemini Drafter: generates structured draft with fact-checking checklist and explicit absence of order', async () => {
    const event = {
      headline: 'Power supply snapped in several Chenab Valley hamlets following heavy snowfall',
      summary: 'Electricity infrastructure damaged in Doda and Kishtwar sub-divisions.',
      districtName: 'Doda',
      locationName: 'Bhaderwah & Doda',
      eventCategory: 'public_services',
      eventDate: new Date().toISOString(),
      sources: [
        {
          sourceName: 'Regional Newsroom Monitor',
          url: 'https://pib.gov.in/test-article',
          title: 'Power towers damaged in upper Doda',
        },
      ],
      officialResponse: {
        matchStatus: 'no_official_update' as const,
        authorityName: 'District Administration',
        documentTitle: null,
        documentUrl: null,
        publishedAt: null,
        responseType: 'none' as const,
        matchExplanation: 'No matching official update found in the sources checked.',
        extractedTextExcerpt: null,
      },
    };

    const draft = await generateNewsroomDraft(event);
    assert.ok(draft.title.length > 5);
    assert.ok(draft.excerpt.length > 10);
    assert.ok(draft.content.includes('<p>'));
    // Explicit safeguard: states that no official directive was confirmed
    assert.ok(
      draft.content.includes('no matching official directive') ||
      draft.content.includes('no official advisory') ||
      draft.content.includes('Official Status')
    );
    // Verifies fact-check checklist is populated
    assert.ok(draft.claimsToVerify.length >= 2);
  });

  test('Slug Generator: produces URL-friendly slug', () => {
    const slug = generateSlug('Major Landslide Blocks Jammu-Srinagar Highway at Panthyal');
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
