import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  CircleDot,
  Clock3,
  Database,
  Globe2,
  Layers3,
  Menu,
  Monitor,
  MoveUpLeft,
  Network,
  PanelTop,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { ServicesPage } from './ServicesPage';
import { ProjectsPage } from './ProjectsPage';
import { ContactPage } from './ContactPage';
import NotFound from './pages/not-found';
import { usePageMeta } from './lib/site-meta';
import { usePublicServices } from './lib/api';
import { ProjectDetailsPage } from './components/project-detail-template';
import { AdminApp } from './AdminApp';

type JourneyStage = {
  name: string;
  number: string;
  title: string;
  description: string;
  icon: typeof CircleDot;
};

const journey: JourneyStage[] = [
  { name: 'فكرة', number: '01', title: 'نسمع الفكرة كما هي', description: 'نرتب الصورة الأولى، نسأل الأسئلة الصحيحة، ونحوّل الحدس إلى اتجاه قابل للبناء.', icon: Sparkles },
  { name: 'تخطيط', number: '02', title: 'نرسم النظام قبل تفاصيله', description: 'نحدد الأولويات، المستخدمين، ومسار العمل حتى تعرف ما الذي سيُبنى ولماذا.', icon: Layers3 },
  { name: 'تصميم', number: '03', title: 'تجربة واضحة من أول نقرة', description: 'نصمم واجهة تفهم نشاطك وتُشعر فريقك أن كل شيء في مكانه.', icon: Monitor },
  { name: 'تطوير', number: '04', title: 'نحوّل المخطط إلى منتج', description: 'نبني الأساس البرمجي المتين الذي يستوعب التشغيل الحقيقي، لا مجرد نسخة تجريبية.', icon: PanelTop },
  { name: 'بيانات', number: '05', title: 'المعلومة في وقتها', description: 'ننظم البيانات ونربطها لتصبح أساسًا للقرار، لا عبئًا موزعًا بين الملفات.', icon: Database },
  { name: 'إدارة', number: '06', title: 'تحكم أسهل لفريقك', description: 'لوحات وأدوات إدارة تمنح كل شخص رؤية واضحة ومساحة عمل عملية.', icon: Layers3 },
  { name: 'ربط', number: '07', title: 'النظام لا يعمل وحده', description: 'نصل خدماتك الحالية ببعضها لتختفي الخطوات المكررة من يومك.', icon: Network },
  { name: 'دومين', number: '08', title: 'عنوان يليق بالمشروع', description: 'نجهز حضورك الرقمي ليكون واضحًا، مملوكًا لك، وجاهزًا للوصول.', icon: Globe2 },
  { name: 'استضافة', number: '09', title: 'مكان ثابت وآمن', description: 'نختار البنية المناسبة لتشغيل مشروعك بثبات اليوم وقابلية التوسع غدًا.', icon: Globe2 },
  { name: 'أمان', number: '10', title: 'نحمي ما بنيته', description: 'نضع أساسيات الأمان والنسخ الاحتياطي والصلاحيات ضمن النظام منذ البداية.', icon: ShieldCheck },
  { name: 'نشر', number: '11', title: 'من بيئتنا إلى جمهورك', description: 'نختبر، نراجع، ثم نطلق المشروع بهدوء ومنهجية واضحة.', icon: ArrowUpLeft },
  { name: 'تشغيل ودعم', number: '12', title: 'لا نختفي بعد الإطلاق', description: 'نراقب، نُحسّن، ونبقى قريبين عندما يبدأ النظام في العمل فعليًا.', icon: Clock3 },
];

const homeServiceIcons = { globe: Globe2, store: PanelTop, dashboard: Monitor, custom: Layers3, integration: Network } as const;

