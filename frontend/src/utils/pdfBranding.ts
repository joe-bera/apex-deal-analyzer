import jsPDF from 'jspdf';

export interface CompanyBranding {
  company_name?: string;
  company_logo_url?: string;
  company_phone?: string;
  company_email?: string;
  company_address?: string;
}

const DEFAULT_COMPANY = 'APEX REAL ESTATE';
const DEFAULT_TAGLINE = 'Commercial Real Estate Services';

/**
 * Fetch an image URL and convert to base64 data URL for jsPDF embedding.
 * Returns null if the fetch fails.
 */
export async function loadLogoImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Render a branded header at the top of the PDF.
 * Returns the Y position after the header.
 */
export function renderBrandedHeader(
  doc: jsPDF,
  branding?: CompanyBranding,
  logoBase64?: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const headerHeight = 35;

  // Red header bar (Apex/KW brand #B21F24)
  doc.setFillColor(178, 31, 36);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  let textX = margin;

  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'AUTO', margin, 5, 25, 25);
      textX = margin + 30;
    } catch {
      // Logo failed, just use text
    }
  }

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(branding?.company_name || DEFAULT_COMPANY, textX, 15);

  // Contact line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const contactParts = [
    branding?.company_phone,
    branding?.company_email,
  ].filter(Boolean);
  const contactLine = contactParts.length > 0
    ? contactParts.join(' | ')
    : DEFAULT_TAGLINE;
  doc.text(contactLine, textX, 23);

  // Date
  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    textX,
    30
  );

  return headerHeight + 10;
}

/**
 * Render branded footer on all pages.
 */
export function renderBrandedFooter(doc: jsPDF, branding?: CompanyBranding): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const pageCount = doc.getNumberOfPages();

  const footerText = branding?.company_name
    ? `${branding.company_name} | Confidential`
    : 'Apex Real Estate Services | Confidential';

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(243, 244, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, 285, pageWidth - margin, 285);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(footerText, margin, 291);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 291, { align: 'right' });
  }
}
