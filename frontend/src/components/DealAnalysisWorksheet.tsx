import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from './ui';
import type { Property, Comp } from '../types';
import { generateDealAnalysisPDF } from '../utils/pdfExport';
import { loadLogoImage } from '../utils/pdfBranding';
import { useAuth } from '../contexts/AuthContext';
import ProjectionTable from './ProjectionTable';
import SensitivityTable from './SensitivityTable';
import {
  calculateVacancyAmount,
  calculateEffectiveGrossIncome,
  calculateManagementFee,
  calculateTotalExpenses,
  calculateOperatingExpenseRatio,
  calculateNOI,
  calculateCapRate,
  calculatePricePerSqft,
  calculateGRM,
  calculateLoanAmount,
  calculateDownPayment,
  calculateMonthlyPayment,
  calculateAnnualDebtService,
  calculateDSCR,
  calculateClosingCosts,
  calculateTotalCashRequired,
  calculateBeforeTaxCashFlow,
  calculateCashOnCash,
  parseNumberInput,
  formatCurrency,
  formatPercent,
  formatRatio,
  getDSCRStatus,
  THRESHOLDS,
} from '../utils/financialCalculations';

// Input data type - accepts nullable fields from API
export interface DealAnalysisInput {
  // Income
  potential_gross_income?: number | null;
  vacancy_rate?: number | null;
  other_income?: number | null;
  // Expenses
  property_taxes?: number | null;
  insurance?: number | null;
  utilities?: number | null;
  management_fee_percent?: number | null;
  repairs_maintenance?: number | null;
  reserves_capex?: number | null;
  other_expenses?: number | null;
  // Financing
  purchase_price?: number | null;
  ltv_percent?: number | null;
  interest_rate?: number | null;
  amortization_years?: number | null;
  closing_costs_percent?: number | null;
  // Notes
  notes?: string | null;
}

// Internal form data type - all required with defaults
export interface DealAnalysisData {
  // Income
  potential_gross_income: number;
  vacancy_rate: number;
  other_income: number;
  // Expenses
  property_taxes: number;
  insurance: number;
  utilities: number;
  management_fee_percent: number;
  repairs_maintenance: number;
  reserves_capex: number;
  other_expenses: number;
  // Financing
  purchase_price: number;
  ltv_percent: number;
  interest_rate: number;
  amortization_years: number;
  closing_costs_percent: number;
  // Notes
  notes: string;
}

interface DealAnalysisWorksheetProps {
  property: Property;
  comps?: Comp[];
  onSave?: (data: DealAnalysisData) => void;
  initialData?: DealAnalysisInput | null;
  saving?: boolean;
}

type TabType = 'proforma' | 'financing' | 'projections' | 'sensitivity' | 'summary';

