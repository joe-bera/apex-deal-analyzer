# Claude AI Context - Apex Deal Analyzer

This document provides context for Claude Code to understand the project, business domain, technical decisions, and coding standards for the Apex Deal Analyzer platform.

---

## Project Context

### Business Overview

**Apex Real Estate Services** is a commercial real estate brokerage specializing in industrial properties in Southern California. The firm focuses on two primary markets:

- **Inland Empire**: Ontario, Rancho Cucamonga, Fontana, Riverside, San Bernardino
- **Coachella Valley**: Palm Desert, Indio, La Quinta, Palm Springs

**Property Types**: Industrial warehouses, distribution centers, manufacturing facilities, flex space, and cold storage

**Target Users**:
- **Brokers**: Deal sourcing, client presentations, market analysis
- **Analysts**: Financial modeling, comp analysis, due diligence
- **Investors**: Portfolio evaluation, deal comparison, ROI assessment
- **Management Team**: Deal pipeline oversight, strategic decision-making

### Problem Statement

The current due diligence process involves:
1. Manually reading through lengthy PDF documents (100+ pages)
2. Extracting key data points into Excel spreadsheets
3. Calculating financial metrics (CAP rate, price/sqft, NOI)
4. Comparing properties against market comps
5. Creating investment summaries for stakeholders

This process is time-consuming (4-8 hours per property), error-prone, and difficult to scale across multiple simultaneous deals.

### Solution

The Apex Deal Analyzer automates document processing and financial analysis:
- **Upload PDFs** → Extract structured data via AI + rules
- **Calculate metrics** → Instant CAP rates, price/sqft, ROI projections
- **Compare properties** → Side-by-side analysis with market comps
- **Collaborative platform** → Share analysis with team and investors
- **Manual override** → Edit AI-extracted data to ensure accuracy

---

## Tech Stack Decisions

### Why These Technologies?

| Technology | Reason |
|------------|--------|
| **TypeScript** | Type safety for financial calculations, better developer experience, reduces runtime errors |
| **Node.js/Express** | Fast development, strong PDF parsing libraries, team familiarity |
| **React** | Component reusability (property cards, comparison tables), rich ecosystem |
| **PostgreSQL** | Structured relational data (properties, financials, comps), ACID compliance for financial accuracy |
| **Claude API** | Best-in-class document understanding, context window handles long PDFs, structured output for data extraction |
| **JWT Authentication** | Stateless, scalable, works well with React SPA architecture |
| **Multer** | Standard Node.js file upload middleware, reliable and well-tested |

### Hybrid Extraction Strategy

**Rule-Based Extraction** (for standardized fields):
- Property address → Regex patterns for address formats
- CAP rate → Look for "CAP Rate: X%" or similar patterns
- Sale price → Dollar amounts near "Price" or "Sale Amount"
- Square footage → Numbers near "SF", "Sq Ft", "Square Feet"

**AI-Powered Extraction** (Claude API for complex content):
- Tenant information from lease abstracts
- Environmental concerns from Phase I reports
- Deal structure from offering memorandums
- Non-standard document formats
- Contextual information (e.g., "property is near major highway")

**Why Hybrid?**
- Rules are fast and free for 80% of common fields
- AI handles edge cases and variable formats
- Cost control (Claude API charges per token)
- Accuracy: Rules for precise fields, AI for interpretation

---

## Coding Guidelines for This Project

### General Principles

1. **Modular Code**
   - Keep functions small and focused (single responsibility)
   - Separate business logic from controllers
   - Create reusable services (e.g., `pdfParser.ts`, `calculations.ts`)
   - Example:
     ```typescript
     // Good: Modular
     export const calculateCapRate = (noi: number, purchasePrice: number): number => {
       if (purchasePrice === 0) throw new Error('Purchase price cannot be zero');
       return (noi / purchasePrice) * 100;
     };

     // Bad: Mixed concerns
     app.post('/upload', (req, res) => {
       const noi = extractNOI(pdfText);
       const price = extractPrice(pdfText);
       const capRate = (noi / price) * 100; // Calculation logic in controller
       res.json({ capRate });
     });
     ```

2. **Comments on Complex Logic**
   - Explain *why*, not *what* (code should be self-explanatory)
   - Document regex patterns, financial formulas, AI prompt engineering
   - Example:
     ```typescript
     // Extract CAP rate using multiple pattern variations to handle different OM formats
     // Pattern 1: "CAP Rate: 5.5%" (standard)
     // Pattern 2: "Cap: 5.5" (abbreviated)
     // Pattern 3: "Capitalization Rate 5.5%" (formal)
     const capRateRegex = /(?:CAP Rate|Cap|Capitalization Rate):?\s*([\d.]+)%?/i;
     ```

