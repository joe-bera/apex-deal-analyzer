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
// Lease Type / NNN Reimbursements
// ============================================================================

/**
 * Calculate NNN expense reimbursements from tenants
 * NNN tenants reimburse taxes + insurance + maintenance at a recovery rate
 */
export function calculateNNNReimbursements(
  taxes: number,
  insurance: number,
  maintenance: number,
  recoveryRate: number
): number {
  return (taxes + insurance + maintenance) * (recoveryRate / 100);
}

/**
 * Calculate total annual debt service combining bank + seller carryback
 */
export function calculateTotalAnnualDebtService(
  bankMonthlyPayment: number,
  sellerMonthlyPayment: number
): number {
  return (bankMonthlyPayment + sellerMonthlyPayment) * 12;
}

/**
 * Calculate adjusted down payment accounting for seller carryback
 */
export function calculateAdjustedDownPayment(
  purchasePrice: number,
  bankLoan: number,
  sellerCarryback: number
): number {
  return Math.max(0, purchasePrice - bankLoan - sellerCarryback);
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
  additionalAnnualDebtService?: number; // seller carryback DS
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
    additionalAnnualDebtService,
  } = inputs;

  const projections: YearProjection[] = [];
  const bankAnnualDS = calculateAnnualDebtService(
    calculateMonthlyPayment(loanAmount, interestRate, amortizationYears)
  );
  const annualDebtService = bankAnnualDS + (additionalAnnualDebtService || 0);

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

// ============================================================================
// Investment Decision Engine — Strategy Thresholds & Goal-Seek
// ============================================================================

export type InvestmentStrategy = 'core' | 'value_add' | 'opportunistic';

export interface StrategyThresholds {
  cap_rate: number | null;
  cash_on_cash: number;
  irr: number;
  equity_multiple: number;
  dscr: number;
}

export const STRATEGY_THRESHOLDS: Record<InvestmentStrategy, StrategyThresholds> = {
  core: { cap_rate: 6.50, cash_on_cash: 8.50, irr: 12.0, equity_multiple: 1.60, dscr: 1.30 },
  value_add: { cap_rate: 5.75, cash_on_cash: 8.75, irr: 15.0, equity_multiple: 1.80, dscr: 1.25 },
  opportunistic: { cap_rate: null, cash_on_cash: 9.50, irr: 18.0, equity_multiple: 2.00, dscr: 1.20 },
};

/**
 * NPV = Σ (CF_t / (1 + r)^t)
 */
export function calculateNPV(cashFlows: number[], discountRate: number): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + discountRate / 100, t);
  }
  return npv;
}

/**
 * Average Cash-on-Cash return across holding period
 */
export function calculateAvgCashOnCash(projections: YearProjection[], totalCashInvested: number): number {
  if (totalCashInvested === 0 || projections.length === 0) return 0;
  const totalCoC = projections.reduce((sum, p) => sum + calculateCashOnCash(p.cashFlow, totalCashInvested), 0);
  return totalCoC / projections.length;
}

/**
 * Suggest exit cap rate from comparable sales — median of comp cap rates
 */
export function suggestExitCapRate(comps: Array<{ comp_cap_rate?: number | null }>): number | null {
  const rates = comps.map(c => c.comp_cap_rate).filter((r): r is number => r != null && r > 0);
  if (rates.length === 0) return null;
  rates.sort((a, b) => a - b);
  const mid = Math.floor(rates.length / 2);
  return rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
}

/**
 * Benchmark price per sqft from comps
 */
