-- Migration: regional_divisions_and_leh
-- Expands division taxonomy to support 5 distinct regions:
-- 1. Kashmir Valley
-- 2. Jammu Plains
-- 3. Chenab Valley
-- 4. Pir Panjal Range
-- 5. Leh & Ladakh

BEGIN;

-- 1. Update check constraint on public.districts
ALTER TABLE public.districts DROP CONSTRAINT IF EXISTS districts_division_check;
ALTER TABLE public.districts ADD CONSTRAINT districts_division_check
  CHECK (division = ANY (ARRAY['Kashmir'::text, 'Jammu'::text, 'Chenab Valley'::text, 'Pir Panjal'::text, 'Leh & Ladakh'::text, 'Ladakh'::text]));

-- 2. Update divisions for Chenab Valley and Pir Panjal
UPDATE public.districts SET division = 'Chenab Valley', updated_at = NOW() WHERE slug IN ('doda', 'kishtwar', 'ramban');
UPDATE public.districts SET division = 'Pir Panjal', updated_at = NOW() WHERE slug IN ('rajouri', 'poonch');

-- 3. Insert Leh and Kargil districts if missing
INSERT INTO public.districts (slug, name_en, name_ur, name_hi, division, display_order, is_active)
VALUES
  ('leh', 'Leh', 'لیہہ', 'लेह', 'Leh & Ladakh', 21, true),
  ('kargil', 'Kargil', 'کرگل', 'कारगिल', 'Leh & Ladakh', 22, true)
ON CONFLICT (slug) DO UPDATE
SET division = 'Leh & Ladakh', name_en = EXCLUDED.name_en, is_active = true;

-- 4. Insert published articles for Leh and Kargil
SET session_replication_role = 'replica';

INSERT INTO public.articles (
  id,
  title,
  slug,
  excerpt,
  content,
  category,
  category_id,
  district,
  district_id,
  author_id,
  author_display_name,
  status,
  published_at,
  published_by,
  created_at,
  updated_at,
  view_count,
  featured_image_url,
  source_name,
  source_url
) VALUES
(
  'e0000001-0000-0000-0000-000000000021',
  'High-Altitude Geothermal and Solar Hybrid Grid Commissioned Across Eastern Leh Plateau',
  'high-altitude-geothermal-and-solar-hybrid-grid-commissioned-across-eastern-leh-plateau',
  'Renewable energy researchers and border power agencies inaugurate Ladakh first winter-resilient hybrid solar-geothermal installation, ensuring continuous energy for high-altitude hamlets.',
  '## Clean Power for Trans-Himalayan Hamlets

A landmark renewable energy project was formally commissioned in the eastern plateau of Leh this week, delivering reliable 24/7 power to remote high-altitude communities even as temperatures plummet below minus twenty degrees Celsius.

The installation pairs advanced bifacial solar photovoltaic arrays with closed-loop geothermal heat pumps, overcoming the seasonal freezing challenges that traditionally incapacitated lithium-ion battery banks during peak winter months.

### Transforming Winter Resilience in Ladakh

Engineers with the Ladakh Renewable Energy Development Agency confirmed that the microgrid supports over 450 households, local health wellness centres, and cold-storage facilities for regional agricultural produce.

"For decades, high-altitude villages relied on fossil-fuel generators during sub-zero months," said a senior project officer in Leh. "This indigenous hybrid grid demonstrates that clean, decentralized Himalayan energy is practical, ecologically protective, and economically sustainable."',
  'economy',
  (SELECT id FROM public.categories WHERE slug = 'economy' LIMIT 1),
  'leh',
  (SELECT id FROM public.districts WHERE slug = 'leh' LIMIT 1),
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '2 hours',
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours',
  312,
  'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80',
  'KJIN Leh Bureau',
  'https://kjin.org/dispatches/leh-geothermal-grid'
),
(
  'e0000001-0000-0000-0000-000000000022',
  'Zojila Tunnel Approach Works Expedited Ahead of Early Winter Frost in Kargil District',
  'zojila-tunnel-approach-works-expedited-ahead-of-early-winter-frost-in-kargil-district',
  'Infrastructure task forces complete critical avalanche-shelter sheds and reinforced snow galleries along the Western Kargil highway approach, reinforcing year-round transit connectivity.',
  '## Fortifying Strategic Himalayan Lifelines

Construction crews along the high-elevation Dras-Kargil axis have achieved critical breakthroughs this week on the approach viaducts and anti-avalanche cut-and-cover galleries flanking the Zojila Tunnel portal.

With winter weather systems approaching the upper ridges, specialized engineering units accelerated the installation of high-tensile rockfall barriers and heated roadway expansion joints designed to withstand heavy snow accumulation.

### Community Transit and Strategic Lifelines

Local logistics cooperatives and traders in Kargil town welcomed the rapid progress. For generations, seasonal closure of the high passes isolated the district for upwards of four months each year, inflating essentials prices and restricting emergency medical transfers.

"Maintaining continuous arterial transit between Srinagar, Kargil, and Leh is transformative for our families and schools," noted an elder from the Dras traders council. "Seeing these reinforced all-weather galleries come together brings immense confidence to the entire frontier valley."',
  'local',
  (SELECT id FROM public.categories WHERE slug = 'local' LIMIT 1),
  'kargil',
  (SELECT id FROM public.districts WHERE slug = 'kargil' LIMIT 1),
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '3 hours',
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours',
  284,
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  'KJIN Kargil Bureau',
  'https://kjin.org/dispatches/kargil-zojila-approach'
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  district = EXCLUDED.district,
  status = 'published',
  published_at = EXCLUDED.published_at;

SET session_replication_role = 'origin';

COMMIT;
