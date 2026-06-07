# LEARN_APP — المرحلة 1: الأدوات والبنية

> مراجعة كاملة من قراءة الكود الفعلي. آخر تحديث: 2026-05-20.

---

## 1. جدول المكتبات

| الاسم | الإصدار | الدور | أين يُستخدم |
|-------|---------|-------|------------|
| `next` | 14.2.3 | إطار React مع App Router + API Routes | كل الصفحات والـ API |
| `firebase` | ^10.12.0 | Client SDK: Auth + Firestore (real-time) | صفحات العميل، lib/firebase.js |
| `firebase-admin` | ^12.7.0 | Server SDK: التحقق من التوكن + عمليات Firestore | جميع API routes عبر lib/firebaseAdmin.js |
| `cloudinary` | ^2.10.0 | رفع الصور والملفات والحصول على URL | /api/upload |
| `framer-motion` | ^11.0.0 | أنيميشن للمكونات والصفحات | صفحات auth, hub, onboarding, مكونات عديدة |
| `tailwindcss` | ^3.4.3 | تنسيق CSS بالفئات | كل الصفحات والمكونات |
| `lucide-react` | ^1.14.0 | مكتبة أيقونات SVG | Sidebar, NotificationCenter, MessageInput... |
| `react-icons` | ^5.0.0 | أيقونات إضافية | صفحات متعددة |
| `date-fns` | ^4.1.0 | تنسيق التواريخ | MessageList, Hub/Chat |
| `emoji-picker-react` | ^4.19.1 | لوحة إيموجي في الدردشة | chat/MessageInput.js |
| `next-themes` | ^0.4.6 | دعم الـ Dark/Light mode | app/layout.js + ThemeProvider |
| `i18next` + `react-i18next` | في package.json | **غير مستخدمَيْن** — مثبتان فقط | لا تستخدم — النظام الفعلي هو lib/i18n.js |

> **ملاحظة مهمة بشأن i18n:** التطبيق يملك نظام ترجمة **مخصصاً** مبنياً محلياً في `lib/i18n.js` + `lib/LanguageContext.js`. يدعم FR/EN ويُخزّن الاختيار في localStorage. مكتبات i18next المثبتة في package.json غير مُستخدمة فعلياً.

---

## 2. شجرة المجلدات

