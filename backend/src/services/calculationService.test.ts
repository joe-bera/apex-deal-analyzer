/**
 * Unit tests for Financial Calculation Service
 *
 * These tests ensure accuracy of all financial calculations used
 * for real estate investment analysis. Accuracy is critical as
 * users make investment decisions based on these numbers.
 */

import {
  isValidNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  calculateCapRate,
  calculatePricePerSqft,
  calculateNOI,
  calculateCashOnCash,
  calculateDSCR,
  calculateGRM,
  calculateValueFromCapRate,
  calculateOccupancyRate,
  calculateAnnualFromMonthly,
  roundToDecimals,
  validateCapRate,
  validatePricePerSqft,
} from './calculationService';

// ============================================================================
// Validation Helper Tests
// ============================================================================

describe('isValidNumber', () => {
  it('returns true for valid numbers', () => {
    expect(isValidNumber(0)).toBe(true);
    expect(isValidNumber(100)).toBe(true);
    expect(isValidNumber(-50)).toBe(true);
    expect(isValidNumber(3.14159)).toBe(true);
    expect(isValidNumber(0.001)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isValidNumber(NaN)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(isValidNumber(Infinity)).toBe(false);
    expect(isValidNumber(-Infinity)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(isValidNumber(undefined)).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber('100')).toBe(false);
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber({})).toBe(false);
    expect(isValidNumber([])).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('returns true for positive numbers', () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(0.001)).toBe(true);
    expect(isPositiveNumber(1000000)).toBe(true);
  });

  it('returns false for zero', () => {
    expect(isPositiveNumber(0)).toBe(false);
  });

  it('returns false for negative numbers', () => {
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(-0.001)).toBe(false);
  });

  it('returns false for invalid values', () => {
    expect(isPositiveNumber(NaN)).toBe(false);
    expect(isPositiveNumber(Infinity)).toBe(false);
    expect(isPositiveNumber(null)).toBe(false);
  });
});

describe('isNonNegativeNumber', () => {
  it('returns true for zero and positive numbers', () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(1)).toBe(true);
    expect(isNonNegativeNumber(0.001)).toBe(true);
  });

  it('returns false for negative numbers', () => {
    expect(isNonNegativeNumber(-1)).toBe(false);
    expect(isNonNegativeNumber(-0.001)).toBe(false);
  });
});

// ============================================================================
// CAP Rate Tests
// ============================================================================

