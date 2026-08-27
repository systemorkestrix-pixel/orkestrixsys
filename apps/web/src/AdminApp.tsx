import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { Activity, BriefcaseBusiness, Database, FileImage, FolderKanban, LayoutDashboard, LogOut, Save, Settings, Users } from 'lucide-react';
import { api, ApiError } from './lib/api';
import type { Service } from './data/services';
import { statusLabels, type MediaAsset, type Project } from './data/projects';

type User = { id: string; email: string; role: 'admin' | 'editor' };
type Notice = { kind: 'success' | 'error'; text: string } | null;
type Lead = { id: string; name: string; businessName: string; projectType: string; idea: string; preferredChannel: string; contactValue: string; status: string; source: string; internalNotes: string; createdAt: string };
type DashboardData = { counts: { newLeads: number; openLeads: number; publishedServices: number; publishedProjects: number }; latestLeads: Lead[]; activity: Audit[] };
type Audit = { id: string; actorEmail?: string; action: string; entityType: string; entityId?: string; createdAt: string };

const adminLinks = [
  ['/admin', 'لوحة المتابعة', LayoutDashboard], ['/admin/services', 'الخدمات', Database], ['/admin/projects', 'المشاريع', FolderKanban],
  ['/admin/leads', 'طلبات المشاريع', Users], ['/admin/media', 'الوسائط', FileImage], ['/admin/settings', 'إعدادات الموقع', Settings],
] as const;

const leadStatusLabels: Record<string, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  qualified: 'مؤهل',
  proposal: 'عرض مقدم',
  won: 'تم الاتفاق',
  lost: 'ملغي',
};

const categoryLabels: Record<string, string> = {
  'business-websites': 'مواقع الأعمال',
  stores: 'المتاجر',
  dashboards: 'لوحات الإدارة',
  'custom-systems': 'الأنظمة المخصصة',
  integrations: 'التكاملات والأتمتة',
};

const serviceStatusLabels: Record<string, string> = {
  active: 'نشطة',
  draft: 'مسودة',
  archived: 'مؤرشفة',
};

const auditActionLabels: Record<string, string> = {
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
};

const auditEntityLabels: Record<string, string> = {
  service: 'خدمة',
  project: 'مشروع',
  lead: 'طلب مشروع',
  media: 'وسائط',
  settings: 'إعدادات',
  session: 'جلسة',
};

function AdminLogin({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [notice, setNotice] = useState<Notice>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try { const result = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onLogin(result.user); window.history.replaceState(null, '', '/admin'); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'تعذر تسجيل الدخول.' }); }
    finally { setBusy(false); }
  };
  return <main className="admin-auth" dir="rtl"><form className="admin-auth-card" onSubmit={submit}><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span className="admin-kicker">نظام الإدارة</span><h1>تسجيل الدخول</h1><p>استخدم حساب الإدارة الذي تم إنشاؤه من متغيرات البيئة الآمنة.</p>{notice && <NoticeView notice={notice} />}<label>البريد الإلكتروني<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="admin-primary" disabled={busy}>{busy ? 'جارٍ التحقق…' : 'دخول'}</button><a href="/">العودة إلى الموقع العام</a></form></main>;
}