```
tawassol/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.js                 # Layout عالمي: ThemeProvider + LanguageProvider + AuthProvider
│   │   ├── page.js                   # Landing Page للزوار
│   │   ├── auth/page.js              # تسجيل دخول + تسجيل + OAuth + Phone OTP
│   │   ├── pending/page.js           # انتظار موافقة الأدمن
│   │   ├── onboarding/page.js        # إكمال الملف الشخصي (3 خطوات)
│   │   ├── explore/page.js           # استكشاف المجموعات العامة
│   │   ├── hub/
│   │   │   ├── page.js               # Feed: منشورات + تعليقات + إعجابات
│   │   │   └── chat/[id]/page.js     # دردشة مجموعة محددة (real-time)
│   │   ├── groups/
│   │   │   ├── create/page.js        # إنشاء مجموعة جديدة
│   │   │   └── join/page.js          # صفحة الانضمام
│   │   ├── profile/
│   │   │   ├── page.js               # ملفي الشخصي (قراءة + تعديل)
│   │   │   └── [uid]/page.js         # ملف مستخدم آخر (قراءة فقط)
│   │   ├── admin/page.js             # لوحة إدارة (role === "admin" فقط)
│   │   └── api/                      # API Routes (server-side Node.js)
│   │       ├── register/route.js
│   │       ├── login/route.js
│   │       ├── upload/route.js
│   │       ├── search/route.js
│   │       ├── auth/google-register/route.js
│   │       ├── download/route.js
│   │       ├── notifications/
│   │       │   ├── route.js
│   │       │   └── [id]/route.js
│   │       ├── user/
│   │       │   ├── setup/route.js
│   │       │   ├── profile/route.js
│   │       │   └── pending-requests/route.js
│   │       ├── posts/
│   │       │   ├── route.js          # GET list + POST create
│   │       │   └── [id]/
│   │       │       ├── route.js      # DELETE post
│   │       │       ├── like/route.js
│   │       │       ├── comments/route.js
│   │       │       └── report/route.js
│   │       ├── profile/
│   │       │   ├── stats/route.js
│   │       │   └── [uid]/route.js
│   │       ├── groups/
│   │       │   ├── route.js          # GET list + POST create
│   │       │   └── [id]/
│   │       │       ├── route.js
│   │       │       ├── events/route.js
│   │       │       ├── join-requests/route.js
│   │       │       ├── join-requests/[reqId]/route.js
│   │       │       ├── members/[uid]/route.js
│   │       │       ├── members/[uid]/role/route.js
│   │       │       ├── messages/route.js
│   │       │       ├── messages/[msgId]/route.js
│   │       │       ├── messages/[msgId]/react/route.js
│   │       │       ├── messages/[msgId]/report/route.js
│   │       │       ├── pin/route.js
│   │       │       ├── report/route.js
│   │       │       └── resources/
│   │       │           ├── route.js
│   │       │           └── [resId]/route.js
│   │       └── admin/
│   │           ├── backfill-points/route.js
│   │           ├── sync-claims/route.js
│   │           ├── groups/[id]/route.js
│   │           ├── reports/[reportId]/route.js
│   │           └── users/
│   │               ├── route.js
│   │               ├── [uid]/route.js
│   │               ├── [uid]/approve/route.js
│   │               └── [uid]/reject/route.js
│   ├── /
│   │   ├── Sidebar.js
│   │   ├── NotificationCenter.js
│   │   ├── NotificationsBell.js
│   │   ├── SearchBar.js
│   │   ├── SelectionModal.js
│   │   ├── SettingsMenu.js
│   │   ├── SettingscomponentsModals.js
│   │   ├── TsswalLogo.js
│   │   ├── UserBadge.js
│   │   ├── LinkField.js
│   │   ├── DiscoveryGrid.js
│   │   ├── MessageAttachment.js
│   │   ├── ThemeProvider.js
│   │   ├── chat/
│   │   │   ├── MessageInput.js
│   │   │   ├── MessageList.js
│   │   │   ├── ChatHeader.js
│   │   │   ├── MemberListDrawer.js
│   │   │   ├── OverseerPanel.js
│   │   │   ├── ResourcesSidebar.js
│   │   │   ├── CalendarSidebar.js
│   │   │   ├── ActiveNodesSidebar.js
│   │   │   ├── PinnedMessageBanner.js
│   │   │   ├── GroupInfoPanel.js
│   │   │   ├── GroupMembers.js
│   │   │   ├── GroupSettings.js
│   │   │   ├── ModerationPanel.js
│   │   │   └── ReportModal.js
│   │   ├── admin/
│   │   │   ├── AdminPendingTable.js
│   │   │   ├── AdminUsersTable.js
│   │   │   ├── AdminGroupsTable.js
│   │   │   ├── AdminReportsTable.js
│   │   │   ├── IDCardModal.js
│   │   │   └── UserProfileModal.js
│   │   └── explore/
│   │       ├── JoinNodeModal.js
│   │       └── NodeShelf.js
│   └── lib/
│       ├── firebase.js               # Client SDK init (singleton, HMR-safe)
│       ├── firebaseAdmin.js          # Admin SDK init + helpers (snapToObj, convertTimestamps)
│       ├── collectionNames.js        # COL: ثوابت أسماء Collections
│       ├── collections.js            # Admin collection refs + Document Builders
│       ├── firestore.js              # Admin helpers + FieldValue re-export
│       ├── withAuth.js               # withAuth / withAdmin / withPublic / withErrorHandling
│       ├── verifyAdmin.js            # verifyAdmin / verifyAuth (fast-path claims)
│       ├── apiClient.js              # api() — fetch wrapper (JWT + timeout + auto-retry)
│       ├── useAuth.js                # AuthProvider + useAuth() — 3-effect routing
│       ├── useMyGroups.js            # مجموعاتي real-time (array-contains)
│       ├── useAllGroups.js           # كل المجموعات العامة (isPublic: true, limit 30)
│       ├── useChat.js                # محرك الدردشة (3 listeners + optimistic + pagination)
│       ├── useMessages.js            # hook إضافي للرسائل
│       ├── useJoinRequests.js        # hook لطلبات الانضمام
│       ├── useFileUpload.js          # hook لرفع الملفات
│       ├── useApi.js                 # hook مساعد للـ API calls
│       ├── academicData.js           # UNIVERSITIES, MAJORS, LEVELS, shortUni(), shortMajor()
│       ├── rankingSystem.js          # getRank() + updateUserPoints() (Server-only)
│       ├── relevance.js              # خوارزميات الاستكشاف (Pure functions)
│       ├── serverNotify.js           # notifyUser / notifyMany / extractMentionedUids (Server)
│       ├── notify.js                 # sendNotification() (Client-side)
│       ├── authErrors.js             # mapAuthError() لترجمة أكواد Firebase
│       ├── i18n.js                   # نظام الترجمة المخصص (FR/EN) — useTranslation()
│       ├── LanguageContext.js        # LanguageProvider + useLang() — يخزّن في localStorage
│       ├── fileLinks.js              # معالجة روابط الملفات
│       └── i18n/config.js            # (ملف قديم — غير مستخدم فعلياً)
└── package.json
```

