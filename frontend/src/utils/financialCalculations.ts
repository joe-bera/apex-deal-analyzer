/**
 * Financial Calculations for CRE Deal Analysis
 * CCIM-level formulas for income, expenses, debt, and returns
 */

// ============================================================================
// Income Calculations
// ============================================================================

export function calculateVacancyAmount(pgi: number, vacancyRate: number): number {
  return pgi * (vacancyRate / 100);
}

export function calculateEffectiveGrossIncome(
  pgi: number,
  vacancyAmount: number,
  otherIncome: number = 0
): number {
  return pgi - vacancyAmount + otherIncome;
}

// ============================================================================
// Expense Calculations
// ============================================================================

export function calculateManagementFee(egi: number, feePercent: number): number {
  return egi * (feePercent / 100);
}

export function calculateTotalExpenses(expenses: {
  propertyTaxes?: number;
  insurance?: number;
  utilities?: number;
  managementFee?: number;
  repairsMaintenance?: number;
  reservesCapex?: number;
  otherExpenses?: number;
}): number {
  return (
    (expenses.propertyTaxes || 0) +
    (expenses.insurance || 0) +
    (expenses.utilities || 0) +
    (expenses.managementFee || 0) +
    (expenses.repairsMaintenance || 0) +
    (expenses.reservesCapex || 0) +
    (expenses.otherExpenses || 0)
  );
}

export function calculateOperatingExpenseRatio(
  totalExpenses: number,
  egi: number
): number {
  if (egi === 0) return 0;
  return (totalExpenses / egi) * 100;
}

// ============================================================================
// NOI & Valuation
// ============================================================================

export function calculateNOI(egi: number, totalExpenses: number): number {
  return egi - totalExpenses;
}

export function calculateCapRate(noi: number, purchasePrice: number): number {
  if (purchasePrice === 0) return 0;
  return (noi / purchasePrice) * 100;
}

export function calculateValueFromCapRate(noi: number, capRate: number): number {
  if (capRate === 0) return 0;
  return noi / (capRate / 100);
}

export function calculatePricePerSqft(
  purchasePrice: number,
  squareFootage: number
): number {
  if (squareFootage === 0) return 0;
  return purchasePrice / squareFootage;
}

export function calculateGRM(purchasePrice: number, annualGrossIncome: number): number {
  if (annualGrossIncome === 0) return 0;
  return purchasePrice / annualGrossIncome;
}

// ============================================================================
// Debt Analysis
// ============================================================================

export function calculateLoanAmount(purchasePrice: number, ltvPercent: number): number {
  return purchasePrice * (ltvPercent / 100);
}

export function calculateDownPayment(purchasePrice: number, loanAmount: number): number {
  return purchasePrice - loanAmount;
}

/**
 * Calculate monthly mortgage payment using PMT formula
 * PMT = P * (r * (1+r)^n) / ((1+r)^n - 1)
 */
export function calculateMonthlyPayment(
  loanAmount: number,
  annualInterestRate: number,
  amortizationYears: number
): number {
  if (loanAmount === 0 || annualInterestRate === 0 || amortizationYears === 0) {
    return 0;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const numPayments = amortizationYears * 12;

  const payment =
    loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return isFinite(payment) ? payment : 0;
}

export function calculateAnnualDebtService(monthlyPayment: number): number {
  return monthlyPayment * 12;
}

export function calculateDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService === 0) return 0;
  return noi / annualDebtService;
}

// ============================================================================
// Cash Flow & Returns
// ============================================================================

export function calculateClosingCosts(
  purchasePrice: number,
  closingCostPercent: number
): number {
  return purchasePrice * (closingCostPercent / 100);
}

export function calculateTotalCashRequired(
  downPayment: number,
  closingCosts: number
): number {
  return downPayment + closingCosts;
}

export function calculateBeforeTaxCashFlow(
  noi: number,
  annualDebtService: number
): number {
  return noi - annualDebtService;
}

export function calculateCashOnCash(
  annualCashFlow: number,
  totalCashInvested: number
): number {
  if (totalCashInvested === 0) return 0;
  return (annualCashFlow / totalCashInvested) * 100;
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function parseNumberInput(value: string | number | undefined): number {
  if (value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isValidNumber(parsed) ? parsed : 0;
}

// ============================================================================
// Warning Thresholds
// ============================================================================

export const THRESHOLDS = {
  DSCR_WARNING: 1.25,      // Below this is risky
  DSCR_GOOD: 1.5,          // Above this is good
  CAP_RATE_LOW: 4.0,       // Below this might be overpriced
  CAP_RATE_HIGH: 8.0,      // Above this might be risky
  EXPENSE_RATIO_HIGH: 45,  // Above this is high expenses
  COC_GOOD: 8.0,           // Above this is good return
};

export function getDSCRStatus(dscr: number): 'danger' | 'warning' | 'good' {
  if (dscr < THRESHOLDS.DSCR_WARNING) return 'danger';
  if (dscr < THRESHOLDS.DSCR_GOOD) return 'warning';
  return 'good';
}

export function getCapRateStatus(capRate: number): 'low' | 'normal' | 'high' {
  if (capRate < THRESHOLDS.CAP_RATE_LOW) return 'low';
  if (capRate > THRESHOLDS.CAP_RATE_HIGH) return 'high';
  return 'normal';
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatCurrency(value: number | undefined | null): string {
  if (value === null || value === undefined || !isFinite(value)) return '$0';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number | undefined | null, decimals = 2): string {
  if (value === null || value === undefined || !isFinite(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value === null || value === undefined || !isFinite(value)) return '0';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatRatio(value: number | undefined | null): string {
  if (value === null || value === undefined || !isFinite(value)) return '0.00x';
  return `${value.toFixed(2)}x`;
}
