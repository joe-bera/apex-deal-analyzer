import { callClaude, callClaudeWithPDF, parseClaudeJSON } from './claudeService';
import { AppError } from '../middleware/errorHandler';

/**
 * Document types we support for extraction
 */
export type DocumentType =
  | 'offering_memorandum'
  | 'property_profile'
  | 'title_report'
  | 'comp'
  | 'lease'
  | 'appraisal'
  | 'environmental_report'
  | 'other';

/**
 * Historical transaction data
 */
export interface HistoricalTransaction {
  transaction_date?: string;
  sale_price?: number;
  price_per_sf?: number;
  buyer?: string;
  seller?: string;
  transaction_type?: 'sale' | 'lease' | 'refinance' | 'transfer';
  notes?: string;
}

/**
 * Extracted property data structure
 */
export interface ExtractedPropertyData {
  // Basic property information
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  apn?: string; // Assessor's Parcel Number
  property_type?: 'industrial' | 'office' | 'retail' | 'multifamily' | 'land' | 'mixed_use';
  subtype?: string; // e.g., "warehouse", "flex space", "cold storage"

  // Size and physical characteristics
  building_size?: number; // square feet
  lot_size?: number; // lot size value
  lot_size_unit?: 'sf' | 'acres'; // unit for lot_size
  year_built?: number;
  stories?: number;
  units?: number; // for multifamily

  // Financial metrics
  price?: number;
  price_per_sqft?: number;
  cap_rate?: number;
  noi?: number; // Net Operating Income
  gross_income?: number;
  operating_expenses?: number;

  // Lease information
  occupancy_rate?: number;
  lease_rate_per_sqft?: number;
  lease_term_years?: number;
  tenant_name?: string;

  // Market data
  market?: string; // e.g., "Inland Empire", "Coachella Valley"
  submarket?: string;
  sale_date?: string;
  comparable_to?: string; // For comp documents

  // Additional details
  zoning?: string;
  parking_spaces?: number;
  amenities?: string[];
  notes?: string;

  // Historical transaction data (for AI analysis and property history)
  transaction_history?: HistoricalTransaction[];

  // Owner information
  owner_name?: string;
  owner_address?: string;

  // Tenant rent roll (extracted from OMs and property profiles)
  tenants?: {
    tenant_name: string;
    unit_number?: string;
    leased_sf?: number;
    monthly_base_rent?: number;
    rent_per_sf?: number;
    lease_start?: string;
    lease_end?: string;
    lease_type?: string;
  }[];

  // Operating expense line items
  expenses?: {
    category: string;
    description?: string;
    annual_amount: number;
  }[];

  // Confidence scores (0-100)
  confidence_scores?: {
    [key: string]: number;
  };
}

/**
 * System prompt for Claude extraction
 */
const EXTRACTION_SYSTEM_PROMPT = `You are an expert commercial real estate analyst specializing in industrial properties in Southern California, particularly the Inland Empire and Coachella Valley markets.

Your task is to extract structured data from real estate documents with high accuracy. You must:

1. Extract only information that is explicitly stated in the document
2. Use null for fields that are not found or unclear
3. Convert all measurements to consistent units (square feet for area, dollars for money)
4. Calculate derived metrics when base data is available (e.g., price_per_sqft from price and building_size)
5. Assign confidence scores (0-100) for each extracted field based on how clearly it's stated
6. Focus on industrial properties (warehouses, distribution centers, manufacturing, flex space)

Return your response as valid JSON matching the specified schema.`;

/**
 * Build extraction prompt based on document type
 */
