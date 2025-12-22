import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui';
import {
  calculateValueFromCapRate,
  formatCurrency,
  formatPercent,
  generateProjections,
  calculateSaleProceeds,
  buildIRRCashFlows,
  calculateIRR,
} from '../utils/financialCalculations';

interface SensitivityTableProps {
  noi: number;
  purchasePrice: number;
  askingCapRate: number;
  // For IRR sensitivity
  initialIncome: number;
  initialExpenses: number;
  loanAmount: number;
  interestRate: number;
  amortizationYears: number;
  totalCashInvested: number;
  holdingPeriod?: number;
}

export default function SensitivityTable({
  noi,
  purchasePrice,
  askingCapRate,
  initialIncome,
  initialExpenses,
  loanAmount,
  interestRate,
  amortizationYears,
  totalCashInvested,
  holdingPeriod = 10,
}: SensitivityTableProps) {
  // Cap rate scenarios for valuation sensitivity
  const capRateScenarios = useMemo(() => {
    // Generate cap rates around the asking cap rate
    const baseRate = Math.round(askingCapRate * 2) / 2; // Round to nearest 0.5
    const rates = [
      baseRate - 1.5,
      baseRate - 1.0,
      baseRate - 0.5,
      baseRate,
      baseRate + 0.5,
      baseRate + 1.0,
      baseRate + 1.5,
    ].filter(r => r > 0);

    return rates.map(capRate => {
      const value = calculateValueFromCapRate(noi, capRate);
      const vsAsk = ((value - purchasePrice) / purchasePrice) * 100;

      return {
        capRate,
        value,
        vsAsk,
        isAskingRate: Math.abs(capRate - askingCapRate) < 0.1,
      };
    });
  }, [noi, purchasePrice, askingCapRate]);

  // Exit cap rate sensitivity for IRR
  const exitCapSensitivity = useMemo(() => {
    if (initialIncome <= 0 || totalCashInvested <= 0) return [];

    const exitCapRates = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];
    const incomeGrowthRate = 3; // Default assumption
    const expenseGrowthRate = 2;
    const sellingCosts = 2;

    return exitCapRates.map(exitCapRate => {
      const projections = generateProjections({
        initialIncome,
        initialExpenses,
        incomeGrowthRate,
        expenseGrowthRate,
        purchasePrice,
        loanAmount,
        interestRate,
        amortizationYears,
        holdingPeriod,
        exitCapRate,
        sellingCosts,
      });

      if (projections.length === 0) return { exitCapRate, irr: 0, salePrice: 0 };

      const lastYear = projections[projections.length - 1];
      const exitNOI = lastYear.noi * (1 + incomeGrowthRate / 100);
      const exitSale = calculateSaleProceeds(exitNOI, exitCapRate, lastYear.loanBalance, sellingCosts);
      const cashFlows = buildIRRCashFlows(totalCashInvested, projections, exitSale.netToSeller);
      const irr = calculateIRR(cashFlows);

      return {
        exitCapRate,
        irr,
        salePrice: exitSale.salePrice,
        netProceeds: exitSale.netToSeller,
      };
    });
  }, [initialIncome, initialExpenses, purchasePrice, loanAmount, interestRate, amortizationYears, totalCashInvested, holdingPeriod]);

  // Income growth sensitivity for IRR
  const growthSensitivity = useMemo(() => {
    if (initialIncome <= 0 || totalCashInvested <= 0) return [];

    const growthRates = [1.0, 2.0, 3.0, 4.0, 5.0];
    const exitCapRate = 6.5; // Default assumption
    const expenseGrowthRate = 2;
    const sellingCosts = 2;

    return growthRates.map(incomeGrowthRate => {
      const projections = generateProjections({
        initialIncome,
        initialExpenses,
        incomeGrowthRate,
        expenseGrowthRate,
        purchasePrice,
        loanAmount,
        interestRate,
        amortizationYears,
        holdingPeriod,
        exitCapRate,
        sellingCosts,
      });

      if (projections.length === 0) return { growthRate: incomeGrowthRate, irr: 0 };

      const lastYear = projections[projections.length - 1];
      const exitNOI = lastYear.noi * (1 + incomeGrowthRate / 100);
      const exitSale = calculateSaleProceeds(exitNOI, exitCapRate, lastYear.loanBalance, sellingCosts);
      const cashFlows = buildIRRCashFlows(totalCashInvested, projections, exitSale.netToSeller);
      const irr = calculateIRR(cashFlows);

      const totalCashFlow = projections.reduce((sum, p) => sum + p.cashFlow, 0);

      return {
        growthRate: incomeGrowthRate,
        irr,
        totalCashFlow,
        exitValue: exitSale.salePrice,
      };
    });
  }, [initialIncome, initialExpenses, purchasePrice, loanAmount, interestRate, amortizationYears, totalCashInvested, holdingPeriod]);

  // 2D Matrix: Exit Cap vs Income Growth
  const irrMatrix = useMemo(() => {
    if (initialIncome <= 0 || totalCashInvested <= 0) return { exitCaps: [], growthRates: [], values: [] };

    const exitCaps = [5.5, 6.0, 6.5, 7.0, 7.5];
    const growthRates = [2.0, 2.5, 3.0, 3.5, 4.0];
    const expenseGrowthRate = 2;
    const sellingCosts = 2;

    const values: number[][] = [];

    growthRates.forEach(incomeGrowthRate => {
      const row: number[] = [];
      exitCaps.forEach(exitCapRate => {
        const projections = generateProjections({
          initialIncome,
          initialExpenses,
          incomeGrowthRate,
          expenseGrowthRate,
          purchasePrice,
          loanAmount,
          interestRate,
          amortizationYears,
          holdingPeriod,
          exitCapRate,
          sellingCosts,
        });

        if (projections.length === 0) {
          row.push(0);
          return;
        }

        const lastYear = projections[projections.length - 1];
        const exitNOI = lastYear.noi * (1 + incomeGrowthRate / 100);
        const exitSale = calculateSaleProceeds(exitNOI, exitCapRate, lastYear.loanBalance, sellingCosts);
        const cashFlows = buildIRRCashFlows(totalCashInvested, projections, exitSale.netToSeller);
        const irr = calculateIRR(cashFlows);
        row.push(irr);
      });
      values.push(row);
    });

    return { exitCaps, growthRates, values };
  }, [initialIncome, initialExpenses, purchasePrice, loanAmount, interestRate, amortizationYears, totalCashInvested, holdingPeriod]);

  if (noi <= 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          <p>Enter income and expense data to see sensitivity analysis</p>
        </CardContent>
      </Card>
    );
  }

  const getIRRColor = (irr: number) => {
    if (irr >= 15) return 'bg-green-100 text-green-800';
    if (irr >= 12) return 'bg-green-50 text-green-700';
    if (irr >= 10) return 'bg-yellow-50 text-yellow-700';
    if (irr >= 8) return 'bg-orange-50 text-orange-700';
    return 'bg-red-50 text-red-700';
  };

  const getValueColor = (vsAsk: number) => {
    if (vsAsk >= 20) return 'text-green-600 font-semibold';
    if (vsAsk >= 10) return 'text-green-500';
    if (vsAsk >= 0) return 'text-gray-600';
    if (vsAsk >= -10) return 'text-orange-500';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="space-y-6">
      {/* Cap Rate Sensitivity - Property Value */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cap Rate Sensitivity - Property Value</CardTitle>
          <p className="text-sm text-gray-500">How property value changes at different cap rates</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Cap Rate</th>
                  {capRateScenarios.map(s => (
                    <th
                      key={s.capRate}
                      className={`px-4 py-3 text-center font-semibold ${
                        s.isAskingRate ? 'bg-primary-100 text-primary-700' : 'text-gray-600'
                      }`}
                    >
                      {s.capRate.toFixed(1)}%
                      {s.isAskingRate && <span className="block text-xs font-normal">(Current)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-700">Property Value</td>
                  {capRateScenarios.map(s => (
                    <td
                      key={s.capRate}
                      className={`px-4 py-3 text-center ${s.isAskingRate ? 'bg-primary-50' : ''}`}
                    >
                      {formatCurrency(s.value)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-700">vs. Asking Price</td>
                  {capRateScenarios.map(s => (
                    <td
                      key={s.capRate}
                      className={`px-4 py-3 text-center ${s.isAskingRate ? 'bg-primary-50' : ''} ${getValueColor(s.vsAsk)}`}
                    >
                      {s.vsAsk >= 0 ? '+' : ''}{s.vsAsk.toFixed(1)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Exit Cap Rate Sensitivity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exit Cap Rate Sensitivity</CardTitle>
          <p className="text-sm text-gray-500">IRR at different exit cap rates (assumes 3% income growth)</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Exit Cap</th>
                  {exitCapSensitivity.map(s => (
                    <th key={s.exitCapRate} className="px-4 py-3 text-center font-semibold text-gray-600">
                      {s.exitCapRate.toFixed(1)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-700">Sale Price</td>
                  {exitCapSensitivity.map(s => (
                    <td key={s.exitCapRate} className="px-4 py-3 text-center text-gray-600">
                      {formatCurrency(s.salePrice)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-700">Net Proceeds</td>
                  {exitCapSensitivity.map(s => (
                    <td key={s.exitCapRate} className="px-4 py-3 text-center text-gray-600">
                      {formatCurrency(s.netProceeds)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-700">IRR</td>
                  {exitCapSensitivity.map(s => (
                    <td key={s.exitCapRate} className={`px-4 py-3 text-center font-semibold ${getIRRColor(s.irr)}`}>
                      {formatPercent(s.irr)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Income Growth Sensitivity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Income Growth Sensitivity</CardTitle>
          <p className="text-sm text-gray-500">IRR at different annual rent growth rates (assumes 6.5% exit cap)</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Rent Growth</th>
                  {growthSensitivity.map(s => (
                    <th key={s.growthRate} className="px-4 py-3 text-center font-semibold text-gray-600">
                      {s.growthRate.toFixed(1)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-700">Total Cash Flow</td>
                  {growthSensitivity.map(s => (
                    <td key={s.growthRate} className="px-4 py-3 text-center text-gray-600">
                      {formatCurrency(s.totalCashFlow)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-700">Exit Value</td>
                  {growthSensitivity.map(s => (
                    <td key={s.growthRate} className="px-4 py-3 text-center text-gray-600">
                      {formatCurrency(s.exitValue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-700">IRR</td>
                  {growthSensitivity.map(s => (
                    <td key={s.growthRate} className={`px-4 py-3 text-center font-semibold ${getIRRColor(s.irr)}`}>
                      {formatPercent(s.irr)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 2D IRR Matrix */}
      <Card variant="elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">IRR Sensitivity Matrix</CardTitle>
          <p className="text-sm text-gray-500">IRR at various exit cap rates and income growth combinations</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Growth / Exit Cap
                  </th>
                  {irrMatrix.exitCaps.map(cap => (
                    <th key={cap} className="px-4 py-3 text-center font-semibold text-gray-600">
                      {cap.toFixed(1)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {irrMatrix.growthRates.map((growth, rowIdx) => (
                  <tr key={growth}>
                    <td className="px-4 py-3 font-medium text-gray-700 bg-gray-50">
                      {growth.toFixed(1)}% Growth
                    </td>
                    {irrMatrix.values[rowIdx]?.map((irr, colIdx) => (
                      <td
                        key={irrMatrix.exitCaps[colIdx]}
                        className={`px-4 py-3 text-center font-semibold ${getIRRColor(irr)}`}
                      >
                        {formatPercent(irr)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100"></span> 15%+ IRR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-50"></span> 12-15% IRR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-50"></span> 10-12% IRR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-orange-50"></span> 8-10% IRR
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-50"></span> &lt;8% IRR
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
