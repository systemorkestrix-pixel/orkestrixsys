import { ArrowLeft, ArrowUpLeft, Check, Menu, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { submitProjectRequest, validateProjectRequest, type ProjectRequest } from './lib/project-request';
import { usePageMeta } from './lib/site-meta';

const initialRequest: ProjectRequest = { name: '', businessName: '', projectType: '', idea: '', preferredContactMethod: '', contactDetails: '', website: '' };

export function ContactPage() {
  const [request, setRequest] = useState<ProjectRequest>(initialRequest);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectRequest, string>>>({});
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState('');
  usePageMeta({ title: 'ابدأ مشروعك | Orkestrix Systems', description: 'أرسل طلب مشروع إلى Orkestrix Systems لنفهم احتياجك ونحدد المسار المناسب.', path: '/contact' });

  const update = (key: keyof ProjectRequest, value: string) => setRequest((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateProjectRequest(request);
    setErrors(validation);
    setMessage('');
    if (Object.keys(validation).length) return;
    setState('submitting');
    try {
      const result = await submitProjectRequest(request);
      setRequestId(result.requestId);
      setState('success');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'لم يتم إرسال الطلب. حاول مرة أخرى لاحقًا.');
    }
  };

  return <div className="site-shell contact-request-page" dir="rtl">
    <a className="skip-link" href="#contact-main">تجاوز إلى المحتوى</a>
    <header className="site-header"><div className="nav-wrap"><button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button><a className="brand brand-compact" href="/" aria-label="العودة للرئيسية"><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span></a><nav className={`main-nav ${menuOpen ? 'menu-open' : ''}`} aria-label="التنقل الرئيسي"><a href="/services" onClick={() => setMenuOpen(false)}>ما نبنيه</a><a href="/projects" onClick={() => setMenuOpen(false)}>أعمالنا</a><a href="/#journey" onClick={() => setMenuOpen(false)}>رحلتك</a><a href="/#faq" onClick={() => setMenuOpen(false)}>الأسئلة الشائعة</a></nav><a className="nav-cta active-contact-cta" aria-current="page" href="/contact">ابدأ مشروعك <ArrowLeft size={16} /></a></div></header>
    <main id="contact-main" className="contact-main"><div className="container contact-layout"><section className="contact-intro"><div className="eyebrow"><span className="eyebrow-line" /> طلب مشروع</div><h1>ابدأ من الفكرة.<br /><em>ونرتب الطريق.</em></h1><p>اشرح احتياجك كما هو. لا تحتاج إلى معرفة التفاصيل التقنية أو اختيار الحل النهائي قبل البدء.</p><div className="contact-steps"><span>01 اشرح الفكرة</span><span>02 نراجع السياق</span><span>03 نحدد الخطوة المناسبة</span></div><a className="text-link" href="/projects">استكشف أعمالنا أولاً <ArrowUpLeft size={17} /></a></section>
      <section className="contact-form-panel" aria-labelledby="request-form-title"><h2 id="request-form-title">بيانات الطلب</h2><p>نطلب الحد الأدنى من المعلومات لفهم المشروع. لا تظهر رسالة نجاح إلا بعد تأكيد وجهة الاستقبال.</p>{state === 'success' ? <div className="contact-success" role="status"><span><Check size={22} /></span><h3>تم استلام طلبك بنجاح.</h3><p>رقم الطلب: <strong dir="ltr">{requestId}</strong></p><a className="button button-primary" href="/projects">استكشف أعمالنا <ArrowLeft size={17} /></a></div> : <form onSubmit={submit} noValidate><div className="contact-fields"><label>الاسم<input value={request.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} />{errors.name && <small>{errors.name}</small>}</label><label>اسم النشاط<input value={request.businessName} onChange={(event) => update('businessName', event.target.value)} autoComplete="organization" aria-invalid={Boolean(errors.businessName)} />{errors.businessName && <small>{errors.businessName}</small>}</label><label>نوع المشروع<select value={request.projectType} onChange={(event) => update('projectType', event.target.value)} aria-invalid={Boolean(errors.projectType)}><option value="">اختر النوع</option><option>موقع</option><option>متجر</option><option>لوحة إدارة</option><option>نظام مخصص</option><option>تكاملات وأتمتة</option><option>غير متأكد</option></select>{errors.projectType && <small>{errors.projectType}</small>}</label><label>وسيلة التواصل المفضلة<select value={request.preferredContactMethod} onChange={(event) => update('preferredContactMethod', event.target.value)} aria-invalid={Boolean(errors.preferredContactMethod)}><option value="">اختر الوسيلة</option><option>البريد الإلكتروني</option><option>الهاتف</option><option>واتساب</option></select>{errors.preferredContactMethod && <small>{errors.preferredContactMethod}</small>}</label><label className="contact-field-full">بيانات التواصل<input value={request.contactDetails} onChange={(event) => update('contactDetails', event.target.value)} autoComplete="email" placeholder="البريد أو رقم الهاتف" aria-invalid={Boolean(errors.contactDetails)} />{errors.contactDetails && <small>{errors.contactDetails}</small>}</label><label className="contact-field-full">وصف الفكرة<textarea rows={5} value={request.idea} onChange={(event) => update('idea', event.target.value)} aria-invalid={Boolean(errors.idea)} placeholder="ما الذي تريد تحسينه أو بناؤه؟" />{errors.idea && <small>{errors.idea}</small>}</label><label className="honeypot" aria-hidden="true">لا تملأ هذا الحقل<input tabIndex={-1} autoComplete="off" value={request.website} onChange={(event) => update('website', event.target.value)} /></label></div>{state === 'error' && <p className="contact-error" role="alert">لم يتم إرسال الطلب. {message}</p>}<button className="button button-primary" type="submit" disabled={state === 'submitting'}>{state === 'submitting' ? 'جارٍ الإرسال…' : 'إرسال طلب المشروع'} <ArrowLeft size={17} /></button><small className="contact-privacy">تُستخدم هذه المعلومات لمراجعة طلب المشروع فقط. لا توجد سياسة خصوصية منشورة بعد.</small></form>}</section></div></main>
    <footer className="site-footer">
      <div className="container footer-top">
        <a className="brand brand-compact" href="/"><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span></a>
        <div className="footer-copy">من الفكرة إلى نظام يعمل.<br />نبني الوضوح في كل خطوة.</div>
        <div className="footer-nav"><a href="/services">ما نبنيه</a><a href="/projects">استكشف أعمالنا</a><a href="/contact">ابدأ مشروعك</a></div>
      </div>
      <div className="container footer-bottom contact-footer"><span>© 2026 Orkestrix Systems</span><a href="/projects">استكشف أعمالنا</a></div>
    </footer>
  </div>;
}
