import type { SupabaseClient } from '@supabase/supabase-js';

export interface FooterContactSettings {
  organization_name: string;
  tagline: string;
  description: string;
  primary_address: string;
  primary_address_label: string;
  bureau_address: string;
  bureau_address_label: string;
  operating_hours: string;
  phone_primary: string;
  phone_primary_label: string;
  phone_secondary: string;
  phone_secondary_label: string;
  email_editorial: string;
  email_grievance: string;
  email_press: string;
  grievance_officer_name: string;
  registration_number: string;
  social_twitter: string;
  social_facebook: string;
  social_whatsapp: string;
  social_telegram: string;
  social_youtube: string;
}

export const DEFAULT_FOOTER_CONTACT: FooterContactSettings = {
  organization_name: 'KJIN (Kashmir & Jammu Information Network)',
  tagline: 'Verified Journalism & Public Affairs across Jammu & Kashmir',
  description: 'Independent, non-partisan journal of record dedicated to verified investigative reporting, regional public affairs, and civic documentation across Jammu, Kashmir, and Ladakh.',
  primary_address: 'Press Enclave, Residency Road, Srinagar, Jammu & Kashmir 190001',
  primary_address_label: 'Srinagar Central Bureau & Headquarters',
  bureau_address: 'Bahu Plaza Commercial Complex, Rail Head, Jammu, J&K 180012',
  bureau_address_label: 'Jammu Regional Bureau',
  operating_hours: 'Newsroom Desk: 24/7 Wire Operations • Administrative: Mon–Sat 9:30 AM – 6:00 PM IST',
  phone_primary: '+91 194 245 7800',
  phone_primary_label: 'Editorial Newsdesk Hotline',
  phone_secondary: '+91 94190 12345',
  phone_secondary_label: 'WhatsApp Secure Tip Line',
  email_editorial: 'editorial@kjin.org',
  email_grievance: 'grievance@kjin.org',
  email_press: 'press@kjin.org',
  grievance_officer_name: 'Adv. Bashir Ahmad (Public Grievance Redressal Officer)',
  registration_number: 'JK/REG/2026/0842 • Compliant with Information Technology (Intermediary Guidelines & Digital Media Ethics Code) Rules, 2021',
  social_twitter: 'https://twitter.com/kjin_live',
  social_facebook: 'https://facebook.com/kjinnews',
  social_whatsapp: 'https://whatsapp.com/channel/kjin',
  social_telegram: 'https://t.me/kjin_wire',
  social_youtube: 'https://youtube.com/@kjin_live',
};

export function sanitizeContactSettings(input: Partial<FooterContactSettings>): FooterContactSettings {
  return {
    organization_name: String(input.organization_name || DEFAULT_FOOTER_CONTACT.organization_name).trim().slice(0, 150),
    tagline: String(input.tagline || DEFAULT_FOOTER_CONTACT.tagline).trim().slice(0, 200),
    description: String(input.description || DEFAULT_FOOTER_CONTACT.description).trim().slice(0, 500),
    primary_address: String(input.primary_address || DEFAULT_FOOTER_CONTACT.primary_address).trim().slice(0, 300),
    primary_address_label: String(input.primary_address_label || DEFAULT_FOOTER_CONTACT.primary_address_label).trim().slice(0, 100),
    bureau_address: String(input.bureau_address || DEFAULT_FOOTER_CONTACT.bureau_address).trim().slice(0, 300),
    bureau_address_label: String(input.bureau_address_label || DEFAULT_FOOTER_CONTACT.bureau_address_label).trim().slice(0, 100),
    operating_hours: String(input.operating_hours || DEFAULT_FOOTER_CONTACT.operating_hours).trim().slice(0, 200),
    phone_primary: String(input.phone_primary || DEFAULT_FOOTER_CONTACT.phone_primary).trim().slice(0, 50),
    phone_primary_label: String(input.phone_primary_label || DEFAULT_FOOTER_CONTACT.phone_primary_label).trim().slice(0, 100),
    phone_secondary: String(input.phone_secondary || DEFAULT_FOOTER_CONTACT.phone_secondary).trim().slice(0, 50),
    phone_secondary_label: String(input.phone_secondary_label || DEFAULT_FOOTER_CONTACT.phone_secondary_label).trim().slice(0, 100),
    email_editorial: String(input.email_editorial || DEFAULT_FOOTER_CONTACT.email_editorial).trim().slice(0, 100),
    email_grievance: String(input.email_grievance || DEFAULT_FOOTER_CONTACT.email_grievance).trim().slice(0, 100),
    email_press: String(input.email_press || DEFAULT_FOOTER_CONTACT.email_press).trim().slice(0, 100),
    grievance_officer_name: String(input.grievance_officer_name || DEFAULT_FOOTER_CONTACT.grievance_officer_name).trim().slice(0, 150),
    registration_number: String(input.registration_number || DEFAULT_FOOTER_CONTACT.registration_number).trim().slice(0, 200),
    social_twitter: String(input.social_twitter || DEFAULT_FOOTER_CONTACT.social_twitter).trim().slice(0, 200),
    social_facebook: String(input.social_facebook || DEFAULT_FOOTER_CONTACT.social_facebook).trim().slice(0, 200),
    social_whatsapp: String(input.social_whatsapp || DEFAULT_FOOTER_CONTACT.social_whatsapp).trim().slice(0, 200),
    social_telegram: String(input.social_telegram || DEFAULT_FOOTER_CONTACT.social_telegram).trim().slice(0, 200),
    social_youtube: String(input.social_youtube || DEFAULT_FOOTER_CONTACT.social_youtube).trim().slice(0, 200),
  };
}

export async function getFooterContactSettings(supabase: SupabaseClient): Promise<FooterContactSettings> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'footer_contact')
      .maybeSingle();

    if (data?.value) {
      return sanitizeContactSettings(data.value as Partial<FooterContactSettings>);
    }
  } catch (err) {
    console.error('Failed to load footer contact settings from DB:', err);
  }
  return DEFAULT_FOOTER_CONTACT;
}
