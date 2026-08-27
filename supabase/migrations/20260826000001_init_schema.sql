-- ==============================================================================
-- ORKESTRIX SYSTEMS — SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Production-ready database schema with constraints, indexes, RLS, and storage
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions Table (Persistent Server Sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

-- Services Table
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'archived')),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT NOT NULL DEFAULT 'blue',
  label TEXT NOT NULL DEFAULT '',
  problem_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  value_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  examples_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS services_public_idx ON services(published, status, sort_order);

-- Media Assets Table
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  storage_url TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('live', 'concept', 'demo', 'internal')),
  short_description TEXT NOT NULL,
  problem TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  solution TEXT NOT NULL,
  implementation TEXT NOT NULL DEFAULT '',
  deliverables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_limits TEXT NOT NULL DEFAULT '',
  hero_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  client TEXT,
  year INTEGER,
  live_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS projects_public_idx ON projects(published, sort_order);
CREATE INDEX IF NOT EXISTS projects_category_idx ON projects(category, published);

-- Project Media Junction Table
CREATE TABLE IF NOT EXISTS project_media (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id, media_id)
);

-- Slug Redirects Table (Safe URL Aliases)
CREATE TABLE IF NOT EXISTS slug_redirects (
  entity_type TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(entity_type, old_slug)
);

-- Leads / Contact Requests Table
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  project_type TEXT NOT NULL,
  idea TEXT NOT NULL,
  preferred_channel TEXT NOT NULL,
  contact_value TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')) DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'public-website',
  internal_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leads_status_created_idx ON leads(status, created_at DESC);

-- Site Settings Table
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
CREATE POLICY "Public services read" ON services
  FOR SELECT USING (published = TRUE AND status = 'active');

CREATE POLICY "Public projects read" ON projects
  FOR SELECT USING (published = TRUE AND archived = FALSE);

CREATE POLICY "Public project_media read" ON project_media
  FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE published = TRUE AND archived = FALSE));

CREATE POLICY "Public media read" ON media
  FOR SELECT USING (
    id IN (SELECT hero_media_id FROM projects WHERE published = TRUE AND archived = FALSE)
    OR id IN (SELECT media_id FROM project_media pm JOIN projects p ON p.id = pm.project_id WHERE p.published = TRUE AND p.archived = FALSE)
  );

CREATE POLICY "Public site_settings read" ON site_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "Public slug_redirects read" ON slug_redirects
  FOR SELECT USING (TRUE);

-- Public Leads Insert Policy
CREATE POLICY "Public leads insert" ON leads
  FOR INSERT WITH CHECK (
    length(name) >= 2 AND length(name) <= 120 AND
    length(business_name) >= 2 AND length(business_name) <= 160 AND
    length(project_type) >= 2 AND length(project_type) <= 80 AND
    length(idea) >= 12 AND length(idea) <= 5000 AND
    preferred_channel IN ('البريد الإلكتروني', 'الهاتف', 'واتساب') AND
    length(contact_value) >= 3 AND length(contact_value) <= 240
  );

-- Service Role Full Access Policies
CREATE POLICY "Service role full access admins" ON admins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access sessions" ON sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access services" ON services FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access media" ON media FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access projects" ON projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access project_media" ON project_media FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access slug_redirects" ON slug_redirects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access leads" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access site_settings" ON site_settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access audit_logs" ON audit_logs FOR ALL USING (auth.role() = 'service_role');

-- ==============================================================================
-- 4. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================

-- Create bucket 'project-media' if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media',
  'project-media',
  TRUE,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Storage Public Read Policy
CREATE POLICY "Public Media Read" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-media');

-- Storage Service Role Full Access Policy
CREATE POLICY "Service Role Media Upload" ON storage.objects
  FOR ALL USING (bucket_id = 'project-media' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'project-media' AND auth.role() = 'service_role');
