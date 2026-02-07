import jsPDF from 'jspdf';
import autoTable, { FontStyle } from 'jspdf-autotable';
import type { Property, Comp, ValuationResult, LOI } from '../types';
import type { DealAnalysisData } from '../components/DealAnalysisWorksheet';
import {
  calculateVacancyAmount,
  calculateEffectiveGrossIncome,
  calculateManagementFee,
  calculateTotalExpenses,
  calculateNOI,
  calculateCapRate,
  calculateLoanAmount,
  calculateDownPayment,
  calculateMonthlyPayment,
  calculateAnnualDebtService,
  calculateDSCR,
  calculateClosingCosts,
  calculateTotalCashRequired,
  calculateBeforeTaxCashFlow,
  calculateCashOnCash,
} from './financialCalculations';
import {
  CompanyBranding,
  renderBrandedHeader,
  renderBrandedFooter,
} from './pdfBranding';

interface ExportOptions {
  property: Property;
  analysis?: DealAnalysisData;
  comps?: Comp[];
  branding?: CompanyBranding;
  logoBase64?: string | null;
}

const COLORS = {
  primary: [0, 102, 204] as [number, number, number],
  dark: [31, 41, 55] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [243, 244, 246] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
};

const formatCurrency = (value?: number | null): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value?: number | null): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';
  return `${value.toFixed(2)}%`;
};

