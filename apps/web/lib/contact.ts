import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_DEVELOPER_SUPPORT,
  sanitizeDeveloperSupportSettings,
  type DeveloperSupportSettings,
} from './developer-support';

export interface FooterContactSettings {
  organization_name: string;
  tagline: string;
  description: string;
  editor_in_chief?: string;
  show_editor_in_chief?: boolean;
  developer_support?: DeveloperSupportSettings;
  primary_address: string;
  primary_address_label: string;
  show_primary_address?: boolean;
  bureau_address: string;
  bureau_address_label: string;
  show_bureau_address?: boolean;
  operating_hours: string;
  phone_primary: string;
  phone_primary_label: string;
  phone_secondary: string;
  phone_secondary_label: string;
  show_phone_numbers?: boolean;
  email_editorial: string;
  email_careers: string;
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
  organization_name: 'KJCPL News Network',
  tagline: 'Verified Journalism & Public Affairs across Jammu & Kashmir',
  description: 'Independent, non-partisan journal of record dedicated to verified investigative reporting, regional public affairs, and civic documentation across Jammu, Kashmir, and Ladakh.',
  editor_in_chief: 'Hafiz Zargar',
  show_editor_in_chief: true,
  developer_support: DEFAULT_DEVELOPER_SUPPORT,
  primary_address: 'Press Enclave, Residency Road, Srinagar, Jammu & Kashmir 190001',
  primary_address_label: 'Srinagar Central Bureau & Headquarters',
  show_primary_address: true,
  bureau_address: 'Bahu Plaza Commercial Complex, Rail Head, Jammu, J&K 180012',
  bureau_address_label: 'Jammu Regional Bureau',
  show_bureau_address: true,
  operating_hours: 'Newsroom Desk: 24/7 Wire Operations • Administrative: Mon–Sat 9:30 AM – 6:00 PM IST',
  phone_primary: '+91 6005950197',
  phone_primary_label: 'Editorial Newsdesk Hotlines',
  phone_secondary: '+91 6005950197',
  phone_secondary_label: 'WhatsApp Secure Tip Line',
  show_phone_numbers: true,
  email_editorial: 'news@kjcpl.site',
  email_careers: 'careers@kjcpl.site',
  email_grievance: 'grievance@kjcpl.site',
  email_press: 'press@kjcpl.site',
  grievance_officer_name: 'Adv. Bashir Ahmad (Public Grievance Redressal Officer)',
  registration_number: 'Compliant with Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021',
  social_twitter: 'https://twitter.com/kjcpl_news',
  social_facebook: 'https://facebook.com/kjcplnews',
  social_whatsapp: 'https://whatsapp.com/channel/kjcpl',
  social_telegram: 'https://t.me/kjcpl_news',
  social_youtube: 'https://youtube.com/@kjcpl_news',
};

export function cleanMojibake(str: string): string {
  if (!str) return '';
  return str
    .replace(/(?:â€¢|\u00e2\u0080\u00a2|\u00e2\u20ac\u00a2|\u00c3\u00a2\u00c2\u0080\u00c2\u00a2|\u00c3\u00a2\u20ac\u00c2\u00a2|â\u0080\u00a2|Ã¢â‚¬Â¢)/g, '•')
    .replace(/(?:â€“|\u00e2\u0080\u0093|\u00e2\u20ac\u201c|\u00c3\u00a2\u00c2\u0080\u00c2\u0093)/g, '–')
    .replace(/(?:â€”|\u00e2\u0080\u0094|\u00e2\u20ac\u201d|\u00c3\u00a2\u00c2\u0080\u00c2\u0094)/g, '—')
    .replace(/(?:â€˜|\u00e2\u0080\u0098|\u00e2\u20ac\u02dc|\u00c3\u00a2\u00c2\u0080\u00c2\u0098)/g, '‘')
    .replace(/(?:â€™|\u00e2\u0080\u0099|\u00e2\u20ac\u2122|\u00c3\u00a2\u00c2\u0080\u00c2\u0099)/g, '’')
    .replace(/(?:â€œ|\u00e2\u0080\u009c|\u00e2\u20ac\u0153|\u00c3\u00a2\u00c2\u0080\u00c2\u009c)/g, '“')
    .replace(/(?:â€\?|â€|\u00e2\u0080\u009d|\u00c3\u00a2\u00c2\u0080\u00c2\u009d)/g, '”')
    .replace(/JK\/REG\/2026\/0842\s*[^•\w\s]*\s*/gi, '')
    .replace(/[Â\u00c2]/g, '')
    .trim();
}