function NoticeView({ notice }: { notice: NonNullable<Notice> }) { return <div className={`admin-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>; }
function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <label className={full ? 'admin-field-full' : ''}><span>{label}</span>{children}</label>; }
function splitLines(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }

function AdminShell({ user, children, logout }: { user: User; children: ReactNode; logout: () => void }) {
  const path = window.location.pathname.replace(/\/+$/, '') || '/admin';
  return <div className="admin-shell" dir="rtl"><aside className="admin-sidebar"><a className="admin-brand" href="/admin"><img src="/orkestrix-mark.png" alt="" /><span><strong>ORKESTRIX</strong><small>لوحة الإدارة</small></span></a><nav aria-label="التنقل الإداري">{adminLinks.map(([href, label, Icon]) => <a key={href} className={path === href ? 'active' : ''} href={href}><Icon size={18} />{label}</a>)}</nav><div className="admin-account"><span>{user.email}</span><small>{user.role === 'admin' ? 'مدير النظام' : 'محرر'}</small><button type="button" onClick={logout}><LogOut size={16} />تسجيل الخروج</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><span>نظام التشغيل</span><strong>من الفكرة إلى التشغيل.</strong></div><a href="/" target="_blank" rel="noreferrer">عرض الموقع العام</a></header>{children}</div></div>;
}

function AdminHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="admin-page-header"><div><span className="admin-kicker">إدارة العمليات</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }

function DashboardAdmin() {
  const [data, setData] = useState<DashboardData | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<{ data: DashboardData }>('/api/admin/dashboard').then((result) => setData(result.data)).catch((reason) => setError(reason.message)); }, []);
  if (error) return <AdminPageState text={error} error />; if (!data) return <AdminPageState text="جارٍ تحميل لوحة المتابعة…" />;
  const cards = [['طلبات جديدة', data.counts.newLeads], ['طلبات مفتوحة', data.counts.openLeads], ['خدمات منشورة', data.counts.publishedServices], ['مشاريع منشورة', data.counts.publishedProjects]];
  return <main className="admin-page"><AdminHeader title="لوحة المتابعة" description="صورة عملية لما يحتاج إلى متابعة الآن." /><section className="admin-stat-grid">{cards.map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}</section><div className="admin-two-columns"><section className="admin-panel"><h2>أحدث الطلبات</h2>{data.latestLeads.length ? <div className="admin-list">{data.latestLeads.map((lead) => <a href="/admin/leads" key={lead.id}><span><strong>{lead.name}</strong><small>{lead.businessName} · {lead.projectType}</small></span><b className={`admin-lead-status status-${lead.status}`}>{leadStatusLabels[lead.status] ?? lead.status}</b></a>)}</div> : <p className="admin-empty">لا توجد طلبات بعد.</p>}</section><section className="admin-panel"><h2><Activity size={19} /> النشاط الأخير</h2><AuditList items={data.activity} /></section></div></main>;
}

const emptyService: Service = { id: '', slug: '', title: '', shortDescription: '', description: '', icon: 'globe', order: 0, status: 'draft', published: false, featured: false, updatedAt: '', color: 'blue', label: '', problem: [], value: [], examples: [] };
function ServicesAdmin() {
  const [items, setItems] = useState<Service[]>([]); const [editing, setEditing] = useState<Service | null>(null); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(() => api<{ data: Service[] }>('/api/admin/services').then((result) => setItems(result.data)).catch((error) => setNotice({ kind: 'error', text: error.message })).finally(() => setLoading(false)), []);
  useEffect(() => { void load(); }, [load]);
  const save = async (item: Service) => { setNotice(null); try { await api(item.id ? `/api/admin/services/${item.id}` : '/api/admin/services', { method: item.id ? 'PUT' : 'POST', body: JSON.stringify(item) }); setNotice({ kind: 'success', text: 'حُفظت الخدمة وأصبح تغيير النشر نافذًا مباشرة.' }); setEditing(null); await load(); } catch (error) { setNotice({ kind: 'error', text: error instanceof ApiError && error.fields ? Object.values(error.fields)[0] : (error as Error).message }); } };
  const archive = async (item: Service) => { if (!confirm(`أرشفة «${item.title}» وإلغاء نشرها؟`)) return; await api(`/api/admin/services/${item.id}`, { method: 'DELETE' }); await load(); };
  return <main className="admin-page"><AdminHeader title="الخدمات" description="إدارة المحتوى والترتيب وحالة النشر للخدمات الرسمية." action={<button className="admin-primary" onClick={() => setEditing({ ...emptyService })}>خدمة جديدة</button>} />{notice && <NoticeView notice={notice} />}{editing && <ServiceForm value={editing} onCancel={() => setEditing(null)} onSave={save} />}{loading ? <AdminPageState text="جارٍ التحميل…" /> : <DataTable headers={['الخدمة','المسار (Slug)','التسمية','الحالة','الترتيب','حالة النشر','الإجراءات']}>{items.map((item) => <tr key={item.id}><td className="cell-title"><strong>{item.title}</strong></td><td className="cell-slug"><code className="admin-slug" dir="ltr">/{item.slug}</code></td><td className="cell-muted">{item.label || '—'}</td><td><span className={`admin-badge-status status-${item.status}`}>{serviceStatusLabels[item.status] ?? item.status}</span></td><td className="cell-order">{item.order}</td><td><span className={`admin-status ${item.published ? 'published' : 'draft'}`}>{item.published ? 'منشور' : 'مسودة'}</span></td><td className="cell-actions"><button className="admin-btn-action" onClick={() => setEditing(item)}>تعديل</button><button className="admin-btn-action danger" onClick={() => void archive(item)}>أرشفة</button></td></tr>)}</DataTable>}</main>;
}

function ServiceForm({ value, onSave, onCancel }: { value: Service; onSave: (value: Service) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(value); const [busy, setBusy] = useState(false); const set = <K extends keyof Service>(key: K, next: Service[K]) => setForm((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); await onSave(form); setBusy(false); };
  return <form className="admin-editor" onSubmit={submit}><div className="admin-editor-head"><h2>{form.id ? 'تعديل الخدمة' : 'إنشاء خدمة'}</h2><button type="button" onClick={onCancel}>إلغاء</button></div><div className="admin-form-grid"><Field label="العنوان"><input required value={form.title} onChange={(e) => set('title', e.target.value)} /></Field><Field label="Slug"><input dir="ltr" required value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></Field><Field label="الوصف المختصر" full><input required value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></Field><Field label="الوصف" full><textarea required rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field><Field label="الأيقونة"><select value={form.icon} onChange={(e) => set('icon', e.target.value as Service['icon'])}><option value="globe">موقع</option><option value="store">متجر</option><option value="dashboard">لوحة</option><option value="custom">مخصص</option><option value="integration">تكامل</option></select></Field><Field label="الترتيب"><input type="number" min="0" value={form.order} onChange={(e) => set('order', Number(e.target.value))} /></Field><Field label="الحالة"><select value={form.status} onChange={(e) => set('status', e.target.value as Service['status'])}><option value="draft">مسودة</option><option value="active">نشطة</option><option value="archived">مؤرشفة</option></select></Field><Field label="التسمية البصرية"><input required value={form.label} onChange={(e) => set('label', e.target.value)} /></Field><Field label="المشكلات — سطر لكل عنصر" full><textarea rows={3} value={(form.problem ?? []).join('\n')} onChange={(e) => set('problem', splitLines(e.target.value))} /></Field><Field label="القيمة — سطر لكل عنصر" full><textarea rows={3} value={form.value.join('\n')} onChange={(e) => set('value', splitLines(e.target.value))} /></Field><Field label="الأمثلة — سطر لكل عنصر" full><textarea rows={3} value={(form.examples ?? []).join('\n')} onChange={(e) => set('examples', splitLines(e.target.value))} /></Field><label className="admin-check"><input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />مميزة</label><label className="admin-check"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />منشورة للعامة</label></div><button className="admin-primary" disabled={busy}><Save size={17} />{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button></form>;
}

const emptyProject: Project = { id: '', slug: '', title: '', category: 'business-websites', status: 'concept', shortDescription: '', problem: '', context: '', solution: '', implementation: '', deliverables: [], resultLimits: '', heroImage: '/orkestrix-mark.png', heroMediaId: null, heroMedia: null, gallery: [], tags: [], featured: false, published: false, sortOrder: 0, createdAt: '', updatedAt: '' };
function ProjectsAdmin() {
  const [items, setItems] = useState<Project[]>([]); const [media, setMedia] = useState<MediaAsset[]>([]); const [editing, setEditing] = useState<Project | null>(null); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { const [projects, assets] = await Promise.all([api<{ data: Project[] }>('/api/admin/projects'), api<{ data: MediaAsset[] }>('/api/admin/media')]); setItems(projects.data); setMedia(assets.data); } catch (error) { setNotice({ kind: 'error', text: (error as Error).message }); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (project: Project & { galleryIds?: string[] }) => { try { await api(project.id ? `/api/admin/projects/${project.id}` : '/api/admin/projects', { method: project.id ? 'PUT' : 'POST', body: JSON.stringify({ ...project, galleryIds: project.galleryIds ?? project.gallery.map((item) => item.id) }) }); setNotice({ kind: 'success', text: 'حُفظ المشروع وتحدّثت حالة النشر.' }); setEditing(null); await load(); } catch (error) { setNotice({ kind: 'error', text: error instanceof ApiError && error.fields ? Object.values(error.fields)[0] : (error as Error).message }); } };
  const archive = async (project: Project) => { if (!confirm(`إلغاء نشر «${project.title}»؟`)) return; await api(`/api/admin/projects/${project.id}`, { method: 'DELETE' }); await load(); };
  return <main className="admin-page"><AdminHeader title="المشاريع" description="كل قصة مشروع تُدار من البيانات دون تعديل JSX." action={<button className="admin-primary" onClick={() => setEditing({ ...emptyProject })}>مشروع جديد</button>} />{notice && <NoticeView notice={notice} />}{editing && <ProjectForm value={editing} media={media} onSave={save} onCancel={() => setEditing(null)} />}{loading ? <AdminPageState text="جارٍ التحميل…" /> : <DataTable headers={['المشروع','المسار (Slug)','التصنيف','النوع','الترتيب','حالة النشر','الإجراءات']}>{items.map((item) => <tr key={item.id}><td className="cell-title"><strong>{item.title}</strong></td><td className="cell-slug"><code className="admin-slug" dir="ltr">/{item.slug}</code></td><td><span className={`admin-category-badge cat-${item.category}`}>{categoryLabels[item.category] ?? item.category}</span></td><td><span className={`admin-badge-type type-${item.status}`}>{statusLabels[item.status] ?? item.status}</span></td><td className="cell-order">{item.sortOrder}</td><td><span className={`admin-status ${item.archived ? 'archived' : item.published ? 'published' : 'draft'}`}>{item.archived ? 'مؤرشف' : item.published ? 'منشور' : 'مسودة'}</span></td><td className="cell-actions"><button className="admin-btn-action" onClick={() => setEditing(item)}>تعديل</button><button className="admin-btn-action danger" onClick={() => void archive(item)}>أرشفة</button></td></tr>)}</DataTable>}</main>;
}

function ProjectForm({ value, media, onSave, onCancel }: { value: Project; media: MediaAsset[]; onSave: (value: Project & { galleryIds: string[] }) => Promise<void>; onCancel: () => void }) {
  const originalSlug = value.slug;
  const [form, setForm] = useState(value); const [galleryIds, setGalleryIds] = useState(value.gallery.map((item) => item.id)); const [busy, setBusy] = useState(false); const set = <K extends keyof Project>(key: K, next: Project[K]) => setForm((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => { event.preventDefault(); if (value.published && originalSlug !== form.slug && !confirm('تغيير رابط مشروع منشور قد يؤثر في الروابط الخارجية. سيُحفظ الرابط القديم كإحالة آمنة. هل تريد المتابعة؟')) return; setBusy(true); await onSave({ ...form, galleryIds }); setBusy(false); };
  return <form className="admin-editor" onSubmit={submit}><div className="admin-editor-head"><h2>{form.id ? 'تعديل المشروع' : 'إنشاء مشروع'}</h2><button type="button" onClick={onCancel}>إلغاء</button></div><h3>الهوية</h3><div className="admin-form-grid"><Field label="العنوان"><input required value={form.title} onChange={(e) => set('title', e.target.value)} /></Field><Field label="Slug"><input dir="ltr" required value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></Field><Field label="التصنيف"><select value={form.category} onChange={(e) => set('category', e.target.value as Project['category'])}><option value="business-websites">مواقع الأعمال</option><option value="stores">المتاجر</option><option value="dashboards">لوحات الإدارة</option><option value="custom-systems">أنظمة مخصصة</option><option value="integrations">تكاملات</option></select></Field><Field label="الحالة"><select value={form.status} onChange={(e) => set('status', e.target.value as Project['status'])}><option value="live">حي</option><option value="concept">مفهوم</option><option value="demo">تجريبي</option><option value="internal">داخلي</option></select></Field></div><h3>الملخص والقصة</h3><div className="admin-form-grid"><Field label="الوصف المختصر" full><textarea required rows={2} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></Field><Field label="المشكلة" full><textarea required rows={3} value={form.problem} onChange={(e) => set('problem', e.target.value)} /></Field><Field label="السياق" full><textarea required rows={3} value={form.context} onChange={(e) => set('context', e.target.value)} /></Field><Field label="الحل" full><textarea required rows={3} value={form.solution} onChange={(e) => set('solution', e.target.value)} /></Field><Field label="التنفيذ" full><textarea required rows={3} value={form.implementation} onChange={(e) => set('implementation', e.target.value)} /></Field><Field label="المخرجات — سطر لكل عنصر" full><textarea rows={3} value={form.deliverables.join('\n')} onChange={(e) => set('deliverables', splitLines(e.target.value))} /></Field><Field label="النتيجة أو حدود النتيجة" full><textarea required rows={3} value={form.resultLimits} onChange={(e) => set('resultLimits', e.target.value)} /></Field></div><h3>العرض والنشر</h3><div className="admin-form-grid"><Field label="صورة Hero"><select value={form.heroMediaId ?? ''} onChange={(e) => set('heroMediaId', e.target.value || null)}><option value="">بدون صورة</option>{media.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}</select></Field><Field label="الترتيب"><input type="number" min="0" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></Field><Field label="الوسوم — سطر لكل وسم" full><textarea rows={2} value={form.tags.join('\n')} onChange={(e) => set('tags', splitLines(e.target.value))} /></Field><Field label="معرض الصور" full><div className="admin-media-select">{media.map((item) => <label key={item.id}><input type="checkbox" checked={galleryIds.includes(item.id)} onChange={(e) => setGalleryIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><img src={item.url} alt={item.altText} /><span>{item.fileName}</span></label>)}</div></Field><Field label="العميل — اختياري"><input value={form.client ?? ''} onChange={(e) => set('client', e.target.value || undefined)} /></Field><Field label="السنة — اختياري"><input type="number" value={form.year ?? ''} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : undefined)} /></Field><Field label="الرابط الحي — اختياري" full><input dir="ltr" type="url" value={form.liveUrl ?? ''} onChange={(e) => set('liveUrl', e.target.value || undefined)} /></Field><label className="admin-check"><input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />مشروع مميز</label><label className="admin-check"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />منشور للعامة</label></div><button className="admin-primary" disabled={busy}><Save size={17} />{busy ? 'جارٍ الحفظ…' : 'حفظ المشروع'}</button></form>;
}

function LeadsAdmin() {
  const [items, setItems] = useState<Lead[]>([]); const [selected, setSelected] = useState<Lead | null>(null); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [notice, setNotice] = useState<Notice>(null);
  const load = useCallback(async () => { try { const result = await api<{ data: Lead[] }>(`/api/admin/leads?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`); setItems(result.data); } catch (error) { setNotice({ kind: 'error', text: (error as Error).message }); } }, [search, status]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => { if (!selected) return; await api(`/api/admin/leads/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status: selected.status, internalNotes: selected.internalNotes }) }); setNotice({ kind: 'success', text: 'حُدّثت حالة الطلب وسُجل التغيير.' }); await load(); };
  const statusOptions = [
    { value: 'new', label: 'جديد' },
    { value: 'contacted', label: 'تم التواصل' },
    { value: 'qualified', label: 'مؤهل' },
    { value: 'proposal', label: 'عرض مقدم' },
    { value: 'won', label: 'تم الاتفاق' },
    { value: 'lost', label: 'ملغي' },
  ];
  return <main className="admin-page"><AdminHeader title="طلبات المشاريع" description="ابحث، راجع السياق، وحدد الخطوة التالية لكل طلب." />{notice && <NoticeView notice={notice} />}<div className="admin-toolbar"><input type="search" placeholder="بحث بالاسم أو النشاط أو وسيلة التواصل" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">كل الحالات</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="admin-two-columns leads"><section className="admin-panel"><div className="admin-list">{items.map((lead) => <button className={selected?.id === lead.id ? 'selected' : ''} key={lead.id} onClick={() => setSelected(lead)}><span><strong>{lead.name}</strong><small>{lead.businessName} · {new Date(lead.createdAt).toLocaleDateString('ar')}</small></span><b className={`admin-lead-status status-${lead.status}`}>{leadStatusLabels[lead.status] ?? lead.status}</b></button>)}</div></section><section className="admin-panel">{selected ? <div className="lead-detail"><span className="admin-kicker">ما الذي يجب فعله الآن؟</span><h2>{selected.name}</h2><p><strong>المشروع:</strong> {selected.projectType} <span className={`admin-lead-status status-${selected.status}`}>{leadStatusLabels[selected.status] ?? selected.status}</span></p><p>{selected.idea}</p><dl><div><dt>النشاط</dt><dd>{selected.businessName}</dd></div><div><dt>التواصل</dt><dd>{selected.preferredChannel}: <a href={selected.preferredChannel === 'البريد الإلكتروني' ? `mailto:${selected.contactValue}` : `tel:${selected.contactValue}`}>{selected.contactValue}</a></dd></div><div><dt>المصدر</dt><dd>{selected.source === 'public-website' ? 'الموقع العام' : selected.source}</dd></div></dl><Field label="الحالة"><select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="ملاحظات داخلية"><textarea rows={5} value={selected.internalNotes} onChange={(e) => setSelected({ ...selected, internalNotes: e.target.value })} /></Field><button className="admin-primary" onClick={() => void save()}>حفظ المتابعة</button></div> : <p className="admin-empty">اختر طلبًا لعرض التفاصيل والخطوة التالية.</p>}</section></div></main>;
}

