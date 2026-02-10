import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// Company Brands
// ============================================================================

export interface CompanyBrand {
  key: string;
  displayName: string;
  primary: [number, number, number];
  accent: [number, number, number];
  description: string;
  stylePrompt: string;
}

export const COMPANY_BRANDS: CompanyBrand[] = [
  {
    key: 'apex',
    displayName: 'Apex Real Estate',
    primary: [120, 0, 20],
    accent: [178, 31, 36],
    description: 'Deep maroon with red accents — Apex branding',
    stylePrompt: '',
  },
  {
    key: 'kw_commercial',
    displayName: 'KW Commercial',
    primary: [180, 0, 0],
    accent: [51, 51, 51],
    description: 'Keller Williams Commercial red with dark accents',
    stylePrompt: '',
  },
  {
    key: 'keller_williams',
    displayName: 'Keller Williams',
    primary: [180, 0, 0],
    accent: [100, 100, 100],
    description: 'Classic KW red with gray accents',
    stylePrompt: '',
  },
  {
    key: 'coldwell_banker',
    displayName: 'Coldwell Banker',
    primary: [0, 50, 120],
    accent: [0, 100, 170],
    description: 'Navy blue with bright blue accents',
    stylePrompt: '',
  },
  {
    key: 'exp_realty',
    displayName: 'eXp Realty',
    primary: [0, 61, 121],
    accent: [28, 117, 188],
    description: 'Dark blue with sky blue accents',
    stylePrompt: '',
  },
  {
    key: 'exp_commercial',
    displayName: 'eXp Commercial',
    primary: [0, 47, 95],
    accent: [0, 90, 156],
    description: 'Deep navy with medium blue accents',
    stylePrompt: '',
  },
  {
    key: 'lee_associates',
    displayName: 'Lee & Associates',
    primary: [0, 51, 102],
    accent: [204, 153, 0],
    description: 'Navy blue with gold accents',
    stylePrompt: '',
  },
  {
    key: 'jll',
    displayName: 'JLL',
    primary: [0, 51, 102],
    accent: [218, 41, 28],
    description: 'Navy blue with red accents',
    stylePrompt: '',
  },
  {
    key: 'custom',
    displayName: 'Custom',
    primary: [50, 50, 50],
    accent: [100, 100, 100],
    description: 'Choose your own brand colors',
    stylePrompt: '',
  },
];

export function getCompanyBrand(key: string): CompanyBrand | undefined {
  return COMPANY_BRANDS.find(b => b.key === key);
}

// ============================================================================
// Color Themes — built from company brands
// ============================================================================

export type ThemeStyle =
  | 'apex'
  | 'kw_commercial'
  | 'keller_williams'
  | 'coldwell_banker'
  | 'exp_realty'
  | 'exp_commercial'
  | 'lee_associates'
  | 'jll'
  | 'custom'
  | 'modern'
  | 'corporate';

interface Theme {
  primary: [number, number, number];
  accent: [number, number, number];
  dark: [number, number, number];
  medium: [number, number, number];
  light: [number, number, number];
  white: [number, number, number];
}

function buildThemeFromBrand(brand: CompanyBrand): Theme {
  return {
    primary: brand.primary,
    accent: brand.accent,
    dark: [33, 33, 33],
    medium: [100, 100, 100],
    light: [220, 220, 220],
    white: [255, 255, 255],
  };
}

const THEMES: Record<string, Theme> = {};
for (const brand of COMPANY_BRANDS) {
  THEMES[brand.key] = buildThemeFromBrand(brand);
}
// Legacy themes kept for backward compatibility
THEMES['modern'] = {
  primary: [25, 25, 28],
  accent: [190, 30, 45],
  dark: [33, 33, 33],
  medium: [100, 100, 100],
  light: [220, 220, 220],
  white: [255, 255, 255],
};
THEMES['corporate'] = {
  primary: [0, 51, 102],
  accent: [0, 128, 155],
  dark: [33, 33, 33],
  medium: [100, 100, 100],
  light: [220, 220, 220],
  white: [255, 255, 255],
};

// ============================================================================
// Page Constants
// ============================================================================