const buildExtractionPrompt = (documentType: DocumentType, text: string): string => {
  const basePrompt = `Extract structured property data from the following ${documentType.replace('_', ' ')} document.

Document Text:
---
${text.slice(0, 50000)}
---

`;

  let specificInstructions = '';

  switch (documentType) {
    case 'offering_memorandum':
      specificInstructions = `This is an Offering Memorandum (OM). Focus on:
- Property address and location details
- Building specifications (size, year built, construction type)
- Financial performance (asking price, NOI, CAP rate, rental income)
- Tenant information (names, lease terms, occupancy)
- Property features and amenities
- Market positioning and comparable sales data
- Current owner information (owner_name)

IMPORTANT: Look for "Property History" or "Transaction History" sections:
- Extract any previous sales with dates and prices
- Note any significant improvements or renovations with dates
- Put historical sales in the transaction_history array

IMPORTANT: Extract the full rent roll / tenant roster if present:
- Each tenant: name, suite/unit number, leased SF, monthly base rent, rent per SF, lease start date, lease end date, lease type (gross, nnn, modified_gross, etc.)
- Put in the "tenants" array

IMPORTANT: Extract operating expense line items if present:
- Each line item: category, description, annual amount
- Categories should be one of: property_tax, insurance, utilities_electric, utilities_water, utilities_gas, maintenance_repair, landscaping, janitorial, management_fee, other
- Put in the "expenses" array`;
      break;

    case 'title_report':
      specificInstructions = `This is a Title Report. Focus on:
- Property legal description and APN
- Property address
- Current owner information (owner_name, owner_address)
- Lot size and property dimensions
- Zoning designation
- Any encumbrances or liens (note in notes field)

IMPORTANT: Extract ALL historical sales/transfers from the Chain of Title or Vesting Deed sections:
- Look for "Grant Deed", "Warranty Deed", "Quitclaim Deed" entries
- Extract each sale with: date, sale price (if shown), buyer, seller
- Include refinances and transfers as they show property history
- Put all historical transactions in the transaction_history array`;
      break;

    case 'comp':
      specificInstructions = `This is a Comparable Sale (Comp) document. Focus on:
- Subject property this comp relates to (comparable_to field)
- Comp property address and location
- Sale price and sale date
- Building size and price per square foot
- Property type and characteristics
- Key differences from subject property`;
      break;

    case 'lease':
      specificInstructions = `This is a Lease Agreement. Focus on:
- Property address
- Tenant name
- Lease term (start date, end date, years)
- Rent amount and lease rate per square foot
- Leased space size
- Property type and use
- Key lease terms (note in notes field)`;
      break;

    case 'appraisal':
      specificInstructions = `This is an Appraisal Report. Focus on:
- Property address and legal description
- Appraised value
- Building and lot specifications
- Year built and condition
- Comparable sales used in valuation
- Income approach data (if applicable)
- Highest and best use analysis`;
      break;

    case 'environmental_report':
      specificInstructions = `This is an Environmental Report. Focus on:
- Property address and APN
- Site characteristics (lot size, topography)
- Environmental findings (note in notes field)
- Property type and historical use
- Any recommendations or concerns`;
      break;

    default:
      specificInstructions = `Extract any available property information including address, size, price, and key characteristics.`;
  }

  const jsonSchema = `
Return a JSON object with this exact structure (use null for missing fields):

{
  "address": "string or null",
  "city": "string or null",
  "state": "string or null",
  "zip_code": "string or null",
  "apn": "string or null",
  "property_type": "industrial|office|retail|multifamily|land|mixed_use or null",
  "subtype": "string or null",
  "building_size": number or null,
  "lot_size": number or null,
  "lot_size_unit": "sf" or "acres" or null,
  "year_built": number or null,
  "stories": number or null,
  "units": number or null,
  "price": number or null,
  "price_per_sqft": number or null,
  "cap_rate": number or null,
  "noi": number or null,
  "gross_income": number or null,
  "operating_expenses": number or null,
  "occupancy_rate": number or null,
  "lease_rate_per_sqft": number or null,
  "lease_term_years": number or null,
  "tenant_name": "string or null",
  "market": "string or null",
  "submarket": "string or null",
  "sale_date": "YYYY-MM-DD or null",
  "comparable_to": "string or null",
  "zoning": "string or null",
  "parking_spaces": number or null,
  "amenities": ["array", "of", "strings"] or null,
  "notes": "string with important details or null",
  "owner_name": "string or null",
  "owner_address": "string or null",
  "transaction_history": [
    {
      "transaction_date": "YYYY-MM-DD or null",
      "sale_price": number or null,
      "price_per_sf": number or null,
      "buyer": "string or null",
      "seller": "string or null",
      "transaction_type": "sale|lease|refinance|transfer or null",
      "notes": "string or null"
    }
  ] or null,
  "tenants": [
    {
      "tenant_name": "string",
      "unit_number": "string or null",
      "leased_sf": number or null,
      "monthly_base_rent": number or null,
      "rent_per_sf": number or null,
      "lease_start": "YYYY-MM-DD or null",
      "lease_end": "YYYY-MM-DD or null",
      "lease_type": "gross|nnn|modified_gross|full_service or null"
    }
  ] or null,
  "expenses": [
    {
      "category": "property_tax|insurance|utilities_electric|utilities_water|utilities_gas|maintenance_repair|landscaping|janitorial|management_fee|other",
      "description": "string or null",
      "annual_amount": number
    }
  ] or null,
  "confidence_scores": {
    "field_name": 0-100
  }
}`;

  return basePrompt + specificInstructions + '\n\n' + jsonSchema;
};

