import type { SupabaseClient } from '@supabase/supabase-js';

export type AdThemeAccent = 'gold' | 'emerald' | 'cyan' | 'ruby' | 'indigo';

export interface CustomAdPlacement {
  id: string;
  name: string;
  enabled: boolean;
  sponsor_name: string;
  badge_label: string;
  title: string;
  description: string;
  cta_text: string;
  destination_url: string;
  image_url: string | null;
  theme_accent: AdThemeAccent;
}

export interface CustomAdsSettings {
  monetization_enabled: boolean;
  contact_email_for_ads: string;
  contact_phone_for_ads: string;
  pricing_badge: string;
  placements: CustomAdPlacement[];
}

export const DEFAULT_ADS_SETTINGS: CustomAdsSettings = {
  monetization_enabled: true,
  contact_email_for_ads: 'advertise@kjin.org',
  contact_phone_for_ads: '+91 194 245 7777',
  pricing_badge: 'Reach 50,000+ J&K Readers Daily',
  placements: [
    {
      id: 'leaderboard_top',
      name: 'Homepage Top Leaderboard',
      enabled: true,
      sponsor_name: 'Kashmir Artisans & Heritage Guild',
      badge_label: 'Official Partner',
      title: 'Authentic Hand-Knotted Silk Carpets & Pashmina Shawls',
      description: 'Geographical Indication (GI) certified crafts delivered worldwide directly from valley master craftsmen.',
      cta_text: 'Shop Verified Collection',
      destination_url: 'https://kashmircrafts.org',
      image_url: 'https://images.unsplash.com/photo-1606744888344-493238955de0?auto=format&fit=crop&w=600&q=80',
      theme_accent: 'gold',
    },
    {
      id: 'sidebar_banner',
      name: 'Sidebar Right Rail Banner',
      enabled: true,
      sponsor_name: 'Valley MedX Diagnostic Laboratories',
      badge_label: 'Health Sponsor',
      title: 'Comprehensive 72-Parameter Full Body Health Checkup',
      description: 'NABL Accredited center at Residency Road, Srinagar. Same-day digital reports & free home sample pickup.',
      cta_text: 'Book Home Pickup',
      destination_url: 'https://valleymedx.in',
      image_url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80',
      theme_accent: 'emerald',
    },
    {
      id: 'in_article_native',
      name: 'In-Article Native Sponsored Dispatch',
      enabled: true,
      sponsor_name: 'Gulmarg Alpine Eco-Resorts',
      badge_label: 'Winter Season 2026',
      title: 'Experience First Snow in Gondola Valley: Early Bird Suites Open',
      description: 'Centrally heated pine chalets with panoramic views of Apharwat peak. Complimentary airport transfers included.',
      cta_text: 'Check Availability',
      destination_url: 'https://gulmargresorts.com',
      image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80',
      theme_accent: 'cyan',
    },
  ],
};

export async function getCustomAdsSettings(supabase: SupabaseClient): Promise<CustomAdsSettings> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'custom_ads')
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_ADS_SETTINGS;
    }

    const value = data.value as Partial<CustomAdsSettings>;
    return {
      monetization_enabled: value.monetization_enabled ?? true,
      contact_email_for_ads: value.contact_email_for_ads || DEFAULT_ADS_SETTINGS.contact_email_for_ads,
      contact_phone_for_ads: value.contact_phone_for_ads || DEFAULT_ADS_SETTINGS.contact_phone_for_ads,
      pricing_badge: value.pricing_badge || DEFAULT_ADS_SETTINGS.pricing_badge,
      placements: Array.isArray(value.placements) ? (value.placements as CustomAdPlacement[]) : DEFAULT_ADS_SETTINGS.placements,
    };
  } catch (e) {
    console.error('Failed to fetch custom ads settings:', e);
    return DEFAULT_ADS_SETTINGS;
  }
}

export function getThemeStyles(accent: AdThemeAccent) {
  switch (accent) {
    case 'gold':
      return {
        cardBg: 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-amber-950/40',
        borderColor: 'border-amber-500/40 hover:border-amber-400',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        sponsorText: 'text-amber-400',
        titleHover: 'group-hover:text-amber-200',
        ctaButton: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-amber-950/50',
        glow: 'shadow-[0_0_30px_-5px_rgba(245,158,11,0.2)]',
        borderAccent: 'border-l-4 border-l-amber-500',
      };
    case 'emerald':
      return {
        cardBg: 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-teal-950/40',
        borderColor: 'border-emerald-500/40 hover:border-emerald-400',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        sponsorText: 'text-emerald-400',
        titleHover: 'group-hover:text-emerald-200',
        ctaButton: 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-emerald-950/50',
        glow: 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]',
        borderAccent: 'border-l-4 border-l-emerald-500',
      };
    case 'ruby':
      return {
        cardBg: 'bg-gradient-to-br from-rose-950/60 via-slate-900 to-red-950/40',
        borderColor: 'border-rose-500/40 hover:border-rose-400',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        sponsorText: 'text-rose-400',
        titleHover: 'group-hover:text-rose-200',
        ctaButton: 'bg-gradient-to-r from-rose-500 to-red-500 text-white font-bold hover:brightness-110 shadow-lg shadow-rose-950/50',
        glow: 'shadow-[0_0_30px_-5px_rgba(244,63,94,0.2)]',
        borderAccent: 'border-l-4 border-l-rose-500',
      };
    case 'indigo':
      return {
        cardBg: 'bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/40',
        borderColor: 'border-indigo-500/40 hover:border-indigo-400',
        badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        sponsorText: 'text-indigo-400',
        titleHover: 'group-hover:text-indigo-200',
        ctaButton: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:brightness-110 shadow-lg shadow-indigo-950/50',
        glow: 'shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)]',
        borderAccent: 'border-l-4 border-l-indigo-500',
      };
    case 'cyan':
    default:
      return {
        cardBg: 'bg-gradient-to-br from-cyan-950/60 via-slate-900 to-blue-950/40',
        borderColor: 'border-cyan-500/40 hover:border-cyan-400',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        sponsorText: 'text-cyan-400',
        titleHover: 'group-hover:text-cyan-200',
        ctaButton: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-cyan-950/50',
        glow: 'shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]',
        borderAccent: 'border-l-4 border-l-cyan-500',
      };
  }
}