const PW = 210;
const PH = 297;
const MARGIN = 20;
const SIDEBAR_W = 4;
const LEFT = MARGIN + SIDEBAR_W + 2;
const CW = PW - LEFT - MARGIN;
const HEADER_H = 30;

// ============================================================================
// Types
// ============================================================================

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
  property_highlights?: string;
  market_analysis?: string;
  team_intro?: string;
}

export interface GeneratorOptions {
  property: PropertyData;
  transaction?: TransactionData | null;
  content: ContentSections;
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  style?: ThemeStyle;
  logoBase64?: string;
  customPrimary?: [number, number, number];
  customAccent?: [number, number, number];
}

// ============================================================================
// Utility Helpers
// ============================================================================

function getTheme(options?: { style?: ThemeStyle; customPrimary?: [number, number, number]; customAccent?: [number, number, number] }): Theme {
  const style = options?.style || 'apex';
  const base = THEMES[style] || THEMES['apex'];

  // For 'custom' style, override primary/accent if provided
  if (style === 'custom') {
    return {
      ...base,
      primary: options?.customPrimary || base.primary,
      accent: options?.customAccent || base.accent,
    };
  }

  return base;
}

function fmt$(val?: number): string {
  if (!val) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function fmtNum(val?: number): string {
  if (!val) return 'N/A';
  return val.toLocaleString();
}

function buildAddress(p: PropertyData): string {
  return [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');
}

function buildMetrics(p: PropertyData, t?: TransactionData | null): { label: string; value: string }[] {
  const m: { label: string; value: string }[] = [];
  if (t?.asking_price) m.push({ label: 'ASKING PRICE', value: fmt$(t.asking_price) });
  if (t?.sale_price) m.push({ label: 'SALE PRICE', value: fmt$(t.sale_price) });
  if (p.building_size) m.push({ label: 'BUILDING SIZE', value: `${fmtNum(p.building_size)} SF` });
  if (t?.price_per_sf) m.push({ label: 'PRICE / SF', value: fmt$(t.price_per_sf) });
  if (t?.cap_rate) m.push({ label: 'CAP RATE', value: `${t.cap_rate}%` });
  if (t?.noi) m.push({ label: 'NOI', value: fmt$(t.noi) });
  if (p.year_built) m.push({ label: 'YEAR BUILT', value: String(p.year_built) });
  if (p.clear_height_ft) m.push({ label: 'CLEAR HEIGHT', value: `${p.clear_height_ft} FT` });
  if (p.percent_leased != null) m.push({ label: 'OCCUPANCY', value: `${p.percent_leased}%` });
  if (p.lot_size_acres) m.push({ label: 'LOT SIZE', value: `${p.lot_size_acres} AC` });
  return m;
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

function buildSpecs(p: PropertyData): [string, string][] {
  const specs: [string, string][] = [];
  if (p.building_size) specs.push(['Building Size', `${fmtNum(p.building_size)} SF`]);
  if (p.lot_size_acres) specs.push(['Lot Size', `${p.lot_size_acres} acres`]);
  if (p.year_built) specs.push(['Year Built', String(p.year_built)]);
  if (p.clear_height_ft) specs.push(['Clear Height', `${p.clear_height_ft} ft`]);
  if (p.dock_doors) specs.push(['Dock Doors', String(p.dock_doors)]);
  if (p.grade_doors) specs.push(['Grade-Level Doors', String(p.grade_doors)]);
  if (p.parking_spaces) specs.push(['Parking', `${p.parking_spaces} spaces`]);
  if (p.zoning) specs.push(['Zoning', p.zoning]);
  if (p.percent_leased != null) specs.push(['Occupancy', `${p.percent_leased}%`]);
  return specs;
}

/**
 * Safely embed a base64 logo image into the document.
 * Returns true if the logo was successfully added.
 */
function addLogo(doc: jsPDF, logoBase64: string, x: number, y: number, w: number, h: number): boolean {
  try {
    // Determine image type from data URI or default to PNG
    let format: 'PNG' | 'JPEG' = 'PNG';
    let data = logoBase64;
    if (logoBase64.startsWith('data:image/jpeg') || logoBase64.startsWith('data:image/jpg')) {
      format = 'JPEG';
    }
    // Strip data URI prefix if present
    if (data.includes(',')) {
      data = data.split(',')[1];
    }
    doc.addImage(data, format, x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Drawing Primitives
// ============================================================================

/**
 * Draw cover page — full-color background with centered white content card
 */
function drawCover(
  doc: jsPDF,
  title: string,
  options: GeneratorOptions,
  theme: Theme
): void {
  const { property, transaction, companyName, logoBase64 } = options;
  const company = companyName || 'Apex Real Estate Services';

  // Full page primary fill
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, PW, PH, 'F');

  // Accent stripe at very top
  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, PW, 6, 'F');

  // White content card
  const cardX = 28;
  const cardY = 50;
  const cardW = PW - 56;
  const cardH = 170;
  doc.setFillColor(...theme.white);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'F');

  // Logo above company name label (inside card)
  let y = cardY + 12;
  if (logoBase64) {
    const logoW = 30;
    const logoH = 30;
    const logoX = PW / 2 - logoW / 2;
    const added = addLogo(doc, logoBase64, logoX, y - 6, logoW, logoH);
    if (added) {
      y += logoH - 2;
    }
  }

  // Document type label
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...theme.accent);
  doc.text(title, PW / 2, y, { align: 'center' });

  // Thin accent line below label
  y += 6;
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(0.8);
  const labelW = doc.getTextWidth(title);
  doc.line(PW / 2 - labelW / 2 - 8, y, PW / 2 + labelW / 2 + 8, y);

  // Property name
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...theme.dark);
  const propName = property.property_name || property.address || 'Property';
  const nameLines = doc.splitTextToSize(propName, cardW - 30);
  for (const line of nameLines) {
    doc.text(line, PW / 2, y, { align: 'center' });
    y += 11;
  }

  // Address
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...theme.medium);
  doc.text(buildAddress(property), PW / 2, y, { align: 'center' });
  y += 12;

  // Property type badge
  const typeLabel = (property.property_subtype || property.property_type || 'commercial').replace(/_/g, ' ').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(typeLabel) + 16;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(PW / 2 - badgeW / 2, y - 4, badgeW, 10, 2, 2, 'F');
  doc.setTextColor(...theme.accent);
  doc.text(typeLabel, PW / 2, y + 2, { align: 'center' });

  // Transaction type badge (FOR SALE / FOR LEASE)
  if (transaction?.transaction_type) {
    const txType = transaction.transaction_type.toUpperCase().includes('LEASE') ? 'FOR LEASE' : 'FOR SALE';
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const txBadgeW = doc.getTextWidth(txType) + 20;
    doc.setFillColor(...theme.accent);
    doc.roundedRect(PW / 2 - txBadgeW / 2, y - 5, txBadgeW, 12, 2, 2, 'F');
    doc.setTextColor(...theme.white);
    doc.text(txType, PW / 2, y + 2, { align: 'center' });
    y += 14;
  } else {
    y += 8;
  }

  // Divider
  y += 4;
  doc.setDrawColor(...theme.light);
  doc.setLineWidth(0.3);
  doc.line(cardX + 20, y, cardX + cardW - 20, y);
  y += 12;

  // Key metrics on cover (up to 4)
  const metrics = buildMetrics(property, transaction).slice(0, 4);
  if (metrics.length > 0) {
    const mColW = (cardW - 40) / metrics.length;
    metrics.forEach((m, i) => {
      const mx = cardX + 20 + i * mColW + mColW / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...theme.dark);
      doc.text(m.value, mx, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...theme.medium);
      doc.text(m.label, mx, y + 6, { align: 'center' });
    });
  }

  // Company name at bottom of page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...theme.white);
  doc.text(company.toUpperCase(), PW / 2, PH - 35, { align: 'center' });

  if (title === 'OFFERING MEMORANDUM') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('CONFIDENTIAL', PW / 2, PH - 26, { align: 'center' });
  }
}

