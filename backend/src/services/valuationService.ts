import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

interface Property {
  id: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_type: string;
  building_size?: number;
  lot_size?: number;
  year_built?: number;
  price?: number;
  price_per_sqft?: number;
  cap_rate?: number;
  noi?: number;
  market?: string;
  submarket?: string;
  additional_data?: any;
}

interface Comp {
  id: string;
  comp_address: string;
  comp_city: string;
  comp_state: string;
  comp_property_type: string;
  comp_square_footage?: number;
  comp_year_built?: number;
  comp_sale_price: number;
  comp_sale_date: string;
  comp_price_per_sqft?: number;
  comp_cap_rate?: number;
  distance_miles?: number;
  similarity_score?: number;
  adjustment_notes?: string;
}

export interface ValuationResult {
  estimated_value: number;
  value_range: {
    low: number;
    high: number;
  };
  confidence_level: string;
  price_per_sqft_estimate?: number;
  analysis: string;
  comparable_analysis: Array<{
    comp_id: string;
    comp_address: string;
    sale_price: number;
    adjustments: string;
    adjusted_value: number;
  }>;
  key_findings: string[];
  recommendations: string[];
  market_insights: string;
}

/**
 * Analyze property value using Claude AI
 */
export const analyzePropertyValue = async (
  property: Property,
  comps: Comp[]
): Promise<ValuationResult> => {
  try {
    // Build comprehensive prompt for Claude
    const prompt = buildValuationPrompt(property, comps);

    // Call Claude API
    const message = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract response
    const response = message.content[0];
    if (response.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    // Parse Claude's response
    const valuation = parseValuationResponse(response.text);

    return valuation;
  } catch (error: any) {
    console.error('Valuation analysis error:', error);
    throw new Error(`Claude API error: ${error.status} ${JSON.stringify(error.error || error.message)}`);
  }
};

/**
 * Build comprehensive prompt for Claude
 */
function buildValuationPrompt(property: Property, comps: Comp[]): string {
  const propertyDesc = `
# SUBJECT PROPERTY

**Location:** ${property.address || 'N/A'}, ${property.city || 'N/A'}, ${property.state || 'N/A'} ${property.zip_code || ''}
**Type:** ${property.property_type}
**Size:** ${property.building_size ? `${property.building_size.toLocaleString()} SF` : 'N/A'}
**Lot Size:** ${property.lot_size ? `${property.lot_size} acres` : 'N/A'}
**Year Built:** ${property.year_built || 'N/A'}
**Current List Price:** ${property.price ? `$${property.price.toLocaleString()}` : 'N/A'}
**Current Price/SF:** ${property.price_per_sqft ? `$${property.price_per_sqft}/SF` : 'N/A'}
**Cap Rate:** ${property.cap_rate ? `${property.cap_rate}%` : 'N/A'}
**NOI:** ${property.noi ? `$${property.noi.toLocaleString()}` : 'N/A'}
**Market:** ${property.market || 'N/A'}
**Submarket:** ${property.submarket || 'N/A'}
${property.additional_data?.notes ? `\n**Notes:** ${property.additional_data.notes}` : ''}
`.trim();

  const compsDesc = comps.map((comp, index) => `
## COMPARABLE ${index + 1}

**Address:** ${comp.comp_address}, ${comp.comp_city}, ${comp.comp_state}
**Type:** ${comp.comp_property_type}
**Size:** ${comp.comp_square_footage ? `${comp.comp_square_footage.toLocaleString()} SF` : 'N/A'}
**Year Built:** ${comp.comp_year_built || 'N/A'}
**Sale Price:** $${comp.comp_sale_price.toLocaleString()}
**Sale Date:** ${comp.comp_sale_date}
**Price/SF:** ${comp.comp_price_per_sqft ? `$${comp.comp_price_per_sqft}/SF` : 'N/A'}
**Cap Rate:** ${comp.comp_cap_rate ? `${comp.comp_cap_rate}%` : 'N/A'}
**Distance:** ${comp.distance_miles ? `${comp.distance_miles} miles` : 'N/A'}
**Similarity Score:** ${comp.similarity_score ? `${comp.similarity_score}/100` : 'N/A'}
${comp.adjustment_notes ? `**Adjustment Notes:** ${comp.adjustment_notes}` : ''}
`.trim()).join('\n\n');

  return `You are a commercial real estate valuation expert. Analyze the following subject property and comparable sales to provide a comprehensive market valuation.

${propertyDesc}

# COMPARABLE SALES

${compsDesc}

# TASK

Please provide a detailed valuation analysis in the following JSON format:

{
  "estimated_value": <number - your best estimate of fair market value>,
  "value_range": {
    "low": <number - conservative estimate>,
    "high": <number - optimistic estimate>
  },
  "confidence_level": "<High/Medium/Low based on comp quality>",
  "price_per_sqft_estimate": <number or null>,
  "analysis": "<detailed narrative analysis explaining your valuation methodology and reasoning>",
  "comparable_analysis": [
    {
      "comp_id": "<comparable number, e.g., 'Comparable 1'>",
      "comp_address": "<address>",
      "sale_price": <number>,
      "adjustments": "<explain any adjustments made for differences>",
      "adjusted_value": <number - what this comp suggests for subject value>
    }
  ],
  "key_findings": [
    "<important finding 1>",
    "<important finding 2>",
    "<important finding 3>"
  ],
  "recommendations": [
    "<recommendation 1 for buyer/seller>",
    "<recommendation 2>",
    "<recommendation 3>"
  ],
  "market_insights": "<brief market commentary and trends>"
}

Consider:
- Adjustments for size, age, condition, location differences
- Current market conditions and trends
- Time adjustments if sales are dated
- Property type and use appropriateness
- Market positioning relative to comparables
- Any unique characteristics or value drivers

Return ONLY the JSON object, no additional text.`;
}

/**
 * Parse Claude's valuation response
 */
function parseValuationResponse(responseText: string): ValuationResult {
  try {
    // Extract JSON from response (Claude might add explanation text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.estimated_value !== 'number') {
      throw new Error('Missing or invalid estimated_value');
    }

    return {
      estimated_value: parsed.estimated_value,
      value_range: parsed.value_range || { low: parsed.estimated_value * 0.9, high: parsed.estimated_value * 1.1 },
      confidence_level: parsed.confidence_level || 'Medium',
      price_per_sqft_estimate: parsed.price_per_sqft_estimate || null,
      analysis: parsed.analysis || 'Analysis not provided',
      comparable_analysis: parsed.comparable_analysis || [],
      key_findings: parsed.key_findings || [],
      recommendations: parsed.recommendations || [],
      market_insights: parsed.market_insights || 'Market insights not provided',
    };
  } catch (error: any) {
    console.error('Error parsing valuation response:', error);
    console.error('Response text:', responseText);
    throw new Error(`Failed to parse valuation response: ${error.message}`);
  }
}
