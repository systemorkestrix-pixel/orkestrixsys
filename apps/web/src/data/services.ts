export type ServiceIcon = 'globe' | 'store' | 'dashboard' | 'custom' | 'integration';
export type ServiceStatus = 'active' | 'archived' | 'draft';

export type Service = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  icon: ServiceIcon;
  order: number;
  status: ServiceStatus;
  published: boolean;
  featured: boolean;
  updatedAt: string;
  color: 'blue' | 'cyan' | 'slate' | 'navy' | 'electric';
  label: string;
  problem?: string[];
  value: string[];
  examples?: string[];
};

export const services: Service[] = [
  {
    id: 'business-websites', slug: 'business-websites', title: 'مواقع الأعمال', shortDescription: 'وجود رقمي رسمي مصمم حول نشاطك.', description: 'موقع رسمي يجعل نشاطك حاضرًا على الإنترنت بصورة واضحة واحترافية.', icon: 'globe', order: 1, status: 'active', published: true, featured: true, updatedAt: '2026-08-25', color: 'blue', label: 'حضور واضح',
    problem: ['غياب الوجود الرسمي', 'صعوبة عرض الخدمات', 'الاعتماد الكامل على الشبكات الاجتماعية', 'ضعف الوصول إلى العملاء'], value: ['صفحات واضحة', 'تجربة متجاوبة للجوال', 'عرض منظم للخدمات', 'تواصل مباشر وواتساب', 'نطاق رسمي', 'استضافة سحابية', 'شهادة أمان SSL', 'نشر وتشغيل مباشر'],
  },
  {
    id: 'ecommerce-stores', slug: 'ecommerce-stores', title: 'المتاجر الإلكترونية', shortDescription: 'تجربة بيع وإدارة مناسبة لطبيعة نشاطك.', description: 'تجربة بيع رقمية مصممة حول المنتجات والعملاء وطريقة عمل نشاطك.', icon: 'store', order: 2, status: 'active', published: true, featured: true, updatedAt: '2026-08-25', color: 'cyan', label: 'بيع مرتب',
    value: ['عرض المنتجات', 'الطلبات', 'العملاء', 'الدفع عند الحاجة', 'إدارة المحتوى', 'إدارة المتجر'], examples: ['كتالوج واضح', 'مسار طلب مختصر', 'متابعة ما بعد البيع'],
  },
  {
    id: 'admin-dashboards', slug: 'admin-dashboards', title: 'لوحات الإدارة', shortDescription: 'إدارة البيانات والعمليات من مكان واحد.', description: 'مساحة واحدة تساعدك على إدارة البيانات والعمليات ومتابعة العمل.', icon: 'dashboard', order: 3, status: 'active', published: true, featured: true, updatedAt: '2026-08-25', color: 'slate', label: 'رؤية واحدة',
    value: ['الطلبات', 'العملاء', 'المنتجات', 'الحجوزات', 'المشاريع', 'التقارير', 'الموظفون'], examples: ['صورة يومية للعمل', 'قرارات أسرع', 'صلاحيات حسب الدور'],
  },
  {
    id: 'custom-systems', slug: 'custom-systems', title: 'الأنظمة المخصصة', shortDescription: 'حل رقمي يُبنى حول طريقة عمل مشروعك.', description: 'عندما لا يكفي الحل الجاهز، نبني النظام حول طريقة عمل مشروعك.', icon: 'custom', order: 4, status: 'active', published: true, featured: true, updatedAt: '2026-08-25', color: 'navy', label: 'على مقاسك',
    value: ['أنظمة داخلية', 'منصات أعمال', 'إدارة علاقات العملاء CRM', 'إدارة الحجوزات', 'إدارة المشاريع', 'إدارة العمليات', 'أنظمة مخصصة'], examples: ['مسارات عمل خاصة', 'أدوار وصلاحيات', 'حسب احتياجات المشروع ونطاقه.'],
  },
  {
    id: 'integrations-automation', slug: 'integrations-automation', title: 'التكاملات والأتمتة', shortDescription: 'ربط الأدوات والخدمات وتقليل العمل اليدوي.', description: 'نربط الأدوات والخدمات التي يعتمد عليها مشروعك ونقلل العمل اليدوي حيث يكون ذلك مناسبًا.', icon: 'integration', order: 5, status: 'active', published: true, featured: true, updatedAt: '2026-08-25', color: 'electric', label: 'عمل متصل',
    value: ['واتساب', 'البريد الإلكتروني', 'بوابات الدفع', 'النماذج الذكية', 'إدارة العملاء', 'واجهات الربط البرمجي APIs', 'التنبيهات الفورية', 'مسارات العمل التلقائية'], examples: ['تنبيه في وقته', 'بيانات لا تتكرر', 'خطوات أقل لفريقك'],
  },
];

export const publishedServices = services.filter((service) => service.published && service.status === 'active').sort((a, b) => a.order - b.order);