describe('calculateCapRate', () => {
  describe('valid calculations', () => {
    it('calculates CAP rate correctly for typical values', () => {
      // $100,000 NOI / $2,000,000 price = 5% CAP
      const result = calculateCapRate(100000, 2000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(5);
      expect(result.error).toBeUndefined();
    });

    it('calculates CAP rate with decimal precision', () => {
      // $150,000 NOI / $2,500,000 price = 6% CAP
      const result = calculateCapRate(150000, 2500000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(6);
    });

    it('handles high CAP rate deals', () => {
      // $200,000 NOI / $2,000,000 price = 10% CAP
      const result = calculateCapRate(200000, 2000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(10);
    });

    it('handles low CAP rate deals', () => {
      // $80,000 NOI / $2,000,000 price = 4% CAP
      const result = calculateCapRate(80000, 2000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(4);
    });

    it('handles zero NOI (vacant property)', () => {
      const result = calculateCapRate(0, 2000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(0);
    });
  });

  describe('edge cases and warnings', () => {
    it('warns for unusually high CAP rate (>50%)', () => {
      // This would be an unusually high return
      const result = calculateCapRate(1200000, 2000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(60);
      expect(result.error).toContain('outside typical range');
    });

    it('handles negative NOI', () => {
      // Property operating at a loss
      const result = calculateCapRate(-50000, 2000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(-2.5);
      expect(result.error).toContain('outside typical range');
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero purchase price (division by zero)', () => {
      const result = calculateCapRate(100000, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('positive number');
    });

    it('rejects negative purchase price', () => {
      const result = calculateCapRate(100000, -2000000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('positive number');
    });

    it('rejects NaN values', () => {
      expect(calculateCapRate(NaN, 2000000).isValid).toBe(false);
      expect(calculateCapRate(100000, NaN).isValid).toBe(false);
    });

    it('rejects undefined values', () => {
      expect(calculateCapRate(undefined, 2000000).isValid).toBe(false);
      expect(calculateCapRate(100000, undefined).isValid).toBe(false);
    });

    it('rejects null values', () => {
      expect(calculateCapRate(null, 2000000).isValid).toBe(false);
      expect(calculateCapRate(100000, null).isValid).toBe(false);
    });

    it('rejects string values', () => {
      expect(calculateCapRate('100000', 2000000).isValid).toBe(false);
      expect(calculateCapRate(100000, '2000000').isValid).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(calculateCapRate(Infinity, 2000000).isValid).toBe(false);
      expect(calculateCapRate(100000, Infinity).isValid).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('Inland Empire warehouse - typical deal', () => {
      // $500K NOI, $7.5M sale = 6.67% CAP
      const result = calculateCapRate(500000, 7500000);
      expect(result.isValid).toBe(true);
      expect(roundToDecimals(result.value, 2)).toBe(6.67);
    });

    it('Class A distribution center - low CAP', () => {
      // $1.2M NOI, $30M sale = 4% CAP (premium property)
      const result = calculateCapRate(1200000, 30000000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(4);
    });

    it('Older flex space - higher CAP', () => {
      // $200K NOI, $2.5M sale = 8% CAP
      const result = calculateCapRate(200000, 2500000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(8);
    });
  });
});

// ============================================================================
// Price Per Square Foot Tests
// ============================================================================

describe('calculatePricePerSqft', () => {
  describe('valid calculations', () => {
    it('calculates price per sqft correctly', () => {
      // $2,000,000 / 10,000 SF = $200/SF
      const result = calculatePricePerSqft(2000000, 10000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(200);
    });

    it('handles large properties', () => {
      // $50,000,000 / 500,000 SF = $100/SF
      const result = calculatePricePerSqft(50000000, 500000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(100);
    });

    it('handles small properties', () => {
      // $500,000 / 2,500 SF = $200/SF
      const result = calculatePricePerSqft(500000, 2500);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(200);
    });

    it('handles decimal results', () => {
      // $1,000,000 / 7,500 SF = $133.33/SF
      const result = calculatePricePerSqft(1000000, 7500);
      expect(result.isValid).toBe(true);
      expect(roundToDecimals(result.value, 2)).toBe(133.33);
    });

    it('handles zero price (land or distressed)', () => {
      const result = calculatePricePerSqft(0, 10000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(0);
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero square footage (division by zero)', () => {
      const result = calculatePricePerSqft(2000000, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('positive number');
    });

    it('rejects negative square footage', () => {
      const result = calculatePricePerSqft(2000000, -10000);
      expect(result.isValid).toBe(false);
    });

    it('rejects negative price', () => {
      const result = calculatePricePerSqft(-2000000, 10000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('rejects NaN values', () => {
      expect(calculatePricePerSqft(NaN, 10000).isValid).toBe(false);
      expect(calculatePricePerSqft(2000000, NaN).isValid).toBe(false);
    });

    it('rejects undefined/null values', () => {
      expect(calculatePricePerSqft(undefined, 10000).isValid).toBe(false);
      expect(calculatePricePerSqft(2000000, null).isValid).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('Class A industrial - Inland Empire', () => {
      // $15M / 50,000 SF = $300/SF
      const result = calculatePricePerSqft(15000000, 50000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(300);
    });

    it('Older warehouse - value-add opportunity', () => {
      // $3.75M / 25,000 SF = $150/SF
      const result = calculatePricePerSqft(3750000, 25000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(150);
    });
  });
});

// ============================================================================
// NOI Tests
// ============================================================================

describe('calculateNOI', () => {
  describe('valid calculations', () => {
    it('calculates NOI correctly', () => {
      // $500,000 gross - $150,000 expenses = $350,000 NOI
      const result = calculateNOI(500000, 150000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(350000);
    });

    it('handles zero expenses', () => {
      const result = calculateNOI(500000, 0);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(500000);
    });

    it('handles zero income (vacant property)', () => {
      const result = calculateNOI(0, 50000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(-50000); // Negative NOI is valid
    });

    it('handles expenses exceeding income', () => {
      // Results in negative NOI
      const result = calculateNOI(100000, 150000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(-50000);
    });
  });

  describe('invalid inputs', () => {
    it('rejects negative gross income', () => {
      const result = calculateNOI(-500000, 150000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-negative');
    });

    it('rejects negative expenses', () => {
      const result = calculateNOI(500000, -150000);
      expect(result.isValid).toBe(false);
    });

    it('rejects NaN values', () => {
      expect(calculateNOI(NaN, 150000).isValid).toBe(false);
      expect(calculateNOI(500000, NaN).isValid).toBe(false);
    });
  });
});

// ============================================================================
// Cash on Cash Return Tests
// ============================================================================

describe('calculateCashOnCash', () => {
  describe('valid calculations', () => {
    it('calculates cash on cash correctly', () => {
      // $50,000 annual cash flow / $500,000 invested = 10%
      const result = calculateCashOnCash(50000, 500000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(10);
    });

    it('handles negative cash flow', () => {
      // Property losing money
      const result = calculateCashOnCash(-20000, 500000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(-4);
    });

    it('handles zero cash flow (break even)', () => {
      const result = calculateCashOnCash(0, 500000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(0);
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero investment (division by zero)', () => {
      const result = calculateCashOnCash(50000, 0);
      expect(result.isValid).toBe(false);
    });

    it('rejects negative investment', () => {
      const result = calculateCashOnCash(50000, -500000);
      expect(result.isValid).toBe(false);
    });
  });
});

// ============================================================================
// DSCR Tests
// ============================================================================

describe('calculateDSCR', () => {
  describe('valid calculations', () => {
    it('calculates DSCR correctly for qualifying loan', () => {
      // $150,000 NOI / $100,000 debt service = 1.50 DSCR
      const result = calculateDSCR(150000, 100000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1.5);
      expect(result.error).toBeUndefined();
    });

    it('warns when DSCR is below lender threshold', () => {
      // $110,000 NOI / $100,000 debt service = 1.10 DSCR
      const result = calculateDSCR(110000, 100000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1.1);
      expect(result.error).toContain('below typical lender requirement');
    });

    it('handles negative NOI (property in distress)', () => {
      const result = calculateDSCR(-50000, 100000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(-0.5);
      expect(result.error).toContain('below typical lender requirement');
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero debt service', () => {
      const result = calculateDSCR(150000, 0);
      expect(result.isValid).toBe(false);
    });
  });
});

// ============================================================================
// GRM Tests
// ============================================================================

describe('calculateGRM', () => {
  describe('valid calculations', () => {
    it('calculates GRM correctly', () => {
      // $2,000,000 price / $200,000 annual rent = 10 GRM
      const result = calculateGRM(2000000, 200000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(10);
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero rent', () => {
      const result = calculateGRM(2000000, 0);
      expect(result.isValid).toBe(false);
    });

    it('rejects zero price', () => {
      const result = calculateGRM(0, 200000);
      expect(result.isValid).toBe(false);
    });
  });
});

// ============================================================================
// Value from CAP Rate Tests
// ============================================================================

describe('calculateValueFromCapRate', () => {
  describe('valid calculations', () => {
    it('calculates value correctly', () => {
      // $100,000 NOI / 5% CAP = $2,000,000 value
      const result = calculateValueFromCapRate(100000, 5);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(2000000);
    });

    it('handles high CAP rate', () => {
      // $100,000 NOI / 10% CAP = $1,000,000 value
      const result = calculateValueFromCapRate(100000, 10);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1000000);
    });

    it('handles low CAP rate (premium property)', () => {
      // $100,000 NOI / 4% CAP = $2,500,000 value
      const result = calculateValueFromCapRate(100000, 4);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(2500000);
    });
  });

  describe('invalid inputs', () => {
    it('rejects zero CAP rate (division by zero)', () => {
      const result = calculateValueFromCapRate(100000, 0);
      expect(result.isValid).toBe(false);
    });

    it('rejects CAP rate over 100%', () => {
      const result = calculateValueFromCapRate(100000, 150);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceed 100%');
    });
  });
});

// ============================================================================
// Occupancy Rate Tests
// ============================================================================

describe('calculateOccupancyRate', () => {
  describe('valid calculations', () => {
    it('calculates 100% occupancy', () => {
      const result = calculateOccupancyRate(50000, 50000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(100);
    });

    it('calculates partial occupancy', () => {
      // 40,000 / 50,000 = 80%
      const result = calculateOccupancyRate(40000, 50000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(80);
    });

    it('calculates vacant property', () => {
      const result = calculateOccupancyRate(0, 50000);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(0);
    });
  });

  describe('invalid inputs', () => {
    it('rejects occupied exceeding total', () => {
      const result = calculateOccupancyRate(60000, 50000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot exceed total');
    });

    it('rejects zero total sqft', () => {
      const result = calculateOccupancyRate(0, 0);
      expect(result.isValid).toBe(false);
    });

    it('rejects negative values', () => {
      expect(calculateOccupancyRate(-1000, 50000).isValid).toBe(false);
      expect(calculateOccupancyRate(1000, -50000).isValid).toBe(false);
    });
  });
});

// ============================================================================
// Annual from Monthly Tests
// ============================================================================

describe('calculateAnnualFromMonthly', () => {
  it('converts monthly to annual correctly', () => {
    const result = calculateAnnualFromMonthly(5000);
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(60000);
  });

  it('handles zero', () => {
    const result = calculateAnnualFromMonthly(0);
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(0);
  });

  it('rejects negative values', () => {
    const result = calculateAnnualFromMonthly(-5000);
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(calculateAnnualFromMonthly(NaN).isValid).toBe(false);
    expect(calculateAnnualFromMonthly(null).isValid).toBe(false);
  });
});

// ============================================================================
// Rounding Tests
// ============================================================================

describe('roundToDecimals', () => {
  it('rounds to 2 decimals by default', () => {
    expect(roundToDecimals(3.14159)).toBe(3.14);
    expect(roundToDecimals(3.145)).toBe(3.15);
    expect(roundToDecimals(3.144)).toBe(3.14);
  });

  it('rounds to specified decimals', () => {
    expect(roundToDecimals(3.14159, 3)).toBe(3.142);
    expect(roundToDecimals(3.14159, 4)).toBe(3.1416);
    expect(roundToDecimals(3.14159, 0)).toBe(3);
  });

  it('handles invalid input', () => {
    expect(roundToDecimals(NaN)).toBe(0);
    expect(roundToDecimals(Infinity)).toBe(0);
  });
});

// ============================================================================
// CAP Rate Validation Tests
// ============================================================================

describe('validateCapRate', () => {
  it('validates normal CAP rates', () => {
    expect(validateCapRate(5).isValid).toBe(true);
    expect(validateCapRate(5).error).toBeUndefined();
  });

  it('warns for unusually low CAP rates', () => {
    const result = validateCapRate(1.5);
    expect(result.isValid).toBe(true);
    expect(result.error).toContain('outside typical range');
  });

  it('warns for unusually high CAP rates', () => {
    const result = validateCapRate(25);
    expect(result.isValid).toBe(true);
    expect(result.error).toContain('outside typical range');
  });

  it('rejects negative CAP rates', () => {
    expect(validateCapRate(-5).isValid).toBe(false);
  });

  it('rejects CAP rates over 100%', () => {
    expect(validateCapRate(150).isValid).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(validateCapRate(NaN).isValid).toBe(false);
    expect(validateCapRate(null).isValid).toBe(false);
  });
});

// ============================================================================
// Price Per Sqft Validation Tests
// ============================================================================

describe('validatePricePerSqft', () => {
  it('validates normal price per sqft', () => {
    expect(validatePricePerSqft(200).isValid).toBe(true);
    expect(validatePricePerSqft(200).error).toBeUndefined();
  });

  it('warns for unusually low prices', () => {
    const result = validatePricePerSqft(5);
    expect(result.isValid).toBe(true);
    expect(result.error).toContain('outside typical range');
  });

  it('warns for unusually high prices', () => {
    const result = validatePricePerSqft(3000);
    expect(result.isValid).toBe(true);
    expect(result.error).toContain('outside typical range');
  });

  it('rejects negative prices', () => {
    expect(validatePricePerSqft(-100).isValid).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(validatePricePerSqft(NaN).isValid).toBe(false);
    expect(validatePricePerSqft(null).isValid).toBe(false);
  });
});

// ============================================================================
// Floating Point Precision Tests
// ============================================================================

describe('floating point precision', () => {
  it('handles common floating point issues', () => {
    // Classic 0.1 + 0.2 !== 0.3 issue
    const pricePerSqft = 0.1 + 0.2;
    const result = calculatePricePerSqft(pricePerSqft * 10000, 10000);
    expect(result.isValid).toBe(true);
    // Result should be close to 0.3
    expect(Math.abs(result.value - 0.3)).toBeLessThan(0.0001);
  });

  it('handles very large numbers', () => {
    // $100M property
    const result = calculatePricePerSqft(100000000, 500000);
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(200);
  });

  it('handles very small numbers', () => {
    const result = calculateCapRate(1000, 100000);
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(1);
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('integrated calculations - full deal analysis', () => {
  it('analyzes a complete deal correctly', () => {
    // Scenario: 50,000 SF warehouse
    // Gross income: $600,000/year
    // Operating expenses: $100,000/year
    // Asking price: $10,000,000

    // Step 1: Calculate NOI
    const noiResult = calculateNOI(600000, 100000);
    expect(noiResult.isValid).toBe(true);
    expect(noiResult.value).toBe(500000);

    // Step 2: Calculate CAP rate at asking price
    const capResult = calculateCapRate(noiResult.value, 10000000);
    expect(capResult.isValid).toBe(true);
    expect(capResult.value).toBe(5);

    // Step 3: Calculate price per sqft
    const psfResult = calculatePricePerSqft(10000000, 50000);
    expect(psfResult.isValid).toBe(true);
    expect(psfResult.value).toBe(200);

    // Step 4: Calculate value at target 6% CAP
    const valueAt6Cap = calculateValueFromCapRate(noiResult.value, 6);
    expect(valueAt6Cap.isValid).toBe(true);
    expect(roundToDecimals(valueAt6Cap.value, 0)).toBe(8333333);
  });

  it('handles leveraged investment analysis', () => {
    // $10M purchase, 30% down ($3M), $7M loan
    // NOI: $500K, Debt service: $400K

    // DSCR
    const dscrResult = calculateDSCR(500000, 400000);
    expect(dscrResult.isValid).toBe(true);
    expect(dscrResult.value).toBe(1.25);

    // Cash flow after debt service
    const annualCashFlow = 500000 - 400000; // $100K

    // Cash on cash
    const cocResult = calculateCashOnCash(annualCashFlow, 3000000);
    expect(cocResult.isValid).toBe(true);
    expect(roundToDecimals(cocResult.value, 2)).toBe(3.33);
  });
});
