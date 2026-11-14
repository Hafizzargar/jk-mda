import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineAccurateNewsScope,
  determineDatelineForScope,
  sanitizeDatelineForScope,
  getRecommendedEditorialImage,
} from '../lib/newsroom/ai-synthesizer.ts';
import { getCanonicalCategory } from '../lib/taxonomy-options.ts';

describe('AI Newsroom Scope, Dateline & Category Routing Integrity', () => {
  it('correctly classifies International news even if channel region is tagged J&K', () => {
    const scope1 = determineAccurateNewsScope(
      'Trump and Netanyahu Hold Bilateral Strategy Talks on Gaza Ceasefire Protocol',
      'High-level diplomacy resumes in Washington as Middle East defense postures are reviewed',
      'Jammu & Kashmir'
    );
    assert.equal(scope1, 'International');

    const scope2 = determineAccurateNewsScope(
      'Ukraine Frontline Update: Kyiv Reports Air Defense Interceptions in Eastern Sector',
      'European defense ministries commit new tactical equipment to support territorial integrity',
      'Jammu & Kashmir'
    );
    assert.equal(scope2, 'International');
  });

  it('correctly classifies National news without falsely labeling as J&K', () => {
    const scope = determineAccurateNewsScope(
      "Namit Malhotra's 'Ramayana' Epic Garners Global Acclaim, Redefining Indian Storytelling on World Stage",
      "Producer Namit Malhotra and director Nitesh Tiwari's ambitious Bollywood epic achieves international critical acclaim following worldwide theatrical release",
      'India'
    );
    assert.equal(scope, 'National');
  });

  it('correctly classifies Chenab Valley and J&K local stories', () => {
    const chenab = determineAccurateNewsScope(
      'Traffic Advisory on NH-244: Landslide Cleared Near Assar Gorge in Doda',
      'Sub-divisional administration coordinates road clearance machinery along Batote-Kishtwar highway'
    );
    assert.equal(chenab, 'Chenab Valley');

    const jk = determineAccurateNewsScope(
      'Srinagar Administrative Council Reviews Smart City Riverfront Enhancements',
      'Divisional commissioner leads review of Dal Lake water filtration and heritage transit links'
    );
    assert.equal(jk, 'State (Jammu & Kashmir)');
  });

  it('generates accurate journalistic datelines based on scope and never hallucinates Srinagar for National/International stories', () => {
    const intlDateline = determineDatelineForScope(
      'International',
      'White House press briefing in Washington details new transatlantic bilateral accords'
    );
    assert.equal(intlDateline, 'WASHINGTON –');

    const intlGlobal = determineDatelineForScope(
      'International',
      'Multilateral maritime coalition monitors Red Sea merchant shipping lanes'
    );
    assert.equal(intlGlobal, 'GLOBAL DESK –');
    assert.doesNotMatch(intlGlobal, /SRINAGAR/i);

    const natDateline = determineDatelineForScope(
      'National',
      'Bollywood producers in Mumbai celebrate box office milestone for historical epic'
    );
    assert.equal(natDateline, 'MUMBAI –');
    assert.doesNotMatch(natDateline, /SRINAGAR/i);

    const natDelhi = determineDatelineForScope(
      'National',
      'Supreme Court bench in New Delhi issues constitutional directive on electoral disclosures'
    );
    assert.equal(natDelhi, 'NEW DELHI –');

    const localDateline = determineDatelineForScope('Chenab Valley', 'Crash reported near Assar in Doda', 'Doda');
    assert.equal(localDateline, 'DODA –');
  });

  it('sanitizes and replaces hallucinated Srinagar datelines from National/International articles', () => {
    const rawNationalSummary =
      "SRINAGAR, J&K – Producer Namit Malhotra and director Nitesh Tiwari's ambitious ₹4,000-crore epic, 'Ramayana' has achieved critical acclaim.";
    const sanitized = sanitizeDatelineForScope(rawNationalSummary, 'National', 'MUMBAI –');

    assert.equal(
      sanitized,
      "MUMBAI – Producer Namit Malhotra and director Nitesh Tiwari's ambitious ₹4,000-crore epic, 'Ramayana' has achieved critical acclaim."
    );
    assert.doesNotMatch(sanitized, /SRINAGAR/i);

    const rawIntlSummary =
      'SRINAGAR, J&K – Diplomatic envoys at the United Nations security council passed a binding resolution.';
    const sanitizedIntl = sanitizeDatelineForScope(rawIntlSummary, 'International', 'UNITED NATIONS –');
    assert.equal(
      sanitizedIntl,
      'UNITED NATIONS – Diplomatic envoys at the United Nations security council passed a binding resolution.'
    );
    assert.doesNotMatch(sanitizedIntl, /SRINAGAR/i);

    // Never attach datelines before markdown headings or duplicate them
    const badHeadingText = `NEW DELHI – ### Executive Dispatch & Ground Overview\n\nNEW DELHI – In the wake of the critically panned Adipurush...`;
    const cleanHeadingText = sanitizeDatelineForScope(badHeadingText, 'National', 'NEW DELHI –');
    assert.ok(!cleanHeadingText.includes('NEW DELHI – ###'), 'must not prepend dateline before markdown heading');
    assert.ok(cleanHeadingText.startsWith('### Executive Dispatch'), 'must start cleanly with the heading');
    assert.ok(cleanHeadingText.includes('NEW DELHI – In the wake of'), 'must preserve single dateline on first paragraph');
    assert.ok(!cleanHeadingText.includes('NEW DELHI – NEW DELHI –'), 'must not duplicate datelines');
  });

  it('getCanonicalCategory routes National and International scopes without being hijacked by channel defaults', () => {
    // Channel has default 'Local News', but video scope is National
    const nationalCat = getCanonicalCategory('Local News', 'National');
    assert.equal(nationalCat.name, 'National');
    assert.equal(nationalCat.slug, 'national');

    // Channel has default 'Local News', but video scope is International
    const intlCat = getCanonicalCategory('Local News', 'International');
    assert.equal(intlCat.name, 'International');
    assert.equal(intlCat.slug, 'international');

    // Channel has regional video in J&K
    const localCat = getCanonicalCategory('Local News', 'State (Jammu & Kashmir)');
    assert.equal(localCat.name, 'Local News');
    assert.equal(localCat.slug, 'local');
  });

  it('selects thematic editorial images matching the exact topic discussed', () => {

    // 1. Cinema / Bollywood / Namit Malhotra Ramayana
    const cinemaImg = getRecommendedEditorialImage(
      'National',
      'Culture',
      "Namit Malhotra's 'Ramayana' Epic Garners Global Acclaim, Redefining Indian Cinema on World Stage"
    );
    assert.equal(cinemaImg.alternatives[0]?.category, 'Culture & Entertainment');
    assert.ok(cinemaImg.featuredImage?.includes('photo-1489599849927-2ee91cede3ba'));

    // 2. Highway / Transit / Accidents
    const transitImg = getRecommendedEditorialImage(
      'Chenab Valley',
      'General',
      'Fatal road mishap on NH-244: Passenger bus plunges into gorge near Assar in Doda district'
    );
    assert.equal(transitImg.alternatives[0]?.category, 'Transit & Infrastructure');
    assert.ok(transitImg.featuredImage?.includes('photo-1469854523086-cc02fe5d8800'));

    // 3. Hydropower / Dam / Ratle
    const hydroImg = getRecommendedEditorialImage(
      'Chenab Valley',
      'Economy',
      'Ratle 850MW Hydroelectric Dam project on Chenab river reaches major milestone with CVPPPL'
    );
    assert.equal(hydroImg.alternatives[0]?.category, 'Hydropower & Energy');
    assert.ok(hydroImg.featuredImage?.includes('photo-1578328819058-b69f3a3b0f6b'));

    // 4. Agriculture / Apple Orchards
    const agriImg = getRecommendedEditorialImage(
      'State (Jammu & Kashmir)',
      'Economy',
      'Apple orchard farmers in Shopian and Sopore mandi report bumper harvest output'
    );
    assert.equal(agriImg.alternatives[0]?.category, 'Agriculture');
    assert.ok(agriImg.featuredImage?.includes('photo-1560493676-04071c5f467b'));

    // 5. Law & Judiciary / Court
    const legalImg = getRecommendedEditorialImage(
      'National',
      'Politics',
      'Supreme Court constitutional bench delivers landmark verdict on judicial appointments'
    );
    assert.equal(legalImg.alternatives[0]?.category, 'Law & Justice');
    assert.ok(legalImg.featuredImage?.includes('photo-1589829545856-d10d557cf95f'));
  });
});

