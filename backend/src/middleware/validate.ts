/**
 * Zod Validation Middleware
 *
 * Provides request validation using Zod schemas.
 * Validates body, query, and params before reaching controllers.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation target - which part of the request to validate
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation options
 */
interface ValidationOptions {
  /** Strip unknown keys from the validated object (default: true) */
  stripUnknown?: boolean;
}

/**
 * Format Zod errors into user-friendly messages
 */
const formatZodErrors = (error: ZodError): string[] => {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
};

/**
 * Create validation middleware for a given schema and target
 *
 * @param schema - Zod schema to validate against
 * @param target - Which part of request to validate ('body', 'query', 'params')
 * @param options - Validation options
 * @returns Express middleware function
 *
 * @example
 * router.post('/properties', validate(createPropertySchema, 'body'), createProperty);
 * router.get('/properties', validate(listPropertiesQuerySchema, 'query'), listProperties);
 */
export const validate = <T extends ZodSchema>(
  schema: T,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) => {
  const { stripUnknown = true } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get the data to validate based on target
      const dataToValidate = req[target];

      // Parse and validate
      const validated = await schema.parseAsync(dataToValidate);

      // Replace request data with validated (and potentially transformed) data
      if (stripUnknown) {
        req[target] = validated;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodErrors(error);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      // Re-throw non-Zod errors
      next(error);
    }
  };
};

/**
 * Validate multiple targets at once
 *
 * @example
 * router.post('/properties/:id/comps',
 *   validateMultiple({
 *     params: idParamSchema,
 *     body: createCompSchema,
 *   }),
 *   addCompToProperty
 * );
 */
export const validateMultiple = (schemas: Partial<Record<ValidationTarget, ZodSchema>>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: string[] = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      try {
        const dataToValidate = req[target as ValidationTarget];
        const validated = await schema.parseAsync(dataToValidate);
        req[target as ValidationTarget] = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          const targetErrors = formatZodErrors(error).map((e) => `${target}.${e}`);
          errors.push(...targetErrors);
        } else {
          next(error);
          return;
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
};

// ============================================================================
// Common Validation Schemas
// ============================================================================

/**
 * UUID parameter validation
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/**
 * Property ID parameter
 */
export const propertyIdParamSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID format'),
});

/**
 * Document ID parameter
 */
export const documentIdParamSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

/**
 * Comp ID parameter
 */
export const compIdParamSchema = z.object({
  compId: z.string().uuid('Invalid comp ID format'),
});

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().min(0)),
});

// ============================================================================
// Property Validation Schemas
// ============================================================================

/**
 * Property types enum
 */
export const propertyTypeEnum = z.enum([
  'warehouse',
  'distribution_center',
  'manufacturing',
  'flex_space',
  'cold_storage',
  'industrial',
  'office',
  'retail',
  'multifamily',
  'land',
  'mixed_use',
  'other',
]);

/**
 * Base property fields for validation
 */
const propertyBaseFields = {
  address: z.string().min(1, 'Address is required').max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().length(2, 'State must be 2 characters').optional(),
  zip_code: z.string().max(10).optional(),
  apn: z.string().max(50).optional(),
  property_type: propertyTypeEnum.optional(),
  subtype: z.string().max(100).optional(),
  building_size: z.number().positive('Building size must be positive').optional(),
  lot_size: z.number().positive('Lot size must be positive').optional(),
  year_built: z
    .number()
    .int()
    .min(1800, 'Year built must be after 1800')
    .max(new Date().getFullYear() + 5, 'Year built cannot be in the far future')
    .optional(),
  stories: z.number().int().positive().optional(),
  units: z.number().int().positive().optional(),
  price: z.number().nonnegative('Price cannot be negative').optional(),
  price_per_sqft: z.number().nonnegative('Price per sqft cannot be negative').optional(),
  cap_rate: z
    .number()
    .min(0, 'CAP rate cannot be negative')
    .max(100, 'CAP rate cannot exceed 100%')
    .optional(),
  noi: z.number().optional(), // Can be negative for distressed properties
  gross_income: z.number().nonnegative('Gross income cannot be negative').optional(),
  operating_expenses: z.number().nonnegative('Operating expenses cannot be negative').optional(),
  occupancy_rate: z
    .number()
    .min(0, 'Occupancy rate cannot be negative')
    .max(100, 'Occupancy rate cannot exceed 100%')
    .optional(),
  market: z.string().max(100).optional(),
  submarket: z.string().max(100).optional(),
  zoning: z.string().max(50).optional(),
  parking_spaces: z.number().int().nonnegative().optional(),
};

/**
 * Property status enum
 */
