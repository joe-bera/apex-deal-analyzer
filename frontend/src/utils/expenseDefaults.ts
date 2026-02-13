/**
 * Smart Expense Defaults for CRE Deal Analysis
 *
 * Auto-populate property taxes (CA county rates), insurance, and utilities
 * based on property type and location when creating a new analysis.
 */

// California county effective property tax rates (base 1% Prop 13 + local bonds)
export const CA_COUNTY_TAX_RATES: Record<string, number> = {
  'alameda': 1.17,
  'alpine': 1.02,
  'amador': 1.08,
  'butte': 1.07,
  'calaveras': 1.05,
  'colusa': 1.04,
  'contra costa': 1.17,
  'del norte': 1.04,
  'el dorado': 1.10,
  'fresno': 1.10,
  'glenn': 1.05,
  'humboldt': 1.07,
  'imperial': 1.10,
  'inyo': 1.04,
  'kern': 1.10,
  'kings': 1.08,
  'lake': 1.05,
  'lassen': 1.03,
  'los angeles': 1.16,
  'madera': 1.08,
  'marin': 1.09,
  'mariposa': 1.03,
  'mendocino': 1.06,
  'merced': 1.09,
  'modoc': 1.02,
  'mono': 1.04,
  'monterey': 1.08,
  'napa': 1.13,
  'nevada': 1.08,
  'orange': 1.04,
  'placer': 1.10,
  'plumas': 1.04,
  'riverside': 1.05,
  'sacramento': 1.14,
  'san benito': 1.08,
  'san bernardino': 1.05,
  'san diego': 1.08,
  'san francisco': 1.18,
  'san joaquin': 1.12,
  'san luis obispo': 1.08,
  'san mateo': 1.10,
  'santa barbara': 1.07,
  'santa clara': 1.20,
  'santa cruz': 1.10,
  'shasta': 1.06,
  'sierra': 1.02,
  'siskiyou': 1.04,
  'solano': 1.14,
  'sonoma': 1.10,
  'stanislaus': 1.10,
  'sutter': 1.08,
  'tehama': 1.05,
  'trinity': 1.03,
  'tulare': 1.08,
  'tuolumne': 1.05,
  'ventura': 1.08,
  'yolo': 1.12,
  'yuba': 1.08,
};

const DEFAULT_TAX_RATE = 1.10;

// Map common IE + Coachella Valley cities to their county
export const CITY_TO_COUNTY: Record<string, string> = {
  // San Bernardino County
  'ontario': 'san bernardino',
  'rancho cucamonga': 'san bernardino',
  'fontana': 'san bernardino',
  'san bernardino': 'san bernardino',
  'rialto': 'san bernardino',
  'colton': 'san bernardino',
  'redlands': 'san bernardino',
  'upland': 'san bernardino',
  'chino': 'san bernardino',
  'chino hills': 'san bernardino',
  'victorville': 'san bernardino',
  'hesperia': 'san bernardino',
  'apple valley': 'san bernardino',
  'highland': 'san bernardino',
  'loma linda': 'san bernardino',
  'montclair': 'san bernardino',
  'bloomington': 'san bernardino',
  'grand terrace': 'san bernardino',
  'yucaipa': 'san bernardino',
  'barstow': 'san bernardino',
  // Riverside County
  'riverside': 'riverside',
  'corona': 'riverside',
  'moreno valley': 'riverside',
  'jurupa valley': 'riverside',
  'menifee': 'riverside',
  'murrieta': 'riverside',
  'temecula': 'riverside',
  'perris': 'riverside',
  'hemet': 'riverside',
  'lake elsinore': 'riverside',
  'beaumont': 'riverside',
  'banning': 'riverside',
  'eastvale': 'riverside',
  'norco': 'riverside',
  'wildomar': 'riverside',
  // Coachella Valley (Riverside County)
  'palm desert': 'riverside',
  'indio': 'riverside',
  'la quinta': 'riverside',
  'palm springs': 'riverside',
  'cathedral city': 'riverside',
  'rancho mirage': 'riverside',
  'coachella': 'riverside',
  'desert hot springs': 'riverside',
  'indian wells': 'riverside',
  'bermuda dunes': 'riverside',
  'thousand palms': 'riverside',
  // Los Angeles County
  'los angeles': 'los angeles',
  'long beach': 'los angeles',
  'pasadena': 'los angeles',
  'pomona': 'los angeles',
  'el monte': 'los angeles',
  'downey': 'los angeles',
  'west covina': 'los angeles',
  'norwalk': 'los angeles',
  'torrance': 'los angeles',
  'compton': 'los angeles',
  'industry': 'los angeles',
  'city of industry': 'los angeles',
  'la verne': 'los angeles',
  'irwindale': 'los angeles',
  'duarte': 'los angeles',
  'azusa': 'los angeles',
  'covina': 'los angeles',
  'glendora': 'los angeles',
  // Orange County
  'anaheim': 'orange',
  'santa ana': 'orange',
  'irvine': 'orange',
  'fullerton': 'orange',
  'costa mesa': 'orange',
  'orange': 'orange',
  'garden grove': 'orange',
  'huntington beach': 'orange',
  'newport beach': 'orange',
};

// Insurance rates per SF per year by property type
export const INSURANCE_RATE_PER_SF: Record<string, number> = {
  'industrial': 0.25,
  'warehouse': 0.25,
  'distribution_center': 0.25,
  'manufacturing': 0.30,
  'flex_space': 0.28,
  'cold_storage': 0.35,
  'retail': 0.35,
  'office': 0.30,
  'multifamily': 0.40,
  'mixed_use': 0.32,
  'other': 0.30,
};

// Utility rates per SF per year by property type
export const UTILITY_RATE_PER_SF: Record<string, number> = {
  'industrial': 0.50,
  'warehouse': 0.45,
  'distribution_center': 0.50,
  'manufacturing': 0.75,
  'flex_space': 0.60,
  'cold_storage': 1.25,
  'retail': 1.00,
  'office': 1.50,
  'multifamily': 1.20,
  'mixed_use': 1.00,
  'other': 0.75,
};

/**
 * Get default annual property taxes based on purchase price and city
 */
export function getDefaultPropertyTaxes(purchasePrice: number, city?: string): number {
  if (!purchasePrice || purchasePrice <= 0) return 0;

  let taxRate = DEFAULT_TAX_RATE;

  if (city) {
    const normalizedCity = city.toLowerCase().trim();
    const county = CITY_TO_COUNTY[normalizedCity];
    if (county) {
      taxRate = CA_COUNTY_TAX_RATES[county] ?? DEFAULT_TAX_RATE;
    }
  }

  return Math.round(purchasePrice * (taxRate / 100));
}

/**
 * Get default annual insurance based on building SF and property type
 */
export function getDefaultInsurance(buildingSF: number, propertyType?: string): number {
  if (!buildingSF || buildingSF <= 0) return 0;

  const type = propertyType?.toLowerCase() ?? 'other';
  const rate = INSURANCE_RATE_PER_SF[type] ?? INSURANCE_RATE_PER_SF['other'];

  return Math.round(buildingSF * rate);
}

/**
 * Get default annual utilities based on building SF and property type
 */
export function getDefaultUtilities(buildingSF: number, propertyType?: string): number {
  if (!buildingSF || buildingSF <= 0) return 0;

  const type = propertyType?.toLowerCase() ?? 'other';
  const rate = UTILITY_RATE_PER_SF[type] ?? UTILITY_RATE_PER_SF['other'];

  return Math.round(buildingSF * rate);
}
