# STEP 1 — ملخص مشروع التخرج: Tawassol

## ما هو المشروع؟

**Tawassol** منصة تعليمية تعاونية موجهة للطلاب الجامعيين، تتيح إنشاء مجموعات دراسية، تبادل الموارد، والتواصل الفوري — كل ذلك في فضاء أكاديمي منظم.

---

## Stack التقني

| الطبقة | التقنية |
|--------|---------|
| الإطار | Next.js 14 (App Router) |
| الواجهة | React 18 + Tailwind CSS + Framer Motion |
| قاعدة البيانات | Cloud Firestore (real-time) |
| المصادقة | Firebase Auth — Email / Google / GitHub / OTP |
| تخزين الملفات | Cloudinary |
| الترجمة | نظام مخصص EN/FR مع String Interpolation |
| الأمان | Firebase Admin SDK (server-only) + JWT Verification |

---

## البنية المعمارية

```
┌──────────────────────────────────────────┐
│          Next.js 14  (App Router)        │
│  ┌──────────────┐   ┌──────────────────┐ │
│  │  Client Side │   │   API Routes     │ │
│  │  (React UI)  │   │  (Server-side)   │ │
│  └──────┬───────┘   └────────┬─────────┘ │
└─────────┼────────────────────┼───────────┘
          │                    │
   Firebase Client SDK   Firebase Admin SDK
   (Auth + Realtime)     (Operations sécurisées)
          │                    │
          └────────┬───────────┘
              ┌────▼─────┐
              │Firestore │
              └──────────┘
```

---

## الميزات الرئيسية

### للطالب
- **Hub (الفيد)** — نشر posts أكاديمية مع likes وcomments في الوقت الفعلي
- **مجموعات دراسية** — إنشاء/انضمام مجموعات مع نظام حراسة (Overseer)
- **دردشة فورية** — رسائل نصية وملفات مع إمكانية الرد والتثبيت
- **استكشاف** — البحث وفلترة المجموعات حسب الجامعة والتخصص والمستوى
- **نظام نقاط ورتب** — مُبادِر → مُساهِم → باحِث → مَرجِع
- **إشعارات فورية** — تنبيهات عند الانضمام والرسائل والتفاعلات

### للمشرف (Overseer)
- قبول/رفض طلبات الانضمام مع مراجعة إجابات الأسئلة
- إدارة الموارد التعليمية داخل المجموعة

### للأدمن
- لوحة إدارة شاملة: المستخدمون / المجموعات / الشكاوى
- التحقق من الهوية الطلابية (ID Card)
- التعامل مع تقارير المحتوى غير اللائق

---

## مجموعات Firestore

| Collection | الغرض |
|-----------|-------|
| `users` | بيانات الطلاب + الأدوار + النقاط |
| `groups` | المجموعات الدراسية + الأعضاء |
| `messages` | رسائل الدردشة |
| `posts` | منشورات الفيد |
| `notifications` | إشعارات المستخدمين |
| `resources` | الملفات التعليمية |
| `join-requests` | طلبات الانضمام |
| `reports` | الشكاوى والتقارير |

---

## نقاط قوة تقنية

1. **Real-time** — Firestore `onSnapshot()` للرسائل والإشعارات بدون polling
2. **Transactions** — نظام النقاط يستخدم Firestore Transactions لتفادي Race Conditions
3. **أمان متعدد الطبقات** — Security Rules + JWT Verification + Server-only Admin SDK
4. **فصل Client/Server** — Admin SDK محصور على API Routes، لا يُكشف للمتصفح
5. **UX متكاملة** — Dark/Light mode + ترجمة EN/FR + رسوم متحركة

---

## سيناريو Demo

```
Landing Page → Auth (Google/Email) → Pending → Onboarding
→ Hub (Post + Like) → Explore (Filter) → Chat (Message + File)
→ Admin Panel (Approve User + Handle Report)
```
