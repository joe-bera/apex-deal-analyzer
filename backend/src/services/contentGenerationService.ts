import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { callClaude, parseClaudeJSON } from './claudeService';

// Content types that can be generated
export type ContentType =
  | 'property_description'
  | 'executive_summary'
  | 'location_analysis'
  | 'property_highlights'
  | 'market_analysis'
  | 'team_intro';

interface PropertyData {
  id: string;
  address?: string;
  property_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  submarket?: string;
  property_type?: string;
  property_subtype?: string;
  building_size?: number;
  land_area_sf?: number;
  lot_size_acres?: number;
  year_built?: number;
  year_renovated?: number;
  number_of_floors?: number;
  number_of_units?: number;
  clear_height_ft?: number;
  dock_doors?: number;
  grade_doors?: number;
  rail_served?: boolean;
  sprinkler_type?: string;
  power_amps?: number;
  office_percentage?: number;
  frontage_ft?: number;
  parking_spaces?: number;
  parking_ratio?: number;
  anchor_tenant?: string;
  percent_leased?: number;
  building_class?: string;
  zoning?: string;
  owner_name?: string;
}

interface TransactionData {
  transaction_type?: string;
  transaction_date?: string;
  sale_price?: number;
  price_per_sf?: number;
  cap_rate?: number;
  noi?: number;
  asking_price?: number;
  asking_price_per_sf?: number;
  tenant_name?: string;
  lease_term_months?: number;
  rent_per_sf_year?: number;
}

interface CompanyInfo {
  company_name?: string;
  company_phone?: string;
  company_email?: string;
  company_address?: string;
}

interface GeneratedContentResult {
  content: string;
  cached: boolean;
  tokens_used?: number;
}

/**
 * Build a hash key from property fields relevant to a content type.
 * If property data changes, the hash changes and triggers regeneration.
 */