3. **Error Handling Always**
   - Every function that can fail should handle errors gracefully
   - Use try/catch for async operations
   - Return meaningful error messages (not system internals)
   - Log errors for debugging, but sanitize user-facing messages
   - Example:
     ```typescript
     export const uploadPDF = async (file: Express.Multer.File): Promise<UploadResult> => {
       try {
         if (!file) throw new Error('No file provided');
         if (file.mimetype !== 'application/pdf') throw new Error('File must be PDF');
         if (file.size > MAX_FILE_SIZE) throw new Error('File exceeds 10MB limit');

         const data = await parsePDF(file.path);
         return { success: true, data };
       } catch (error) {
         logger.error('PDF upload failed:', error);
         throw new Error('Failed to process PDF. Please check file format and try again.');
       }
     };
     ```

4. **No Hardcoded Credentials**
   - ALL sensitive data in `.env` file
   - Use environment variable validation on startup
   - Never commit `.env` to git (use `.env.example` as template)
   - Example:
     ```typescript
     // config/env.ts
     export const config = {
       port: process.env.PORT || 3001,
       database: {
         url: process.env.DATABASE_URL!,
       },
       claude: {
         apiKey: process.env.CLAUDE_API_KEY!,
       },
       jwt: {
         secret: process.env.JWT_SECRET!,
       },
     };

     // Validate required env vars on startup
     const requiredEnvVars = ['DATABASE_URL', 'CLAUDE_API_KEY', 'JWT_SECRET'];
     requiredEnvVars.forEach(varName => {
       if (!process.env[varName]) {
         throw new Error(`Missing required environment variable: ${varName}`);
       }
     });
     ```

5. **Type Safety**
   - Define TypeScript interfaces for all data structures
   - Use shared types between frontend and backend (`/shared/types`)
   - Avoid `any` type unless absolutely necessary
   - Example:
     ```typescript
     // shared/types/property.ts
     export interface Property {
       id: string;
       address: string;
       city: string;
       state: string;
       zipCode: string;
       squareFootage: number;
       salePrice: number;
       capRate?: number;
       noi?: number;
       pricePerSqft: number;
       propertyType: PropertyType;
     }

     export enum PropertyType {
       WAREHOUSE = 'warehouse',
       DISTRIBUTION_CENTER = 'distribution_center',
       MANUFACTURING = 'manufacturing',
       FLEX_SPACE = 'flex_space',
       COLD_STORAGE = 'cold_storage',
     }
     ```

6. **Validation Everywhere**
   - Validate inputs at API boundaries (middleware)
   - Validate extracted data from PDFs (sanity checks)
   - Validate user edits before saving to database
   - Example:
     ```typescript
     // middleware/validateProperty.ts
     export const validatePropertyData = (data: Partial<Property>): ValidationResult => {
       const errors: string[] = [];

       if (data.capRate && (data.capRate < 0 || data.capRate > 100)) {
         errors.push('CAP rate must be between 0% and 100%');
       }

       if (data.squareFootage && data.squareFootage <= 0) {
         errors.push('Square footage must be positive');
       }

       if (data.salePrice && data.salePrice <= 0) {
         errors.push('Sale price must be positive');
       }

       return { isValid: errors.length === 0, errors };
     };
     ```

7. **Commit After Major Features**
   - Commit working code frequently (every logical unit of work)
   - Use descriptive commit messages following conventional commits
   - Format: `<type>: <description>`
     - `feat:` New feature
     - `fix:` Bug fix
     - `refactor:` Code restructuring without feature changes
     - `docs:` Documentation updates
     - `test:` Adding tests
     - `chore:` Build/config changes
   - Example good commits:
     ```
     feat: add PDF upload endpoint with file validation
     feat: implement Claude API integration for data extraction
     fix: handle malformed PDF files gracefully
     refactor: extract calculation logic into dedicated service
     docs: add API endpoint documentation for property routes
     ```

8. **Security First**
   - Sanitize all user inputs (prevent XSS, SQL injection)
   - Use parameterized database queries (never string concatenation)
   - Implement rate limiting on sensitive endpoints
   - Hash passwords with bcrypt (never store plaintext)
   - Validate JWT tokens on protected routes

9. **Performance Considerations**
   - Stream large PDFs instead of loading into memory
   - Cache Claude API responses to avoid redundant calls
   - Use database indexes on frequently queried fields
   - Paginate large result sets
   - Clean up temporary uploaded files after processing

10. **Testing Strategy**
    - Unit tests for calculation functions (CAP rate, price/sqft)
    - Integration tests for API endpoints
    - Test error handling paths (malformed PDFs, invalid data)
    - Mock Claude API calls in tests (avoid costs)

