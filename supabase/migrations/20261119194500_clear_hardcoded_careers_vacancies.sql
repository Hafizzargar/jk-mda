-- ==============================================================================
-- Clear Hardcoded Careers Vacancies
-- Removes legacy hardcoded job vacancies from site_settings.careers_settings so that
-- newsroom administrators have full control over when to publish vacancies.
-- ==============================================================================

update public.site_settings
set value = jsonb_set(coalesce(value, '{}'::jsonb), '{jobs}', '[]'::jsonb),
    updated_at = now()
where key = 'careers_settings';
