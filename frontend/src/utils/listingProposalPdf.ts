import jsPDF from 'jspdf';
import type { Property, ValuationResult } from '../types';
import {
  CompanyBranding,
  renderBrandedHeader,
  renderBrandedFooter,
} from './pdfBranding';

// ============================================================================
// Types
// ============================================================================

export interface OwnerInfo {
  owner_name: string;
  owner_address_line1: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  entity_name: string;
}

export interface ListingProposalOptions {
  property: Property;
  valuation: ValuationResult;
  ownerInfo: OwnerInfo;
  branding?: CompanyBranding;
  logoBase64?: string | null;
}

// ============================================================================
// Template Data — Per Property Type
// ============================================================================

interface PricingTier {
  label: string;
  timeline: string;
  scenarioKey: 'quick_sale' | 'market_sale' | 'premium_sale';
}

interface PropertyTypeTemplate {
  displayName: string;
  keyConsiderations: { bold: string; description: string }[];
  timingNote: string;
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
  timingNote: 'Owner-user purchases (often SBA 504/7(a)) generally run ~60\u201375 days from acceptance to close; conventional/1031 timelines vary with lender, appraisal, and HOA estoppels.',
  marketingTargeting: 'owner-user and small-bay industrial investors',
  directCalls: 'top small-bay industrial/owner-user brokers and agents in Inland Empire',
  noteText: 'In the current Inland Empire small-bay industrial condo market, well-positioned assets typically see 90\u2013180 days on market depending on pricing, occupancy, and condition. Investor buyers will underwrite to stabilized NOI and may seek credits for vacancy or repairs. Owner-users (often SBA 504/7(a)) generally require 60\u201375 days from acceptance to close. Our best leverage comes from providing: recent roof/HVAC reports, parking count, traffic counts (ADT), signage rights, any association documents, and clear utility/service information.',
  pricingTiers: [
    { label: 'Sell Fast Price', timeline: '90\u2013120 days', scenarioKey: 'quick_sale' },
    { label: 'Sell Long Range', timeline: '6\u201312 months', scenarioKey: 'premium_sale' },
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
  timingNote: 'Typical retail timelines are 30\u201345 days due diligence and 45\u201360 days to close; SBA buyers often need 60\u201375 days total.',
  marketingTargeting: 'owner-users and small retail investors',
  directCalls: 'top 20 retail/owner-user brokers and agents in Inland Empire',
  noteText: 'In the current Inland Empire retail market, well-positioned assets typically see 90\u2013180 days on market depending on pricing, occupancy, and condition. Investor buyers will underwrite to stabilized NOI and may seek credits for vacancy or repairs. Owner-users (often SBA 504/7(a)) generally require 60\u201375 days from acceptance to close. Our best leverage comes from providing: recent roof/HVAC reports, parking count, traffic counts (ADT), signage rights, any association documents, and clear utility/service information.',
  pricingTiers: [
    { label: 'Sell Fast Price', timeline: '90\u2013120 days', scenarioKey: 'quick_sale' },
    { label: 'Market Ask', timeline: '3\u20136 months', scenarioKey: 'market_sale' },
    { label: 'Sell Long Range', timeline: '6\u201312 months', scenarioKey: 'premium_sale' },
  ],
};

// TODO: Add specific templates for these property types as real-world examples become available.
// For now they fall back to the Industrial Condo template with a console warning.
// - Warehouse
// - Distribution Center
// - Manufacturing
// - Flex Space
// - Office
// - Land
// - Multifamily
// - Mixed Use

function getTemplate(propertyType?: string): PropertyTypeTemplate {
  const normalized = (propertyType || '').toLowerCase().replace(/[_\s]+/g, '_');

  switch (normalized) {
    case 'retail':
      return RETAIL_TEMPLATE;
    case 'industrial_condo':
    case 'industrial':
      return INDUSTRIAL_CONDO_TEMPLATE;
    default:
      // Fallback — use industrial condo as default
      if (propertyType) {
        console.warn(`[listingProposalPdf] No specific template for "${propertyType}"; using Industrial Condo as default.`);
      }
      return INDUSTRIAL_CONDO_TEMPLATE;
  }
}

// ============================================================================
// Colors & Constants
// ============================================================================

const RED: [number, number, number] = [178, 31, 36];
const DARK: [number, number, number] = [31, 41, 55];
const GRAY: [number, number, number] = [107, 114, 128];

const MARGIN = 14;

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

/** Render a bold red section header with underline, returns new yPos. */
function sectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(...RED);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  const titleWidth = doc.getTextWidth(title);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1, MARGIN + titleWidth, y + 1);
  doc.setTextColor(...DARK);
  return y + 7;
}