export default function DealAnalysisWorksheet({
  property,
  comps,
  onSave,
  initialData,
  saving = false,
}: DealAnalysisWorksheetProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('proforma');
  const [expanded, setExpanded] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Pre-load logo for PDF export
  useEffect(() => {
    if (user?.company_logo_url) {
      loadLogoImage(user.company_logo_url).then(setLogoBase64);
    }
  }, [user?.company_logo_url]);

  // Form state
  const [data, setData] = useState<DealAnalysisData>(() => ({
    potential_gross_income: initialData?.potential_gross_income || property.gross_income || 0,
    vacancy_rate: initialData?.vacancy_rate || 5,
    other_income: initialData?.other_income || 0,
    property_taxes: initialData?.property_taxes || 0,
    insurance: initialData?.insurance || 0,
    utilities: initialData?.utilities || 0,
    management_fee_percent: initialData?.management_fee_percent || 3,
    repairs_maintenance: initialData?.repairs_maintenance || 0,
    reserves_capex: initialData?.reserves_capex || 0,
    other_expenses: initialData?.other_expenses || 0,
    purchase_price: initialData?.purchase_price || property.price || 0,
    ltv_percent: initialData?.ltv_percent || 70,
    interest_rate: initialData?.interest_rate || 7,
    amortization_years: initialData?.amortization_years || 25,
    closing_costs_percent: initialData?.closing_costs_percent || 2,
    notes: initialData?.notes || '',
  }));

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setData({
        potential_gross_income: initialData.potential_gross_income ?? property.gross_income ?? 0,
        vacancy_rate: initialData.vacancy_rate ?? 5,
        other_income: initialData.other_income ?? 0,
        property_taxes: initialData.property_taxes ?? 0,
        insurance: initialData.insurance ?? 0,
        utilities: initialData.utilities ?? 0,
        management_fee_percent: initialData.management_fee_percent ?? 3,
        repairs_maintenance: initialData.repairs_maintenance ?? 0,
        reserves_capex: initialData.reserves_capex ?? 0,
        other_expenses: initialData.other_expenses ?? 0,
        purchase_price: initialData.purchase_price ?? property.price ?? 0,
        ltv_percent: initialData.ltv_percent ?? 70,
        interest_rate: initialData.interest_rate ?? 7,
        amortization_years: initialData.amortization_years ?? 25,
        closing_costs_percent: initialData.closing_costs_percent ?? 2,
        notes: initialData.notes ?? '',
      });
    }
  }, [initialData, property.gross_income, property.price]);

  // Calculated values
  const vacancyAmount = calculateVacancyAmount(data.potential_gross_income, data.vacancy_rate);
  const egi = calculateEffectiveGrossIncome(data.potential_gross_income, vacancyAmount, data.other_income);
  const managementFee = calculateManagementFee(egi, data.management_fee_percent);
  const totalExpenses = calculateTotalExpenses({
    propertyTaxes: data.property_taxes,
    insurance: data.insurance,
    utilities: data.utilities,
    managementFee,
    repairsMaintenance: data.repairs_maintenance,
    reservesCapex: data.reserves_capex,
    otherExpenses: data.other_expenses,
  });
  const expenseRatio = calculateOperatingExpenseRatio(totalExpenses, egi);
  const noi = calculateNOI(egi, totalExpenses);
  const capRate = calculateCapRate(noi, data.purchase_price);
  const pricePerSqft = calculatePricePerSqft(data.purchase_price, property.building_size || 0);
  const grm = calculateGRM(data.purchase_price, data.potential_gross_income);

  // Financing calculations
  const loanAmount = calculateLoanAmount(data.purchase_price, data.ltv_percent);
  const downPayment = calculateDownPayment(data.purchase_price, loanAmount);
  const monthlyPayment = calculateMonthlyPayment(loanAmount, data.interest_rate, data.amortization_years);
  const annualDebtService = calculateAnnualDebtService(monthlyPayment);
  const dscr = calculateDSCR(noi, annualDebtService);
  const closingCosts = calculateClosingCosts(data.purchase_price, data.closing_costs_percent);
  const totalCashRequired = calculateTotalCashRequired(downPayment, closingCosts);
  const beforeTaxCashFlow = calculateBeforeTaxCashFlow(noi, annualDebtService);
  const cashOnCash = calculateCashOnCash(beforeTaxCashFlow, totalCashRequired);

  const dscrStatus = getDSCRStatus(dscr);

  const handleChange = useCallback((field: keyof DealAnalysisData, value: string | number) => {
    setData(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? parseNumberInput(value) : value,
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(data);
    }
  }, [onSave, data]);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'proforma', label: 'Income & Expenses' },
    { id: 'financing', label: 'Financing' },
    { id: 'projections', label: 'Projections' },
    { id: 'sensitivity', label: 'Sensitivity' },
    { id: 'summary', label: 'Summary' },
  ];

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
              <CardTitle>Deal Analysis Worksheet</CardTitle>
              <p className="text-sm text-gray-500">Pro forma &amp; investment analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateDealAnalysisPDF({
                property,
                analysis: data,
                comps,
                branding: user ? {
                  company_name: user.company_name,
                  company_logo_url: user.company_logo_url,
                  company_phone: user.company_phone,
                  company_email: user.company_email,
                  company_address: user.company_address,
                } : undefined,
                logoBase64,
              })}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export PDF
            </Button>
            {onSave && (
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={saving}
                disabled={saving}
              >
                Save Analysis
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              <svg
                className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {/* Tabs */}
          <div className="flex border-b mb-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Proforma Tab */}
          {activeTab === 'proforma' && (
            <div className="space-y-6">
              {/* Income Section */}
              <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide mb-4">
                  Income Analysis
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Potential Gross Income (PGI)"
                      type="number"
                      leftAddon="$"
                      value={data.potential_gross_income || ''}
                      onChange={(e) => handleChange('potential_gross_income', e.target.value)}
                    />
                    <Input
                      label="Vacancy & Credit Loss"
                      type="number"
                      rightAddon="%"
                      value={data.vacancy_rate || ''}
                      onChange={(e) => handleChange('vacancy_rate', e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-green-200">
                    <span className="text-green-700">Less: Vacancy Amount</span>
                    <span className="font-medium text-red-600">-{formatCurrency(vacancyAmount)}</span>
                  </div>
                  <Input
                    label="Other Income"
                    type="number"
                    leftAddon="$"
                    value={data.other_income || ''}
                    onChange={(e) => handleChange('other_income', e.target.value)}
                  />
                  <div className="flex justify-between text-sm py-2 border-t border-green-300 mt-2">
                    <span className="font-semibold text-green-800">Effective Gross Income (EGI)</span>
                    <span className="font-bold text-green-700 text-lg">{formatCurrency(egi)}</span>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wide mb-4">
                  Operating Expenses
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Property Taxes"
                    type="number"
                    leftAddon="$"
                    value={data.property_taxes || ''}
                    onChange={(e) => handleChange('property_taxes', e.target.value)}
                  />
                  <Input
                    label="Insurance"
                    type="number"
                    leftAddon="$"
                    value={data.insurance || ''}
                    onChange={(e) => handleChange('insurance', e.target.value)}
                  />
                  <Input
                    label="Utilities"
                    type="number"
                    leftAddon="$"
                    value={data.utilities || ''}
                    onChange={(e) => handleChange('utilities', e.target.value)}
                  />
                  <Input
                    label="Management Fee"
                    type="number"
                    rightAddon="%"
                    value={data.management_fee_percent || ''}
                    onChange={(e) => handleChange('management_fee_percent', e.target.value)}
                  />
                  <Input
                    label="Repairs & Maintenance"
                    type="number"
                    leftAddon="$"
                    value={data.repairs_maintenance || ''}
                    onChange={(e) => handleChange('repairs_maintenance', e.target.value)}
                  />
                  <Input
                    label="Reserves / CapEx"
                    type="number"
                    leftAddon="$"
                    value={data.reserves_capex || ''}
                    onChange={(e) => handleChange('reserves_capex', e.target.value)}
                  />
                  <Input
                    label="Other Expenses"
                    type="number"
                    leftAddon="$"
                    value={data.other_expenses || ''}
                    onChange={(e) => handleChange('other_expenses', e.target.value)}
                  />
                  <div className="flex items-end">
                    <div className="text-sm text-red-700">
                      Mgmt Fee: {formatCurrency(managementFee)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-sm py-2 border-t border-red-300 mt-4">
                  <span className="font-semibold text-red-800">Total Operating Expenses</span>
                  <span className="font-bold text-red-700 text-lg">{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-600 mt-1">
                  <span>Operating Expense Ratio</span>
                  <span>{formatPercent(expenseRatio)}</span>
                </div>
              </div>

              {/* NOI Section */}
              <div className="bg-primary-50 rounded-xl p-5 border border-primary-200">
                <h3 className="text-sm font-semibold text-primary-800 uppercase tracking-wide mb-4">
                  Net Operating Income
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Effective Gross Income</span>
                    <span className="font-medium">{formatCurrency(egi)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Less: Operating Expenses</span>
                    <span className="font-medium text-red-600">-{formatCurrency(totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-primary-300">
                    <span className="font-bold text-primary-900 text-lg">NOI</span>
                    <span className="font-bold text-primary-900 text-2xl">{formatCurrency(noi)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Financing Tab */}
          {activeTab === 'financing' && (
            <div className="space-y-6">
              {/* Purchase & Loan */}
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-4">
                  Purchase & Financing
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Purchase Price"
                    type="number"
                    leftAddon="$"
                    value={data.purchase_price || ''}
                    onChange={(e) => handleChange('purchase_price', e.target.value)}
                  />
                  <Input
                    label="Loan-to-Value (LTV)"
                    type="number"
                    rightAddon="%"
                    value={data.ltv_percent || ''}
                    onChange={(e) => handleChange('ltv_percent', e.target.value)}
                  />
                  <Input
                    label="Interest Rate"
                    type="number"
                    step="0.125"
                    rightAddon="%"
                    value={data.interest_rate || ''}
                    onChange={(e) => handleChange('interest_rate', e.target.value)}
                  />
                  <Input
                    label="Amortization"
                    type="number"
                    rightAddon="years"
                    value={data.amortization_years || ''}
                    onChange={(e) => handleChange('amortization_years', e.target.value)}
                  />
                  <Input
                    label="Closing Costs"
                    type="number"
                    rightAddon="%"
                    value={data.closing_costs_percent || ''}
                    onChange={(e) => handleChange('closing_costs_percent', e.target.value)}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Loan Amount</span>
                    <span className="font-medium">{formatCurrency(loanAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Down Payment</span>
                    <span className="font-medium">{formatCurrency(downPayment)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Monthly Payment</span>
                    <span className="font-medium">{formatCurrency(monthlyPayment)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-blue-200">
                    <span>Annual Debt Service</span>
                    <span>{formatCurrency(annualDebtService)}</span>
                  </div>
                </div>
              </div>

              {/* DSCR */}
              <div className={`rounded-xl p-5 border ${
                dscrStatus === 'danger' ? 'bg-red-50 border-red-300' :
                dscrStatus === 'warning' ? 'bg-yellow-50 border-yellow-300' :
                'bg-green-50 border-green-300'
              }`}>
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">
                  Debt Service Coverage Ratio
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{formatRatio(dscr)}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {dscrStatus === 'danger' && `Below ${THRESHOLDS.DSCR_WARNING}x - High Risk`}
                      {dscrStatus === 'warning' && `Below ${THRESHOLDS.DSCR_GOOD}x - Moderate Risk`}
                      {dscrStatus === 'good' && 'Healthy Coverage'}
                    </p>
                  </div>
                  {dscrStatus === 'danger' && (
                    <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  {dscrStatus === 'good' && (
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Cash Flow */}
              <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
                <h3 className="text-sm font-semibold text-purple-800 uppercase tracking-wide mb-4">
                  Cash Flow Analysis
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Net Operating Income</span>
                    <span className="font-medium">{formatCurrency(noi)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Less: Annual Debt Service</span>
                    <span className="font-medium text-red-600">-{formatCurrency(annualDebtService)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t border-purple-300">
                    <span className="font-bold text-purple-900">Before-Tax Cash Flow</span>
                    <span className={`font-bold text-xl ${beforeTaxCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(beforeTaxCashFlow)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Projections Tab */}
          {activeTab === 'projections' && (
            <ProjectionTable
              initialIncome={egi}
              initialExpenses={totalExpenses}
              purchasePrice={data.purchase_price}
              loanAmount={loanAmount}
              interestRate={data.interest_rate}
              amortizationYears={data.amortization_years}
              totalCashInvested={totalCashRequired}
            />
          )}

          {/* Sensitivity Tab */}
          {activeTab === 'sensitivity' && (
            <SensitivityTable
              noi={noi}
              purchasePrice={data.purchase_price}
              askingCapRate={capRate}
              initialIncome={egi}
              initialExpenses={totalExpenses}
              loanAmount={loanAmount}
              interestRate={data.interest_rate}
              amortizationYears={data.amortization_years}
              totalCashInvested={totalCashRequired}
            />
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Investment Summary */}
              <div className="bg-gray-900 text-white rounded-xl p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 text-gray-300">
                  Investment Summary
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-400 text-sm">Total Cash Required</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalCashRequired)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(downPayment)} down + {formatCurrency(closingCosts)} closing
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Annual Cash Flow</p>
                    <p className={`text-2xl font-bold ${beforeTaxCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(beforeTaxCashFlow)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(beforeTaxCashFlow / 12)}/month
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Cap Rate</p>
                  <p className="text-2xl font-bold text-primary-600">{formatPercent(capRate)}</p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Cash on Cash</p>
                  <p className={`text-2xl font-bold ${cashOnCash >= 8 ? 'text-green-600' : 'text-gray-900'}`}>
                    {formatPercent(cashOnCash)}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">DSCR</p>
                  <p className={`text-2xl font-bold ${
                    dscrStatus === 'danger' ? 'text-red-600' :
                    dscrStatus === 'warning' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {formatRatio(dscr)}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Price/SF</p>
                  <p className="text-2xl font-bold text-gray-900">${pricePerSqft.toFixed(0)}</p>
                </div>
              </div>

              {/* Valuation Metrics */}
              <div className="bg-gray-50 rounded-xl p-5 border">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">
                  Valuation Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">NOI</span>
                    <span className="font-semibold">{formatCurrency(noi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cap Rate</span>
                    <span className="font-semibold">{formatPercent(capRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">GRM</span>
                    <span className="font-semibold">{grm.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expense Ratio</span>
                    <span className="font-semibold">{formatPercent(expenseRatio)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Notes
                </label>
                <textarea
                  value={data.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Add notes about assumptions, risks, or other considerations..."
                  rows={4}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
