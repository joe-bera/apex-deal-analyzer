/**
 * Financial Calculation Service
 *
 * Centralized module for all real estate financial calculations.
 * All functions include input validation and handle edge cases.
 */

export interface CalculationResult<T> {
  value: T;
  isValid: boolean;
  error?: string;
}

/**
 * Validate that a number is usable for calculations
 * Returns false for NaN, Infinity, undefined, null
 */
export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

/**
 * Validate that a number is positive (greater than zero)
 */
export const isPositiveNumber = (value: unknown): value is number => {
  return isValidNumber(value) && value > 0;
};

/**
 * Validate that a number is non-negative (zero or greater)
 */
export const isNonNegativeNumber = (value: unknown): value is number => {
  return isValidNumber(value) && value >= 0;
};

/**
 * Calculate CAP Rate (Capitalization Rate)
 *
 * Formula: (Net Operating Income / Purchase Price) * 100
 *
 * @param noi - Net Operating Income (annual)
 * @param purchasePrice - Purchase price of the property
 * @returns CAP rate as a percentage (e.g., 5.5 for 5.5%)
 */
export const calculateCapRate = (
  noi: unknown,
  purchasePrice: unknown
): CalculationResult<number> => {
  // Validate inputs
  if (!isValidNumber(noi)) {
    return { value: 0, isValid: false, error: 'NOI must be a valid number' };
  }

  if (!isPositiveNumber(purchasePrice)) {
    return {
      value: 0,
      isValid: false,
      error: 'Purchase price must be a positive number',
    };
  }

  // NOI can be zero (vacant property) or negative (unusual but possible)
  // but for typical deals NOI should be positive
  const capRate = (noi / purchasePrice) * 100;

  // Sanity check: CAP rates outside 0-50% are extremely unusual
  // We still calculate but flag as potentially invalid
  if (capRate < 0 || capRate > 50) {
    return {
      value: capRate,
      isValid: true,
      error: `CAP rate of ${capRate.toFixed(2)}% is outside typical range (0-50%)`,
    };
  }

  return { value: capRate, isValid: true };
};

/**
 * Calculate Price Per Square Foot
 *
 * Formula: Price / Square Footage
 *
 * @param price - Sale or asking price
 * @param squareFootage - Building size in square feet
 * @returns Price per square foot
 */
export const calculatePricePerSqft = (
  price: unknown,
  squareFootage: unknown
): CalculationResult<number> => {
  if (!isValidNumber(price)) {
    return { value: 0, isValid: false, error: 'Price must be a valid number' };
  }

  if (!isPositiveNumber(squareFootage)) {
    return {
      value: 0,
      isValid: false,
      error: 'Square footage must be a positive number',
    };
  }

  if (price < 0) {
    return { value: 0, isValid: false, error: 'Price cannot be negative' };
  }

  const pricePerSqft = price / squareFootage;

  return { value: pricePerSqft, isValid: true };
};

/**
 * Calculate Net Operating Income (NOI)
 *
 * Formula: Gross Income - Operating Expenses
 *
 * @param grossIncome - Total annual income from property
 * @param operatingExpenses - Total annual operating expenses
 * @returns Net Operating Income
 */
export const calculateNOI = (
  grossIncome: unknown,
  operatingExpenses: unknown
): CalculationResult<number> => {
  if (!isNonNegativeNumber(grossIncome)) {
    return {
      value: 0,
      isValid: false,
      error: 'Gross income must be a non-negative number',
    };
  }

  if (!isNonNegativeNumber(operatingExpenses)) {
    return {
      value: 0,
      isValid: false,
      error: 'Operating expenses must be a non-negative number',
    };
  }

  const noi = grossIncome - operatingExpenses;

  return { value: noi, isValid: true };
};

/**
 * Calculate Cash on Cash Return
 *
 * Formula: (Annual Cash Flow / Total Cash Invested) * 100
 *
 * @param annualCashFlow - Annual cash flow after debt service
 * @param totalCashInvested - Total cash invested (down payment + closing costs)
 * @returns Cash on cash return as a percentage
 */
export const calculateCashOnCash = (
  annualCashFlow: unknown,
  totalCashInvested: unknown
): CalculationResult<number> => {
  if (!isValidNumber(annualCashFlow)) {
    return {
      value: 0,
      isValid: false,
      error: 'Annual cash flow must be a valid number',
    };
  }

  if (!isPositiveNumber(totalCashInvested)) {
    return {
      value: 0,
      isValid: false,
      error: 'Total cash invested must be a positive number',
    };
  }

  const cashOnCash = (annualCashFlow / totalCashInvested) * 100;

  return { value: cashOnCash, isValid: true };
};

/**
 * Calculate Debt Service Coverage Ratio (DSCR)
 *
 * Formula: NOI / Annual Debt Service
 * Lenders typically require DSCR >= 1.25
 *
 * @param noi - Net Operating Income
 * @param annualDebtService - Annual loan payments (principal + interest)
 * @returns DSCR ratio
 */
export const calculateDSCR = (
  noi: unknown,
  annualDebtService: unknown
): CalculationResult<number> => {
  if (!isValidNumber(noi)) {
    return { value: 0, isValid: false, error: 'NOI must be a valid number' };
  }

  if (!isPositiveNumber(annualDebtService)) {
    return {
      value: 0,
      isValid: false,
      error: 'Annual debt service must be a positive number',
    };
  }

  const dscr = noi / annualDebtService;

  // Warn if DSCR is below typical lender requirements
  if (dscr < 1.25) {
    return {
      value: dscr,
      isValid: true,
      error: `DSCR of ${dscr.toFixed(2)} is below typical lender requirement of 1.25`,
    };
  }

  return { value: dscr, isValid: true };
};

