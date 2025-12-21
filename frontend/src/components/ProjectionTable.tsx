import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Input } from './ui';
import {
  generateProjections,
  calculateSaleProceeds,
  calculateIRR,
  calculateEquityMultiple,
  buildIRRCashFlows,
  formatCurrency,
  formatPercent,
} from '../utils/financialCalculations';

interface ProjectionTableProps {
  // Initial values from deal analysis
  initialIncome: number; // EGI
  initialExpenses: number; // Total Operating Expenses
  purchasePrice: number;
  loanAmount: number;
  interestRate: number;
  amortizationYears: number;
  totalCashInvested: number; // Down payment + closing costs
}

export default function ProjectionTable({
  initialIncome,
  initialExpenses,
  purchasePrice,
  loanAmount,
  interestRate,
  amortizationYears,
  totalCashInvested,
}: ProjectionTableProps) {
  // Projection inputs
  const [incomeGrowth, setIncomeGrowth] = useState(3);
  const [expenseGrowth, setExpenseGrowth] = useState(2);
  const [holdingPeriod, setHoldingPeriod] = useState(10);
  const [exitCapRate, setExitCapRate] = useState(6.5);
  const [sellingCosts, setSellingCosts] = useState(2);

  // Calculate projections
  const projections = useMemo(() => {
    if (initialIncome <= 0) return [];

    return generateProjections({
      initialIncome,
      initialExpenses,
      incomeGrowthRate: incomeGrowth,
      expenseGrowthRate: expenseGrowth,
      purchasePrice,
      loanAmount,
      interestRate,
      amortizationYears,
      holdingPeriod,
      exitCapRate,
      sellingCosts,
    });
  }, [
    initialIncome,
    initialExpenses,
    incomeGrowth,
    expenseGrowth,
    purchasePrice,
    loanAmount,
    interestRate,
    amortizationYears,
    holdingPeriod,
    exitCapRate,
    sellingCosts,
  ]);

  // Calculate exit sale
  const exitSale = useMemo(() => {
    if (projections.length === 0) return null;

    const lastYear = projections[projections.length - 1];
    // Exit NOI = Year after holding period (one more year of growth)
    const exitNOI = lastYear.noi * (1 + incomeGrowth / 100);

    return calculateSaleProceeds(
      exitNOI,
      exitCapRate,
      lastYear.loanBalance,
      sellingCosts
    );
  }, [projections, exitCapRate, sellingCosts, incomeGrowth]);

  // Calculate IRR and Equity Multiple
  const returns = useMemo(() => {
    if (projections.length === 0 || !exitSale || totalCashInvested <= 0) {
      return { irr: 0, equityMultiple: 0, totalCashFlow: 0 };
    }

    const cashFlows = buildIRRCashFlows(
      totalCashInvested,
      projections,
      exitSale.netToSeller
    );

    const irr = calculateIRR(cashFlows);
    const totalCashFlow = projections.reduce((sum, p) => sum + p.cashFlow, 0);
    const equityMultiple = calculateEquityMultiple(
      totalCashInvested,
      totalCashFlow,
      exitSale.netToSeller
    );

    return { irr, equityMultiple, totalCashFlow };
  }, [projections, exitSale, totalCashInvested]);

  if (initialIncome <= 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          <p>Enter income data in the Proforma tab to see projections</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Projection Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Projection Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Income Growth
              </label>
              <div className="flex items-center">
                <Input
                  type="number"
                  value={incomeGrowth}
                  onChange={(e) => setIncomeGrowth(parseFloat(e.target.value) || 0)}
                  className="text-center"
                  step="0.5"
                />
                <span className="ml-1 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Expense Growth
              </label>
              <div className="flex items-center">
                <Input
                  type="number"
                  value={expenseGrowth}
                  onChange={(e) => setExpenseGrowth(parseFloat(e.target.value) || 0)}
                  className="text-center"
                  step="0.5"
                />
                <span className="ml-1 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Holding Period
              </label>
              <div className="flex items-center">
                <Input
                  type="number"
                  value={holdingPeriod}
                  onChange={(e) => setHoldingPeriod(parseInt(e.target.value) || 5)}
                  className="text-center"
                  min="1"
                  max="30"
                />
                <span className="ml-1 text-gray-500">yrs</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Exit Cap Rate
              </label>
              <div className="flex items-center">
                <Input
                  type="number"
                  value={exitCapRate}
                  onChange={(e) => setExitCapRate(parseFloat(e.target.value) || 0)}
                  className="text-center"
                  step="0.25"
                />
                <span className="ml-1 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Selling Costs
              </label>
              <div className="flex items-center">
                <Input
                  type="number"
                  value={sellingCosts}
                  onChange={(e) => setSellingCosts(parseFloat(e.target.value) || 0)}
                  className="text-center"
                  step="0.5"
                />
                <span className="ml-1 text-gray-500">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returns Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <CardContent className="py-4">
            <p className="text-primary-100 text-xs uppercase tracking-wide">IRR</p>
            <p className="text-2xl font-bold">{formatPercent(returns.irr)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="py-4">
            <p className="text-green-100 text-xs uppercase tracking-wide">Equity Multiple</p>
            <p className="text-2xl font-bold">{returns.equityMultiple.toFixed(2)}x</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Total Cash Flow</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(returns.totalCashFlow)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Net Sale Proceeds</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(exitSale?.netToSeller || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Year-by-Year Projection Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{holdingPeriod}-Year Cash Flow Projection</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Year</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Income</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Expenses</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">NOI</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Debt Service</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Cash Flow</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Loan Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projections.map((year, idx) => (
                  <tr
                    key={year.year}
                    className={idx === projections.length - 1 ? 'bg-primary-50' : ''}
                  >
                    <td className="px-4 py-2 font-medium">
                      {year.year}
                      {idx === projections.length - 1 && (
                        <span className="ml-1 text-xs text-primary-600">(Exit)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(year.income)}</td>
                    <td className="px-4 py-2 text-right text-red-600">({formatCurrency(year.expenses)})</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(year.noi)}</td>
                    <td className="px-4 py-2 text-right text-red-600">({formatCurrency(year.debtService)})</td>
                    <td className={`px-4 py-2 text-right font-medium ${year.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(year.cashFlow)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(year.loanBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Exit Sale Summary */}
      {exitSale && (
        <Card variant="elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Exit Sale Analysis (Year {holdingPeriod})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sale Price</p>
                <p className="text-lg font-semibold">{formatCurrency(exitSale.salePrice)}</p>
                <p className="text-xs text-gray-400">
                  Based on {formatPercent(exitCapRate)} exit cap
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Selling Costs</p>
                <p className="text-lg font-semibold text-red-600">({formatCurrency(exitSale.sellingCosts)})</p>
                <p className="text-xs text-gray-400">{sellingCosts}% of sale price</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Loan Payoff</p>
                <p className="text-lg font-semibold text-red-600">({formatCurrency(exitSale.loanPayoff)})</p>
                <p className="text-xs text-gray-400">Remaining balance</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Proceeds to Seller</p>
                  <p className="text-xs text-gray-400">Sale Price - Costs - Loan Payoff</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(exitSale.netToSeller)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Summary */}
      <Card className="bg-gray-50">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase">Initial Investment</p>
              <p className="font-semibold">{formatCurrency(totalCashInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Cash Distributed</p>
              <p className="font-semibold">{formatCurrency(returns.totalCashFlow + (exitSale?.netToSeller || 0))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Profit</p>
              <p className="font-semibold text-green-600">
                {formatCurrency(returns.totalCashFlow + (exitSale?.netToSeller || 0) - totalCashInvested)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Avg Annual Cash Flow</p>
              <p className="font-semibold">{formatCurrency(returns.totalCashFlow / holdingPeriod)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
