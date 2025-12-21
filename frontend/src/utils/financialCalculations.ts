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

// ============================================================================
// Multi-Year Projections
// ============================================================================

export interface YearProjection {
  year: number;
  income: number;
  expenses: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  loanBalance: number;
  equity: number;
}

export interface ProjectionInputs {
  initialIncome: number;
  initialExpenses: number;
  incomeGrowthRate: number; // percentage
  expenseGrowthRate: number; // percentage
  purchasePrice: number;
  loanAmount: number;
  interestRate: number; // percentage
  amortizationYears: number;
  holdingPeriod: number; // years
  exitCapRate: number; // percentage
  sellingCosts: number; // percentage
}

/**
 * Calculate remaining loan balance after n years
 * Using the loan amortization formula
 */
export function calculateLoanBalance(
  originalLoan: number,
  annualRate: number,
  amortizationYears: number,
  yearsElapsed: number
): number {
  if (originalLoan === 0 || annualRate === 0) return originalLoan;

  const monthlyRate = annualRate / 100 / 12;
  const totalPayments = amortizationYears * 12;
  const paymentsMade = yearsElapsed * 12;

  // Remaining balance formula
  const remainingBalance = originalLoan *
    (Math.pow(1 + monthlyRate, totalPayments) - Math.pow(1 + monthlyRate, paymentsMade)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1);

  return isFinite(remainingBalance) ? Math.max(0, remainingBalance) : 0;
}

/**
 * Generate year-by-year projections
 */
export function generateProjections(inputs: ProjectionInputs): YearProjection[] {
  const {
    initialIncome,
    initialExpenses,
    incomeGrowthRate,
    expenseGrowthRate,
    purchasePrice,
    loanAmount,
    interestRate,
    amortizationYears,
    holdingPeriod,
  } = inputs;

  const projections: YearProjection[] = [];
  const annualDebtService = calculateAnnualDebtService(
    calculateMonthlyPayment(loanAmount, interestRate, amortizationYears)
  );

  for (let year = 1; year <= holdingPeriod; year++) {
    // Compound growth for income and expenses
    const income = initialIncome * Math.pow(1 + incomeGrowthRate / 100, year - 1);
    const expenses = initialExpenses * Math.pow(1 + expenseGrowthRate / 100, year - 1);
    const noi = income - expenses;
    const cashFlow = noi - annualDebtService;
    const loanBalance = calculateLoanBalance(loanAmount, interestRate, amortizationYears, year);

    // Equity = Property Value (based on current NOI and going-in cap rate) - Loan Balance
    // For simplicity, we'll use purchase price appreciation based on NOI growth
    const impliedValue = purchasePrice * Math.pow(1 + incomeGrowthRate / 100, year - 1);
    const equity = impliedValue - loanBalance;

    projections.push({
      year,
      income,
      expenses,
      noi,
      debtService: annualDebtService,
      cashFlow,
      loanBalance,
      equity,
    });
  }

  return projections;
}

/**
 * Calculate sale proceeds at exit
 */
export function calculateSaleProceeds(
  exitNOI: number,
  exitCapRate: number,
  loanBalance: number,
  sellingCostsPercent: number
): {
  salePrice: number;
  sellingCosts: number;
  netSaleProceeds: number;
  loanPayoff: number;
  netToSeller: number;
} {
  const salePrice = calculateValueFromCapRate(exitNOI, exitCapRate);
  const sellingCosts = salePrice * (sellingCostsPercent / 100);
  const netSaleProceeds = salePrice - sellingCosts;
  const netToSeller = netSaleProceeds - loanBalance;

  return {
    salePrice,
    sellingCosts,
    netSaleProceeds,
    loanPayoff: loanBalance,
    netToSeller,
  };
}

/**
 * Calculate Internal Rate of Return (IRR) using Newton-Raphson method
 *
 * IRR is the discount rate that makes NPV = 0
 * NPV = Σ (Cash Flow_t / (1 + IRR)^t) = 0
 */
export function calculateIRR(cashFlows: number[], maxIterations = 100, tolerance = 0.0001): number {
  // cashFlows[0] = initial investment (negative)
  // cashFlows[1..n] = annual cash flows
  // cashFlows[n] includes sale proceeds

  if (cashFlows.length < 2) return 0;
  if (cashFlows[0] >= 0) return 0; // Initial investment should be negative

  // Initial guess - use a simple approximation
  let irr = 0.1; // Start with 10%

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + irr, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        npvDerivative -= (t * cashFlows[t]) / Math.pow(1 + irr, t + 1);
      }
    }

    // Check for convergence
    if (Math.abs(npv) < tolerance) {
      return irr * 100; // Return as percentage
    }

    // Newton-Raphson update
    if (npvDerivative === 0) break;
    const newIrr = irr - npv / npvDerivative;

    // Bound the IRR to reasonable range
    if (newIrr < -0.99) irr = -0.99;
    else if (newIrr > 10) irr = 10; // 1000% max
    else irr = newIrr;
  }

  return irr * 100; // Return as percentage
}

/**
 * Calculate Equity Multiple
 * Total distributions / Total invested capital
 */
export function calculateEquityMultiple(
  totalCashInvested: number,
  totalCashFlows: number,
  netSaleProceeds: number
): number {
  if (totalCashInvested === 0) return 0;
  return (totalCashFlows + netSaleProceeds) / totalCashInvested;
}

/**
 * Build complete IRR cash flow array for a deal
 */
export function buildIRRCashFlows(
  initialInvestment: number,
  projections: YearProjection[],
  netSaleProceeds: number
): number[] {
  const cashFlows: number[] = [-initialInvestment]; // Year 0 (negative)

  for (let i = 0; i < projections.length; i++) {
    let yearCashFlow = projections[i].cashFlow;

    // Add sale proceeds to final year
    if (i === projections.length - 1) {
      yearCashFlow += netSaleProceeds;
    }

    cashFlows.push(yearCashFlow);
  }

  return cashFlows;
}
