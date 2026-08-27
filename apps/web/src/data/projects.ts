export const projectCategories = [
  { id: 'all', label: 'الكل' },
  { id: 'business-websites', label: 'مواقع الأعمال' },
  { id: 'stores', label: 'المتاجر' },
  { id: 'dashboards', label: 'لوحات الإدارة' },
  { id: 'custom-systems', label: 'الأنظمة المخصصة' },
  { id: 'integrations', label: 'التكاملات والأتمتة' },
] as const;

export type ProjectCategory = Exclude<(typeof projectCategories)[number]['id'], 'all'>;
export type ProjectStatus = 'live' | 'concept' | 'demo' | 'internal';

export type Project = {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  status: ProjectStatus;
  shortDescription: string;
  problem: string;
  context: string;
  solution: string;
  implementation: string;
  deliverables: string[];
  resultLimits: string;
  heroImage: string;
  heroMediaId?: string | null;
  heroMedia?: MediaAsset | null;
  gallery: MediaAsset[];
  tags: string[];
  featured: boolean;
  published: boolean;
  archived?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  client?: string;
  year?: number;
  liveUrl?: string;
};

export type MediaAsset = { id: string; url: string; altText: string; fileName: string; mimeType: string; width?: number | null; height?: number | null };

export const statusLabels: Record<ProjectStatus, string> = {
  live: 'حي',
  concept: 'مفهوم',
  demo: 'تجريبي',
  internal: 'داخلي',
};

export const projects: Project[] = [
  {
    id: 'orkestrix-site',
    title: 'موقع Orkestrix Systems',
    slug: 'orkestrix-systems-site',
    category: 'business-websites',
    status: 'internal',
    shortDescription: 'الموقع الرسمي الداخلي للشركة، صُمم لتوضيح الخدمات ومسار بناء النظام وبدء طلب مشروع.',
    problem: 'تقديم صورة واضحة لما تبنيه Orkestrix وكيف ينتقل الزائر من الاستكشاف إلى طلب مشروع.',
    context: 'مشروع Orkestrix الداخلي لتأسيس الوجود العام والطبقة التشغيلية للشركة.',
    solution: 'موقع عربي متجاوب بهيكل رحلة واضح ومسارات مستقلة للخدمات والأعمال وطلب المشروع.',
    implementation: 'بناء الواجهة العامة ثم فصل البيانات وإضافة الإدارة والنشر.',
    deliverables: ['الهوية الرقمية للموقع', 'صفحة الخدمات', 'صفحة الأعمال', 'واجهة طلب مشروع'],
    resultLimits: 'هذا مشروع داخلي؛ لا تُعرض نتائج تجارية أو مقاييس غير موثقة.',
    heroImage: '/orkestrix-mark.png',
    gallery: [],
    tags: ['موقع إلكتروني', 'مشروع داخلي'],
    featured: true,
    published: true,
    sortOrder: 1,
    createdAt: '2026-08-25',
    updatedAt: '2026-08-25',
  },
];

export const publishedProjects = projects.filter((project) => project.published).sort((a, b) => a.sortOrder - b.sortOrder);

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug) ?? null;
}