export const propertyStatusEnum = z.enum([
  'prospect', 'contacted', 'pitched', 'listed',
  'under_contract', 'sold', 'dead', 'watch',
]);

/**
 * Schema for updating a property (all fields optional)
 */
export const updatePropertySchema = z
  .object({
    ...propertyBaseFields,
    status: propertyStatusEnum.optional(),
    additional_data: z.record(z.unknown()).optional(),
  })
  .strict();

/**
 * Schema for property overrides when creating from document
 */
export const propertyOverridesSchema = z
  .object({
    overrides: z.object(propertyBaseFields).optional(),
  })
  .strict();

/**
 * Schema for listing properties query parameters
 */
export const listPropertiesQuerySchema = z
  .object({
    property_type: propertyTypeEnum.optional(),
    city: z.string().max(100).optional(),
    market: z.string().max(100).optional(),
    min_price: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined))
      .pipe(z.number().nonnegative().optional()),
    max_price: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined))
      .pipe(z.number().nonnegative().optional()),
    min_building_size: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined))
      .pipe(z.number().positive().optional()),
    max_building_size: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined))
      .pipe(z.number().positive().optional()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .pipe(z.number().min(1).max(100)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0))
      .pipe(z.number().min(0)),
  })
  .refine(
    (data) => {
      if (data.min_price !== undefined && data.max_price !== undefined) {
        return data.min_price <= data.max_price;
      }
      return true;
    },
    { message: 'min_price must be less than or equal to max_price' }
  )
  .refine(
    (data) => {
      if (data.min_building_size !== undefined && data.max_building_size !== undefined) {
        return data.min_building_size <= data.max_building_size;
      }
      return true;
    },
    { message: 'min_building_size must be less than or equal to max_building_size' }
  );

// ============================================================================
// Comp Validation Schemas
// ============================================================================

/**
 * Schema for creating a new comp
 */
export const createCompSchema = z
  .object({
    comp_address: z.string().min(1, 'Address is required').max(500),
    comp_city: z.string().min(1, 'City is required').max(100),
    comp_state: z.string().length(2, 'State must be 2 characters'),
    comp_zip_code: z.string().max(10).optional(),
    comp_property_type: propertyTypeEnum,
    comp_square_footage: z.number().positive('Square footage must be positive').nullable().optional(),
    comp_year_built: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear() + 5)
      .nullable()
      .optional(),
    comp_sale_price: z.number().positive('Sale price must be positive'),
    comp_sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sale date must be YYYY-MM-DD format'),
    comp_price_per_sqft: z.number().positive().nullable().optional(),
    comp_cap_rate: z.number().min(0).max(100).optional(),
    distance_miles: z.number().nonnegative().optional(),
    similarity_score: z.number().min(0).max(100).optional(),
    adjustment_notes: z.string().max(2000).optional(),
    source: z.string().max(200).optional(),
  })
  .strict();

/**
 * Schema for updating a comp (all fields optional except id)
 */
export const updateCompSchema = z
  .object({
    comp_address: z.string().min(1).max(500).optional(),
    comp_city: z.string().min(1).max(100).optional(),
    comp_state: z.string().length(2).optional(),
    comp_zip_code: z.string().max(10).optional(),
    comp_property_type: propertyTypeEnum.optional(),
    comp_square_footage: z.number().positive().optional(),
    comp_year_built: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear() + 5)
      .optional(),
    comp_sale_price: z.number().positive().optional(),
    comp_sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    comp_price_per_sqft: z.number().positive().optional(),
    comp_cap_rate: z.number().min(0).max(100).optional(),
    distance_miles: z.number().nonnegative().optional(),
    similarity_score: z.number().min(0).max(100).optional(),
    adjustment_notes: z.string().max(2000).optional(),
    source: z.string().max(200).optional(),
  })
  .strict();

// ============================================================================
// Auth Validation Schemas
// ============================================================================

/**
 * Schema for user signup
 */
export const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password too long'),
    full_name: z.string().min(1, 'Name is required').max(200).optional(),
  })
  .strict();

/**
 * Schema for user login
 */
export const loginSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

// ============================================================================
// Document Validation Schemas
// ============================================================================

/**
 * Document types enum
 */
export const documentTypeEnum = z.enum([
  'offering_memorandum',
  'title_report',
  'comp',
  'lease',
  'appraisal',
  'environmental_report',
  'other',
]);

/**
 * Schema for document upload metadata
 */
export const documentUploadSchema = z
  .object({
    document_type: documentTypeEnum.optional().default('other'),
    property_id: z.string().uuid().optional(),
  })
  .strict();

/**
 * Schema for extraction hints
 */
