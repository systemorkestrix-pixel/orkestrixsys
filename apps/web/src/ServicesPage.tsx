import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  ChevronDown,
  CircleDot,
  Globe2,
  LayoutDashboard,
  Link2,
  Menu,
  Network,
  PanelsTopLeft,
  ShoppingBag,
  X,
} from 'lucide-react';
import { type Service } from './data/services';
import { usePageMeta } from './lib/site-meta';
import { usePublicServices } from './lib/api';

const serviceIcons = { globe: Globe2, store: ShoppingBag, dashboard: LayoutDashboard, custom: PanelsTopLeft, integration: Network } as const;
const serviceNumber = (service: Service) => String(service.order).padStart(2, '0');

const delivery = ['التخطيط', 'التصميم', 'التطوير', 'البيانات', 'الإدارة', 'الربط', 'الدومين', 'الاستضافة', 'الأمان', 'النشر', 'التشغيل'];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand service-brand ${compact ? 'brand-compact' : ''}`} href="/" data-testid={compact ? 'link-service-brand' : 'link-footer-brand'}>
      <img src="/orkestrix-mark.png" alt="شعار أوركستريكس" />
      <span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span>
    </a>
  );
}

function ServicesHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header service-header">
      <div className="nav-wrap">
        <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} data-testid="button-services-menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Brand compact />
        <nav className={`main-nav ${menuOpen ? 'menu-open' : ''}`} aria-label="التنقل الرئيسي">
          <a href="/services" className="active-nav" aria-current="page" onClick={() => setMenuOpen(false)} data-testid="link-services-current">ما نبنيه</a>
          <a href="/projects" onClick={() => setMenuOpen(false)} data-testid="link-services-projects">نماذج الحلول</a>
          <a href="/#journey" onClick={() => setMenuOpen(false)} data-testid="link-services-journey">رحلتك</a>
          <a href="/#principles" onClick={() => setMenuOpen(false)} data-testid="link-services-principles">طريقتنا</a>
          <a href="/#faq" onClick={() => setMenuOpen(false)} data-testid="link-services-faq">الأسئلة الشائعة</a>
        </nav>
        <a className="nav-cta" href="/contact" data-testid="link-services-header-overview">ابدأ مشروعك <ArrowLeft size={16} /></a>
      </div>
    </header>
  );
}

function SystemComposition() {
  return (
    <div className="service-composition" aria-label="تصور بصري لخمس منظومات مترابطة" data-testid="visual-services-system">
      <div className="composition-orbit composition-orbit-one" />
      <div className="composition-orbit composition-orbit-two" />
      <div className="composition-line line-one" />
      <div className="composition-line line-two" />
      <div className="composition-line line-three" />
      <div className="system-core">
        <span className="core-kicker">نظام متكامل</span>
        <strong>كل شيء<br /><em>في مكانه.</em></strong>
        <div className="core-bars"><i /><i /><i /><i /></div>
        <small><span /> منظومة جاهزة للعمل</small>
      </div>
      <div className="system-module module-site"><Globe2 size={18} /><span>موقع الأعمال</span><b>01</b></div>
      <div className="system-module module-shop"><ShoppingBag size={18} /><span>المتجر</span><b>02</b></div>
      <div className="system-module module-admin"><LayoutDashboard size={18} /><span>الإدارة</span><b>03</b></div>
      <div className="system-module module-custom"><PanelsTopLeft size={18} /><span>نظام مخصص</span><b>04</b></div>
      <div className="system-module module-link"><Link2 size={18} /><span>الربط</span><b>05</b></div>
      <div className="composition-tag tag-system-top"><CircleDot size={12} /> حلول متصلة</div>
      <div className="composition-tag tag-system-bottom">من الحاجة إلى الحل <ArrowUpLeft size={13} /></div>
    </div>
  );
}

function ServiceCue({ service, compact = false }: { service: Service; compact?: boolean }) {
  const Icon = serviceIcons[service.icon];
  return (
    <div className={`service-cue cue-${service.color} ${compact ? 'cue-compact' : ''}`} aria-hidden="true">
      <div className="cue-window">
        <div className="cue-window-top"><i /><i /><i /><span>{serviceNumber(service)}</span></div>
        <div className="cue-window-body">
          <Icon size={compact ? 18 : 27} strokeWidth={1.3} />
          <div className="cue-lines"><i /><i /><i /></div>
        </div>
      </div>
      {!compact && <span className="cue-caption">{service.label}</span>}
    </div>
  );
}

function ServiceOverview({ service, index }: { service: Service; index: number }) {
  return (
    <a className={`overview-row overview-row-${service.color}`} href={`#service-${service.slug}`} data-testid={`link-overview-service-${serviceNumber(service)}`}>
      <span className="overview-number">{serviceNumber(service)}</span>
      <span className="overview-title">{service.title}</span>
      <span className="overview-sentence">{service.shortDescription}</span>
      <ServiceCue service={service} compact />
      <span className="overview-explore">استكشف <ArrowUpLeft size={16} /></span>
      <span className="overview-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    </a>
  );
}

