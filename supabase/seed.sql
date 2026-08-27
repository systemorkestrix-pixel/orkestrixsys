-- ==============================================================================
-- ORKESTRIX SYSTEMS — SUPABASE SEED DATA
-- Official services & site settings (Projects initial state is clean/empty)
-- ==============================================================================

-- 1. OFFICIAL SERVICES
INSERT INTO services (
  id, slug, title, short_description, description, icon, sort_order, status, published, featured, color, label, problem_json, value_json, examples_json, created_at, updated_at
) VALUES
(
  'business-websites',
  'business-websites',
  'مواقع الأعمال',
  'وجود رقمي رسمي مصمم حول نشاطك.',
  'موقع رسمي يجعل نشاطك حاضرًا على الإنترنت بصورة واضحة واحترافية.',
  'globe',
  1,
  'active',
  TRUE,
  TRUE,
  'blue',
  'حضور واضح',
  '["غياب الوجود الرسمي", "صعوبة عرض الخدمات", "الاعتماد الكامل على الشبكات الاجتماعية", "ضعف الوصول إلى العملاء"]'::jsonb,
  '["صفحات واضحة", "تجربة متجاوبة للجوال", "عرض منظم للخدمات", "تواصل مباشر وواتساب", "نطاق رسمي", "استضافة سحابية", "شهادة أمان SSL", "نشر وتشغيل مباشر"]'::jsonb,
  '[]'::jsonb,
  NOW(),
  NOW()
),
(
  'ecommerce-stores',
  'ecommerce-stores',
  'المتاجر الإلكترونية',
  'تجربة بيع وإدارة مناسبة لطبيعة نشاطك.',
  'تجربة بيع رقمية مصممة حول المنتجات والعملاء وطريقة عمل نشاطك.',
  'store',
  2,
  'active',
  TRUE,
  TRUE,
  'cyan',
  'بيع مرتب',
  '[]'::jsonb,
  '["عرض المنتجات", "الطلبات", "العملاء", "الدفع عند الحاجة", "إدارة المحتوى", "إدارة المتجر"]'::jsonb,
  '["كتالوج واضح", "مسار طلب مختصر", "متابعة ما بعد البيع"]'::jsonb,
  NOW(),
  NOW()
),
(
  'admin-dashboards',
  'admin-dashboards',
  'لوحات الإدارة',
  'إدارة البيانات والعمليات من مكان واحد.',
  'مساحة واحدة تساعدك على إدارة البيانات والعمليات ومتابعة العمل.',
  'dashboard',
  3,
  'active',
  TRUE,
  TRUE,
  'slate',
  'رؤية واحدة',
  '[]'::jsonb,
  '["الطلبات", "العملاء", "المنتجات", "الحجوزات", "المشاريع", "التقارير", "الموظفون"]'::jsonb,
  '["صورة يومية للعمل", "قرارات أسرع", "صلاحيات حسب الدور"]'::jsonb,
  NOW(),
  NOW()
),
(
  'custom-systems',
  'custom-systems',
  'الأنظمة المخصصة',
  'حل رقمي يُبنى حول طريقة عمل مشروعك.',
  'عندما لا يكفي الحل الجاهز، نبني النظام حول طريقة عمل مشروعك.',
  'custom',
  4,
  'active',
  TRUE,
  TRUE,
  'navy',
  'على مقاسك',
  '[]'::jsonb,
  '["أنظمة داخلية", "منصات أعمال", "إدارة علاقات العملاء CRM", "إدارة الحجوزات", "إدارة المشاريع", "إدارة العمليات", "أنظمة مخصصة"]'::jsonb,
  '["مسارات عمل خاصة", "أدوار وصلاحيات", "حسب احتياجات المشروع ونطاقه."]'::jsonb,
  NOW(),
  NOW()
),
(
  'integrations-automation',
  'integrations-automation',
  'التكاملات والأتمتة',
  'ربط الأدوات والخدمات وتقليل العمل اليدوي.',
  'نربط الأدوات والخدمات التي يعتمد عليها مشروعك ونقلل العمل اليدوي حيث يكون ذلك مناسبًا.',
  'integration',
  5,
  'active',
  TRUE,
  TRUE,
  'electric',
  'عمل متصل',
  '[]'::jsonb,
  '["واتساب", "البريد الإلكتروني", "بوابات الدفع", "النماذج الذكية", "إدارة العملاء", "واجهات الربط البرمجي APIs", "التنبيهات الفورية", "مسارات العمل التلقائية"]'::jsonb,
  '["تنبيه في وقته", "بيانات لا تتكرر", "خطوات أقل لفريقك"]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. SITE SETTINGS
INSERT INTO site_settings (key, value, updated_at) VALUES
('domain', 'https://orkestrix.site', NOW()),
('footerContact', '', NOW()),
('contactChannels', '[]', NOW()),
('defaultSocialImage', '/orkestrix-mark.png', NOW())
ON CONFLICT (key) DO NOTHING;