/**
 * Start a new interior page with colored header bar + sidebar accent
 * Returns the Y position where content should start
 */
function startInteriorPage(doc: jsPDF, title: string, theme: Theme, companyName: string, logoBase64?: string): number {
  doc.addPage();

  // Header bar
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, PW, HEADER_H, 'F');

  // Accent stripe below header
  doc.setFillColor(...theme.accent);
  doc.rect(0, HEADER_H, PW, 2, 'F');

  // Small logo right-aligned in header
  if (logoBase64) {
    addLogo(doc, logoBase64, PW - MARGIN - 10, 3, 10, 10);
  }

  // Company name in header (small, top-left)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...theme.white);
  doc.text(companyName.toUpperCase(), MARGIN, 10);

  // Page title in header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...theme.white);
  doc.text(title, MARGIN, HEADER_H - 8);

  // Left sidebar accent stripe
  doc.setFillColor(...theme.accent);
  doc.rect(0, HEADER_H + 2, SIDEBAR_W, PH - HEADER_H - 2, 'F');

  return HEADER_H + 14;
}

/**
 * Draw a colored section bar (full-width accent background with white text)
 */
function drawSectionBar(doc: jsPDF, title: string, y: number, theme: Theme): number {
  y = pageBreak(doc, y, 22, theme);

  doc.setFillColor(...theme.accent);
  doc.rect(LEFT - 2, y - 4, CW + 4, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...theme.white);
  doc.text(title.toUpperCase(), LEFT + 4, y + 3);

  return y + 14;
}

