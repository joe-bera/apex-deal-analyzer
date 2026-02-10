import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from './ui';
import type { Property, Comp, DealAnalysis } from '../types';
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
  calculateNPV,
  buildIRRCashFlows,
  generateProjections,
  parseNumberInput,
  formatCurrency,
  formatPercent,
  formatRatio,
  STRATEGY_THRESHOLDS,
  suggestExitCapRate,
  benchmarkPricePerSqft,
  solveMaxPurchasePrice,
  solveRequiredNOILift,
  solveRequiredRentPSF,
  solveCapexCeiling,
  solveTargetExitCap,
} from '../utils/financialCalculations';
import type { InvestmentStrategy } from '../utils/financialCalculations';

type TabType = 'summary' | 'strategy' | 'valueadd' | 'proforma' | 'exit' | 'decision' | 'optimization';

interface InvestmentAnalysisProps {
  property: Property;
  comps?: Comp[];
  initialData?: Partial<DealAnalysis> | null;
  onSave?: (data: Partial<DealAnalysis>) => void;
  saving?: boolean;
}

// Value-add checkbox items
const VA_ITEMS = [
  { key: 'va_below_market_rents' as const, label: 'Below-Market Rents', noteKey: 'va_below_market_rents_note' as const },
  { key: 'va_vacancy_leaseup' as const, label: 'Vacancy / Lease-Up', noteKey: 'va_vacancy_leaseup_note' as const },
  { key: 'va_expense_reduction' as const, label: 'Expense Reduction', noteKey: 'va_expense_reduction_note' as const },
  { key: 'va_re_tenanting' as const, label: 'Re-Tenanting', noteKey: 'va_re_tenanting_note' as const },
  { key: 'va_physical_improvements' as const, label: 'Physical Improvements', noteKey: 'va_physical_improvements_note' as const },
];

