import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Apex brand color
const APEX_RED_RGB: [number, number, number] = [178, 31, 36];
const DARK_GRAY: [number, number, number] = [51, 51, 51];
const MED_GRAY: [number, number, number] = [102, 102, 102];
const LIGHT_GRAY: [number, number, number] = [200, 200, 200];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface PropertyData {
  address?: string;
  property_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  property_type?: string;
  property_subtype?: string;
  building_size?: number;
  lot_size_acres?: number;
  year_built?: number;
  clear_height_ft?: number;
  dock_doors?: number;
  grade_doors?: number;
  percent_leased?: number;
  parking_spaces?: number;
  zoning?: string;
  owner_name?: string;
}

interface TransactionData {
  sale_price?: number;
  asking_price?: number;
  price_per_sf?: number;
  cap_rate?: number;
  noi?: number;
  transaction_type?: string;
  transaction_date?: string;
}

interface ContentSections {
  property_description?: string;
  executive_summary?: string;
  location_analysis?: string;
  property_highlights?: string; // JSON stringified array
  market_analysis?: string;
  team_intro?: string;
}

interface GeneratorOptions {
  property: PropertyData;
  transaction?: TransactionData | null;
  content: ContentSections;
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
}

// ============================================================================
// Shared Helpers
// ============================================================================

function addHeader(doc: jsPDF, title: string, companyName: string = 'Apex Real Estate Services'): number {
  let y = MARGIN;

  // Red accent bar at top
  doc.setFillColor(...APEX_RED_RGB);
  doc.rect(0, 0, PAGE_WIDTH, 4, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...APEX_RED_RGB);
  doc.text(companyName.toUpperCase(), MARGIN, y + 8);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK_GRAY);
  doc.text(title, MARGIN, y + 20);

  // Divider line
  y += 26;
  doc.setDrawColor(...APEX_RED_RGB);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  return y + 6;
}

function addFooter(doc: jsPDF, companyName: string = 'Apex Real Estate Services', companyPhone?: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MED_GRAY);

    // Footer line
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_HEIGHT - 15, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 15);

    // Left: company info
    const footerText = companyPhone ? `${companyName} | ${companyPhone}` : companyName;
    doc.text(footerText, MARGIN, PAGE_HEIGHT - 10);

    // Right: page number
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...APEX_RED_RGB);
  doc.text(title, MARGIN, y);

  // Red underline
  y += 2;
  doc.setDrawColor(...APEX_RED_RGB);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + doc.getTextWidth(title), y);

  return y + 8;
}

function addParagraph(doc: jsPDF, text: string, y: number, fontSize: number = 10): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...DARK_GRAY);

  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);

  for (const line of lines) {
    y = checkPageBreak(doc, y, 6);
    doc.text(line, MARGIN, y);
    y += fontSize * 0.45; // line height
  }

  return y + 4;
}

function addMetricsGrid(doc: jsPDF, metrics: { label: string; value: string }[], y: number): number {
  y = checkPageBreak(doc, y, 30);

  const colCount = Math.min(metrics.length, 4);
  const colWidth = CONTENT_WIDTH / colCount;

  // Background
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, 24, 2, 2, 'F');

  metrics.slice(0, 4).forEach((metric, i) => {
    const x = MARGIN + i * colWidth + colWidth / 2;

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK_GRAY);
    doc.text(metric.value, x, y + 6, { align: 'center' });

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MED_GRAY);
    doc.text(metric.label, x, y + 13, { align: 'center' });
  });

  return y + 28;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 20) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

function formatCurrency(val?: number): string {
  if (!val) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val?: number): string {
  if (!val) return 'N/A';
  return val.toLocaleString();
}

function buildPropertyMetrics(property: PropertyData, transaction?: TransactionData | null): { label: string; value: string }[] {
  const metrics: { label: string; value: string }[] = [];

  if (property.building_size) metrics.push({ label: 'BUILDING SIZE', value: `${formatNumber(property.building_size)} SF` });
  if (property.year_built) metrics.push({ label: 'YEAR BUILT', value: String(property.year_built) });
  if (property.clear_height_ft) metrics.push({ label: 'CLEAR HEIGHT', value: `${property.clear_height_ft} FT` });
  if (property.percent_leased != null) metrics.push({ label: 'LEASED', value: `${property.percent_leased}%` });
  if (transaction?.sale_price) metrics.push({ label: 'SALE PRICE', value: formatCurrency(transaction.sale_price) });
  if (transaction?.asking_price) metrics.push({ label: 'ASKING PRICE', value: formatCurrency(transaction.asking_price) });
  if (transaction?.price_per_sf) metrics.push({ label: 'PRICE/SF', value: formatCurrency(transaction.price_per_sf) });
  if (transaction?.cap_rate) metrics.push({ label: 'CAP RATE', value: `${transaction.cap_rate}%` });

  return metrics.slice(0, 4);
}