/** Wraps text and renders it, returning the new yPos. Handles page breaks. */
function renderWrappedText(
  doc: jsPDF,
  text: string,
  y: number,
  options?: { fontSize?: number; fontStyle?: string; italic?: boolean; indent?: number; maxWidth?: number }
): number {
  const fontSize = options?.fontSize ?? 9;
  const fontStyle = options?.italic ? 'italic' : (options?.fontStyle ?? 'normal');
  const indent = options?.indent ?? 0;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = options?.maxWidth ?? (pageWidth - MARGIN * 2 - indent);

  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);
  const lines: string[] = doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, MARGIN + indent, y);
    y += fontSize * 0.45 + 1;
  }
  return y;
}

/** Render a bullet point with bold label + normal description. */
function renderBullet(doc: jsPDF, boldPart: string, normalPart: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bulletIndent = 4;
  const textIndent = 8;
  const maxWidth = pageWidth - MARGIN * 2 - textIndent;

  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Bullet character
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text('\u2022', MARGIN + bulletIndent, y);

  // Bold part
  doc.setFont('helvetica', 'bold');
  const boldWidth = doc.getTextWidth(boldPart + ' ');
  doc.text(boldPart, MARGIN + textIndent, y);

  // Normal part — may wrap
  doc.setFont('helvetica', 'normal');
  const remainingWidth = maxWidth - boldWidth;
  if (remainingWidth > 20 && doc.getTextWidth(normalPart) <= remainingWidth) {
    // Fits on same line
    doc.text(normalPart, MARGIN + textIndent + boldWidth, y);
    y += 5;
  } else {
    // Wrap full text
    const fullText = boldPart + ' ' + normalPart;
    const lines: string[] = doc.splitTextToSize(fullText, maxWidth);
    // First line — already rendered bold part, so render full wrapped
    // Clear and re-render
    // Actually, simpler to just render the combined text with bold label
    y -= 0; // Reset
    for (let i = 0; i < lines.length; i++) {
      if (y > 275) { doc.addPage(); y = 20; }
      if (i === 0) {
        // Re-render first line: bold part + beginning of normal
        doc.setFont('helvetica', 'bold');
        doc.text(boldPart + ' ', MARGIN + textIndent, y);
        const normalStart = lines[0].substring(boldPart.length).trim();
        doc.setFont('helvetica', 'normal');
        doc.text(normalStart, MARGIN + textIndent + boldWidth, y);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.text(lines[i], MARGIN + textIndent, y);
      }
      y += 4.5;
    }
  }
  return y;
}

// ============================================================================
// Marketing Boilerplate (shared across all types)
// ============================================================================

function renderMarketingPage(doc: jsPDF, template: PropertyTypeTemplate, city: string): number {
  let y = 20;

  y = sectionHeader(doc, 'MARKETING THE PROPERTY', y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);

  const introText = `We will implement a comprehensive marketing strategy designed to maximize exposure to ${template.marketingTargeting} in the ${city} market and surrounding areas. Our approach includes:`;
  y = renderWrappedText(doc, introText, y);
  y += 3;

  // Section I — MLS / Commercial Databases
  y = renderBulletSection(doc, 'I. MLS & Commercial Databases', [
    'List property on LoopNet, CoStar, Crexi, and the local MLS.',
    'Syndicate to all major commercial real estate platforms for maximum online visibility.',
    'Include professional photography, floor plans, and virtual tours where applicable.',
  ], y);

  // Section II — Direct Outreach
  y = renderBulletSection(doc, 'II. Direct Outreach', [
    `Place targeted calls to ${template.directCalls}.`,
    'Contact known active buyers and 1031 exchange investors in the area.',
    'Leverage our proprietary database of qualified buyers and investors.',
  ], y);

  // Section III — Email Marketing
  y = renderBulletSection(doc, 'III. Email Marketing', [
    `Deploy targeted email campaigns to ${template.marketingTargeting} in our database.`,
    'Send property alerts to buyers with matching search criteria.',
    'Follow-up drip campaigns to maintain interest and urgency.',
  ], y);

  // Section IV — Signage & Property Marketing
  y = renderBulletSection(doc, 'IV. Signage & Property Marketing', [
    'Install professional "For Sale" signage with QR code linking to property details.',
    'Create a professional property flyer / one-sheet for distribution.',
    'Prepare offering memorandum for qualified prospects.',
  ], y);

  // Section V — Digital Marketing
  y = renderBulletSection(doc, 'V. Digital Marketing', [
    'Feature property on Apex Real Estate Services website and social media channels.',
    'Targeted social media advertising to reach local business owners and investors.',
    'Google Ads targeting relevant commercial real estate search terms.',
  ], y);

  // Section VI — Networking & Referrals
  y = renderBulletSection(doc, 'VI. Networking & Referrals', [
    'Present at local commercial real estate association meetings and broker tours.',
    'Coordinate with SBA lenders to identify pre-qualified buyers.',
    'Tap referral network of attorneys, CPAs, and financial advisors working with potential buyers.',
  ], y);

  return y;
}