function sanitizeSocialHandle(raw: string | undefined, defaultUrl: string, searchHandles: string[], replaceHandle: string): string {
  let val = String(raw || defaultUrl).trim();
  for (const h of searchHandles) {
    if (val.includes(h)) {
      val = val.replace(h, replaceHandle);
    }
  }
  return val || defaultUrl;
}

export function sanitizeContactSettings(input: Partial<FooterContactSettings>): FooterContactSettings {
  const rawOrg = cleanMojibake(String(input.organization_name || DEFAULT_FOOTER_CONTACT.organization_name));
  const orgName = rawOrg
    .replace(/\b(KCPJLN|KJIN)\b/g, 'KJCPL')
    .replace(/Kashmir Chenab Panjal Jammu Ladakh Network/gi, 'KJCPL News Network')
    .replace(/Kashmir & Jammu Information Network/gi, 'KJCPL News Network')
    .replace(/Kashmir Jammu Independent News/gi, 'KJCPL News Network')
    .slice(0, 150);

  return {
    organization_name: orgName || 'KJCPL News Network',
    tagline: cleanMojibake(String(input.tagline || DEFAULT_FOOTER_CONTACT.tagline)).slice(0, 200),
    description: cleanMojibake(String(input.description || DEFAULT_FOOTER_CONTACT.description)).slice(0, 500),
    editor_in_chief: cleanMojibake(String(input.editor_in_chief || DEFAULT_FOOTER_CONTACT.editor_in_chief || 'Hafiz Zargar')).slice(0, 150),
    show_editor_in_chief: input.show_editor_in_chief !== false,
    primary_address: cleanMojibake(String(input.primary_address || DEFAULT_FOOTER_CONTACT.primary_address)).slice(0, 300),
    primary_address_label: cleanMojibake(String(input.primary_address_label || DEFAULT_FOOTER_CONTACT.primary_address_label)).slice(0, 100),
    show_primary_address: input.show_primary_address !== false,
    bureau_address: cleanMojibake(String(input.bureau_address || DEFAULT_FOOTER_CONTACT.bureau_address)).slice(0, 300),
    bureau_address_label: cleanMojibake(String(input.bureau_address_label || DEFAULT_FOOTER_CONTACT.bureau_address_label)).slice(0, 100),
    show_bureau_address: input.show_bureau_address !== false,
    operating_hours: cleanMojibake(String(input.operating_hours || DEFAULT_FOOTER_CONTACT.operating_hours)).slice(0, 200),
    phone_primary: String(input.phone_primary || DEFAULT_FOOTER_CONTACT.phone_primary).trim().slice(0, 50),
    phone_primary_label: cleanMojibake(String(input.phone_primary_label || DEFAULT_FOOTER_CONTACT.phone_primary_label)).slice(0, 100),
    phone_secondary: String(input.phone_secondary || DEFAULT_FOOTER_CONTACT.phone_secondary).trim().slice(0, 50),
    phone_secondary_label: cleanMojibake(String(input.phone_secondary_label || DEFAULT_FOOTER_CONTACT.phone_secondary_label)).slice(0, 100),
    show_phone_numbers: input.show_phone_numbers === true,
    email_editorial: typeof input.email_editorial === 'string' && input.email_editorial.trim()
      ? input.email_editorial.trim().slice(0, 100)
      : DEFAULT_FOOTER_CONTACT.email_editorial,
    email_careers: typeof input.email_careers === 'string' && input.email_careers.trim()
      ? input.email_careers.trim().slice(0, 100)
      : DEFAULT_FOOTER_CONTACT.email_careers,
    email_grievance: typeof input.email_grievance === 'string' && input.email_grievance.trim()
      ? input.email_grievance.trim().slice(0, 100)
      : DEFAULT_FOOTER_CONTACT.email_grievance,
    email_press: typeof input.email_press === 'string' && input.email_press.trim()
      ? input.email_press.trim().slice(0, 100)
      : DEFAULT_FOOTER_CONTACT.email_press,
    grievance_officer_name: cleanMojibake(String(input.grievance_officer_name || DEFAULT_FOOTER_CONTACT.grievance_officer_name)).slice(0, 150),
    registration_number: cleanMojibake(String(input.registration_number || DEFAULT_FOOTER_CONTACT.registration_number)).slice(0, 200),
    social_twitter: sanitizeSocialHandle(input.social_twitter, DEFAULT_FOOTER_CONTACT.social_twitter, ['kjin_live', 'kjin_wire', 'kjinnews'], 'kjcpl_news'),
    social_facebook: sanitizeSocialHandle(input.social_facebook, DEFAULT_FOOTER_CONTACT.social_facebook, ['kjinnews', 'kjin_live'], 'kjcplnews'),
    social_whatsapp: sanitizeSocialHandle(input.social_whatsapp, DEFAULT_FOOTER_CONTACT.social_whatsapp, ['channel/kjin'], 'channel/kjcpl'),
    social_telegram: sanitizeSocialHandle(input.social_telegram, DEFAULT_FOOTER_CONTACT.social_telegram, ['kjin_wire', 'kjin_live'], 'kjcpl_news'),
    social_youtube: sanitizeSocialHandle(input.social_youtube, DEFAULT_FOOTER_CONTACT.social_youtube, ['@kjin_live', '@kjin_wire', '@kjinnews'], '@kjcpl_news'),
    developer_support: sanitizeDeveloperSupportSettings(input.developer_support),
  };
}

