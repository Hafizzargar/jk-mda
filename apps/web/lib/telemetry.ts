import type { SupabaseClient } from '@supabase/supabase-js';

export interface MountainPassItem {
  id: string;
  name: string;
  corridor: string;
  elevation: string;
  status: 'open' | 'caution' | 'closed';
  status_label: string;
  advisory_title: string;
  advisory_desc: string;
  road_surface_temp: string;
  snow_depth: string;
  avalanche_hazard: string;
  clearance_agency: string;
  projected_opening_or_slot: string;
  audio_memo?: {
    title: string;
    duration: string;
    time: string;
  };
  map_coords?: {
    x: number;
    y: number;
  };
}

export interface EmergencyHotline {
  id: string;
  title: string;
  phone: string;
  corridor_color: 'kashmir' | 'jammu' | 'chenab' | 'ladakh';
}

export interface MandiCommodityItem {
  id: string;
  market_name: string;
  corridor: 'kashmir' | 'chenab' | 'jammu' | 'ladakh';
  commodity_name: string;
  price: string;
  unit: string;
  change_pct: string;
  trend: 'up' | 'down' | 'steady';
  stat_left: string;
  stat_right: string;
}

export interface CorridorGlanceItem {
  id: string;
  name: string;
  badge_color: 'kashmir' | 'jammu' | 'chenab' | 'panjal' | 'ladakh';
  headline: string;
  stats: string;
  link_path: string;
  region_slug?: string;
  article_id?: string;
  is_dynamic?: boolean;
}

export interface CorridorVoiceItem {
  id: string;
  speaker: string;
  location: string;
  corridor: string;
  quote: string;
}

export interface CivicInitiativeItem {
  badge: string;
  title: string;
  description: string;
  cta_text: string;
  cta_link: string;
}

export interface ConvoySlotItem {
  id: string;
  corridor_code: string;
  corridor_name: string;
  directional_flow: string;
  open_time: string;
  cutoff_time: string;
  vehicle_tier: string;
  clearance_status: 'verified' | 'regulated' | 'clear' | 'chains' | 'blocked';
  clearance_label: string;
}

export interface FieldSensorItem {
  id: string;
  code: string;
  status: 'calibrated' | 'warning' | 'alert';
  name: string;
  metric_name: string;
  metric_value: string;
  percent: number;
  bar_color: 'jammu' | 'crimson' | 'chenab' | 'kashmir';
}

export interface BureauContactItem {
  id: string;
  name: string;
  corridor_color: 'kashmir' | 'jammu' | 'chenab' | 'panjal' | 'ladakh';
  address: string;
  wire_phone: string;
  tele_freq: string;
}

export interface LiveWireSettings {
  headline: string;
  is_active: boolean;
  synced_time: string;
  verified: boolean;
  badge?: string; // e.g. 'DEVELOPING' | 'BREAKING NEWS' | 'SPECIAL ADVISORY'
  mode?: 'auto' | 'manual'; // 'auto' = dynamically syncs with latest breaking article
  article_id?: string | null;
}

export interface TelemetrySettings {
  live_wire: LiveWireSettings;
  corridors_at_a_glance: CorridorGlanceItem[];
  mountain_passes: MountainPassItem[];
  emergency_hotlines: EmergencyHotline[];
  offline_sos_message: string;
  mandi_commodities: MandiCommodityItem[];
  voices_of_corridors: CorridorVoiceItem[];
  civic_initiative: CivicInitiativeItem;
  convoy_slots?: ConvoySlotItem[];
  field_sensors?: FieldSensorItem[];
  bureau_contacts?: BureauContactItem[];
}

