import jsPDF from 'jspdf';
import type { Property, ValuationResult } from '../types';
import { loadLogoImage } from './pdfBranding';

// ============================================================================
// Types
// ============================================================================

export interface OwnerInfo {
  owner_name: string;
  honorific: string; // Mr. / Ms. / Mr. & Mrs.
  owner_address_line1: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  entity_name: string;
}

export interface ExecSummaryOptions {
  property: Property;
  valuation: ValuationResult;
  ownerInfo: OwnerInfo;
  apexColorLogoBase64?: string | null;
  kwLogoBase64?: string | null;
}

// ============================================================================
// Template Data — Per Property Type
// ============================================================================

interface PricingTier {
  label: string;
  scenarioKey: 'quick_sale' | 'market_sale' | 'premium_sale';
}

interface PropertyTypeTemplate {
  displayName: string;
  keyConsiderations: { bold: string; description: string }[];
  timingNote: string;
  timingPrefix: string; // "Notes on timing:" vs "NOTE:"
  marketingTargeting: string;
  directCalls: string;
  noteText: string;
  pricingTiers: PricingTier[];
}

const INDUSTRIAL_CONDO_TEMPLATE: PropertyTypeTemplate = {
  displayName: 'Industrial Condo',
  keyConsiderations: [
    { bold: 'Buyer Type:', description: 'Owner-user (SBA) vs. investor (stabilized NOI/cap rate).' },
    { bold: 'Occupancy/Income:', description: 'If delivered vacant vs. leased; rent roll terms if occupied.' },
    { bold: 'Condition/CapEx:', description: 'Roof/HVAC/electrical capacity, ADA/life-safety, recent reports.' },
    { bold: 'Parking & Access:', description: 'Stall count/ratio, ingress/egress, signage rights.' },
    { bold: 'Zoning/Use Fit:', description: 'Light industrial/warehouse, flex, trade/service uses; HOA rules.' },
    { bold: 'Unit Attributes:', description: 'Clear height, power (amps/phase), loading, office build-out.' },
    { bold: 'Market Liquidity:', description: 'Competing small-bay inventory and lender appetite (SBA/conventional).' },
  ],
  timingPrefix: 'Notes on timing:',
  timingNote: 'Owner-user purchases (often SBA 504/7(a)) generally run ~60\u201375 days from acceptance to close; conventional/1031 timelines vary with lender, appraisal, and HOA estoppels.',
  marketingTargeting: 'owner-user and small-bay industrial investors',
  directCalls: 'top small-bay industrial/owner-user brokers and agents in Inland Empire',
  noteText: 'In the current Inland Empire small-bay industrial condo market, well-positioned assets typically see 90\u2013180 days on market depending on pricing, occupancy, and condition. Investor buyers will underwrite to stabilized NOI and may seek credits for vacancy or repairs. Owner-users (often SBA 504/7(a)) generally require 60\u201375 days from acceptance to close. Our best leverage comes from providing: recent roof/HVAC reports, parking count, traffic counts (ADT), signage rights, any association documents, and clear utility/service information.',
  pricingTiers: [
    { label: 'Sell Fast Price (90 \u2013 120 days)', scenarioKey: 'quick_sale' },
    { label: 'Sell long range (6 \u2013 12 months)', scenarioKey: 'premium_sale' },
  ],
};

