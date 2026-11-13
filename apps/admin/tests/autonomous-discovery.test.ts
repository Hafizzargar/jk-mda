import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KJIN_REGIONAL_TARGETS,
  DISCOVERY_BEATS,
  calculateHeadlineSimilarity,
  classifyArticleRegion,
  selectNextPrioritizedBeat,
  isBreakingNewsEvent,
  type RegionalDailyStats,
} from '../lib/newsroom/autonomous-discovery.ts';

describe('P0: KJIN Autonomous News Discovery & Regional Quotas', () => {
  it('enforces the exact 7-region daily editorial distribution and targets', () => {
    assert.strictEqual(KJIN_REGIONAL_TARGETS.length, 7, 'Must have exactly 7 coverage regions');

    const chenab = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'chenab_valley');
    assert.ok(chenab);
    assert.strictEqual(chenab.min, 3, 'Chenab Valley min must be 3');
    assert.strictEqual(chenab.max, 6, 'Chenab Valley max must be 6');
    assert.strictEqual(chenab.weight, 3, 'Chenab Valley must have highest weight (3)');
    assert.deepStrictEqual(chenab.districts, ['doda', 'kishtwar', 'ramban']);

    const jammu = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'jammu');
    assert.ok(jammu);
    assert.strictEqual(jammu.min, 2, 'Jammu min must be 2');
    assert.strictEqual(jammu.max, 5, 'Jammu max must be 5');

    const kashmir = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'kashmir');
    assert.ok(kashmir);
    assert.strictEqual(kashmir.min, 2, 'Kashmir min must be 2');
    assert.strictEqual(kashmir.max, 5, 'Kashmir max must be 5');

    const leh = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'leh_ladakh');
    assert.ok(leh);
    assert.strictEqual(leh.min, 2, 'Leh min must be 2');
    assert.strictEqual(leh.max, 3, 'Leh max must be 3');
    assert.deepStrictEqual(leh.districts, ['leh', 'kargil']);

    const pirPanjal = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'pir_panjal');
    assert.ok(pirPanjal);
    assert.strictEqual(pirPanjal.min, 2, 'Pir Panjal min must be 2');
    assert.strictEqual(pirPanjal.max, 3, 'Pir Panjal max must be 3');
    assert.deepStrictEqual(pirPanjal.districts, ['poonch', 'rajouri']);

    const national = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'national');
    assert.ok(national);
    assert.strictEqual(national.min, 2, 'National min must be 2');
    assert.strictEqual(national.max, 5, 'National max must be 5');

    const international = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'international');
    assert.ok(international);
    assert.strictEqual(international.min, 4, 'International min must be 4');
    assert.strictEqual(international.max, 5, 'International max must be 5');

    // Aggregate totals: Min = 17, Max = 32
    const totalMin = KJIN_REGIONAL_TARGETS.reduce((sum, t) => sum + t.min, 0);
    const totalMax = KJIN_REGIONAL_TARGETS.reduce((sum, t) => sum + t.max, 0);
    assert.strictEqual(totalMin, 17, 'Total minimum daily stories must be 17');
    assert.strictEqual(totalMax, 32, 'Total maximum daily stories must be 32');

    // Regional minimum = 11 (64.7% ~ 65% of total min)
    const regionalMin = KJIN_REGIONAL_TARGETS.filter((t) => t.isRegional).reduce((sum, t) => sum + t.min, 0);
    assert.strictEqual(regionalMin, 11, 'Regional minimum must be 11 stories');
    const regionalShare = Math.round((regionalMin / totalMin) * 100);
    assert.strictEqual(regionalShare, 65, 'Regional coverage must account for approx 65% of minimum daily news target');
  });

  it('correctly classifies articles into distinct regional beats', () => {
    assert.strictEqual(
      classifyArticleRegion({ district: 'doda', title: 'Road repair begins on NH-244' }),
      'chenab_valley'
    );
    assert.strictEqual(
      classifyArticleRegion({ district: 'leh', title: 'Zojila pass reopens for commercial traffic' }),
      'leh_ladakh'
    );
    assert.strictEqual(
      classifyArticleRegion({ district: 'poonch', title: 'Border trade infrastructure reviewed at Chakan Da Bagh' }),
      'pir_panjal'
    );
    assert.strictEqual(
      classifyArticleRegion({ category: 'National', title: 'Supreme Court hears constitutional bench on federal powers' }),
      'national'
    );
    assert.strictEqual(
      classifyArticleRegion({ category: 'International', title: 'United Nations opens diplomatic summit in Geneva' }),
      'international'
    );
  });

  it('dynamically prioritizes underrepresented regions with largest deficit', () => {
    const mockStats: RegionalDailyStats = {
      totalDiscoveredToday: 5,
      regionalDiscoveredToday: 3,
      nationalInternationalDiscoveredToday: 2,
      regionalSharePercent: 60,
      targetOverview: { minDailyTotal: 17, maxDailyTotal: 32, preferredOperatingTarget: 25 },
      regions: [
        { id: 'chenab_valley', name: 'Chenab Valley', shortName: 'Chenab Valley', current: 0, min: 3, max: 6, deficit: 3, isMet: false, isMaxReached: false, isRegional: true },
        { id: 'jammu', name: 'Jammu Plains', shortName: 'Jammu', current: 1, min: 2, max: 5, deficit: 1, isMet: false, isMaxReached: false, isRegional: true },
        { id: 'kashmir', name: 'Kashmir Valley', shortName: 'Kashmir', current: 2, min: 2, max: 5, deficit: 0, isMet: true, isMaxReached: false, isRegional: true },
        { id: 'leh_ladakh', name: 'Leh & Ladakh', shortName: 'Leh', current: 0, min: 2, max: 3, deficit: 2, isMet: false, isMaxReached: false, isRegional: true },
        { id: 'pir_panjal', name: 'Pir Panjal', shortName: 'Pir Panjal', current: 0, min: 2, max: 3, deficit: 2, isMet: false, isMaxReached: false, isRegional: true },
        { id: 'national', name: 'National', shortName: 'National', current: 1, min: 2, max: 5, deficit: 1, isMet: false, isMaxReached: false, isRegional: false },
        { id: 'international', name: 'International', shortName: 'International', current: 1, min: 4, max: 5, deficit: 3, isMet: false, isMaxReached: false, isRegional: false },
      ],
    };

    const nextBeat = selectNextPrioritizedBeat(mockStats);
    assert.ok(nextBeat);
    // Chenab Valley has deficit 3 and weight 3, which outranks International (deficit 3, weight 2)
    assert.strictEqual(nextBeat.id, 'chenab_valley', 'Chenab Valley must be selected first due to highest regional deficit & weight');
  });

  it('identifies critical breaking news to override regional maximum caps', () => {
    assert.ok(isBreakingNewsEvent("Massive Earthquake of Magnitude 5.8 Jolts Doda & Kishtwar", "Strong tremors reported across Chenab Valley"));
    assert.ok(isBreakingNewsEvent("Cloudburst Triggers Flash Floods in Ramban District", "Vehicles submerged along National Highway"));
    assert.ok(isBreakingNewsEvent("Routine Review Meeting", "Important update", true)); // Explicit flag
    assert.ok(!isBreakingNewsEvent("Municipal Committee Announces Sanitation Drive", "Routine cleaning of wards scheduled"));
  });

  it('correctly calculates word-vector similarity for deduplication', () => {
    const headlineA = "Tragic Road Mishap on NH-244 near Assar Claims 4 Lives in Doda";
    const headlineB = "Doda Accident: 4 Killed as Vehicle Plunges into Gorge along NH-244 in Assar";
    const headlineC = "Ratle Hydroelectric Project on Chenab River Advances with ₹5,281 Crore Capital Outlay";

    const resultAB = calculateHeadlineSimilarity(headlineA, headlineB);
    assert.ok(resultAB.isDuplicate, 'Similar accident reports must be identified as duplicate');
    assert.ok(resultAB.matchCount >= 3, 'Must match key location & route identifiers (doda, assar, nh244)');

    const resultAC = calculateHeadlineSimilarity(headlineA, headlineC);
    assert.ok(!resultAC.isDuplicate, 'Different news events must not be identified as duplicate');
  });

  it('maintains backwards-compatible DISCOVERY_BEATS with non-local National and International scopes', () => {
    assert.ok(DISCOVERY_BEATS.length >= 6);
    const nationalBeat = DISCOVERY_BEATS.find((b) => b.scope === 'National');
    assert.strictEqual(nationalBeat?.targetDistricts?.length, 0, 'National beat must not be tied to local districts');

    const internationalBeat = DISCOVERY_BEATS.find((b) => b.scope === 'International');
    assert.strictEqual(internationalBeat?.targetDistricts?.length, 0, 'International beat must not be tied to local districts');
  });
});
