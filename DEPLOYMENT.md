# Orkestrix Systems — Production Deployment Guide

> **Production URL:** https://orkestrix.site
> **Production Stack:** Vercel (Serverless & Edge CDN) · Supabase PostgreSQL · Supabase Storage (`project-media`) · React SPA

---

## 1. Architecture Overview

```
                          [ Client Browser ]
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │    Vercel Global Edge CDN    │
                   │    (SPA Static Assets + SPA) │
                   └──────────────┬───────────────┘
                                  │
                   ┌──────────────┴───────────────┐
                   │   Vercel Serverless Function │
                   │      (/api/* Node Runtime)   │
                   └──────────────┬───────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       Supabase PostgreSQL       │       │        Supabase Storage         │
│  - Admins & Sessions            │       │  - Bucket: project-media        │
│  - Services & Projects          │       │  - Public Read via CDN          │
│  - Leads & Site Settings        │       │  - Authenticated Uploads        │
│  - Audit Logs & RLS             │       └─────────────────────────────────┘
└─────────────────────────────────┘
```

---

## 2. Supabase Setup (Database & Storage)

### 2a. Create Project
1. Log in to [Supabase](https://supabase.com) and create a new project (e.g. `orkestrix-production`).
2. Choose a region close to your primary audience.
3. Save your Database Password securely.

### 2b. Execute Database Schema Migration
1. Go to the **SQL Editor** in your Supabase Dashboard.
2. Open and copy the contents of `supabase/migrations/20260826000001_init_schema.sql`.
3. Click **Run** to execute the migration. This creates:
   - `admins`, `sessions`, `services`, `media`, `projects`, `project_media`, `slug_redirects`, `leads`, `site_settings`, `audit_logs`
   - Indexes and Row Level Security (RLS) policies
   - The `project-media` storage bucket with public read access and MIME restrictions.

### 2c. Execute Initial Seed Data
1. In the **SQL Editor**, copy the contents of `supabase/seed.sql`.
2. Click **Run** to seed:
   - Official services (100% Arabic)
   - Initial site settings (domain, social images, contact channels)
   - Projects table remains clean/empty for production readiness.

### 2d. Collect Environment Variables
From your Supabase Project Settings, copy:
- **Project URL:** `Settings → API → Project URL`
- **Service Role Key:** `Settings → API → Project API Keys → service_role` (Keep secret!)
- **Database Connection String (URI):** `Settings → Database → Connection string → URI` (Use Connection Pooling / Session mode on port `6543` or Direct on port `5432`).

---

## 3. Vercel Deployment Setup

### 3a. Import Project in Vercel
1. Push your code to your GitHub / GitLab repository.
2. In [Vercel Dashboard](https://vercel.com), click **Add New... → Project** and import the repository.
3. Vercel will automatically detect `vercel.json`:
   - **Framework Preset:** `Vite`
   - **Build Command:** `corepack pnpm build`
   - **Output Directory:** `apps/web/dist/public`

### 3b. Configure Environment Variables in Vercel
In **Project Settings → Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://your-ref.supabase.co` | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Required (Server-only) |
| `DATABASE_URL` | `postgresql://postgres...` | Required (PostgreSQL URI) |
| `SUPABASE_STORAGE_BUCKET` | `project-media` | Required |
| `NODE_ENV` | `production` | Enables secure cookies |
| `CANONICAL_DOMAIN` | `https://orkestrix.site` | Canonical production domain |
| `ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL` | `admin@orkestrix.site` | First deploy only |
| `ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD` | `<secure-12+-char-password>` | First deploy only |

### 3c. Deploy
Click **Deploy**. Vercel will build the React frontend and deploy the serverless API.

The API fails closed in Vercel if `DATABASE_URL`, `SUPABASE_URL`, or
`SUPABASE_SERVICE_ROLE_KEY` is missing. The service-role key must never use a
`VITE_` prefix or be added to browser code.

### 3d. Post-Bootstrap Security Step
Once deployed:
1. Log in to `https://<your-vercel-domain>/admin` with your bootstrap credentials.
2. Go to Vercel **Project Settings → Environment Variables** and remove `ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL` and `ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD`.
3. The admin account and sessions now permanently reside in Supabase PostgreSQL.

---

## 4. Custom Domain Connection (`orkestrix.site`)

1. In Vercel Dashboard, go to **Settings → Domains**.
2. Add `orkestrix.site` and `www.orkestrix.site`.
3. Configure DNS records at your domain registrar:

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` (Vercel Apex) |
| `CNAME` | `www` | `cname.vercel-dns.com.` |

4. Vercel automatically provisions SSL certificates and handles HTTP → HTTPS and `www` → apex redirection.

---

## 5. Production Health & Monitoring

### Health Endpoint
```http
GET https://orkestrix.site/api/health
```
**Response (200 OK):**
```json
{ "status": "ok", "database": "ok", "node": "v22.x.x" }
```

### Key Operational Endpoints
- **Public Services:** `GET /api/public/services`
- **Public Projects:** `GET /api/public/projects`
- **Project Detail:** `GET /api/public/projects/:slug`
- **Contact Leads:** `POST /api/public/leads`
- **Admin Dashboard:** `GET /api/admin/dashboard`
- **Admin Leads:** `GET /api/admin/leads`

---

## 6. Backups & Disaster Recovery

1. **Database:** Supabase automatically performs daily backups and point-in-time recovery (PITR).
2. **Manual Snapshot:** Run `pg_dump "$DATABASE_URL" > backup-$(date +%F).sql` at any time.
3. **Storage:** All media assets are stored in the `project-media` bucket with S3-compatible durability and versioning capabilities.

### Rollback basics

1. Roll back the Vercel deployment to the last healthy deployment.
2. Restore database state through Supabase backups/PITR; do not restore a local database file.
3. Restore individual media objects from Supabase Storage versioning/backup procedures when enabled.

## 7. Verification and media policy

- Run the schema migration, then `supabase/seed.sql`; it seeds approved services and settings only. Projects intentionally remain empty.
- Uploads are server-side only and use the `project-media` bucket. Object keys are scoped under `media/YYYY-MM-DD/<uuid>.<ext>`.
- The bucket permits public reads only. Upload and delete operations require the service role through the protected API.
- Before go-live, verify `/api/health`, public services/projects, contact-to-lead, an admin login, and one temporary media upload; delete the temporary record/object afterwards.