const RETAIL_TEMPLATE: PropertyTypeTemplate = {
  displayName: 'Retail',
  keyConsiderations: [
    { bold: 'Buyer type:', description: 'Owner-user (SBA) vs. Investor (cap rate/NOI).' },
    { bold: 'Occupancy/income:', description: 'Rent roll, lease terms, NNN/CAM, vacancy upside.' },
    { bold: 'Condition/CapEx:', description: 'Roof/HVAC/electrical, ADA/life-safety; recent reports.' },
    { bold: 'Parking/visibility:', description: 'Stall count & ratio, ingress/egress, signage rights, traffic counts.' },
    { bold: 'Zoning/uses:', description: 'Permitted retail uses, any association limits.' },
    { bold: 'Location drivers:', description: 'Nearby anchors, demographics, arterial/freeway access.' },
    { bold: 'Ops & costs:', description: 'Separate meters, typical NNN/CAM (if multi-tenant), taxes/insurance history.' },
    { bold: 'Diligence/timeline:', description: 'DD 30\u201345 days; close 45\u201360 (longer with SBA); provide reports, plans, utilities, any HOA docs upfront.' },
  ],
  timingPrefix: 'NOTE:',
  timingNote: 'Typical retail timelines are 30\u201345 days due diligence and 45\u201360 days to close; SBA buyers often need 60\u201375 days total.',
  marketingTargeting: 'owner-users and small retail investors',
  directCalls: 'top 20 retail/owner-user brokers and agents in Inland Empire',
  noteText: 'In the current Inland Empire retail market, well-positioned assets typically see 90\u2013180 days on market depending on pricing, occupancy, and condition. Investor buyers will underwrite to stabilized NOI and may seek credits for vacancy or repairs. Owner-users (often SBA 504/7(a)) generally require 60\u201375 days from acceptance to close. Our best leverage comes from providing: recent roof/HVAC reports, parking count, traffic counts (ADT), signage rights, any association documents, and clear utility/service information.',
  pricingTiers: [
    { label: 'Sell Fast Price (90 \u2013 120 days)', scenarioKey: 'quick_sale' },
    { label: 'Market Ask (3 \u2013 6 months)', scenarioKey: 'market_sale' },
    { label: 'Sell Long Range (6 \u2013 12 months)', scenarioKey: 'premium_sale' },
  ],
};

// TODO: Add specific templates for these property types as real-world examples become available.
// For now they fall back to the Industrial Condo template with a console warning.
// - Warehouse, Distribution Center, Manufacturing, Flex Space, Office, Land, Multifamily, Mixed Use

function getTemplate(propertyType?: string): PropertyTypeTemplate {
  const normalized = (propertyType || '').toLowerCase().replace(/[_\s]+/g, '_');
  switch (normalized) {
    case 'retail':
      return RETAIL_TEMPLATE;
    case 'industrial_condo':
    case 'industrial':
      return INDUSTRIAL_CONDO_TEMPLATE;
    default:
      if (propertyType) {
        console.warn(`[execSummaryPdf] No specific template for "${propertyType}"; using Industrial Condo as default.`);
      }
      return INDUSTRIAL_CONDO_TEMPLATE;
  }
}

// ============================================================================
// Colors & Layout Constants
// ============================================================================

const RED: [number, number, number] = [178, 31, 36];
const BLACK: [number, number, number] = [0, 0, 0];

const MARGIN = 20;
const LINE_HEIGHT = 5; // ~11pt text line height

// ============================================================================
// Helpers
// ============================================================================

const formatCurrency = (value?: number | null): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatPricePerSf = (value?: number | null): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';
  return `$${value.toFixed(0)}/SF`;
};

/** Load the Apex color logo from public folder. */
export async function loadApexColorLogo(): Promise<string | null> {
  return loadLogoImage('/apex-logo.png');
}

/** Load the KW Commercial logo from public folder. */
export async function loadKWCommercialLogo(): Promise<string | null> {
  return loadLogoImage('/kw-commercial-logo.jpeg');
}

// ============================================================================
// KW Commercial Header (matches real templates)
// ============================================================================

function renderKWHeader(doc: jsPDF, kwLogoBase64?: string | null): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (kwLogoBase64) {
    // Use the actual KW Commercial logo image — wide banner, centered
    const logoW = 160;
    const logoH = 22; // aspect ratio ~7.3:1 from the original image
    const logoX = (pageWidth - logoW) / 2;
    try {
      doc.addImage(kwLogoBase64, 'JPEG', logoX, 10, logoW, logoH);
    } catch {
      // Fallback to text if image fails
      renderKWHeaderText(doc);
    }
  } else {
    renderKWHeaderText(doc);
  }

  // Thin line under header
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 38, pageWidth - MARGIN, 38);

  return 48; // Y position after header
}

