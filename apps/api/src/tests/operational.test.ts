import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApplication } from '../server.js';

let server: Server;
let baseUrl = '';
let cookie = '';
type TestBody = { data: any; id: string; requestId: string; slugChanged: boolean; [key: string]: unknown };
const temporary = mkdtempSync(join(tmpdir(), 'orkestrix-api-test-'));
const application = createApplication({ databasePath: join(temporary, 'test.sqlite'), uploadsPath: join(temporary, 'uploads') });

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({})) as TestBody;
  return { response, body };
}

before(async () => {
  await application.database.bootstrapAdmin('admin@orkestrix.test', 'a-secure-test-password');
  server = createServer(application.handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await application.close();
  rmSync(temporary, { recursive: true, force: true });
});

test('health and public database selectors return published seed records', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal((health.body as unknown as { database: string }).database, 'ok');
  const services = await request('/api/public/services');
  assert.equal(services.response.status, 200);
  assert.equal(services.body.data.length, 5);
  const projects = await request('/api/public/projects');
  assert.equal(projects.body.data.length, 1);
});

test('admin routes reject requests without a secure session', async () => {
  const result = await request('/api/admin/dashboard');
  assert.equal(result.response.status, 401);
});

test('authentication creates and destroys a server-side session', async () => {
  const denied = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@orkestrix.test', password: 'wrong' }) });
  assert.equal(denied.response.status, 401);
  const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@orkestrix.test', password: 'a-secure-test-password' }) });
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get('set-cookie')?.split(';')[0] ?? '';
  assert.match(cookie, /^orkestrix_session=/);
  assert.equal((await request('/api/auth/session')).response.status, 200);
});

test('services CRUD validates unique slugs and hides drafts from public selectors', async () => {
  const service = {
    slug: 'test-service', title: 'خدمة اختبار', shortDescription: 'وصف مختصر لخدمة اختبار.', description: 'وصف كامل صالح لخدمة الاختبار التشغيلية.',
    icon: 'custom', order: 20, status: 'draft', published: false, featured: false, color: 'blue', label: 'اختبار', problem: [], value: ['قيمة'], examples: [],
  };
  const created = await request('/api/admin/services', { method: 'POST', body: JSON.stringify(service) });
  assert.equal(created.response.status, 201);
  const serviceId = created.body.id;
  const publicDraft = await request('/api/public/services');
  assert.equal(publicDraft.body.data.some((item: Record<string, unknown>) => item.id === serviceId), false);
  const published = await request(`/api/admin/services/${serviceId}`, { method: 'PUT', body: JSON.stringify({ ...service, status: 'active', published: true }) });
  assert.equal(published.response.status, 200);
  assert.equal((await request('/api/public/services')).body.data.some((item: Record<string, unknown>) => item.id === serviceId), true);
  const duplicate = await request('/api/admin/services', { method: 'POST', body: JSON.stringify({ ...service, status: 'active' }) });
  assert.equal(duplicate.response.status, 400);
  assert.equal((await request(`/api/admin/services/${serviceId}`, { method: 'DELETE' })).response.status, 200);
});

test('projects CRUD controls publishing and exposes data-driven details', async () => {
  const project = {
    slug: 'tested-project', title: 'مشروع اختباري موثق', category: 'custom-systems', status: 'demo', shortDescription: 'مشروع اختباري للتحقق من دورة النشر.',
    problem: 'الحاجة إلى التحقق من دورة المشروع كاملة.', context: 'سياق اختباري معلّم بوضوح ولا يمثل عميلًا.', solution: 'استخدام سجل مشروع تجريبي داخل الاختبار فقط.',
    implementation: 'إنشاء السجل ثم نشره والتحقق من تفاصيله.', deliverables: ['سجل اختباري'], resultLimits: 'لا توجد نتائج تجارية؛ هذا سجل اختبار آلي.',
    heroMediaId: null, galleryIds: [], tags: ['Test'], featured: false, published: false, sortOrder: 30, client: null, year: null, liveUrl: null,
  };
  const created = await request('/api/admin/projects', { method: 'POST', body: JSON.stringify(project) });
  assert.equal(created.response.status, 201);
  const projectId = created.body.id;
  assert.equal((await request('/api/public/projects/tested-project')).response.status, 404);
  assert.equal((await request(`/api/admin/projects/${projectId}`, { method: 'PUT', body: JSON.stringify({ ...project, published: true }) })).response.status, 200);
  const detail = await request('/api/public/projects/tested-project');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.resultLimits, project.resultLimits);
  const renamed = await request(`/api/admin/projects/${projectId}`, { method: 'PUT', body: JSON.stringify({ ...project, slug: 'tested-project-renamed', published: true }) });
  assert.equal(renamed.body.slugChanged, true);
  assert.equal((await request('/api/public/projects/tested-project')).response.status, 200);
  assert.equal((await request(`/api/admin/projects/${projectId}`, { method: 'DELETE' })).response.status, 200);
  assert.equal((await request('/api/public/projects/tested-project-renamed')).response.status, 404);
});

test('public contact flow persists a lead before returning a request id', async () => {
  const created = await request('/api/public/leads', { method: 'POST', body: JSON.stringify({
    name: 'مستخدم اختبار', businessName: 'نشاط اختبار', projectType: 'موقع', idea: 'فكرة اختبارية واضحة يزيد وصفها عن الحد الأدنى.',
    preferredContactMethod: 'البريد الإلكتروني', contactDetails: 'test@example.com', website: '',
  }) });
  assert.equal(created.response.status, 201);
  assert.match(created.body.requestId, /^[0-9a-f-]{36}$/);
  const leads = await request('/api/admin/leads?search=test%40example.com');
  assert.equal(leads.body.data.length, 1);
  const lead = leads.body.data[0];
  assert.equal((await request(`/api/admin/leads/${String(lead.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'contacted', internalNotes: 'تم اختبار المتابعة.' }) })).response.status, 200);
});

test('media validates content, uploads, lists, and deletes safely', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64');
  const uploaded = await request('/api/admin/media', { method: 'POST', body: JSON.stringify({ fileName: 'test.png', mimeType: 'image/png', altText: 'صورة اختبار', base64: bytes.toString('base64'), width: 1, height: 1 }) });
  assert.equal(uploaded.response.status, 201);
  const listed = await request('/api/admin/media');
  assert.equal(listed.body.data.some((item: Record<string, unknown>) => item.id === uploaded.body.id), true);
  assert.equal((await request(`/api/admin/media/${uploaded.body.id}`, { method: 'DELETE' })).response.status, 200);
});

test('site settings and audit log are protected and operational', async () => {
  const updated = await request('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ contactChannels: ['email@example.com'], footerContact: 'email@example.com', defaultSocialImage: '/orkestrix-mark.png', domain: 'https://orkestrix.site' }) });
  assert.equal(updated.response.status, 200);
  const audit = await request('/api/admin/audit');
  assert.equal(audit.response.status, 200);
  assert.equal(audit.body.data.some((item: Record<string, unknown>) => item.action === 'settings.update'), true);
});

test('logout invalidates the session', async () => {
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).response.status, 200);
  cookie = '';
  assert.equal((await request('/api/admin/dashboard')).response.status, 401);
});
