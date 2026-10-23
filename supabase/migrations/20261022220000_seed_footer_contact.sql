-- Migration: Seed Footer & Contact Settings in site_settings
insert into public.site_settings (key, value, description)
values (
  'footer_contact',
  jsonb_build_object(
    'organization_name', 'KJIN (Kashmir & Jammu Information Network)',
    'tagline', 'Verified Journalism & Public Affairs across Jammu & Kashmir',
    'description', 'Independent, non-partisan journal of record dedicated to verified investigative reporting, regional public affairs, and civic documentation across Jammu, Kashmir, and Ladakh.',
    'primary_address', 'Press Enclave, Residency Road, Srinagar, Jammu & Kashmir 190001',
    'primary_address_label', 'Srinagar Central Bureau & Headquarters',
    'bureau_address', 'Bahu Plaza Commercial Complex, Rail Head, Jammu, J&K 180012',
    'bureau_address_label', 'Jammu Regional Bureau',
    'operating_hours', 'Newsroom Desk: 24/7 Wire Operations • Administrative: Mon–Sat 9:30 AM – 6:00 PM IST',
    'phone_primary', '+91 194 245 7800',
    'phone_primary_label', 'Editorial Newsdesk Hotline',
    'phone_secondary', '+91 94190 12345',
    'phone_secondary_label', 'WhatsApp Secure Tip Line',
    'email_editorial', 'editorial@kjin.org',
    'email_grievance', 'grievance@kjin.org',
    'email_press', 'press@kjin.org',
    'grievance_officer_name', 'Adv. Bashir Ahmad (Public Grievance Redressal Officer)',
    'registration_number', 'JK/REG/2026/0842 • Compliant with Information Technology (Intermediary Guidelines & Digital Media Ethics Code) Rules, 2021',
    'social_twitter', 'https://twitter.com/kjin_live',
    'social_facebook', 'https://facebook.com/kjinnews',
    'social_whatsapp', 'https://whatsapp.com/channel/kjin',
    'social_telegram', 'https://t.me/kjin_wire',
    'social_youtube', 'https://youtube.com/@kjin_live'
  ),
  'Public website footer contact info, bureau addresses, emails, and hotlines'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;