/** Fallback text-based KW header when logo image is unavailable */
function renderKWHeaderText(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const kwBoxW = 42;
  const kwBoxH = 28;
  const kwX = (pageWidth - 180) / 2;

  doc.setFillColor(...RED);
  doc.roundedRect(kwX, 10, kwBoxW, kwBoxH, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('KW', kwX + kwBoxW / 2, 28, { align: 'center' });

  doc.setTextColor(...BLACK);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'normal');
  doc.text('C O M M E R C I A L', kwX + kwBoxW + 6, 30);
}

// ============================================================================
// Section Header — bold red underlined (matching templates)
// ============================================================================

function sectionHeader(doc: jsPDF, title: string, y: number): number {
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setTextColor(...RED);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  const titleWidth = doc.getTextWidth(title);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1.5, MARGIN + titleWidth, y + 1.5);
  doc.setTextColor(...BLACK);
  return y + 7;
}

// ============================================================================
// Text Rendering Helpers
// ============================================================================

function renderText(doc: jsPDF, text: string, y: number, options?: {
  fontSize?: number;
  fontStyle?: string;
  bold?: boolean;
  italic?: boolean;
  color?: [number, number, number];
  indent?: number;
  maxWidth?: number;
}): number {
  const fontSize = options?.fontSize ?? 10;
  const indent = options?.indent ?? 0;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = options?.maxWidth ?? (pageWidth - MARGIN * 2 - indent);
  const color = options?.color ?? BLACK;

  let fontStyle = 'normal';
  if (options?.bold && options?.italic) fontStyle = 'bolditalic';
  else if (options?.bold) fontStyle = 'bold';
  else if (options?.italic) fontStyle = 'italic';

  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);
  doc.setTextColor(...color);
  const lines: string[] = doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    if (y > 278) { doc.addPage(); y = 20; }
    doc.text(line, MARGIN + indent, y);
    y += fontSize * 0.42 + 1;
  }
  return y;
}

