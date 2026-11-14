-- Seed default Festive & Occasion Celebration configuration in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
    'festive_celebration',
    '{
        "enabled": true,
        "force_active_now": true,
        "mode": "scheduled",
        "start_date": "2026-11-14T00:00",
        "end_date": "2026-11-14T23:59",
        "occasion_name": "Diwali — Festival of Lights",
        "greeting_title": "Happy Deepavali to All!",
        "greeting_message": "May the festival of lights bring peace, brightness, and warmth to every home across Jammu & Kashmir and Ladakh.",
        "effect_type": "firelight_sparkles",
        "colors": ["#F59E0B", "#EF4444", "#FBBF24", "#D97706", "#10B981"],
        "duration_seconds": 8,
        "play_frequency": "always",
        "show_greeting_banner": true,
        "sound_enabled": false
    }'::jsonb,
    'Festive celebration overlay, firelight particle effects, and cultural greetings'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