import { getCachedSiteSetting } from './site-settings-cache';

export async function getFooterContactSettings(supabase: SupabaseClient): Promise<FooterContactSettings> {
  try {
    const value = await getCachedSiteSetting<Partial<FooterContactSettings>>(supabase, 'footer_contact');
    const devSetting = await getCachedSiteSetting<Partial<DeveloperSupportSettings>>(supabase, 'developer_support');

    const result = sanitizeContactSettings(value || DEFAULT_FOOTER_CONTACT);
    if (devSetting) {
      result.developer_support = sanitizeDeveloperSupportSettings(devSetting);
    }
    return result;
  } catch (err) {
    console.error('Failed to load footer contact settings from DB:', err);
  }
  return {
    ...DEFAULT_FOOTER_CONTACT,
    developer_support: { ...DEFAULT_DEVELOPER_SUPPORT },
  };
}

export async function getDeveloperSupportSettings(supabase: SupabaseClient): Promise<DeveloperSupportSettings> {
  try {
    const devSetting = await getCachedSiteSetting<Partial<DeveloperSupportSettings>>(supabase, 'developer_support');
    if (devSetting) {
      return sanitizeDeveloperSupportSettings(devSetting);
    }
    const footerSetting = await getCachedSiteSetting<Partial<FooterContactSettings>>(supabase, 'footer_contact');
    if (footerSetting?.developer_support) {
      return sanitizeDeveloperSupportSettings(footerSetting.developer_support);
    }
  } catch (err) {
    console.error('Failed to load developer support settings from DB:', err);
  }
  return DEFAULT_DEVELOPER_SUPPORT;
}