/** Render a bullet point with bold label + normal description (matching template format). */
function renderBulletItem(doc: jsPDF, boldPart: string, normalPart: string, y: number, indent?: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bulletX = MARGIN + (indent ?? 8);
  const textX = bulletX + 5;
  const maxWidth = pageWidth - MARGIN - textX;

  if (y > 272) { doc.addPage(); y = 20; }

  // Bullet
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('\u2022', bulletX, y);

  // Bold label
  doc.setFont('helvetica', 'bold');
  const boldText = boldPart + ' ';
  const boldWidth = doc.getTextWidth(boldText);

  // Check if everything fits on one line
  doc.setFont('helvetica', 'normal');
  const normalWidth = doc.getTextWidth(normalPart);

  if (boldWidth + normalWidth <= maxWidth) {
    // Single line
    doc.setFont('helvetica', 'bold');
    doc.text(boldText, textX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(normalPart, textX + boldWidth, y);
    y += LINE_HEIGHT;
  } else {
    // Multi-line: render the full combined text using splitTextToSize
    // First render the bold part on the first line
    doc.setFont('helvetica', 'bold');
    doc.text(boldText, textX, y);

    // Then wrap the normal part starting after the bold
    doc.setFont('helvetica', 'normal');
    const remainingWidth = maxWidth - boldWidth;
    if (remainingWidth > 30) {
      // Some normal text fits on first line
      const normalLines: string[] = doc.splitTextToSize(normalPart, maxWidth);
      // First chunk goes after bold
      const firstLineText = normalLines[0] || '';
      // Check if first line fits in remaining space
      if (doc.getTextWidth(firstLineText) <= remainingWidth) {
        doc.text(firstLineText, textX + boldWidth, y);
        y += LINE_HEIGHT;
        // Remaining lines at full width
        for (let i = 1; i < normalLines.length; i++) {
          if (y > 278) { doc.addPage(); y = 20; }
          doc.text(normalLines[i], textX, y);
          y += LINE_HEIGHT;
        }
      } else {
        // Re-wrap with full width from the second line
        y += LINE_HEIGHT;
        const rewrapped: string[] = doc.splitTextToSize(normalPart, maxWidth);
        for (const line of rewrapped) {
          if (y > 278) { doc.addPage(); y = 20; }
          doc.text(line, textX, y);
          y += LINE_HEIGHT;
        }
      }
    } else {
      y += LINE_HEIGHT;
      const normalLines: string[] = doc.splitTextToSize(normalPart, maxWidth);
      for (const line of normalLines) {
        if (y > 278) { doc.addPage(); y = 20; }
        doc.text(line, textX, y);
        y += LINE_HEIGHT;
      }
    }
  }
  return y;
}

/** Render a simple bold bullet (no label:description split). */
function renderSimpleBoldBullet(doc: jsPDF, text: string, y: number): number {
  if (y > 272) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text('\u2022', MARGIN + 8, y);
  doc.text(text, MARGIN + 14, y);
  y += LINE_HEIGHT + 1;
  return y;
}

// ============================================================================
// Marketing Page (verbatim from templates)
// ============================================================================

function renderMarketingPage(doc: jsPDF, template: PropertyTypeTemplate, city: string, apexLogoBase64?: string | null): number {
  let y = 20;

  y = sectionHeader(doc, 'MARKETING THE PROPERTY', y);

  const introText = 'KW Commercial has a unique marketing platform that allows us to easily market properties through a variety of mediums and to selected target audiences. The goal of the marketing plan is to quickly expose your property to the maximum number of qualified purchasers and cooperating brokers to obtain the highest sales price in the shortest amount of time. The Apex Real Estate Services complete Commercial Marketing Blueprint deliverables include:';
  y = renderText(doc, introText, y, { fontSize: 10 });
  y += 3;

  // I. Preparation & Asset Creation
  y = renderMarketingSection(doc, 'I. Preparation & Asset Creation (Weeks 1\u20132)', [
    'Professional Aerial & Drone Photography: Capture corner exposure, freeway proximity, surrounding retail/industrial.',
    'Property Maps & Site Plans: Parcel maps, zoning/uses, floor plan and site plan (parking count/ratio, ingress/egress, signage locations).',
    'Offering Memorandum (OM) Brochure: Branded Apex/KW, including executive summary, maps, comps, zoning, demographics, city projects, contact info.',
    'Property Website/Landing Page: Custom URL, central hub with aerials, brochure, video tour, and downloadable PDFs.',
  ], y);

  // II. Online Listing & Digital Marketing
  y = renderMarketingSection(doc, 'II. Online Listing & Digital Marketing (Weeks 2\u20133, Ongoing)', [
    'CRE Platforms: CoStar, LoopNet, CREXi Premium \u2013 full buildout with aerials, zoning, pricing, refreshed biweekly.',
    `Social Media Campaigns: LinkedIn posts targeting ${template.marketingTargeting}, Facebook/Instagram ads, YouTube spotlight video with SEO tags.`,
    `Email Marketing: Broker blast, targeted ${template.marketingTargeting.replace('owner-user and ', 'owner-user and ')} outreach, nurture follow-up campaigns.`,
  ], y);

  // III. Offline & Traditional Marketing
  y = renderMarketingSection(doc, 'III. Offline & Traditional Marketing (Weeks 3\u20134, Ongoing)', [
    'Signage: 4\'x8\' branded sign at site with QR code to brochure/video.',
    `Canvassing/Direct Outreach: Target ${template.marketingTargeting}; distribute mini-brochures.`,
    `City/ED Collaboration: Partner with City of ${city} Economic Development Department.`,
  ], y);

  // IV. Broker-to-Broker Cooperation
  y = renderMarketingSection(doc, 'IV. Broker-to-Broker Cooperation', [
    'Exposure: AIRCRE, NAR, MLS for broadest reach.',
    `Direct Calls: Outreach to ${template.directCalls}.`,
    'Broker Open Tour: Host on-site with presentation and refreshments.',
  ], y);

  // V. Showings & Follow-Up
  y = renderMarketingSection(doc, 'V. Showings & Follow-Up', [
    'Streamlined Tours: Provide zoning overlays, comps, and aerials.',
    'Feedback Tracking: Record and analyze prospect/broker input.',
    'Seller Reports: Weekly updates with activity and interest.',
  ], y);

  // VI. Negotiation & Closing
  y = renderMarketingSection(doc, 'VI. Negotiation & Closing', [
    'Negotiation focus: Clear LOI terms (price, deposits, due diligence, closing timeline), minimal contingencies, and defined repair/credit structure.',
    'Due Diligence Support: Provide zoning codes, infrastructure updates, city contacts.',
    'Transaction Support: Efficient LOIs, PSA drafting, and coordination with escrow/legal.',
  ], y);

  // Apex logo bottom-right
  renderApexLogo(doc, apexLogoBase64);

  return y;
}

function renderMarketingSection(doc: jsPDF, title: string, items: string[], y: number): number {
  if (y > 258) { doc.addPage(); y = 20; }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  // Title with underline
  doc.text(title, MARGIN, y);
  const titleWidth = doc.getTextWidth(title);
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 1.2, MARGIN + titleWidth, y + 1.2);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);

  for (const item of items) {
    if (y > 272) { doc.addPage(); y = 20; }
    doc.text('\u2022', MARGIN + 8, y);
    const lines: string[] = doc.splitTextToSize(item, doc.internal.pageSize.getWidth() - MARGIN * 2 - 16);
    for (let j = 0; j < lines.length; j++) {
      if (y > 278) { doc.addPage(); y = 20; }
      doc.text(lines[j], MARGIN + 14, y);
      y += LINE_HEIGHT;
    }
  }
  y += 3;
  return y;
}