function renderBulletSection(doc: jsPDF, title: string, items: string[], y: number): number {
  if (y > 258) { doc.addPage(); y = 20; }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  doc.text(title, MARGIN, y);
  y += 5;

  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  for (const item of items) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text('\u2022', MARGIN + 4, y);
    const lines: string[] = doc.splitTextToSize(item, doc.internal.pageSize.getWidth() - MARGIN * 2 - 10);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, MARGIN + 8, y);
      y += 4.5;
    }
  }
  y += 3;
  return y;
}

// ============================================================================
// Challenges Boilerplate (shared)
// ============================================================================

const CHALLENGES = [
  'Market Conditions: Interest rate fluctuations and lending environment may impact buyer pool and pricing.',
  'Buyer Financing: SBA and conventional loan timelines can extend closing periods; pre-qualification helps mitigate delays.',
  'Property Condition: Deferred maintenance, environmental concerns, or code compliance issues may surface during due diligence.',
  'Appraisal Risk: The appraised value may come in below the agreed-upon price, requiring renegotiation or additional buyer equity.',
  'Competitive Inventory: New listings or price reductions on competing properties may affect positioning and negotiation leverage.',
];

// ============================================================================
// Signature Block
// ============================================================================

function renderSignatureBlock(doc: jsPDF, y: number): number {
  if (y > 240) { doc.addPage(); y = 20; }

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text('Regards,', MARGIN, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Robert Mendieta', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Associate Broker', MARGIN, y);
  y += 4.5;
  doc.text('Apex Real Estate Services', MARGIN, y);
  y += 4.5;
  doc.text('Keller Williams Commercial', MARGIN, y);
  y += 4.5;
  doc.text('DRE #01422904', MARGIN, y);
  y += 7;

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Phone: (909) 792-2988  |  Fax: (909) 792-2989', MARGIN, y);
  y += 4;
  doc.text('Email: Robert@ApexRealEstateServices.com', MARGIN, y);
  y += 4;
  doc.text('Web: www.ApexRealEstateServices.com', MARGIN, y);
  y += 4;
  doc.text('10535 Foothill Blvd., Suite 460, Rancho Cucamonga, CA 91730', MARGIN, y);

  return y + 6;
}

// ============================================================================
// Main PDF Generator
// ============================================================================