---

## 3. ملفات lib/ — تفصيل دقيق

### طبقة Firebase

| الملف | يُصدّر | من يستخدمه |
|-------|--------|-----------|
| `firebase.js` | `app`, `auth`, `firestore`, `storage` | صفحات العميل — Client SDK Singleton (HMR-safe عبر getApps()) |
| `firebaseAdmin.js` | `adminDb`, `adminAuth`, `FieldValue`, `Timestamp`, `db` (alias), `snapToObj()`, `listSnap()`, `convertTimestamps()` | API routes فقط (Server-only) |
| `collectionNames.js` | `COL` — `{ USERS, GROUPS, MESSAGES, POSTS, NOTIFICATIONS, RESOURCES, JOIN_REQUESTS, REPORTS }` | عميل + سيرفر (خالٍ من Firebase imports) |
| `collections.js` | مراجع collections + Document Builders | API routes (Server-only) |
| `firestore.js` | `FieldValue` re-export + Admin helpers | API routes |

### طبقة المصادقة والأمان

| الملف | يُصدّر | الدور |
|-------|--------|-------|
| `withAuth.js` | `withAuth()`, `withAdmin()`, `withPublic()`, `withErrorHandling()`, `jsonOk()`, `jsonError()`, `safeJson()` | حماية API routes + معالجة أخطاء عالمية + timeout 10s |
| `verifyAdmin.js` | `verifyAdmin()`, `verifyAuth()`, `getUserByUid()` | التحقق من صلاحية Admin (fast-path claims + Firestore fallback) |
| `apiClient.js` | `api()`, `refreshIdToken()` | fetch wrapper: JWT + timeout 15s + auto-retry 401/403 |
| `useAuth.js` | `AuthProvider`, `useAuth()` | 3 effects: جلسة → snapshot → توجيه |
| `authErrors.js` | `mapAuthError()` | ترجمة أكواد Firebase إلى رسائل مفهومة |

### طبقة البيانات (Hooks)