// ============================================================================
// Apex Logo (bottom-right corner, pages 2 & 3)
// ============================================================================

function renderApexLogo(doc: jsPDF, apexLogoBase64?: string | null): void {
  if (!apexLogoBase64) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  try {
    doc.addImage(apexLogoBase64, 'AUTO', pageWidth - MARGIN - 35, pageHeight - 45, 35, 35);
  } catch {
    // Logo failed, continue without it
  }
}

// ============================================================================
// Challenges (verbatim from templates)
// ============================================================================

const CHALLENGES = [
  'Building condition',
  'CapEx: age of roof/HVAC',
  'Electrical capacity',
  'ADA compliance',
  'Any deferred maintenance.',
];

// ============================================================================
// Signature Block (verbatim from templates)
// ============================================================================

function renderSignatureBlock(doc: jsPDF, y: number): number {
  if (y > 220) { doc.addPage(); y = 20; }

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('Regards,', MARGIN, y);
  y += 16; // Space for signature

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Robert Mendieta', MARGIN, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Associate Broker', MARGIN, y);
  y += 4;
  doc.text('Apex Real Estate Services', MARGIN, y);
  y += 4;
  doc.text('Keller Williams Commercial', MARGIN, y);
  y += 4;
  doc.text('CA DRE Broker License #01422904', MARGIN, y);
  y += 8;

  doc.setFontSize(9);
  doc.text('Tel: (951) 977-3251', MARGIN + 8, y);
  y += 4;
  doc.text('Fax: (909) 793-8200', MARGIN + 8, y);
  y += 6;
  doc.text('RobMendi@gmail.com', MARGIN + 8, y);
  y += 4;
  doc.text('www.WarehousesInlandEmpire.com', MARGIN + 8, y);
  y += 6;
  doc.text('3750 E. Florida Ave. Suite A', MARGIN + 8, y);
  y += 4;
  doc.text('Hemet, CA. 92544', MARGIN + 8, y);

  return y + 6;
}