/**
 * Draw a section title (text with accent-colored underline)
 */
function drawSectionTitle(doc: jsPDF, title: string, y: number, theme: Theme): number {
  y = pageBreak(doc, y, 16, theme);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...theme.accent);
  doc.text(title, LEFT, y);

  y += 2;
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(0.6);
  doc.line(LEFT, y, LEFT + doc.getTextWidth(title) * 1.05, y);

  return y + 8;
}

/**
 * Draw paragraph text
 */
function drawParagraph(doc: jsPDF, text: string, y: number, theme: Theme, fontSize: number = 9.5): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...theme.dark);

  const lines = doc.splitTextToSize(text, CW);
  const lineH = fontSize * 0.42;

  for (const line of lines) {
    y = pageBreak(doc, y, lineH + 1, theme);
    doc.text(line, LEFT, y);
    y += lineH;
  }

  return y + 4;
}

/**
 * Draw metrics in card-style grid with left accent border
 */
function drawMetricsCards(doc: jsPDF, metrics: { label: string; value: string }[], y: number, theme: Theme): number {
  const display = metrics.slice(0, 8);
  if (display.length === 0) return y;

  const cols = Math.min(display.length, 4);
  const rows = Math.ceil(display.length / cols);
  const cardW = (CW - (cols - 1) * 4) / cols;
  const cardH = 22;

  y = pageBreak(doc, y, rows * (cardH + 4) + 4, theme);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= display.length) break;

      const m = display[idx];
      const cx = LEFT + c * (cardW + 4);
      const cy = y + r * (cardH + 4);

      // Card background
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'F');

      // Left accent border
      doc.setFillColor(...theme.accent);
      doc.rect(cx, cy + 2, 2, cardH - 4, 'F');

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...theme.dark);
      doc.text(m.value, cx + 8, cy + 9);

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...theme.medium);
      doc.text(m.label, cx + 8, cy + 16);
    }
  }

  return y + rows * (cardH + 4) + 6;
}

/**
 * Draw bullet list with accent-colored dots
 */
function drawBulletList(doc: jsPDF, items: string[], y: number, theme: Theme): number {
  for (const item of items) {
    y = pageBreak(doc, y, 8, theme);

    doc.setFillColor(...theme.accent);
    doc.circle(LEFT + 2, y - 1.2, 1.2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...theme.dark);
    const lines = doc.splitTextToSize(item, CW - 10);
    for (const line of lines) {
      y = pageBreak(doc, y, 5, theme);
      doc.text(line, LEFT + 8, y);
      y += 4.2;
    }
    y += 1.5;
  }
  return y + 3;
}

/**
 * Draw specs table with colored header and alternating rows
 */
function drawSpecsTable(doc: jsPDF, specs: [string, string][], y: number, theme: Theme): number {
  y = pageBreak(doc, y, 14 + specs.length * 8, theme);

  autoTable(doc, {
    startY: y,
    head: [['Specification', 'Detail']],
    body: specs,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: theme.dark,
      lineWidth: 0.1,
      lineColor: theme.light,
    },
    headStyles: {
      fillColor: theme.primary,
      textColor: theme.white,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
    },
    margin: { left: LEFT, right: MARGIN },
  });

  return (doc as any).lastAutoTable.finalY + 8;
}

