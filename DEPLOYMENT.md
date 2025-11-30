# Deployment Guide

Complete deployment instructions for the Apex Deal Analyzer application.

## Overview

- **Backend**: Node.js/Express API → Deploy to Railway or Render
- **Frontend**: React/Vite SPA → Deploy to Vercel
- **Database**: Supabase (already configured)
- **Storage**: Supabase Storage (already configured)
- **WordPress Integration**: Iframe embed

---

## 1. Backend Deployment (Railway)

### Option A: Railway (Recommended)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `apex-deal-analyzer` repository

3. **Configure Service** (IMPORTANT for monorepo)
   - After project creation, click on your service
   - Go to **Settings** tab
   - Scroll to **Service Settings**
   - Set **Root Directory**: `backend`
   - Set **Watch Paths**: `backend/**`

4. **Configure Build & Start** (Optional, auto-detected via nixpacks.toml)
   - Railway will auto-detect using the provided config files
   - Build command: `npm install && npm run build` (from nixpacks.toml)
   - Start command: `npm start` (from Procfile/nixpacks.toml)
   - If needed, you can override in Settings → Deploy

5. **Add Environment Variables**
   ```
   NODE_ENV=production
   PORT=3001
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_ANON_KEY=<your-supabase-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
   ANTHROPIC_API_KEY=<your-anthropic-api-key>
   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
   JWT_SECRET=<generate-secure-random-string>
   JWT_EXPIRATION=24h
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=10485760
   ALLOWED_FILE_TYPES=application/pdf
   RATE_LIMIT_WINDOW_MS=3600000
   RATE_LIMIT_MAX_REQUESTS=20
   LOG_LEVEL=info
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

6. **Deploy**
   - Railway will automatically deploy
   - Check the deployment logs for any errors
   - Get your backend URL: `https://your-app.up.railway.app`

7. **Note Your Backend URL**
   - Copy the URL provided by Railway (in Settings → Domains)
   - You'll need this for the frontend configuration

### Option B: Render

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select `apex-deal-analyzer` repository

3. **Configure Service**
   - **Name**: apex-deal-analyzer-backend
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free tier works initially

4. **Add Environment Variables**
   - Same as Railway (see above)

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your backend URL: `https://apex-deal-analyzer-backend.onrender.com`

---

## 2. Frontend Deployment (Vercel)

1. **Create Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import `apex-deal-analyzer` repository

3. **Configure Project**
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variable**
   ```
   VITE_API_URL=https://your-backend-url.railway.app
   ```
   - Replace with your actual Railway/Render backend URL
   - Do NOT include trailing slash

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment (usually 1-2 minutes)
   - Get your frontend URL: `https://apex-deal-analyzer.vercel.app`

6. **Update Backend CORS**
   - Update `backend/.env` with your Vercel URL:
     ```
     FRONTEND_URL=https://apex-deal-analyzer.vercel.app
     ```
   - Redeploy backend if needed

---

## 3. Post-Deployment Configuration

### Update Backend Environment

Add your Vercel URL to the backend's allowed CORS origins:

```bash
# In backend/.env or Railway/Render environment variables
FRONTEND_URL=https://your-frontend-url.vercel.app
```

The backend already includes these production domains:
- `https://apex-res.com`
- `https://www.apex-res.com`

### Test the Application

1. **Visit Frontend URL**
   - Go to your Vercel URL
   - You should see the login page

2. **Create Account**
   - Click "Sign up"
   - Create a test account

3. **Upload Document**
   - Login and go to "Upload"
   - Upload a PDF document
   - Verify extraction completes

4. **View Property**
   - Check that the property was created
   - Verify data extraction worked

---

## 4. WordPress Iframe Integration

### Iframe Code

Add this code to your WordPress page where you want to embed the app:

```html
<iframe
  src="https://your-frontend-url.vercel.app"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none; min-height: 800px; width: 100%;"
  allow="clipboard-write; fullscreen"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  loading="lazy"
></iframe>
```

### WordPress Integration Options

#### Option 1: Custom HTML Block

1. In WordPress editor, add a "Custom HTML" block
2. Paste the iframe code above
3. Replace `your-frontend-url.vercel.app` with your actual Vercel URL
4. Publish the page

#### Option 2: Shortcode (Recommended)

Add to your theme's `functions.php`:

```php
function apex_deal_analyzer_iframe() {
    return '<iframe
        src="https://your-frontend-url.vercel.app"
        width="100%"
        height="800"
        frameborder="0"
        style="border: none; min-height: 800px; width: 100%;"
        allow="clipboard-write; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        loading="lazy"
    ></iframe>';
}
add_shortcode('apex_deal_analyzer', 'apex_deal_analyzer_iframe');
```

Then use `[apex_deal_analyzer]` in your page content.

#### Option 3: Full-Width Template

For a dedicated page:

```php
<?php
/*
Template Name: Deal Analyzer
*/
get_header();
?>

<div id="apex-deal-analyzer-container" style="width: 100%; min-height: 100vh;">
    <iframe
        src="https://your-frontend-url.vercel.app"
        width="100%"
        height="100%"
        frameborder="0"
        style="border: none; min-height: 100vh; width: 100%;"
        allow="clipboard-write; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ></iframe>
</div>

<?php get_footer(); ?>
```

