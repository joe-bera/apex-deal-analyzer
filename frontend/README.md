# Apex Deal Analyzer

AI-powered commercial real estate deal analysis platform for Apex Real Estate Services.

## Features

- **PDF Document Upload**: Drag-and-drop interface for uploading real estate documents
- **AI-Powered Extraction**: Automatic data extraction using Claude AI
- **Property Management**: Comprehensive property database with financial metrics
- **Deal Analysis**: CAP rate calculations, price per sqft, NOI tracking
- **Document Support**: Offering memorandums, title reports, comps, leases, appraisals

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **AI**: Anthropic Claude API
- **Auth**: Supabase Auth with JWT

## Quick Start

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

Server runs on http://localhost:3001

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on http://localhost:3000

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

**Quick deploy:**
- Backend → Railway or Render
- Frontend → Vercel
- Database → Supabase (already configured)

## WordPress Integration

Embed the app in WordPress with an iframe:

```html
<iframe
  src="https://your-frontend-url.vercel.app"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none;"
></iframe>
```

See [DEPLOYMENT.md](./DEPLOYMENT.md#wordpress-iframe-integration) for detailed integration options.

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [CLAUDE.md](./CLAUDE.md) - Project context and architecture
- [docs/GUARDRAILS.md](./docs/GUARDRAILS.md) - Business rules and security

## License

ISC

## Author

Apex Real Estate Services