export const extractionHintsSchema = z
  .object({
    hints: z.string().max(5000).optional(),
  })
  .strict();

// ============================================================================
// Deal Analysis Validation Schemas
// ============================================================================

/**
 * Schema for deal analysis data
 * All fields optional for flexible saving
 */
export const dealAnalysisSchema = z
  .object({
    // Income Analysis
    potential_gross_income: z.number().nonnegative().optional().nullable(),
    vacancy_rate: z.number().min(0).max(100).optional().nullable(),
    vacancy_amount: z.number().nonnegative().optional().nullable(),
    other_income: z.number().nonnegative().optional().nullable(),
    effective_gross_income: z.number().optional().nullable(),

    // Expense Analysis
    property_taxes: z.number().nonnegative().optional().nullable(),
    insurance: z.number().nonnegative().optional().nullable(),
    utilities: z.number().nonnegative().optional().nullable(),
    management_fee_percent: z.number().min(0).max(100).optional().nullable(),
    management_fee_amount: z.number().nonnegative().optional().nullable(),
    repairs_maintenance: z.number().nonnegative().optional().nullable(),
    reserves_capex: z.number().nonnegative().optional().nullable(),
    other_expenses: z.number().nonnegative().optional().nullable(),
    total_operating_expenses: z.number().nonnegative().optional().nullable(),
    operating_expense_ratio: z.number().min(0).max(100).optional().nullable(),

    // Calculated Values
    net_operating_income: z.number().optional().nullable(),
    cap_rate: z.number().min(0).max(100).optional().nullable(),
    price_per_sqft: z.number().nonnegative().optional().nullable(),
    grm: z.number().nonnegative().optional().nullable(),

    // Financing
    purchase_price: z.number().nonnegative().optional().nullable(),
    loan_amount: z.number().nonnegative().optional().nullable(),
    ltv_percent: z.number().min(0).max(100).optional().nullable(),
    interest_rate: z.number().min(0).max(50).optional().nullable(),
    amortization_years: z.number().int().min(1).max(40).optional().nullable(),
    loan_term_years: z.number().int().min(1).max(40).optional().nullable(),
    monthly_payment: z.number().nonnegative().optional().nullable(),
    annual_debt_service: z.number().nonnegative().optional().nullable(),
    dscr: z.number().optional().nullable(),

    // Cash Flow
    down_payment: z.number().nonnegative().optional().nullable(),
    closing_costs_percent: z.number().min(0).max(20).optional().nullable(),
    closing_costs: z.number().nonnegative().optional().nullable(),
    total_cash_required: z.number().nonnegative().optional().nullable(),
    before_tax_cash_flow: z.number().optional().nullable(),
    cash_on_cash_return: z.number().optional().nullable(),

    // Notes
    notes: z.string().max(5000).optional().nullable(),

    // Strategy
    investment_strategy: z.string().max(50).optional().nullable(),

    // Value-Add Attribution
    va_below_market_rents: z.boolean().optional().nullable(),
    va_below_market_rents_note: z.string().max(2000).optional().nullable(),
    va_vacancy_leaseup: z.boolean().optional().nullable(),
    va_vacancy_leaseup_note: z.string().max(2000).optional().nullable(),
    va_expense_reduction: z.boolean().optional().nullable(),
    va_expense_reduction_note: z.string().max(2000).optional().nullable(),
    va_re_tenanting: z.boolean().optional().nullable(),
    va_re_tenanting_note: z.string().max(2000).optional().nullable(),
    va_physical_improvements: z.boolean().optional().nullable(),
    va_physical_improvements_note: z.string().max(2000).optional().nullable(),

    // As-Is vs Stabilized
    as_is_rent_psf: z.number().optional().nullable(),
    stabilized_rent_psf: z.number().optional().nullable(),
    as_is_occupancy: z.number().min(0).max(100).optional().nullable(),
    stabilized_occupancy: z.number().min(0).max(100).optional().nullable(),
    as_is_other_income: z.number().optional().nullable(),
    stabilized_other_income: z.number().optional().nullable(),
    as_is_expense_ratio: z.number().min(0).max(100).optional().nullable(),
    stabilized_expense_ratio: z.number().min(0).max(100).optional().nullable(),

    // Value-Add Costs
    va_capex: z.number().nonnegative().optional().nullable(),
    va_ti_leasing: z.number().nonnegative().optional().nullable(),
    va_carry_costs: z.number().nonnegative().optional().nullable(),
    va_contingency: z.number().nonnegative().optional().nullable(),
    va_total_cost: z.number().nonnegative().optional().nullable(),

    // Proforma Settings
    income_growth_rate: z.number().optional().nullable(),
    expense_growth_rate: z.number().optional().nullable(),
    holding_period: z.number().int().min(1).max(30).optional().nullable(),

    // Exit Analysis
    exit_cap_rate: z.number().min(0).max(100).optional().nullable(),
    selling_costs_percent: z.number().min(0).max(20).optional().nullable(),

    // Return Metrics
    irr: z.number().optional().nullable(),
    equity_multiple: z.number().optional().nullable(),
    avg_cash_on_cash: z.number().optional().nullable(),
    total_project_cost: z.number().optional().nullable(),
  });

