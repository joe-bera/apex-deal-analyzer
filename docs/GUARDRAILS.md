# Business Guardrails - Apex Deal Analyzer

This document defines the business rules, validation requirements, security constraints, and operational limits that the Apex Deal Analyzer application **must enforce** at all times.

---

## File Upload Restrictions

### File Type Validation

**MUST ENFORCE:**
- ✅ **Allowed**: PDF files only (`.pdf` extension)
- ❌ **Rejected**: All other file types (`.docx`, `.xlsx`, `.txt`, `.jpg`, etc.)

**Validation Method:**
```typescript
// Primary: MIME type check
if (file.mimetype !== 'application/pdf') {
  throw new Error('Only PDF files are allowed');
}

// Secondary: Magic number verification (prevent spoofing)
// PDF files start with: %PDF-
const buffer = await fs.readFile(file.path, { encoding: 'utf8', flag: 'r' });
if (!buffer.startsWith('%PDF-')) {
  throw new Error('Invalid PDF file format');
}
```

### File Size Limits

**MUST ENFORCE:**
- ✅ **Maximum**: 10 MB (10,485,760 bytes)
- ⚠️ **Warning threshold**: 8 MB (suggest compression to user)
- ❌ **Rejected**: Files exceeding 10 MB

**Implementation:**
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
const WARNING_SIZE = 8 * 1024 * 1024;   // 8 MB

if (file.size > MAX_FILE_SIZE) {
  throw new Error('File size exceeds 10 MB limit. Please compress or split the document.');
}

if (file.size > WARNING_SIZE) {
  logger.warn(`Large file uploaded: ${file.size} bytes by user ${userId}`);
}
```

**Rationale:**
- Most Offering Memorandums: 2-5 MB
- Title reports: 500 KB - 2 MB
- Appraisals: 3-8 MB
- 10 MB covers 95% of commercial real estate documents

### File Name Sanitization

**MUST ENFORCE:**
- Remove special characters except: `.`, `-`, `_`
- Limit file name to 255 characters
- Convert spaces to underscores

**Implementation:**
```typescript
const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace invalid chars
    .substring(0, 255)                  // Limit length
    .toLowerCase();                     // Normalize case
};
```

---

## Rate Limiting

### Upload Endpoint

**MUST ENFORCE:**
- **Per User**: 20 uploads per hour
- **Per IP Address**: 50 uploads per hour (prevent abuse)
- **Burst Allowance**: 5 uploads per 5 minutes

**Response on Limit Exceeded:**
```json
{
  "error": "Rate limit exceeded",
  "message": "You have reached the maximum of 20 uploads per hour. Please try again at [timestamp].",
  "retryAfter": 3600,
  "limit": 20,
  "remaining": 0
}
```

**HTTP Status Code:** `429 Too Many Requests`

### AI Extraction Endpoint (Claude API)

**MUST ENFORCE:**
- **Per User**: 50 AI extractions per day
- **Per Organization**: 500 AI extractions per day
- **Cost Cap**: $100/day total Claude API spend

**Rationale:**
- Claude API costs ~$0.50-$2.00 per document (depending on size)
- 50 extractions/day = ~$25-$100/day max per user
- Prevents runaway costs from bugs or abuse

### General API Rate Limits

**MUST ENFORCE:**
- **Authenticated Users**: 100 requests per minute
- **Unauthenticated**: 10 requests per minute (login, health check only)

---

## Authentication & Authorization

### Password Requirements

**MUST ENFORCE:**
- Minimum length: 8 characters
- Must contain:
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
  - At least 1 special character (!@#$%^&*)
- Maximum length: 128 characters
- Cannot be common passwords (check against top 10,000 list)

**Validation Regex:**
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,128}$/;
```

### Password Storage

**MUST ENFORCE:**
- Hash with bcrypt (cost factor: 10)
- Never store plaintext passwords
- Never log passwords (even in error messages)

```typescript
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
```

### Failed Login Attempts

**MUST ENFORCE:**
- **5 failed attempts** within 15 minutes = account temporarily locked
- **Lockout duration**: 15 minutes
- **Notification**: Email user about locked account (security alert)

### Session Management

**MUST ENFORCE:**
- JWT token expiration: 24 hours
- Refresh token expiration: 7 days
- Logout invalidates token (add to blacklist until expiry)
- Concurrent sessions allowed: 3 per user

### Role-Based Access Control (RBAC)