function MediaAdmin() {
  const [items, setItems] = useState<MediaAsset[]>([]); const [file, setFile] = useState<File | null>(null); const [alt, setAlt] = useState(''); const [notice, setNotice] = useState<Notice>(null);
  const load = useCallback(() => api<{ data: MediaAsset[] }>('/api/admin/media').then((result) => setItems(result.data)).catch((error) => setNotice({ kind: 'error', text: error.message })), []); useEffect(() => { void load(); }, [load]);
  const upload = async (event: FormEvent) => { event.preventDefault(); if (!file) return; const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = reject; reader.readAsDataURL(file); }); try { await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type, altText: alt, base64 }) }); setFile(null); setAlt(''); setNotice({ kind: 'success', text: 'رُفعت الصورة بأمان وأصبحت متاحة للاختيار.' }); await load(); } catch (error) { setNotice({ kind: 'error', text: (error as Error).message }); } };
  const remove = async (item: MediaAsset) => { if (!confirm(`حذف ${item.fileName}؟`)) return; try { await api(`/api/admin/media/${item.id}`, { method: 'DELETE' }); await load(); } catch (error) { setNotice({ kind: 'error', text: (error as Error).message }); } };
  return <main className="admin-page"><AdminHeader title="الوسائط" description="رفع صور آمنة وربطها بالمشاريع دون بناء مكتبة أصول معقدة." />{notice && <NoticeView notice={notice} />}<form className="admin-upload" onSubmit={upload}><Field label="الصورة PNG / JPEG / WebP حتى 5MB"><input required type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field><Field label="النص البديل"><input required value={alt} onChange={(e) => setAlt(e.target.value)} /></Field><button className="admin-primary">رفع</button></form><section className="admin-media-grid">{items.map((item) => <article key={item.id}><img src={item.url} alt={item.altText} /><div><strong>{item.fileName}</strong><small>{item.altText}</small><button className="danger" onClick={() => void remove(item)}>حذف آمن</button></div></article>)}</section></main>;
}

