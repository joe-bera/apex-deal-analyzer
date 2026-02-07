import { callClaude, parseClaudeJSON } from './claudeService';

interface PropertyContext {
  address?: string;
  city?: string;
  state?: string;
  property_type?: string;
  building_size?: number;
  lot_size_acres?: number;
  year_built?: number;
  sale_price?: number;
  asking_price?: number;
  price_per_sf?: number;
  cap_rate?: number;
  clear_height_ft?: number;
  dock_doors?: number;
}

interface GeneratedContent {
  subject: string;
  body_html: string;
}

const CAMPAIGN_TYPE_INSTRUCTIONS: Record<string, string> = {
  new_listing: `This is a NEW LISTING announcement. Write compelling copy that:
- Creates excitement and urgency ("just hit the market", "exclusive opportunity")
- Highlights key property features (size, location, specs)
- Encourages the recipient to schedule a tour or request more info
- Tone: professional, enthusiastic, action-oriented`,

  price_reduction: `This is a PRICE REDUCTION announcement. Write copy that:
- Emphasizes the new value proposition ("now offered at...", "reduced by X%")
- Frames the reduction positively (motivated seller, priced to move)
- Highlights why this is now a great deal
- Creates urgency (won't last, act now)
- Tone: professional, opportunity-focused`,

  just_closed: `This is a JUST CLOSED / RECENTLY SOLD announcement. Write copy that:
- Celebrates the successful transaction
- Builds credibility (showcases expertise, track record)
- Mentions key deal details (price, timeline)
- Invites readers to reach out if they have similar needs
- Tone: professional, confident, accomplishment-oriented`,

  market_update: `This is a MARKET UPDATE email. Write copy that:
- Provides insight on current industrial/CRE market conditions
- References relevant trends (vacancy rates, rental growth, cap rate movement)
- Positions the sender as a market expert
- Includes a call to action (discuss how this affects their portfolio)
- Tone: professional, analytical, authoritative`,

  custom: `This is a general commercial real estate email. Write professional, engaging copy that:
- Is relevant to commercial real estate professionals and investors
- Provides value to the reader
- Includes a clear call to action
- Tone: professional, personable`,
};

/**
 * Generate email subject line and body HTML using Claude AI.
 * Returns inner body HTML only (p, strong, ul, li tags) — no greeting or signature.
 */
export const generateEmailContent = async (
  campaignType: string,
  property?: PropertyContext | null,
  customInstructions?: string
): Promise<GeneratedContent> => {
  const typeInstruction =
    CAMPAIGN_TYPE_INSTRUCTIONS[campaignType] || CAMPAIGN_TYPE_INSTRUCTIONS.custom;

  let propertyContext = '';
  if (property) {
    const details: string[] = [];
    if (property.address) details.push(`Address: ${property.address}`);
    if (property.city && property.state)
      details.push(`Location: ${property.city}, ${property.state}`);
    if (property.property_type) details.push(`Type: ${property.property_type}`);
    if (property.building_size)
      details.push(`Building Size: ${property.building_size.toLocaleString()} SF`);
    if (property.lot_size_acres)
      details.push(`Lot Size: ${property.lot_size_acres} acres`);
    if (property.year_built) details.push(`Year Built: ${property.year_built}`);
    if (property.sale_price)
      details.push(`Sale Price: $${property.sale_price.toLocaleString()}`);
    if (property.asking_price)
      details.push(`Asking Price: $${property.asking_price.toLocaleString()}`);
    if (property.price_per_sf)
      details.push(`Price/SF: $${property.price_per_sf.toFixed(2)}`);
    if (property.cap_rate) details.push(`Cap Rate: ${property.cap_rate}%`);
    if (property.clear_height_ft)
      details.push(`Clear Height: ${property.clear_height_ft} ft`);
    if (property.dock_doors) details.push(`Dock Doors: ${property.dock_doors}`);

    if (details.length > 0) {
      propertyContext = `\n\nProperty Details:\n${details.join('\n')}`;
    }
  }

  const customNote = customInstructions
    ? `\n\nAdditional instructions from the user:\n${customInstructions}`
    : '';

  const prompt = `Generate a professional commercial real estate email.

Campaign Type: ${campaignType}

${typeInstruction}${propertyContext}${customNote}

IMPORTANT:
- Generate ONLY the inner body HTML (use <p>, <strong>, <ul>, <li> tags)
- Do NOT include a greeting (like "Hi [Name]") — the template adds that
- Do NOT include a signature or broker info — the template adds that
- Do NOT include <html>, <head>, or <body> tags
- Keep the email concise (150-250 words)
- Include a clear call-to-action paragraph at the end

Return your response as JSON with this exact structure:
{
  "subject": "The email subject line",
  "body_html": "<p>The email body HTML...</p>"
}`;

  const response = await callClaude({
    prompt,
    systemPrompt:
      'You are an expert commercial real estate marketing copywriter. Generate compelling email content for brokers and investors. Always respond with valid JSON.',
    maxTokens: 2048,
    temperature: 0.7,
  });

  return parseClaudeJSON<GeneratedContent>(response.content);
};