/**
 * Draw financial data table
 */
function drawFinancialTable(doc: jsPDF, data: [string, string][], y: number, theme: Theme): number {
  y = pageBreak(doc, y, 14 + data.length * 10, theme);

  autoTable(doc, {
    startY: y,
    head: [['Financial Metric', 'Value']],
    body: data,
    theme: 'striped',
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: theme.dark,
      lineWidth: 0.1,
      lineColor: theme.light,
    },
    headStyles: {
      fillColor: theme.primary,
      textColor: theme.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
    },
    margin: { left: LEFT, right: MARGIN },
  });

  return (doc as any).lastAutoTable.finalY + 8;
}

/**
 * Draw contact / back page with full-color background
 */
function drawContactPage(doc: jsPDF, options: GeneratorOptions, theme: Theme): void {
  doc.addPage();

  // Full page fill
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, PW, PH, 'F');

  // Accent bar at top
  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, PW, 6, 'F');

  // White content card centered
  const cardX = 35;
  const cardY = 80;
  const cardW = PW - 70;
  const cardH = 130;
  doc.setFillColor(...theme.white);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'F');

  let y = cardY + 16;

  // Logo above company name
  if (options.logoBase64) {
    const logoW = 24;
    const logoH = 24;
    const added = addLogo(doc, options.logoBase64, PW / 2 - logoW / 2, y - 4, logoW, logoH);
    if (added) {
      y += logoH + 4;
    }
  }

  // "FOR MORE INFORMATION"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...theme.medium);
  doc.text('FOR MORE INFORMATION', PW / 2, y, { align: 'center' });
  y += 12;

  // Accent divider line
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(1);
  doc.line(PW / 2 - 22, y, PW / 2 + 22, y);
  y += 16;

  // Company name
  const company = options.companyName || 'Apex Real Estate Services';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...theme.dark);
  doc.text(company, PW / 2, y, { align: 'center' });
  y += 14;

  // Contact details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...theme.medium);

  if (options.companyPhone) {
    doc.text(options.companyPhone, PW / 2, y, { align: 'center' });
    y += 7;
  }
  if (options.companyEmail) {
    doc.text(options.companyEmail, PW / 2, y, { align: 'center' });
    y += 7;
  }
  if (options.companyAddress) {
    doc.text(options.companyAddress, PW / 2, y, { align: 'center' });
    y += 7;
  }

  // Disclaimer at bottom
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 180, 180);
  const disclaimer = 'Information deemed reliable but not guaranteed. Buyer to verify all information independently.';
  doc.text(disclaimer, PW / 2, PH - 20, { align: 'center' });
}

/**
 * Add footers to all interior pages (skip cover and contact/back page)
 */
function drawAllFooters(doc: jsPDF, companyName: string, theme: Theme): void {
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    // Skip the last page (contact/back page)
    if (i === pages) continue;

    doc.setPage(i);

    // Footer line
    doc.setDrawColor(...theme.light);
    doc.setLineWidth(0.3);
    doc.line(LEFT, PH - 14, PW - MARGIN, PH - 14);

    // Left: company name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...theme.medium);
    doc.text(companyName, LEFT, PH - 9);

    // Right: page number
    doc.text(`${i - 1}`, PW - MARGIN, PH - 9, { align: 'right' });
  }
}

/**
 * Page break check — creates new overflow page with sidebar + top accent
 */
function pageBreak(doc: jsPDF, y: number, needed: number, theme: Theme): number {
  if (y + needed > PH - 18) {
    doc.addPage();

    // Sidebar accent
    doc.setFillColor(...theme.accent);
    doc.rect(0, 0, SIDEBAR_W, PH, 'F');

    // Top accent bar for visual continuity
    doc.setFillColor(...theme.primary);
    doc.rect(0, 0, PW, 3, 'F');

    return 14;
  }
  return y;
}

// ============================================================================
// BROCHURE TEMPLATE (4-6 pages)
// ============================================================================