function SettingsAdmin() {
  const [form, setForm] = useState({ contactChannels: [] as string[], footerContact: '', defaultSocialImage: '/orkestrix-mark.png', domain: 'https://orkestrix.site' }); const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => { api<{ data: Record<string, string> }>('/api/admin/settings').then(({ data }) => setForm({ contactChannels: JSON.parse(data.contactChannels || '[]'), footerContact: data.footerContact || '', defaultSocialImage: data.defaultSocialImage || '/orkestrix-mark.png', domain: data.domain || 'https://orkestrix.site' })).catch((error) => setNotice({ kind: 'error', text: error.message })); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(form) }); setNotice({ kind: 'success', text: 'حُفظت الإعدادات العامة وسُجل التغيير.' }); } catch (error) { setNotice({ kind: 'error', text: (error as Error).message }); } };
  return <main className="admin-page"><AdminHeader title="إعدادات الموقع" description="الإعدادات التشغيلية العامة فقط؛ الهوية الأساسية مقفلة." />{notice && <NoticeView notice={notice} />}<form className="admin-editor" onSubmit={submit}><div className="admin-form-grid"><Field label="الدومين الرسمي"><input dir="ltr" type="url" required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></Field><Field label="صورة المشاركة الافتراضية"><input dir="ltr" required value={form.defaultSocialImage} onChange={(e) => setForm({ ...form, defaultSocialImage: e.target.value })} /></Field><Field label="بيانات تواصل التذييل" full><textarea rows={3} value={form.footerContact} onChange={(e) => setForm({ ...form, footerContact: e.target.value })} /></Field><Field label="قنوات التواصل — سطر لكل قناة" full><textarea rows={4} value={form.contactChannels.join('\n')} onChange={(e) => setForm({ ...form, contactChannels: splitLines(e.target.value) })} /></Field></div><button className="admin-primary"><Save size={17} />حفظ الإعدادات</button></form></main>;
}