export function benchmarkPricePerSqft(comps: Array<{ comp_price_per_sqft?: number | null }>): { avg: number; min: number; max: number } | null {
  const prices = comps.map(c => c.comp_price_per_sqft).filter((p): p is number => p != null && p > 0);
  if (prices.length === 0) return null;
  return {
    avg: prices.reduce((s, p) => s + p, 0) / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

// ============================================================================
// Goal-Seek Functions (binary search to hit target IRR)
// ============================================================================

interface GoalSeekInputs {
  purchasePrice: number;
  initialNOI: number;
  incomeGrowthRate: number;
  expenseGrowthRate: number;
  initialIncome: number;
  initialExpenses: number;
  loanAmount: number;
  interestRate: number;
  amortizationYears: number;
  holdingPeriod: number;
  exitCapRate: number;
  sellingCostsPercent: number;
  totalCashInvested: number;
  closingCostsPercent: number;
  ltvPercent: number;
  buildingSqft: number;
  expenseRatio: number;
}

/**
 * Helper: compute IRR for a given set of deal parameters
 */
function computeDealIRR(params: {
  purchasePrice: number;
  initialIncome: number;
  initialExpenses: number;
  incomeGrowthRate: number;
  expenseGrowthRate: number;
  ltvPercent: number;
  interestRate: number;
  amortizationYears: number;
  holdingPeriod: number;
  exitCapRate: number;
  sellingCostsPercent: number;
  closingCostsPercent: number;
}): number {
  const loanAmt = params.purchasePrice * (params.ltvPercent / 100);
  const downPmt = params.purchasePrice - loanAmt;
  const closingCosts = params.purchasePrice * (params.closingCostsPercent / 100);
  const totalCash = downPmt + closingCosts;

  const projections = generateProjections({
    initialIncome: params.initialIncome,
    initialExpenses: params.initialExpenses,
    incomeGrowthRate: params.incomeGrowthRate,
    expenseGrowthRate: params.expenseGrowthRate,
    purchasePrice: params.purchasePrice,
    loanAmount: loanAmt,
    interestRate: params.interestRate,
    amortizationYears: params.amortizationYears,
    holdingPeriod: params.holdingPeriod,
    exitCapRate: params.exitCapRate,
    sellingCosts: params.sellingCostsPercent,
  });

  if (projections.length === 0) return 0;

  const lastYear = projections[projections.length - 1];
  const saleProceeds = calculateSaleProceeds(
    lastYear.noi, params.exitCapRate, lastYear.loanBalance, params.sellingCostsPercent
  );
  const cashFlows = buildIRRCashFlows(totalCash, projections, saleProceeds.netToSeller);
  return calculateIRR(cashFlows);
}

/**
 * Max purchase price to achieve target IRR (binary search)
 */
export function solveMaxPurchasePrice(targetIRR: number, inputs: GoalSeekInputs): number {
  let lo = 1;
  let hi = inputs.purchasePrice * 3;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const irr = computeDealIRR({
      ...inputs,
      purchasePrice: mid,
    });
    if (irr > targetIRR) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/**
 * Required NOI lift (stabilized NOI) to achieve target IRR
 * Adjusts initialIncome proportionally to hit NOI target
 */
export function solveRequiredNOILift(targetIRR: number, inputs: GoalSeekInputs): number {
  // We adjust initial income to change NOI
  let lo = inputs.initialExpenses; // minimum income = expenses (NOI=0)
  let hi = inputs.initialIncome * 5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const irr = computeDealIRR({
      ...inputs,
      initialIncome: mid,
    });
    if (irr < targetIRR) lo = mid;
    else hi = mid;
  }
  const requiredIncome = (lo + hi) / 2;
  return requiredIncome - inputs.initialExpenses; // required NOI
}

/**
 * Required rent PSF to hit target NOI
 */
export function solveRequiredRentPSF(targetNOI: number, sqft: number, expenseRatio: number): number {
  if (sqft === 0) return 0;
  // NOI = Income * (1 - expenseRatio/100)
  // Income = NOI / (1 - expenseRatio/100)
  // RentPSF = Income / sqft
  const factor = 1 - expenseRatio / 100;
  if (factor <= 0) return 0;
  return (targetNOI / factor) / sqft;
}

/**
 * CapEx ceiling to achieve target IRR
 * This adjusts total cash invested (adds capex to equity required)
 */
export function solveCapexCeiling(targetIRR: number, inputs: GoalSeekInputs): number {
  // Binary search on capex amount — higher capex = lower IRR
  let lo = 0;
  let hi = inputs.purchasePrice; // capex won't exceed purchase price
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    // Capex increases total cash invested but doesn't change income projections
    // Model it as increasing closing costs
    const adjustedClosingPercent = inputs.closingCostsPercent + (mid / inputs.purchasePrice) * 100;
    const irr = computeDealIRR({
      ...inputs,
      closingCostsPercent: adjustedClosingPercent,
    });
    if (irr > targetIRR) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/**
 * Target exit cap rate to achieve target IRR
 */
export function solveTargetExitCap(targetIRR: number, inputs: GoalSeekInputs): number {
  // Lower exit cap = higher exit value = higher IRR
  let lo = 1;
  let hi = 15;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const irr = computeDealIRR({
      ...inputs,
      exitCapRate: mid,
    });
    if (irr > targetIRR) lo = mid; // can afford higher exit cap
    else hi = mid; // need lower exit cap
  }
  return parseFloat(((lo + hi) / 2).toFixed(2));
}
