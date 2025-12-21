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
 * Schema for updating a property (all fields optional)
 */
export const updatePropertySchema = z
  .object({
    ...propertyBaseFields,
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
    comp_square_footage: z.number().positive('Square footage must be positive').optional(),
    comp_year_built: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear() + 5)
      .optional(),
    comp_sale_price: z.number().positive('Sale price must be positive'),
    comp_sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sale date must be YYYY-MM-DD format'),
    comp_price_per_sqft: z.number().positive().optional(),
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
  })
  .strict();
