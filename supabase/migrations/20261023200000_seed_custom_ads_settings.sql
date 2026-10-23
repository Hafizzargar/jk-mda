-- Seed default Custom Ads & Monetization configuration in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
    'custom_ads',
    '{
        "monetization_enabled": true,
        "contact_email_for_ads": "advertise@kjin.org",
        "contact_phone_for_ads": "+91 194 245 7777",
        "pricing_badge": "Reach 50,000+ J&K Readers Daily",
        "placements": [
            {
                "id": "leaderboard_top",
                "name": "Homepage Top Leaderboard",
                "enabled": true,
                "sponsor_name": "Kashmir Artisans & Heritage Guild",
                "badge_label": "Official Partner",
                "title": "Authentic Hand-Knotted Silk Carpets & Pashmina Shawls",
                "description": "Geographical Indication (GI) certified crafts delivered worldwide directly from valley master craftsmen.",
                "cta_text": "Shop Verified Collection",
                "destination_url": "https://kashmircrafts.org",
                "image_url": "https://images.unsplash.com/photo-1606744888344-493238955de0?auto=format&fit=crop&w=600&q=80",
                "theme_accent": "gold"
            },
            {
                "id": "sidebar_banner",
                "name": "Sidebar Right Rail Banner",
                "enabled": true,
                "sponsor_name": "Valley MedX Diagnostic Laboratories",
                "badge_label": "Health Sponsor",
                "title": "Comprehensive 72-Parameter Full Body Health Checkup",
                "description": "NABL Accredited center at Residency Road, Srinagar. Same-day digital reports & free home sample pickup.",
                "cta_text": "Book Home Pickup",
                "destination_url": "https://valleymedx.in",
                "image_url": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80",
                "theme_accent": "emerald"
            },
            {
                "id": "in_article_native",
                "name": "In-Article Native Sponsored Dispatch",
                "enabled": true,
                "sponsor_name": "Gulmarg Alpine Eco-Resorts",
                "badge_label": "Winter Season 2026",
                "title": "Experience First Snow in Gondola Valley: Early Bird Suites Open",
                "description": "Centrally heated pine chalets with panoramic views of Apharwat peak. Complimentary airport transfers included.",
                "cta_text": "Check Availability",
                "destination_url": "https://gulmargresorts.com",
                "image_url": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80",
                "theme_accent": "cyan"
            }
        ]
    }'::jsonb,
    'Configurable custom advertising placements, sponsor banners, and commercial revenue slots.'
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
