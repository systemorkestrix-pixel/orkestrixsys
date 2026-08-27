import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '../lib/site-meta';

export default function NotFound() {
  usePageMeta({ title: 'الصفحة غير موجودة | Orkestrix Systems', description: 'المسار المطلوب غير متاح في موقع Orkestrix Systems.', path: '/404', robots: 'noindex, follow' });
  return <main className="not-found-page" dir="rtl"><a className="brand brand-compact" href="/"><img src="/orkestrix-mark.png" alt="شعار Orkestrix" /><span><strong>ORKESTRIX</strong><small>SYSTEMS</small></span></a><div><span className="not-found-code">404</span><h1>هذه الصفحة غير موجودة.</h1><p>ربما تغيّر الرابط أو لم يُنشأ هذا المسار بعد.</p><div className="hero-actions"><a className="button button-primary" href="/">العودة للرئيسية <ArrowLeft size={18} /></a><a className="text-link" href="/contact">ابدأ مشروعك <ArrowLeft size={17} /></a></div></div></main>;
}
