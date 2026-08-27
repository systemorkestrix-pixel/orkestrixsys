# ORKESTRIX SYSTEMS — TURN 2 CLOSURE REPORT

## Architecture

تم الانتقال إلى المسار التشغيلي التالي دون إعادة تصميم الموقع العام:

`Admin UI → HTTP Application/API → Server Authorization → SQLite/Media Storage → Public Selectors → Public UI`

الخادم الإنتاجي يقدّم ملفات React المبنية والـAPI والوسائط من أصل واحد، بينما يستخدم Vite proxy في التطوير المحلي.

## Database

- قاعدة SQLite فعلية مع foreign keys وWAL وbusy timeout وفهارس للقراءة العامة والطلبات والجلسات والتدقيق.
- الجداول: `admins`, `sessions`, `services`, `projects`, `media`, `project_media`, `slug_redirects`, `leads`, `site_settings`, `audit_logs`.
- Stable UUIDs، timestamps، unique slugs، قيود enum، علاقات وسائط آمنة، وتهيئة idempotent.
- بيانات Turn 1 الرسمية تُزرع مرة واحدة داخل قاعدة فارغة، ثم تصبح قاعدة البيانات مصدر الحقيقة.

## Authentication

- Login وLogout وجلسة خادمية فعلية.
- كلمات المرور تستخدم `scrypt` مع salt، ورمز الجلسة العشوائي لا يُحفظ خامًا في القاعدة.
- Cookie هي `HttpOnly`, `SameSite=Strict`, وتصبح `Secure` في `NODE_ENV=production`.
- لا توجد بيانات اعتماد hard-coded. إنشاء أول Admin يتطلب متغيرات bootstrap ثم يمكن حذفها.

## Authorization

- جميع `/api/admin/*` محمية خادميًا، ولا يكفي إظهار/إخفاء عناصر Frontend.
- نموذج الدور يدعم `admin` وامتداد `editor` مستقبلًا.
- مسارات `/admin/*` تعرض Unauthorized state عند غياب جلسة صالحة.

## Dashboard

تعرض لوحة المتابعة بيانات حقيقية فقط: الطلبات الجديدة والمفتوحة، الخدمات والمشاريع المنشورة، أحدث الطلبات، والنشاط الأخير.

## Services

- CRUD، draft/active/archive، publish/unpublish، featured والترتيب.
- تحقق خادمي وعميل، وslug فريد.
- Homepage وServices Page تقرآن الخدمات المنشورة والنشطة من `/api/public/services`، مع loading/error/empty/populated states.

## Projects

- CRUD منظم حسب Identity وSummary وStory وPresentation وPublishing.
- الحالات محصورة في `live`, `concept`, `demo`, `internal`.
- دعم context وimplementation وresult limits والمخرجات والوسوم وHero/Gallery والتمييز والترتيب.
- الأرشفة صريحة وتلغي النشر. المسودات والمؤرشف لا يظهران عامًا.
- تغيير slug منشور يعرض تحذيرًا ويحفظ الرابط القديم في `slug_redirects` بدل كسره بصمت.

## Project Details

- `/projects/:slug` متصل بقاعدة البيانات ويعرض القصة كاملة من البيانات دون تعديل JSX.
- slug منشور يعرض الصفحة، وغير المنشور أو المؤرشف أو غير الصحيح يعرض 404.
- لا تُعرض نتيجة مختلقة؛ حقل Result Limits إلزامي ويشرح النتيجة أو حدود توفرها.

## Leads

- التدفق أصبح: Form → client validation → API validation/rate limit → database insert → request UUID → success.
- لا تظهر رسالة نجاح قبل نجاح الحفظ.
- الإدارة تدعم القائمة والبحث والتصفية والتفاصيل وتغيير الحالة والملاحظات الداخلية والمصدر والتاريخ وإجراء التواصل.

## Media