function AuditList({ items }: { items: Audit[] }) { return items.length ? <div className="admin-activity">{items.map((item) => <div key={item.id}><span>{auditActionLabels[item.action] ?? item.action}</span><small>{auditEntityLabels[item.entityType] ?? item.entityType} · {item.actorEmail ?? 'النظام'} · {new Date(item.createdAt).toLocaleString('ar')}</small></div>)}</div> : <p className="admin-empty">لا يوجد نشاط مسجل.</p>; }
function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function AdminPageState({ text, error = false }: { text: string; error?: boolean }) { return <div className={`admin-page-state ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{text}</div>; }

function useAdminPath() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, '') || '/admin');
  useEffect(() => {
    const handler = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/admin');
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return path;
}

export function AdminApp() {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ user: User }>('/api/auth/session').then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const path = useAdminPath();
  if (loading) return <AdminPageState text="جارٍ التحقق من الجلسة…" />;
  if (!user) return path === '/admin/login' ? <AdminLogin onLogin={setUser} /> : <main className="admin-auth" dir="rtl"><div className="admin-auth-card"><h1>غير مصرح</h1><p>هذه المساحة محمية بجلسة خادمية.</p><a className="admin-primary" href="/admin/login">تسجيل الدخول</a><a href="/">العودة للموقع</a></div></main>;
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); window.location.href = '/admin/login'; };
  let page: ReactNode = <DashboardAdmin />;
  if (path === '/admin/services') page = <ServicesAdmin />; else if (path === '/admin/projects') page = <ProjectsAdmin />; else if (path === '/admin/leads') page = <LeadsAdmin />; else if (path === '/admin/media') page = <MediaAdmin />; else if (path === '/admin/settings') page = <SettingsAdmin />;
  return <AdminShell user={user} logout={() => void logout()}>{page}</AdminShell>;
}