---

## Code Organization Patterns

### Services Layer
```typescript
// services/pdfParser.ts
export class PDFParserService {
  async extractText(filePath: string): Promise<string> { }
  async extractMetadata(filePath: string): Promise<PDFMetadata> { }
}

// services/aiExtractor.ts
export class AIExtractorService {
  async extractPropertyData(text: string): Promise<PropertyData> { }
  async extractFinancials(text: string): Promise<FinancialData> { }
}

// services/calculations.ts
export class CalculationService {
  calculateCapRate(noi: number, price: number): number { }
  calculatePricePerSqft(price: number, sqft: number): number { }
  calculateROI(annualReturn: number, investment: number): number { }
}
```

### Controller Pattern
```typescript
// controllers/propertyController.ts
export const uploadProperty = async (req: Request, res: Response) => {
  try {
    // 1. Validate request
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // 2. Call service layer
    const result = await propertyService.processUpload(req.file);

    // 3. Return response
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Upload failed:', error);
    return res.status(500).json({ error: 'Failed to process upload' });
  }
};
```

### Route Pattern
```typescript
// routes/propertyRoutes.ts
import { Router } from 'express';
import { uploadProperty, getProperty } from '../controllers/propertyController';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/properties', authenticate, upload.single('file'), uploadProperty);
router.get('/properties/:id', authenticate, getProperty);

export default router;
```

---

## Domain-Specific Knowledge

### Commercial Real Estate Metrics

1. **CAP Rate (Capitalization Rate)**
   - Formula: `(Net Operating Income / Purchase Price) × 100`
   - Typical range for industrial: 4% - 8%
   - Higher CAP = Higher return but often higher risk

2. **Price Per Square Foot**
   - Formula: `Sale Price / Square Footage`
   - Industrial benchmark (Inland Empire): $150-$300/sqft (varies by location)

3. **Net Operating Income (NOI)**
   - Formula: `Gross Income - Operating Expenses`
   - Does NOT include debt service or capital expenditures

4. **Cash on Cash Return**
   - Formula: `(Annual Cash Flow / Total Cash Invested) × 100`
   - Accounts for financing (unlike CAP rate)

5. **Debt Service Coverage Ratio (DSCR)**
   - Formula: `NOI / Annual Debt Service`
   - Lenders typically require DSCR ≥ 1.25

### Common Document Types

1. **Offering Memorandum (OM)**
   - Contains: Property overview, financials, photos, location map
   - Key sections: Executive summary, property details, market analysis, financials

2. **Title Report**
   - Contains: Legal description, liens, encumbrances, easements
   - Key data: Property address, APN, legal owner, outstanding debts

3. **Rent Roll / Lease Abstract**
   - Contains: Tenant names, lease terms, rent amounts, expiration dates
   - Key data: Occupancy rate, weighted average lease term, annual rent

4. **Appraisal**
   - Contains: Property valuation, comparable sales, income approach
   - Key data: Appraised value, effective date, comparable properties

5. **Comparable Sales (Comps)**
   - Contains: Recent sales of similar properties
   - Key data: Sale price, price/sqft, CAP rate, location, date of sale

---

## Development Workflow

1. **Feature Development**
   - Create feature branch: `git checkout -b feature/description`
   - Develop with frequent commits
   - Test locally before pushing
   - Push to GitHub: `git push -u origin feature/description`
   - Create PR for review (future team members)

2. **Debugging**
   - Use descriptive log messages
   - Log inputs/outputs for PDF extraction
   - Track API usage (Claude API tokens)

3. **Environment Management**
   - Development: `.env` (local settings)
   - Staging: `.env.staging` (test environment)
   - Production: Environment variables in hosting platform

---

## Future Considerations

- **Scalability**: If processing >100 PDFs/day, consider background job queue (Bull, BeeQueue)
- **Mobile App**: Design API to be frontend-agnostic (could add React Native later)
- **Export Features**: PDF reports, Excel exports of analysis
- **Email Notifications**: Alert users when extraction completes
- **Audit Logging**: Track who edited what data and when
- **Multi-tenancy**: If expanding to other brokerages, add organization-level isolation

---

## Questions to Ask Before Building

When implementing new features, consider:
- Is this data validated?
- How do we handle errors?
- What if the PDF doesn't contain this field?
- Should this be rule-based or AI-extracted?
- Do we need to cache this?
- What are the performance implications?
- Is this a security risk?
- How will this be tested?

---

**Last Updated**: 2025-11-29
**Maintained By**: Development Team (Claude Code + Human Developer)
