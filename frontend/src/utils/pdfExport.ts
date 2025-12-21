import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Property, Comp } from '../types';
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

interface ExportOptions {
  property: Property;
  analysis?: DealAnalysisData;
  comps?: Comp[];
  includeLogo?: boolean;
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
  if (value === null || value === undefined) return 'N/A';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value?: number | null): string => {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(2)}%`;
};

const formatNumber = (value?: number | null): string => {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export function generateDealAnalysisPDF(options: ExportOptions): void {
  const { property, analysis, comps } = options;

  const doc = new jsPDF();
  let yPos = 20;

  // Header with branding
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 220, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('APEX REAL ESTATE', 14, 18);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Commercial Real Estate Analysis', 14, 28);

  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 14, 36);

  yPos = 50;

  // Property Information Section
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPERTY SUMMARY', 14, yPos);
  yPos += 8;

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, 196, yPos);
  yPos += 8;

  // Property details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(property.address || 'Address Not Available', 14, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(`${property.city || ''}, ${property.state || ''} ${property.zip_code || ''}`, 14, yPos);
  yPos += 10;

  // Key metrics in a grid
  const metricsData = [
    ['List Price', formatCurrency(property.price)],
    ['Building Size', property.building_size ? `${formatNumber(property.building_size)} SF` : 'N/A'],
    ['Property Type', property.property_type?.replace(/_/g, ' ').toUpperCase() || 'N/A'],
    ['Year Built', property.year_built?.toString() || 'N/A'],
    ['Price/SF', property.price_per_sqft ? `$${property.price_per_sqft.toFixed(2)}` : 'N/A'],
    ['CAP Rate', property.cap_rate ? `${property.cap_rate}%` : 'N/A'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: metricsData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: COLORS.gray, cellWidth: 40 },
      1: { textColor: COLORS.dark, cellWidth: 50 },
    },
    margin: { left: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Financial Analysis Section (if analysis data exists)
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

    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('INCOME & EXPENSE ANALYSIS', 14, yPos);
    yPos += 8;

    doc.setDrawColor(...COLORS.primary);
    doc.line(14, yPos, 196, yPos);
    yPos += 5;

    // Income Analysis Table
    const incomeData = [
      ['Potential Gross Income (PGI)', formatCurrency(analysis.potential_gross_income)],
      [`Less: Vacancy (${analysis.vacancy_rate}%)`, `(${formatCurrency(vacancyAmount)})`],
      ['Plus: Other Income', formatCurrency(analysis.other_income)],
      ['Effective Gross Income (EGI)', formatCurrency(egi)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Income Analysis', 'Amount']],
      body: incomeData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 50, halign: 'right' },
      },
      margin: { left: 14, right: 100 },
    });

    // Expense Analysis Table (on the right)
    const expenseData = [
      ['Property Taxes', formatCurrency(analysis.property_taxes)],
      ['Insurance', formatCurrency(analysis.insurance)],
      ['Utilities', formatCurrency(analysis.utilities)],
      [`Management (${analysis.management_fee_percent}%)`, formatCurrency(managementFee)],
      ['Repairs & Maintenance', formatCurrency(analysis.repairs_maintenance)],
      ['Reserves/CapEx', formatCurrency(analysis.reserves_capex)],
      ['Other Expenses', formatCurrency(analysis.other_expenses)],
      ['Total Operating Expenses', formatCurrency(totalExpenses)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Operating Expenses', 'Amount']],
      body: expenseData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 110 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // NOI Highlight Box
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(14, yPos, 182, 25, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('NET OPERATING INCOME (NOI)', 20, yPos + 10);

    doc.setFontSize(18);
    doc.setTextColor(...COLORS.primary);
    doc.text(formatCurrency(noi), 20, yPos + 20);

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.gray);
    doc.text(`CAP Rate: ${formatPercent(capRate)}`, 100, yPos + 15);

    yPos += 35;

    // Financing Analysis
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('FINANCING & RETURNS', 14, yPos);
    yPos += 8;

    doc.setDrawColor(...COLORS.primary);
    doc.line(14, yPos, 196, yPos);
    yPos += 5;

    const financingData = [
      ['Purchase Price', formatCurrency(analysis.purchase_price)],
      [`Loan Amount (${analysis.ltv_percent}% LTV)`, formatCurrency(loanAmount)],
      ['Down Payment', formatCurrency(downPayment)],
      [`Closing Costs (${analysis.closing_costs_percent}%)`, formatCurrency(closingCosts)],
      ['Total Cash Required', formatCurrency(totalCashRequired)],
    ];

    const debtData = [
      ['Interest Rate', `${analysis.interest_rate}%`],
      ['Amortization', `${analysis.amortization_years} years`],
      ['Monthly Payment', formatCurrency(monthlyPayment)],
      ['Annual Debt Service', formatCurrency(annualDebtService)],
      ['DSCR', dscr.toFixed(2) + 'x'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Investment', 'Amount']],
      body: financingData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 14, right: 100 },
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Debt Service', 'Value']],
      body: debtData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 110 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Returns Summary Box
    doc.setFillColor(...(coc >= 8 ? COLORS.success : coc >= 5 ? COLORS.warning : COLORS.danger));
    doc.roundedRect(14, yPos, 88, 30, 3, 3, 'F');

    doc.setFillColor(...(dscr >= 1.5 ? COLORS.success : dscr >= 1.25 ? COLORS.warning : COLORS.danger));
    doc.roundedRect(108, yPos, 88, 30, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Cash-on-Cash Return', 20, yPos + 10);
    doc.text('DSCR', 114, yPos + 10);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(formatPercent(coc), 20, yPos + 23);
    doc.text(dscr.toFixed(2) + 'x', 114, yPos + 23);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Before-Tax Cash Flow', 55, yPos + 10);
    doc.text(formatCurrency(btcf), 55, yPos + 23);

    yPos += 40;
  }

  // Comparable Sales Section
  if (comps && comps.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('COMPARABLE SALES', 14, yPos);
    yPos += 8;

    doc.setDrawColor(...COLORS.primary);
    doc.line(14, yPos, 196, yPos);
    yPos += 5;

    const compTableData = comps.map((comp) => [
      comp.comp_address,
      `${comp.comp_city}, ${comp.comp_state}`,
      formatCurrency(comp.comp_sale_price),
      comp.comp_square_footage ? `${formatNumber(comp.comp_square_footage)} SF` : 'N/A',
      comp.comp_price_per_sqft ? `$${comp.comp_price_per_sqft.toFixed(2)}` : 'N/A',
      new Date(comp.comp_sale_date).toLocaleDateString(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Address', 'City', 'Sale Price', 'Size', '$/SF', 'Date']],
      body: compTableData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 35 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22 },
      },
      margin: { left: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(
      `Apex Real Estate Services | Confidential | Page ${i} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `Deal_Analysis_${property.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'Property'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
