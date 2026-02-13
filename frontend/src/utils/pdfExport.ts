import jsPDF from 'jspdf';
import autoTable, { FontStyle } from 'jspdf-autotable';
import type { Property, Comp, ValuationResult, LOI, DealAnalysis } from '../types';
import type { DealAnalysisData } from '../components/DealAnalysisWorksheet';
import {
  calculateVacancyAmount,
  calculateEffectiveGrossIncome,
  calculateManagementFee,
  calculateTotalExpenses,
  calculateNOI,
  calculateCapRate,
  calculatePricePerSqft,
  calculateLoanAmount,
  calculateDownPayment,
  calculateMonthlyPayment,
  calculateAnnualDebtService,
  calculateDSCR,
  calculateClosingCosts,
  calculateTotalCashRequired,
  calculateBeforeTaxCashFlow,
  calculateCashOnCash,
  calculateSaleProceeds,
  calculateIRR,
  calculateEquityMultiple,
  calculateAvgCashOnCash,
  buildIRRCashFlows,
  generateProjections,
  STRATEGY_THRESHOLDS,
  solveMaxPurchasePrice,
  solveRequiredNOILift,
  solveRequiredRentPSF,
  solveCapexCeiling,
  solveTargetExitCap,
  calculateNNNReimbursements,
  calculateAdjustedDownPayment,
} from './financialCalculations';
import type { InvestmentStrategy } from './financialCalculations';
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
  primary: [178, 31, 36] as [number, number, number],
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

