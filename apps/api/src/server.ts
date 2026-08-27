import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database, id, json, timestamp, type IDatabase, type Row } from './database.js';
import { createSessionToken, verifyPassword } from './security.js';
import { createStorageAdapter, type StorageAdapter } from './storage.js';
import {
  ValidationError, booleanValue, enumValue, integer, leadStatuses, optionalText, projectCategories,
  projectStatuses, safeUrl, serviceIcons, serviceStatuses, slug, stringArray, text,
} from './validation.js';

export type Actor = { id: string; email: string; role: 'admin' | 'editor'; sessionId: string };
export type ApiOptions = {
  /** Local-only integration-test adapter. Never set this in Vercel. */
  databasePath?: string;
  databaseUrl?: string;
  uploadsPath?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket?: string;
  webRoot?: string;
  secureCookies?: boolean;
};
export type ObjectBody = Record<string, unknown>;

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
const uploadTypes: Record<string, { extension: string; signature: (bytes: Buffer) => boolean }> = {
  'image/png': { extension: '.png', signature: (b) => b.subarray(1, 4).toString() === 'PNG' },
  'image/jpeg': { extension: '.jpg', signature: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/webp': { extension: '.webp', signature: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
};

function responseJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 6 * 1024 * 1024): Promise<ObjectBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new ValidationError({ body: 'حجم الطلب أكبر من المسموح.' });
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as ObjectBody;
  } catch {
    throw new ValidationError({ body: 'صيغة الطلب غير صالحة.' });
  }
}

function cookie(req: IncomingMessage, name: string) {
  const item = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

function routeId(pathname: string, prefix: string) {
  if (!pathname.startsWith(`${prefix}/`)) return null;
  const value = pathname.slice(prefix.length + 1);
  return value && !value.includes('/') ? decodeURIComponent(value) : null;
}

function parseArray(value: unknown) { return json(value) as string[]; }
function serviceRow(row: Row) {
  return {
    id: row.id, slug: row.slug, title: row.title, shortDescription: row.short_description, description: row.description,
    icon: row.icon, order: row.sort_order, status: row.status, published: Boolean(row.published), featured: Boolean(row.featured),
    color: row.color, label: row.label, problem: parseArray(row.problem_json), value: parseArray(row.value_json), examples: parseArray(row.examples_json),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function actorFrom(req: IncomingMessage, database: IDatabase): Promise<Actor | null> {
  const token = cookie(req, 'orkestrix_session');
  if (!token) return null;
  const row = await database.session(token);
  return row ? { id: String(row.id), email: String(row.email), role: row.role as Actor['role'], sessionId: String(row.session_id) } : null;
}

async function requireActor(req: IncomingMessage, database: IDatabase): Promise<Actor> {
  const actor = await actorFrom(req, database);
  if (!actor) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
  return actor;
}

function requireMutationOrigin(req: IncomingMessage) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '')) return;
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host && new URL(origin).host !== host) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
}

function validateService(body: ObjectBody) {
  return {
    slug: slug(body.slug), title: text(body.title, 'title', 2, 120), shortDescription: text(body.shortDescription, 'shortDescription', 5, 300),
    description: text(body.description, 'description', 10, 3000), icon: enumValue(body.icon, serviceIcons, 'icon'),
    order: integer(body.order, 'order', 0, 999), status: enumValue(body.status, serviceStatuses, 'status'),
    published: booleanValue(body.published), featured: booleanValue(body.featured), color: text(body.color ?? 'blue', 'color', 2, 30),
    label: text(body.label ?? body.title, 'label', 2, 80), problem: stringArray(body.problem ?? [], 'problem'),
    value: stringArray(body.value ?? [], 'value'), examples: stringArray(body.examples ?? [], 'examples'),
  };
}

