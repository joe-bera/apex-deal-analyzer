# Apex Deal Analyzer

A comprehensive commercial real estate deal analysis platform built for **Apex Real Estate Services**. This application enables brokers, analysts, and investors to efficiently analyze industrial property deals in the Inland Empire and Coachella Valley markets.

## Overview

The Apex Deal Analyzer streamlines the commercial real estate due diligence process by:

- **Automated Document Processing**: Upload PDFs (title reports, offering memorandums, comps, appraisals, leases, environmental reports) and extract key data points using hybrid AI-powered and rule-based extraction
- **Financial Analysis**: Calculate CAP rates, price per square foot, NOI, and other critical investment metrics
- **Property Comparisons**: Compare target properties against market comps to determine fair market value
- **Collaborative Workflow**: Secure multi-user platform for internal team members and external investors
- **Manual Override**: Edit and supplement AI-extracted data to ensure accuracy

### Who It's For

- **Brokers**: Quickly analyze deals and create investment summaries
- **Analysts**: Deep dive into property financials and market positioning
- **Investors**: Review deal packages and compare opportunities
- **Internal Team**: Collaborate on due diligence and deal flow management

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT-based auth (email/password, OAuth planned)
- **PDF Processing**:
  - `pdf-parse` for text extraction
  - Claude API for intelligent data extraction
  - Rule-based parsers for standard document formats
- **File Upload**: Multer

### Frontend
- **Framework**: React with TypeScript
- **Build Tool**: Vite (or Create React App)
- **Styling**: TBD (Tailwind CSS / Material-UI / Styled Components)
- **State Management**: React Context / Redux (TBD)
- **API Client**: Axios

### Infrastructure
- **Version Control**: Git / GitHub
- **Deployment**: TBD (AWS, Vercel, Railway)
- **File Storage**: Local filesystem (development), S3 (production)

## Project Structure

```
apex-deal-analyzer/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── config/            # Database, environment, API configurations
│   │   ├── controllers/       # Request handlers for routes
│   │   ├── middleware/        # Auth, validation, error handling, rate limiting
│   │   ├── models/            # PostgreSQL models (User, Property, Document, etc.)
│   │   ├── routes/            # API endpoint definitions
│   │   ├── services/          # Business logic
│   │   │   ├── pdfParser.ts   # PDF text extraction
│   │   │   ├── aiExtractor.ts # Claude API integration
│   │   │   ├── ruleExtractor.ts # Rule-based field extraction
│   │   │   ├── calculations.ts # CAP rate, price/sqft, etc.
│   │   │   └── auth.ts        # Authentication logic
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Helper functions, validators
│   ├── uploads/               # Temporary PDF storage (excluded from git)
│   ├── tests/                 # Unit and integration tests
│   └── package.json
│
├── frontend/                   # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # Login, signup components
│   │   │   ├── common/        # Reusable UI components (buttons, modals, etc.)
│   │   │   ├── property/      # Property cards, detail views
│   │   │   └── analysis/      # Deal analysis, comparison tables
│   │   ├── pages/             # Page-level components (Dashboard, Property, Upload, etc.)
│   │   ├── services/          # API client, HTTP requests
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript interfaces
│   │   ├── utils/             # Formatting, validation helpers
│   │   └── styles/            # Global styles, theme configuration
│   ├── public/                # Static assets
│   └── package.json
│
├── shared/                     # Shared TypeScript types between frontend/backend
│   └── types/
│
├── docs/                       # Project documentation
│   ├── api.md                 # API endpoint documentation
│   ├── architecture.md        # System architecture overview
│   └── setup.md               # Detailed setup instructions
│
├── .gitignore
├── README.md
└── package.json               # Root workspace configuration (optional)
```

## Setup Instructions

### Prerequisites

- **Node.js**: v18+ and npm/yarn
- **PostgreSQL**: v14+
- **Git**: Latest version
- **Claude API Key**: For AI-powered extraction

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/joe-bera/apex-deal-analyzer.git
   cd apex-deal-analyzer
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials and API keys
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your API endpoint
   npm start
   ```

4. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb apex_deal_analyzer

   # Run migrations (once implemented)
   npm run migrate
   ```

### Environment Variables

**Backend (.env)**
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/apex_deal_analyzer
JWT_SECRET=your_jwt_secret_here
CLAUDE_API_KEY=your_claude_api_key_here
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**Frontend (.env)**
```
REACT_APP_API_URL=http://localhost:3001/api
```

## Guardrails & Security

### File Upload Restrictions

- **Allowed File Types**: PDF only (`.pdf`)
- **Maximum File Size**: 10 MB per upload
- **Rate Limiting**: 20 uploads per user per hour
- **Virus Scanning**: TBD (ClamAV integration for production)
- **Storage**: Files stored temporarily during processing, moved to permanent storage after extraction

### Authentication & Authorization

- **Password Requirements**: Minimum 8 characters, must include uppercase, lowercase, number
- **Session Management**: JWT tokens with 24-hour expiration
- **Role-Based Access**: Admin, Broker, Analyst, Investor roles
- **Rate Limiting**: 5 failed login attempts = 15-minute lockout

### Data Security

- **Encryption**:
  - TLS/HTTPS for all API communication
  - Bcrypt for password hashing
  - Encrypted database backups
- **Data Retention**: Uploaded PDFs retained for 90 days, then archived
- **PII Protection**: Sensitive investor data isolated and access-logged
- **SQL Injection Prevention**: Parameterized queries, ORM validation

### API Rate Limiting

- **General Endpoints**: 100 requests per minute per IP
- **Upload Endpoint**: 20 requests per hour per user
- **AI Extraction**: 50 requests per day per user (Claude API cost management)

### Input Validation

- **File Validation**: MIME type checking, magic number verification
- **Data Extraction**: Validate extracted financial values (prevent negative CAP rates, etc.)
- **User Input**: Sanitize all manual edits to prevent XSS/injection attacks

### Error Handling

- **Client Errors**: Return user-friendly messages without exposing system internals
- **Server Errors**: Log to secure error tracking service, return generic 500 response
- **Failed Extraction**: Flag documents requiring manual review

## Development Workflow

1. **Branching Strategy**:
   - `main` = production-ready code
   - `develop` = integration branch
   - Feature branches: `feature/description`
   - Bugfix branches: `bugfix/description`

2. **Commit Messages**: Use conventional commits (e.g., `feat:`, `fix:`, `docs:`)

3. **Code Review**: All PRs require review before merging to `develop` or `main`

4. **Testing**: Write unit tests for services, integration tests for API endpoints

## Roadmap

- [ ] Phase 1: PDF upload and hybrid extraction
- [ ] Phase 2: Financial calculations and property modeling
- [ ] Phase 3: Comp analysis and market comparisons
- [ ] Phase 4: User authentication and authorization
- [ ] Phase 5: Multi-document deal packages
- [ ] Phase 6: Reporting and export functionality
- [ ] Phase 7: Google OAuth integration
- [ ] Phase 8: Mobile-responsive UI enhancements

## License

Proprietary - Apex Real Estate Services © 2025

## Contact

For questions or support, contact the development team at: [dev@apexreservices.com]
