import { ArrowLeft, ArrowRight, ArrowUpLeft } from 'lucide-react';
import type { Project } from '../data/projects';
import { statusLabels } from '../data/projects';
import { usePublicProject } from '../lib/api';
import { usePageMeta } from '../lib/site-meta';
import NotFound from '../pages/not-found';

type ProjectDetailTemplateProps = {
  project: Project | null;
};

/**
 * Reusable Turn 2 boundary for `/projects/[slug]`.
 * It deliberately remains outside routing until a verified case study is published.
 */
export function ProjectDetailTemplate({ project }: ProjectDetailTemplateProps) {
  if (!project?.published) {
    return (
      <main className="not-found-page" dir="rtl">
        <div>
          <span className="not-found-code">مشروع غير منشور</span>
          <h1>هذا المشروع غير منشور.</h1>
          <p>لا نعرض تفاصيل مشروع قبل اكتمال محتواه واعتماده للنشر.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/projects">استكشف أعمالنا <ArrowLeft size={18} /></a>
            <a className="text-link" href="/contact">ابدأ مشروعك <ArrowLeft size={17} /></a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="site-shell projects-page project-detail-page" dir="rtl">
      <a className="skip-link" href="#project-detail-main">تجاوز إلى المحتوى</a>
      <header className="site-header"><div className="nav-wrap"><a className="brand brand-compact" href="/" aria-label="العودة للرئيسية"><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span></a><nav className="main-nav" aria-label="التنقل الرئيسي"><a href="/services">ما نبنيه</a><a className="active-nav" href="/projects">أعمالنا</a><a href="/#journey">رحلتك</a></nav><a className="nav-cta" href="/contact">ابدأ مشروعك <ArrowLeft size={16} /></a></div></header>
      <main id="project-detail-main">
        <article>
          <header className="project-detail-hero projects-container"><div className="project-detail-intro"><a className="project-back" href="/projects"><ArrowRight size={16} /> العودة إلى المشاريع</a><span className={`project-status status-${project.status}`}><span className="status-dot" />{statusLabels[project.status]}</span><h1>{project.title}</h1><p>{project.shortDescription}</p><div className="project-detail-tags">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>{project.heroImage && <div className="project-detail-media"><img src={project.heroImage} alt={project.heroMedia?.altText || `صورة مشروع ${project.title}`} /></div>}</header>
          <div className="project-story projects-container"><section aria-labelledby="project-problem"><span>01</span><h2 id="project-problem">المشكلة</h2><p>{project.problem}</p></section><section aria-labelledby="project-context"><span>02</span><h2 id="project-context">السياق</h2><p>{project.context}</p></section><section aria-labelledby="project-solution"><span>03</span><h2 id="project-solution">الحل</h2><p>{project.solution}</p></section><section aria-labelledby="project-implementation"><span>04</span><h2 id="project-implementation">التنفيذ</h2><p>{project.implementation}</p></section></div>
          <section className="project-deliverables projects-container" aria-labelledby="project-deliverables"><div><span className="eyebrow">نطاق العمل</span><h2 id="project-deliverables">ما تم تنفيذه</h2></div><ul>{project.deliverables.map((item) => <li key={item}><ArrowUpLeft size={16} />{item}</li>)}</ul></section>
          <section className="project-result projects-container" aria-labelledby="project-results"><span>ما يمكن قوله بدقة</span><h2 id="project-results">النتيجة وحدودها</h2><p>{project.resultLimits}</p></section>
          {project.gallery.length > 0 && <section className="project-gallery projects-container" aria-label="صور المشروع">{project.gallery.map((image) => <img key={image.id} src={image.url} alt={image.altText} />)}</section>}
          <section className="projects-final-cta"><div className="cta-grid-lines" /><div className="projects-container final-cta-inner"><div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> الخطوة التالية</div><h2>لديك مشروع<br /><em>يحتاج إلى مسار واضح؟</em></h2><a className="button button-light" href="/contact">ابدأ مشروعك <ArrowLeft size={18} /></a></div></section>
        </article>
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <a className="brand brand-compact" href="/"><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span></a>
          <div className="footer-copy">من الفكرة إلى نظام يعمل.<br />نبني الوضوح في كل خطوة.</div>
          <div className="footer-nav"><a href="/services">ما نبنيه</a><a href="/projects">استكشف أعمالنا</a><a href="/contact">ابدأ مشروعك</a></div>
        </div>
        <div className="container footer-bottom"><span>© 2026 Orkestrix Systems</span><span>أنظمة رقمية تبدأ من فهم حقيقي</span><a href="#project-detail-main" aria-label="العودة إلى أعلى الصفحة"><ArrowUpLeft size={17} /></a></div>
      </footer>
    </div>
  );
}

export function ProjectDetailsPage({ slug }: { slug: string }) {
  const { data: project, loading, error, notFound, reload } = usePublicProject(slug);
  usePageMeta({
    title: project ? `${project.title} | Orkestrix Systems` : 'تفاصيل المشروع | Orkestrix Systems',
    description: project?.shortDescription ?? 'تفاصيل مشروع منشور من Orkestrix Systems.',
    path: `/projects/${slug}`,
    robots: notFound ? 'noindex, follow' : 'index, follow',
  });
  if (notFound) return <NotFound />;
  if (loading) return <main className="not-found-page" dir="rtl"><div className="public-data-state" role="status">جارٍ تحميل المشروع…</div></main>;
  if (error) return <main className="not-found-page" dir="rtl"><div className="public-data-state" role="alert"><p>{error}</p><button className="button button-primary" type="button" onClick={() => void reload()}>إعادة المحاولة</button></div></main>;
  return <ProjectDetailTemplate project={project} />;
}