export const DEFAULT_TELEMETRY_SETTINGS: TelemetrySettings = {
  live_wire: {
    headline: 'Chenab Valley railway link completes winter safety protocol run; Mughal Road cleared for high-altitude freight traffic after light snowfall.',
    is_active: true,
    synced_time: '13:42 IST',
    verified: true,
    badge: 'DEVELOPING',
    mode: 'auto',
    article_id: null,
  },
  corridors_at_a_glance: [
    {
      id: 'kashmir',
      name: 'Kashmir Valley',
      badge_color: 'kashmir',
      headline: 'Pampore Saffron Farmers Adopt Precision Drip Irrigation to Counter Rainfall Deficits',
      stats: 'Pulwama • Precision Agri-Grid Active',
      link_path: '/economy/pampore-saffron-farmers-adopt-precision-drip-irrigation-to-counter-rainfall-deficits',
      region_slug: 'kashmir',
    },
    {
      id: 'jammu',
      name: 'Jammu Plains',
      badge_color: 'jammu',
      headline: 'Jammu Smart City Expands Zero-Emission Transit: 50 Air-Conditioned E-Buses Flagged Off',
      stats: 'Jammu • Kathua Industrial Logistics',
      link_path: '/local/jammu-smart-city-e-bus-expansion-jammu-2026',
      region_slug: 'jammu',
    },
    {
      id: 'chenab',
      name: 'Chenab Valley',
      badge_color: 'chenab',
      headline: 'Lavender Revolution in Bhaderwah Sparks Agro-Entrepreneurship Wave Across Chenab Valley',
      stats: 'Doda • Kishtwar Saffron GI Registry',
      link_path: '/economy/lavender-revolution-in-bhaderwah-sparks-agro-entrepreneurship-wave-across-chenab-valley',
      region_slug: 'chenab-valley',
    },
    {
      id: 'panjal',
      name: 'Pir Panjal',
      badge_color: 'panjal',
      headline: 'Mughal Road Connectivity Upgrades Under Review to Enable All-Weather Commercial Transit',
      stats: 'Shopian • Poonch Border Agri-Zone',
      link_path: '/local/mughal-road-connectivity-upgrades-under-review-to-enable-all-weather-commercial-transit',
      region_slug: 'pir-panjal',
    },
    {
      id: 'ladakh',
      name: 'Leh & Ladakh',
      badge_color: 'ladakh',
      headline: 'Changthang Plateau Solar Microgrid Powers 14 Pastoral Nomadic Hamlets with Battery Storage',
      stats: 'Leh • Changthang Pashmina Cooperative',
      link_path: '/local/changthang-solar-microgrid-commissioned-leh-2026',
      region_slug: 'leh',
    },
  ],
  mountain_passes: [
    {
      id: 'pass-mughal',
      name: 'Peer Ki Gali (Mughal Road)',
      corridor: 'PIR PANJAL • SHOPIAN-POONCH',
      elevation: '11,450 FT',
      status: 'closed',
      status_label: 'CLOSED',
      advisory_title: 'WINTER BLOCKADE DECLARED • INDEFINITE',
      advisory_desc: 'Heavy accumulation across a 28 km stretch from Dubjan to Bafliaz. Surface is buried under compacted drifts.',
      road_surface_temp: '-9.4 °C (Deep Freeze)',
      snow_depth: '3.8 Feet (Accumulating)',
      avalanche_hazard: 'STAGE 4 • HIGH',
      clearance_agency: 'BRO 144 TF • Stood Down',
      projected_opening_or_slot: 'Seasonal Freeze • April 2025',
      audio_memo: {
        title: 'BRO Project Mughal • Field Radio Advisory',
        duration: '1:42 min',
        time: '05:15 IST',
      },
      map_coords: { x: 130, y: 270 },
    },
    {
      id: 'pass-zojila',
      name: 'Zojila Pass (NH-1D)',
      corridor: 'GREAT HIMALAYAN • KASHMIR-LADAKH',
      elevation: '11,575 FT',
      status: 'caution',
      status_label: 'CHAINS REQ.',
      advisory_title: 'ONE-WAY CONVOY PROTOCOL IN FORCE',
      advisory_desc: 'Strict anti-skid tire chains compulsory from Sonamarg Zero Point to Meenamarg. Black ice between KM 84 and 92.',
      road_surface_temp: '-5.8 °C',
      snow_depth: '7 Inches',
      avalanche_hazard: 'STAGE 2 • MODERATE',
      clearance_agency: '4 Snowcutters Active',
      projected_opening_or_slot: 'Minamarg → Srinagar (07:00 - 11:30 IST)',
      audio_memo: {
        title: 'Beacon Sector Commander • Captain Morh Caution',
        duration: '0:58 min',
        time: '05:40 IST',
      },
      map_coords: { x: 285, y: 135 },
    },
    {
      id: 'pass-nh44',
      name: 'Banihal-Qazigund & Jawahar Tunnel',
      corridor: 'RAMBAN-QAZIGUND ARTERY • NH-44',
      elevation: '7,200 FT',
      status: 'open',
      status_label: 'OPEN 2-WAY',
      advisory_title: 'NORMAL COMMERCIAL & LMV TRANSIT',
      advisory_desc: 'Both tubes of the Navyug Qazigund Tunnel operating smoothly. Periodic rockfall monitoring active at Panthyal bypass.',
      road_surface_temp: '+4.2 °C',
      snow_depth: '0 Inches (Clear)',
      avalanche_hazard: 'STAGE 1 • LOW',
      clearance_agency: 'NHAI Patrol Active',
      projected_opening_or_slot: '24-Hour Unrestricted',
      map_coords: { x: 180, y: 230 },
    },
    {
      id: 'pass-sinthan',
      name: 'Sinthan Top (NH-244)',
      corridor: 'CHENAB VALLEY • KISHTWAR-ANANTNAG',
      elevation: '12,414 FT',
      status: 'caution',
      status_label: '4X4 / CAUTION',
      advisory_title: 'SEVERE FROST • STRICT CUTOFF 15:00 IST',
      advisory_desc: 'Heavy icy patches between Chingam and Sinthan Maidan. LMVs allowed only with snow chains or 4-wheel drive.',
      road_surface_temp: '-7.1 °C',
      snow_depth: '14 Inches',
      avalanche_hazard: 'STAGE 3 • SIGNIFICANT',
      clearance_agency: 'BRO 118 RCC Active',
      projected_opening_or_slot: 'Daylight Only (08:00–15:00)',
      map_coords: { x: 290, y: 250 },
    },
    {
      id: 'pass-razdan',
      name: 'Razdan Pass (Gurez Artery)',
      corridor: 'BANDIPORA-GUREZ • KASHMIR',
      elevation: '11,672 FT',
      status: 'closed',
      status_label: 'BLOCKED',
      advisory_title: 'HIGH AVALANCHE DANGER (DGRE WARNING)',
      advisory_desc: 'Pass blocked by fresh slide at Tragbal. BRO 56 RCC mobilising heavy snow-cutters subject to weather window.',
      road_surface_temp: '-11.2 °C',
      snow_depth: '2.5 Feet',
      avalanche_hazard: 'STAGE 4 • HIGH',
      clearance_agency: 'BRO 56 RCC Mobilising',
      projected_opening_or_slot: 'Subject to Clearance',
      map_coords: { x: 195, y: 95 },
    },
    {
      id: 'pass-sadhna',
      name: 'Sadhna Pass (Nastachun)',
      corridor: 'KUPWARA-KARNAH • KASHMIR',
      elevation: '10,269 FT',
      status: 'open',
      status_label: 'OPEN • REGULATED',
      advisory_title: 'REGULATED ACCESS WITH CHAINS',
      advisory_desc: 'Road cleared up to Chowkibal. Movement allowed strictly with snow chains between 09:00 and 15:00 IST.',
      road_surface_temp: '-3.5 °C',
      snow_depth: '5 Inches',
      avalanche_hazard: 'STAGE 2 • MODERATE',
      clearance_agency: 'BRO Beacon Crew',
      projected_opening_or_slot: '09:00 - 15:00 IST',
      map_coords: { x: 115, y: 120 },
    },
    {
      id: 'pass-khardung',
      name: 'Khardung La & Chang La',
      corridor: 'LADAKH HIGH ARTERY • LEH',
      elevation: '17,582 FT',
      status: 'open',
      status_label: 'REGULATED MILITARY',
      advisory_title: 'EXTREME SUB-ZERO CONDITIONS',
      advisory_desc: 'Sub-zero extreme cold (-22 °C). Heavy army vehicular traffic given priority. Essential fuel tankers cleared under Project Himank supervision.',
      road_surface_temp: '-22.0 °C',
      snow_depth: '18 Inches',
      avalanche_hazard: 'STAGE 3 • SIGNIFICANT',
      clearance_agency: 'Project Himank',
      projected_opening_or_slot: 'Convoy Slots Active',
      map_coords: { x: 415, y: 70 },
    },
  ],
  emergency_hotlines: [
    {
      id: 'srinagar',
      title: 'Traffic HQ Srinagar',
      phone: '0194-2450022',
      corridor_color: 'kashmir',
    },
    {
      id: 'jammu',
      title: 'Traffic HQ Jammu',
      phone: '0191-2459048',
      corridor_color: 'jammu',
    },
    {
      id: 'ramban',
      title: 'Ramban NH-44 Rescue',
      phone: '01998-266686',
      corridor_color: 'chenab',
    },
    {
      id: 'kargil',
      title: 'Kargil Disaster Cell',
      phone: '01985-232264',
      corridor_color: 'ladakh',
    },
  ],
  offline_sos_message: 'EMERGENCY SOS: Stranded at High Altitude Pass. Require BRO Rescue.',
  mandi_commodities: [
    {
      id: 'apple',
      market_name: 'Sopore Fruit Mandi',
      corridor: 'kashmir',
      commodity_name: "Grade-A 'Delicious' Apple",
      price: '₹1,180',
      unit: '/ 16kg box',
      change_pct: '+4.8%',
      trend: 'up',
      stat_left: 'Daily Arrival: 220 MT',
      stat_right: 'Firm Demand',
    },
    {
      id: 'saffron',
      market_name: 'Kishtwar GI Registry',
      corridor: 'chenab',
      commodity_name: 'Pure Mongra Grade Saffron',
      price: '₹285',
      unit: '/ gram',
      change_pct: '+2.1%',
      trend: 'up',
      stat_left: 'Tested Moisture: 7.2%',
      stat_right: 'GI Certified',
    },
    {
      id: 'basmati',
      market_name: 'Jammu Narwal Mandi',
      corridor: 'jammu',
      commodity_name: 'R.S. Pura Traditional Basmati',
      price: '₹4,250',
      unit: '/ quintal',
      change_pct: '0.0%',
      trend: 'steady',
      stat_left: 'Daily Arrival: 140 MT',
      stat_right: 'Stable Supply',
    },
    {
      id: 'pashmina',
      market_name: 'Leh Cooperative Apex',
      corridor: 'ladakh',
      commodity_name: 'Raw Pashmina (De-haired)',
      price: '₹3,400',
      unit: '/ kg',
      change_pct: '+6.3%',
      trend: 'up',
      stat_left: 'Fleece Grade: 13.5μm',
      stat_right: 'High Export Bid',
    },
  ],
  voices_of_corridors: [
    {
      id: 'quote-1',
      speaker: 'Ghulam Rasool Wani',
      location: 'Pochhal, Kishtwar',
      corridor: 'chenab',
      quote: 'Our saffron harvest in Kishtwar requires authentic provenance certification if we are to compete with imports.',
    },
    {
      id: 'quote-2',
      speaker: 'Fatima Bukhari',
      location: 'Surankote, Poonch',
      corridor: 'panjal',
      quote: "Border tourism along Poonch's historic Mughal route has brought our young homestay entrepreneurs new hope.",
    },
  ],
  civic_initiative: {
    badge: 'Sponsored Partner Content • FTC Compliant',
    title: 'Ladakh Renewable Infrastructure Initiative',
    description: 'Explore state subsidies for sub-zero battery storage technology across Leh & Kargil districts.',
    cta_text: 'Learn More',
    cta_link: '#',
  },
  convoy_slots: [
    {
      id: 'slot-1',
      corridor_code: 'NH-1D',
      corridor_name: 'Zoji La (Minamarg Gate)',
      directional_flow: 'Ladakh towards Kashmir (Downhill)',
      open_time: '06:00 IST',
      cutoff_time: '11:30 IST',
      vehicle_tier: 'LMVs & 4x4 Chains Mandated',
      clearance_status: 'verified',
      clearance_label: 'VERIFIED PASS',
    },
    {
      id: 'slot-2',
      corridor_code: 'NH-1D',
      corridor_name: 'Zoji La (Sonamarg/Baltal)',
      directional_flow: 'Kashmir towards Ladakh (Uphill)',
      open_time: '12:30 IST',
      cutoff_time: '16:00 IST',
      vehicle_tier: 'Petroleum Tankers & Military Essential',
      clearance_status: 'regulated',
      clearance_label: 'REGULATED CONVOY',
    },
    {
      id: 'slot-3',
      corridor_code: 'NH-44',
      corridor_name: 'Jammu - Srinagar Tunnel',
      directional_flow: 'Bi-Directional Continuous',
      open_time: '00:00 IST',
      cutoff_time: '24-HR UNBLOCKED',
      vehicle_tier: 'All Passenger & Commercial Cargo',
      clearance_status: 'clear',
      clearance_label: 'CLEAR GREEN',
    },
    {
      id: 'slot-4',
      corridor_code: 'NH-244',
      corridor_name: 'Sinthan Top (Chingam)',
      directional_flow: 'Kishtwar to Anantnag',
      open_time: '09:00 IST',
      cutoff_time: '14:00 IST',
      vehicle_tier: 'Light Motor Vehicles (4x4 ONLY)',
      clearance_status: 'chains',
      clearance_label: 'CHAINS REQUIRED',
    },
    {
      id: 'slot-5',
      corridor_code: 'MUGHAL',
      corridor_name: 'Peer Ki Gali (Bafliaz)',
      directional_flow: 'Shopian <--> Poonch / Rajouri',
      open_time: 'SUSPENDED',
      cutoff_time: 'SUSPENDED',
      vehicle_tier: 'Strictly No Civilian Vehicles Permitted',
      clearance_status: 'blocked',
      clearance_label: 'RED BLOCKED',
    },
  ],
  field_sensors: [
    {
      id: 'sensor-1',
      code: 'BRO SENSOR NODE: Z-44',
      status: 'calibrated',
      name: 'Baltal Avalanche Chute #12',
      metric_name: 'Snowpack Compaction',
      metric_value: '428 kg/m³',
      percent: 65,
      bar_color: 'jammu',
    },
    {
      id: 'sensor-2',
      code: 'AWS PIR PANJAL: PKG-02',
      status: 'warning',
      name: 'Peer Ki Gali Ridge Sensor',
      metric_name: 'Wind Gust Velocity',
      metric_value: '78 km/h (Blizzard)',
      percent: 88,
      bar_color: 'crimson',
    },
    {
      id: 'sensor-3',
      code: 'BRO VIJAYAK: MIN-07',
      status: 'calibrated',
      name: 'Minamarg Checkpoint Transponder',
      metric_name: 'Road Friction Coeff',
      metric_value: '0.24 µ (Icy Glaze)',
      percent: 40,
      bar_color: 'chenab',
    },
  ],
  bureau_contacts: [
    {
      id: 'bureau-kashmir',
      name: 'Kashmir Bureau',
      corridor_color: 'kashmir',
      address: 'Press Enclave, Residency Road, Srinagar 190001',
      wire_phone: '+91 194 2452001',
      tele_freq: 'KASH-NET 142.85 MHz',
    },
    {
      id: 'bureau-jammu',
      name: 'Jammu Bureau',
      corridor_color: 'jammu',
      address: 'Bahu Plaza Complex, Railhead, Jammu 180012',
      wire_phone: '+91 191 2471900',
      tele_freq: 'Central Feed: JM-DISP-02',
    },
    {
      id: 'bureau-chenab',
      name: 'Chenab Valley Bureau',
      corridor_color: 'chenab',
      address: 'Pul Doda Transit Centre, Doda 182202',
      wire_phone: 'Field Telemetry: Kishtwar / Ramban / Doda',
      tele_freq: 'Emergency Link: CH-TER-09',
    },
    {
      id: 'bureau-panjal',
      name: 'Pir Panjal Bureau',
      corridor_color: 'panjal',
      address: 'Dak Bungalow Road, Rajouri 185131',
      wire_phone: '+91 1962 263110',
      tele_freq: 'Sector Pass Monitoring Cell',
    },
    {
      id: 'bureau-ladakh',
      name: 'Ladakh Bureau',
      corridor_color: 'ladakh',
      address: 'Old Road, Leh 194101 / Kargil Post',
      wire_phone: '+91 1982 252044',
      tele_freq: 'Z-Morh / Zojila Sensor Field',
    },
  ],
};