export function generateBrochurePDF(options: GeneratorOptions): jsPDF {
  const { property, transaction, content, companyName, logoBase64 } = options;
  const doc = new jsPDF('p', 'mm', 'a4');
  const theme = getTheme(options);
  const company = companyName || 'Apex Real Estate Services';

  // === PAGE 1: COVER ===
  drawCover(doc, 'PROPERTY BROCHURE', options, theme);

  // === PAGE 2: EXECUTIVE SUMMARY ===
  let y = startInteriorPage(doc, 'EXECUTIVE SUMMARY', theme, company, logoBase64);

  // Property address block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...theme.dark);
  doc.text(property.property_name || property.address || 'Property', LEFT, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...theme.medium);
  doc.text(buildAddress(property), LEFT, y);
  y += 10;

  // Key metrics cards
  const metrics = buildMetrics(property, transaction);
  if (metrics.length > 0) {
    y = drawMetricsCards(doc, metrics.slice(0, 4), y, theme);
  }

  // Executive summary text (if available), otherwise property description
  if (content.executive_summary) {
    y = drawSectionTitle(doc, 'Overview', y, theme);
    y = drawParagraph(doc, content.executive_summary, y, theme);
  } else if (content.property_description) {
    y = drawSectionTitle(doc, 'Property Overview', y, theme);
    y = drawParagraph(doc, content.property_description, y, theme);
  }

  // === PAGE 3: PROPERTY DETAILS ===
  y = startInteriorPage(doc, 'PROPERTY DETAILS', theme, company, logoBase64);

  // Highlights
  const highlights = parseHighlights(content.property_highlights);
  if (highlights.length > 0) {
    y = drawSectionTitle(doc, 'Property Highlights', y, theme);
    y = drawBulletList(doc, highlights, y, theme);
  }

  // Building specs
  const specs = buildSpecs(property);
  if (specs.length > 0) {
    y = drawSectionBar(doc, 'Building Specifications', y, theme);
    y = drawSpecsTable(doc, specs, y, theme);
  }

  // Property description if we used exec summary on previous page
  if (content.executive_summary && content.property_description) {
    y = drawSectionTitle(doc, 'Property Description', y, theme);
    y = drawParagraph(doc, content.property_description, y, theme);
  }

  // === PAGE 4: LOCATION ANALYSIS (if available) ===
  if (content.location_analysis) {
    y = startInteriorPage(doc, 'LOCATION OVERVIEW', theme, company, logoBase64);
    y = drawParagraph(doc, content.location_analysis, y, theme);
  }

  // === LAST PAGE: CONTACT ===
  drawContactPage(doc, options, theme);

  // Footers
  drawAllFooters(doc, company, theme);

  return doc;
}

// ============================================================================
// OFFERING MEMORANDUM TEMPLATE (6-10 pages)
// ============================================================================