export default function InvestmentAnalysis({
  property,
  comps = [],
  initialData,
  onSave,
  saving = false,
}: InvestmentAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [expanded, setExpanded] = useState(true);

  // ─── Form State ────────────────────────────────────────────────
  const [data, setData] = useState<Partial<DealAnalysis>>(() => ({
    // Income
    potential_gross_income: initialData?.potential_gross_income ?? property.gross_income ?? 0,
    vacancy_rate: initialData?.vacancy_rate ?? 5,
    other_income: initialData?.other_income ?? 0,
    // Expenses
    property_taxes: initialData?.property_taxes ?? 0,
    insurance: initialData?.insurance ?? 0,
    utilities: initialData?.utilities ?? 0,
    management_fee_percent: initialData?.management_fee_percent ?? 3,
    repairs_maintenance: initialData?.repairs_maintenance ?? 0,
    reserves_capex: initialData?.reserves_capex ?? 0,
    other_expenses: initialData?.other_expenses ?? 0,
    // Financing
    purchase_price: initialData?.purchase_price ?? property.price ?? 0,
    ltv_percent: initialData?.ltv_percent ?? 70,
    interest_rate: initialData?.interest_rate ?? 7,
    amortization_years: initialData?.amortization_years ?? 25,
    closing_costs_percent: initialData?.closing_costs_percent ?? 2,
    // Strategy
    investment_strategy: initialData?.investment_strategy ?? 'value_add',
    // Value-Add Attribution
    va_below_market_rents: initialData?.va_below_market_rents ?? false,
    va_below_market_rents_note: initialData?.va_below_market_rents_note ?? '',
    va_vacancy_leaseup: initialData?.va_vacancy_leaseup ?? false,
    va_vacancy_leaseup_note: initialData?.va_vacancy_leaseup_note ?? '',
    va_expense_reduction: initialData?.va_expense_reduction ?? false,
    va_expense_reduction_note: initialData?.va_expense_reduction_note ?? '',
    va_re_tenanting: initialData?.va_re_tenanting ?? false,
    va_re_tenanting_note: initialData?.va_re_tenanting_note ?? '',
    va_physical_improvements: initialData?.va_physical_improvements ?? false,
    va_physical_improvements_note: initialData?.va_physical_improvements_note ?? '',
    // As-Is vs Stabilized
    as_is_rent_psf: initialData?.as_is_rent_psf ?? 0,
    stabilized_rent_psf: initialData?.stabilized_rent_psf ?? 0,
    as_is_occupancy: initialData?.as_is_occupancy ?? (property.occupancy_rate ?? 0),
    stabilized_occupancy: initialData?.stabilized_occupancy ?? 95,
    as_is_other_income: initialData?.as_is_other_income ?? 0,
    stabilized_other_income: initialData?.stabilized_other_income ?? 0,
    as_is_expense_ratio: initialData?.as_is_expense_ratio ?? 0,
    stabilized_expense_ratio: initialData?.stabilized_expense_ratio ?? 0,
    // Value-Add Costs
    va_capex: initialData?.va_capex ?? 0,
    va_ti_leasing: initialData?.va_ti_leasing ?? 0,
    va_carry_costs: initialData?.va_carry_costs ?? 0,
    va_contingency: initialData?.va_contingency ?? 0,
    va_total_cost: initialData?.va_total_cost ?? 0,
    // Proforma Settings
    income_growth_rate: initialData?.income_growth_rate ?? 3,
    expense_growth_rate: initialData?.expense_growth_rate ?? 2.5,
    holding_period: initialData?.holding_period ?? 5,
    // Exit
    exit_cap_rate: initialData?.exit_cap_rate ?? (suggestExitCapRate(comps) ?? 6),
    selling_costs_percent: initialData?.selling_costs_percent ?? 2,
    // Notes
    notes: initialData?.notes ?? '',
  }));

  // Only sync initialData on first load (not after save responses, which would cause a loop)
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (initialData && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      setData(prev => ({
        ...prev,
        potential_gross_income: initialData.potential_gross_income ?? prev.potential_gross_income,
        vacancy_rate: initialData.vacancy_rate ?? prev.vacancy_rate,
        other_income: initialData.other_income ?? prev.other_income,
        property_taxes: initialData.property_taxes ?? prev.property_taxes,
        insurance: initialData.insurance ?? prev.insurance,
        utilities: initialData.utilities ?? prev.utilities,
        management_fee_percent: initialData.management_fee_percent ?? prev.management_fee_percent,
        repairs_maintenance: initialData.repairs_maintenance ?? prev.repairs_maintenance,
        reserves_capex: initialData.reserves_capex ?? prev.reserves_capex,
        other_expenses: initialData.other_expenses ?? prev.other_expenses,
        purchase_price: initialData.purchase_price ?? prev.purchase_price,
        ltv_percent: initialData.ltv_percent ?? prev.ltv_percent,
        interest_rate: initialData.interest_rate ?? prev.interest_rate,
        amortization_years: initialData.amortization_years ?? prev.amortization_years,
        closing_costs_percent: initialData.closing_costs_percent ?? prev.closing_costs_percent,
        investment_strategy: initialData.investment_strategy ?? prev.investment_strategy,
        va_below_market_rents: initialData.va_below_market_rents ?? prev.va_below_market_rents,
        va_below_market_rents_note: initialData.va_below_market_rents_note ?? prev.va_below_market_rents_note,
        va_vacancy_leaseup: initialData.va_vacancy_leaseup ?? prev.va_vacancy_leaseup,
        va_vacancy_leaseup_note: initialData.va_vacancy_leaseup_note ?? prev.va_vacancy_leaseup_note,
        va_expense_reduction: initialData.va_expense_reduction ?? prev.va_expense_reduction,
        va_expense_reduction_note: initialData.va_expense_reduction_note ?? prev.va_expense_reduction_note,
        va_re_tenanting: initialData.va_re_tenanting ?? prev.va_re_tenanting,
        va_re_tenanting_note: initialData.va_re_tenanting_note ?? prev.va_re_tenanting_note,
        va_physical_improvements: initialData.va_physical_improvements ?? prev.va_physical_improvements,
        va_physical_improvements_note: initialData.va_physical_improvements_note ?? prev.va_physical_improvements_note,
        as_is_rent_psf: initialData.as_is_rent_psf ?? prev.as_is_rent_psf,
        stabilized_rent_psf: initialData.stabilized_rent_psf ?? prev.stabilized_rent_psf,
        as_is_occupancy: initialData.as_is_occupancy ?? prev.as_is_occupancy,
        stabilized_occupancy: initialData.stabilized_occupancy ?? prev.stabilized_occupancy,
        as_is_other_income: initialData.as_is_other_income ?? prev.as_is_other_income,
        stabilized_other_income: initialData.stabilized_other_income ?? prev.stabilized_other_income,
        as_is_expense_ratio: initialData.as_is_expense_ratio ?? prev.as_is_expense_ratio,
        stabilized_expense_ratio: initialData.stabilized_expense_ratio ?? prev.stabilized_expense_ratio,
        va_capex: initialData.va_capex ?? prev.va_capex,
        va_ti_leasing: initialData.va_ti_leasing ?? prev.va_ti_leasing,
        va_carry_costs: initialData.va_carry_costs ?? prev.va_carry_costs,
        va_contingency: initialData.va_contingency ?? prev.va_contingency,
        va_total_cost: initialData.va_total_cost ?? prev.va_total_cost,
        income_growth_rate: initialData.income_growth_rate ?? prev.income_growth_rate,
        expense_growth_rate: initialData.expense_growth_rate ?? prev.expense_growth_rate,
        holding_period: initialData.holding_period ?? prev.holding_period,
        exit_cap_rate: initialData.exit_cap_rate ?? prev.exit_cap_rate,
        selling_costs_percent: initialData.selling_costs_percent ?? prev.selling_costs_percent,
        notes: initialData.notes ?? prev.notes,
      }));
    }
  }, [initialData]);

  // ─── Derived Calculations ──────────────────────────────────────

  const n = (v: number | null | undefined) => v ?? 0;

  const strategy = (data.investment_strategy ?? 'value_add') as InvestmentStrategy;
  const thresholds = STRATEGY_THRESHOLDS[strategy];

  // Income / Expense
  const pgi = n(data.potential_gross_income);
  const vacancyAmount = calculateVacancyAmount(pgi, n(data.vacancy_rate));
  const egi = calculateEffectiveGrossIncome(pgi, vacancyAmount, n(data.other_income));
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

  // Financing
  const purchasePrice = n(data.purchase_price);
  const loanAmount = calculateLoanAmount(purchasePrice, n(data.ltv_percent));
  const downPayment = calculateDownPayment(purchasePrice, loanAmount);
  const monthlyPmt = calculateMonthlyPayment(loanAmount, n(data.interest_rate), n(data.amortization_years));
  const annualDS = calculateAnnualDebtService(monthlyPmt);
  const closingCosts = calculateClosingCosts(purchasePrice, n(data.closing_costs_percent));
  const totalCashRequired = calculateTotalCashRequired(downPayment, closingCosts);
  const beforeTaxCF = calculateBeforeTaxCashFlow(noi, annualDS);
  const capRate = calculateCapRate(noi, purchasePrice);
  const pricePerSqft = calculatePricePerSqft(purchasePrice, property.building_size || 0);
  const dscr = calculateDSCR(noi, annualDS);

  // Value-Add totals
  const vaTotalCost = n(data.va_capex) + n(data.va_ti_leasing) + n(data.va_carry_costs) + n(data.va_contingency);
  const totalProjectCost = purchasePrice + closingCosts + vaTotalCost;

  // Projections
  const holdingPeriod = n(data.holding_period) || 5;
  const exitCapRate = n(data.exit_cap_rate) || 6;
  const sellingCostsPercent = n(data.selling_costs_percent) || 2;

  const projections = useMemo(() => generateProjections({
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
  }), [egi, totalExpenses, data.income_growth_rate, data.expense_growth_rate, purchasePrice, loanAmount, data.interest_rate, data.amortization_years, holdingPeriod, exitCapRate, sellingCostsPercent]);

  // Exit & Returns
  const lastYear = projections.length > 0 ? projections[projections.length - 1] : null;
  const exitNOI = lastYear?.noi ?? noi;
  const saleProceeds = calculateSaleProceeds(exitNOI, exitCapRate, lastYear?.loanBalance ?? loanAmount, sellingCostsPercent);
  const totalCashInvested = totalCashRequired + vaTotalCost;
  const irrCashFlows = buildIRRCashFlows(totalCashInvested, projections, saleProceeds.netToSeller);
  const irrValue = calculateIRR(irrCashFlows);
  const totalCashFlows = projections.reduce((s, p) => s + p.cashFlow, 0);
  const equityMultiple = calculateEquityMultiple(totalCashInvested, totalCashFlows, saleProceeds.netToSeller);
  const avgCashOnCash = calculateAvgCashOnCash(projections, totalCashInvested);

  // Stabilized NOI
  const sqft = property.building_size || 0;
  const stabilizedIncome = sqft * n(data.stabilized_rent_psf) * (n(data.stabilized_occupancy) / 100) + n(data.stabilized_other_income);
  const asIsIncome = sqft * n(data.as_is_rent_psf) * (n(data.as_is_occupancy) / 100) + n(data.as_is_other_income);
  const stabilizedExpenses = stabilizedIncome * (n(data.stabilized_expense_ratio) / 100);
  const asIsExpenses = asIsIncome * (n(data.as_is_expense_ratio) / 100);
  const stabilizedNOI = stabilizedIncome - stabilizedExpenses;
  const asIsNOI = asIsIncome - asIsExpenses;
  const noiLift = stabilizedNOI - asIsNOI;

  // Comp suggestions
  const suggestedExitCap = suggestExitCapRate(comps);
  const psfBenchmark = benchmarkPricePerSqft(comps);

  // ─── Decision Logic ────────────────────────────────────────────

  interface DecisionMetric {
    label: string;
    actual: number;
    required: number | null;
    format: 'percent' | 'ratio' | 'currency';
    pass: boolean;
  }

  const decisionMetrics: DecisionMetric[] = useMemo(() => [
    {
      label: 'Going-In Cap Rate',
      actual: capRate,
      required: thresholds.cap_rate,
      format: 'percent' as const,
      pass: thresholds.cap_rate === null || capRate >= thresholds.cap_rate,
    },
    {
      label: 'Avg Cash-on-Cash',
      actual: avgCashOnCash,
      required: thresholds.cash_on_cash,
      format: 'percent' as const,
      pass: avgCashOnCash >= thresholds.cash_on_cash,
    },
    {
      label: 'IRR',
      actual: irrValue,
      required: thresholds.irr,
      format: 'percent' as const,
      pass: irrValue >= thresholds.irr,
    },
    {
      label: 'Equity Multiple',
      actual: equityMultiple,
      required: thresholds.equity_multiple,
      format: 'ratio' as const,
      pass: equityMultiple >= thresholds.equity_multiple,
    },
    {
      label: 'DSCR',
      actual: dscr,
      required: thresholds.dscr,
      format: 'ratio' as const,
      pass: dscr >= thresholds.dscr,
    },
  ], [capRate, avgCashOnCash, irrValue, equityMultiple, dscr, thresholds]);

  const passCount = decisionMetrics.filter(m => m.pass).length;
  const allPass = passCount === decisionMetrics.length;
  const verdict: 'GO' | 'NO-GO' | 'REVIEW' = allPass ? 'GO' : passCount >= 3 ? 'REVIEW' : 'NO-GO';

  // ─── Goal-Seek (Optimization) ─────────────────────────────────

  const goalSeekInputs = useMemo(() => ({
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
  }), [purchasePrice, noi, data.income_growth_rate, data.expense_growth_rate, egi, totalExpenses, loanAmount, data.interest_rate, data.amortization_years, holdingPeriod, exitCapRate, sellingCostsPercent, totalCashInvested, data.closing_costs_percent, data.ltv_percent, sqft]);

  const optimization = useMemo(() => {
    const targetIRR = thresholds.irr;
    if (purchasePrice <= 0 || egi <= 0) return null;
    return {
      maxPurchasePrice: solveMaxPurchasePrice(targetIRR, goalSeekInputs),
      requiredNOI: solveRequiredNOILift(targetIRR, goalSeekInputs),
      requiredRentPSF: solveRequiredRentPSF(noi, sqft, totalExpenses / (egi || 1) * 100),
      capexCeiling: solveCapexCeiling(targetIRR, goalSeekInputs),
      targetExitCap: solveTargetExitCap(targetIRR, goalSeekInputs),
    };
  }, [goalSeekInputs, thresholds.irr, purchasePrice, egi, noi, sqft, totalExpenses]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleChange = useCallback((field: string, value: string | number | boolean) => {
    setData(prev => ({
      ...prev,
      [field]: typeof value === 'string' && field !== 'investment_strategy' && !field.includes('note') && field !== 'notes'
        ? parseNumberInput(value)
        : value,
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({
        ...data,
        va_total_cost: vaTotalCost,
        total_project_cost: totalProjectCost,
        irr: irrValue,
        equity_multiple: equityMultiple,
        avg_cash_on_cash: avgCashOnCash,
      });
    }
  }, [onSave, data, vaTotalCost, totalProjectCost, irrValue, equityMultiple, avgCashOnCash]);

  // Auto-save debounce
  useEffect(() => {
    if (!onSave) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tab Config ────────────────────────────────────────────────

  const tabs: { id: TabType; label: string }[] = [
    { id: 'summary', label: 'Deal Summary' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'valueadd', label: 'Value-Add' },
    { id: 'proforma', label: 'Proforma' },
    { id: 'exit', label: 'Exit Analysis' },
    { id: 'decision', label: 'Decision' },
    { id: 'optimization', label: 'Optimization' },
  ];

  // ─── Format helpers ────────────────────────────────────────────

  const fmtMetric = (val: number, format: 'percent' | 'ratio' | 'currency') => {
    if (format === 'percent') return formatPercent(val);
    if (format === 'ratio') return formatRatio(val);
    return formatCurrency(val);
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <CardTitle>Investment Analysis</CardTitle>
              <p className="text-sm text-gray-500">Investment decision engine &amp; pro forma</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Verdict badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              verdict === 'GO' ? 'bg-green-100 text-green-800' :
              verdict === 'REVIEW' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {verdict}
            </span>
            {onSave && (
              <Button size="sm" onClick={handleSave} isLoading={saving} disabled={saving}>
                Save
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {/* Tabs */}
          <div className="flex border-b mb-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              TAB 1: Deal Summary (read-only overview)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Property Info */}
              <div className="bg-gray-900 text-white rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{property.address || 'Untitled Property'}</h3>
                    <p className="text-gray-400 text-sm">{[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}</p>
                    <p className="text-gray-400 text-sm mt-1">{property.property_type?.replace('_', ' ')} {property.building_size ? `| ${property.building_size.toLocaleString()} SF` : ''}</p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                    verdict === 'GO' ? 'bg-green-500 text-white' :
                    verdict === 'REVIEW' ? 'bg-yellow-500 text-gray-900' :
                    'bg-red-500 text-white'
                  }`}>
                    {verdict}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Purchase Price</p>
                    <p className="text-xl font-bold">{formatCurrency(purchasePrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Total Project Cost</p>
                    <p className="text-xl font-bold">{formatCurrency(totalProjectCost)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Year 1 NOI</p>
                    <p className="text-xl font-bold">{formatCurrency(noi)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Going-In Cap</p>
                    <p className="text-xl font-bold">{formatPercent(capRate)}</p>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Cap Rate</p>
                  <p className="text-2xl font-bold text-primary-600">{formatPercent(capRate)}</p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Avg CoC</p>
                  <p className={`text-2xl font-bold ${avgCashOnCash >= 8 ? 'text-green-600' : 'text-gray-900'}`}>
                    {formatPercent(avgCashOnCash)}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">IRR</p>
                  <p className={`text-2xl font-bold ${irrValue >= thresholds.irr ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(irrValue)}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Equity Multiple</p>
                  <p className="text-2xl font-bold text-gray-900">{formatRatio(equityMultiple)}</p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">DSCR</p>
                  <p className={`text-2xl font-bold ${dscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRatio(dscr)}
                  </p>
                </div>
              </div>

              {/* Quick financial summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                  <h4 className="text-sm font-semibold text-green-800 uppercase mb-3">Income</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Gross Income</span><span className="font-medium">{formatCurrency(pgi)}</span></div>
                    <div className="flex justify-between text-red-600"><span>Less: Vacancy</span><span>-{formatCurrency(vacancyAmount)}</span></div>
                    <div className="flex justify-between"><span>Other Income</span><span className="font-medium">{formatCurrency(n(data.other_income))}</span></div>
                    <div className="flex justify-between pt-2 border-t border-green-300 font-bold"><span>EGI</span><span>{formatCurrency(egi)}</span></div>
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                  <h4 className="text-sm font-semibold text-red-800 uppercase mb-3">Expenses & Debt</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Operating Expenses</span><span className="font-medium">{formatCurrency(totalExpenses)}</span></div>
                    <div className="flex justify-between"><span>Annual Debt Service</span><span className="font-medium">{formatCurrency(annualDS)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-red-300 font-bold">
                      <span>Before-Tax Cash Flow</span>
                      <span className={beforeTaxCF >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(beforeTaxCF)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Notes</label>
                <textarea
                  value={data.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Notes about assumptions, risks, or other considerations..."
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 2: Strategy
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'strategy' && (
            <div className="space-y-6">
              <div className="bg-primary-50 rounded-xl p-5 border border-primary-200">
                <h3 className="text-sm font-semibold text-primary-800 uppercase tracking-wide mb-4">Investment Strategy</h3>
                <Select
                  label="Strategy"
                  value={data.investment_strategy || 'value_add'}
                  onChange={(e) => handleChange('investment_strategy', e.target.value)}
                  options={[
                    { value: 'core', label: 'Core' },
                    { value: 'value_add', label: 'Value-Add' },
                    { value: 'opportunistic', label: 'Opportunistic' },
                  ]}
                />

                {suggestedExitCap && comps.length > 0 && (
                  <p className="text-sm text-primary-700 mt-3">
                    Based on {comps.filter(c => c.comp_cap_rate && c.comp_cap_rate > 0).length} comps, average cap rate is {formatPercent(suggestedExitCap)} — {
                      suggestedExitCap >= 6.5 ? 'aligns with Core strategy' :
                      suggestedExitCap >= 5.5 ? 'aligns with Value-Add strategy' :
                      'suggests Opportunistic strategy'
                    }
                  </p>
                )}
              </div>

              {/* Strategy Thresholds */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {strategy === 'core' ? 'Core' : strategy === 'value_add' ? 'Value-Add' : 'Opportunistic'} — Required Thresholds
                  </h4>
                </div>
                <div className="divide-y">
                  {[
                    { label: 'Min Cap Rate', value: thresholds.cap_rate, fmt: 'percent' as const },
                    { label: 'Min Cash-on-Cash', value: thresholds.cash_on_cash, fmt: 'percent' as const },
                    { label: 'Min IRR', value: thresholds.irr, fmt: 'percent' as const },
                    { label: 'Min Equity Multiple', value: thresholds.equity_multiple, fmt: 'ratio' as const },
                    { label: 'Min DSCR', value: thresholds.dscr, fmt: 'ratio' as const },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between px-5 py-3 text-sm">
                      <span className="text-gray-600">{row.label}</span>
                      <span className="font-semibold">
                        {row.value === null ? 'N/A' : row.fmt === 'percent' ? formatPercent(row.value) : formatRatio(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comp benchmark */}
              {psfBenchmark && (
                <div className="bg-gray-50 rounded-xl p-5 border">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Comp Price/SF Benchmark</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-xs text-gray-500">Min</p><p className="font-bold">${psfBenchmark.min.toFixed(0)}/SF</p></div>
                    <div><p className="text-xs text-gray-500">Avg</p><p className="font-bold text-primary-600">${psfBenchmark.avg.toFixed(0)}/SF</p></div>
                    <div><p className="text-xs text-gray-500">Max</p><p className="font-bold">${psfBenchmark.max.toFixed(0)}/SF</p></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">Subject: ${pricePerSqft.toFixed(0)}/SF</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 3: Value-Add
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'valueadd' && (
            <div className="space-y-6">
              {/* Value-Add Drivers */}
              <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-4">Value-Add Drivers</h3>
                <div className="space-y-4">
                  {VA_ITEMS.map(item => (
                    <div key={item.key} className="space-y-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!data[item.key]}
                          onChange={(e) => handleChange(item.key, e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </label>
                      {data[item.key] && (
                        <input
                          type="text"
                          value={(data[item.noteKey] as string) || ''}
                          onChange={(e) => handleChange(item.noteKey, e.target.value)}
                          placeholder={`Notes for ${item.label}...`}
                          className="w-full text-sm rounded-md border-gray-300 pl-7 focus:border-primary-500 focus:ring-primary-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* As-Is vs Stabilized */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700">As-Is vs Stabilized Comparison</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-600 font-medium">Metric</th>
                        <th className="px-4 py-2 text-right text-gray-600 font-medium">As-Is</th>
                        <th className="px-4 py-2 text-right text-gray-600 font-medium">Stabilized</th>
                        <th className="px-4 py-2 text-right text-gray-600 font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="px-4 py-2">Rent PSF</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="0.01" value={data.as_is_rent_psf || ''} onChange={(e) => handleChange('as_is_rent_psf', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="0.01" value={data.stabilized_rent_psf || ''} onChange={(e) => handleChange('stabilized_rent_psf', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">
                          +${((n(data.stabilized_rent_psf) - n(data.as_is_rent_psf))).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Occupancy %</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="0.1" value={data.as_is_occupancy || ''} onChange={(e) => handleChange('as_is_occupancy', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="0.1" value={data.stabilized_occupancy || ''} onChange={(e) => handleChange('stabilized_occupancy', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">
                          +{((n(data.stabilized_occupancy) - n(data.as_is_occupancy))).toFixed(1)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Other Income</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" value={data.as_is_other_income || ''} onChange={(e) => handleChange('as_is_other_income', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" value={data.stabilized_other_income || ''} onChange={(e) => handleChange('stabilized_other_income', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">
                          +{formatCurrency(n(data.stabilized_other_income) - n(data.as_is_other_income))}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Expense Ratio %</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="0.1" value={data.as_is_expense_ratio || ''} onChange={(e) => handleChange('as_is_expense_ratio', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" step="0.1" value={data.stabilized_expense_ratio || ''} onChange={(e) => handleChange('stabilized_expense_ratio', e.target.value)}
                            className="w-24 text-right text-sm border-gray-300 rounded" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">
                          {((n(data.stabilized_expense_ratio) - n(data.as_is_expense_ratio))).toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-4 py-2">NOI</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(asIsNOI)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(stabilizedNOI)}</td>
                        <td className="px-4 py-2 text-right text-green-600">+{formatCurrency(noiLift)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Value-Add Costs */}
              <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
                <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide mb-4">Value-Add Costs</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="CapEx" type="number" leftAddon="$" value={data.va_capex || ''} onChange={(e) => handleChange('va_capex', e.target.value)} />
                  <Input label="TI / Leasing" type="number" leftAddon="$" value={data.va_ti_leasing || ''} onChange={(e) => handleChange('va_ti_leasing', e.target.value)} />
                  <Input label="Carry Costs" type="number" leftAddon="$" value={data.va_carry_costs || ''} onChange={(e) => handleChange('va_carry_costs', e.target.value)} />
                  <Input label="Contingency" type="number" leftAddon="$" value={data.va_contingency || ''} onChange={(e) => handleChange('va_contingency', e.target.value)} />
                </div>
                <div className="flex justify-between pt-4 mt-4 border-t border-orange-300 text-sm font-bold">
                  <span className="text-orange-800">Total Value-Add Costs</span>
                  <span className="text-orange-700 text-lg">{formatCurrency(vaTotalCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 4: Proforma
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'proforma' && (
            <div className="space-y-6">
              {/* Settings */}
              <div className="bg-gray-50 rounded-xl p-5 border">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Proforma Settings</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input label="Income Growth" type="number" step="0.1" rightAddon="%" value={data.income_growth_rate || ''} onChange={(e) => handleChange('income_growth_rate', e.target.value)} />
                  <Input label="Expense Growth" type="number" step="0.1" rightAddon="%" value={data.expense_growth_rate || ''} onChange={(e) => handleChange('expense_growth_rate', e.target.value)} />
                  <Select
                    label="Holding Period"
                    value={String(data.holding_period || 5)}
                    onChange={(e) => handleChange('holding_period', e.target.value)}
                    options={[
                      { value: '5', label: '5 Years' },
                      { value: '7', label: '7 Years' },
                      { value: '10', label: '10 Years' },
                    ]}
                  />
                  <Input label="Exit Cap Rate" type="number" step="0.05" rightAddon="%" value={data.exit_cap_rate || ''} onChange={(e) => handleChange('exit_cap_rate', e.target.value)} />
                </div>
              </div>

              {/* Income & Expense Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                  <h4 className="text-sm font-semibold text-green-800 uppercase mb-3">Income</h4>
                  <div className="space-y-3">
                    <Input label="Potential Gross Income" type="number" leftAddon="$" value={data.potential_gross_income || ''} onChange={(e) => handleChange('potential_gross_income', e.target.value)} />
                    <Input label="Vacancy %" type="number" rightAddon="%" value={data.vacancy_rate || ''} onChange={(e) => handleChange('vacancy_rate', e.target.value)} />
                    <Input label="Other Income" type="number" leftAddon="$" value={data.other_income || ''} onChange={(e) => handleChange('other_income', e.target.value)} />
                    <div className="flex justify-between text-sm pt-2 border-t border-green-300 font-bold">
                      <span>EGI</span><span>{formatCurrency(egi)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                  <h4 className="text-sm font-semibold text-red-800 uppercase mb-3">Expenses</h4>
                  <div className="space-y-3">
                    <Input label="Property Taxes" type="number" leftAddon="$" value={data.property_taxes || ''} onChange={(e) => handleChange('property_taxes', e.target.value)} />
                    <Input label="Insurance" type="number" leftAddon="$" value={data.insurance || ''} onChange={(e) => handleChange('insurance', e.target.value)} />
                    <Input label="Mgmt Fee %" type="number" rightAddon="%" value={data.management_fee_percent || ''} onChange={(e) => handleChange('management_fee_percent', e.target.value)} />
                    <Input label="Repairs" type="number" leftAddon="$" value={data.repairs_maintenance || ''} onChange={(e) => handleChange('repairs_maintenance', e.target.value)} />
                    <Input label="Reserves/CapEx" type="number" leftAddon="$" value={data.reserves_capex || ''} onChange={(e) => handleChange('reserves_capex', e.target.value)} />
                    <Input label="Other" type="number" leftAddon="$" value={data.other_expenses || ''} onChange={(e) => handleChange('other_expenses', e.target.value)} />
                    <div className="flex justify-between text-sm pt-2 border-t border-red-300 font-bold">
                      <span>Total Expenses</span><span>{formatCurrency(totalExpenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financing */}
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 uppercase mb-3">Financing</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Input label="Purchase Price" type="number" leftAddon="$" value={data.purchase_price || ''} onChange={(e) => handleChange('purchase_price', e.target.value)} />
                  <Input label="LTV %" type="number" rightAddon="%" value={data.ltv_percent || ''} onChange={(e) => handleChange('ltv_percent', e.target.value)} />
                  <Input label="Interest Rate" type="number" step="0.125" rightAddon="%" value={data.interest_rate || ''} onChange={(e) => handleChange('interest_rate', e.target.value)} />
                  <Input label="Amortization" type="number" rightAddon="yrs" value={data.amortization_years || ''} onChange={(e) => handleChange('amortization_years', e.target.value)} />
                  <Input label="Closing Costs" type="number" rightAddon="%" value={data.closing_costs_percent || ''} onChange={(e) => handleChange('closing_costs_percent', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-blue-200 text-sm">
                  <div><span className="text-gray-600">Loan:</span> <span className="font-medium">{formatCurrency(loanAmount)}</span></div>
                  <div><span className="text-gray-600">Down:</span> <span className="font-medium">{formatCurrency(downPayment)}</span></div>
                  <div><span className="text-gray-600">Debt Service:</span> <span className="font-medium">{formatCurrency(annualDS)}/yr</span></div>
                  <div><span className="text-gray-600">DSCR:</span> <span className={`font-medium ${dscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>{formatRatio(dscr)}</span></div>
                </div>
              </div>

              {/* Projection Table */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700">{holdingPeriod}-Year Proforma</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Year</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">Income</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">Expenses</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">NOI</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">Debt Svc</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">Cash Flow</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-medium">CoC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {projections.map((yr) => (
                        <tr key={yr.year} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{yr.year}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(yr.income)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{formatCurrency(yr.expenses)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(yr.noi)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(yr.debtService)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${yr.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(yr.cashFlow)}</td>
                          <td className="px-3 py-2 text-right">{formatPercent(calculateCashOnCash(yr.cashFlow, totalCashInvested))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 5: Exit Analysis
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'exit' && (
            <div className="space-y-6">
              {/* Exit inputs */}
              <div className="bg-gray-50 rounded-xl p-5 border">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Exit Assumptions</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input label="Exit Cap Rate" type="number" step="0.05" rightAddon="%" value={data.exit_cap_rate || ''} onChange={(e) => handleChange('exit_cap_rate', e.target.value)} />
                  <Input label="Selling Costs" type="number" step="0.1" rightAddon="%" value={data.selling_costs_percent || ''} onChange={(e) => handleChange('selling_costs_percent', e.target.value)} />
                  <div className="flex items-end text-sm text-gray-600">
                    {suggestedExitCap && <p>Comp-suggested exit cap: {formatPercent(suggestedExitCap)}</p>}
                  </div>
                </div>
              </div>

              {/* Exit waterfall */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700">Sale Proceeds Waterfall (Year {holdingPeriod})</h4>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Exit NOI (Year {holdingPeriod})</span>
                    <span className="font-medium">{formatCurrency(exitNOI)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Exit Cap Rate</span>
                    <span className="font-medium">{formatPercent(exitCapRate)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span>Gross Sale Price</span>
                    <span>{formatCurrency(saleProceeds.salePrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Less: Selling Costs ({formatPercent(sellingCostsPercent)})</span>
                    <span>-{formatCurrency(saleProceeds.sellingCosts)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Less: Loan Payoff</span>
                    <span>-{formatCurrency(saleProceeds.loanPayoff)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-primary-300 font-bold text-lg">
                    <span>Net Sale Proceeds</span>
                    <span className={saleProceeds.netToSeller >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(saleProceeds.netToSeller)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Return Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary-50 rounded-xl p-4 text-center border border-primary-200">
                  <p className="text-xs text-primary-600 uppercase font-medium">IRR</p>
                  <p className={`text-3xl font-bold ${irrValue >= thresholds.irr ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(irrValue)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Target: {formatPercent(thresholds.irr)}</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-4 text-center border border-primary-200">
                  <p className="text-xs text-primary-600 uppercase font-medium">Equity Multiple</p>
                  <p className={`text-3xl font-bold ${equityMultiple >= thresholds.equity_multiple ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRatio(equityMultiple)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Target: {formatRatio(thresholds.equity_multiple)}</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-4 text-center border border-primary-200">
                  <p className="text-xs text-primary-600 uppercase font-medium">Avg CoC</p>
                  <p className={`text-3xl font-bold ${avgCashOnCash >= thresholds.cash_on_cash ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(avgCashOnCash)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Target: {formatPercent(thresholds.cash_on_cash)}</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-4 text-center border border-primary-200">
                  <p className="text-xs text-primary-600 uppercase font-medium">Total Cash Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCashInvested)}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(totalCashRequired)} + {formatCurrency(vaTotalCost)} VA</p>
                </div>
              </div>

              {/* NPV */}
              <div className="bg-gray-50 rounded-xl p-5 border">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Net Present Value</h4>
                <p className="text-2xl font-bold">{formatCurrency(calculateNPV(irrCashFlows, 10))}</p>
                <p className="text-xs text-gray-500">At 10% discount rate</p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 6: Decision Dashboard
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'decision' && (
            <div className="space-y-6">
              {/* Verdict */}
              <div className={`rounded-xl p-6 text-center ${
                verdict === 'GO' ? 'bg-green-100 border-2 border-green-500' :
                verdict === 'REVIEW' ? 'bg-yellow-100 border-2 border-yellow-500' :
                'bg-red-100 border-2 border-red-500'
              }`}>
                <p className={`text-5xl font-black ${
                  verdict === 'GO' ? 'text-green-700' :
                  verdict === 'REVIEW' ? 'text-yellow-700' :
                  'text-red-700'
                }`}>{verdict}</p>
                <p className="text-sm mt-2 text-gray-600">
                  {verdict === 'GO' && 'All metrics meet or exceed strategy thresholds'}
                  {verdict === 'REVIEW' && `${passCount} of ${decisionMetrics.length} metrics pass — borderline deal`}
                  {verdict === 'NO-GO' && `Only ${passCount} of ${decisionMetrics.length} metrics pass — does not meet requirements`}
                </p>
              </div>

              {/* Scorecard */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Scorecard — {strategy === 'core' ? 'Core' : strategy === 'value_add' ? 'Value-Add' : 'Opportunistic'} Strategy
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-600 font-medium">Metric</th>
                        <th className="px-4 py-2 text-right text-gray-600 font-medium">Actual</th>
                        <th className="px-4 py-2 text-right text-gray-600 font-medium">Required</th>
                        <th className="px-4 py-2 text-center text-gray-600 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {decisionMetrics.map((m) => (
                        <tr key={m.label}>
                          <td className="px-4 py-3 font-medium">{m.label}</td>
                          <td className="px-4 py-3 text-right font-semibold">{fmtMetric(m.actual, m.format)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {m.required === null ? 'N/A' : fmtMetric(m.required, m.format)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {m.pass ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                FAIL
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase font-medium">Price/SF vs Market</p>
                  <p className="text-xl font-bold">${pricePerSqft.toFixed(0)}/SF</p>
                  {psfBenchmark && (
                    <p className="text-xs text-gray-500">Comp avg: ${psfBenchmark.avg.toFixed(0)}/SF ({pricePerSqft <= psfBenchmark.avg ? 'Below' : 'Above'} market)</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase font-medium">Total Equity Required</p>
                  <p className="text-xl font-bold">{formatCurrency(totalCashInvested)}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(downPayment)} + {formatCurrency(closingCosts)} closing + {formatCurrency(vaTotalCost)} VA</p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 7: Optimization (Goal-Seek)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'optimization' && (
            <div className="space-y-6">
              <div className="bg-primary-50 rounded-xl p-5 border border-primary-200">
                <h3 className="text-sm font-semibold text-primary-800 uppercase tracking-wide mb-2">What Makes This a GO?</h3>
                <p className="text-sm text-primary-600">
                  Target IRR: {formatPercent(thresholds.irr)} ({strategy === 'core' ? 'Core' : strategy === 'value_add' ? 'Value-Add' : 'Opportunistic'} Strategy)
                </p>
              </div>

              {optimization ? (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">Lever</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Current</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Required</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Gap</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="px-4 py-3 font-medium">Max Purchase Price</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(purchasePrice)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-600">{formatCurrency(optimization.maxPurchasePrice)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${optimization.maxPurchasePrice >= purchasePrice ? 'text-green-600' : 'text-red-600'}`}>
                            {optimization.maxPurchasePrice >= purchasePrice ? '+' : ''}{formatCurrency(optimization.maxPurchasePrice - purchasePrice)}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium">Required NOI</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(noi)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-600">{formatCurrency(optimization.requiredNOI)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${optimization.requiredNOI <= noi ? 'text-green-600' : 'text-red-600'}`}>
                            {optimization.requiredNOI <= noi ? '' : '+'}{formatCurrency(optimization.requiredNOI - noi)}
                          </td>
                        </tr>
                        {sqft > 0 && (
                          <tr>
                            <td className="px-4 py-3 font-medium">Required Rent PSF</td>
                            <td className="px-4 py-3 text-right">${(pgi / sqft).toFixed(2)}/SF</td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-600">${optimization.requiredRentPSF.toFixed(2)}/SF</td>
                            <td className={`px-4 py-3 text-right font-medium ${optimization.requiredRentPSF <= (pgi / sqft) ? 'text-green-600' : 'text-red-600'}`}>
                              {optimization.requiredRentPSF <= (pgi / sqft) ? '-' : '+'}${Math.abs(optimization.requiredRentPSF - (pgi / sqft)).toFixed(2)}/SF
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="px-4 py-3 font-medium">CapEx Ceiling</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(vaTotalCost)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-600">{formatCurrency(optimization.capexCeiling)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${optimization.capexCeiling >= vaTotalCost ? 'text-green-600' : 'text-red-600'}`}>
                            {optimization.capexCeiling >= vaTotalCost ? '+' : ''}{formatCurrency(optimization.capexCeiling - vaTotalCost)}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium">Target Exit Cap</td>
                          <td className="px-4 py-3 text-right">{formatPercent(exitCapRate)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-600">{formatPercent(optimization.targetExitCap)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${optimization.targetExitCap >= exitCapRate ? 'text-green-600' : 'text-red-600'}`}>
                            {(optimization.targetExitCap - exitCapRate) >= 0 ? '+' : ''}{(optimization.targetExitCap - exitCapRate).toFixed(2)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6 text-center border">
                  <p className="text-gray-500">Enter purchase price and income data to see optimization results</p>
                </div>
              )}

              {/* Interpretation */}
              {optimization && (
                <div className="bg-gray-50 rounded-xl p-5 border">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Interpretation</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {optimization.maxPurchasePrice > purchasePrice && (
                      <li>You can pay up to <strong>{formatCurrency(optimization.maxPurchasePrice)}</strong> and still hit your target IRR — {formatCurrency(optimization.maxPurchasePrice - purchasePrice)} of headroom.</li>
                    )}
                    {optimization.maxPurchasePrice < purchasePrice && (
                      <li>The asking price is <strong>{formatCurrency(purchasePrice - optimization.maxPurchasePrice)}</strong> too high. You need to negotiate down to {formatCurrency(optimization.maxPurchasePrice)} to hit target IRR.</li>
                    )}
                    {optimization.requiredNOI > noi && (
                      <li>NOI needs to increase by <strong>{formatCurrency(optimization.requiredNOI - noi)}</strong> ({formatPercent((optimization.requiredNOI - noi) / noi * 100)}) through rent increases or expense cuts.</li>
                    )}
                    {optimization.capexCeiling > 0 && (
                      <li>Max CapEx budget before IRR drops below target: <strong>{formatCurrency(optimization.capexCeiling)}</strong></li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