- رفع PNG/JPEG/WebP حتى 5MB مع فحص MIME والتوقيع وحفظ باسم UUID.
- Preview وalt text واختيار Hero/Gallery والربط والفصل.
- يمنع حذف وسيط مرتبط ويطلب فصله أولًا.

## Site Settings

- Contact Channels وFooter Contact وDefault Social Image وDomain Reference فقط.
- Domain وDefault Social Image متصلان فعليًا بالـcanonical وOpen Graph/Twitter metadata.
- Core Brand وCTA والمسار الرسمي ليست قابلة للتعديل من الإدارة.

## Publishing and Revalidation

- Public selectors تعيد فقط السجلات المنشورة والصحيحة.
- جميع استجابات البيانات الديناميكية تستخدم `Cache-Control: no-store`؛ لذلك يظهر publish/update/unpublish في الطلب العام التالي مباشرة وبشكل predictable.

## Public Integration

- Homepage Services وServices وProjects وProject Details وContact أصبحت تعتمد على API/Database.
- لم يُعد تصميم Homepage أو Header أو Footer أو CTA أو صفحات Turn 1.
- فشل البيانات يعرض حالة قابلة للاسترداد بدل محتوى Seed مخفي أو نجاح وهمي.

## Security

- Server authorization، hashed passwords/session tokens، same-origin mutation checks، input/enum/URL/slug validation، rate limiting، honeypot، upload allowlist/size/signature validation.
- CSP و`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, و`Permissions-Policy` على الاستضافة الإنتاجية.
- أخطاء قاعدة البيانات الخام لا تُعرض للمستخدم.
- React يبقي المحتوى كنص آمن ولا توجد واجهة Raw HTML/JSON للمحرر.

## Audit Logs

تُسجل عمليات الدخول والفشل والخروج، وإنشاء/تعديل/نشر/إلغاء نشر/أرشفة الخدمات والمشاريع، وتغيير حالة Lead، والإعدادات، ورفع/حذف الوسائط، دون كلمات مرور أو رموز جلسة.

## Tests

- `pnpm typecheck`: ناجح لكل من API وWeb.
- `pnpm build`: ناجح لكل من API وWeb.
- Backend integration: **9/9** ناجحة وتشمل auth/authorization وCRUD والنشر والتفاصيل والـleads والوسائط والإعدادات والتدقيق.
- Playwright: **30/30** ناجحة.
- اختبارات Turn 1 الأصلية: **25/25** ناجحة دون regression عبر 320 و375 و430 و768 و1440px.
- اختبارات Turn 2 في المتصفح: حماية Admin، login/logout، Dashboard، Project Details/404، وحفظ Contact وظهوره في Leads.

## Environment Variables / Required Configuration

- `ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL`: مطلوب فقط لإنشاء أول حساب.
- `ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD`: كلمة عشوائية لا تقل عن 12 حرفًا، مطلوبة فقط للتهيئة الأولى.
- `ORKESTRIX_DATABASE_PATH`: مسار تخزين دائم لقاعدة البيانات.
- `ORKESTRIX_UPLOADS_PATH`: مسار تخزين دائم للوسائط.
- `HOST`, `PORT`, `NODE_ENV=production`.
- الإنتاج يتطلب HTTPS reverse proxy، تخزينًا دائمًا، ونسخًا احتياطية للقاعدة والوسائط.

## Remaining Blockers

لا يوجد blocker وظيفي داخل Turn 2. متطلبات HTTPS والدومين والنسخ الاحتياطي والمراقبة وإدارة rate limiting مشتركة عند التوسع تخص Turn 3 والنشر الإنتاجي. يستخدم المشروع `node:sqlite` في Node 24، والذي يظهر تحذير Experimental من Node حاليًا رغم نجاح التشغيل والاختبارات؛ يجب تثبيت إصدار Node ومراجعته ضمن تدقيق منصة الإنتاج في Turn 3.

## Final Status

**CLOSED — READY FOR TURN 3**