const faqs = [
  { question: 'هل يجب أن أعرف كيف سيُبنى المشروع؟', answer: 'لا. يكفي أن تعرف ما الذي تريد تحسينه أو ما الفرصة التي تراها. نحن نساعدك على تحويل الفكرة إلى نطاق واضح، ثم نتولى القرارات التقنية والتنفيذية معك.' },
  { question: 'هل تعملون على مشروع جديد فقط؟', answer: 'نعمل على الاثنين. يمكننا البدء من صفحة بيضاء، أو ترتيب نظام قائم يحتاج إلى تطوير أو ربط أو تشغيل أكثر استقرارًا.' },
  { question: 'ماذا يحدث بعد الإطلاق؟', answer: 'الإطلاق ليس آخر المحطات. نتابع التشغيل، نعالج الملاحظات، ونقترح التحسينات التي تجعل النظام مناسبًا لنمو نشاطك.' },
  { question: 'كيف أبدأ معكم؟', answer: 'أرسل لنا فكرة مختصرة عن مشروعك. نقرأها، نفهم السياق، ثم نعود إليك بخطوة أولى واضحة ومناسبة.' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`} data-testid="brand-orkestrix">
      <img src="/orkestrix-mark.png" alt="شعار أوركستريكس" />
      <span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span>
    </div>
  );
}

function Homepage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { data: services, loading: servicesLoading, error: servicesError, reload: reloadServices } = usePublicServices();
  usePageMeta({ title: 'Orkestrix Systems | من الفكرة إلى التشغيل', description: 'نبني أنظمة رقمية للأعمال، من الفكرة والتخطيط إلى الإطلاق والتشغيل.', path: '/' });

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.12 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const goTo = (id: string) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  return (
    <div className="site-shell" dir="rtl">
      <a className="skip-link" href="#main-content">تجاوز إلى المحتوى</a>
      <header className="site-header">
        <div className="nav-wrap">
          <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} data-testid="button-mobile-menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Brand compact />
          <nav className={`main-nav ${menuOpen ? 'menu-open' : ''}`} aria-label="التنقل الرئيسي">
            <a href="/services" onClick={() => setMenuOpen(false)} data-testid="link-services">ما نبنيه</a>
            <a href="/projects" onClick={() => setMenuOpen(false)} data-testid="link-projects">نماذج الحلول</a>
            <button onClick={() => goTo('journey')} data-testid="link-journey">رحلتك</button>
            <button onClick={() => goTo('principles')} data-testid="link-principles">طريقتنا</button>
            <button onClick={() => goTo('faq')} data-testid="link-faq">الأسئلة الشائعة</button>
          </nav>
          <a className="nav-cta" href="/contact" data-testid="link-nav-services">ابدأ مشروعك <ArrowLeft size={16} /></a>
        </div>
      </header>

      <main id="main-content">
        <section className="hero section-grid" data-reveal>
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> أنظمة تُبنى حول واقعك</div>
            <h1>لديك فكرة.<br /><em>نحن نحولها</em><br />إلى نظام يعمل.</h1>
            <p className="hero-lead">من أول تصور للمشروع إلى الإطلاق والتشغيل. لا تحتاج إلى معرفة كيف سيُبنى المشروع — تحتاج فقط إلى بداية واضحة.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="/contact" data-testid="link-hero-services">ابدأ مشروعك <ArrowLeft size={18} /></a>
              <a className="text-link" href="/projects" data-testid="button-hero-journey">استكشف أعمالنا <ArrowUpLeft size={17} /></a>
            </div>
            <div className="hero-note"><span className="pulse-dot" /> نرافقك من الفكرة حتى التشغيل</div>
          </div>
          <div className="hero-visual" aria-label="تصور بصري لنظام مترابط" data-testid="visual-connected-system">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="connection connection-a" />
            <div className="connection connection-b" />
            <div className="surface surface-main">
              <div className="surface-top"><span className="surface-label">نظرة عامة</span><span className="surface-dots">•••</span></div>
              <div className="surface-title">نظامك في صورة واحدة</div>
              <div className="metric-row"><div><span>الطلبات</span><strong>1,284</strong></div><div><span>قيد المتابعة</span><strong>36</strong></div></div>
              <div className="chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <div className="surface-footer"><span className="mini-status" /> البيانات تتصل بسلاسة</div>
            </div>
            <div className="surface surface-mobile">
              <div className="mobile-notch" />
              <div className="mobile-screen"><span className="mobile-icon"><Check size={13} /></span><b>تمت العملية</b><small>الطلب جاهز للمتابعة</small><div className="mobile-bar" /></div>
            </div>
            <div className="surface surface-admin">
              <div className="admin-rail"><span /><span /><span /></div>
              <div className="admin-content"><div className="admin-heading" /><div className="admin-blocks"><i /><i /><i /></div></div>
            </div>
            <div className="visual-tag tag-top"><CircleDot size={13} /> من الفكرة</div>
            <div className="visual-tag tag-bottom">إلى التشغيل <ArrowLeft size={13} /></div>
          </div>
        </section>

        <section className="signal-section" data-reveal>
          <div className="container signal-inner">
            <p className="signal-intro">حين يكبر النشاط، تظهر الإشارات.</p>
            <div className="signals">
              <div><span className="signal-index">01</span><strong>طلبات متزايدة</strong><small>والطريقة القديمة لم تعد تكفي</small></div>
              <div><span className="signal-index">02</span><strong>بيانات موزعة</strong><small>ولا صورة واحدة تساعدك على القرار</small></div>
              <div><span className="signal-index">03</span><strong>عمل يدوي متكرر</strong><small>يأخذ وقت فريقك من الأهم</small></div>
            </div>
          </div>
        </section>

        <section className="journey-section section-grid" id="journey" data-reveal>
          <div className="section-intro">
            <div className="eyebrow"><span className="eyebrow-line" /> كيف نصل معًا</div>
            <h2>رحلة واضحة.<br /><em>نظام كامل.</em></h2>
            <p>لا نقف عند التسليم. هذه هي الصورة كاملة، من شرارة الفكرة إلى يوم يصبح فيه النظام جزءًا طبيعيًا من عملك.</p>
            <div className="selected-stage-card">
              <span className="stage-count">{journey[activeStage].number} / 12</span>
              <h3>{journey[activeStage].title}</h3>
              <p>{journey[activeStage].description}</p>
              <div className="progress-track"><span style={{ width: `${((activeStage + 1) / journey.length) * 100}%` }} /></div>
            </div>
          </div>
          <div className="journey-list" role="list" aria-label="مراحل بناء النظام">
            {journey.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <button className={`journey-stage ${activeStage === index ? 'active' : ''}`} key={stage.name} onClick={() => setActiveStage(index)} role="listitem" aria-pressed={activeStage === index} data-testid={`button-stage-${index + 1}`}>
                  <span className="stage-number">{stage.number}</span>
                  <span className="stage-icon"><Icon size={17} strokeWidth={1.7} /></span>
                  <span className="stage-name">{stage.name}</span>
                  <ArrowUpLeft className="stage-arrow" size={15} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="services-section" id="services" data-reveal>
          <div className="container">
            <div className="section-heading-row">
              <div><div className="eyebrow"><span className="eyebrow-line" /> ما نبنيه</div><h2>أدوات تعمل<br /><em>لصالح عملك.</em></h2></div>
              <p>كل مشروع له إيقاعه الخاص. نختار الشكل المناسب للنظام، ثم نبنيه بتفاصيل تخدم هذا الإيقاع.</p>
            </div>
            <div className="services-grid">
              {servicesLoading && <div className="public-data-state" role="status">جارٍ تحميل الخدمات…</div>}
              {!servicesLoading && servicesError && <div className="public-data-state" role="alert"><p>{servicesError}</p><button className="text-link" type="button" onClick={() => void reloadServices()}>إعادة المحاولة</button></div>}
              {!servicesLoading && !servicesError && services.length === 0 && <div className="public-data-state"><p>نعمل حاليًا على تجهيز الخدمات المنشورة.</p><a className="text-link" href="/contact">ابدأ مشروعك <ArrowLeft size={17} /></a></div>}
              {services.map((service) => {
                const Icon = homeServiceIcons[service.icon];
                const mark = String(service.order).padStart(2, '0');
                return <a className="service-card" href={`/services#service-${service.slug}`} key={service.id} data-testid={`card-service-${mark}`}>
                  <div className="service-top"><span className="service-mark">{mark}</span><Icon size={24} strokeWidth={1.4} /></div>
                  <h3>{service.title}</h3><p>{service.shortDescription}</p><span className="service-link">استكشف المسار <ArrowUpLeft size={15} /></span>
                </a>;
              })}
            </div>
          </div>
        </section>

        <section className="principles-section" id="principles" data-reveal>
          <div className="container principles-layout">
            <div className="principles-label"><span>أوركستريكس / 01</span><span className="vertical-rule" /><span>مبدأ العمل</span></div>
            <div className="principles-copy">
              <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> ما نؤمن به</div>
              <h2>نبني بهدوء.<br /><span>ونترك أثرًا واضحًا.</span></h2>
              <div className="manifesto-list">
                <p><b>01</b> نبدأ بالفهم قبل التنفيذ.</p>
                <p><b>02</b> نبني ما يحتاجه النشاط فعلًا.</p>
                <p><b>03</b> نأخذ المشروع حتى الإطلاق.</p>
                <p><b>04</b> ونصممه ليكبر معك.</p>
              </div>
            </div>
            <div className="principles-aside"><div className="aside-ring"><span>نظام</span><span>يتطور</span><span>معك</span></div><p>الوضوح ليس مرحلة في عملنا. هو الطريقة التي نعمل بها.</p></div>
          </div>
        </section>

        <section className="fit-section" data-reveal>
          <div className="container fit-layout">
            <div><div className="eyebrow"><span className="eyebrow-line" /> قبل أن نبدأ</div><h2>خذ الفكرة<br /><em>بجدية.</em></h2></div>
            <div className="fit-points">
              <div><span>01</span><h3>لا نبيعك قالبًا</h3><p>نبحث عن النظام الذي يجعل عملك أسهل، حتى لو كان أبسط مما توقعت.</p></div>
              <div><span>02</span><h3>لا نتركك في المنتصف</h3><p>ننسق التفاصيل التي تأتي بعد البرمجة: النشر، الأمان، والدعم.</p></div>
              <div><span>03</span><h3>لا نخفي التعقيد</h3><p>نشرح ما يهمك بلغة واضحة، لتتخذ قرارك وأنت مطمئن.</p></div>
            </div>
          </div>
        </section>

        <section className="faq-section" id="faq" data-reveal>
          <div className="container faq-layout">
            <div className="faq-heading"><div className="eyebrow"><span className="eyebrow-line" /> أسئلة في محلها</div><h2>قبل أن<br /><em>تبدأ.</em></h2><p>إذا لم تجد سؤالك هنا، ستجد في صفحة الخدمات المسار الأقرب إلى احتياجك.</p><a className="text-link" href="/services#overview" data-testid="link-faq-services">استكشف الحلول <ArrowLeft size={17} /></a></div>
            <div className="faq-list">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return <div className={`faq-item ${isOpen ? 'open' : ''}`} key={faq.question}>
                  <button onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen} data-testid={`button-faq-${index + 1}`}><span>{faq.question}</span><span className="faq-icon">{isOpen ? <X size={16} /> : <Plus size={16} />}</span></button>
                  <div className="faq-answer" aria-hidden={!isOpen}><p>{faq.answer}</p></div>
                </div>;
              })}
            </div>
          </div>
        </section>

        <section className="final-cta" data-reveal>
          <div className="cta-grid-lines" />
          <div className="container final-cta-inner">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> الخطوة الأولى بسيطة</div>
            <h2>لديك فكرة<br /><em>لمشروعك؟</em></h2>
            <p>احكِ لنا عنها كما هي. سنساعدك على رؤية الخطوة التالية.</p>
            <a className="button button-light" href="/contact" data-testid="link-final-services">ابدأ مشروعك <ArrowLeft size={18} /></a>
          </div>
          <div className="cta-coordinate">24° 42′ N&nbsp;&nbsp; 46° 40′ E</div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top"><Brand /><div className="footer-copy">من الفكرة إلى نظام يعمل.<br />نبني الوضوح في كل خطوة.</div><div className="footer-nav"><button onClick={() => goTo('services')} data-testid="link-footer-services">ما نبنيه</button><a href="/projects" data-testid="link-footer-projects">استكشف أعمالنا</a><a href="/contact" data-testid="link-footer-contact">ابدأ مشروعك</a></div></div>
        <div className="container footer-bottom"><span>© 2026 Orkestrix Systems</span><span>أنظمة رقمية تبدأ من فهم حقيقي</span><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="العودة إلى أعلى الصفحة" data-testid="button-back-top"><MoveUpLeft size={17} /></button></div>
      </footer>

    </div>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);

  if (path === '/admin' || path.startsWith('/admin/')) return <AdminApp />;

  if (path === '/services') return <ServicesPage />;
  if (path === '/projects') return <ProjectsPage />;
  if (projectMatch) return <ProjectDetailsPage slug={decodeURIComponent(projectMatch[1])} />;
  if (path === '/contact') return <ContactPage />;
  if (path === '/') return <Homepage />;
  return <NotFound />;
}

export default App;
