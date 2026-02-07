import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/supabase';
import { callClaude, parseClaudeJSON } from '../services/claudeService';

interface OwnerResearchAIResult {
  entity_type: string;
  portfolio_estimate: number | null;
  registered_agent: string | null;
  summary: string;
  analysis: string;
  outreach_recommendations: string[];
  red_flags: string[];
  opportunities: string[];
}

/**
 * Build a CRE-specific prompt for Claude to analyze an owner
 */
function buildOwnerResearchPrompt(property: Record<string, any>): string {
  const ownerName = property.owner_name || 'Unknown';
  const propertyAddress = property.address || 'Unknown';
  const ownerAddress = property.owner_address || '';
  const mailingCity = property.mailing_city || '';
  const mailingState = property.mailing_state || '';
  const mailingZip = property.mailing_zip || '';
  const mailingCareOf = property.mailing_care_of || '';
  const parentCompany = property.parent_company || '';
  const fundName = property.fund_name || '';
  const propertyType = property.property_type || '';
  const city = property.city || '';
  const state = property.state || '';
  const buildingSize = property.building_size || '';

  return `Analyze the following commercial real estate property owner and provide structured intelligence for a broker's outreach strategy.

OWNER INFORMATION:
- Owner Name: ${ownerName}
- Property Address: ${propertyAddress}, ${city}, ${state}
- Owner/Mailing Address: ${ownerAddress} ${mailingCity} ${mailingState} ${mailingZip}
- Care Of: ${mailingCareOf}
- Parent Company: ${parentCompany}
- Fund Name: ${fundName}
- Property Type: ${propertyType}
- Building Size: ${buildingSize} SF

ANALYSIS INSTRUCTIONS:
1. Determine the entity type based on the owner name pattern (look for LLC, Trust, Corp, Inc, LP, REIT indicators, government names, etc.)
2. Estimate the portfolio size based on entity type (individuals typically own 1-5, LLCs 2-20, REITs 50+, etc.)
3. Determine if this is likely an absentee owner (compare mailing address to property address)
4. Identify the likely registered agent if an LLC/Corp
5. Provide outreach recommendations specific to this entity type
6. Flag any red flags (shell companies, litigation-prone entities, government ownership, etc.)
7. Identify opportunities (motivated seller indicators, portfolio consolidation, 1031 exchange timing, etc.)

Respond with ONLY valid JSON in this exact format:
{
  "entity_type": "individual|llc|trust|corporation|reit|partnership|government|nonprofit|unknown",
  "portfolio_estimate": <number or null>,
  "registered_agent": "<string or null>",
  "summary": "<1-2 sentence summary of the owner>",
  "analysis": "<detailed 2-4 paragraph analysis of the owner, entity structure, and investment profile>",
  "outreach_recommendations": ["<recommendation 1>", "<recommendation 2>", "..."],
  "red_flags": ["<flag 1>", "..."],
  "opportunities": ["<opportunity 1>", "..."]
}`;
}

// POST /api/owner-research/:propertyId/ai — Run AI owner research via Claude
export const runAIResearch = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { propertyId } = req.params;

    // Fetch property data
    const { data: property, error: propError } = await supabase
      .from('master_properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    if (!property.owner_name) {
      return res.status(400).json({
        success: false,
        error: 'No owner name on record for this property. Add owner info first.',
      });
    }

    // Build prompt and call Claude
    const prompt = buildOwnerResearchPrompt(property);
    const claudeResponse = await callClaude({
      prompt,
      systemPrompt: 'You are a commercial real estate intelligence analyst specializing in owner research and entity analysis. Always respond with valid JSON only.',
      maxTokens: 2048,
      temperature: 0.2,
    });

    // Parse structured response
    const aiResult = parseClaudeJSON<OwnerResearchAIResult>(claudeResponse.content);

    // Validate entity_type
    const validEntityTypes = ['individual', 'llc', 'trust', 'corporation', 'reit', 'partnership', 'government', 'nonprofit', 'unknown'];
    const entityType = validEntityTypes.includes(aiResult.entity_type) ? aiResult.entity_type : 'unknown';

    // Save to database
    const { data: research, error: insertError } = await supabase
      .from('owner_research')
      .insert({
        master_property_id: propertyId,
        owner_name: property.owner_name,
        owner_entity_type: entityType,
        registered_agent: aiResult.registered_agent || null,
        portfolio_estimate: aiResult.portfolio_estimate || null,
        research_source: 'ai',
        ai_summary: aiResult.summary,
        research_notes: aiResult.analysis,
        raw_data: {
          outreach_recommendations: aiResult.outreach_recommendations || [],
          red_flags: aiResult.red_flags || [],
          opportunities: aiResult.opportunities || [],
          token_usage: claudeResponse.usage,
        },
        researched_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      success: true,
      research,
      token_usage: claudeResponse.usage,
    });
  } catch (error) {
    console.error('Error running AI owner research:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to run AI owner research',
    });
  }
};

// GET /api/owner-research/:propertyId — Get all research for a property
export const getResearch = async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    const { data, error } = await supabase
      .from('owner_research')
      .select('*')
      .eq('master_property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      research: data || [],
    });
  } catch (error) {
    console.error('Error fetching owner research:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch owner research',
    });
  }
};

// POST /api/owner-research/:propertyId — Create manual research entry
export const createManualResearch = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { propertyId } = req.params;
    const {
      owner_name,
      owner_entity_type,
      registered_agent,
      mailing_address,
      phone,
      email,
      other_properties,
      portfolio_estimate,
      research_source,
      research_notes,
    } = req.body;

    const { data, error } = await supabase
      .from('owner_research')
      .insert({
        master_property_id: propertyId,
        owner_name: owner_name || null,
        owner_entity_type: owner_entity_type || 'unknown',
        registered_agent: registered_agent || null,
        mailing_address: mailing_address || null,
        phone: phone || null,
        email: email || null,
        other_properties: other_properties || [],
        portfolio_estimate: portfolio_estimate || null,
        research_source: research_source || 'manual',
        research_notes: research_notes || null,
        researched_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      research: data,
    });
  } catch (error) {
    console.error('Error creating manual research:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create research entry',
    });
  }
};

// PATCH /api/owner-research/:id — Update a research entry
export const updateResearch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    const allowedFields = [
      'owner_name', 'owner_entity_type', 'registered_agent', 'mailing_address',
      'phone', 'email', 'other_properties', 'portfolio_estimate',
      'research_source', 'research_notes', 'ai_summary',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const { data, error } = await supabase
      .from('owner_research')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      research: data,
    });
  } catch (error) {
    console.error('Error updating owner research:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update research entry',
    });
  }
};

// DELETE /api/owner-research/:id — Delete a research entry
export const deleteResearch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('owner_research')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting owner research:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete research entry',
    });
  }
};
