/**
 * COMPLETE IMPORT MAPPINGS - CoStar & Crexi
 * Field mapping configuration for Apex Deal Analyzer
 *
 * Generated: 2026-01-31
 * Sources:
 *   - CoStar Analytics Export (200+ fields)
 *   - Crexi Export (70+ fields)
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ImportSource = 'costar' | 'crexi' | 'loopnet' | 'manual';

export interface ColumnMapping {
  [sourceColumn: string]: string;  // Source column -> DB field
}

export interface AutoMapResult {
  propertyMapping: ColumnMapping;
  transactionMapping: ColumnMapping;
  unmappedColumns: string[];
  warnings: string[];
  detectedSource: ImportSource;
}

// ============================================================================
// SOURCE DETECTION
// ============================================================================

const COSTAR_DETECTION_FIELDS = [
  'Star Rating',
  'PropertyID',
  'Submarket Name',
  'Market Name',
  'Building Park',
  'Rentable Building Area',
  'LEED Certified',
  'Submarket Cluster',
];

const CREXI_DETECTION_FIELDS = [
  'Property Link',
  'Crexi',
  'USPS Vacancy',
  'PFC Recording Date',
  'PFC Indicator',
  'REO Sale Flag',
  'Transaction Event Type',
  'Mailing Address Care Of',
];

export function detectImportSource(headers: string[]): ImportSource {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));

  // CoStar detection
  const costarMatches = COSTAR_DETECTION_FIELDS.filter(f =>
    headerSet.has(f.toLowerCase())
  ).length;
  if (costarMatches >= 2) return 'costar';

  // Crexi detection
  const crexiMatches = CREXI_DETECTION_FIELDS.filter(f =>
    headerSet.has(f.toLowerCase())
  ).length;
  if (crexiMatches >= 2) return 'crexi';

  // Check for Crexi-specific "Property Link" which is very unique
  if (headerSet.has('property link')) return 'crexi';

  return 'manual';
}

// ============================================================================
// CREXI MAPPINGS
// ============================================================================

export const CREXI_TO_MASTER_PROPERTIES: Record<string, string[]> = {
  // -------------------------------------------------------------------------
  // REQUIRED FIELDS
  // -------------------------------------------------------------------------
  address: [
    'Address',
  ],
  city: [
    'City',
  ],
  state: [
    'State',
  ],

  // -------------------------------------------------------------------------
  // CORE IDENTIFICATION
  // -------------------------------------------------------------------------
  zip: [
    'Zip Code',
  ],
  county: [
    'County',
  ],
  property_name: [
    'Property Name',
  ],
  crexi_id: [
    'Property Link',  // Extract ID from URL or store full URL
  ],
  apn: [
    'APN',
  ],
  unit: [
    'Unit',
  ],

  // -------------------------------------------------------------------------
  // CLASSIFICATION
  // -------------------------------------------------------------------------
  property_type: [
    'Property Type',
  ],
  zoning: [
    'Zoning Code',
  ],
  opportunity_zone: [
    'Opportunity Zone',
  ],

  // -------------------------------------------------------------------------
  // LOCATION / GEO
  // -------------------------------------------------------------------------
  latitude: [
    'Latitude',
  ],
  longitude: [
    'Longitude',
  ],

  // -------------------------------------------------------------------------
  // SIZE METRICS
  // -------------------------------------------------------------------------
  building_size: [
    'Building SqFt',
  ],
  lot_size_acres: [
    'Lot Size Acres',
  ],
  land_area_sf: [
    'Lot Size SqFt',
  ],
  number_of_units: [
    'Number of Units',
  ],
  number_of_floors: [
    'Number of Stories',
  ],
  number_of_buildings: [
    'Building Count',
  ],
  number_of_addresses: [
    'Number of Addresses',
  ],

  // -------------------------------------------------------------------------
  // BUILDING DETAILS
  // -------------------------------------------------------------------------
  year_built: [
    'Year Built',
  ],

  // -------------------------------------------------------------------------
  // LEASING STATUS
  // -------------------------------------------------------------------------
  percent_leased: [
    'Occupancy',  // Will transform: Occupancy = Percent Leased
  ],
  days_on_market: [
    'Days on Market',
  ],

  // -------------------------------------------------------------------------
  // UTILITIES
  // -------------------------------------------------------------------------
  water: [
    'Water Code',
  ],
  sewer: [
    'Sewer Code',
  ],

  // -------------------------------------------------------------------------
  // VACANCY
  // -------------------------------------------------------------------------
  usps_vacancy: [
    'USPS Vacancy',
  ],
  usps_vacancy_date: [
    'USPS Vacancy Date',
  ],

  // -------------------------------------------------------------------------
  // TAX / VALUATION
  // -------------------------------------------------------------------------
  parcel_value_type: [
    'Parcel Value Type',
  ],
  improvement_value: [
    'Improvement Value',
  ],
  land_value: [
    'Land Value',
  ],
  total_parcel_value: [
    'Total Parcel Value',
  ],
  tax_year: [
    'Tax Year',
  ],
  annual_tax_bill: [
    'Annual Tax Bill',
  ],

  // -------------------------------------------------------------------------
  // OWNER INFORMATION
  // -------------------------------------------------------------------------
  owner_name: [
    'Owner Name',
  ],
  owner_address: [
    'Mailing Address',
  ],
  owner_unit: [
    'Mailing Address Unit',
  ],
  owner_city: [
    'Mailing Address City',
  ],
  owner_state: [
    'Mailing Address State',
  ],
  owner_zip: [
    'Mailing Address Zip Code',
  ],
  owner_care_of: [
    'Mailing Address Care Of',
  ],

  // -------------------------------------------------------------------------
  // FORECLOSURE / DISTRESS
  // -------------------------------------------------------------------------
  pfc_recording_date: [
    'PFC Recording Date',
  ],
  pfc_indicator: [
    'PFC Indicator',
  ],
  pfc_document_type: [
    'PFC Document Type',
  ],
  reo_sale_flag: [
    'REO Sale Flag',
  ],
  transaction_event_type: [
    'Transaction Event Type',
  ],
};

export const CREXI_TO_TRANSACTIONS: Record<string, string[]> = {
  // -------------------------------------------------------------------------
  // SALE INFORMATION
  // -------------------------------------------------------------------------
  sale_price: [
    'Sold Price',
  ],
  transaction_date: [
    'Sale Date',
  ],
  price_per_sf: [
    'Sold Price/ SqFt',
  ],
  price_per_acre: [
    'Sold Price/ Acre',
  ],
  asking_cap_rate: [
    'Asking Cap Rate',
  ],
  cap_rate: [
    'Closing Cap Rate',
  ],
  noi: [
    'Closing NOI',
  ],

  // -------------------------------------------------------------------------
  // LEASE INFORMATION
  // -------------------------------------------------------------------------
  lease_signed_date: [
    'Lease Signed',
  ],
  lease_rate: [
    'Lease Rate',
  ],
  lease_type: [
    'Lease Type',
  ],
  lease_commencement: [
    'Lease Commencement',
  ],
  lease_term: [
    'Lease Term',
  ],
  lease_term_remaining: [
    'Lease Term Remaining',
  ],
  lease_expiration_date: [
    'Lease Expiration Date',
  ],
  rent_bumps: [
    'Rent Bumps',
  ],
  lease_options: [
    'Lease Options',
  ],
  tenant_name: [
    'Tenant(s)',
  ],

  // -------------------------------------------------------------------------
  // FINANCING
  // -------------------------------------------------------------------------
  lender: [
    'Lender',
  ],
  loan_amount: [
    'Loan Amount',
  ],
  loan_type: [
    'Loan Type',
  ],
  interest_rate: [
    'Interest Rate',
  ],
  maturity_date: [
    'Financing Maturity Date',
  ],
};

// ============================================================================
// COSTAR MAPPINGS (Full list from previous)
// ============================================================================

export const COSTAR_TO_MASTER_PROPERTIES: Record<string, string[]> = {
  // -------------------------------------------------------------------------
  // REQUIRED FIELDS
  // -------------------------------------------------------------------------
  address: [
    'Property Address',
    'Property Location',
  ],
  city: [
    'City',
    'Property City',
  ],
  state: [
    'State',
    'Property State',
  ],

  // -------------------------------------------------------------------------
  // CORE IDENTIFICATION
  // -------------------------------------------------------------------------
  zip: [
    'Zip',
    'Property Zip',
    'Property Zip Code',
  ],
  county: [
    'County Name',
    'Property County',
  ],
  property_name: [
    'Property Name',
    'Building Name',
  ],
  building_park: [
    'Building Park',
  ],
  costar_id: [
    'PropertyID',
    'CoStar ID',
  ],

  // -------------------------------------------------------------------------
  // CLASSIFICATION
  // -------------------------------------------------------------------------
  property_type: [
    'Property Type',
  ],
  property_subtype: [
    'Secondary Type',
  ],
  building_class: [
    'Building Class',
    'Star Rating',
  ],
  building_status: [
    'Building Status',
    'Constr Status',
  ],
  zoning: [
    'Zoning',
    'Proposed Land Use',
  ],

  // -------------------------------------------------------------------------
  // LOCATION / GEO
  // -------------------------------------------------------------------------
  latitude: [
    'Latitude',
  ],
  longitude: [
    'Longitude',
  ],
  submarket: [
    'Submarket Name',
    'Submarket Cluster',
  ],
  market: [
    'Market Name',
    'Market Segment',
  ],
  cross_street: [
    'Cross Street',
  ],

  // -------------------------------------------------------------------------
  // SIZE METRICS
  // -------------------------------------------------------------------------
  building_size: [
    'Rentable Building Area',
    'Building SF',
    'Total Available Space (SF)',
  ],
  land_area_sf: [
    'Land Area (SF)',
  ],
  lot_size_acres: [
    'Land Area (AC)',
  ],
  typical_floor_size: [
    'Typical Floor Size',
  ],
  number_of_floors: [
    'Number Of Stories',
    'Number of Floors',
  ],
  number_of_units: [
    'Number Of Units',
  ],
  number_of_buildings: [
    'Total Buildings',
  ],

  // -------------------------------------------------------------------------
  // BUILDING DETAILS
  // -------------------------------------------------------------------------
  year_built: [
    'Year Built',
  ],
  month_built: [
    'Month Built',
  ],
  year_renovated: [
    'Year Renovated',
  ],
  month_renovated: [
    'Month Renovated',
  ],
  construction_material: [
    'Construction Material',
  ],

  // -------------------------------------------------------------------------
  // INDUSTRIAL SPECIFIC
  // -------------------------------------------------------------------------
  clear_height_ft: [
    'Ceiling Ht',
    'Ceiling Height',
    'Clear Height',
  ],
  dock_doors: [
    'Number Of Loading Docks',
    'Loading Docks',
  ],
  grade_doors: [
    'Drive Ins',
    'Grade Level Doors',
  ],
  rail_served: [
    'Rail Lines',
  ],
  column_spacing: [
    'Column Spacing',
  ],
  sprinkler_type: [
    'Sprinklers',
  ],
  number_of_cranes: [
    'Number Of Cranes',
  ],
  power: [
    'Power',
  ],

  // -------------------------------------------------------------------------
  // OFFICE SPECIFIC
  // -------------------------------------------------------------------------
  office_space: [
    'Office Space',
  ],
  number_of_elevators: [
    'Number Of Elevators',
  ],

  // -------------------------------------------------------------------------
  // RETAIL SPECIFIC
  // -------------------------------------------------------------------------
  anchor_tenant: [
    'Anchor Tenants',
  ],
  anchor_gla: [
    'Anchor GLA',
  ],

  // -------------------------------------------------------------------------
  // MULTIFAMILY SPECIFIC
  // -------------------------------------------------------------------------
  number_of_beds: [
    'Number of Beds',
  ],
  avg_unit_sf: [
    'Avg Unit SF',
  ],
  affordable_type: [
    'Affordable Type',
  ],

  // -------------------------------------------------------------------------
  // HOTEL SPECIFIC
  // -------------------------------------------------------------------------
  hotel_class: [
    'Hotel Class',
  ],
  hotel_grade: [
    'Hotel Grade',
  ],
  hotel_operator: [
    'Hotel Operator',
  ],
  rooms: [
    'Rooms',
  ],
  brand: [
    'Brand',
    'Proposed Brand',
  ],

  // -------------------------------------------------------------------------
  // DATA CENTER SPECIFIC
  // -------------------------------------------------------------------------
  data_center_type: [
    'Data Center Type',
  ],
  capacity_total_kw: [
    'Capacity - Total Utility kW',
  ],

  // -------------------------------------------------------------------------
  // PARKING
  // -------------------------------------------------------------------------
  parking_spaces: [
    'Number Of Parking Spaces',
  ],
  parking_ratio: [
    'Parking Ratio',
  ],

  // -------------------------------------------------------------------------
  // LEASING STATUS
  // -------------------------------------------------------------------------
  percent_leased: [
    'Percent Leased',
  ],
  vacancy_percent: [
    'Vacancy %',
  ],
  total_vacant_available: [
    'Total Vacant Available',
  ],
  direct_available_space: [
    'Direct Available Space',
  ],
  sublet_available_space: [
    'Sublet Available Space',
  ],
  days_on_market: [
    'Days On Market',
  ],

  // -------------------------------------------------------------------------
  // RENT METRICS
  // -------------------------------------------------------------------------
  rent_per_sf: [
    'Rent/SF',
    'Avg Asking/SF',
    'Avg Effective/SF',
  ],
  avg_weighted_rent: [
    'Average Weighted Rent',
  ],

  // -------------------------------------------------------------------------
  // EXPENSES & FINANCIALS
  // -------------------------------------------------------------------------
  ops_expense: [
    'Ops Expense',
  ],
  ops_expense_per_sf: [
    'Ops Expense Per SF',
  ],
  taxes_total: [
    'Taxes Total',
  ],
  taxes_per_sf: [
    'Taxes Per SF',
  ],
  tax_year: [
    'Tax Year',
  ],

  // -------------------------------------------------------------------------
  // OWNER INFORMATION
  // -------------------------------------------------------------------------
  owner_name: [
    'Owner Name',
    'True Owner Name',
    'Recorded Owner Name',
  ],
  owner_contact: [
    'Owner Contact',
    'True Owner Contact',
    'Recorded Owner Contact',
  ],
  owner_phone: [
    'Owner Phone',
    'True Owner Phone',
    'Recorded Owner Phone',
  ],
  owner_address: [
    'Owner Address',
    'True Owner Address',
    'Recorded Owner Address',
  ],
  parent_company: [
    'Parent Company',
  ],
  fund_name: [
    'Fund Name',
  ],

  // -------------------------------------------------------------------------
  // PROPERTY MANAGER
  // -------------------------------------------------------------------------
  property_manager_name: [
    'Property Manager Name',
  ],
  property_manager_phone: [
    'Property Manager Phone',
  ],

  // -------------------------------------------------------------------------
  // LEASING COMPANY
  // -------------------------------------------------------------------------
  leasing_company_name: [
    'Leasing Company Name',
  ],
  leasing_company_contact: [
    'Leasing Company Contact',
  ],
  leasing_company_phone: [
    'Leasing Company Phone',
  ],

  // -------------------------------------------------------------------------
  // DEVELOPER / ARCHITECT
  // -------------------------------------------------------------------------
  developer_name: [
    'Developer Name',
  ],
  architect_name: [
    'Architect Name',
  ],

  // -------------------------------------------------------------------------
  // PARCEL / LEGAL
  // -------------------------------------------------------------------------
  parcel_number_min: [
    'Parcel Number 1(Min)',
  ],
  parcel_number_max: [
    'Parcel Number 2(Max)',
  ],

  // -------------------------------------------------------------------------
  // FLOOD & ENVIRONMENTAL
  // -------------------------------------------------------------------------
  flood_risk: [
    'Flood Risk',
    'Flood Risk Area',
  ],
  flood_zone: [
    'Flood Zone',
    'Fema Flood Zone',
  ],

  // -------------------------------------------------------------------------
  // UTILITIES
  // -------------------------------------------------------------------------
  sewer: [
    'Sewer',
  ],
  water: [
    'Water',
  ],
  gas: [
    'Gas',
  ],

  // -------------------------------------------------------------------------
  // GREEN / SUSTAINABILITY
  // -------------------------------------------------------------------------
  energy_star: [
    'Energy Star',
  ],
  leed_certified: [
    'LEED Certified',
  ],

  // -------------------------------------------------------------------------
  // AMENITIES
  // -------------------------------------------------------------------------
  amenities: [
    'Amenities',
  ],
  features: [
    'Features',
  ],
};

export const COSTAR_TO_TRANSACTIONS: Record<string, string[]> = {
  sale_price: [
    'Last Sale Price',
    'For Sale Price',
  ],
  transaction_date: [
    'Last Sale Date',
  ],
  price_per_sf: [
    'For Sale Price Per SF',
  ],
  cap_rate: [
    'Cap Rate',
  ],
  for_sale_status: [
    'For Sale Status',
  ],
  buyer_name: [
    'True Owner Name',
    'Recorded Owner Name',
  ],
  seller_company: [
    'Sale Company Name',
    'Sales Company',
  ],
  seller_contact: [
    'Sale Company Contact',
    'Sales Contact',
  ],
};

// ============================================================================
// FIELDS TO SKIP (explicitly never map these)
// ============================================================================

export const SKIP_FIELDS = [
  // CoStar - Location Type is NOT the address!
  'Location Type',

  // Geographic aggregations
  'Continent',
  'Subcontinent',
  'Country',

  // CoStar bedroom-specific rent data (too granular)
  'One Bedroom Asking Rent/Bed',
  'One Bedroom Asking Rent/SF',
  'Two Bedroom Asking Rent/Bed',
  'Two Bedroom Asking Rent/SF',
  'Three Bedroom Asking Rent/Bed',
  'Three Bedroom Asking Rent/SF',
  'Four Bedroom Asking Rent/Bed',
  'Four Bedroom Asking Rent/SF',
  'Studio Asking Rent/Bed',
  'Studio Asking Rent/SF',
];

// ============================================================================
// FIELD TRANSFORMATIONS
// ============================================================================

export const FIELD_TRANSFORMATIONS: Record<string, (value: any) => any> = {
  // Convert "2 Star" to "Class B", etc.
  building_class: (value: string) => {
    if (!value) return null;
    const starMatch = value.match(/(\d)\s*Star/i);
    if (starMatch) {
      const stars = parseInt(starMatch[1]);
      if (stars >= 4) return 'Class A';
      if (stars === 3) return 'Class A';
      if (stars === 2) return 'Class B';
      if (stars === 1) return 'Class C';
    }
    return value;
  },

  // Convert Rail Lines presence to boolean
  rail_served: (value: string) => {
    if (!value || value.toLowerCase() === 'none' || value === '0') return false;
    return true;
  },

  // Normalize property type
  property_type: (value: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();

    const typeMap: Record<string, string> = {
      'industrial': 'industrial',
      'warehouse': 'industrial',
      'distribution': 'industrial',
      'manufacturing': 'industrial',
      'flex': 'industrial',
      'office': 'office',
      'retail': 'retail',
      'multifamily': 'multifamily',
      'apartment': 'multifamily',
      'land': 'land',
      'hospitality': 'special_purpose',
      'hotel': 'special_purpose',
      'self storage': 'special_purpose',
    };

    for (const [key, mappedType] of Object.entries(typeMap)) {
      if (normalized.includes(key)) return mappedType;
    }
    return value;
  },

  // Parse percentages
  percent_leased: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace('%', '').trim());
    return isNaN(num) ? null : num;
  },

  // Alias for Crexi's "Occupancy" field
  occupancy: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace('%', '').trim());
    return isNaN(num) ? null : num;
  },

  // Parse currency
  sale_price: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
    return isNaN(num) ? null : num;
  },

  loan_amount: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
    return isNaN(num) ? null : num;
  },

  improvement_value: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
    return isNaN(num) ? null : num;
  },

  land_value: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
    return isNaN(num) ? null : num;
  },

  total_parcel_value: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
    return isNaN(num) ? null : num;
  },

  annual_tax_bill: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
    return isNaN(num) ? null : num;
  },

  // Normalize state to 2-letter code
  state: (value: string) => {
    if (!value) return null;
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length === 2) return trimmed;

    const stateMap: Record<string, string> = {
      'CALIFORNIA': 'CA',
      'ARIZONA': 'AZ',
      'NEVADA': 'NV',
      'TEXAS': 'TX',
      'OREGON': 'OR',
      'WASHINGTON': 'WA',
      'COLORADO': 'CO',
      'UTAH': 'UT',
      'NEW MEXICO': 'NM',
    };
    return stateMap[trimmed] || trimmed.substring(0, 2);
  },

  // Parse SF values
  building_size: (value: string | number) => {
    if (typeof value === 'number') return Math.round(value);
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[,SF\s]/gi, '').trim());
    return isNaN(num) ? null : Math.round(num);
  },

  land_area_sf: (value: string | number) => {
    if (typeof value === 'number') return Math.round(value);
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[,SF\s]/gi, '').trim());
    return isNaN(num) ? null : Math.round(num);
  },

  // Parse acres
  lot_size_acres: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[,AC\s]/gi, '').trim());
    return isNaN(num) ? null : num;
  },

  // Parse dates
  transaction_date: (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  },

  sale_date: (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  },

  // Parse cap rate (remove %)
  cap_rate: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace('%', '').trim());
    return isNaN(num) ? null : num;
  },

  asking_cap_rate: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace('%', '').trim());
    return isNaN(num) ? null : num;
  },

  interest_rate: (value: string | number) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const num = parseFloat(value.toString().replace('%', '').trim());
    return isNaN(num) ? null : num;
  },

  // Parse integers
  year_built: (value: string | number) => {
    if (typeof value === 'number') return Math.round(value);
    if (!value) return null;
    const num = parseInt(value.toString().trim());
    return isNaN(num) ? null : num;
  },

  number_of_units: (value: string | number) => {
    if (typeof value === 'number') return Math.round(value);
    if (!value) return null;
    const num = parseInt(value.toString().replace(/,/g, '').trim());
    return isNaN(num) ? null : num;
  },

  number_of_floors: (value: string | number) => {
    if (typeof value === 'number') return Math.round(value);
    if (!value) return null;
    const num = parseInt(value.toString().trim());
    return isNaN(num) ? null : num;
  },

  days_on_market: (value: string | number) => {
    if (typeof value === 'number') return Math.round(value);
    if (!value) return null;
    const num = parseInt(value.toString().replace(/,/g, '').trim());
    return isNaN(num) ? null : num;
  },

  // Extract Crexi ID from Property Link URL
  crexi_id: (value: string) => {
    if (!value) return null;
    // Property Link format: https://www.crexi.com/properties/123456
    const match = value.match(/crexi\.com\/properties\/(\d+)/i);
    return match ? match[1] : value;
  },

  // Boolean fields
  opportunity_zone: (value: string | boolean) => {
    if (typeof value === 'boolean') return value;
    if (!value) return false;
    const v = value.toString().toLowerCase().trim();
    return v === 'yes' || v === 'true' || v === '1' || v === 'y';
  },

  reo_sale_flag: (value: string | boolean) => {
    if (typeof value === 'boolean') return value;
    if (!value) return false;
    const v = value.toString().toLowerCase().trim();
    return v === 'yes' || v === 'true' || v === '1' || v === 'y';
  },
};

// ============================================================================
// VALIDATION RULES
// ============================================================================

export const REQUIRED_FIELDS = ['address', 'city', 'state'];

export const VALIDATION_RULES: Record<string, (value: any) => boolean> = {
  address: (v) => typeof v === 'string' && v.trim().length > 3 && !['suburban', 'urban', 'cbd', 'rural'].includes(v.trim().toLowerCase()),
  city: (v) => typeof v === 'string' && v.trim().length > 1,
  state: (v) => typeof v === 'string' && v.trim().length === 2,
  zip: (v) => !v || /^\d{5}(-\d{4})?$/.test(v.toString()),
  building_size: (v) => !v || (typeof v === 'number' && v > 0),
  year_built: (v) => !v || (typeof v === 'number' && v >= 1800 && v <= 2030),
  percent_leased: (v) => !v || (typeof v === 'number' && v >= 0 && v <= 100),
  cap_rate: (v) => !v || (typeof v === 'number' && v >= 0 && v <= 50),
  latitude: (v) => !v || (typeof v === 'number' && v >= -90 && v <= 90),
  longitude: (v) => !v || (typeof v === 'number' && v >= -180 && v <= 180),
};

// ============================================================================
// AUTO-MAPPING FUNCTION
// ============================================================================

export function autoMapColumns(headers: string[]): AutoMapResult {
  const source = detectImportSource(headers);

  let propertyMappings: Record<string, string[]>;
  let transactionMappings: Record<string, string[]>;

  if (source === 'crexi') {
    propertyMappings = CREXI_TO_MASTER_PROPERTIES;
    transactionMappings = CREXI_TO_TRANSACTIONS;
  } else {
    // Default to CoStar (also used for manual with CoStar-like headers)
    propertyMappings = COSTAR_TO_MASTER_PROPERTIES;
    transactionMappings = COSTAR_TO_TRANSACTIONS;
  }

  const propertyMapping: ColumnMapping = {};
  const transactionMapping: ColumnMapping = {};
  const unmappedColumns: string[] = [];
  const warnings: string[] = [];
  const mappedHeaders = new Set<string>();

  // First pass: Map property fields
  for (const [dbField, sourceColumns] of Object.entries(propertyMappings)) {
    for (const sourceCol of sourceColumns) {
      const matchedHeader = headers.find(h =>
        h.toLowerCase().trim() === sourceCol.toLowerCase().trim()
      );
      if (matchedHeader && !mappedHeaders.has(matchedHeader)) {
        propertyMapping[matchedHeader] = dbField;
        mappedHeaders.add(matchedHeader);
        break;
      }
    }
  }

  // Second pass: Map transaction fields
  for (const [dbField, sourceColumns] of Object.entries(transactionMappings)) {
    for (const sourceCol of sourceColumns) {
      const matchedHeader = headers.find(h =>
        h.toLowerCase().trim() === sourceCol.toLowerCase().trim()
      );
      if (matchedHeader && !mappedHeaders.has(matchedHeader)) {
        transactionMapping[matchedHeader] = dbField;
        mappedHeaders.add(matchedHeader);
        break;
      }
    }
  }

  // Track unmapped columns
  for (const header of headers) {
    if (!mappedHeaders.has(header) && !SKIP_FIELDS.includes(header)) {
      unmappedColumns.push(header);
    }
  }

  // Generate warnings
  const hasAddress = Object.values(propertyMapping).includes('address');
  const hasCity = Object.values(propertyMapping).includes('city');
  const hasState = Object.values(propertyMapping).includes('state');

  if (!hasAddress) {
    warnings.push('CRITICAL: No address column found. Import will fail for all rows.');
  }
  if (!hasCity) {
    warnings.push('CRITICAL: No city column found. Import will fail for all rows.');
  }
  if (!hasState) {
    warnings.push('CRITICAL: No state column found. Import will fail for all rows.');
  }

  // Check for Location Type accidentally mapped
  if (propertyMapping['Location Type']) {
    warnings.push('WARNING: "Location Type" was mapped. This is NOT an address field and has been removed.');
    delete propertyMapping['Location Type'];
  }

  return {
    propertyMapping,
    transactionMapping,
    unmappedColumns,
    warnings,
    detectedSource: source,
  };
}

// ============================================================================
// TRANSFORM ROW FUNCTION
// ============================================================================

export function transformRow(
  row: Record<string, any>,
  propertyMapping: ColumnMapping,
  transactionMapping: ColumnMapping
): {
  property: Record<string, any>;
  transaction: Record<string, any>;
  errors: string[];
} {
  const property: Record<string, any> = {};
  const transaction: Record<string, any> = {};
  const errors: string[] = [];

  // Transform property fields
  for (const [sourceCol, dbField] of Object.entries(propertyMapping)) {
    let value = row[sourceCol];

    // Apply transformation if exists
    if (FIELD_TRANSFORMATIONS[dbField]) {
      try {
        value = FIELD_TRANSFORMATIONS[dbField](value);
      } catch (e) {
        errors.push(`Transform error for ${dbField}: ${e}`);
      }
    }

    // Validate if rule exists
    if (VALIDATION_RULES[dbField] && value !== null && value !== undefined) {
      if (!VALIDATION_RULES[dbField](value)) {
        errors.push(`Validation failed for ${dbField}: ${value}`);
        value = null;
      }
    }

    property[dbField] = value;
  }

  // Transform transaction fields
  for (const [sourceCol, dbField] of Object.entries(transactionMapping)) {
    let value = row[sourceCol];

    if (FIELD_TRANSFORMATIONS[dbField]) {
      try {
        value = FIELD_TRANSFORMATIONS[dbField](value);
      } catch (e) {
        errors.push(`Transform error for ${dbField}: ${e}`);
      }
    }

    transaction[dbField] = value;
  }

  return { property, transaction, errors };
}