**Roles:**
1. **Admin**: Full access (manage users, delete properties, system settings)
2. **Broker**: Upload docs, edit properties, view all properties
3. **Analyst**: Upload docs, edit assigned properties, view all properties
4. **Investor** (Read-only): View properties they've been granted access to

**MUST ENFORCE:**
```typescript
// Example: Only brokers and admins can delete properties
if (!['admin', 'broker'].includes(user.role)) {
  throw new ForbiddenError('Insufficient permissions to delete properties');
}
```

---

## Data Validation Rules

### Property Data

**Required Fields:**
- `address` (string, max 255 chars)
- `city` (string, max 100 chars)
- `state` (string, exactly 2 chars, uppercase)
- `zipCode` (string, format: `\d{5}(-\d{4})?`)
- `propertyType` (enum: warehouse, distribution_center, manufacturing, flex_space, cold_storage)

**Numeric Fields:**
- `squareFootage`: Integer, > 0, < 10,000,000
- `salePrice`: Decimal, > 0, < 1,000,000,000 (1 billion max)
- `capRate`: Decimal, >= 0, <= 100 (percentage)
- `noi`: Decimal, can be negative (some properties operate at loss)
- `pricePerSqft`: Decimal, > 0, < 10,000

**Financial Calculations (Sanity Checks):**
```typescript
// CAP Rate validation
if (capRate < 0 || capRate > 100) {
  throw new ValidationError('CAP rate must be between 0% and 100%');
}

// Unusual but not invalid CAP rates should warn
if (capRate < 2 || capRate > 15) {
  logger.warn(`Unusual CAP rate detected: ${capRate}% for property ${propertyId}`);
}

// Price per sqft validation (industrial range)
if (pricePerSqft < 10 || pricePerSqft > 1000) {
  logger.warn(`Unusual price/sqft: $${pricePerSqft} for property ${propertyId}`);
}
```

### Address Validation

**MUST ENFORCE:**
- Cannot be empty string
- Must match format: `[Number] [Street Name] [Street Type]`
- Cities must be in allowed regions:
  - **Inland Empire**: Ontario, Rancho Cucamonga, Fontana, Riverside, San Bernardino, Corona, Moreno Valley, Perris, Jurupa Valley
  - **Coachella Valley**: Palm Desert, Indio, La Quinta, Palm Springs, Cathedral City, Rancho Mirage, Desert Hot Springs

**Optional Enhancement:**
- Use Google Maps Geocoding API to validate real addresses
- Store latitude/longitude for mapping features

---

## Security Requirements

### Input Sanitization

**MUST ENFORCE:**
- Sanitize all user inputs before database queries
- Use parameterized queries (NEVER string concatenation)
- Strip HTML tags from text fields
- Escape special characters in search queries

```typescript
// Bad (SQL Injection vulnerable)
const query = `SELECT * FROM properties WHERE city = '${city}'`;

// Good (Parameterized)
const query = 'SELECT * FROM properties WHERE city = $1';
const result = await db.query(query, [city]);
```

### XSS Prevention

**MUST ENFORCE:**
- Encode output when rendering user-generated content
- Use Content Security Policy (CSP) headers
- Sanitize file names before displaying to users

### CORS Policy

**MUST ENFORCE:**
- Development: Allow `http://localhost:3000` (frontend dev server)
- Production: Allow only official domain (e.g., `https://apex-analyzer.com`)
- Credentials: `credentials: true` for cookie-based auth

```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

### HTTPS Enforcement

**MUST ENFORCE (Production only):**
- Redirect all HTTP traffic to HTTPS
- Set `Strict-Transport-Security` header
- Secure cookies with `SameSite=Strict` and `Secure` flags

### API Key Protection

**MUST ENFORCE:**
- Claude API key stored in environment variables ONLY
- Never expose API keys in client-side code
- Rotate keys every 90 days
- Monitor API usage for anomalies

---

## Data Retention & Privacy

### Uploaded Files

**MUST ENFORCE:**
- Temporary files deleted after processing (within 24 hours)
- Processed data stored in database indefinitely
- Original PDFs archived in secure storage for 90 days
- After 90 days: Move to cold storage or delete (user configurable)

### User Data

**MUST ENFORCE:**
- Deleted users: Anonymize data (replace name with "Deleted User")
- Keep audit logs for 1 year
- Allow users to export their data (GDPR/CCPA compliance)

### Audit Logging

**MUST LOG:**
- User login/logout events
- Failed login attempts
- Property uploads (who, when, file name)
- Data edits (before/after values, timestamp, user)
- Property deletions
- Role changes

**Log Retention:** 1 year minimum

---

## Error Handling Standards

### User-Facing Errors

**MUST ENFORCE:**
- Never expose stack traces to users
- Provide actionable error messages
- Log detailed errors server-side for debugging

**Examples:**
```typescript
// Good
return res.status(400).json({
  error: 'Invalid file format',
  message: 'Please upload a PDF file. Other formats are not supported.',
});

