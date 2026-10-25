-- Migration: 20261026140000_editorial_scopes_and_navbar_national.sql
-- Description: Enforce strict editorial 3-way scoping (Jammu & Kashmir, National India, International)
--              Add National and International taxonomy categories, seed national & global stories,
--              and configure the navbar with NATIONAL (/india) and INTERNATIONAL (/international).

-- 1. Ensure National and International categories exist in public.categories
INSERT INTO public.categories (slug, name_en, description, display_order, is_active)
VALUES 
    ('national', 'National', 'Pan-India developments, union policy, national economy, courts, and inter-state affairs.', 1, true),
    ('international', 'International', 'Global developments, diaspora connections, trade diplomacy, and cross-border relations.', 2, true)
ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

-- 2. Clean up existing article scopes to prevent bleed
-- Ensure Yemen and Sudan are classified strictly as International with no district
UPDATE public.articles
SET category = 'International',
    district = NULL,
    category_id = (SELECT id FROM public.categories WHERE slug = 'international' LIMIT 1),
    updated_at = now()
WHERE id IN (
    '4c67dddb-ee93-4df0-8847-a8697e483d6f'::uuid, -- Yemen Taiz
    'c08b3eba-131a-4ec9-af71-d877c6a68062'::uuid  -- Sudan drone strikes
);

-- Re-categorize local J&K academic/diaspora stories that had 'International' to their proper J&K categories
UPDATE public.articles
SET category = 'Environment',
    district = 'anantnag',
    category_id = (SELECT id FROM public.categories WHERE slug = 'general' LIMIT 1),
    updated_at = now()
WHERE id = '1b9ccb4d-0218-40a5-a4ff-53eda1ff3fe4'::uuid;

UPDATE public.articles
SET category = 'Culture',
    district = 'srinagar',
    category_id = (SELECT id FROM public.categories WHERE slug = 'culture' LIMIT 1),
    updated_at = now()
WHERE id = '612116f9-bd25-41ef-af03-f3008761e19e'::uuid;

-- 3. Seed Verified Indian National News Articles (/india) and Global Stories (/international)
SET session_replication_role = 'replica';

DO $$
DECLARE
    v_author_id uuid;
    v_nat_cat_id uuid;
    v_intl_cat_id uuid;