import { getCachedSiteSetting } from './site-settings-cache';

export async function getTelemetrySettings(supabase: SupabaseClient): Promise<TelemetrySettings> {
  try {
    const data = await getCachedSiteSetting<Partial<TelemetrySettings>>(supabase, 'telemetry_config');

    if (!data) {
      return DEFAULT_TELEMETRY_SETTINGS;
    }

    const val = data;
    return {
      live_wire: {
        ...DEFAULT_TELEMETRY_SETTINGS.live_wire,
        ...(val.live_wire || {}),
      },
      corridors_at_a_glance: val.corridors_at_a_glance && val.corridors_at_a_glance.length > 0
        ? val.corridors_at_a_glance
        : DEFAULT_TELEMETRY_SETTINGS.corridors_at_a_glance,
      mountain_passes: val.mountain_passes && val.mountain_passes.length > 0
        ? val.mountain_passes
        : DEFAULT_TELEMETRY_SETTINGS.mountain_passes,
      emergency_hotlines: val.emergency_hotlines && val.emergency_hotlines.length > 0
        ? val.emergency_hotlines
        : DEFAULT_TELEMETRY_SETTINGS.emergency_hotlines,
      offline_sos_message: val.offline_sos_message || DEFAULT_TELEMETRY_SETTINGS.offline_sos_message,
      mandi_commodities: val.mandi_commodities && val.mandi_commodities.length > 0
        ? val.mandi_commodities
        : DEFAULT_TELEMETRY_SETTINGS.mandi_commodities,
      voices_of_corridors: val.voices_of_corridors && val.voices_of_corridors.length > 0
        ? val.voices_of_corridors
        : DEFAULT_TELEMETRY_SETTINGS.voices_of_corridors,
      civic_initiative: {
        ...DEFAULT_TELEMETRY_SETTINGS.civic_initiative,
        ...(val.civic_initiative || {}),
      },
      convoy_slots: val.convoy_slots && val.convoy_slots.length > 0
        ? val.convoy_slots
        : DEFAULT_TELEMETRY_SETTINGS.convoy_slots,
      field_sensors: val.field_sensors && val.field_sensors.length > 0
        ? val.field_sensors
        : DEFAULT_TELEMETRY_SETTINGS.field_sensors,
      bureau_contacts: val.bureau_contacts && val.bureau_contacts.length > 0
        ? val.bureau_contacts
        : DEFAULT_TELEMETRY_SETTINGS.bureau_contacts,
    };
  } catch (err) {
    console.error('Error fetching telemetry settings:', err);
    return DEFAULT_TELEMETRY_SETTINGS;
  }
}