const formatNumber = (value?: number | null): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export function generateDealAnalysisPDF(options: ExportOptions): void {
  const { property, analysis, comps, branding, logoBase64 } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // ========== BRANDED HEADER ==========
  let yPos = renderBrandedHeader(doc, branding, logoBase64);

  // ========== PROPERTY SUMMARY ==========
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPERTY SUMMARY', margin, yPos);
  yPos += 3;

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // Property Address
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(property.address || 'Address Not Available', margin, yPos);
  yPos += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(`${property.city || ''}, ${property.state || ''} ${property.zip_code || ''}`, margin, yPos);
  yPos += 8;

  // Property Metrics Table
  const propertyMetrics = [
    ['List Price', formatCurrency(property.price), 'Property Type', (property.property_type?.replace(/_/g, ' ') || 'N/A').toUpperCase()],
    ['Building Size', property.building_size ? `${formatNumber(property.building_size)} SF` : 'N/A', 'Year Built', property.year_built?.toString() || 'N/A'],
    ['Price/SF', property.price_per_sqft ? `$${property.price_per_sqft.toFixed(2)}` : 'N/A', 'CAP Rate', property.cap_rate ? `${property.cap_rate}%` : 'N/A'],
  ];

  autoTable(doc, {
    startY: yPos,
    body: propertyMetrics,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: COLORS.gray, cellWidth: 35 },
      1: { textColor: COLORS.dark, cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: COLORS.gray, cellWidth: 35 },
      3: { textColor: COLORS.dark, cellWidth: 55 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ========== FINANCIAL ANALYSIS ==========
  if (analysis) {
    // Calculate all values
    const vacancyAmount = calculateVacancyAmount(analysis.potential_gross_income, analysis.vacancy_rate);
    const egi = calculateEffectiveGrossIncome(analysis.potential_gross_income, vacancyAmount, analysis.other_income);
    const managementFee = calculateManagementFee(egi, analysis.management_fee_percent);
    const totalExpenses = calculateTotalExpenses({
      propertyTaxes: analysis.property_taxes,
      insurance: analysis.insurance,
      utilities: analysis.utilities,
      managementFee,
      repairsMaintenance: analysis.repairs_maintenance,
      reservesCapex: analysis.reserves_capex,
      otherExpenses: analysis.other_expenses,
    });
    const noi = calculateNOI(egi, totalExpenses);
    const capRate = calculateCapRate(noi, analysis.purchase_price);
    const loanAmount = calculateLoanAmount(analysis.purchase_price, analysis.ltv_percent);
    const downPayment = calculateDownPayment(analysis.purchase_price, loanAmount);
    const monthlyPayment = calculateMonthlyPayment(loanAmount, analysis.interest_rate, analysis.amortization_years);
    const annualDebtService = calculateAnnualDebtService(monthlyPayment);
    const dscr = calculateDSCR(noi, annualDebtService);
    const closingCosts = calculateClosingCosts(analysis.purchase_price, analysis.closing_costs_percent);
    const totalCashRequired = calculateTotalCashRequired(downPayment, closingCosts);
    const btcf = calculateBeforeTaxCashFlow(noi, annualDebtService);
    const coc = calculateCashOnCash(btcf, totalCashRequired);

    // Section Header
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INCOME & EXPENSE ANALYSIS', margin, yPos);
    yPos += 3;

    doc.setDrawColor(...COLORS.primary);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Combined Income & Expense Table
    const boldStyle: FontStyle = 'bold';
    const proformaData = [
      [{ content: 'INCOME', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
      ['Potential Gross Income (PGI)', formatCurrency(analysis.potential_gross_income)],
      [`Less: Vacancy & Credit Loss (${analysis.vacancy_rate}%)`, `(${formatCurrency(vacancyAmount)})`],
      ['Plus: Other Income', formatCurrency(analysis.other_income)],
      [{ content: 'Effective Gross Income (EGI)', styles: { fontStyle: boldStyle } }, { content: formatCurrency(egi), styles: { fontStyle: boldStyle } }],
      [{ content: 'OPERATING EXPENSES', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
      ['Property Taxes', formatCurrency(analysis.property_taxes)],
      ['Insurance', formatCurrency(analysis.insurance)],
      ['Utilities', formatCurrency(analysis.utilities)],
      [`Management Fee (${analysis.management_fee_percent}%)`, formatCurrency(managementFee)],
      ['Repairs & Maintenance', formatCurrency(analysis.repairs_maintenance)],
      ['Reserves / CapEx', formatCurrency(analysis.reserves_capex)],
      ['Other Expenses', formatCurrency(analysis.other_expenses)],
      [{ content: 'Total Operating Expenses', styles: { fontStyle: boldStyle } }, { content: formatCurrency(totalExpenses), styles: { fontStyle: boldStyle } }],
      [{ content: 'NET OPERATING INCOME (NOI)', styles: { fontStyle: boldStyle, fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number] } }, { content: formatCurrency(noi), styles: { fontStyle: boldStyle, fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number] } }],
    ];

    autoTable(doc, {
      startY: yPos,
      body: proformaData,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65 },
        1: { cellWidth: contentWidth * 0.35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    // Check for new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    // ========== FINANCING SECTION ==========
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCING & RETURNS', margin, yPos);
    yPos += 3;

    doc.setDrawColor(...COLORS.primary);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    const financingData = [
      [{ content: 'INVESTMENT SUMMARY', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
      ['Purchase Price', formatCurrency(analysis.purchase_price)],
      [`Loan Amount (${analysis.ltv_percent}% LTV)`, formatCurrency(loanAmount)],
      ['Down Payment', formatCurrency(downPayment)],
      [`Closing Costs (${analysis.closing_costs_percent}%)`, formatCurrency(closingCosts)],
      [{ content: 'Total Cash Required', styles: { fontStyle: boldStyle } }, { content: formatCurrency(totalCashRequired), styles: { fontStyle: boldStyle } }],
      [{ content: 'DEBT SERVICE', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
      ['Interest Rate', `${analysis.interest_rate}%`],
      ['Amortization Period', `${analysis.amortization_years} years`],
      ['Monthly Payment', formatCurrency(monthlyPayment)],
      [{ content: 'Annual Debt Service', styles: { fontStyle: boldStyle } }, { content: formatCurrency(annualDebtService), styles: { fontStyle: boldStyle } }],
    ];

    autoTable(doc, {
      startY: yPos,
      body: financingData,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65 },
        1: { cellWidth: contentWidth * 0.35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Returns Summary Box
    const dscrColor = dscr >= 1.5 ? COLORS.success : dscr >= 1.25 ? COLORS.warning : COLORS.danger;
    const cocColor = coc >= 8 ? COLORS.success : coc >= 5 ? COLORS.warning : COLORS.danger;

    const returnsData = [
      [
        { content: 'Before-Tax Cash Flow', styles: { fontStyle: boldStyle } },
        { content: formatCurrency(btcf), styles: { fontStyle: boldStyle } },
      ],
      [
        { content: 'Cash-on-Cash Return', styles: { fontStyle: boldStyle } },
        { content: formatPercent(coc), styles: { fontStyle: boldStyle, textColor: cocColor } },
      ],
      [
        { content: 'Debt Service Coverage Ratio (DSCR)', styles: { fontStyle: boldStyle } },
        { content: `${dscr.toFixed(2)}x`, styles: { fontStyle: boldStyle, textColor: dscrColor } },
      ],
      [
        { content: 'CAP Rate (Based on Analysis)', styles: { fontStyle: boldStyle } },
        { content: formatPercent(capRate), styles: { fontStyle: boldStyle } },
      ],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [[{ content: 'KEY RETURNS', colSpan: 2, styles: { fillColor: COLORS.dark, textColor: [255, 255, 255] as [number, number, number] } }]],
      body: returnsData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65 },
        1: { cellWidth: contentWidth * 0.35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // ========== COMPARABLE SALES ==========
  if (comps && comps.length > 0) {
    // Check for new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPARABLE SALES', margin, yPos);
    yPos += 3;

    doc.setDrawColor(...COLORS.primary);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    const compTableData = comps.map((comp) => [
      comp.comp_address || 'N/A',
      comp.comp_city || 'N/A',
      formatCurrency(comp.comp_sale_price),
      comp.comp_square_footage ? `${formatNumber(comp.comp_square_footage)}` : 'N/A',
      comp.comp_price_per_sqft ? `$${comp.comp_price_per_sqft.toFixed(0)}` : 'N/A',
      comp.comp_sale_date ? new Date(comp.comp_sale_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : 'N/A',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Address', 'City', 'Price', 'SF', '$/SF', 'Date']],
      body: compTableData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: 'bold' as FontStyle },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'ellipsize' },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 30 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ========== BRANDED FOOTER ==========
  renderBrandedFooter(doc, branding);

  // Save the PDF
  const fileName = `Deal_Analysis_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// ============================================================================
// Executive Summary PDF
// ============================================================================

interface ExecSummaryOptions {
  property: Property;
  valuation: ValuationResult;
  branding?: CompanyBranding;
  logoBase64?: string | null;
}

export function generateExecutiveSummaryPDF(options: ExecSummaryOptions): void {
  const { property, valuation, branding, logoBase64 } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // Header
  let yPos = renderBrandedHeader(doc, branding, logoBase64);

  // Title
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE SUMMARY', margin, yPos);
  yPos += 3;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Property headline
  doc.setFontSize(13);
  doc.text(property.address || 'Property Address', margin, yPos);
  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(`${property.city || ''}, ${property.state || ''} ${property.zip_code || ''}`, margin, yPos);
  yPos += 10;

  // Key metrics table
  const metricsData = [
    ['Estimated Value', formatCurrency(valuation.estimated_value)],
    ['Value Range', `${formatCurrency(valuation.value_range?.low)} - ${formatCurrency(valuation.value_range?.high)}`],
    ['Confidence', valuation.confidence_level],
    ['Building Size', property.building_size ? `${formatNumber(property.building_size)} SF` : 'N/A'],
    ['List Price', formatCurrency(property.price)],
    ['CAP Rate', property.cap_rate ? `${property.cap_rate}%` : 'N/A'],
  ];

  autoTable(doc, {
    startY: yPos,
    body: metricsData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: COLORS.gray, cellWidth: contentWidth * 0.4 },
      1: { textColor: COLORS.dark, cellWidth: contentWidth * 0.6 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Executive summary narrative
  if (valuation.executive_summary) {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(valuation.executive_summary, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 8;
  }

  // Pricing scenarios
  if (valuation.pricing_scenarios) {
    if (yPos > 200) { doc.addPage(); yPos = 20; }

    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Pricing Scenarios', margin, yPos);
    yPos += 6;

    const scenarios = valuation.pricing_scenarios;
    const scenarioData = [
      ['Quick Sale', formatCurrency(scenarios.quick_sale.price), `$${scenarios.quick_sale.price_per_sqft}/SF`, scenarios.quick_sale.timeline],
      ['Market Sale', formatCurrency(scenarios.market_sale.price), `$${scenarios.market_sale.price_per_sqft}/SF`, scenarios.market_sale.timeline],
      ['Premium Sale', formatCurrency(scenarios.premium_sale.price), `$${scenarios.premium_sale.price_per_sqft}/SF`, scenarios.premium_sale.timeline],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Scenario', 'Price', 'Price/SF', 'Timeline']],
      body: scenarioData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, fontStyle: 'bold' as FontStyle },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Key findings
  if (valuation.key_findings && valuation.key_findings.length > 0) {
    if (yPos > 230) { doc.addPage(); yPos = 20; }

    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Findings', margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    valuation.key_findings.forEach((finding, i) => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      const lines = doc.splitTextToSize(`${i + 1}. ${finding}`, contentWidth - 5);
      doc.text(lines, margin + 2, yPos);
      yPos += lines.length * 4.5 + 3;
    });
  }

  // Footer
  renderBrandedFooter(doc, branding);

  const fileName = `Executive_Summary_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// ============================================================================
// LOI PDF
// ============================================================================

interface LOIPDFOptions {
  property: Property;
  loi: LOI;
  branding?: CompanyBranding;
  logoBase64?: string | null;
}

export function generateLOIPDF(options: LOIPDFOptions): void {
  const { property, loi, branding, logoBase64 } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // Header
  let yPos = renderBrandedHeader(doc, branding, logoBase64);

  // Title
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const title = 'LETTER OF INTENT';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  yPos += 4;

  // Separator
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(margin + 40, yPos, pageWidth - margin - 40, yPos);
  yPos += 10;

  // Property reference
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(`Re: ${property.address || 'Property'}, ${property.city || ''}, ${property.state || ''} ${property.zip_code || ''}`, margin, yPos);
  yPos += 8;

  // LOI body text
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const loiText = loi.loi_text || '';
  const lines = doc.splitTextToSize(loiText, contentWidth);

  for (const line of lines) {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, margin, yPos);
    yPos += 5;
  }

  // Signature blocks
  yPos += 10;
  if (yPos > 240) { doc.addPage(); yPos = 20; }

  doc.setLineWidth(0.5);
  doc.setDrawColor(...COLORS.dark);

  // Buyer signature
  doc.line(margin, yPos + 15, margin + 70, yPos + 15);
  doc.setFontSize(9);
  doc.text(loi.buyer_name || 'Buyer', margin, yPos + 20);
  if (loi.buyer_company) {
    doc.text(loi.buyer_company, margin, yPos + 25);
  }

  // Seller signature
  doc.line(pageWidth - margin - 70, yPos + 15, pageWidth - margin, yPos + 15);
  doc.text('Seller / Authorized Representative', pageWidth - margin - 70, yPos + 20);

  // Date
  yPos += 35;
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPos);

  // Footer
  renderBrandedFooter(doc, branding);

  const fileName = `LOI_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