function buildPromptHash(property: PropertyData, contentType: ContentType, extra?: Record<string, unknown>): string {
  const relevantFields: Record<string, unknown> = {
    address: property.address,
    city: property.city,
    state: property.state,
    property_type: property.property_type,
    property_subtype: property.property_subtype,
    building_size: property.building_size,
    year_built: property.year_built,
    clear_height_ft: property.clear_height_ft,
    percent_leased: property.percent_leased,
    content_type: contentType,
  };

  if (extra) {
    Object.assign(relevantFields, extra);
  }

  const str = JSON.stringify(relevantFields, Object.keys(relevantFields).sort());
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Check cache for existing content
 */
async function getCachedContent(
  propertyId: string,
  contentType: ContentType,
  promptHash: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('generated_content')
    .select('content')
    .eq('master_property_id', propertyId)
    .eq('content_type', contentType)
    .eq('prompt_hash', promptHash)
    .single();

  return data?.content || null;
}

/**
 * Save content to cache
 */
async function cacheContent(
  propertyId: string,
  contentType: ContentType,
  promptHash: string,
  content: string,
  userId: string,
  modelUsed?: string,
  tokensUsed?: number
): Promise<void> {
  await supabaseAdmin
    .from('generated_content')
    .upsert({
      master_property_id: propertyId,
      content_type: contentType,
      prompt_hash: promptHash,
      content,
      model_used: modelUsed,
      tokens_used: tokensUsed,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'master_property_id,content_type,prompt_hash',
    });
}

/**
 * Format property details for prompt context
 */
function formatPropertyContext(property: PropertyData, transaction?: TransactionData): string {
  const lines: string[] = [];

  lines.push(`Address: ${property.address || 'N/A'}`);
  if (property.property_name) lines.push(`Property Name: ${property.property_name}`);
  lines.push(`Location: ${property.city || ''}, ${property.state || 'CA'} ${property.zip || ''}`);
  if (property.county) lines.push(`County: ${property.county}`);
  if (property.submarket) lines.push(`Submarket: ${property.submarket}`);
  lines.push(`Property Type: ${(property.property_type || 'industrial').replace(/_/g, ' ')}`);
  if (property.property_subtype) lines.push(`Subtype: ${property.property_subtype.replace(/_/g, ' ')}`);
  if (property.building_class) lines.push(`Building Class: ${property.building_class}`);
  if (property.building_size) lines.push(`Building Size: ${property.building_size.toLocaleString()} SF`);
  if (property.land_area_sf) lines.push(`Land Area: ${property.land_area_sf.toLocaleString()} SF`);
  if (property.lot_size_acres) lines.push(`Lot Size: ${property.lot_size_acres} acres`);
  if (property.year_built) lines.push(`Year Built: ${property.year_built}`);
  if (property.year_renovated) lines.push(`Year Renovated: ${property.year_renovated}`);
  if (property.number_of_floors) lines.push(`Floors: ${property.number_of_floors}`);
  if (property.clear_height_ft) lines.push(`Clear Height: ${property.clear_height_ft} ft`);
  if (property.dock_doors) lines.push(`Dock Doors: ${property.dock_doors}`);
  if (property.grade_doors) lines.push(`Grade-Level Doors: ${property.grade_doors}`);
  if (property.rail_served) lines.push(`Rail Served: Yes`);
  if (property.sprinkler_type) lines.push(`Sprinkler: ${property.sprinkler_type}`);
  if (property.power_amps) lines.push(`Power: ${property.power_amps} amps`);
  if (property.office_percentage) lines.push(`Office %: ${property.office_percentage}%`);
  if (property.parking_spaces) lines.push(`Parking: ${property.parking_spaces} spaces`);
  if (property.parking_ratio) lines.push(`Parking Ratio: ${property.parking_ratio}/1,000 SF`);
  if (property.percent_leased != null) lines.push(`Leased: ${property.percent_leased}%`);
  if (property.zoning) lines.push(`Zoning: ${property.zoning}`);

  if (transaction) {
    lines.push('');
    lines.push('--- Transaction Data ---');
    if (transaction.sale_price) lines.push(`Sale Price: $${transaction.sale_price.toLocaleString()}`);
    if (transaction.asking_price) lines.push(`Asking Price: $${transaction.asking_price.toLocaleString()}`);
    if (transaction.price_per_sf) lines.push(`Price/SF: $${transaction.price_per_sf.toLocaleString()}`);
    if (transaction.cap_rate) lines.push(`CAP Rate: ${transaction.cap_rate}%`);
    if (transaction.noi) lines.push(`NOI: $${transaction.noi.toLocaleString()}`);
    if (transaction.tenant_name) lines.push(`Tenant: ${transaction.tenant_name}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Generation Functions
// ============================================================================

export async function generatePropertyDescription(
  property: PropertyData,
  userId: string,
  transaction?: TransactionData
): Promise<GeneratedContentResult> {
  const contentType: ContentType = 'property_description';
  const promptHash = buildPromptHash(property, contentType);

  // Check cache
  const cached = await getCachedContent(property.id, contentType, promptHash);
  if (cached) return { content: cached, cached: true };

  const context = formatPropertyContext(property, transaction);
  const response = await callClaude({
    systemPrompt: 'You are a commercial real estate marketing copywriter. Write professional, compelling property descriptions for marketing materials. Return only the text content, no JSON wrapping.',
    prompt: `Write a 2-3 paragraph property description for the following commercial property. Focus on key selling points, building features, and location advantages. Use professional real estate marketing language.\n\n${context}`,
    maxTokens: 1024,
    temperature: 0.7,
  });

  const content = response.content.trim();
  const totalTokens = response.usage.inputTokens + response.usage.outputTokens;

  await cacheContent(property.id, contentType, promptHash, content, userId, 'claude', totalTokens);
  return { content, cached: false, tokens_used: totalTokens };
}

export async function generateExecutiveSummary(
  property: PropertyData,
  userId: string,
  transaction?: TransactionData
): Promise<GeneratedContentResult> {
  const contentType: ContentType = 'executive_summary';
  const promptHash = buildPromptHash(property, contentType);

  const cached = await getCachedContent(property.id, contentType, promptHash);
  if (cached) return { content: cached, cached: true };

  const context = formatPropertyContext(property, transaction);
  const response = await callClaude({
    systemPrompt: 'You are a commercial real estate investment analyst. Write professional executive summaries for offering memorandums. Return only the text content, no JSON wrapping.',
    prompt: `Write an executive summary (3-4 paragraphs) for an Offering Memorandum for this commercial property. Include investment highlights, property overview, financial summary, and market positioning. Use formal investment-grade language.\n\n${context}`,
    maxTokens: 1500,
    temperature: 0.6,
  });

  const content = response.content.trim();
  const totalTokens = response.usage.inputTokens + response.usage.outputTokens;

  await cacheContent(property.id, contentType, promptHash, content, userId, 'claude', totalTokens);
  return { content, cached: false, tokens_used: totalTokens };
}

export async function generateLocationAnalysis(
  property: PropertyData,
  userId: string
): Promise<GeneratedContentResult> {
  const contentType: ContentType = 'location_analysis';
  const promptHash = buildPromptHash(property, contentType);

  const cached = await getCachedContent(property.id, contentType, promptHash);
  if (cached) return { content: cached, cached: true };

  const context = formatPropertyContext(property);
  const response = await callClaude({
    systemPrompt: 'You are a commercial real estate market analyst specializing in Southern California industrial markets. Write detailed location analyses. Return only the text content, no JSON wrapping.',
    prompt: `Write a location analysis (2-3 paragraphs) for this property. Discuss the submarket, proximity to major transportation corridors (freeways, airports, ports), labor market, and growth trends in the area. Focus on factors relevant to industrial/commercial real estate.\n\n${context}`,
    maxTokens: 1200,
    temperature: 0.6,
  });

  const content = response.content.trim();
  const totalTokens = response.usage.inputTokens + response.usage.outputTokens;

  await cacheContent(property.id, contentType, promptHash, content, userId, 'claude', totalTokens);
  return { content, cached: false, tokens_used: totalTokens };
}

export async function generatePropertyHighlights(
  property: PropertyData,
  userId: string,
  transaction?: TransactionData
): Promise<GeneratedContentResult> {
  const contentType: ContentType = 'property_highlights';
  const promptHash = buildPromptHash(property, contentType);

  const cached = await getCachedContent(property.id, contentType, promptHash);
  if (cached) return { content: cached, cached: true };

  const context = formatPropertyContext(property, transaction);
  const response = await callClaude({
    systemPrompt: 'You are a commercial real estate marketing specialist. Return only a JSON array of strings, no other text.',
    prompt: `Generate 5-8 concise property highlight bullet points for marketing materials. Each bullet should be a single compelling sentence. Return as a JSON array of strings.\n\nExample: ["Strategic location near I-10 and I-15 freeway interchange", "Modern 32-foot clear height warehouse"]\n\n${context}`,
    maxTokens: 800,
    temperature: 0.7,
  });

  let highlights: string[];
  try {
    highlights = parseClaudeJSON<string[]>(response.content);
  } catch {
    // Fallback: split by newlines if JSON parse fails
    highlights = response.content
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  const content = JSON.stringify(highlights);
  const totalTokens = response.usage.inputTokens + response.usage.outputTokens;

  await cacheContent(property.id, contentType, promptHash, content, userId, 'claude', totalTokens);
  return { content, cached: false, tokens_used: totalTokens };
}

export async function generateMarketAnalysis(
  property: PropertyData,
  userId: string
): Promise<GeneratedContentResult> {
  const contentType: ContentType = 'market_analysis';
  const promptHash = buildPromptHash(property, contentType);

  const cached = await getCachedContent(property.id, contentType, promptHash);
  if (cached) return { content: cached, cached: true };

  const context = formatPropertyContext(property);
  const response = await callClaude({
    systemPrompt: 'You are a commercial real estate market analyst specializing in Southern California. Write data-driven market analysis sections for proposals. Return only the text content, no JSON wrapping.',
    prompt: `Write a market analysis (2-3 paragraphs) for a proposal involving this property. Discuss current market conditions, vacancy rates, rental trends, comparable sales trends, and investment outlook for this property type and submarket.\n\n${context}`,
    maxTokens: 1200,
    temperature: 0.6,
  });

  const content = response.content.trim();
  const totalTokens = response.usage.inputTokens + response.usage.outputTokens;

  await cacheContent(property.id, contentType, promptHash, content, userId, 'claude', totalTokens);
  return { content, cached: false, tokens_used: totalTokens };
}

export async function generateTeamIntro(
  companyInfo: CompanyInfo,
  userId: string
): Promise<GeneratedContentResult> {
  const contentType: ContentType = 'team_intro';
  // Use a synthetic property ID for team intro (user-level, not property-specific)
  // We'll use the userId as a proxy since team intro is per-company, not per-property
  const promptHash = crypto.createHash('md5')
    .update(JSON.stringify(companyInfo))
    .digest('hex');

  // Team intro isn't tied to a specific property, so we skip cache lookup by property
  // Instead we check by user + content_type + hash across any property
  const { data: cachedData } = await supabaseAdmin
    .from('generated_content')
    .select('content')
    .eq('content_type', contentType)
    .eq('prompt_hash', promptHash)
    .eq('created_by', userId)
    .limit(1)
    .single();

  if (cachedData?.content) return { content: cachedData.content, cached: true };

  const companyName = companyInfo.company_name || 'Apex Real Estate Services';
  const response = await callClaude({
    systemPrompt: 'You are a commercial real estate marketing writer. Write professional team/company introduction sections. Return only the text content, no JSON wrapping.',
    prompt: `Write a "Why ${companyName}" section (2 paragraphs) for a commercial real estate proposal. Highlight expertise in industrial properties in Southern California (Inland Empire and Coachella Valley), market knowledge, client-focused approach, and track record. Keep it professional but compelling.\n\nCompany: ${companyName}\nPhone: ${companyInfo.company_phone || 'N/A'}\nEmail: ${companyInfo.company_email || 'N/A'}\nAddress: ${companyInfo.company_address || 'N/A'}`,
    maxTokens: 800,
    temperature: 0.7,
  });

  const content = response.content.trim();
  const totalTokens = response.usage.inputTokens + response.usage.outputTokens;

  // Cache with a placeholder property ID — we need one for the FK constraint
  // We'll store it but the lookup above uses created_by + content_type + prompt_hash
  // To handle the FK, we skip caching team_intro in the DB table if no property context
  // Instead, just return the content (it will regenerate, but team intros are cheap)

  return { content, cached: false, tokens_used: totalTokens };
}

// ============================================================================
// Batch generation: generate multiple content types at once
// ============================================================================

export interface BatchGenerationResult {
  [key: string]: GeneratedContentResult;
}

export async function generateContentBatch(
  property: PropertyData,
  contentTypes: ContentType[],
  userId: string,
  transaction?: TransactionData,
  companyInfo?: CompanyInfo
): Promise<BatchGenerationResult> {
  const results: BatchGenerationResult = {};

  // Generate each content type (sequentially to manage API rate)
  for (const ct of contentTypes) {
    try {
      switch (ct) {
        case 'property_description':
          results[ct] = await generatePropertyDescription(property, userId, transaction);
          break;
        case 'executive_summary':
          results[ct] = await generateExecutiveSummary(property, userId, transaction);
          break;
        case 'location_analysis':
          results[ct] = await generateLocationAnalysis(property, userId);
          break;
        case 'property_highlights':
          results[ct] = await generatePropertyHighlights(property, userId, transaction);
          break;
        case 'market_analysis':
          results[ct] = await generateMarketAnalysis(property, userId);
          break;
        case 'team_intro':
          results[ct] = await generateTeamIntro(companyInfo || {}, userId);
          break;
      }
    } catch (error: any) {
      console.error(`[ContentGeneration] Failed to generate ${ct}:`, error.message);
      results[ct] = { content: '', cached: false };
    }
  }

  return results;
}
