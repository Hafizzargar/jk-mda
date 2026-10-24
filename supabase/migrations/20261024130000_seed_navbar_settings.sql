-- Seed default Navbar & Header Navigation configuration in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
    'navbar_settings',
    '{
        "brand": {
            "logo_url": "/kjin-emblem.png",
            "show_logo_image": true,
            "name": "KJIN",
            "show_name": true,
            "tagline": "J&K Journal of Record",
            "show_tagline": true
        },
        "nav_items": [
            { "id": "politics", "label": "Politics", "slug": "politics", "enabled": true },
            { "id": "local", "label": "Local", "slug": "local", "enabled": true },
            { "id": "economy", "label": "Economy", "slug": "economy", "enabled": true },
            { "id": "culture", "label": "Culture", "slug": "culture", "enabled": true },
            { "id": "investigation", "label": "Investigation", "slug": "investigation", "enabled": true },
            { "id": "sports", "label": "Sports", "slug": "sports", "enabled": true },
            { "id": "international", "label": "International", "slug": "international", "enabled": true }
        ],
        "languages": {
            "enabled": true,
            "en": true,
            "ur": true,
            "ks": true,
            "hi": true
        },
        "top_strip": {
            "enabled": true,
            "show_date": true,
            "show_live_wire": true,
            "live_wire_label": "Live Verified Wire",
            "center_banner_text": "Jammu & Kashmir Journal of Record",
            "show_center_banner": true
        },
        "actions": {
            "show_regions_dropdown": true,
            "show_latest_wire_badge": true,
            "latest_wire_label": "Latest Wire",
            "show_submit_tip": true,
            "submit_tip_label": "Submit Tip",
            "submit_tip_url": "mailto:editorial@kjin.org?subject=News%20Tip%20Dispatch"
        }
    }'::jsonb,
    'Configurable public website navbar, brand identity, navigation categories, language switcher, and header tools.'
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