// Bad (exposes internals)
return res.status(500).json({
  error: err.stack,
  message: 'Database connection failed at line 42 in propertyService.ts',
});
```

### HTTP Status Codes

**MUST USE:**
- `200 OK`: Successful GET request
- `201 Created`: Successful POST (resource created)
- `400 Bad Request`: Validation error, malformed request
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Authenticated but insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error (log details internally)

---

## Performance Requirements

### API Response Time

**MUST MEET:**
- Health check: < 50ms
- Property list (paginated): < 200ms
- Single property fetch: < 100ms
- PDF upload: < 5 seconds (for 5 MB file)
- AI extraction: < 30 seconds (Claude API call + processing)

### Database Queries

**MUST ENFORCE:**
- Use indexes on frequently queried fields (city, propertyType, createdAt)
- Limit result sets to 100 records max (use pagination)
- Timeout queries after 10 seconds

### File Processing

**MUST ENFORCE:**
- Stream large PDFs (don't load entire file into memory)
- Process PDFs asynchronously (return immediate response, process in background)
- Notify user when extraction completes (email or push notification)

---

## Testing Requirements

### Before Deployment

**MUST VERIFY:**
- [ ] All upload validations work (file type, size, malicious files)
- [ ] Rate limiting enforces correctly
- [ ] Authentication rejects invalid credentials
- [ ] Authorization prevents unauthorized access
- [ ] Financial calculations are accurate (CAP rate, price/sqft)
- [ ] Error handling returns safe messages
- [ ] Database queries use parameterized inputs
- [ ] File cleanup removes temporary files

### Test Cases (Minimum)

1. **Upload 11 MB PDF** → Should reject
2. **Upload .docx file renamed to .pdf** → Should reject (magic number check)
3. **21st upload in 1 hour** → Should rate limit
4. **Extract property with negative CAP rate** → Should validate and warn
5. **Login with wrong password 5 times** → Should lock account
6. **SQL injection attempt in search** → Should sanitize and not execute

---

## Monitoring & Alerts

### MUST MONITOR:**
- Upload success rate (should be > 95%)
- AI extraction success rate (should be > 90%)
- API error rate (should be < 1%)
- Average response time per endpoint
- Database query performance
- Claude API costs per day

### MUST ALERT:**
- Error rate > 5% for 5 minutes
- Response time > 1 second for 5 minutes
- Failed login attempts > 100/hour (potential brute force attack)
- Claude API costs > $100/day
- Disk space < 10% remaining (file uploads)

---

## Compliance

### GDPR / CCPA (if applicable)

**MUST IMPLEMENT:**
- Data export functionality (user can download all their data)
- Data deletion (right to be forgotten)
- Privacy policy disclosure
- Cookie consent (if using analytics)

### Financial Data Accuracy

**MUST ENSURE:**
- All calculations use precise decimal types (not floats)
- Round currency to 2 decimal places
- Display percentages with 2 decimal places (e.g., 5.75%)
- Include disclaimers: "Calculated values are estimates. Consult with financial advisors."

---

## Environment-Specific Guardrails

### Development
- Rate limits relaxed (100 uploads/hour for testing)
- Detailed error messages in responses (for debugging)
- File size limit: 20 MB (for testing large docs)

### Production
- Strict rate limits as defined above
- Generic error messages
- File size limit: 10 MB
- HTTPS required
- Database backups every 24 hours

---

## Summary Checklist

Before deploying ANY feature, verify:

- [ ] Input validation implemented
- [ ] Error handling in place
- [ ] Rate limiting configured
- [ ] Authentication/authorization enforced
- [ ] Security: No SQL injection, XSS, or exposed secrets
- [ ] Logging: Errors logged, sensitive data not logged
- [ ] Performance: Tested with realistic data volumes
- [ ] Documentation: API changes documented

---

**Last Updated**: 2025-11-29
**Review Frequency**: Quarterly or after security incidents
**Maintained By**: Development Team + Security Lead