export function generateExecutiveSummaryPDF(options: ListingProposalOptions): void {
  const { property, valuation, ownerInfo, branding, logoBase64 } = options;

  const template = getTemplate(property.property_type);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const scenarios = valuation.pricing_scenarios;

  // ============================
  // PAGE 1
  // ============================

  let y = renderBrandedHeader(doc, branding, logoBase64);

  // Date — right-aligned
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(dateStr, pageWidth - MARGIN, y, { align: 'right' });
  y += 8;

  // Owner address block
  doc.setFontSize(10);
  doc.text(ownerInfo.owner_name, MARGIN, y);
  y += 5;
  doc.text(ownerInfo.owner_address_line1, MARGIN, y);
  y += 5;
  doc.text(`${ownerInfo.owner_city}, ${ownerInfo.owner_state} ${ownerInfo.owner_zip}`, MARGIN, y);
  y += 10;

  // Greeting
  const lastName = ownerInfo.owner_name.split(' ').pop() || ownerInfo.owner_name;
  doc.setFontSize(10);
  doc.text(`Dear ${lastName},`, MARGIN, y);
  y += 7;

  // Intro paragraph
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const introText = `Apex Real Estate Services & KW Commercial is pleased to present this listing proposal for the property identified below. We believe our marketing strategy, market knowledge, and extensive buyer network will position your property for a successful sale.`;
  y = renderWrappedText(doc, introText, y);
  y += 5;

  // ─── THE PROPERTY ───
  y = sectionHeader(doc, 'THE PROPERTY', y);

  const propertyAddress = property.address || 'Address Not Available';
  const cityStateZip = [property.city, property.state, property.zip_code].filter(Boolean).join(', ');
  const sfDisplay = property.building_size ? `\u00b1${property.building_size.toLocaleString()} SF` : '';
  const typeDisplay = template.displayName;
  const zoningDisplay = property.zoning ? `Zoning: ${property.zoning}` : '';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(`${propertyAddress}, ${cityStateZip}`, MARGIN, y);
  y += 4.5;
  const propertyDescParts = [typeDisplay, sfDisplay, zoningDisplay].filter(Boolean);
  doc.text(propertyDescParts.join(' | '), MARGIN, y);
  y += 7;

  // ─── RECOMMENDED ASKING ───
  y = sectionHeader(doc, 'RECOMMENDED ASKING', y);

  if (scenarios) {
    for (const tier of template.pricingTiers) {
      const scenario = scenarios[tier.scenarioKey];
      if (!scenario) continue;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(`${tier.label}:`, MARGIN + 4, y);
      const labelWidth = doc.getTextWidth(`${tier.label}: `);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${formatCurrency(scenario.price)} (${formatPricePerSf(scenario.price_per_sqft)})`,
        MARGIN + 4 + labelWidth, y
      );
      y += 4.5;
    }

    // Italic timing note
    y += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    y = renderWrappedText(doc, template.timingNote, y, { fontSize: 8, italic: true });
    y += 4;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Pricing scenarios not available. Run AI Valuation first.', MARGIN + 4, y);
    y += 7;
  }

  // ─── SCOPE OF SERVICE ───
  y = sectionHeader(doc, 'SCOPE OF SERVICE', y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  const scopeText = `Apex Real Estate Services will serve as the exclusive listing broker for ${ownerInfo.entity_name} in connection with the marketing and sale of the property located at ${propertyAddress}, ${cityStateZip}. Our scope includes pricing strategy, property marketing, buyer qualification, offer negotiation, due diligence coordination, and transaction management through close of escrow.`;
  y = renderWrappedText(doc, scopeText, y);
  y += 5;

  // ─── KEY CONSIDERATIONS ───
  y = sectionHeader(doc, `KEY CONSIDERATIONS (${typeDisplay.toUpperCase()})`, y);

  for (let i = 0; i < template.keyConsiderations.length; i++) {
    const item = template.keyConsiderations[i];
    y = renderBullet(doc, `${i + 1}. ${item.bold}`, item.description, y);
  }
  y += 3;

  // ============================
  // PAGE 2 — Marketing
  // ============================
  doc.addPage();
  y = renderMarketingPage(doc, template, property.city || 'Inland Empire');

  // ============================
  // PAGE 3 — Challenges, Note, Signature
  // ============================
  doc.addPage();
  y = 20;

  // ─── CHALLENGES ───
  y = sectionHeader(doc, 'CHALLENGES', y);

  for (const challenge of CHALLENGES) {
    y = renderBullet(doc, challenge.split(':')[0] + ':', challenge.split(':').slice(1).join(':').trim(), y);
  }
  y += 5;

  // ─── NOTE ───
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  doc.text('NOTE:', MARGIN, y);
  y += 5;

  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y = renderWrappedText(doc, template.noteText, y);
  y += 8;

  // ─── Signature block ───
  y = renderSignatureBlock(doc, y);

  // ============================
  // Footer on all pages
  // ============================
  renderBrandedFooter(doc, branding);

  // ============================
  // Save
  // ============================
  const fileName = `Executive_Summary_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