export function generateValuationSummaryPDF(options: ExecSummaryOptions): void {
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
  doc.text('VALUATION SUMMARY', margin, yPos);
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

  const fileName = `Valuation_Summary_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
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

// ============================================================================
// Investment Analysis PDF
// ============================================================================

interface InvestmentAnalysisPDFOptions {
  property: Property;
  data: Partial<DealAnalysis>;
  comps?: Comp[];
  branding?: CompanyBranding;
  logoBase64?: string | null;
  photoBase64?: string | null;
}

export function generateInvestmentAnalysisPDF(options: InvestmentAnalysisPDFOptions): void {
  const { property, data, branding, logoBase64, photoBase64 } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);
  const boldStyle: FontStyle = 'bold';

  const n = (v: number | null | undefined) => v ?? 0;

  // ── Derived calculations (mirrors InvestmentAnalysis.tsx) ──
  const strategy = (data.investment_strategy ?? 'value_add') as InvestmentStrategy;
  const thresholds = STRATEGY_THRESHOLDS[strategy];

  // Lease type & NNN reimbursements
  const leaseType = data.lease_type ?? 'gross';
  const nnnReimbursements = leaseType === 'nnn'
    ? calculateNNNReimbursements(
        n(data.property_taxes),
        n(data.insurance),
        n(data.repairs_maintenance),
        n(data.nnn_reimbursement_rate)
      )
    : leaseType === 'modified_gross'
      ? n(data.modified_gross_reimbursement)
      : 0;

  const pgi = n(data.potential_gross_income);
  const vacancyAmount = calculateVacancyAmount(pgi, n(data.vacancy_rate));
  const egi = calculateEffectiveGrossIncome(pgi, vacancyAmount, n(data.other_income) + nnnReimbursements);
  const managementFee = calculateManagementFee(egi, n(data.management_fee_percent));
  const totalExpenses = calculateTotalExpenses({
    propertyTaxes: n(data.property_taxes),
    insurance: n(data.insurance),
    utilities: n(data.utilities),
    managementFee,
    repairsMaintenance: n(data.repairs_maintenance),
    reservesCapex: n(data.reserves_capex),
    otherExpenses: n(data.other_expenses),
  });
  const noi = calculateNOI(egi, totalExpenses);

  const purchasePrice = n(data.purchase_price);
  const loanAmount = calculateLoanAmount(purchasePrice, n(data.ltv_percent));

  // Seller carryback
  const sellerCarrybackAmt = n(data.seller_carryback_amount);
  const sellerCarrybackRate = n(data.seller_carryback_rate);
  const sellerCarrybackTerm = n(data.seller_carryback_term) || 5;
  const sellerMonthlyPmt = sellerCarrybackAmt > 0
    ? calculateMonthlyPayment(sellerCarrybackAmt, sellerCarrybackRate, sellerCarrybackTerm)
    : 0;
  const sellerAnnualDS = sellerMonthlyPmt * 12;

  const downPayment = calculateAdjustedDownPayment(purchasePrice, loanAmount, sellerCarrybackAmt);
  const monthlyPmt = calculateMonthlyPayment(loanAmount, n(data.interest_rate), n(data.amortization_years));
  const bankAnnualDS = calculateAnnualDebtService(monthlyPmt);
  const annualDS = bankAnnualDS + sellerAnnualDS;
  const closingCosts = calculateClosingCosts(purchasePrice, n(data.closing_costs_percent));
  const totalCashRequired = calculateTotalCashRequired(downPayment, closingCosts);
  const beforeTaxCF = calculateBeforeTaxCashFlow(noi, annualDS);
  const capRate = calculateCapRate(noi, purchasePrice);
  const pricePerSqft = calculatePricePerSqft(purchasePrice, property.building_size || 0);
  const dscr = calculateDSCR(noi, annualDS);

  const vaTotalCost = n(data.va_capex) + n(data.va_ti_leasing) + n(data.va_carry_costs) + n(data.va_contingency);
  const totalProjectCost = purchasePrice + closingCosts + vaTotalCost;
  const holdingPeriod = n(data.holding_period) || 5;
  const exitCapRate = n(data.exit_cap_rate) || 6;
  const sellingCostsPercent = n(data.selling_costs_percent) || 2;

  const projections = generateProjections({
    initialIncome: egi,
    initialExpenses: totalExpenses,
    incomeGrowthRate: n(data.income_growth_rate),
    expenseGrowthRate: n(data.expense_growth_rate),
    purchasePrice,
    loanAmount,
    interestRate: n(data.interest_rate),
    amortizationYears: n(data.amortization_years),
    holdingPeriod,
    exitCapRate,
    sellingCosts: sellingCostsPercent,
    additionalAnnualDebtService: sellerAnnualDS,
  });

  const lastYear = projections.length > 0 ? projections[projections.length - 1] : null;
  const exitNOI = lastYear?.noi ?? noi;
  const saleProceeds = calculateSaleProceeds(exitNOI, exitCapRate, lastYear?.loanBalance ?? loanAmount, sellingCostsPercent);
  const totalCashInvested = totalCashRequired + vaTotalCost;
  const irrCashFlows = buildIRRCashFlows(totalCashInvested, projections, saleProceeds.netToSeller);
  const irrValue = calculateIRR(irrCashFlows);
  const totalCashFlowsSum = projections.reduce((s, p) => s + p.cashFlow, 0);
  const equityMultiple = calculateEquityMultiple(totalCashInvested, totalCashFlowsSum, saleProceeds.netToSeller);
  const avgCashOnCash = calculateAvgCashOnCash(projections, totalCashInvested);

  // Value-Add
  const sqft = property.building_size || 0;
  const stabilizedIncome = sqft * n(data.stabilized_rent_psf) * (n(data.stabilized_occupancy) / 100) + n(data.stabilized_other_income);
  const asIsIncome = sqft * n(data.as_is_rent_psf) * (n(data.as_is_occupancy) / 100) + n(data.as_is_other_income);
  const stabilizedExpenses = stabilizedIncome * (n(data.stabilized_expense_ratio) / 100);
  const asIsExpenses = asIsIncome * (n(data.as_is_expense_ratio) / 100);
  const stabilizedNOI = stabilizedIncome - stabilizedExpenses;
  const asIsNOI = asIsIncome - asIsExpenses;
  const noiLift = stabilizedNOI - asIsNOI;

  // Decision
  const decisionMetrics = [
    { label: 'Going-In Cap Rate', actual: capRate, required: thresholds.cap_rate, format: 'percent' as const, pass: thresholds.cap_rate === null || capRate >= (thresholds.cap_rate ?? 0) },
    { label: 'Avg Cash-on-Cash', actual: avgCashOnCash, required: thresholds.cash_on_cash, format: 'percent' as const, pass: avgCashOnCash >= thresholds.cash_on_cash },
    { label: 'IRR', actual: irrValue, required: thresholds.irr, format: 'percent' as const, pass: irrValue >= thresholds.irr },
    { label: 'Equity Multiple', actual: equityMultiple, required: thresholds.equity_multiple, format: 'ratio' as const, pass: equityMultiple >= thresholds.equity_multiple },
    { label: 'DSCR', actual: dscr, required: thresholds.dscr, format: 'ratio' as const, pass: dscr >= thresholds.dscr },
  ];
  const passCount = decisionMetrics.filter(m => m.pass).length;
  const verdict: 'GO' | 'NO-GO' | 'REVIEW' = passCount === decisionMetrics.length ? 'GO' : passCount >= 3 ? 'REVIEW' : 'NO-GO';

  // Helper to add section headers
  const sectionHeader = (title: string, yPos: number): number => {
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 3;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.8);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    return yPos + 5;
  };

  const fmtMetric = (val: number, format: 'percent' | 'ratio' | 'currency') => {
    if (format === 'percent') return formatPercent(val);
    if (format === 'ratio') return `${val.toFixed(2)}x`;
    return formatCurrency(val);
  };

  // ══════════════════════════════════════════════════════════════
  // PAGE 1: Cover + Deal Summary + Verdict
  // ══════════════════════════════════════════════════════════════

  let yPos = renderBrandedHeader(doc, branding, logoBase64);

  // Title
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('INVESTMENT ANALYSIS', margin, yPos);
  yPos += 3;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Property info
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(property.address || 'Address Not Available', margin, yPos);
  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  const locationLine = [property.city, property.state, property.zip_code].filter(Boolean).join(', ');
  const typeLine = [property.property_type?.replace(/_/g, ' ').toUpperCase(), sqft ? `${formatNumber(sqft)} SF` : null].filter(Boolean).join(' | ');
  doc.text(locationLine, margin, yPos);
  yPos += 4;
  doc.text(typeLine, margin, yPos);
  yPos += 8;

  // Verdict badge row
  const verdictColor = verdict === 'GO' ? COLORS.success : verdict === 'REVIEW' ? COLORS.warning : COLORS.danger;
  const strategyLabel = strategy === 'core' ? 'Core' : strategy === 'value_add' ? 'Value-Add' : 'Opportunistic';
  doc.setFillColor(...verdictColor);
  doc.roundedRect(margin, yPos - 4, 50, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(verdict, margin + 25, yPos + 5, { align: 'center' });

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${strategyLabel} Strategy | ${passCount}/${decisionMetrics.length} metrics pass`, margin + 55, yPos + 4);
  yPos += 18;

  // Exterior photo — full-width hero image
  if (photoBase64) {
    try {
      const photoHeight = 70;
      // Dark border/frame around photo
      doc.setDrawColor(...COLORS.dark);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPos, contentWidth, photoHeight);
      doc.addImage(photoBase64, 'AUTO', margin, yPos, contentWidth, photoHeight);
      yPos += photoHeight + 6;
    } catch {
      // Photo failed, continue without it
    }
  }

  // Key Metrics cards row
  const metricCards = [
    { label: 'Purchase Price', value: formatCurrency(purchasePrice) },
    { label: 'Total Project Cost', value: formatCurrency(totalProjectCost) },
    { label: 'Year 1 NOI', value: formatCurrency(noi) },
    { label: 'Going-In Cap', value: formatPercent(capRate) },
    { label: 'IRR', value: formatPercent(irrValue) },
  ];
  const cardWidth = contentWidth / metricCards.length;
  metricCards.forEach((card, i) => {
    const cx = margin + i * cardWidth;
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(cx + 1, yPos, cardWidth - 2, 18, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(card.label.toUpperCase(), cx + cardWidth / 2, yPos + 5, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, cx + cardWidth / 2, yPos + 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });
  yPos += 25;

  // ── Income & Expense Summary ──
  yPos = sectionHeader('INCOME & EXPENSE SUMMARY', yPos);

  const leaseLabel = leaseType === 'nnn' ? ' (NNN)' : leaseType === 'modified_gross' ? ' (Modified Gross)' : '';
  const incExpData: any[] = [
    [{ content: `INCOME${leaseLabel}`, colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
    ['Potential Gross Income (PGI)', formatCurrency(pgi)],
    [`Less: Vacancy (${n(data.vacancy_rate)}%)`, `(${formatCurrency(vacancyAmount)})`],
    ['Plus: Other Income', formatCurrency(n(data.other_income))],
  ];
  if (nnnReimbursements > 0) {
    incExpData.push(['Plus: Expense Reimbursements', formatCurrency(nnnReimbursements)]);
  }
  incExpData.push(
    [{ content: 'Effective Gross Income (EGI)', styles: { fontStyle: boldStyle } }, { content: formatCurrency(egi), styles: { fontStyle: boldStyle } }],
    [{ content: 'OPERATING EXPENSES', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
    ['Property Taxes', formatCurrency(n(data.property_taxes))],
    ['Insurance', formatCurrency(n(data.insurance))],
    ['Utilities', formatCurrency(n(data.utilities))],
    [`Management Fee (${n(data.management_fee_percent)}%)`, formatCurrency(managementFee)],
    ['Repairs & Maintenance', formatCurrency(n(data.repairs_maintenance))],
    ['Reserves / CapEx', formatCurrency(n(data.reserves_capex))],
    ['Other Expenses', formatCurrency(n(data.other_expenses))],
    [{ content: 'Total Operating Expenses', styles: { fontStyle: boldStyle } }, { content: formatCurrency(totalExpenses), styles: { fontStyle: boldStyle } }],
    [{ content: 'NET OPERATING INCOME (NOI)', styles: { fontStyle: boldStyle, fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number] } }, { content: formatCurrency(noi), styles: { fontStyle: boldStyle, fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number] } }],
  );

  autoTable(doc, {
    startY: yPos,
    body: incExpData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.65 },
      1: { cellWidth: contentWidth * 0.35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ── Financing ──
  yPos = sectionHeader('FINANCING & CASH REQUIRED', yPos);

  const financingData: any[] = [
    [{ content: 'INVESTMENT SUMMARY', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
    ['Purchase Price', formatCurrency(purchasePrice)],
    [`Bank Loan (${n(data.ltv_percent)}% LTV)`, formatCurrency(loanAmount)],
  ];
  if (sellerCarrybackAmt > 0) {
    financingData.push(['Seller Carryback', formatCurrency(sellerCarrybackAmt)]);
  }
  financingData.push(
    ['Down Payment', formatCurrency(downPayment)],
    [`Closing Costs (${n(data.closing_costs_percent)}%)`, formatCurrency(closingCosts)],
    ['Value-Add Costs', formatCurrency(vaTotalCost)],
    [{ content: 'Total Cash Required', styles: { fontStyle: boldStyle } }, { content: formatCurrency(totalCashInvested), styles: { fontStyle: boldStyle } }],
    [{ content: 'PRIMARY LOAN', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
    ['Interest Rate', `${n(data.interest_rate)}%`],
    ['Amortization', `${n(data.amortization_years)} years`],
    ['Monthly Payment', formatCurrency(monthlyPmt)],
    ['Bank Annual DS', formatCurrency(bankAnnualDS)],
  );
  if (sellerCarrybackAmt > 0) {
    financingData.push(
      [{ content: 'SELLER CARRYBACK', colSpan: 2, styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
      ['Carryback Amount', formatCurrency(sellerCarrybackAmt)],
      ['Interest Rate', `${sellerCarrybackRate}%`],
      ['Term', `${sellerCarrybackTerm} years`],
      ['Monthly Payment', formatCurrency(sellerMonthlyPmt)],
      ['Seller Annual DS', formatCurrency(sellerAnnualDS)],
    );
  }
  financingData.push(
    [{ content: 'Total Monthly Debt Service', styles: { fontStyle: boldStyle } }, { content: formatCurrency(annualDS / 12), styles: { fontStyle: boldStyle } }],
    [{ content: 'Total Annual Debt Service', styles: { fontStyle: boldStyle } }, { content: formatCurrency(annualDS), styles: { fontStyle: boldStyle } }],
    ['Before-Tax Cash Flow', formatCurrency(beforeTaxCF)],
    [{ content: `DSCR: ${dscr.toFixed(2)}x`, styles: { fontStyle: boldStyle } }, { content: `Cash-on-Cash: ${formatPercent(calculateCashOnCash(beforeTaxCF, totalCashInvested))}`, styles: { fontStyle: boldStyle } }],
  );

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
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ══════════════════════════════════════════════════════════════
  // PAGE 2: Proforma Projections + Exit Waterfall
  // ══════════════════════════════════════════════════════════════

  doc.addPage();
  yPos = 20;

  yPos = sectionHeader(`${holdingPeriod}-YEAR PROFORMA PROJECTIONS`, yPos);

  const projHead = [['Year', 'Income', 'Expenses', 'NOI', 'Debt Service', 'Cash Flow', 'CoC']];
  const projBody = projections.map(yr => [
    `Year ${yr.year}`,
    formatCurrency(yr.income),
    formatCurrency(yr.expenses),
    formatCurrency(yr.noi),
    formatCurrency(yr.debtService),
    formatCurrency(yr.cashFlow),
    formatPercent(calculateCashOnCash(yr.cashFlow, totalCashInvested)),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: projHead,
    body: projBody,
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: boldStyle },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ── Exit Waterfall ──
  yPos = sectionHeader(`EXIT ANALYSIS (YEAR ${holdingPeriod})`, yPos);

  const exitData: any[] = [
    [`Exit NOI (Year ${holdingPeriod})`, formatCurrency(exitNOI)],
    ['Exit Cap Rate', formatPercent(exitCapRate)],
    [{ content: 'Gross Sale Price', styles: { fontStyle: boldStyle } }, { content: formatCurrency(saleProceeds.salePrice), styles: { fontStyle: boldStyle } }],
    [`Less: Selling Costs (${formatPercent(sellingCostsPercent)})`, `(${formatCurrency(saleProceeds.sellingCosts)})`],
    ['Less: Bank Loan Payoff', `(${formatCurrency(saleProceeds.loanPayoff)})`],
  ];
  if (sellerCarrybackAmt > 0) {
    exitData.push(['Less: Seller Carryback Payoff', `(${formatCurrency(sellerCarrybackAmt)})`]);
  }
  exitData.push(
    [{ content: 'Net Sale Proceeds', styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }, { content: formatCurrency(saleProceeds.netToSeller - (sellerCarrybackAmt > 0 ? sellerCarrybackAmt : 0)), styles: { fontStyle: boldStyle, fillColor: COLORS.lightGray } }],
  );

  autoTable(doc, {
    startY: yPos,
    body: exitData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.65 },
      1: { cellWidth: contentWidth * 0.35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Return metrics row
  const returnMetrics = [
    ['IRR', formatPercent(irrValue), `Target: ${formatPercent(thresholds.irr)}`],
    ['Equity Multiple', `${equityMultiple.toFixed(2)}x`, `Target: ${thresholds.equity_multiple.toFixed(2)}x`],
    ['Avg Cash-on-Cash', formatPercent(avgCashOnCash), `Target: ${formatPercent(thresholds.cash_on_cash)}`],
    ['Price/SF', `$${pricePerSqft.toFixed(0)}`, sqft > 0 ? `${formatNumber(sqft)} SF` : 'N/A'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Actual', 'Benchmark']],
    body: returnMetrics,
    theme: 'grid',
    headStyles: { fillColor: COLORS.dark, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, fontStyle: boldStyle },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: contentWidth * 0.35 },
      1: { halign: 'right', cellWidth: contentWidth * 0.35 },
      2: { halign: 'right', textColor: COLORS.gray },
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ── Value-Add Summary (if any VA costs) ──
  if (vaTotalCost > 0 || noiLift > 0) {
    yPos = sectionHeader('VALUE-ADD ANALYSIS', yPos);

    // As-Is vs Stabilized
    const vaCompData = [
      ['Metric', 'As-Is', 'Stabilized', 'Delta'],
      ['Rent PSF', `$${n(data.as_is_rent_psf).toFixed(2)}`, `$${n(data.stabilized_rent_psf).toFixed(2)}`, `+$${(n(data.stabilized_rent_psf) - n(data.as_is_rent_psf)).toFixed(2)}`],
      ['Occupancy', `${n(data.as_is_occupancy).toFixed(1)}%`, `${n(data.stabilized_occupancy).toFixed(1)}%`, `+${(n(data.stabilized_occupancy) - n(data.as_is_occupancy)).toFixed(1)}%`],
      ['NOI', formatCurrency(asIsNOI), formatCurrency(stabilizedNOI), `+${formatCurrency(noiLift)}`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [vaCompData[0]],
      body: vaCompData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: COLORS.warning, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: boldStyle },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 3: { textColor: COLORS.success } },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    // VA Costs
    const vaCostData = [
      ['CapEx', formatCurrency(n(data.va_capex))],
      ['TI / Leasing', formatCurrency(n(data.va_ti_leasing))],
      ['Carry Costs', formatCurrency(n(data.va_carry_costs))],
      ['Contingency', formatCurrency(n(data.va_contingency))],
      [{ content: 'Total Value-Add Costs', styles: { fontStyle: boldStyle } }, { content: formatCurrency(vaTotalCost), styles: { fontStyle: boldStyle } }],
    ];

    autoTable(doc, {
      startY: yPos,
      body: vaCostData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65 },
        1: { cellWidth: contentWidth * 0.35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // ══════════════════════════════════════════════════════════════
  // Decision Scorecard + Optimization
  // ══════════════════════════════════════════════════════════════

  if (yPos > 180) { doc.addPage(); yPos = 20; }

  yPos = sectionHeader(`DECISION SCORECARD — ${strategyLabel.toUpperCase()} STRATEGY`, yPos);

  // Big verdict
  const verdictBgColor = verdict === 'GO' ? [220, 252, 231] as [number, number, number] : verdict === 'REVIEW' ? [254, 249, 195] as [number, number, number] : [254, 226, 226] as [number, number, number];
  const verdictTextColor = verdict === 'GO' ? COLORS.success : verdict === 'REVIEW' ? [180, 130, 0] as [number, number, number] : COLORS.danger;
  doc.setFillColor(...verdictBgColor);
  doc.roundedRect(margin, yPos, contentWidth, 16, 3, 3, 'F');
  doc.setTextColor(...verdictTextColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(verdict, pageWidth / 2, yPos + 11, { align: 'center' });
  yPos += 22;

  // Scorecard table
  const scorecardBody = decisionMetrics.map(m => [
    m.label,
    fmtMetric(m.actual, m.format),
    m.required === null ? 'N/A' : fmtMetric(m.required, m.format),
    m.pass ? 'PASS' : 'FAIL',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Actual', 'Required', 'Status']],
    body: scorecardBody,
    theme: 'grid',
    headStyles: { fillColor: COLORS.dark, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, fontStyle: boldStyle },
    styles: { fontSize: 9, cellPadding: 3.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right', textColor: COLORS.gray },
      3: { halign: 'center' },
    },
    didParseCell: (hookData: any) => {
      if (hookData.column.index === 3 && hookData.section === 'body') {
        const val = hookData.cell.raw;
        hookData.cell.styles.textColor = val === 'PASS' ? COLORS.success : COLORS.danger;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ── Optimization (Goal-Seek) ──
  if (purchasePrice > 0 && egi > 0) {
    if (yPos > 210) { doc.addPage(); yPos = 20; }

    yPos = sectionHeader('OPTIMIZATION — WHAT MAKES THIS A GO?', yPos);

    const goalSeekInputs = {
      purchasePrice,
      initialNOI: noi,
      incomeGrowthRate: n(data.income_growth_rate),
      expenseGrowthRate: n(data.expense_growth_rate),
      initialIncome: egi,
      initialExpenses: totalExpenses,
      loanAmount,
      interestRate: n(data.interest_rate),
      amortizationYears: n(data.amortization_years),
      holdingPeriod,
      exitCapRate,
      sellingCostsPercent,
      totalCashInvested,
      closingCostsPercent: n(data.closing_costs_percent),
      ltvPercent: n(data.ltv_percent),
      buildingSqft: sqft,
      expenseRatio: totalExpenses / (egi || 1) * 100,
    };

    const targetIRR = thresholds.irr;
    const optimization = {
      maxPurchasePrice: solveMaxPurchasePrice(targetIRR, goalSeekInputs),
      requiredNOI: solveRequiredNOILift(targetIRR, goalSeekInputs),
      requiredRentPSF: solveRequiredRentPSF(noi, sqft, totalExpenses / (egi || 1) * 100),
      capexCeiling: solveCapexCeiling(targetIRR, goalSeekInputs),
      targetExitCap: solveTargetExitCap(targetIRR, goalSeekInputs),
    };

    const optRows: string[][] = [
      ['Max Purchase Price', formatCurrency(purchasePrice), formatCurrency(optimization.maxPurchasePrice), formatCurrency(optimization.maxPurchasePrice - purchasePrice)],
      ['Required NOI', formatCurrency(noi), formatCurrency(optimization.requiredNOI), formatCurrency(optimization.requiredNOI - noi)],
    ];
    if (sqft > 0) {
      optRows.push(['Required Rent PSF', `$${(pgi / sqft).toFixed(2)}/SF`, `$${optimization.requiredRentPSF.toFixed(2)}/SF`, `$${(optimization.requiredRentPSF - (pgi / sqft)).toFixed(2)}/SF`]);
    }
    optRows.push(
      ['CapEx Ceiling', formatCurrency(vaTotalCost), formatCurrency(optimization.capexCeiling), formatCurrency(optimization.capexCeiling - vaTotalCost)],
      ['Target Exit Cap', formatPercent(exitCapRate), formatPercent(optimization.targetExitCap), `${(optimization.targetExitCap - exitCapRate).toFixed(2)}%`],
    );

    autoTable(doc, {
      startY: yPos,
      head: [['Lever', 'Current', 'Required for Target IRR', 'Gap']],
      body: optRows,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] as [number, number, number], fontSize: 8, fontStyle: boldStyle },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(`Target IRR: ${formatPercent(targetIRR)} (${strategyLabel} Strategy)`, margin, yPos + 4);
  }

  // Notes
  if (data.notes) {
    yPos = (doc as any).lastAutoTable?.finalY ?? yPos;
    yPos += 10;
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    yPos = sectionHeader('NOTES', yPos);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, yPos);
  }

  // ── Footer on all pages ──
  renderBrandedFooter(doc, branding);

  const fileName = `Investment_Analysis_${(property.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