function parseHighlights(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return raw.split('\n').filter(l => l.trim().length > 0);
  }
}

function buildAddress(property: PropertyData): string {
  const parts = [property.address];
  if (property.city) parts.push(property.city);
  if (property.state) parts.push(property.state);
  if (property.zip) parts.push(property.zip);
  return parts.filter(Boolean).join(', ');
}

// ============================================================================
// BROCHURE TEMPLATE (1-2 pages)
// ============================================================================

export function generateBrochurePDF(options: GeneratorOptions): jsPDF {
  const { property, transaction, content, companyName, companyPhone } = options;
  const doc = new jsPDF('p', 'mm', 'a4');
  const company = companyName || 'Apex Real Estate Services';

  // Header
  let y = addHeader(doc, 'PROPERTY BROCHURE', company);

  // Property address block
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...DARK_GRAY);
  doc.text(property.property_name || property.address || 'Property', MARGIN, y);
  y += 7;

  if (property.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...MED_GRAY);
    doc.text(buildAddress(property), MARGIN, y);
    y += 4;
  }

  // Property type badge
  const typeLabel = (property.property_subtype || property.property_type || 'commercial').replace(/_/g, ' ').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...APEX_RED_RGB);
  doc.text(typeLabel, MARGIN, y + 4);
  y += 12;

  // Metrics bar
  const metrics = buildPropertyMetrics(property, transaction);
  if (metrics.length > 0) {
    y = addMetricsGrid(doc, metrics, y);
  }

  // Property Description
  if (content.property_description) {
    y = addSectionTitle(doc, 'Property Overview', y);
    y = addParagraph(doc, content.property_description, y);
  }

  // Property Highlights
  const highlights = parseHighlights(content.property_highlights);
  if (highlights.length > 0) {
    y = addSectionTitle(doc, 'Property Highlights', y);
    for (const bullet of highlights) {
      y = checkPageBreak(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...DARK_GRAY);

      // Bullet point
      doc.setFillColor(...APEX_RED_RGB);
      doc.circle(MARGIN + 2, y - 1.5, 1.2, 'F');
      const bulletLines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
      for (const line of bulletLines) {
        y = checkPageBreak(doc, y, 5);
        doc.text(line, MARGIN + 7, y);
        y += 4.5;
      }
      y += 1;
    }
    y += 4;
  }

  // Building Specs Table
  const specs: [string, string][] = [];
  if (property.building_size) specs.push(['Building Size', `${formatNumber(property.building_size)} SF`]);
  if (property.lot_size_acres) specs.push(['Lot Size', `${property.lot_size_acres} acres`]);
  if (property.year_built) specs.push(['Year Built', String(property.year_built)]);
  if (property.clear_height_ft) specs.push(['Clear Height', `${property.clear_height_ft} ft`]);
  if (property.dock_doors) specs.push(['Dock Doors', String(property.dock_doors)]);
  if (property.grade_doors) specs.push(['Grade-Level Doors', String(property.grade_doors)]);
  if (property.parking_spaces) specs.push(['Parking', `${property.parking_spaces} spaces`]);
  if (property.zoning) specs.push(['Zoning', property.zoning]);

  if (specs.length > 0) {
    y = addSectionTitle(doc, 'Building Specifications', y);
    y = checkPageBreak(doc, y, 10 + specs.length * 8);

    autoTable(doc, {
      startY: y,
      head: [],
      body: specs,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: DARK_GRAY },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: CONTENT_WIDTH - 50 },
      },
      margin: { left: MARGIN, right: MARGIN },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Contact section
  y = checkPageBreak(doc, y, 30);
  doc.setFillColor(...APEX_RED_RGB);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('For more information, contact:', MARGIN + 6, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const contactLine = [company, options.companyPhone, options.companyEmail].filter(Boolean).join(' | ');
  doc.text(contactLine, MARGIN + 6, y + 14);

  // Footer
  addFooter(doc, company, companyPhone);

  return doc;
}

// ============================================================================
// OFFERING MEMORANDUM TEMPLATE (5-10 pages)
// ============================================================================