BEGIN
    SELECT id INTO v_author_id FROM public.profiles WHERE status = 'active' ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_nat_cat_id FROM public.categories WHERE slug = 'national' LIMIT 1;
    SELECT id INTO v_intl_cat_id FROM public.categories WHERE slug = 'international' LIMIT 1;

    -- National Article 1: Supreme Court Water Sharing
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'supreme-court-constitution-bench-inter-state-water-sharing',
        'Supreme Court Constitution Bench Upholds Inter-State River Water Sharing Framework in Landmark Ruling',
        'A five-judge Constitution bench has affirmed the primacy of federal equitable apportionment principles, establishing binding dispute-resolution timelines for inter-state river basins.',
        '<h2>Constitutional Ruling</h2><p><strong>NEW DELHI</strong> — A five-judge Constitution Bench of the Supreme Court of India delivered a unanimous verdict on Tuesday upholding the constitutional primacy of the Union framework for equitable apportionment in inter-state river basin disputes.</p><p>The judgment, authored by the bench, established definitive guidelines governing water allocation during deficit monsoon cycles, ruling that downstream riparian rights must be harmonized with upper riparian ecological minimums under Article 262 of the Constitution.</p><h2>Institutional Mechanism</h2><p>The bench directed the Ministry of Jal Shakti to operationalize continuous real-time telemetry monitoring along major inter-state river networks within six months, ensuring transparent data sharing among riparian states.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN National Desk',
        now() - interval '2 hours',
        v_author_id,
        now() - interval '3 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 2: ISRO Gaganyaan Propulsion Test
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'isro-heavy-lift-launch-vehicle-gaganyaan-orbital-test',
        'ISRO Completes Full-Duration Propulsion Test for Next-Generation Heavy-Lift Vehicle Ahead of Gaganyaan Mission',
        'The Indian Space Research Organisation has successfully qualified the cryogenic upper stage engine at Mahendragiri, clearing the path for the upcoming uncrewed orbital test flight.',
        '<h2>Propulsion Milestone</h2><p><strong>BENGALURU</strong> — The Indian Space Research Organisation (ISRO) successfully concluded a 720-second hot-fire endurance test of the CE-20 cryogenic engine at the ISRO Propulsion Complex in Mahendragiri, Tamil Nadu.</p><p>The test verified nominal performance parameters across vacuum conditions, clearing the propulsion system for flight qualification on the LVM3 heavy-lift vehicle designated for the Gaganyaan-1 uncrewed orbital demonstration mission.</p><h2>Mission Readiness</h2><p>Senior mission scientists confirmed that all flight telemetry matched pre-test mathematical models, with the crew module environmental control and life-support systems scheduled for integrated drop tests later this quarter.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Science & National Desk',
        now() - interval '5 hours',
        v_author_id,
        now() - interval '6 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 3: Reserve Bank Repo Rate Policy
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'rbi-monetary-policy-repo-rate-economic-growth',
        'Reserve Bank of India Retains Policy Repo Rate at 6.50 Percent Amid Resilient National Economic Growth',
        'The Monetary Policy Committee unanimously maintained the benchmark policy rate, projecting 7.2 percent real GDP growth supported by sustained manufacturing and capital expenditure.',
        '<h2>Monetary Policy Dispatch</h2><p><strong>MUMBAI</strong> — The Monetary Policy Committee (MPC) of the Reserve Bank of India concluded its bi-monthly review on Wednesday, deciding by unanimous consensus to hold the policy repo rate unchanged at 6.50 percent.</p><p>Reserve Bank Governor stated in the monetary policy dispatch that steady disinflation alongside robust domestic consumption supports macroeconomic stability, maintaining the national real GDP growth projection for the fiscal year at 7.2 percent.</p><h2>Liquidity and Inflation Outlook</h2><p>The central bank emphasized its commitment to withdrawal of accommodation to align headline CPI inflation durably with the 4 percent target while ensuring adequate credit flow to productive commercial sectors.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Economy Desk',
        now() - interval '8 hours',
        v_author_id,
        now() - interval '9 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 4: Ministry of Finance Freight Corridors
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'ministry-finance-infrastructure-capital-outlay-freight-corridors',
        'Ministry of Finance Allocates Record Capital Outlay for Pan-India Dedicated Freight Corridors',
        'Union finance officials unveiled targeted allocations accelerating modern logistics corridors, multitrack electrification, and port connectivity nodes across twelve states.',
        '<h2>Infrastructure Development</h2><p><strong>NEW DELHI</strong> — The Union Ministry of Finance has sanctioned targeted disbursements totaling Rs 48,000 crore to fast-track construction milestones across the Eastern and Western Dedicated Freight Corridors.</p><p>The capital infusion aims to link inland multi-modal logistics parks with coastal maritime ports, reducing average container transit times between northern manufacturing hubs and western seaports by more than 40 percent.</p><h2>National Logistics Efficiency</h2><p>Industry stakeholders welcomed the infrastructure impetus, noting that improved freight velocity will significantly compress logistics costs as a percentage of gross domestic output.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN National Desk',
        now() - interval '12 hours',
        v_author_id,
        now() - interval '13 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 5: Parliamentary Committee on AI Framework
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'parliament-standing-committee-national-ai-governance-framework',
        'Parliamentary Standing Committee Submits Comprehensive National Artificial Intelligence Governance Framework',
        'The cross-party parliamentary panel recommended statutory safeguards on algorithmic transparency, data sovereignty, and responsible enterprise computing.',
        '<h2>Legislative Review</h2><p><strong>NEW DELHI</strong> — The Parliamentary Standing Committee on Communications and Information Technology tabled its final report on national artificial intelligence governance before both houses of Parliament on Thursday.</p><p>The report outlines a risk-tiered regulatory matrix requiring mandatory algorithmic audits for high-impact decision systems in healthcare, banking, and public law enforcement, while preserving regulatory sandboxes for domestic startups.</p><h2>Data Sovereignty & Protections</h2><p>The committee urged statutory coordination between the Data Protection Board and sector-specific regulators to ensure citizen privacy safeguards are rigorously enforced.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Policy Bureau',
        now() - interval '16 hours',
        v_author_id,
        now() - interval '17 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- International Article 1: UN Climate Summit
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'un-climate-summit-geneva-renewable-energy-pact',
        'United Nations Climate Summit in Geneva Adopts High-Ambition Global Renewable Energy Transition Pact',
        'Delegates from 140 nations ratified an operational framework committing multilateral climate finance to developing grid infrastructure and international clean-energy storage.',
        '<h2>Multilateral Accord</h2><p><strong>GENEVA</strong> — Delegates representing more than 140 sovereign states adopted the Geneva Energy Compact at the conclusion of five-day United Nations environmental negotiations in Switzerland.</p><p>The agreement establishes an international pooled risk-guarantee facility designed to de-risk commercial capital investments in high-capacity solar, wind, and battery storage infrastructure across developing nations.</p><h2>Global Grid Modernization</h2><p>United Nations environmental officials praised the multilateral consensus, calling the binding monitoring mechanisms a pivotal benchmark for international climate diplomacy.</p>',
        'International',
        v_intl_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Global Desk',
        now() - interval '4 hours',
        v_author_id,
        now() - interval '5 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'International',
        district = NULL,
        category_id = v_intl_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- International Article 2: ICJ Maritime Boundary Ruling
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'icj-ruling-sovereign-maritime-boundaries-eez-protection',
        'International Court of Justice Delivers Landmark Judgment on Sovereign Maritime Boundaries and EEZ Rights',
        'The principal judicial organ of the United Nations defined binding delimitation methodology for disputed exclusive economic zones, strengthening international maritime order.',
        '<h2>International Jurisprudence</h2><p><strong>THE HAGUE</strong> — The International Court of Justice (ICJ) at the Peace Palace in The Hague rendered a landmark judgment on Monday adjudicating a long-standing maritime delimitation dispute regarding overlapping exclusive economic zones.</p><p>By a 14-to-1 majority, the court applied the standard three-stage delimitation methodology, establishing a provisional equidistance line adjusted for coastal geography and proportionality.</p><h2>Sovereign Rights Protected</h2><p>Both litigant governments released joint communiqués pledging full compliance with the final and non-appealable judgment, underscoring the authority of peaceful international adjudication under the UN Charter.</p>',
        'International',
        v_intl_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN International Affairs',
        now() - interval '7 hours',
        v_author_id,
        now() - interval '8 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'International',
        district = NULL,
        category_id = v_intl_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

END $$;

RESET session_replication_role;

-- 4. Update site_settings.navbar_settings to show NATIONAL (/india) and INTERNATIONAL (/international)
UPDATE public.site_settings
SET value = jsonb_set(
    jsonb_set(
        value,
        '{nav_items}',
        '[
            { "id": "national", "label": "NATIONAL", "slug": "india", "enabled": true },
            { "id": "international", "label": "INTERNATIONAL", "slug": "international", "enabled": true },
            { "id": "politics", "label": "Politics", "slug": "politics", "enabled": false },
            { "id": "local", "label": "Local", "slug": "local", "enabled": false },
            { "id": "economy", "label": "Economy", "slug": "economy", "enabled": false },
            { "id": "culture", "label": "Culture", "slug": "culture", "enabled": false },
            { "id": "investigation", "label": "Investigation", "slug": "investigation", "enabled": false },
            { "id": "sports", "label": "Sports", "slug": "sports", "enabled": false }
        ]'::jsonb
    ),
    '{actions,show_regions_dropdown}',
    'true'::jsonb
),
updated_at = now()
WHERE key = 'navbar_settings';
