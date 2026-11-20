-- Migration: 20261120101500_add_problems_category.sql
-- Description: Add 'problems' (Problems • Civic Issues) canonical category to public.categories

INSERT INTO public.categories (slug, name_en, name_ur, name_hi, description, display_order, is_active)
VALUES (
  'problems',
  'Problems',
  'عوامی مسائل',
  'समस्याएं एवं नागरिक मुद्दे',
  'In-depth citizen issues, road/water/power breakdowns, hospital shortages, and ground grievances raised on J&K issues.',
  2,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_ur = EXCLUDED.name_ur,
  name_hi = EXCLUDED.name_hi,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();