function validateProject(body: ObjectBody) {
  const year = body.year === '' || body.year == null ? null : integer(body.year, 'year', 1900, 2200);
  return {
    slug: slug(body.slug), title: text(body.title, 'title', 2, 160), category: enumValue(body.category, projectCategories, 'category'),
    status: enumValue(body.status, projectStatuses, 'status'), shortDescription: text(body.shortDescription, 'shortDescription', 10, 400),
    problem: text(body.problem, 'problem', 10, 5000), context: text(body.context, 'context', 5, 5000), solution: text(body.solution, 'solution', 10, 5000),
    implementation: text(body.implementation, 'implementation', 5, 5000), deliverables: stringArray(body.deliverables, 'deliverables'),
    resultLimits: text(body.resultLimits, 'resultLimits', 5, 3000), heroMediaId: optionalText(body.heroMediaId, 100),
    galleryIds: stringArray(body.galleryIds ?? [], 'galleryIds'), tags: stringArray(body.tags ?? [], 'tags'),
    featured: booleanValue(body.featured), published: booleanValue(body.published), sortOrder: integer(body.sortOrder, 'sortOrder', 0, 999),
    client: optionalText(body.client, 160), year, liveUrl: safeUrl(body.liveUrl, 'liveUrl'),
  };
}

function uniqueConflict(error: unknown) {
  return error instanceof Error && (error.message.includes('UNIQUE constraint failed') || error.message.includes('duplicate key value') || error.message.includes('23505'));
}