| الملف | يُصدّر | الدور |
|-------|--------|-------|
| `useMyGroups.js` | `{ groups, officialGroups, regularGroups, loading, error }` | مجموعاتي (array-contains + status active + updatedAt desc) |
| `useAllGroups.js` | `{ groups, discoveryGroups, loading, error, isEmpty, isMember() }` | كل المجموعات العامة (isPublic true, limit 30) |
| `useChat.js` | `{ messages, sendMessage, loadMore, hasMore, joinRequests, pendingFiles, canOverseer }` | محرك الدردشة الكامل (3 listeners + optimistic + pagination) |
| `useMessages.js` | hook إضافي | إدارة الرسائل |
| `useJoinRequests.js` | hook | طلبات الانضمام |
| `useFileUpload.js` | hook | رفع الملفات |
| `useApi.js` | hook | استدعاءات API |

### طبقة المنطق (Utilities)

| الملف | يُصدّر | الدور |
|-------|--------|-------|
| `rankingSystem.js` | `getRank()`, `updateUserPoints()` | حساب الرتب والنقاط (Server-only، Transaction-safe) |
| `relevance.js` | `relevanceScore()`, `selectMajorMatched()`, `selectHighFrequency()`, `excludeIds()` | خوارزميات الاستكشاف الذكي (Pure functions) |
| `serverNotify.js` | `notifyUser()`, `notifyMany()`, `extractMentionedUids()` | إرسال إشعارات من السيرفر |
| `academicData.js` | `UNIVERSITIES`, `MAJORS`, `LEVELS`, `ALL`, `shortUni()`, `shortMajor()` | بيانات أكاديمية |
| `i18n.js` | `useTranslation()`, `translations` | نظام ترجمة FR/EN مخصص (يعتمد على `useLang`) |
| `LanguageContext.js` | `LanguageProvider`, `useLang()` | Context للغة (يُخزّن في localStorage) |
| `fileLinks.js` | helpers | معالجة روابط الملفات |

---

## 4. خريطة التوجيه

| المسار | من يصل إليه | آلية الحماية |
|--------|------------|-------------|
| `/` | الجميع (Landing) | عام — المسجل يُوجَّه تلقائياً |
| `/auth` | الزوار غير المسجلين | عام — المسجل يُوجَّه لـ /hub |
| `/pending` | المستخدم بانتظار الموافقة | `status === "pending"` |
| `/onboarding` | المستخدم الموافق عليه قبل إكمال ملفه | `status === "active" && !onboarded` |
| `/hub` | المستخدمون النشطون | `status === "active" && onboarded` |
| `/hub/chat/[id]` | أعضاء المجموعة فقط | عضوية + `onSnapshot` يتحقق لحظياً |
| `/explore` | المستخدمون النشطون | `status === "active" && onboarded` |
| `/groups/create` | المستخدمون النشطون | `status === "active" && onboarded` |
| `/groups/join` | المستخدمون النشطون | `status === "active" && onboarded` |
| `/profile` | المستخدم لملفه الشخصي | `status === "active" && onboarded` |
| `/profile/[uid]` | أي مستخدم نشط | `status === "active" && onboarded` |
| `/admin` | الأدمن فقط | `role === "admin"` |

**آلية التوجيه:** `lib/useAuth.js` — Effect 3 يراقب `userData` ويُوجّه حسب:
```
status: "pending"           → /pending
status: "onboarding"        → /onboarding
status: "active" + !onboarded → /onboarding
status: "active" + onboarded + في /auth أو /pending → /hub
```
**المسارات العامة** (`PUBLIC_PATHS`): فقط `"/"` و `"/auth"`

---

## 5. جدول Firestore Collections

