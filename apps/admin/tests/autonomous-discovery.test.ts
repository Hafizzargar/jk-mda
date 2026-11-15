import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KJIN_REGIONAL_TARGETS,
  DISCOVERY_BEATS,
  DISTRICT_METADATA,
  detectArticleDistrict,
  selectTargetDistrictForBeat,
  calculateHeadlineSimilarity,
  classifyArticleRegion,
  selectNextPrioritizedBeat,
  isBreakingNewsEvent,
  getNewsroomStartOfDay,
  getDailyRegionalStats,
  type RegionalDailyStats,
  type DistrictDailyStat,
  getAutoPublishConfig,
  scheduleArticleAutoPublish,
  executeAutoPublishArticle,
  cancelArticleAutoPublish,
  processPendingAutoPublishes,
  getCivicProblemsDailyStatus,
  type ScheduledAutoPublishItem,
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

  it('correctly calculates newsroom start of day in canonical Asia/Kolkata (IST) timezone', () => {
    // 9:38 AM on 15-Nov-2026 IST
    const morningDate = new Date('2026-11-15T09:38:00+05:30');
    const startOfNov15 = getNewsroomStartOfDay(morningDate);

    // Midnight IST on 15-Nov-2026 is 18:30:00 UTC on 14-Nov-2026
    assert.strictEqual(startOfNov15.toISOString(), '2026-11-14T18:30:00.000Z');

    // 11:59 PM on 15-Nov-2026 IST
    const lateNightDate = new Date('2026-11-15T23:59:00+05:30');
    const startLateNight = getNewsroomStartOfDay(lateNightDate);
    assert.strictEqual(startLateNight.toISOString(), '2026-11-14T18:30:00.000Z');

    // Next day: 00:01 AM on 16-Nov-2026 IST -> Shifts to 16-Nov midnight IST (15-Nov 18:30:00 UTC)
    const nextDayDate = new Date('2026-11-16T00:01:00+05:30');
    const startOfNov16 = getNewsroomStartOfDay(nextDayDate);
    assert.strictEqual(startOfNov16.toISOString(), '2026-11-15T18:30:00.000Z');
  });

  it('resets all beat counts to 0 and re-engages full deficits on a new calendar day', async () => {
    // Simulated database articles from yesterday (14-Nov-2026)
    const yesterdayArticles = [
      { id: '1', title: 'Assar Bridge Repairs in Doda', district: 'doda', status: 'published', published_at: '2026-11-14T14:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '2', title: 'Kisthwar Hydropower Expansion', district: 'kishtwar', status: 'published', published_at: '2026-11-14T15:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '3', title: 'Bhadarwah Tourism Conclave', district: 'doda', status: 'published', published_at: '2026-11-14T16:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '4', title: 'Jammu Smart City Mobility', district: 'jammu', status: 'published', published_at: '2026-11-14T17:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '5', title: 'Kathua Industrial Corridor', district: 'kathua', status: 'published', published_at: '2026-11-14T18:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '6', title: 'Poonch Border Road Review', district: 'poonch', status: 'published', published_at: '2026-11-14T19:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '7', title: 'Rajouri Higher Education Drive', district: 'rajouri', status: 'published', published_at: '2026-11-14T20:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '8', title: 'Dal Lake De-weeding in Srinagar', district: 'srinagar', status: 'published', published_at: '2026-11-14T21:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '9', title: 'Leh Solar Power Grid', district: 'leh', status: 'published', published_at: '2026-11-14T22:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '10', title: 'Union Cabinet Approves Semiconductor Policy', category: 'National', status: 'published', published_at: '2026-11-14T22:30:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '11', title: 'UN Climate Summit in Baku', category: 'International', status: 'published', published_at: '2026-11-14T23:00:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
      { id: '12', title: 'Global Trade Bilateral Talks', category: 'International', status: 'published', published_at: '2026-11-14T23:30:00+05:30', created_at: '2026-11-14T12:00:00+05:30' },
    ];

    // Mock Supabase service
    const createMockSupabase = (rows: any[]) => ({
      from: () => ({
        select: () => ({
          or: (filterStr: string) => {
            // Extract the timestamp threshold from the .or() filter string
            // filter format: published_at.gte.2026-11-14T18:30:00.000Z,created_at.gte.2026-11-14T18:30:00.000Z
            const match = filterStr.match(/published_at\.gte\.([^,]+)/);
            const cutoffIso = match ? match[1] : '';
            const cutoff = new Date(cutoffIso).getTime();

            const filtered = rows.filter((r) => {
              const pubTime = r.published_at ? new Date(r.published_at).getTime() : 0;
              const createTime = r.created_at ? new Date(r.created_at).getTime() : 0;
              return pubTime >= cutoff || createTime >= cutoff;
            });
            return Promise.resolve({ data: filtered, error: null });
          },
        }),
      }),
    });

    // 1. Evaluate on Day 2 (15-Nov-2026 at 09:38 AM IST)
    const day2Date = new Date('2026-11-15T09:38:00+05:30');
    const mockService = createMockSupabase(yesterdayArticles);

    const day2Stats = await getDailyRegionalStats(mockService as any, day2Date);

    // On the new day, every count must be reset to 0!
    assert.strictEqual(day2Stats.totalDiscoveredToday, 0, 'Total discovered must be reset to 0 on new day');
    assert.strictEqual(day2Stats.totalPublishedToday, 0, 'Total published must be reset to 0 on new day');
    assert.strictEqual(day2Stats.regionalDiscoveredToday, 0, 'Regional count must be 0 on new day');
    assert.strictEqual(day2Stats.nationalInternationalDiscoveredToday, 0, 'National/International count must be 0 on new day');

    // Every regional beat must have current: 0 and full deficit to fulfill today's target
    for (const region of day2Stats.regions) {
      assert.strictEqual(region.current, 0, `${region.name} current count must be 0 on new day`);
      assert.strictEqual(region.published, 0, `${region.name} published count must be 0 on new day`);
      assert.strictEqual(region.deficit, region.min, `${region.name} deficit must equal its full min target`);
      assert.strictEqual(region.isMet, false, `${region.name} isMet must be false on new day`);
      assert.strictEqual(region.isMaxReached, false, `${region.name} isMaxReached must be false on new day`);
    }

    // Next beat selection: International has the largest deficit (4), so it is selected first
    const nextBeat = selectNextPrioritizedBeat(day2Stats);
    assert.ok(nextBeat);
    assert.strictEqual(nextBeat.id, 'international', 'International must be selected first due to highest initial deficit (4)');

    // 2. Now simulate discovering 1 article on Day 2 in Chenab Valley
    const todayArticle = {
      id: '13',
      title: 'New Health Center Commissioned in Gandoh Doda',
      district: 'doda',
      status: 'review',
      published_at: null,
      created_at: '2026-11-15T09:40:00+05:30',
    };
    const updatedService = createMockSupabase([...yesterdayArticles, todayArticle]);
    const updatedStats = await getDailyRegionalStats(updatedService as any, day2Date);

    assert.strictEqual(updatedStats.totalDiscoveredToday, 1, 'Today discovered count must now be 1');
    const chenabRegion = updatedStats.regions.find((r) => r.id === 'chenab_valley');
    assert.strictEqual(chenabRegion?.current, 1, 'Chenab Valley count must increment to 1');
    assert.strictEqual(chenabRegion?.deficit, 2, 'Chenab Valley deficit must drop from 3 to 2');
  });

  it('enforces district-level metadata, search queries, and default quotas for Chenab Valley', () => {
    assert.ok(DISTRICT_METADATA.doda, 'Doda must be in DISTRICT_METADATA');
    assert.strictEqual(DISTRICT_METADATA.doda.beatId, 'chenab_valley');
    assert.strictEqual(DISTRICT_METADATA.doda.name, 'Doda');
    assert.strictEqual(DISTRICT_METADATA.doda.defaultPriority, 'high');
    assert.ok(DISTRICT_METADATA.doda.searchQuery.includes('Doda'));

    assert.ok(DISTRICT_METADATA.kishtwar, 'Kishtwar must be in DISTRICT_METADATA');
    assert.strictEqual(DISTRICT_METADATA.kishtwar.beatId, 'chenab_valley');
    assert.strictEqual(DISTRICT_METADATA.kishtwar.name, 'Kishtwar');
    assert.strictEqual(DISTRICT_METADATA.kishtwar.defaultPriority, 'high');
    assert.ok(DISTRICT_METADATA.kishtwar.searchQuery.includes('Kishtwar'));

    assert.ok(DISTRICT_METADATA.ramban, 'Ramban must be in DISTRICT_METADATA');
    assert.strictEqual(DISTRICT_METADATA.ramban.beatId, 'chenab_valley');
    assert.strictEqual(DISTRICT_METADATA.ramban.name, 'Ramban');
    assert.ok(DISTRICT_METADATA.ramban.searchQuery.includes('Ramban'));
  });

  it('detectArticleDistrict accurately identifies district from explicit tags or text keywords', () => {
    assert.strictEqual(
      detectArticleDistrict({ district: 'doda', title: 'Road restoration update' }),
      'doda'
    );
    assert.strictEqual(
      detectArticleDistrict({ district: null, title: 'Fresh Snowfall Shuts Sinthan Top Pass in Kishtwar' }),
      'kishtwar'
    );
    assert.strictEqual(
      detectArticleDistrict({ district: null, excerpt: 'Landslide on Jammu-Srinagar Highway at Panthyal in Ramban cleared' }),
      'ramban'
    );
    assert.strictEqual(
      detectArticleDistrict({ district: null, content: 'Bhaderwah festival draws thousands of tourists' }),
      'doda'
    );
  });

  it('selectTargetDistrictForBeat prioritizes underrepresented districts and honors priorities', () => {
    const chenabBeat = KJIN_REGIONAL_TARGETS.find((t) => t.id === 'chenab_valley')!;
    assert.ok(chenabBeat);

    // Scenario A: Doda and Kishtwar both have deficit 1, but Doda is High priority, Ramban is Normal
    const districtStatsA: DistrictDailyStat[] = [
      { id: 'doda', name: 'Doda', beatId: 'chenab_valley', current: 0, published: 0, min: 1, max: 2, priority: 'high', deficit: 1, isMet: false, isMaxReached: false },
      { id: 'kishtwar', name: 'Kishtwar', beatId: 'chenab_valley', current: 0, published: 0, min: 1, max: 2, priority: 'normal', deficit: 1, isMet: false, isMaxReached: false },
      { id: 'ramban', name: 'Ramban', beatId: 'chenab_valley', current: 1, published: 1, min: 1, max: 2, priority: 'normal', deficit: 0, isMet: true, isMaxReached: false },
    ];

    const targetA = selectTargetDistrictForBeat(chenabBeat, districtStatsA);
    assert.strictEqual(targetA?.id, 'doda', 'High-priority district with deficit (Doda) must be chosen first');

    // Scenario B: Explicit district override requested (e.g. user specifically clicked Kishtwar)
    const targetB = selectTargetDistrictForBeat(chenabBeat, districtStatsA, 'kishtwar');
    assert.strictEqual(targetB?.id, 'kishtwar', 'Explicit district override must select Kishtwar');

    // Scenario C: All minimums met, pick district with headroom and highest priority
    const districtStatsC: DistrictDailyStat[] = [
      { id: 'doda', name: 'Doda', beatId: 'chenab_valley', current: 2, published: 2, min: 1, max: 2, priority: 'high', deficit: 0, isMet: true, isMaxReached: true },
      { id: 'kishtwar', name: 'Kishtwar', beatId: 'chenab_valley', current: 1, published: 1, min: 1, max: 3, priority: 'high', deficit: 0, isMet: true, isMaxReached: false },
      { id: 'ramban', name: 'Ramban', beatId: 'chenab_valley', current: 1, published: 1, min: 1, max: 2, priority: 'normal', deficit: 0, isMet: true, isMaxReached: false },
    ];
    const targetC = selectTargetDistrictForBeat(chenabBeat, districtStatsC);
    assert.strictEqual(targetC?.id, 'kishtwar', 'Kishtwar must be selected as it has headroom below max cap');
  });

  it('manages auto-approval lifecycle: scheduling with 5-minute delay, cancellation, and execution', async () => {
    let mockSettingsValue: any = {
      auto_publish_enabled: true,
      auto_publish_delay_minutes: 5,
      scheduled_queue: [],
    };

    let mockArticle: any = {
      id: 'art-001',
      title: 'Power Grid Infrastructure Upgraded in Kishtwar',
      status: 'review',
      author_id: 'owner-uuid-123',
      published_at: null,
      published_by: null,
    };

    let auditLogs: any[] = [];

    const mockService = {
      from: (table: string) => ({
        select: (cols?: string) => ({
          eq: (col: string, val: any) => ({
            maybeSingle: () => {
              if (table === 'site_settings' && col === 'key' && val === 'newsroom_auto_pilot') {
                return Promise.resolve({ data: { value: mockSettingsValue }, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
            single: () => {
              if (table === 'articles' && col === 'id' && val === mockArticle.id) {
                return Promise.resolve({ data: mockArticle, error: null });
              }
              return Promise.resolve({ data: null, error: new Error('Not found') });
            },
          }),
          in: (col: string, vals: any[]) => ({
            limit: () => Promise.resolve({ data: [{ id: 'owner-uuid-123' }], error: null }),
          }),
        }),
        upsert: (payload: any) => {
          if (table === 'site_settings') {
            mockSettingsValue = payload.value;
          }
          return Promise.resolve({ error: null });
        },
        update: (payload: any) => ({
          eq: (col: string, val: any) => {
            if (table === 'articles' && col === 'id' && val === mockArticle.id) {
              mockArticle = { ...mockArticle, ...payload };
            }
            if (table === 'site_settings' && col === 'key' && val === 'newsroom_auto_pilot') {
              mockSettingsValue = payload.value;
            }
            return Promise.resolve({ data: mockArticle, error: null });
          },
        }),
        insert: (payload: any) => {
          if (table === 'audit_logs') {
            auditLogs.push(payload);
          }
          return Promise.resolve({ data: payload, error: null });
        },
      }),
    };

    // 1. Test getAutoPublishConfig
    const config = await getAutoPublishConfig(mockService);
    assert.strictEqual(config.enabled, true, 'Auto-publish must be enabled');
    assert.strictEqual(config.delayMinutes, 5, 'Grace period must default to 5 minutes');

    // 2. Test scheduleArticleAutoPublish
    const scheduled = await scheduleArticleAutoPublish(mockService, {
      articleId: 'art-001',
      headline: 'Power Grid Infrastructure Upgraded in Kishtwar',
      summary: 'Kishtwar power infrastructure received major upgrades.',
      category: 'Development',
      scope: 'State',
      division: 'Chenab Valley',
      district: 'Kishtwar',
      sourceName: 'PIB J&K',
      delayMinutes: 5,
      authorId: 'owner-uuid-123',
    });

    assert.strictEqual(scheduled.articleId, 'art-001');
    assert.strictEqual(scheduled.status, 'pending');
    assert.ok(mockSettingsValue.scheduled_queue.length > 0, 'Queue must persist to site_settings');

    const scheduledDate = new Date(scheduled.scheduledFor).getTime();
    const expectedApprox = Date.now() + 5 * 60 * 1000;
    assert.ok(
      Math.abs(scheduledDate - expectedApprox) < 5000,
      'Scheduled time must be approximately 5 minutes in the future'
    );

    // 3. Test cancelArticleAutoPublish
    await cancelArticleAutoPublish(mockService, 'art-001');
    const cancelledItem = mockSettingsValue.scheduled_queue.find((i: any) => i.articleId === 'art-001');
    assert.strictEqual(cancelledItem?.status, 'cancelled', 'Status must be marked as cancelled');

    // 4. Test executeAutoPublishArticle (direct or timer execution)
    // Reset status to pending to simulate timer firing or publish now
    mockSettingsValue.scheduled_queue[0].status = 'pending';
    const pubResult = await executeAutoPublishArticle(mockService, 'art-001', 'owner-uuid-123');
    assert.strictEqual(pubResult.success, true, 'Auto-publish execution must succeed');
    assert.strictEqual(mockArticle.status, 'published', 'Article must transition to published');
    assert.ok(mockArticle.published_at, 'published_at must be populated');
    assert.strictEqual(mockArticle.published_by, 'owner-uuid-123', 'published_by must be populated');

    // Audit log check
    assert.ok(auditLogs.some((l) => l.action === 'article.auto_published'), 'Audit log must record auto-publish');
  });

  it('processPendingAutoPublishes automatically triggers publishing for matured schedule items', async () => {
    let mockArticle = {
      id: 'art-002',
      title: 'Doda Medical College Achieves Milestone',
      status: 'review',
      author_id: 'author-123',
      published_at: null,
      published_by: null,
    };

    const pastDate = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago (matured)
    let mockSettingsValue = {
      auto_publish_enabled: true,
      auto_publish_delay_minutes: 5,
      scheduled_queue: [
        {
          articleId: 'art-002',
          headline: 'Doda Medical College Achieves Milestone',
          category: 'Health',
          scheduledFor: pastDate,
          createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      ],
    };

    const mockService = {
      from: (table: string) => ({
        select: (cols?: string) => ({
          eq: (col: string, val: any) => ({
            maybeSingle: () => {
              if (table === 'site_settings') {
                return Promise.resolve({ data: { value: mockSettingsValue }, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
            single: () => {
              if (table === 'articles' && val === 'art-002') {
                return Promise.resolve({ data: mockArticle, error: null });
              }
              return Promise.resolve({ data: null, error: new Error('Not found') });
            },
          }),
          in: () => ({
            limit: () => Promise.resolve({ data: [{ id: 'author-123' }], error: null }),
          }),
        }),
        update: (payload: any) => ({
          eq: (col: string, val: any) => {
            if (table === 'articles' && val === 'art-002') {
              mockArticle = { ...mockArticle, ...payload };
            }
            if (table === 'site_settings') {
              mockSettingsValue = payload.value;
            }
            return Promise.resolve({ data: mockArticle, error: null });
          },
        }),
        insert: () => Promise.resolve({ error: null }),
      }),
    };

    const result = await processPendingAutoPublishes(mockService);
    assert.strictEqual(result.processed, 1, 'Must process 1 mature item');
    assert.strictEqual(result.publishedIds[0], 'art-002', 'Must have published art-002');
    assert.strictEqual(mockArticle.status, 'published', 'Article status must be updated to published');
  });

  it('accurately resolves Sarthal and Bani keywords to Kathua district', () => {
    const sarthalResult = detectArticleDistrict({
      title: 'Sarthal Road Cutoff Following Heavy Snowfall in Kathua Highlands',
      excerpt: 'Residents of Sarthal and Bani report complete mobile tower outage and water crisis.',
    });
    assert.strictEqual(sarthalResult, 'kathua', 'Sarthal headline must detect as kathua');

    const baniResult = detectArticleDistrict({
      title: 'Power Transformer Damaged in Bani Sub-Division',
      excerpt: 'Villagers demand immediate PDD replacement.',
    });
    assert.strictEqual(baniResult, 'kathua', 'Bani must detect as kathua');
  });

  it('enforces 2 civic problems per day with strict 6-hour interval pacing', async () => {
    const now = new Date('2026-11-15T16:00:00+05:30');

    // Case 1: 0 problems today -> Can discover immediately
    const mockService0 = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            gte: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    };
    const status0 = await getCivicProblemsDailyStatus(mockService0 as any, now);
    assert.strictEqual(status0.currentToday, 0);
    assert.strictEqual(status0.canDiscoverNow, true, '0 problems today must allow immediate discovery');
    assert.strictEqual(status0.hoursUntilNextAllowed, 0);

    // Case 2: 1 problem today published 2 hours ago (<6h) -> Blocked with remaining hours
    const published2hAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const mockService1Recent = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            gte: () => ({
              order: () => Promise.resolve({
                data: [{ id: 'prob-1', published_at: published2hAgo, created_at: published2hAgo }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const status1Recent = await getCivicProblemsDailyStatus(mockService1Recent as any, now);
    assert.strictEqual(status1Recent.currentToday, 1);
    assert.strictEqual(status1Recent.canDiscoverNow, false, '1 problem <6h ago must be blocked');
    assert.strictEqual(status1Recent.hoursUntilNextAllowed, 4);

    // Case 3: 1 problem today published 7 hours ago (>=6h) -> Allowed for Shift 2
    const published7hAgo = new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString();
    const mockService1Old = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            gte: () => ({
              order: () => Promise.resolve({
                data: [{ id: 'prob-1', published_at: published7hAgo, created_at: published7hAgo }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const status1Old = await getCivicProblemsDailyStatus(mockService1Old as any, now);
    assert.strictEqual(status1Old.currentToday, 1);
    assert.strictEqual(status1Old.canDiscoverNow, true, '1 problem >=6h ago must allow Shift 2 discovery');
    assert.strictEqual(status1Old.hoursUntilNextAllowed, 0);

    // Case 4: 2 problems today (daily ceiling met) -> Blocked
    const mockService2 = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            gte: () => ({
              order: () => Promise.resolve({
                data: [
                  { id: 'prob-2', published_at: published2hAgo, created_at: published2hAgo },
                  { id: 'prob-1', published_at: published7hAgo, created_at: published7hAgo },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const status2 = await getCivicProblemsDailyStatus(mockService2 as any, now);
    assert.strictEqual(status2.currentToday, 2);
    assert.strictEqual(status2.canDiscoverNow, false, '2 problems today must hit daily ceiling');
  });
});