### Responsive Iframe

For automatic height adjustment:

```html
<div id="apex-iframe-container">
    <iframe
        id="apex-iframe"
        src="https://your-frontend-url.vercel.app"
        width="100%"
        frameborder="0"
        style="border: none; width: 100%;"
        allow="clipboard-write; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ></iframe>
</div>

<script>
// Auto-resize iframe
window.addEventListener('message', function(e) {
    if (e.origin === 'https://your-frontend-url.vercel.app') {
        const iframe = document.getElementById('apex-iframe');
        if (e.data.height) {
            iframe.style.height = e.data.height + 'px';
        }
    }
});

// Set initial height
document.getElementById('apex-iframe').style.height = '800px';
</script>
```

---

## 5. Domain Configuration (Optional)

### Custom Domain for Frontend

1. In Vercel dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add custom domain: `app.apex-res.com`
4. Follow Vercel's DNS configuration instructions
5. Update WordPress iframe to use custom domain

### Custom Domain for Backend

1. In Railway/Render dashboard, go to your service
2. Add custom domain: `api.apex-res.com`
3. Configure DNS records as instructed
4. Update frontend `VITE_API_URL` environment variable
5. Redeploy frontend

---

## 6. Environment Variables Reference

### Backend (.env)

```bash
# Server
NODE_ENV=production
PORT=3001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRATION=24h

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=20

# CORS
FRONTEND_URL=https://your-frontend-url.vercel.app

# Logging
LOG_LEVEL=info
```

### Frontend (.env)

```bash
# Backend API URL
VITE_API_URL=https://your-backend-url.railway.app
```

---

## 7. Monitoring & Maintenance

### Backend Monitoring

- **Railway**: Built-in metrics dashboard
- **Render**: Monitoring tab shows CPU, memory, requests
- **Logs**: Check service logs for errors

### Frontend Monitoring

- **Vercel**: Analytics dashboard shows page views, performance
- **Error Tracking**: Consider adding Sentry

### Database

- **Supabase**: Database dashboard shows:
  - Active connections
  - Table sizes
  - Query performance
- Monitor storage usage for uploaded PDFs

### Backups

- **Database**: Supabase provides automatic daily backups
- **Files**: Supabase Storage is durable
- **Code**: Already in Git/GitHub

---

## 8. Troubleshooting

### Backend Issues

**502 Bad Gateway**
- Check backend logs in Railway/Render
- Verify all environment variables are set
- Check if service is running

**CORS Errors**
- Verify `FRONTEND_URL` matches your Vercel URL exactly
- Check backend logs for CORS errors
- Ensure no trailing slashes in URLs

**Database Connection Failed**
- Verify Supabase credentials
- Check Supabase service status
- Test connection from Railway/Render shell

### Frontend Issues

**White Screen**
- Check browser console for errors
- Verify `VITE_API_URL` is correct
- Clear browser cache

**API Requests Failing**
- Verify backend is running
- Check network tab for failed requests
- Confirm CORS is configured correctly

**Authentication Issues**
- Clear localStorage
- Check backend /api/auth/me endpoint
- Verify JWT_SECRET matches between deployments

### Iframe Issues

**Not Loading in WordPress**
- Check CSP headers in browser console
- Verify iframe `src` URL is correct
- Check WordPress security plugins

**Authentication Not Working in Iframe**
- Verify `sandbox` attribute allows `allow-same-origin`
- Check browser's third-party cookie settings
- Consider using custom domain to avoid same-site issues

---

## 9. Security Checklist

- [ ] All environment variables set in production
- [ ] JWT_SECRET is strong and unique
- [ ] Supabase RLS policies enabled
- [ ] CORS origins restricted to your domains
- [ ] HTTPS enabled (automatic with Vercel/Railway/Render)
- [ ] API keys not committed to Git
- [ ] Rate limiting configured
- [ ] File upload limits enforced
- [ ] Input validation on all endpoints

---

## 10. Cost Estimates

### Free Tier (Development)

- **Vercel**: Free forever for hobby projects
- **Railway**: $5/month free credit (expires after trial)
- **Render**: Free tier available (spins down after inactivity)
- **Supabase**: Free tier (500MB database, 1GB storage)

### Production (Paid)

- **Vercel Pro**: $20/month (for team/custom domains)
- **Railway**: ~$10-20/month depending on usage
- **Render**: $7/month (starter tier)
- **Supabase Pro**: $25/month (8GB database, 100GB storage)
- **Anthropic API**: Pay per use (~$3/MTok for Claude Sonnet)

**Total Estimated**: $50-100/month for production deployment

---

## 11. Next Steps

After deployment:

1. **Test thoroughly** with real documents
2. **Set up monitoring** for errors and performance
3. **Configure backups** (automatic with Supabase)
4. **Add Google OAuth** for easier authentication
5. **Implement analytics** to track usage
6. **Create user documentation** for your team
7. **Set up staging environment** for testing changes

---

## Support

For deployment issues:
- Railway: https://railway.app/help
- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs

For application issues:
- Check GitHub repository issues
- Review application logs
- Consult CLAUDE.md for architecture details