| الاسم (`COL.X`) | الحقول الرئيسية | من يكتب | من يقرأ |
|----------------|----------------|---------|---------|
| `users` | `uid, email, fullName, matricule, studentCardUrl, status (pending/active/rejected), role (student/admin), onboarded, university, department, major, bio, avatarUrl, groups[], points, rank, socialLinks, createdAt, updatedAt` | API /register + /user/setup + Admin | useAuth(), API routes |
| `groups` | `name, subject, description, rules, tags[], accessType (open/protected), maxMembers (2-200), leaderId, leaderName, coLeaderIds[], members[], membersList[], memberCount, status, isPublic, isOfficial, officialType?, pinnedMessage?, createdAt, updatedAt` | /api/groups (POST) + /api/admin/groups | useMyGroups(), useAllGroups(), Explore |
| `messages` | `groupId, uid, content, senderName, role, fileUrl, fileName, fileType, fileSize, replyTo, moderationStatus (pending/approved), createdAt` | useChat.sendMessage() → addDoc direct | useChat() عبر onSnapshot |
| `posts` | `authorId, authorName, authorRole, authorAvatar, content, tag, fileUrl, fileName, likes (array[uid]), commentsCount, createdAt, updatedAt` | hub/page.js → addDoc + /api/posts | Hub عبر onSnapshot |
| `notifications` | `userId, title, body, link, type, read, createdAt` | serverNotify.js | NotificationCenter عبر onSnapshot |
| `resources` | `groupId, name, url, uid, uploader, status (pending/approved/rejected), createdAt` | /api/groups/[id]/resources (POST) | ResourcesSidebar |
| `join-requests` | `groupId, groupName, userId, userName, matricule, answers[], status (pending/approved/rejected), createdAt` | /api/groups/[id]/join-requests (POST) | OverseerPanel, useJoinRequests() |
| `reports` | `type (post/group/message), postId/groupId/messageId, targetUserId, reporterId, reporterName, reason, status (pending/dismissed/resolved), createdAt, reviewedAt?` | /api/.../report | AdminReportsTable |

**subcollections داخل `groups/{id}/`:** `events/`

---

## 6. Document Builders — `lib/collections.js`

كل كيان يملك **Builder** يتحقق من الحقول الإلزامية ويُطبّق القيم الافتراضية:

| الدالة | الحقول الإلزامية | ملاحظة |
|--------|----------------|--------|
| `buildUserDoc()` | `uid, email, fullName, matricule` | status افتراضي: "pending" |
| `buildGroupDoc()` | `name, leaderId` | maxMembers مقيّد: 2-200 |
| `buildMessageDoc()` | `groupId, authorId, text أو fileUrl` | — |
| `buildPostDoc()` | `authorId, authorName, content` | — |
| `buildNotificationDoc()` | `userId, title` | read: false تلقائياً |
| `buildResourceDoc()` | `groupId, name, url, uid` | status: "pending" تلقائياً |
| `buildJoinRequestDoc()` | `groupId, userId` | status: "pending" تلقائياً |

---

## 7. نظام نقاط المساهمة ورتب الطلاب

**ملف:** `lib/rankingSystem.js` — Server-only (Admin SDK)

| الفعل | النقاط |
|------|-------|
| إنشاء مجموعة | +15 |
| إعجاب مستلَم على منشورك | +2 |
| تعليق مستلَم على منشورك | +3 |
| رفع مورد وموافقة عليه | +20 |
| رفض مورد رفعته | -10 |
| تقرير مُغلق بـ "resolved" ضدك | -30 |

**الرتب (getRank):**

| الرتبة | الحد الأدنى |
|--------|-----------|
| مُبادِر | 0 نقطة |
| مُساهِم | 151 نقطة |
| باحِث | 501 نقطة |
| مَرجِع | 1501 نقطة |

`updateUserPoints(uid, amount)` يعمل داخل **Firestore Transaction** لتفادي race conditions.

---

## 8. نظام الترجمة

**الملفات:** `lib/i18n.js` + `lib/LanguageContext.js`

- يدعم **FR** و **EN** فقط
- يُخزّن اختيار اللغة في `localStorage`
- التبديل عبر زر في `Sidebar.js`
- `useTranslation()` يُعيد `{ t(key, vars?), lang }`
- المفاتيح موجودة لـ: sidebar، settings، landing، pending، profile، hub، explore، create، notif، report، admin
- **لا يستخدم i18next** رغم وجوده في package.json

---

✅ انتهت المرحلة 1 (مُحدَّثة 2026-05-20)