// ============================================================================
// CRM Validation Schemas
// ============================================================================

// -- Enums --

export const contactTypeEnum = z.enum([
  'owner', 'tenant', 'buyer', 'seller', 'broker', 'lender', 'attorney',
  'property_manager', 'investor', 'developer', 'appraiser', 'contractor', 'other',
]);

export const companyTypeEnum = z.enum([
  'brokerage', 'investment_firm', 'developer', 'tenant_company', 'lender',
  'law_firm', 'management_company', 'construction', 'appraisal_firm', 'title_company', 'other',
]);

export const crmDealTypeEnum = z.enum([
  'sale', 'lease', 'listing', 'acquisition', 'disposition',
]);

export const dealStageEnum = z.enum([
  'prospecting', 'qualification', 'proposal', 'negotiation',
  'under_contract', 'due_diligence', 'closing', 'closed_won', 'closed_lost',
]);

export const activityTypeEnum = z.enum([
  'call', 'email', 'meeting', 'note', 'task', 'site_visit',
  'document_sent', 'offer_made', 'other',
]);

export const dealRoleEnum = z.enum([
  'buyer', 'seller', 'listing_broker', 'buyers_broker', 'co_broker', 'lender',
  'attorney_buyer', 'attorney_seller', 'escrow_officer', 'title_officer',
  'appraiser', 'inspector', 'property_manager', 'tenant', 'other',
]);

// -- Companies --

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(300),
  company_type: companyTypeEnum.optional().default('other'),
  industry: z.string().max(200).optional(),
  website: z.string().url().max(500).optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(300).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(10).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// -- Contacts --

export const createContactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email().max(300).optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  mobile_phone: z.string().max(30).optional(),
  company_id: z.string().uuid().optional().nullable(),
  title: z.string().max(200).optional(),
  contact_type: contactTypeEnum.optional().default('other'),
  license_number: z.string().max(50).optional(),
  source: z.string().max(200).optional(),
  last_contacted_at: z.string().datetime().optional().nullable(),
  next_follow_up_at: z.string().datetime().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const linkContactPropertySchema = z.object({
  master_property_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  relationship: z.enum(['owner', 'tenant', 'manager', 'broker', 'buyer', 'seller', 'lender', 'other']).default('other'),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => data.master_property_id || data.property_id,
  { message: 'Either master_property_id or property_id is required' }
);

// -- CRM Deals --

export const createCrmDealSchema = z.object({
  deal_name: z.string().min(1, 'Deal name is required').max(300),
  deal_type: crmDealTypeEnum,
  stage: dealStageEnum.optional().default('prospecting'),
  description: z.string().max(5000).optional(),
  property_id: z.string().uuid().optional().nullable(),
  master_property_id: z.string().uuid().optional().nullable(),
  deal_value: z.number().nonnegative().optional().nullable(),
  asking_price: z.number().nonnegative().optional().nullable(),
  offer_price: z.number().nonnegative().optional().nullable(),
  final_price: z.number().nonnegative().optional().nullable(),
  commission_total: z.number().nonnegative().optional().nullable(),
  commission_percent: z.number().min(0).max(100).optional().nullable(),
  commission_split_percent: z.number().min(0).max(100).optional().nullable(),
  commission_notes: z.string().max(2000).optional(),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  actual_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  listing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  probability_percent: z.number().int().min(0).max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
});

export const updateCrmDealSchema = createCrmDealSchema.partial();

export const updateDealStageSchema = z.object({
  stage: dealStageEnum,
  notes: z.string().max(2000).optional(),
});

export const addDealContactSchema = z.object({
  contact_id: z.string().uuid('Invalid contact ID'),
  role: dealRoleEnum.optional().default('other'),
});

// -- Activities --

export const createActivitySchema = z.object({
  activity_type: activityTypeEnum,
  subject: z.string().min(1, 'Subject is required').max(300),
  description: z.string().max(5000).optional(),
  contact_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  is_completed: z.boolean().optional(),
  activity_date: z.string().datetime().optional(),
});

export const updateActivitySchema = createActivitySchema.partial();
