import { ArrowLeft, ArrowUpLeft, BriefcaseBusiness, Layers3, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { projectCategories, statusLabels, type Project, type ProjectCategory } from './data/projects';
import { usePageMeta } from './lib/site-meta';
import { usePublicProjects } from './lib/api';

function Brand() {
  return <a className="brand brand-compact" href="/" aria-label="العودة للرئيسية"><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span></a>;
}

function ProjectPreview({ project }: { project: Project }) {
  return <div className="project-preview preview-dashboard" role="img" aria-label={`تصور بصري لمشروع ${project.title}`}>
    <div className="preview-window"><div className="preview-rail"><i /><i /><i /></div><div className="preview-main"><div className="preview-heading" /><div className="preview-subheading" /><div className="preview-metrics"><i /><i /><i /></div><div className="preview-graph"><i /><i /><i /><i /><i /></div></div></div>
  </div>;
}

function ProjectMeta({ project }: { project: Project }) {
  const category = projectCategories.find((item) => item.id === project.category)?.label;
  return <div className="project-meta"><span className="project-category">{category}</span><span className={`project-status status-${project.status}`}><span className="status-dot" />{statusLabels[project.status]}</span></div>;
}

export function ProjectsPage() {
  const [filter, setFilter] = useState<'all' | ProjectCategory>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: projects, loading, error, reload } = usePublicProjects();
  const visibleProjects = filter === 'all' ? projects : projects.filter((project) => project.category === filter);
  const featured = visibleProjects.find((project) => project.featured);
  const remaining = visibleProjects.filter((project) => project.id !== featured?.id);
  usePageMeta({ title: 'المشاريع | Orkestrix Systems', description: 'نماذج من المواقع والأنظمة والتجارب الرقمية التي بنتها Orkestrix Systems.', path: '/projects' });

  return <div className="site-shell projects-page" dir="rtl">
    <a className="skip-link" href="#projects-main">تجاوز إلى المحتوى</a>
    <header className="site-header"><div className="nav-wrap"><button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button><Brand /><nav className={`main-nav ${menuOpen ? 'menu-open' : ''}`} aria-label="التنقل الرئيسي"><a href="/services" onClick={() => setMenuOpen(false)}>ما نبنيه</a><a className="active-nav" aria-current="page" href="/projects" onClick={() => setMenuOpen(false)}>أعمالنا</a><a href="/#journey" onClick={() => setMenuOpen(false)}>رحلتك</a><a href="/#faq" onClick={() => setMenuOpen(false)}>الأسئلة الشائعة</a></nav><a className="nav-cta" href="/contact">ابدأ مشروعك <ArrowLeft size={16} /></a></div></header>
    <main id="projects-main">
      <section className="projects-hero projects-container">
        <div className="projects-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> ما بنيناه</div><h1>مشاريع بُنيت<br /><em>لتعمل.</em></h1><p>نعرض نماذج من المواقع والأنظمة والتجارب الرقمية التي بنيناها.</p><div className="hero-actions"><a className="button button-primary" href="/contact">ابدأ مشروعك <ArrowLeft size={18} /></a></div></div>
        <div className="projects-visual" aria-hidden="true"><div className="project-board"><div className="project-board-top"><i /><i /><i /><span>أعمال أوركستريكس</span></div><div className="project-board-title">نظام في صورة واحدة</div><div className="project-board-layout"><div className="project-board-chart"><i /><i /><i /><i /><i /><i /></div><div className="project-board-list"><span><b>01</b></span><span><b>02</b></span><span><b>03</b></span></div></div><div className="project-board-foot"><span />مسار واضح للتشغيل</div></div><div className="project-phone"><div className="project-phone-notch" /><div className="project-phone-screen"><span /><b>واجهة متجاوبة</b><i /><i /></div></div><div className="project-project-tag project-tag-top"><BriefcaseBusiness size={13} /> مشروع داخلي</div><div className="project-project-tag project-tag-bottom"><Layers3 size={13} /> من الفكرة إلى التشغيل</div></div>
      </section>
      <section className="project-filter-section"><div className="projects-container project-filter-bar"><span className="project-filter-label">استكشف حسب نوع الحل</span><div className="project-filters" role="group" aria-label="تصفية المشاريع">{projectCategories.map((category) => <button className="project-filter" key={category.id} type="button" aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>{category.label}</button>)}</div></div></section>
      <section className="project-showcase projects-container">
        {loading && <div className="public-data-state" role="status">جارٍ تحميل المشاريع…</div>}
        {!loading && error && <div className="public-data-state" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => void reload()}>إعادة المحاولة</button></div>}
        {featured && <article className="project-featured"><div className="project-visual-wrap"><ProjectPreview project={featured} /></div><div className="project-featured-copy"><div className="eyebrow"><span className="eyebrow-line" /> مشروع مميز</div><ProjectMeta project={featured} /><h2>{featured.title}</h2><p>{featured.shortDescription}</p><dl className="feature-facts"><div><dt>التحدي</dt><dd>{featured.problem}</dd></div><div><dt>الحل</dt><dd>{featured.solution}</dd></div></dl><a className="text-link" href={`/projects/${featured.slug}`}>عرض المشروع <ArrowLeft size={17} /></a></div></article>}
        {remaining.length > 0 && <><div className="project-grid-heading"><h2>كل الأعمال</h2><p>نعرض فقط الأعمال التي يمكن توصيفها بوضوح في هذه المرحلة.</p></div><div className="project-grid">{remaining.map((project) => <article className="project-card" key={project.id}><ProjectPreview project={project} /><div className="project-card-body"><ProjectMeta project={project} /><h3>{project.title}</h3><p>{project.shortDescription}</p><a className="text-link" href={`/projects/${project.slug}`}>عرض المشروع <ArrowLeft size={17} /></a></div></article>)}</div></>}
        {!loading && !error && visibleProjects.length === 0 && <div className="project-empty"><h3>لا توجد أعمال ضمن هذا التصنيف بعد.</h3><p>نفضّل عدم ملء الصفحة بمشاريع غير موثقة.</p><a className="text-link" href="/contact">ابدأ مشروعك <ArrowLeft size={17} /></a></div>}
      </section>
      <section className="projects-final-cta"><div className="cta-grid-lines" /><div className="projects-container final-cta-inner"><div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> الخطوة التالية</div><h2>هل لديك فكرة<br /><em>تحتاج إلى نظام يعمل؟</em></h2><p>ابدأ بطلب مشروع واضح، حتى لو لم تكن قد حددت نوع الحل بعد.</p><a className="button button-light" href="/contact">ابدأ مشروعك <ArrowLeft size={18} /></a></div></section>
    </main>
    <footer className="site-footer"><div className="container footer-top"><Brand /><div className="footer-copy">من الفكرة إلى نظام يعمل.<br />نبني الوضوح في كل خطوة.</div><div className="footer-nav"><a href="/services">ما نبنيه</a><a href="/projects">استكشف أعمالنا</a><a href="/contact">ابدأ مشروعك</a></div></div><div className="container footer-bottom"><span>© 2026 Orkestrix Systems</span><span>أنظمة رقمية تبدأ من فهم حقيقي</span><a href="#projects-main" aria-label="العودة إلى أعلى الصفحة"><ArrowUpLeft size={17} /></a></div></footer>
  </div>;
}