export function createApplication(options: ApiOptions = {}) {
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const productionRuntime = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (productionRuntime && (!databaseUrl || !supabaseUrl || !supabaseServiceRoleKey)) {
    throw new Error('Production requires DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY. SQLite and local storage are not available in production.');
  }
  const database = new Database(databaseUrl ? { databaseUrl } : options.databasePath || './apps/api/data/orkestrix.sqlite');
  const storage = createStorageAdapter({
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseBucket: options.supabaseBucket || process.env.SUPABASE_STORAGE_BUCKET || 'project-media',
    uploadsPath: options.uploadsPath || './apps/api/uploads',
  });

  const attempts = new Map<string, { count: number; reset: number }>();

  const limited = (key: string, maximum: number, windowMs: number) => {
    const current = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.reset < current) { attempts.set(key, { count: 1, reset: current + windowMs }); return false; }
    entry.count += 1;
    return entry.count > maximum;
  };

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path.startsWith('/api/')) {
        requireMutationOrigin(req);
        if (req.method === 'GET' && path === '/api/health') {
          const ok = await database.healthCheck();
          return ok
            ? responseJson(res, 200, { status: 'ok', database: 'ok', node: process.version })
            : responseJson(res, 503, { status: 'degraded', database: 'unreachable' });
        }

        if (req.method === 'GET' && path === '/api/public/services') {
          const rows = await database.getPublicServices();
          return responseJson(res, 200, { data: rows.map(serviceRow) });
        }
        if (req.method === 'GET' && path === '/api/public/projects') {
          const rows = await database.getPublicProjects();
          return responseJson(res, 200, { data: rows });
        }
        const publicProjectSlug = routeId(path, '/api/public/projects');
        if (req.method === 'GET' && publicProjectSlug) {
          const { project, redirectedFrom } = await database.getPublicProjectBySlug(publicProjectSlug);
          return project ? responseJson(res, 200, { data: project, redirectedFrom }) : responseJson(res, 404, { error: 'المشروع غير موجود.' });
        }
        if (req.method === 'GET' && path === '/api/public/settings') {
          const settings = await database.getPublicSettings();
          return responseJson(res, 200, { data: settings });
        }
        if (req.method === 'POST' && path === '/api/public/leads') {
          const key = `lead:${req.socket.remoteAddress ?? 'unknown'}`;
          if (limited(key, 5, 15 * 60_000)) return responseJson(res, 429, { error: 'عدد المحاولات كبير. حاول لاحقًا.' });
          const body = await readBody(req, 64 * 1024);
          if (body.website) return responseJson(res, 400, { error: 'تعذر إرسال الطلب.' });
          const record = {
            name: text(body.name, 'name', 2, 120), businessName: text(body.businessName, 'businessName', 2, 160),
            projectType: text(body.projectType, 'projectType', 2, 80), idea: text(body.idea, 'idea', 12, 5000),
            preferredChannel: enumValue(body.preferredContactMethod, ['البريد الإلكتروني','الهاتف','واتساب'] as const, 'preferredContactMethod'),
            contactValue: text(body.contactDetails, 'contactDetails', 3, 240),
          };
          if (record.preferredChannel === 'البريد الإلكتروني' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.contactValue)) throw new ValidationError({ contactDetails: 'أدخل بريدًا إلكترونيًا صالحًا.' });
          if (record.preferredChannel !== 'البريد الإلكتروني' && record.contactValue.replace(/\D/g, '').length < 7) throw new ValidationError({ contactDetails: 'أدخل رقم تواصل صالحًا.' });
          const leadId = await database.createLead(record);
          return responseJson(res, 201, { requestId: leadId });
        }

        if (req.method === 'POST' && path === '/api/auth/login') {
          const key = `login:${req.socket.remoteAddress ?? 'unknown'}`;
          if (limited(key, 8, 15 * 60_000)) return responseJson(res, 429, { error: 'محاولات دخول كثيرة. حاول لاحقًا.' });
          const body = await readBody(req, 16 * 1024);
          const email = text(body.email, 'email', 3, 254).toLowerCase();
          const password = text(body.password, 'password', 1, 256);
          const admin = await database.findAdminByEmail(email);
          if (!admin || !verifyPassword(password, String(admin.password_hash))) {
            await database.audit(null, email, 'auth.login_failed', 'admin', admin ? String(admin.id) : null, {});
            return responseJson(res, 401, { error: 'بيانات الدخول غير صحيحة.' });
          }
          const token = createSessionToken();
          const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
          await database.createSession(String(admin.id), token, expiresAt);
          await database.audit(String(admin.id), String(admin.email), 'auth.login', 'admin', String(admin.id), {});
          const secure = options.secureCookies ? '; Secure' : '';
          return responseJson(res, 200, { user: { id: admin.id, email: admin.email, role: admin.role } }, { 'Set-Cookie': `orkestrix_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}` });
        }
        if (req.method === 'POST' && path === '/api/auth/logout') {
          const token = cookie(req, 'orkestrix_session'); const actor = await actorFrom(req, database);
          if (token) await database.deleteSession(token);
          if (actor) await database.audit(actor.id, actor.email, 'auth.logout', 'admin', actor.id, {});
          const secure = options.secureCookies ? '; Secure' : '';
          return responseJson(res, 200, { ok: true }, { 'Set-Cookie': `orkestrix_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}` });
        }
        if (req.method === 'GET' && path === '/api/auth/session') {
          const actor = await actorFrom(req, database);
          return actor ? responseJson(res, 200, { user: actor }) : responseJson(res, 401, { error: 'يلزم تسجيل الدخول.' });
        }

        const actor = await requireActor(req, database);
        if (req.method === 'GET' && path === '/api/admin/dashboard') {
          const data = await database.getDashboardData();
          return responseJson(res, 200, { data });
        }

        if (req.method === 'GET' && path === '/api/admin/services') {
          const rows = await database.getAdminServices();
          return responseJson(res, 200, { data: rows.map(serviceRow) });
        }
        if (req.method === 'POST' && path === '/api/admin/services') {
          const value = validateService(await readBody(req));
          let serviceId: string;
          try {
            serviceId = await database.createService(value);
          } catch (error) { if (uniqueConflict(error)) throw new ValidationError({ slug: 'هذا الرابط مستخدم بالفعل.' }); throw error; }
          await database.audit(actor.id, actor.email, value.published ? 'service.publish' : 'service.create', 'service', serviceId, {});
          return responseJson(res, 201, { id: serviceId });
        }
        const serviceId = routeId(path, '/api/admin/services');
        if (serviceId && req.method === 'PUT') {
          const value = validateService(await readBody(req)); const previous = await database.getServiceById(serviceId);
          if (!previous) return responseJson(res, 404, { error: 'الخدمة غير موجودة.' });
          try {
            await database.updateService(serviceId, value);
          } catch (error) { if (uniqueConflict(error)) throw new ValidationError({ slug: 'هذا الرابط مستخدم بالفعل.' }); throw error; }
          await database.audit(actor.id, actor.email, value.published !== Boolean(previous.published) ? (value.published ? 'service.publish' : 'service.unpublish') : 'service.update', 'service', serviceId, previous.slug === value.slug ? {} : { oldSlug: previous.slug, newSlug: value.slug });
          return responseJson(res, 200, { id: serviceId });
        }
        if (serviceId && req.method === 'DELETE') {
          await database.archiveService(serviceId);
          await database.audit(actor.id, actor.email, 'service.archive', 'service', serviceId, {});
          return responseJson(res, 200, { ok: true });
        }

        if (req.method === 'GET' && path === '/api/admin/projects') {
          const rows = await database.getAdminProjects();
          return responseJson(res, 200, { data: rows });
        }
        if (req.method === 'POST' && path === '/api/admin/projects') {
          const value = validateProject(await readBody(req));
          let projectId: string;
          try {
            projectId = await database.createProject(value, value.galleryIds);
          } catch (error) { if (uniqueConflict(error)) throw new ValidationError({ slug: 'هذا الرابط مستخدم بالفعل.' }); throw error; }
          await database.audit(actor.id, actor.email, value.published ? 'project.publish' : 'project.create', 'project', projectId, {});
          return responseJson(res, 201, { id: projectId });
        }
        const projectId = routeId(path, '/api/admin/projects');
        if (projectId && req.method === 'PUT') {
          const value = validateProject(await readBody(req));
          let result: { slugChanged: boolean };
          try {
            result = await database.updateProject(projectId, value, value.galleryIds);
          } catch (error) { if (uniqueConflict(error)) throw new ValidationError({ slug: 'هذا الرابط مستخدم بالفعل.' }); throw error; }
          await database.audit(actor.id, actor.email, value.published ? 'project.publish' : 'project.update', 'project', projectId, {});
          return responseJson(res, 200, { id: projectId, slugChanged: result.slugChanged });
        }
        if (projectId && req.method === 'DELETE') {
          await database.archiveProject(projectId);
          await database.audit(actor.id, actor.email, 'project.archive', 'project', projectId, {});
          return responseJson(res, 200, { ok: true });
        }

        if (req.method === 'GET' && path === '/api/admin/leads') {
          const search = url.searchParams.get('search') ?? ''; const status = url.searchParams.get('status') ?? '';
          const rows = await database.getAdminLeads(search, status);
          return responseJson(res, 200, { data: rows });
        }
        const leadId = routeId(path, '/api/admin/leads');
        if (leadId && req.method === 'PATCH') {
          const body = await readBody(req); const status = enumValue(body.status, leadStatuses, 'status'); const notes = optionalText(body.internalNotes, 5000) ?? '';
          const updated = await database.updateLead(leadId, status, notes);
          if (!updated) return responseJson(res, 404, { error: 'الطلب غير موجود.' });
          await database.audit(actor.id, actor.email, 'lead.status_update', 'lead', leadId, { status });
          return responseJson(res, 200, { ok: true });
        }

        if (req.method === 'GET' && path === '/api/admin/media') {
          const rows = await database.getAdminMedia();
          return responseJson(res, 200, { data: rows });
        }
        if (req.method === 'POST' && path === '/api/admin/media') {
          const body = await readBody(req); const fileName = text(body.fileName, 'fileName', 1, 180); const altText = text(body.altText, 'altText', 2, 240);
          const mimeType = text(body.mimeType, 'mimeType', 3, 80); const rule = uploadTypes[mimeType];
          if (!rule) throw new ValidationError({ mimeType: 'نوع الصورة غير مسموح.' });
          const base64 = text(body.base64, 'base64', 10, 7_500_000); const bytes = Buffer.from(base64, 'base64');
          if (bytes.length < 24 || bytes.length > 5 * 1024 * 1024 || !rule.signature(bytes)) throw new ValidationError({ file: 'ملف الصورة غير صالح أو أكبر من 5MB.' });
          const mediaId = id();
          const uploadResult = await storage.upload({ id: mediaId, fileName, extension: rule.extension, mimeType, buffer: bytes });
          const width = body.width == null ? null : integer(body.width, 'width', 1, 20_000); const height = body.height == null ? null : integer(body.height, 'height', 1, 20_000);
          await database.createMedia({ id: mediaId, fileName, storageKey: uploadResult.storageKey, storageUrl: uploadResult.url, altText, mimeType, width, height });
          await database.audit(actor.id, actor.email, 'media.upload', 'media', mediaId, { mimeType, fileName });
          return responseJson(res, 201, { id: mediaId, url: uploadResult.url });
        }
        const mediaId = routeId(path, '/api/admin/media');
        if (mediaId && req.method === 'DELETE') {
          const used = await database.getMediaUsageCount(mediaId);
          if (used) return responseJson(res, 409, { error: 'افصل الصورة عن المشاريع قبل حذفها.' });
          const row = await database.getMediaById(mediaId);
          if (!row) return responseJson(res, 404, { error: 'الوسائط غير موجودة.' });
          await database.deleteMedia(mediaId);
          await storage.delete(String(row.storage_key || row.storage_url || row.url || ''));
          await database.audit(actor.id, actor.email, 'media.delete', 'media', mediaId, {});
          return responseJson(res, 200, { ok: true });
        }

        if (req.method === 'GET' && path === '/api/admin/settings') {
          const settings = await database.getAdminSettings();
          return responseJson(res, 200, { data: settings });
        }
        if (req.method === 'PUT' && path === '/api/admin/settings') {
          const body = await readBody(req);
          const values = {
            contactChannels: JSON.stringify(stringArray(body.contactChannels ?? [], 'contactChannels', 10)),
            footerContact: optionalText(body.footerContact, 500) ?? '',
            defaultSocialImage: text(body.defaultSocialImage ?? '/orkestrix-mark.png', 'defaultSocialImage', 1, 2048),
            domain: safeUrl(body.domain, 'domain') ?? 'https://orkestrix.site',
          };
          if (!values.defaultSocialImage.startsWith('/') && !safeUrl(values.defaultSocialImage, 'defaultSocialImage')) throw new ValidationError({ defaultSocialImage: 'رابط صورة المشاركة غير صالح.' });
          await database.updateAdminSettings(values);
          await database.audit(actor.id, actor.email, 'settings.update', 'site_settings', null, { keys: Object.keys(values) });
          return responseJson(res, 200, { ok: true });
        }
        if (req.method === 'GET' && path === '/api/admin/audit') {
          const logs = await database.getAuditLogs();
          return responseJson(res, 200, { data: logs });
        }
        return responseJson(res, 404, { error: 'المسار غير موجود.' });
      }

      // Local media serving exists solely for the local integration-test adapter.
      // Production media is served by Supabase Storage URLs and never from Vercel disk.
      if (!productionRuntime && path.startsWith('/uploads/')) {
        const name = path.slice('/uploads/'.length);
        if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(name)) { res.writeHead(404); return res.end(); }
        const file = join(options.uploadsPath || './apps/api/uploads', name);
        if (!existsSync(file)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
        return res.end(readFileSync(file));
      }

      if (options.webRoot) {
        const root = resolve(options.webRoot);
        const requested = path === '/' ? 'index.html' : path.slice(1);
        const candidate = resolve(root, normalize(requested));
        const file = candidate.startsWith(root) && existsSync(candidate) && !candidate.endsWith('/') ? candidate : join(root, 'index.html');
        if (existsSync(file)) {
          res.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
          return res.end(readFileSync(file));
        }
      }
      res.writeHead(404); res.end('Not found');
    } catch (error) {
      if (error instanceof ValidationError) return responseJson(res, 400, { error: error.message, fields: error.fields });
      const status = Number((error as { status?: number }).status ?? 500);
      if (status === 401) return responseJson(res, 401, { error: 'يلزم تسجيل الدخول.' });
      if (status === 403) return responseJson(res, 403, { error: 'الطلب غير مسموح.' });
      console.error('Request failed', { method: req.method, path, error });
      return responseJson(res, 500, { error: 'تعذر إكمال العملية.' });
    }
  };

  return { database, storage, handler, close: () => database.close() };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const workspace = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
  const fromWorkspace = (value: string | undefined, fallback: string) => value ? resolve(workspace, value) : fallback;
  const webRoot = fromWorkspace(process.env.ORKESTRIX_WEB_ROOT, join(workspace, 'apps/web/dist/public'));

  if (process.env.NODE_ENV === 'production') {
    const webIndex = join(webRoot, 'index.html');
    if (!process.env.VERCEL && !existsSync(webIndex)) {
      console.error(`[STARTUP ERROR] Web root index.html not found: ${webIndex}`);
      console.error('[STARTUP ERROR] Run `pnpm build` or set ORKESTRIX_WEB_ROOT to the correct built SPA path.');
      process.exit(1);
    }
    if (process.env.ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL || process.env.ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD) {
      console.warn('[SECURITY WARNING] ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL / ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD are set in production. Remove them from .env after the first admin account has been created.');
    }
  }

  const app = createApplication({
    databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'project-media',
    webRoot,
    secureCookies: process.env.NODE_ENV === 'production',
  });
  const bootstrapEmail = process.env.ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL;
  const bootstrapPassword = process.env.ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD;
  if (bootstrapEmail && bootstrapPassword) {
    app.database.bootstrapAdmin(bootstrapEmail, bootstrapPassword).catch(console.error);
  }
  app.database.cleanupSessions().catch(console.error);
  const port = Number(process.env.PORT ?? 4174);
  createServer(app.handler).listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`Orkestrix operational server listening on ${port}`));
}