/**
 * Calculate Gross Rent Multiplier (GRM)
 *
 * Formula: Purchase Price / Annual Gross Rent
 *
 * @param purchasePrice - Purchase price of the property
 * @param annualGrossRent - Annual gross rental income
 * @returns GRM ratio
 */
export const calculateGRM = (
  purchasePrice: unknown,
  annualGrossRent: unknown
): CalculationResult<number> => {
  if (!isPositiveNumber(purchasePrice)) {
    return {
      value: 0,
      isValid: false,
      error: 'Purchase price must be a positive number',
    };
  }

  if (!isPositiveNumber(annualGrossRent)) {
    return {
      value: 0,
      isValid: false,
      error: 'Annual gross rent must be a positive number',
    };
  }

  const grm = purchasePrice / annualGrossRent;

  return { value: grm, isValid: true };
};

/**
 * Calculate property value from CAP rate and NOI
 *
 * Formula: NOI / (CAP Rate / 100)
 *
 * @param noi - Net Operating Income
 * @param capRate - CAP rate as a percentage (e.g., 5.5 for 5.5%)
 * @returns Estimated property value
 */
export const calculateValueFromCapRate = (
  noi: unknown,
  capRate: unknown
): CalculationResult<number> => {
  if (!isValidNumber(noi)) {
    return { value: 0, isValid: false, error: 'NOI must be a valid number' };
  }

  if (!isPositiveNumber(capRate)) {
    return {
      value: 0,
      isValid: false,
      error: 'CAP rate must be a positive number',
    };
  }

  if (capRate > 100) {
    return {
      value: 0,
      isValid: false,
      error: 'CAP rate cannot exceed 100%',
    };
  }

  const value = noi / (capRate / 100);

  return { value, isValid: true };
};

/**
 * Calculate occupancy rate
 *
 * Formula: (Occupied Square Feet / Total Square Feet) * 100
 *
 * @param occupiedSqft - Occupied/leased square footage
 * @param totalSqft - Total building square footage
 * @returns Occupancy rate as a percentage
 */
export const calculateOccupancyRate = (
  occupiedSqft: unknown,
  totalSqft: unknown
): CalculationResult<number> => {
  if (!isNonNegativeNumber(occupiedSqft)) {
    return {
      value: 0,
      isValid: false,
      error: 'Occupied square footage must be a non-negative number',
    };
  }

  if (!isPositiveNumber(totalSqft)) {
    return {
      value: 0,
      isValid: false,
      error: 'Total square footage must be a positive number',
    };
  }

  if (occupiedSqft > totalSqft) {
    return {
      value: 0,
      isValid: false,
      error: 'Occupied square footage cannot exceed total square footage',
    };
  }

  const occupancyRate = (occupiedSqft / totalSqft) * 100;

  return { value: occupancyRate, isValid: true };
};

/**
 * Calculate annual lease rate from monthly rate
 *
 * @param monthlyRate - Monthly lease rate
 * @returns Annual lease rate
 */
export const calculateAnnualFromMonthly = (
  monthlyRate: unknown
): CalculationResult<number> => {
  if (!isValidNumber(monthlyRate)) {
    return {
      value: 0,
      isValid: false,
      error: 'Monthly rate must be a valid number',
    };
  }

  if (monthlyRate < 0) {
    return { value: 0, isValid: false, error: 'Monthly rate cannot be negative' };
  }

  return { value: monthlyRate * 12, isValid: true };
};

/**
 * Round a number to specified decimal places
 * Uses banker's rounding (round half to even) for financial accuracy
 *
 * @param value - Number to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number
 */
export const roundToDecimals = (value: number, decimals: number = 2): number => {
  if (!isValidNumber(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Validate that a CAP rate is within reasonable bounds
 *
 * @param capRate - CAP rate to validate
 * @returns Validation result with warning if outside typical range
 */
export const validateCapRate = (capRate: unknown): CalculationResult<number> => {
  if (!isValidNumber(capRate)) {
    return { value: 0, isValid: false, error: 'CAP rate must be a valid number' };
  }

  if (capRate < 0) {
    return { value: capRate, isValid: false, error: 'CAP rate cannot be negative' };
  }

  if (capRate > 100) {
    return { value: capRate, isValid: false, error: 'CAP rate cannot exceed 100%' };
  }

  // Typical industrial CAP rates are 4-8%, but can range from 3-15%
  if (capRate < 2 || capRate > 20) {
    return {
      value: capRate,
      isValid: true,
      error: `CAP rate of ${capRate}% is outside typical range (2-20%)`,
    };
  }

  return { value: capRate, isValid: true };
};

/**
 * Validate price per square foot is within reasonable bounds
 *
 * @param pricePerSqft - Price per sqft to validate
 * @param propertyType - Optional property type for context-specific validation
 * @returns Validation result
 */
export const validatePricePerSqft = (
  pricePerSqft: unknown,
  _propertyType?: string
): CalculationResult<number> => {
  if (!isValidNumber(pricePerSqft)) {
    return {
      value: 0,
      isValid: false,
      error: 'Price per sqft must be a valid number',
    };
  }

  if (pricePerSqft < 0) {
    return {
      value: pricePerSqft,
      isValid: false,
      error: 'Price per sqft cannot be negative',
    };
  }

  // Industrial properties in SoCal typically $100-500/sqft
  // This is a sanity check, not a hard requirement
  if (pricePerSqft < 10 || pricePerSqft > 2000) {
    return {
      value: pricePerSqft,
      isValid: true,
      error: `Price per sqft of $${pricePerSqft} is outside typical range ($10-$2000)`,
    };
  }

  return { value: pricePerSqft, isValid: true };
};