/**
 * Build extraction prompt for PDF-based extraction (no text block — PDF is sent as document content)
 */
const buildPDFExtractionPrompt = (documentType: DocumentType): string => {
  const basePrompt = `Extract structured property data from the attached ${documentType.replace('_', ' ')} PDF document. Read every page carefully and extract all available data.\n\n`;

  // Reuse the same specific instructions as text-based extraction
  let specificInstructions = '';

  switch (documentType) {
    case 'offering_memorandum':
      specificInstructions = `This is an Offering Memorandum (OM). Focus on:
- Property address and location details
- Building specifications (size, year built, construction type)
- Financial performance (asking price, NOI, CAP rate, rental income)
- Tenant information (names, lease terms, occupancy)
- Property features and amenities
- Market positioning and comparable sales data
- Current owner information (owner_name)

IMPORTANT: Extract the full rent roll / tenant roster if present:
- Each tenant: name, suite/unit number, leased SF, monthly base rent, rent per SF, lease start date, lease end date, lease type (gross, nnn, modified_gross, etc.)
- Put in the "tenants" array

IMPORTANT: Extract operating expense line items if present:
- Each line item: category, description, annual amount
- Categories should be one of: property_tax, insurance, utilities_electric, utilities_water, utilities_gas, maintenance_repair, landscaping, janitorial, management_fee, other
- Put in the "expenses" array

IMPORTANT: Look for "Property History" or "Transaction History" sections:
- Extract any previous sales with dates and prices
- Put historical sales in the transaction_history array`;
      break;

    case 'property_profile':
      specificInstructions = `This is a Property Profile. Focus on:
- Property address and location details
- Building specifications (size, year built, lot size)
- Financial data (price, NOI, cap rate)
- Tenant and lease information
- Owner information

Extract tenants into the "tenants" array and expenses into the "expenses" array if present.`;
      break;

    default:
      specificInstructions = `Extract any available property information including address, size, price, and key characteristics.`;
  }

  // Reuse the same JSON schema
  const jsonSchema = `
Return a JSON object with this exact structure (use null for missing fields):

{
  "address": "string or null",
  "city": "string or null",
  "state": "string or null",
  "zip_code": "string or null",
  "apn": "string or null",
  "property_type": "industrial|office|retail|multifamily|land|mixed_use or null",
  "subtype": "string or null",
  "building_size": number or null,
  "lot_size": number or null,
  "lot_size_unit": "sf" or "acres" or null,
  "year_built": number or null,
  "stories": number or null,
  "units": number or null,
  "price": number or null,
  "price_per_sqft": number or null,
  "cap_rate": number or null,
  "noi": number or null,
  "gross_income": number or null,
  "operating_expenses": number or null,
  "occupancy_rate": number or null,
  "lease_rate_per_sqft": number or null,
  "lease_term_years": number or null,
  "tenant_name": "string or null",
  "market": "string or null",
  "submarket": "string or null",
  "sale_date": "YYYY-MM-DD or null",
  "comparable_to": "string or null",
  "zoning": "string or null",
  "parking_spaces": number or null,
  "amenities": ["array", "of", "strings"] or null,
  "notes": "string with important details or null",
  "owner_name": "string or null",
  "owner_address": "string or null",
  "transaction_history": [
    {
      "transaction_date": "YYYY-MM-DD or null",
      "sale_price": number or null,
      "price_per_sf": number or null,
      "buyer": "string or null",
      "seller": "string or null",
      "transaction_type": "sale|lease|refinance|transfer or null",
      "notes": "string or null"
    }
  ] or null,
  "tenants": [
    {
      "tenant_name": "string",
      "unit_number": "string or null",
      "leased_sf": number or null,
      "monthly_base_rent": number or null,
      "rent_per_sf": number or null,
      "lease_start": "YYYY-MM-DD or null",
      "lease_end": "YYYY-MM-DD or null",
      "lease_type": "gross|nnn|modified_gross|full_service or null"
    }
  ] or null,
  "expenses": [
    {
      "category": "property_tax|insurance|utilities_electric|utilities_water|utilities_gas|maintenance_repair|landscaping|janitorial|management_fee|other",
      "description": "string or null",
      "annual_amount": number
    }
  ] or null,
  "confidence_scores": {
    "field_name": 0-100
  }
}`;

  return basePrompt + specificInstructions + '\n\n' + jsonSchema;
};

