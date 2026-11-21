/**
 * Legacy slug aliases used to resolve old article URLs to their stored records.
 */

export interface SlugMapping {
  cleanSlug: string;
  dbSlug: string;
  category: string;
  district?: string;
}

export const SLUG_MAPPINGS: Record<string, SlugMapping> = {
  // Doda MLA Mehraj Malik Power & Water Crisis Story
  'mla-mehraj-malik-power-water-crisis': {
    cleanSlug: 'mla-mehraj-malik-power-water-crisis',
    dbSlug: 'doda-mla-mehraj-malik-demands-accountability-for-crippling-power-water-crisis-pxid',
    category: 'doda',
    district: 'doda',
  },
  'doda-mla-mehraj-malik-demands-accountability-for-crippling-power-water-crisis-pxid': {
    cleanSlug: 'mla-mehraj-malik-power-water-crisis',
    dbSlug: 'doda-mla-mehraj-malik-demands-accountability-for-crippling-power-water-crisis-pxid',
    category: 'doda',
    district: 'doda',
  },

  // Kishtwar SPOs Story
  'two-spos-found-dead-investigation': {
    cleanSlug: 'two-spos-found-dead-investigation',
    dbSlug: 'kishtwar-rocked-bullet-riddled-bodies-of-two-special-police-5wdd-rbxr',
    category: 'kishtwar',
    district: 'kishtwar',
  },
  'kishtwar-rocked-bullet-riddled-bodies-of-two-special-police-5wdd-rbxr': {
    cleanSlug: 'two-spos-found-dead-investigation',
    dbSlug: 'kishtwar-rocked-bullet-riddled-bodies-of-two-special-police-5wdd-rbxr',
    category: 'kishtwar',
    district: 'kishtwar',
  },

  // COP31 Second Global Stocktake Story
  'india-calls-for-equitable-second-global-stocktake-cop31': {
    cleanSlug: 'india-calls-for-equitable-second-global-stocktake-cop31',
    dbSlug: '2-31-1j47-ca84',
    category: 'international',
  },
  '2-31-1j47-ca84': {
    cleanSlug: 'india-calls-for-equitable-second-global-stocktake-cop31',
    dbSlug: '2-31-1j47-ca84',
    category: 'international',
  },

  // GMC Doda Advanced Trauma & Dialysis Wing
  'gmc-doda-advanced-trauma-dialysis-wing-commissioned': {
    cleanSlug: 'gmc-doda-advanced-trauma-dialysis-wing-commissioned',
    dbSlug: 'gmc-doda-advanced-trauma-dialysis-wing-commissioned-chenab-relief-1qkn',
    category: 'doda',
    district: 'doda',
  },
  'gmc-doda-advanced-trauma-dialysis-wing-commissioned-chenab-relief-1qkn': {
    cleanSlug: 'gmc-doda-advanced-trauma-dialysis-wing-commissioned',
    dbSlug: 'gmc-doda-advanced-trauma-dialysis-wing-commissioned-chenab-relief-1qkn',
    category: 'doda',
    district: 'doda',
  },

  // Bhaderwah Lockdown Response Drill
  'bhaderwah-emergency-response-drill': {
    cleanSlug: 'bhaderwah-emergency-response-drill',
    dbSlug: 'bhaderwah-under-simulated-lockdown-police-crpf-test-emergenc-nzpz-k7z4',
    category: 'bhaderwah',
    district: 'doda',
  },
  'bhaderwah-under-simulated-lockdown-police-crpf-test-emergenc-nzpz-k7z4': {
    cleanSlug: 'bhaderwah-emergency-response-drill',
    dbSlug: 'bhaderwah-under-simulated-lockdown-police-crpf-test-emergenc-nzpz-k7z4',
    category: 'bhaderwah',
    district: 'doda',
  },

  // RS Pura Road Accident
  'tragedy-strikes-rs-pura-young-father-killed-in-road-accident': {
    cleanSlug: 'tragedy-strikes-rs-pura-young-father-killed-in-road-accident',
    dbSlug: 'tragedy-strikes-rs-pura-young-father-killed-in-road-accident-7v65-b4zt',
    category: 'jammu',
    district: 'jammu',
  },
  'tragedy-strikes-rs-pura-young-father-killed-in-road-accident-7v65-b4zt': {
    cleanSlug: 'tragedy-strikes-rs-pura-young-father-killed-in-road-accident',
    dbSlug: 'tragedy-strikes-rs-pura-young-father-killed-in-road-accident-7v65-b4zt',
    category: 'jammu',
    district: 'jammu',
  },
};

/**
 * Preserves the requested slug. Canonical article URLs use the exact slug stored
 * in the database; explicit legacy aliases are resolved separately below.
 */
export function getCleanSlug(slug: string): string {
  if (!slug) return '';
  return slug.trim();
}

/**
 * Resolves an incoming requested slug (which may be a clean slug or an old slug)
 * back to the slug present in the database.
 */
export function resolveDbSlug(requestedSlug: string): string {
  if (!requestedSlug) return '';
  const trimmed = requestedSlug.trim().toLowerCase();
  if (SLUG_MAPPINGS[trimmed]) {
    return SLUG_MAPPINGS[trimmed].dbSlug;
  }
  return trimmed;
}

/**
 * Checks whether the requested slug is messy (contains machine hashes or ampersands)
 */
export function isMessySlug(slug: string): boolean {
  if (!slug) return false;
  const trimmed = slug.trim().toLowerCase();
  if (SLUG_MAPPINGS[trimmed] && SLUG_MAPPINGS[trimmed].cleanSlug !== trimmed) {
    return true;
  }
  return /-[a-z0-9]{4}(-[a-z0-9]{4})?$/.test(trimmed) || /^[0-9]-[0-9]+-/.test(trimmed) || trimmed.includes('&');
}