export function generateOMPDF(options: GeneratorOptions): jsPDF {
  const { property, transaction, content, companyName, companyPhone } = options;
  const doc = new jsPDF('p', 'mm', 'a4');
  const company = companyName || 'Apex Real Estate Services';

  // ---- COVER PAGE ----
  // Full-color cover
  doc.setFillColor(...APEX_RED_RGB);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  // White text area
  doc.setFillColor(...WHITE);
  doc.roundedRect(30, 60, PAGE_WIDTH - 60, 120, 4, 4, 'F');

  // "OFFERING MEMORANDUM"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...APEX_RED_RGB);
  doc.text('OFFERING MEMORANDUM', PAGE_WIDTH / 2, 80, { align: 'center' });

  // Property name
  doc.setFontSize(22);
  doc.setTextColor(...DARK_GRAY);
  const propTitle = property.property_name || property.address || 'Property';
  const titleLines = doc.splitTextToSize(propTitle, PAGE_WIDTH - 80);
  let coverY = 95;
  for (const line of titleLines) {
    doc.text(line, PAGE_WIDTH / 2, coverY, { align: 'center' });
    coverY += 10;
  }

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MED_GRAY);
  doc.text(buildAddress(property), PAGE_WIDTH / 2, coverY + 5, { align: 'center' });
  coverY += 15;

  // Property type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...APEX_RED_RGB);
  const coverType = (property.property_subtype || property.property_type || 'commercial').replace(/_/g, ' ').toUpperCase();
  doc.text(coverType, PAGE_WIDTH / 2, coverY + 5, { align: 'center' });

  // Key metrics on cover
  const coverMetrics = buildPropertyMetrics(property, transaction);
  if (coverMetrics.length > 0) {
    coverY += 20;
    const metricWidth = (PAGE_WIDTH - 80) / Math.min(coverMetrics.length, 4);
    coverMetrics.slice(0, 4).forEach((m, i) => {
      const mx = 40 + i * metricWidth + metricWidth / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...DARK_GRAY);
      doc.text(m.value, mx, coverY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MED_GRAY);
      doc.text(m.label, mx, coverY + 5, { align: 'center' });
    });
  }

  // Company at bottom of cover
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(company.toUpperCase(), PAGE_WIDTH / 2, PAGE_HEIGHT - 40, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('CONFIDENTIAL', PAGE_WIDTH / 2, PAGE_HEIGHT - 30, { align: 'center' });

  // ---- TABLE OF CONTENTS ----
  doc.addPage();
  let y = addHeader(doc, 'TABLE OF CONTENTS', company);
  y += 8;

  const tocItems = [
    'Executive Summary',
    'Property Overview',
    'Building Specifications',
    'Financial Analysis',
  ];
  if (content.location_analysis) tocItems.push('Location Analysis');
  if (parseHighlights(content.property_highlights).length > 0) tocItems.splice(2, 0, 'Property Highlights');

  tocItems.forEach((item, i) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...DARK_GRAY);
    doc.text(`${i + 1}.  ${item}`, MARGIN + 5, y);
    y += 10;
  });

  // ---- EXECUTIVE SUMMARY ----
  doc.addPage();
  y = addHeader(doc, 'EXECUTIVE SUMMARY', company);
  y += 4;

  if (content.executive_summary) {
    y = addParagraph(doc, content.executive_summary, y, 10);
  }

  // Metrics
  const metrics = buildPropertyMetrics(property, transaction);
  if (metrics.length > 0) {
    y += 4;
    y = addMetricsGrid(doc, metrics, y);
  }

  // ---- PROPERTY OVERVIEW ----
  doc.addPage();
  y = addHeader(doc, 'PROPERTY OVERVIEW', company);
  y += 4;

  if (content.property_description) {
    y = addParagraph(doc, content.property_description, y);
    y += 4;
  }

  // Highlights
  const highlights = parseHighlights(content.property_highlights);
  if (highlights.length > 0) {
    y = addSectionTitle(doc, 'Property Highlights', y);
    for (const bullet of highlights) {
      y = checkPageBreak(doc, y, 8);
      doc.setFillColor(...APEX_RED_RGB);
      doc.circle(MARGIN + 2, y - 1.5, 1.2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...DARK_GRAY);
      const bulletLines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
      for (const line of bulletLines) {
        y = checkPageBreak(doc, y, 5);
        doc.text(line, MARGIN + 7, y);
        y += 4.5;
      }
      y += 1;
    }
    y += 6;
  }

  // Building specs table
  const specs: [string, string][] = [];
  if (property.building_size) specs.push(['Building Size', `${formatNumber(property.building_size)} SF`]);
  if (property.lot_size_acres) specs.push(['Lot Size', `${property.lot_size_acres} acres`]);
  if (property.year_built) specs.push(['Year Built', String(property.year_built)]);
  if (property.clear_height_ft) specs.push(['Clear Height', `${property.clear_height_ft} ft`]);
  if (property.dock_doors) specs.push(['Dock Doors', String(property.dock_doors)]);
  if (property.grade_doors) specs.push(['Grade-Level Doors', String(property.grade_doors)]);
  if (property.parking_spaces) specs.push(['Parking', `${property.parking_spaces} spaces`]);
  if (property.zoning) specs.push(['Zoning', property.zoning]);
  if (property.percent_leased != null) specs.push(['Occupancy', `${property.percent_leased}%`]);

  if (specs.length > 0) {
    y = addSectionTitle(doc, 'Building Specifications', y);
    y = checkPageBreak(doc, y, 10 + specs.length * 8);

    autoTable(doc, {
      startY: y,
      head: [['Specification', 'Detail']],
      body: specs,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: DARK_GRAY },
      headStyles: { fillColor: APEX_RED_RGB, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55 },
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---- FINANCIAL ANALYSIS ----
  if (transaction && (transaction.sale_price || transaction.asking_price || transaction.noi)) {
    doc.addPage();
    y = addHeader(doc, 'FINANCIAL ANALYSIS', company);
    y += 4;

    const finData: [string, string][] = [];
    if (transaction.asking_price) finData.push(['Asking Price', formatCurrency(transaction.asking_price)]);
    if (transaction.sale_price) finData.push(['Sale Price', formatCurrency(transaction.sale_price)]);
    if (transaction.price_per_sf) finData.push(['Price Per SF', formatCurrency(transaction.price_per_sf)]);
    if (transaction.noi) finData.push(['Net Operating Income (NOI)', formatCurrency(transaction.noi)]);
    if (transaction.cap_rate) finData.push(['Capitalization Rate', `${transaction.cap_rate}%`]);

    if (finData.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: finData,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 5, textColor: DARK_GRAY },
        headStyles: { fillColor: APEX_RED_RGB, textColor: WHITE, fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
        },
        margin: { left: MARGIN, right: MARGIN },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ---- LOCATION ANALYSIS ----
  if (content.location_analysis) {
    doc.addPage();
    y = addHeader(doc, 'LOCATION ANALYSIS', company);
    y += 4;
    y = addParagraph(doc, content.location_analysis, y);
  }

  // ---- CONFIDENTIALITY NOTICE ----
  doc.addPage();
  y = addHeader(doc, 'CONFIDENTIALITY NOTICE', company);
  y += 8;

  const confidentialityText = `This Offering Memorandum has been prepared by ${company} for the exclusive use of authorized prospective purchasers. This document is confidential and proprietary and is not to be reproduced, distributed, or shared with any third party without the prior written consent of ${company}.

The information contained herein has been obtained from sources believed to be reliable but has not been independently verified. No representation, warranty, or guarantee of any kind is made regarding the accuracy or completeness of the information contained herein. Prospective purchasers are encouraged to conduct their own independent investigation and due diligence.

${company} and its affiliates, agents, and representatives make no representations or warranties, express or implied, regarding the condition of the property or the accuracy of the information contained in this Offering Memorandum. The owner reserves the right to withdraw the property from the market, change the terms of sale, or reject any offer without notice.

By accepting this Offering Memorandum, you agree to maintain the confidentiality of the information contained herein and to return it upon request.`;

  y = addParagraph(doc, confidentialityText, y, 9);

  // Footer on all pages
  addFooter(doc, company, companyPhone);

  return doc;
}

// ============================================================================
// PROPOSAL TEMPLATE (3-5 pages)
// ============================================================================

export function generateProposalPDF(options: GeneratorOptions): jsPDF {
  const { property, transaction, content, companyName, companyPhone, companyEmail, companyAddress } = options;
  const doc = new jsPDF('p', 'mm', 'a4');
  const company = companyName || 'Apex Real Estate Services';

  // ---- COVER PAGE ----
  // Clean white cover with red accent
  doc.setFillColor(...APEX_RED_RGB);
  doc.rect(0, 0, 8, PAGE_HEIGHT, 'F'); // Left red bar

  let coverY = 60;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...APEX_RED_RGB);
  doc.text('INVESTMENT PROPOSAL', MARGIN + 10, coverY);
  coverY += 15;

  doc.setFontSize(24);
  doc.setTextColor(...DARK_GRAY);
  const propTitle = property.property_name || property.address || 'Property';
  const titleLines = doc.splitTextToSize(propTitle, CONTENT_WIDTH - 10);
  for (const line of titleLines) {
    doc.text(line, MARGIN + 10, coverY);
    coverY += 12;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MED_GRAY);
  doc.text(buildAddress(property), MARGIN + 10, coverY + 5);
  coverY += 20;

  // Type badge
  const typeLabel = (property.property_subtype || property.property_type || 'commercial').replace(/_/g, ' ').toUpperCase();
  doc.setFillColor(245, 245, 245);
  const badgeWidth = doc.getTextWidth(typeLabel) + 12;
  doc.roundedRect(MARGIN + 10, coverY - 4, badgeWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...APEX_RED_RGB);
  doc.text(typeLabel, MARGIN + 16, coverY + 2);

  // Prepared by
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MED_GRAY);
  doc.text('Prepared by', MARGIN + 10, PAGE_HEIGHT - 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_GRAY);
  doc.text(company, MARGIN + 10, PAGE_HEIGHT - 52);
  if (companyAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MED_GRAY);
    doc.text(companyAddress, MARGIN + 10, PAGE_HEIGHT - 45);
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MED_GRAY);
  doc.text(today, MARGIN + 10, PAGE_HEIGHT - 35);

  // ---- WHY APEX / TEAM INTRO ----
  if (content.team_intro) {
    doc.addPage();
    let y = addHeader(doc, `WHY ${company.toUpperCase()}`, company);
    y += 4;
    y = addParagraph(doc, content.team_intro, y);
  }

  // ---- MARKET ANALYSIS ----
  if (content.market_analysis) {
    doc.addPage();
    let y = addHeader(doc, 'MARKET ANALYSIS', company);
    y += 4;
    y = addParagraph(doc, content.market_analysis, y);
  }

  // ---- PROPERTY RECOMMENDATION ----
  doc.addPage();
  let y = addHeader(doc, 'PROPERTY RECOMMENDATION', company);
  y += 4;

  // Property info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK_GRAY);
  doc.text(property.property_name || property.address || 'Property', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MED_GRAY);
  doc.text(buildAddress(property), MARGIN, y);
  y += 10;

  // Metrics
  const metrics = buildPropertyMetrics(property, transaction);
  if (metrics.length > 0) {
    y = addMetricsGrid(doc, metrics, y);
  }

  // Description
  if (content.property_description) {
    y = addSectionTitle(doc, 'Property Overview', y);
    y = addParagraph(doc, content.property_description, y);
  }

  // Highlights
  const highlights = parseHighlights(content.property_highlights);
  if (highlights.length > 0) {
    y = addSectionTitle(doc, 'Key Highlights', y);
    for (const bullet of highlights) {
      y = checkPageBreak(doc, y, 8);
      doc.setFillColor(...APEX_RED_RGB);
      doc.circle(MARGIN + 2, y - 1.5, 1.2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...DARK_GRAY);
      const bulletLines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 8);
      for (const line of bulletLines) {
        y = checkPageBreak(doc, y, 5);
        doc.text(line, MARGIN + 7, y);
        y += 4.5;
      }
      y += 1;
    }
    y += 6;
  }

  // ---- NEXT STEPS ----
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'Next Steps', y);

  const steps = [
    'Schedule a property tour at your convenience',
    'Review property due diligence materials',
    'Discuss financing options and deal structure',
    'Submit Letter of Intent',
  ];

  steps.forEach((step, i) => {
    y = checkPageBreak(doc, y, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...APEX_RED_RGB);
    doc.text(`${i + 1}.`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    doc.text(step, MARGIN + 8, y);
    y += 7;
  });

  y += 10;

  // Contact block
  y = checkPageBreak(doc, y, 35);
  doc.setFillColor(...APEX_RED_RGB);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("Let's Get Started", MARGIN + 6, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const contactInfo = [company, companyPhone, companyEmail].filter(Boolean).join(' | ');
  doc.text(contactInfo, MARGIN + 6, y + 16);
  if (companyAddress) {
    doc.text(companyAddress, MARGIN + 6, y + 22);
  }

  // Footer
  addFooter(doc, company, companyPhone);

  return doc;
}