/**
 * Extract structured data from a PDF buffer using Claude's document vision
 * Used when text extraction yields sparse results (image-based PDFs)
 */
export const extractPropertyDataFromPDF = async (
  pdfBuffer: Buffer,
  documentType: DocumentType
): Promise<ExtractedPropertyData> => {
  try {
    const pdfBase64 = pdfBuffer.toString('base64');
    const prompt = buildPDFExtractionPrompt(documentType);

    console.log(`[ExtractionService] Using PDF vision extraction for ${documentType}, PDF size: ${pdfBuffer.length} bytes`);

    const response = await callClaudeWithPDF({
      pdfBase64,
      prompt,
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0,
    });

    const extractedData = parseClaudeJSON<ExtractedPropertyData>(response.content);

    const hasData = Object.values(extractedData).some(
      (value) => value !== null && value !== undefined
    );

    if (!hasData) {
      throw new AppError(500, 'No data could be extracted from PDF document');
    }

    return extractedData;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('PDF extraction error:', error);
    throw new AppError(500, 'Failed to extract property data from PDF');
  }
};

/**
 * Extract structured data from document text using Claude
 *
 * @param text - Raw text extracted from PDF
 * @param documentType - Type of document
 * @returns Extracted property data
 */
export const extractPropertyData = async (
  text: string,
  documentType: DocumentType
): Promise<ExtractedPropertyData> => {
  try {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new AppError(400, 'No text provided for extraction');
    }

    // Build prompt based on document type
    const prompt = buildExtractionPrompt(documentType, text);

    // Call Claude API
    const response = await callClaude({
      prompt,
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0, // Use 0 for deterministic extraction
    });

    // Parse JSON response
    const extractedData = parseClaudeJSON<ExtractedPropertyData>(response.content);

    // Validate required fields exist (at minimum we should have some data)
    const hasData = Object.values(extractedData).some(
      (value) => value !== null && value !== undefined
    );

    if (!hasData) {
      throw new AppError(500, 'No data could be extracted from document');
    }

    return extractedData;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Extraction error:', error);
    throw new AppError(500, 'Failed to extract property data');
  }
};

/**
 * Re-run extraction with user corrections/hints
 *
 * @param text - Document text
 * @param documentType - Document type
 * @param hints - User-provided hints or corrections
 * @returns Extracted property data
 */
export const extractWithHints = async (
  text: string,
  documentType: DocumentType,
  hints: string
): Promise<ExtractedPropertyData> => {
  const prompt = buildExtractionPrompt(documentType, text);
  const enhancedPrompt = `${prompt}\n\nAdditional context and corrections from user:\n${hints}`;

  const response = await callClaude({
    prompt: enhancedPrompt,
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    maxTokens: 4096,
    temperature: 0,
  });

  return parseClaudeJSON<ExtractedPropertyData>(response.content);
};