// ============================================================================
// Main PDF Generator
// ============================================================================

export function generateExecutiveSummaryPDF(options: ExecSummaryOptions): string {
  const { property, valuation, ownerInfo, apexColorLogoBase64, kwLogoBase64 } = options;

  const template = getTemplate(property.property_type);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const scenarios = valuation.pricing_scenarios;
  const propertyAddress = property.address || 'Address Not Available';
  const cityStateZip = [property.city, property.state, property.zip_code].filter(Boolean).join(', ');
  const fullAddress = `${propertyAddress}, ${cityStateZip}`;

  // ============================
  // PAGE 1
  // ============================

  let y = renderKWHeader(doc, kwLogoBase64);

  // Date — left-aligned
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(dateStr, MARGIN, y);
  y += 12;

  // Owner address block
  doc.setFontSize(10);
  doc.text(ownerInfo.owner_name, MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(ownerInfo.owner_address_line1, MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(`${ownerInfo.owner_city}, ${ownerInfo.owner_state} ${ownerInfo.owner_zip}`, MARGIN, y);
  y += 12;

  // Greeting with honorific
  const lastName = ownerInfo.owner_name.split(' ').pop() || ownerInfo.owner_name;
  doc.setFontSize(10);
  doc.text(`Dear ${ownerInfo.honorific} ${lastName},`, MARGIN, y);
  y += 8;

  // Intro paragraph (verbatim from templates)
  const introText = `Apex Real Estate Services & KW Commercial is pleased to present the following proposal to market your property at ${fullAddress}. This proposal is for the referenced property on the terms and conditions set forth below:`;
  y = renderText(doc, introText, y, { fontSize: 10 });
  y += 6;

  // ─── THE PROPERTY ───
  y = sectionHeader(doc, 'THE PROPERTY', y);

  // Address line — bold
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(fullAddress, MARGIN, y);
  y += LINE_HEIGHT;

  // APN if available
  if (property.apn) {
    doc.setFont('helvetica', 'bold');
    doc.text(`APN: ${property.apn}`, MARGIN, y);
    y += LINE_HEIGHT;
  }

  // Property Type line with SF
  const buildingSf = property.building_size ? `\u00b1${property.building_size.toLocaleString()} SF Building` : '';
  const lotSf = property.lot_size
    ? (property.additional_data?.lot_size_unit === 'acres'
      ? `on \u00b1${property.lot_size} Acre Lot`
      : `on \u00b1${property.lot_size.toLocaleString()} SF Lot`)
    : '';
  const sfParts = [buildingSf, lotSf].filter(Boolean).join(' ');
  const typeDisplayName = template.displayName === 'Industrial Condo' ? 'Industrial Condo Building' : `${template.displayName} Building`;
  const typeLine = sfParts
    ? `Property Type: ${typeDisplayName} (${sfParts})`
    : `Property Type: ${typeDisplayName}`;

  doc.setFont('helvetica', 'bold');
  const typeLines: string[] = doc.splitTextToSize(typeLine, pageWidth - MARGIN * 2);
  for (const line of typeLines) {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }

  // Zoning
  if (property.zoning) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Zoning: ${property.zoning}`, MARGIN, y);
    y += LINE_HEIGHT;
  }
  y += 4;

  // ─── RECOMMENDED ASKING ───
  y = sectionHeader(doc, 'RECOMMENDED ASKING', y);

  if (scenarios) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);

    for (const tier of template.pricingTiers) {
      const scenario = scenarios[tier.scenarioKey];
      if (!scenario) continue;
      const priceLine = `${tier.label}: ${formatCurrency(scenario.price)} (${formatPricePerSf(scenario.price_per_sqft)})`;
      doc.setFont('helvetica', 'bold');
      doc.text(priceLine, MARGIN, y);
      y += LINE_HEIGHT;
    }

    // Timing note — italic
    y += 1;
    const timingFull = `${template.timingPrefix} ${template.timingNote}`;
    y = renderText(doc, timingFull, y, { fontSize: 10, italic: true });
    y += 5;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Pricing scenarios not available. Run AI Valuation first.', MARGIN, y);
    y += 7;
  }

  // ─── SCOPE OF SERVICE ───
  y = sectionHeader(doc, 'SCOPE OF SERVICE', y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('Apex Real Estate Services & KW Commercial to represent:', MARGIN, y);
  y += LINE_HEIGHT;

  // Entity name bold + "in the sale of..." with address bold
  doc.setFont('helvetica', 'bold');
  const entityText = ownerInfo.entity_name;
  const entityWidth = doc.getTextWidth(entityText + ' ');
  doc.text(entityText, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text('in the sale of the property located at', MARGIN + entityWidth, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'bold');
  const addrLines: string[] = doc.splitTextToSize(`${fullAddress}.`, pageWidth - MARGIN * 2);
  for (const line of addrLines) {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  y += 4;

  // ─── KEY CONSIDERATIONS ───
  y = sectionHeader(doc, `KEY CONSIDERATIONS (${template.displayName.toUpperCase()})`, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const kcIntro = 'There are several things to consider when determining a go-to-market price per square foot for commercial properties such as yours. For example:';
  y = renderText(doc, kcIntro, y, { fontSize: 10 });
  y += 4;

  for (const item of template.keyConsiderations) {
    y = renderBulletItem(doc, item.bold, item.description, y);
  }
  y += 3;

  // ============================
  // PAGE 2 — Marketing
  // ============================
  doc.addPage();
  // If key considerations spilled onto page 2, MARKETING starts on next page
  y = renderMarketingPage(doc, template, property.city || 'Inland Empire', apexColorLogoBase64);

  // ============================
  // PAGE 3 — Challenges, Note, Signature
  // ============================
  doc.addPage();
  y = 20;

  // Continue VI items if page 2 ended mid-section (handled by page breaks in renderMarketingPage)

  // ─── CHALLENGES ───
  y = sectionHeader(doc, 'CHALLENGES', y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('Based on the information we have acquired about the area, here are some', MARGIN, y);
  y += LINE_HEIGHT;
  doc.text('challenges that may arise:', MARGIN, y);
  y += 8;

  for (const challenge of CHALLENGES) {
    y = renderSimpleBoldBullet(doc, challenge, y);
  }
  y += 10;

  // ─── NOTE ───
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  const notePrefix = 'NOTE: ';
  const notePrefixWidth = doc.getTextWidth(notePrefix);
  doc.text(notePrefix, MARGIN, y);

  // Rest of NOTE text in bold black
  doc.setTextColor(...BLACK);
  // First line starts after "NOTE: "
  const firstLineRemaining = pageWidth - MARGIN * 2 - notePrefixWidth;
  const firstNoteLines: string[] = doc.splitTextToSize(template.noteText, firstLineRemaining);

  if (firstNoteLines.length > 0) {
    doc.text(firstNoteLines[0], MARGIN + notePrefixWidth, y);
    y += LINE_HEIGHT;
    // Re-wrap remaining text at full width
    const remainingText = template.noteText.substring(firstNoteLines[0].length).trim();
    if (remainingText) {
      const restLines: string[] = doc.splitTextToSize(remainingText, pageWidth - MARGIN * 2);
      for (const line of restLines) {
        if (y > 278) { doc.addPage(); y = 20; }
        doc.text(line, MARGIN, y);
        y += LINE_HEIGHT;
      }
    }
  }
  y += 5;

  // ─── Signature block ───
  y = renderSignatureBlock(doc, y);

  // Apex logo bottom-right on page 3
  renderApexLogo(doc, apexColorLogoBase64);

  // ============================
  // No branded footer — templates don't have one
  // ============================

  // ============================
  // Save
  // ============================
  const fileName = `Executive_Summary_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);

  // Return blob URL for inline preview
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