export function generateOMPDF(options: GeneratorOptions): jsPDF {
  const { property, transaction, content, companyName, logoBase64 } = options;
  const doc = new jsPDF('p', 'mm', 'a4');
  const theme = getTheme(options);
  const company = companyName || 'Apex Real Estate Services';

  // === PAGE 1: COVER ===
  drawCover(doc, 'OFFERING MEMORANDUM', options, theme);

  // === PAGE 2: TABLE OF CONTENTS ===
  let y = startInteriorPage(doc, 'TABLE OF CONTENTS', theme, company, logoBase64);
  y += 8;

  const tocItems: string[] = ['Executive Summary', 'Property Overview'];
  if (parseHighlights(content.property_highlights).length > 0) tocItems.push('Property Highlights');
  tocItems.push('Building Specifications');
  if (transaction && (transaction.sale_price || transaction.asking_price || transaction.noi)) {
    tocItems.push('Financial Analysis');
  }
  if (content.location_analysis) tocItems.push('Location Analysis');
  tocItems.push('Confidentiality Notice');

  tocItems.forEach((item, i) => {
    // Numbered label in accent color
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...theme.accent);
    doc.text(`${String(i + 1).padStart(2, '0')}`, LEFT, y);

    // Item name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...theme.dark);
    doc.text(item, LEFT + 14, y);

    // Dotted line to right
    doc.setDrawColor(...theme.light);
    doc.setLineWidth(0.3);
    const textEnd = LEFT + 14 + doc.getTextWidth(item) + 4;
    doc.line(textEnd, y - 1, PW - MARGIN - 20, y - 1);

    y += 12;
  });

  // === PAGE 3: EXECUTIVE SUMMARY ===
  y = startInteriorPage(doc, 'EXECUTIVE SUMMARY', theme, company, logoBase64);

  if (content.executive_summary) {
    y = drawParagraph(doc, content.executive_summary, y, theme, 10);
  }

  // Key metrics
  const metrics = buildMetrics(property, transaction);
  if (metrics.length > 0) {
    y += 4;
    y = drawMetricsCards(doc, metrics.slice(0, 8), y, theme);
  }

  // === PAGE 4: PROPERTY OVERVIEW ===
  y = startInteriorPage(doc, 'PROPERTY OVERVIEW', theme, company, logoBase64);

  if (content.property_description) {
    y = drawParagraph(doc, content.property_description, y, theme);
    y += 4;
  }

  // Highlights
  const highlights = parseHighlights(content.property_highlights);
  if (highlights.length > 0) {
    y = drawSectionTitle(doc, 'Property Highlights', y, theme);
    y = drawBulletList(doc, highlights, y, theme);
  }

  // === PAGE 5: BUILDING SPECS ===
  y = startInteriorPage(doc, 'BUILDING SPECIFICATIONS', theme, company, logoBase64);

  const specs = buildSpecs(property);
  if (specs.length > 0) {
    y = drawSpecsTable(doc, specs, y, theme);
  }

  // === PAGE 6: FINANCIAL ANALYSIS (if data available) ===
  if (transaction && (transaction.sale_price || transaction.asking_price || transaction.noi)) {
    y = startInteriorPage(doc, 'FINANCIAL ANALYSIS', theme, company, logoBase64);

    const finData: [string, string][] = [];
    if (transaction.asking_price) finData.push(['Asking Price', fmt$(transaction.asking_price)]);
    if (transaction.sale_price) finData.push(['Sale Price', fmt$(transaction.sale_price)]);
    if (transaction.price_per_sf) finData.push(['Price Per SF', fmt$(transaction.price_per_sf)]);
    if (transaction.noi) finData.push(['Net Operating Income (NOI)', fmt$(transaction.noi)]);
    if (transaction.cap_rate) finData.push(['Capitalization Rate', `${transaction.cap_rate}%`]);

    if (finData.length > 0) {
      y = drawFinancialTable(doc, finData, y, theme);
    }
  }

  // === PAGE 7: LOCATION ANALYSIS ===
  if (content.location_analysis) {
    y = startInteriorPage(doc, 'LOCATION ANALYSIS', theme, company, logoBase64);
    y = drawParagraph(doc, content.location_analysis, y, theme);
  }

  // === PAGE 8: CONFIDENTIALITY NOTICE ===
  y = startInteriorPage(doc, 'CONFIDENTIALITY NOTICE', theme, company, logoBase64);

  const confidText = `This Offering Memorandum has been prepared by ${company} for the exclusive use of authorized prospective purchasers. This document is confidential and proprietary and is not to be reproduced, distributed, or shared with any third party without the prior written consent of ${company}.

The information contained herein has been obtained from sources believed to be reliable but has not been independently verified. No representation, warranty, or guarantee of any kind is made regarding the accuracy or completeness of the information contained herein. Prospective purchasers are encouraged to conduct their own independent investigation and due diligence.

${company} and its affiliates, agents, and representatives make no representations or warranties, express or implied, regarding the condition of the property or the accuracy of the information contained in this Offering Memorandum. The owner reserves the right to withdraw the property from the market, change the terms of sale, or reject any offer without notice.

By accepting this Offering Memorandum, you agree to maintain the confidentiality of the information contained herein and to return it upon request.`;

  y = drawParagraph(doc, confidText, y, theme, 9);

  // === LAST PAGE: CONTACT ===
  drawContactPage(doc, options, theme);

  // Footers
  drawAllFooters(doc, company, theme);

  return doc;
}

// ============================================================================
// PROPOSAL TEMPLATE (4-6 pages)
// ============================================================================

