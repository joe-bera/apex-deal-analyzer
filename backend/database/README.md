# Database Setup

This directory contains the database schema and migration files for the Apex Deal Analyzer.

## Quick Start

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: apex-deal-analyzer
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Wait for project to initialize (~2 minutes)

### 2. Get Your API Keys

1. In Supabase Dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (safe to use in frontend)
   - **service_role secret**: `eyJhbGc...` (NEVER expose to frontend, backend only)

### 3. Run the Schema

**Option A: Using Supabase Dashboard (Recommended for first setup)**

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy the entire contents of `schema.sql`
4. Paste into the editor
5. Click **Run**
6. Verify tables were created (check **Table Editor** tab)

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### 4. Configure Backend

1. Copy `.env.example` to `.env` in the backend directory:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Fill in the Supabase values:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. Add your Claude API key (get from https://console.anthropic.com/):
   ```env
   CLAUDE_API_KEY=your-claude-api-key-here
   ```

### 5. Verify Setup

1. Start the backend server:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. Check health endpoint:
   ```bash
   curl http://localhost:3001/api/health
   ```

   You should see:
   ```json
   {
     "success": true,
     "status": "healthy",
     "database": {
       "status": "connected",
       "message": "OK"
     }
   }
   ```

## Database Schema Overview

### Core Tables

1. **profiles** - User profiles (extends Supabase auth.users)
   - Stores user role (admin, broker, analyst, investor)
   - Organization affiliation
   - Contact information

2. **properties** - Commercial real estate properties
   - Property details (address, type, size)
   - Financial metrics (price, CAP rate, NOI)
   - Occupancy and tenant information

3. **documents** - Uploaded PDF files
   - Linked to properties
   - Extraction status tracking
   - AI-extracted data stored as JSONB

4. **comps** - Comparable sales
   - Linked to subject properties
   - Sale information and metrics
   - Similarity scoring

5. **deals** - Analysis sessions
   - Group multiple properties
   - Track deal pipeline
   - Collaborative analysis

6. **shared_access** - Access control
   - Grant specific users access to properties/deals
   - Used for investor access (read-only)

### Row Level Security (RLS)

All tables have RLS enabled to ensure data security:

- Users can only view properties they created or have been granted access to
- Investors can only see properties explicitly shared with them
- Admins have elevated permissions
- All policies are enforced at the database level (not just API)

## Common Operations

### Create First User (Admin)

```sql
-- After signing up via Supabase Auth, promote to admin:
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Share Property with Investor

```sql
INSERT INTO shared_access (property_id, user_id, shared_by, can_view, can_edit)
VALUES (
  'property-uuid-here',
  'investor-user-uuid-here',
  'your-user-uuid-here',
  true,  -- can_view
  false  -- can_edit (investors typically read-only)
);
```

### Query Properties with Documents

```sql
SELECT
  p.*,
  json_agg(d.*) AS documents
FROM properties p
LEFT JOIN documents d ON d.property_id = p.id
WHERE p.created_by = 'user-uuid-here'
GROUP BY p.id;
```

## Troubleshooting

### Connection Failed

- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check Supabase project is active (not paused)
- Ensure no typos in `.env` file

### RLS Preventing Access

- Make sure user is authenticated (JWT token valid)
- Check user has correct permissions in `shared_access` table
- Verify RLS policies match your use case

### Migration Errors

- Tables already exist? Drop them first (⚠️ destroys data):
  ```sql
  DROP TABLE IF EXISTS shared_access, deal_properties, comps, documents, properties, deals, profiles CASCADE;
  ```
- Check for syntax errors in `schema.sql`
- Ensure `uuid-ossp` extension is enabled

## Storage Setup (for PDFs)

1. In Supabase Dashboard, go to **Storage**
2. Create a new bucket: `documents`
3. Set bucket to **Private** (not public)
4. Configure RLS policies for bucket access:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow users to view documents they have access to
CREATE POLICY "Users can view accessible documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

## Next Steps

- [ ] Set up authentication (email/password)
- [ ] Implement PDF upload endpoint
- [ ] Build AI extraction service
- [ ] Create property CRUD endpoints
- [ ] Add real-time subscriptions for extraction status updates

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