function ServiceDetail({ service, index }: { service: Service; index: number }) {
  return (
    <article className={`detail-section container detail-${service.color}`} id={`service-${service.slug}`} data-reveal>
      <div className="detail-index"><span>{serviceNumber(service)}</span><i /></div>
      <div className="detail-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> {service.label}</div>
        <h2>{service.title}</h2>
        <p className="detail-message">{service.description}</p>
        {service.problem && (
          <div className="detail-problem">
            <span className="detail-label">ما الذي يحله؟</span>
            <div className="problem-list">{service.problem.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
        )}
        {service.examples && (
          <div className="detail-problem">
            <span className="detail-label">أمثلة مناسبة</span>
            <div className="problem-list">{service.examples.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
        )}
        {service.order === 4 && <p className="scope-note">حسب احتياجات المشروع ونطاقه.</p>}
        <a className="button button-primary detail-cta" href="/contact" data-testid={`link-detail-chooser-${serviceNumber(service)}`}>ابدأ مشروعك <ArrowLeft size={17} /></a>
      </div>
      <div className="detail-visual">
        <ServiceCue service={service} />
        <div className="value-panel">
          <span className="detail-label">{service.order === 1 ? 'ما يحصل عليه العميل' : service.order === 2 ? 'محاور المتجر' : service.order === 3 ? 'أمثلة الاستخدام' : service.order === 4 ? 'مساحات يمكن تنظيمها' : 'أدوات يمكن وصلها'}</span>
          <div className="value-list">{service.value.map((item, itemIndex) => <span key={item}><b>{String(itemIndex + 1).padStart(2, '0')}</b>{item}</span>)}</div>
        </div>
      </div>
      <span className="detail-side-note">أوركستريكس / {String(index + 1).padStart(2, '0')}</span>
    </article>
  );
}

function ServicesPage() {
  const { data: serviceItems, loading, error, reload } = usePublicServices();
  usePageMeta({ title: 'الخدمات | Orkestrix Systems', description: 'خدمات بناء المواقع والأنظمة الرقمية ولوحات الإدارة والمتاجر والتكاملات للأعمال.', path: '/services' });
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.08 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [serviceItems]);
  return (
    <div className="site-shell services-page" dir="rtl">
      <a className="skip-link" href="#services-main">تجاوز إلى المحتوى</a>
      <ServicesHeader />
      <main id="services-main">
        <section className="services-hero container" data-reveal>
          <div className="services-hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> ما يمكننا بناؤه لك</div>
            <h1>نبني ما يحتاجه<br /><em>عملك.</em></h1>
            <p>من موقع احترافي إلى نظام رقمي متكامل، نختار معك الحل المناسب لطبيعة نشاطك واحتياجاتك.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="/contact" data-testid="link-services-hero-overview">ابدأ مشروعك <ArrowLeft size={18} /></a>
              <a className="text-link" href="/projects" data-testid="link-services-hero-projects">استكشف أعمالنا <ArrowUpLeft size={17} /></a>
            </div>
            <div className="hero-note"><span className="pulse-dot" /> كل مشروع يمر بمنهج Orkestrix من الفكرة إلى التشغيل</div>
          </div>
          <SystemComposition />
        </section>

        <section className="overview-section" id="overview" data-reveal>
          <div className="container">
            <div className="section-heading-row overview-heading">
              <div><div className="eyebrow"><span className="eyebrow-line" /> اختر الاتجاه</div><h2>ماذا يمكن<br /><em>أن نبني لك؟</em></h2></div>
              <p>خمس فئات واضحة. اختر الأقرب إلى احتياجك، أو ابدأ معنا من المشكلة نفسها.</p>
            </div>
            <div className="overview-list" role="list" aria-label="فئات الخدمات">
              {loading && <div className="public-data-state" role="status">جارٍ تحميل الخدمات…</div>}
              {!loading && error && <div className="public-data-state" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => void reload()}>إعادة المحاولة</button></div>}
              {!loading && !error && serviceItems.length === 0 && <div className="public-data-state"><p>لا توجد خدمات منشورة حاليًا.</p><a className="text-link" href="/contact">ابدأ مشروعك <ArrowLeft size={17} /></a></div>}
              {serviceItems.map((service, index) => <ServiceOverview key={service.id} service={service} index={index} />)}
            </div>
          </div>
        </section>

        <section className="details-wrap" aria-label="تفاصيل الخدمات">
          {serviceItems.map((service, index) => <ServiceDetail key={service.id} service={service} index={index} />)}
        </section>

        <section className="chooser-section" id="chooser" data-reveal>
          <div className="container">
            <div className="chooser-heading">
              <div className="eyebrow"><span className="eyebrow-line" /> لا توجد إجابة خاطئة</div>
              <h2>لا تعرف ما الذي<br /><em>تحتاجه؟</em></h2>
              <p>لا تحتاج إلى اختيار الحل قبل أن تتحدث معنا. أخبرنا بما تريد تحقيقه، وسنساعدك على تحديد المسار المناسب.</p>
            </div>
            <div className="chooser-options">
              <a href="#delivery" className="chooser-option" data-testid="link-chooser-idea"><span>01</span><strong>لدي فكرة</strong><small>أريد معرفة ما أحتاجه.</small><ArrowUpLeft size={17} /></a>
              <a href="#delivery" className="chooser-option" data-testid="link-chooser-existing"><span>02</span><strong>لدي نشاط قائم</strong><small>أريد تطوير وجودي أو طريقة عملي.</small><ArrowUpLeft size={17} /></a>
              <a href="#delivery" className="chooser-option" data-testid="link-chooser-ready"><span>03</span><strong>أعرف ما أريد</strong><small>أريد بدء التنفيذ.</small><ArrowUpLeft size={17} /></a>
            </div>
          </div>
        </section>

        <section className="delivery-section" id="delivery" data-reveal>
          <div className="container delivery-layout">
            <div className="delivery-intro">
              <div className="eyebrow"><span className="eyebrow-line" /> ما تحصل عليه</div>
              <h2>أيًا كان الحل،<br /><em>نأخذه حتى يصبح<br />جاهزًا للعمل.</em></h2>
              <p>لا تتوقف الخدمة عند التصميم أو الكود. نكمل الصورة التي يحتاجها التشغيل الفعلي.</p>
            </div>
            <div className="delivery-sequence" role="list" aria-label="تسلسل تسليم المشروع">
              {delivery.map((step, index) => <div className="delivery-step" key={step} role="listitem"><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong>{index < delivery.length - 1 && <i aria-hidden="true" />}</div>)}
            </div>
          </div>
        </section>

        <section className="services-final-cta" data-reveal>
          <div className="cta-grid-lines" />
          <div className="container final-cta-inner">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> الخطوة الأولى بسيطة</div>
            <h2>لديك فكرة وتريد<br /><em>معرفة الطريق المناسب؟</em></h2>
            <p>أخبرنا بما تريد بناءه، وسنبدأ من فهم المشروع.</p>
            <a className="button button-light" href="/contact" data-testid="link-services-final-projects">ابدأ مشروعك <ArrowLeft size={18} /></a>
            <small>يمكنك أولاً <a className="quiet-contact" href="/projects">استكشاف أعمالنا</a> قبل بدء الطلب.</small>
          </div>
        </section>
      </main>
      <ServicesFooter />
    </div>
  );
}

function ServicesFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top"><Brand /><div className="footer-copy">من الفكرة إلى نظام يعمل.<br />نبني الوضوح في كل خطوة.</div><div className="footer-nav"><a href="/services" data-testid="link-footer-services-page">ما نبنيه</a><a href="/projects" data-testid="link-footer-projects-page">استكشف أعمالنا</a><a href="/contact" data-testid="link-footer-contact-page">ابدأ مشروعك</a></div></div>
      <div className="container footer-bottom"><span>© 2026 Orkestrix Systems</span><span>أنظمة رقمية تبدأ من فهم حقيقي</span><a href="#services-main" aria-label="العودة إلى أعلى الصفحة" data-testid="link-services-back-top"><ArrowUpLeft size={17} /></a></div>
    </footer>
  );
}

export { ServicesPage };
