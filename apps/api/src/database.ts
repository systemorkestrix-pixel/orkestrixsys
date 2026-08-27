import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { hashPassword, hashToken } from './security.js';

const { Pool } = pg;

export type Row = Record<string, unknown>;

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export const timestamp = now;

export function json(value: unknown, fallback: unknown = []) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export interface IDatabase {
  close(): Promise<void> | void;
  healthCheck(): Promise<boolean>;
  bootstrapAdmin(email: string, password: string): Promise<string>;
  findAdminByEmail(email: string): Promise<Row | undefined>;
  createSession(adminId: string, rawToken: string, expiresAt: string): Promise<string>;
  session(rawToken: string): Promise<Row | undefined>;
  deleteSession(rawToken: string): Promise<void>;
  cleanupSessions(): Promise<void>;
  audit(actorId: string | null, actorEmail: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>): Promise<void>;

  getPublicServices(): Promise<Row[]>;
  getPublicProjects(): Promise<Row[]>;
  getPublicProjectBySlug(slug: string): Promise<{ project: Row | null; redirectedFrom: string | null }>;
  getPublicSettings(): Promise<Record<string, unknown>>;
  createLead(data: { name: string; businessName: string; projectType: string; idea: string; preferredChannel: string; contactValue: string }): Promise<string>;

  getDashboardData(): Promise<{ counts: { newLeads: number; openLeads: number; publishedServices: number; publishedProjects: number }; latestLeads: Row[]; activity: Row[] }>;
  getAdminServices(): Promise<Row[]>;
  createService(service: Row): Promise<string>;
  getServiceById(id: string): Promise<Row | undefined>;
  updateService(id: string, service: Row): Promise<void>;
  archiveService(id: string): Promise<void>;

  getAdminProjects(): Promise<Row[]>;
  createProject(project: Row, galleryIds: string[]): Promise<string>;
  getProjectById(id: string): Promise<Row | undefined>;
  updateProject(id: string, project: Row, galleryIds: string[]): Promise<{ slugChanged: boolean }>;
  archiveProject(id: string): Promise<void>;

  getAdminLeads(search?: string, status?: string): Promise<Row[]>;
  updateLead(id: string, status: string, notes: string): Promise<boolean>;

  getAdminMedia(): Promise<Row[]>;
  createMedia(media: { id: string; fileName: string; storageKey: string; storageUrl: string; altText: string; mimeType: string; width: number | null; height: number | null }): Promise<string>;
  getMediaById(id: string): Promise<Row | undefined>;
  getMediaUsageCount(id: string): Promise<number>;
  deleteMedia(id: string): Promise<void>;

  getAdminSettings(): Promise<Record<string, string>>;
  updateAdminSettings(values: Record<string, string>): Promise<void>;
  getAuditLogs(): Promise<Row[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRESQL / SUPABASE ADAPTER
// ─────────────────────────────────────────────────────────────────────────────
export class PostgresDatabase implements IDatabase {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }

  async close() {
    await this.pool.end();
  }

  async healthCheck() {
    try {
      const res = await this.pool.query('SELECT 1');
      return Boolean(res.rows.length);
    } catch {
      return false;
    }
  }

  async bootstrapAdmin(email: string, password: string) {
    if (password.length < 12) throw new Error('Admin password must contain at least 12 characters.');
    const existing = await this.pool.query('SELECT id FROM admins WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) return String(existing.rows[0].id);
    const adminId = id();
    const stamp = now();
    await this.pool.query(
      `INSERT INTO admins (id, email, password_hash, role, active, created_at, updated_at)
       VALUES ($1, LOWER($2), $3, 'admin', TRUE, $4, $4)`,
      [adminId, email, hashPassword(password), stamp]
    );
    await this.audit(null, email, 'admin.bootstrap', 'admin', adminId, {});
    return adminId;
  }

  async findAdminByEmail(email: string) {
    const res = await this.pool.query('SELECT * FROM admins WHERE LOWER(email) = LOWER($1) AND active = TRUE', [email]);
    return res.rows[0];
  }

  async createSession(adminId: string, rawToken: string, expiresAt: string) {
    const sessionId = id();
    await this.pool.query(
      `INSERT INTO sessions (id, admin_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, adminId, hashToken(rawToken), expiresAt, now()]
    );
    return sessionId;
  }

  async session(rawToken: string) {
    const res = await this.pool.query(
      `SELECT a.id, a.email, a.role, s.id AS session_id
       FROM sessions s JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = $1 AND s.expires_at > $2 AND a.active = TRUE`,
      [hashToken(rawToken), now()]
    );
    return res.rows[0];
  }

  async deleteSession(rawToken: string) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(rawToken)]);
  }

  async cleanupSessions() {
    await this.pool.query('DELETE FROM sessions WHERE expires_at <= $1', [now()]);
  }

  async audit(actorId: string | null, actorEmail: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
    await this.pool.query(
      `INSERT INTO audit_logs (id, actor_id, actor_email, action, entity_type, entity_id, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id(), actorId, actorEmail, action, entityType, entityId, JSON.stringify(metadata), now()]
    );
  }

  async getPublicServices() {
    const res = await this.pool.query(
      "SELECT * FROM services WHERE published = TRUE AND status = 'active' ORDER BY sort_order, title"
    );
    return res.rows;
  }

  private async fetchProjectDetails(row: Row): Promise<Row> {
    const galleryRes = await this.pool.query(
      `SELECT m.id, m.storage_url AS url, m.alt_text AS "altText", m.file_name AS "fileName", m.mime_type AS "mimeType", m.width, m.height
       FROM project_media pm JOIN media m ON m.id = pm.media_id
       WHERE pm.project_id = $1 ORDER BY pm.sort_order`,
      [row.id]
    );
    let hero: Row | null = null;
    if (row.hero_media_id) {
      const heroRes = await this.pool.query(
        'SELECT id, storage_url AS url, alt_text AS "altText", file_name AS "fileName", mime_type AS "mimeType", width, height FROM media WHERE id = $1',
        [row.hero_media_id]
      );
      hero = heroRes.rows[0] ?? null;
    }
    return {
      id: row.id, slug: row.slug, title: row.title, category: row.category, status: row.status,
      shortDescription: row.short_description, problem: row.problem, context: row.context, solution: row.solution,
      implementation: row.implementation, deliverables: json(row.deliverables_json), resultLimits: row.result_limits,
      heroMediaId: row.hero_media_id, heroMedia: hero, heroImage: hero?.url ?? '/orkestrix-mark.png',
      gallery: galleryRes.rows, tags: json(row.tags_json), featured: Boolean(row.featured),
      published: Boolean(row.published), archived: Boolean(row.archived),
      sortOrder: row.sort_order, client: row.client, year: row.year, liveUrl: row.live_url,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  async getPublicProjects() {
    const res = await this.pool.query(
      'SELECT * FROM projects WHERE published = TRUE AND archived = FALSE ORDER BY sort_order, title'
    );
    return Promise.all(res.rows.map((row) => this.fetchProjectDetails(row)));
  }

  async getPublicProjectBySlug(slug: string) {
    let res = await this.pool.query(
      'SELECT * FROM projects WHERE slug = $1 AND published = TRUE AND archived = FALSE',
      [slug]
    );
    let redirectedFrom: string | null = null;
    if (!res.rows.length) {
      const red = await this.pool.query(
        "SELECT entity_id FROM slug_redirects WHERE entity_type = 'project' AND old_slug = $1",
        [slug]
      );
      if (red.rows.length) {
        res = await this.pool.query(
          'SELECT * FROM projects WHERE id = $1 AND published = TRUE AND archived = FALSE',
          [red.rows[0].entity_id]
        );
        redirectedFrom = slug;
      }
    }
    if (!res.rows.length) return { project: null, redirectedFrom: null };
    const project = await this.fetchProjectDetails(res.rows[0]);
    return { project, redirectedFrom };
  }

  async getPublicSettings() {
    const res = await this.pool.query('SELECT key, value FROM site_settings');
    return Object.fromEntries(res.rows.map((r) => [r.key, r.key === 'contactChannels' ? json(r.value, []) : String(r.value)]));
  }

  async createLead(data: { name: string; businessName: string; projectType: string; idea: string; preferredChannel: string; contactValue: string }) {
    const leadId = id();
    const stamp = now();
    await this.pool.query(
      `INSERT INTO leads (id, name, business_name, project_type, idea, preferred_channel, contact_value, status, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', 'public-website', $8, $8)`,
      [leadId, data.name, data.businessName, data.projectType, data.idea, data.preferredChannel, data.contactValue, stamp]
    );
    await this.audit(null, null, 'lead.create', 'lead', leadId, { source: 'public-website' });
    return leadId;
  }

  async getDashboardData() {
    const countsRes = await this.pool.query(`
      SELECT
        (SELECT count(*) FROM leads WHERE status = 'new') AS "newLeads",
        (SELECT count(*) FROM leads WHERE status NOT IN ('won', 'lost')) AS "openLeads",
        (SELECT count(*) FROM services WHERE published = TRUE AND status = 'active') AS "publishedServices",
        (SELECT count(*) FROM projects WHERE published = TRUE AND archived = FALSE) AS "publishedProjects"
    `);
    const latestLeads = await this.pool.query(
      'SELECT id, name, business_name AS "businessName", project_type AS "projectType", status, created_at AS "createdAt" FROM leads ORDER BY created_at DESC LIMIT 5'
    );
    const activity = await this.pool.query(
      'SELECT id, actor_email AS "actorEmail", action, entity_type AS "entityType", entity_id AS "entityId", created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 8'
    );
    const counts = {
      newLeads: Number(countsRes.rows[0]?.newLeads || 0),
      openLeads: Number(countsRes.rows[0]?.openLeads || 0),
      publishedServices: Number(countsRes.rows[0]?.publishedServices || 0),
      publishedProjects: Number(countsRes.rows[0]?.publishedProjects || 0),
    };
    return { counts, latestLeads: latestLeads.rows, activity: activity.rows };
  }

  async getAdminServices() {
    const res = await this.pool.query('SELECT * FROM services ORDER BY sort_order, title');
    return res.rows;
  }

  async createService(service: Row) {
    const serviceId = id();
    const stamp = now();
    await this.pool.query(
      `INSERT INTO services (id, slug, title, short_description, description, icon, sort_order, status, published, featured, color, label, problem_json, value_json, examples_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
      [
        serviceId, service.slug, service.title, service.shortDescription, service.description,
        service.icon, service.order, service.status, Boolean(service.published), Boolean(service.featured),
        service.color, service.label, JSON.stringify(service.problem), JSON.stringify(service.value), JSON.stringify(service.examples), stamp
      ]
    );
    return serviceId;
  }

  async getServiceById(serviceId: string) {
    const res = await this.pool.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    return res.rows[0];
  }

  async updateService(serviceId: string, service: Row) {
    await this.pool.query(
      `UPDATE services SET slug = $1, title = $2, short_description = $3, description = $4, icon = $5,
       sort_order = $6, status = $7, published = $8, featured = $9, color = $10, label = $11,
       problem_json = $12, value_json = $13, examples_json = $14, updated_at = $15
       WHERE id = $16`,
      [
        service.slug, service.title, service.shortDescription, service.description, service.icon,
        service.order, service.status, Boolean(service.published), Boolean(service.featured), service.color, service.label,
        JSON.stringify(service.problem), JSON.stringify(service.value), JSON.stringify(service.examples), now(), serviceId
      ]
    );
  }

  async archiveService(serviceId: string) {
    await this.pool.query(
      "UPDATE services SET status = 'archived', published = FALSE, updated_at = $1 WHERE id = $2",
      [now(), serviceId]
    );
  }

  async getAdminProjects() {
    const res = await this.pool.query('SELECT * FROM projects ORDER BY sort_order, title');
    return Promise.all(res.rows.map((row) => this.fetchProjectDetails(row)));
  }

  async createProject(project: Row, galleryIds: string[]) {
    const projectId = id();
    const stamp = now();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO projects (id, slug, title, category, status, short_description, problem, context, solution, implementation, deliverables_json, result_limits, hero_media_id, tags_json, featured, published, sort_order, client, year, live_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)`,
        [
          projectId, project.slug, project.title, project.category, project.status, project.shortDescription,
          project.problem, project.context, project.solution, project.implementation, JSON.stringify(project.deliverables),
          project.resultLimits, project.heroMediaId || null, JSON.stringify(project.tags), Boolean(project.featured),
          Boolean(project.published), project.sortOrder, project.client || null, project.year || null, project.liveUrl || null, stamp
        ]
      );
      for (let i = 0; i < galleryIds.length; i++) {
        await client.query(
          'INSERT INTO project_media (project_id, media_id, sort_order) VALUES ($1, $2, $3)',
          [projectId, galleryIds[i], i]
        );
      }
      await client.query('COMMIT');
      return projectId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getProjectById(projectId: string) {
    const res = await this.pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    return res.rows[0];
  }

  async updateProject(projectId: string, project: Row, galleryIds: string[]) {
    const previous = await this.getProjectById(projectId);
    if (!previous) throw new Error('Project not found');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE projects SET slug = $1, title = $2, category = $3, status = $4, short_description = $5,
         problem = $6, context = $7, solution = $8, implementation = $9, deliverables_json = $10,
         result_limits = $11, hero_media_id = $12, tags_json = $13, featured = $14, published = $15,
         archived = FALSE, sort_order = $16, client = $17, year = $18, live_url = $19, updated_at = $20
         WHERE id = $21`,
        [
          project.slug, project.title, project.category, project.status, project.shortDescription,
          project.problem, project.context, project.solution, project.implementation, JSON.stringify(project.deliverables),
          project.resultLimits, project.heroMediaId || null, JSON.stringify(project.tags), Boolean(project.featured),
          Boolean(project.published), project.sortOrder, project.client || null, project.year || null, project.liveUrl || null, now(), projectId
        ]
      );
      await client.query('DELETE FROM project_media WHERE project_id = $1', [projectId]);
      for (let i = 0; i < galleryIds.length; i++) {
        await client.query(
          'INSERT INTO project_media (project_id, media_id, sort_order) VALUES ($1, $2, $3)',
          [projectId, galleryIds[i], i]
        );
      }
      if (previous.slug !== project.slug && previous.published) {
        await client.query(
          `INSERT INTO slug_redirects (entity_type, old_slug, entity_id, created_at)
           VALUES ('project', $1, $2, $3)
           ON CONFLICT (entity_type, old_slug) DO UPDATE SET entity_id = EXCLUDED.entity_id, created_at = EXCLUDED.created_at`,
          [String(previous.slug), projectId, now()]
        );
      }
      await client.query('COMMIT');
      return { slugChanged: previous.slug !== project.slug };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async archiveProject(projectId: string) {
    await this.pool.query(
      'UPDATE projects SET published = FALSE, archived = TRUE, updated_at = $1 WHERE id = $2',
      [now(), projectId]
    );
  }

  async getAdminLeads(search = '', status = '') {
    const s = `%${search}%`;
    const res = await this.pool.query(
      `SELECT id, name, business_name AS "businessName", project_type AS "projectType", idea,
              preferred_channel AS "preferredChannel", contact_value AS "contactValue",
              status, source, internal_notes AS "internalNotes", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM leads
       WHERE ($1 = '' OR status = $1) AND (name ILIKE $2 OR business_name ILIKE $2 OR contact_value ILIKE $2)
       ORDER BY created_at DESC`,
      [status, s]
    );
    return res.rows;
  }

  async updateLead(leadId: string, status: string, notes: string) {
    const res = await this.pool.query(
      'UPDATE leads SET status = $1, internal_notes = $2, updated_at = $3 WHERE id = $4',
      [status, notes, now(), leadId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getAdminMedia() {
    const res = await this.pool.query('SELECT * FROM media ORDER BY created_at DESC');
    return res.rows.map((row) => ({
      id: row.id, fileName: row.file_name, url: row.storage_url, altText: row.alt_text,
      mimeType: row.mime_type, width: row.width, height: row.height, createdAt: row.created_at,
    }));
  }

  async createMedia(media: { id: string; fileName: string; storageKey: string; storageUrl: string; altText: string; mimeType: string; width: number | null; height: number | null }) {
    await this.pool.query(
      `INSERT INTO media (id, file_name, storage_key, storage_url, alt_text, mime_type, width, height, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [media.id, media.fileName, media.storageKey, media.storageUrl, media.altText, media.mimeType, media.width, media.height, now()]
    );
    return media.id;
  }

  async getMediaById(mediaId: string) {
    const res = await this.pool.query('SELECT * FROM media WHERE id = $1', [mediaId]);
    return res.rows[0];
  }

  async getMediaUsageCount(mediaId: string) {
    const res = await this.pool.query(
      `SELECT (SELECT count(*) FROM projects WHERE hero_media_id = $1) +
              (SELECT count(*) FROM project_media WHERE media_id = $1) AS count`,
      [mediaId]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async deleteMedia(mediaId: string) {
    await this.pool.query('DELETE FROM media WHERE id = $1', [mediaId]);
  }

  async getAdminSettings() {
    const res = await this.pool.query('SELECT key, value FROM site_settings');
    return Object.fromEntries(res.rows.map((r) => [r.key, r.value]));
  }

  async updateAdminSettings(values: Record<string, string>) {
    const stamp = now();
    for (const [k, v] of Object.entries(values)) {
      await this.pool.query(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [k, v, stamp]
      );
    }
  }

  async getAuditLogs() {
    const res = await this.pool.query(
      'SELECT id, actor_email AS "actorEmail", action, entity_type AS "entityType", entity_id AS "entityId", metadata_json AS metadata, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100'
    );
    return res.rows.map((row) => ({ ...row, metadata: json(row.metadata, {}) }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLITE ADAPTER (FOR LOCAL DEV & E2E INTEGRATION TESTS)
// ─────────────────────────────────────────────────────────────────────────────
export class SqliteDatabase implements IDatabase {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
    this.seed();
  }

  close() {
    this.db.close();
  }

  async healthCheck() {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','editor')), active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, short_description TEXT NOT NULL,
        description TEXT NOT NULL, icon TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK(status IN ('active','draft','archived')), published INTEGER NOT NULL DEFAULT 0,
        featured INTEGER NOT NULL DEFAULT 0, color TEXT NOT NULL DEFAULT 'blue', label TEXT NOT NULL DEFAULT '',
        problem_json TEXT NOT NULL DEFAULT '[]', value_json TEXT NOT NULL DEFAULT '[]', examples_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS services_public_idx ON services(published,status,sort_order);
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY, file_name TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, storage_url TEXT NOT NULL UNIQUE, alt_text TEXT NOT NULL,
        mime_type TEXT NOT NULL, width INTEGER, height INTEGER, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('live','concept','demo','internal')), short_description TEXT NOT NULL,
        problem TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', solution TEXT NOT NULL, implementation TEXT NOT NULL DEFAULT '',
        deliverables_json TEXT NOT NULL DEFAULT '[]', result_limits TEXT NOT NULL DEFAULT '', hero_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
        tags_json TEXT NOT NULL DEFAULT '[]', featured INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0, client TEXT, year INTEGER, live_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS projects_public_idx ON projects(published,sort_order);
      CREATE INDEX IF NOT EXISTS projects_category_idx ON projects(category,published);
      CREATE TABLE IF NOT EXISTS project_media (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        media_id TEXT NOT NULL REFERENCES media(id) ON DELETE RESTRICT, sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(project_id, media_id)
      );
      CREATE TABLE IF NOT EXISTS slug_redirects (
        entity_type TEXT NOT NULL, old_slug TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(entity_type, old_slug)
      );
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, business_name TEXT NOT NULL, project_type TEXT NOT NULL,
        idea TEXT NOT NULL, preferred_channel TEXT NOT NULL, contact_value TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('new','contacted','qualified','proposal','won','lost')) DEFAULT 'new',
        source TEXT NOT NULL DEFAULT 'public-website', internal_notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS leads_status_created_idx ON leads(status,created_at DESC);
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY, actor_id TEXT, actor_email TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL,
        entity_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);
    `);
    const projectColumns = this.db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    if (!projectColumns.some((column) => column.name === 'archived')) this.db.exec('ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }

  private seed() {
    const count = Number((this.db.prepare('SELECT count(*) count FROM services').get() as Row).count);
    if (count > 0) return;
    const stamp = now();
    const items = [
      ['business-websites','business-websites','مواقع الأعمال','وجود رقمي رسمي مصمم حول نشاطك.','موقع رسمي يجعل نشاطك حاضرًا على الإنترنت بصورة واضحة واحترافية.','globe',1,'blue','حضور واضح',['غياب الوجود الرسمي','صعوبة عرض الخدمات','الاعتماد الكامل على الشبكات الاجتماعية','ضعف الوصول إلى العملاء'],['صفحات واضحة','تجربة متجاوبة للجوال','عرض منظم للخدمات','تواصل مباشر وواتساب','نطاق رسمي','استضافة سحابية','شهادة أمان SSL','نشر وتشغيل مباشر'],[]],
      ['ecommerce-stores','ecommerce-stores','المتاجر الإلكترونية','تجربة بيع وإدارة مناسبة لطبيعة نشاطك.','تجربة بيع رقمية مصممة حول المنتجات والعملاء وطريقة عمل نشاطك.','store',2,'cyan','بيع مرتب',[],['عرض المنتجات','الطلبات','العملاء','الدفع عند الحاجة','إدارة المحتوى','إدارة المتجر'],['كتالوج واضح','مسار طلب مختصر','متابعة ما بعد البيع']],
      ['admin-dashboards','admin-dashboards','لوحات الإدارة','إدارة البيانات والعمليات من مكان واحد.','مساحة واحدة تساعدك على إدارة البيانات والعمليات ومتابعة العمل.','dashboard',3,'slate','رؤية واحدة',[],['الطلبات','العملاء','المنتجات','الحجوزات','المشاريع','التقارير','الموظفون'],['صورة يومية للعمل','قرارات أسرع','صلاحيات حسب الدور']],
      ['custom-systems','custom-systems','الأنظمة المخصصة','حل رقمي يُبنى حول طريقة عمل مشروعك.','عندما لا يكفي الحل الجاهز، نبني النظام حول طريقة عمل مشروعك.','custom',4,'navy','على مقاسك',[],['أنظمة داخلية','منصات أعمال','إدارة علاقات العملاء CRM','إدارة الحجوزات','إدارة المشاريع','إدارة العمليات','أنظمة مخصصة'],['مسارات عمل خاصة','أدوار وصلاحيات','حسب احتياجات المشروع ونطاقه.']],
      ['integrations-automation','integrations-automation','التكاملات والأتمتة','ربط الأدوات والخدمات وتقليل العمل اليدوي.','نربط الأدوات والخدمات التي يعتمد عليها مشروعك ونقلل العمل اليدوي حيث يكون ذلك مناسبًا.','integration',5,'electric','عمل متصل',[],['واتساب','البريد الإلكتروني','بوابات الدفع','النماذج الذكية','إدارة العملاء','واجهات الربط البرمجي APIs','التنبيهات الفورية','مسارات العمل التلقائية'],['تنبيه في وقته','بيانات لا تتكرر','خطوات أقل لفريقك']],
    ] as const;
    const insert = this.db.prepare(`INSERT INTO services
      (id,slug,title,short_description,description,icon,sort_order,status,published,featured,color,label,problem_json,value_json,examples_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,'active',1,1,?,?,?,?,?,?,?)`);
    for (const item of items) insert.run(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], JSON.stringify(item[9]), JSON.stringify(item[10]), JSON.stringify(item[11]), stamp, stamp);
    this.db.prepare(`INSERT INTO projects
      (id,slug,title,category,status,short_description,problem,context,solution,implementation,deliverables_json,result_limits,tags_json,featured,published,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,1,?,?)`).run(
        'orkestrix-site','orkestrix-systems-site','موقع Orkestrix Systems','business-websites','internal',
        'الموقع الرسمي الداخلي للشركة، صُمم لتوضيح الخدمات ومسار بناء النظام وبدء طلب مشروع.',
        'تقديم صورة واضحة لما تبنيه Orkestrix وكيف ينتقل الزائر من الاستكشاف إلى طلب مشروع.',
        'مشروع Orkestrix الداخلي لتأسيس الوجود العام والطبقة التشغيلية للشركة.',
        'موقع عربي متجاوب بهيكل رحلة واضح ومسارات مستقلة للخدمات والأعمال وطلب المشروع.',
        'بناء الواجهة العامة ثم فصل البيانات وإضافة الإدارة والنشر.',
        JSON.stringify(['الهوية الرقمية للموقع','صفحة الخدمات','صفحة الأعمال','واجهة طلب مشروع']),
        'هذا مشروع داخلي؛ لا تُعرض نتائج تجارية أو مقاييس غير موثقة.', JSON.stringify(['موقع إلكتروني','مشروع داخلي']), stamp, stamp,
      );
    const settings = this.db.prepare('INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,?)');
    settings.run('domain', 'https://orkestrix.site', stamp);
    settings.run('footerContact', '', stamp);
    settings.run('contactChannels', '[]', stamp);
    settings.run('defaultSocialImage', '/orkestrix-mark.png', stamp);
  }

  async bootstrapAdmin(email: string, password: string) {
    if (password.length < 12) throw new Error('Admin password must contain at least 12 characters.');
    const existing = this.db.prepare('SELECT id FROM admins WHERE email = ?').get(email) as Row | undefined;
    if (existing) return String(existing.id);
    const adminId = id();
    const stamp = now();
    this.db.prepare('INSERT INTO admins (id,email,password_hash,role,active,created_at,updated_at) VALUES (?,?,?,\'admin\',1,?,?)')
      .run(adminId, email.toLowerCase(), hashPassword(password), stamp, stamp);
    await this.audit(null, email, 'admin.bootstrap', 'admin', adminId, {});
    return adminId;
  }

  async findAdminByEmail(email: string) {
    return this.db.prepare('SELECT * FROM admins WHERE email = ? AND active = 1').get(email) as Row | undefined;
  }

  async createSession(adminId: string, rawToken: string, expiresAt: string) {
    const sessionId = id();
    this.db.prepare('INSERT INTO sessions (id,admin_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').run(sessionId, adminId, hashToken(rawToken), expiresAt, now());
    return sessionId;
  }

  async session(rawToken: string) {
    return this.db.prepare(`SELECT a.id,a.email,a.role,s.id session_id FROM sessions s JOIN admins a ON a.id=s.admin_id
      WHERE s.token_hash=? AND s.expires_at>? AND a.active=1`).get(hashToken(rawToken), now()) as Row | undefined;
  }

  async deleteSession(rawToken: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(rawToken));
  }

  async cleanupSessions() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
  }

  async audit(actorId: string | null, actorEmail: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
    this.db.prepare('INSERT INTO audit_logs (id,actor_id,actor_email,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id(), actorId, actorEmail, action, entityType, entityId, JSON.stringify(metadata), now());
  }

  async getPublicServices() {
    return this.db.prepare("SELECT * FROM services WHERE published=1 AND status='active' ORDER BY sort_order,title").all() as Row[];
  }

  private fetchProjectDetails(row: Row): Row {
    const gallery = this.db.prepare(`SELECT m.id,m.storage_url url,m.alt_text altText,m.file_name fileName,m.mime_type mimeType,m.width,m.height
      FROM project_media pm JOIN media m ON m.id=pm.media_id WHERE pm.project_id=? ORDER BY pm.sort_order`).all(String(row.id)) as Row[];
    const hero = row.hero_media_id ? this.db.prepare('SELECT id,storage_url url,alt_text altText,file_name fileName,mime_type mimeType,width,height FROM media WHERE id=?').get(String(row.hero_media_id)) as Row | undefined : null;
    return {
      id: row.id, slug: row.slug, title: row.title, category: row.category, status: row.status,
      shortDescription: row.short_description, problem: row.problem, context: row.context, solution: row.solution,
      implementation: row.implementation, deliverables: json(row.deliverables_json), resultLimits: row.result_limits,
      heroMediaId: row.hero_media_id, heroMedia: hero ?? null, heroImage: (hero as Row | undefined)?.url ?? '/orkestrix-mark.png',
      gallery, tags: json(row.tags_json), featured: Boolean(row.featured), published: Boolean(row.published), archived: Boolean(row.archived),
      sortOrder: row.sort_order, client: row.client, year: row.year, liveUrl: row.live_url, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  async getPublicProjects() {
    const rows = this.db.prepare('SELECT * FROM projects WHERE published=1 AND archived=0 ORDER BY sort_order,title').all() as Row[];
    return rows.map((r) => this.fetchProjectDetails(r));
  }

  async getPublicProjectBySlug(slug: string) {
    let row = this.db.prepare('SELECT * FROM projects WHERE slug=? AND published=1 AND archived=0').get(slug) as Row | undefined;
    let redirectedFrom: string | null = null;
    if (!row) {
      const redirect = this.db.prepare("SELECT entity_id FROM slug_redirects WHERE entity_type='project' AND old_slug=?").get(slug) as Row | undefined;
      if (redirect) {
        row = this.db.prepare('SELECT * FROM projects WHERE id=? AND published=1 AND archived=0').get(String(redirect.entity_id)) as Row | undefined;
        redirectedFrom = slug;
      }
    }
    if (!row) return { project: null, redirectedFrom: null };
    return { project: this.fetchProjectDetails(row), redirectedFrom };
  }

  async getPublicSettings() {
    const rows = this.db.prepare('SELECT key,value FROM site_settings').all() as Row[];
    return Object.fromEntries(rows.map((row) => [row.key, row.key === 'contactChannels' ? json(row.value, []) : String(row.value)]));
  }

  async createLead(data: { name: string; businessName: string; projectType: string; idea: string; preferredChannel: string; contactValue: string }) {
    const leadId = id();
    const stamp = now();
    this.db.prepare(`INSERT INTO leads (id,name,business_name,project_type,idea,preferred_channel,contact_value,status,source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,'new','public-website',?,?)`).run(leadId, data.name, data.businessName, data.projectType, data.idea, data.preferredChannel, data.contactValue, stamp, stamp);
    await this.audit(null, null, 'lead.create', 'lead', leadId, { source: 'public-website' });
    return leadId;
  }

  async getDashboardData() {
    const counts = this.db.prepare(`SELECT
      (SELECT count(*) FROM leads WHERE status='new') newLeads,
      (SELECT count(*) FROM leads WHERE status NOT IN ('won','lost')) openLeads,
      (SELECT count(*) FROM services WHERE published=1 AND status='active') publishedServices,
      (SELECT count(*) FROM projects WHERE published=1 AND archived=0) publishedProjects`).get() as Row;
    const latestLeads = this.db.prepare('SELECT id,name,business_name businessName,project_type projectType,status,created_at createdAt FROM leads ORDER BY created_at DESC LIMIT 5').all() as Row[];
    const activity = this.db.prepare('SELECT id,actor_email actorEmail,action,entity_type entityType,entity_id entityId,created_at createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 8').all() as Row[];
    return { counts: { newLeads: Number(counts.newLeads || 0), openLeads: Number(counts.openLeads || 0), publishedServices: Number(counts.publishedServices || 0), publishedProjects: Number(counts.publishedProjects || 0) }, latestLeads, activity };
  }

  async getAdminServices() {
    return this.db.prepare('SELECT * FROM services ORDER BY sort_order,title').all() as Row[];
  }

  async createService(service: Row) {
    const serviceId = id();
    const stamp = now();
    this.db.prepare(`INSERT INTO services (id,slug,title,short_description,description,icon,sort_order,status,published,featured,color,label,problem_json,value_json,examples_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        serviceId, String(service.slug), String(service.title), String(service.shortDescription), String(service.description), String(service.icon), Number(service.order || 0), String(service.status),
        Number(Boolean(service.published)), Number(Boolean(service.featured)), String(service.color || 'blue'), String(service.label || ''), JSON.stringify(service.problem || []), JSON.stringify(service.value || []), JSON.stringify(service.examples || []), stamp, stamp
      );
    return serviceId;
  }

  async getServiceById(serviceId: string) {
    return this.db.prepare('SELECT * FROM services WHERE id=?').get(serviceId) as Row | undefined;
  }

  async updateService(serviceId: string, service: Row) {
    this.db.prepare(`UPDATE services SET slug=?,title=?,short_description=?,description=?,icon=?,sort_order=?,status=?,published=?,featured=?,color=?,label=?,problem_json=?,value_json=?,examples_json=?,updated_at=? WHERE id=?`)
      .run(
        String(service.slug), String(service.title), String(service.shortDescription), String(service.description), String(service.icon), Number(service.order || 0), String(service.status),
        Number(Boolean(service.published)), Number(Boolean(service.featured)), String(service.color || 'blue'), String(service.label || ''), JSON.stringify(service.problem || []), JSON.stringify(service.value || []), JSON.stringify(service.examples || []), now(), serviceId
      );
  }

  async archiveService(serviceId: string) {
    this.db.prepare("UPDATE services SET status='archived',published=0,updated_at=? WHERE id=?").run(now(), serviceId);
  }

  async getAdminProjects() {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY sort_order,title').all() as Row[];
    return rows.map((r) => this.fetchProjectDetails(r));
  }

  async createProject(project: Row, galleryIds: string[]) {
    const projectId = id();
    const stamp = now();
    this.db.prepare(`INSERT INTO projects (id,slug,title,category,status,short_description,problem,context,solution,implementation,deliverables_json,result_limits,hero_media_id,tags_json,featured,published,sort_order,client,year,live_url,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        projectId, String(project.slug), String(project.title), String(project.category), String(project.status), String(project.shortDescription), String(project.problem), String(project.context || ''), String(project.solution), String(project.implementation || ''),
        JSON.stringify(project.deliverables || []), String(project.resultLimits || ''), project.heroMediaId ? String(project.heroMediaId) : null, JSON.stringify(project.tags || []), Number(Boolean(project.featured)), Number(Boolean(project.published)), Number(project.sortOrder || 0),
        project.client ? String(project.client) : null, project.year != null ? Number(project.year) : null, project.liveUrl ? String(project.liveUrl) : null, stamp, stamp
      );
    const link = this.db.prepare('INSERT INTO project_media (project_id,media_id,sort_order) VALUES (?,?,?)');
    galleryIds.forEach((mediaId, index) => link.run(projectId, mediaId, index));
    return projectId;
  }

  async getProjectById(projectId: string) {
    return this.db.prepare('SELECT * FROM projects WHERE id=?').get(projectId) as Row | undefined;
  }

  async updateProject(projectId: string, project: Row, galleryIds: string[]) {
    const previous = await this.getProjectById(projectId);
    if (!previous) throw new Error('Project not found');
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`UPDATE projects SET slug=?,title=?,category=?,status=?,short_description=?,problem=?,context=?,solution=?,implementation=?,deliverables_json=?,result_limits=?,hero_media_id=?,tags_json=?,featured=?,published=?,archived=0,sort_order=?,client=?,year=?,live_url=?,updated_at=? WHERE id=?`)
        .run(
          String(project.slug), String(project.title), String(project.category), String(project.status), String(project.shortDescription), String(project.problem), String(project.context || ''), String(project.solution), String(project.implementation || ''),
          JSON.stringify(project.deliverables || []), String(project.resultLimits || ''), project.heroMediaId ? String(project.heroMediaId) : null, JSON.stringify(project.tags || []), Number(Boolean(project.featured)), Number(Boolean(project.published)), Number(project.sortOrder || 0),
          project.client ? String(project.client) : null, project.year != null ? Number(project.year) : null, project.liveUrl ? String(project.liveUrl) : null, now(), projectId
        );
      this.db.prepare('DELETE FROM project_media WHERE project_id=?').run(projectId);
      const link = this.db.prepare('INSERT INTO project_media (project_id,media_id,sort_order) VALUES (?,?,?)');
      galleryIds.forEach((mediaId, index) => link.run(projectId, mediaId, index));
      if (previous.slug !== project.slug && previous.published) {
        this.db.prepare("INSERT OR REPLACE INTO slug_redirects (entity_type,old_slug,entity_id,created_at) VALUES ('project',?,?,?)")
          .run(String(previous.slug), projectId, now());
      }
      this.db.exec('COMMIT');
      return { slugChanged: previous.slug !== project.slug };
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  async archiveProject(projectId: string) {
    this.db.prepare('UPDATE projects SET published=0,archived=1,updated_at=? WHERE id=?').run(now(), projectId);
  }

  async getAdminLeads(search = '', status = '') {
    const s = `%${search}%`;
    return this.db.prepare(`SELECT id,name,business_name businessName,project_type projectType,idea,preferred_channel preferredChannel,
      contact_value contactValue,status,source,internal_notes internalNotes,created_at createdAt,updated_at updatedAt FROM leads
      WHERE (?='' OR status=?) AND (name LIKE ? OR business_name LIKE ? OR contact_value LIKE ?) ORDER BY created_at DESC`).all(status, status, s, s, s) as Row[];
  }

  async updateLead(leadId: string, status: string, notes: string) {
    const result = this.db.prepare('UPDATE leads SET status=?,internal_notes=?,updated_at=? WHERE id=?').run(status, notes, now(), leadId);
    return (result.changes ?? 0) > 0;
  }

  async getAdminMedia() {
    const rows = this.db.prepare('SELECT * FROM media ORDER BY created_at DESC').all() as Row[];
    return rows.map((row) => ({
      id: row.id, fileName: row.file_name, url: row.storage_url, altText: row.alt_text,
      mimeType: row.mime_type, width: row.width, height: row.height, createdAt: row.created_at,
    }));
  }

  async createMedia(media: { id: string; fileName: string; storageKey: string; storageUrl: string; altText: string; mimeType: string; width: number | null; height: number | null }) {
    this.db.prepare('INSERT INTO media (id,file_name,storage_key,storage_url,alt_text,mime_type,width,height,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(media.id, media.fileName, media.storageKey, media.storageUrl, media.altText, media.mimeType, media.width, media.height, now());
    return media.id;
  }

  async getMediaById(mediaId: string) {
    return this.db.prepare('SELECT * FROM media WHERE id=?').get(mediaId) as Row | undefined;
  }

  async getMediaUsageCount(mediaId: string) {
    const res = this.db.prepare('SELECT (SELECT count(*) FROM projects WHERE hero_media_id=?) + (SELECT count(*) FROM project_media WHERE media_id=?) count').get(mediaId, mediaId) as Row;
    return Number(res.count || 0);
  }

  async deleteMedia(mediaId: string) {
    this.db.prepare('DELETE FROM media WHERE id=?').run(mediaId);
  }

  async getAdminSettings() {
    const rows = this.db.prepare('SELECT key,value,updated_at updatedAt FROM site_settings').all() as Row[];
    return Object.fromEntries(rows.map((row) => [row.key, String(row.value)]));
  }

  async updateAdminSettings(values: Record<string, string>) {
    const stamp = now();
    const update = this.db.prepare('INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at');
    for (const [k, v] of Object.entries(values)) update.run(k, v, stamp);
  }

  async getAuditLogs() {
    const rows = this.db.prepare('SELECT id,actor_email actorEmail,action,entity_type entityType,entity_id entityId,metadata_json metadata,created_at createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 100').all() as Row[];
    return rows.map((row) => ({ ...row, metadata: json(row.metadata, {}) }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED FACTORY
// ─────────────────────────────────────────────────────────────────────────────
export class Database implements IDatabase {
  private adapter: IDatabase;

  constructor(optionsOrPath?: string | { databaseUrl?: string; databasePath?: string }) {
    const databaseUrl = typeof optionsOrPath === 'object' ? optionsOrPath.databaseUrl : undefined;
    const databasePath = typeof optionsOrPath === 'string' ? optionsOrPath : optionsOrPath?.databasePath;

    const envDatabaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || databaseUrl;
    if (envDatabaseUrl) {
      this.adapter = new PostgresDatabase(envDatabaseUrl);
    } else {
      this.adapter = new SqliteDatabase(databasePath || './apps/api/data/orkestrix.sqlite');
    }
  }

  close() { return this.adapter.close(); }
  healthCheck() { return this.adapter.healthCheck(); }
  bootstrapAdmin(email: string, password: string) { return this.adapter.bootstrapAdmin(email, password); }
  findAdminByEmail(email: string) { return this.adapter.findAdminByEmail(email); }
  createSession(adminId: string, rawToken: string, expiresAt: string) { return this.adapter.createSession(adminId, rawToken, expiresAt); }
  session(rawToken: string) { return this.adapter.session(rawToken); }
  deleteSession(rawToken: string) { return this.adapter.deleteSession(rawToken); }
  cleanupSessions() { return this.adapter.cleanupSessions(); }
  audit(actorId: string | null, actorEmail: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
    return this.adapter.audit(actorId, actorEmail, action, entityType, entityId, metadata);
  }
  getPublicServices() { return this.adapter.getPublicServices(); }
  getPublicProjects() { return this.adapter.getPublicProjects(); }
  getPublicProjectBySlug(slug: string) { return this.adapter.getPublicProjectBySlug(slug); }
  getPublicSettings() { return this.adapter.getPublicSettings(); }
  createLead(data: { name: string; businessName: string; projectType: string; idea: string; preferredChannel: string; contactValue: string }) {
    return this.adapter.createLead(data);
  }
  getDashboardData() { return this.adapter.getDashboardData(); }
  getAdminServices() { return this.adapter.getAdminServices(); }
  createService(service: Row) { return this.adapter.createService(service); }
  getServiceById(id: string) { return this.adapter.getServiceById(id); }
  updateService(id: string, service: Row) { return this.adapter.updateService(id, service); }
  archiveService(id: string) { return this.adapter.archiveService(id); }
  getAdminProjects() { return this.adapter.getAdminProjects(); }
  createProject(project: Row, galleryIds: string[]) { return this.adapter.createProject(project, galleryIds); }
  getProjectById(id: string) { return this.adapter.getProjectById(id); }
  updateProject(id: string, project: Row, galleryIds: string[]) { return this.adapter.updateProject(id, project, galleryIds); }
  archiveProject(id: string) { return this.adapter.archiveProject(id); }
  getAdminLeads(search?: string, status?: string) { return this.adapter.getAdminLeads(search, status); }
  updateLead(id: string, status: string, notes: string) { return this.adapter.updateLead(id, status, notes); }
  getAdminMedia() { return this.adapter.getAdminMedia(); }
  createMedia(media: { id: string; fileName: string; storageKey: string; storageUrl: string; altText: string; mimeType: string; width: number | null; height: number | null }) {
    return this.adapter.createMedia(media);
  }
  getMediaById(id: string) { return this.adapter.getMediaById(id); }
  getMediaUsageCount(id: string) { return this.adapter.getMediaUsageCount(id); }
  deleteMedia(id: string) { return this.adapter.deleteMedia(id); }
  getAdminSettings() { return this.adapter.getAdminSettings(); }
  updateAdminSettings(values: Record<string, string>) { return this.adapter.updateAdminSettings(values); }
  getAuditLogs() { return this.adapter.getAuditLogs(); }
}