export function generateProposalPDF(options: GeneratorOptions): jsPDF {
  const { property, transaction, content, companyName, companyAddress, logoBase64 } = options;
  const doc = new jsPDF('p', 'mm', 'a4');
  const theme = getTheme(options);
  const company = companyName || 'Apex Real Estate Services';

  // === PAGE 1: COVER ===
  // Proposal cover uses a left-bar accent design (different from brochure/OM)
  doc.setFillColor(...theme.white);
  doc.rect(0, 0, PW, PH, 'F');

  // Left accent bars
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, 10, PH, 'F');
  doc.setFillColor(...theme.accent);
  doc.rect(10, 0, 3, PH, 'F');

  let y = 60;

  // "INVESTMENT PROPOSAL"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...theme.accent);
  doc.text('INVESTMENT PROPOSAL', MARGIN + 12, y);
  y += 15;

  // Property name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...theme.dark);
  const propTitle = property.property_name || property.address || 'Property';
  const titleLines = doc.splitTextToSize(propTitle, PW - MARGIN - 24);
  for (const line of titleLines) {
    doc.text(line, MARGIN + 12, y);
    y += 13;
  }

  // Address
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...theme.medium);
  doc.text(buildAddress(property), MARGIN + 12, y);
  y += 16;

  // Type badge
  const typeLabel = (property.property_subtype || property.property_type || 'commercial').replace(/_/g, ' ').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(typeLabel) + 16;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(MARGIN + 12, y - 4, badgeW, 10, 2, 2, 'F');
  doc.setTextColor(...theme.accent);
  doc.text(typeLabel, MARGIN + 20, y + 2);

  // Prepared by (bottom of cover)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...theme.medium);
  doc.text('Prepared by', MARGIN + 12, PH - 65);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...theme.dark);
  doc.text(company, MARGIN + 12, PH - 55);
  if (companyAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...theme.medium);
    doc.text(companyAddress, MARGIN + 12, PH - 47);
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...theme.medium);
  doc.text(today, MARGIN + 12, PH - 35);

  // === PAGE 2: WHY [COMPANY] ===
  if (content.team_intro) {
    y = startInteriorPage(doc, `WHY ${company.toUpperCase()}`, theme, company, logoBase64);
    y = drawParagraph(doc, content.team_intro, y, theme, 10);
  }

  // === PAGE 3: MARKET ANALYSIS ===
  if (content.market_analysis) {
    y = startInteriorPage(doc, 'MARKET ANALYSIS', theme, company, logoBase64);
    y = drawParagraph(doc, content.market_analysis, y, theme, 10);
  }

  // === PAGE 4: PROPERTY RECOMMENDATION ===
  y = startInteriorPage(doc, 'PROPERTY RECOMMENDATION', theme, company, logoBase64);

  // Property header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...theme.dark);
  doc.text(property.property_name || property.address || 'Property', LEFT, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...theme.medium);
  doc.text(buildAddress(property), LEFT, y);
  y += 10;

  // Metrics
  const metrics = buildMetrics(property, transaction);
  if (metrics.length > 0) {
    y = drawMetricsCards(doc, metrics.slice(0, 4), y, theme);
  }

  // Description
  if (content.property_description) {
    y = drawSectionTitle(doc, 'Property Overview', y, theme);
    y = drawParagraph(doc, content.property_description, y, theme);
  }

  // Highlights
  const highlights = parseHighlights(content.property_highlights);
  if (highlights.length > 0) {
    y = drawSectionTitle(doc, 'Key Highlights', y, theme);
    y = drawBulletList(doc, highlights, y, theme);
  }

  // === NEXT STEPS ===
  y = pageBreak(doc, y, 60, theme);
  y = drawSectionBar(doc, 'Next Steps', y, theme);

  const steps = [
    'Schedule a property tour at your convenience',
    'Review property due diligence materials',
    'Discuss financing options and deal structure',
    'Submit Letter of Intent',
  ];

  steps.forEach((step, i) => {
    y = pageBreak(doc, y, 12, theme);

    // Step number circle
    doc.setFillColor(...theme.accent);
    doc.circle(LEFT + 4, y - 1, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...theme.white);
    doc.text(String(i + 1), LEFT + 4, y + 0.5, { align: 'center' });

    // Step text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...theme.dark);
    doc.text(step, LEFT + 14, y);
    y += 10;
  });

  // === LAST PAGE: CONTACT ===
  drawContactPage(doc, options, theme);

  // Footers
  drawAllFooters(doc, company, theme);

  return doc;
}
