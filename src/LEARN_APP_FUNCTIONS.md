# LEARN_APP_FUNCTIONS — المرحلة 3: API Routes

> مراجعة كاملة من قراءة الكود الفعلي. آخر تحديث: 2026-05-20.
>
> **آلية التحقق المشتركة:**
> - `withAuth(handler)` — Bearer Token → verifyIdToken → getDoc users/{uid} → تمرير `{ uid, user, decodedToken }`. يشمل `withErrorHandling` (timeout 10s).
> - `withAdmin(handler)` — `withAuth` + `user.role === "admin"` (Firestore check).
> - `withPublic(handler)` — فقط `withErrorHandling` (لا توكن مطلوب).
> - `verifyAdmin(req)` — Fast path: Custom Claims. Fallback: Firestore. يُستخدم في `GET /api/groups?mine=true` و routes الأدمن الأخرى.

---

## المصادقة

---

### `POST /api/register`

**الملف:** `app/api/register/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ fullName, matricule, password, studentCardFile (FormData) }` |
| **يرجع** | `{ success, uid }` (201) |
| **التحقق** | عام — لا توكن |
| **الخطوات** | 1. رفع بطاقة الهوية لـ Cloudinary. 2. `adminAuth.createUser(email, password)`. 3. `buildUserDoc()` → `users/{uid}` بـ `status: "pending"` |
| **Collections** | `users` (create) |

---

### `POST /api/login`

**الملف:** `app/api/login/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ matricule }` |
| **يرجع** | `{ email }` |
| **التحقق** | عام |
| **الغرض** | يبحث عن المستخدم بالـ matricule ويُعيد إيميله ليتمكن العميل من `signInWithEmailAndPassword` |

---

### `POST /api/auth/google-register`

**الملف:** `app/api/auth/google-register/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ matricule, studentCardFile (FormData) }` |
| **التحقق** | `withAuth()` — مستخدم Firebase Auth موجود لكن بدون وثيقة Firestore |
| **الخطوات** | رفع بطاقة → `buildUserDoc()` → `users/{uid}` |

---

## رفع الملفات

---

### `POST /api/upload`

**الملف:** `app/api/upload/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `FormData: { file, folder? }` |
| **يرجع** | `{ url, publicId, resourceType }` |
| **التحقق** | `withAuth()` |
| **المنطق** | `isImage` → `resource_type: "image"`, غيره → `resource_type: "raw"` (للـ PDF وغيره). يرفع عبر `cloudinary.uploader.upload_stream` |
| **الحد الأقصى** | 25MB (يُتحقق في العميل فقط) |

---

## المستخدم

---

### `POST /api/user/setup`

**الملف:** `app/api/user/setup/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ university, major, level, bio, avatarUrl }` |
| **يرجع** | `{ success, user }` |
| **التحقق** | `withAuth()` |
| **Collections** | يُحدّث `users/{uid}` → `{ onboarded: true, status: "active", ... }` + `autoJoinOfficialCommunities()` (3 مجموعات رسمية بـ transaction) |
| **ملاحظة** | فشل `autoJoinOfficialCommunities` لا يوقف الـ onboarding |
| **من يستدعيه** | `app/onboarding/page.js` → `handleFinalize()` |

---

### `GET /api/user/profile`

**الملف:** `app/api/user/profile/route.js`

| البند | التفاصيل |
|------|---------|
| **يرجع** | بيانات المستخدم الحالي كاملة من Firestore |
| **التحقق** | `withAuth()` |
| **من يستدعيه** | `lib/useAuth.js` |

---

### `GET /api/user/pending-requests`

**الملف:** `app/api/user/pending-requests/route.js`

| البند | التفاصيل |
|------|---------|
| **يرجع** | `{ pendingGroupIds: string[] }` |
| **التحقق** | `withAuth()` |
| **الغرض** | يُعيد IDs المجموعات التي للمستخدم طلب انضمام معلق فيها |

---

## البحث

---

### `GET /api/search`

**الملف:** `app/api/search/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ params** | `?q=<query>` (2+ حروف) |
| **يرجع** | `{ users[], groups[], posts[] }` — max 5 لكل نوع |
| **التحقق** | `withAuth()` |
| **آلية البحث** | Prefix match (`>=q` + `<=q`) متوازٍ على 4 queries في وقت واحد: users/fullName + users/matricule + groups/name + posts/content |
| **يتطلب** | Composite Indexes في Firestore: `(status, fullName)` + `(status, matricule)` + `(status, name)` |
| **من يستدعيه** | `SearchBar.js` |

---

## المجموعات

---

### `GET /api/groups`

**الملف:** `app/api/groups/route.js`

| الوضع | البند | التفاصيل |
|-------|------|---------|
| `?mine=false` (افتراضي) | **التحقق** | `withPublic()` — عام |
| ← | **يرجع** | كل المجموعات `status === "active"` مرتبة بـ updatedAt desc |
| `?mine=true` | **التحقق** | `verifyAuth(req)` يدوياً داخل الـ handler |
| ← | **يرجع** | مجموعات `members array-contains uid` + `status active` |

---

### `POST /api/groups`

**الملف:** `app/api/groups/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ name, subject, description, rules, tags, questions, maxMembers, accessType }` |
| **يرجع** | `{ id, success }` (201) |
| **التحقق** | `withAuth()` |
| **Collections** | `buildGroupDoc()` → `addDoc` في `groups` + `arrayUnion(groupId)` في `users/{uid}.groups` |
| **نقاط** | `updateUserPoints(uid, 15)` — غير متزامن (catch error silently) |
| **من يستدعيه** | `app/groups/create/page.js` → `handleSubmit()` |

---

### `GET /api/groups/[id]`

**الملف:** `app/api/groups/[id]/route.js`

| البند | التفاصيل |
|------|---------|
| **يرجع** | بيانات المجموعة الكاملة |
| **التحقق** | `withAuth()` |

---

### `DELETE /api/groups/[id]/members/[uid]`

**الملف:** `app/api/groups/[id]/members/[uid]/route.js`

| البند | التفاصيل |
|------|---------|
| **يرجع** | `{ ok }` |
| **التحقق** | القائد الأساسي أو co-leader |
| **القيود** | لا يمكن طرد القائد الأساسي. Co-leader لا يطرد co-leader آخر. |
| **Collections** | `arrayRemove(uid)` من `members[]`, `membersList[]`, `coLeaderIds[]` + `memberCount: increment(-1)` |
| **من يستدعيه** | `MemberListDrawer.js`, `OverseerPanel.js` |

---

### `PATCH /api/groups/[id]/members/[uid]/role`

**الملف:** `app/api/groups/[id]/members/[uid]/role/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ action: "promote" \| "demote" }` |
| **يرجع** | `{ action, uid }` |
| **التحقق** | القائد الأساسي فقط (`group.leaderId === callerUid`) |
| **Collections** | promote: `arrayUnion(targetUid)` في `coLeaderIds` + `membersList[].role = "Co-Leader"`. demote: `arrayRemove` + role = "Scholar" |

---

### `GET/POST /api/groups/[id]/join-requests`

**الملف:** `app/api/groups/[id]/join-requests/route.js`

| Method | الصلاحية | ماذا يفعل |
|--------|---------|---------|
| GET | القائد أو co-leader أو admin | يجلب طلبات `status: "pending"` |
| POST | المستخدم النشط | **open**: ينضم فوراً. **protected**: ينشئ طلب `status: "pending"` |

---

### `PATCH /api/groups/[id]/join-requests/[reqId]`

**الملف:** `app/api/groups/[id]/join-requests/[reqId]/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ status: "approved" \| "rejected" }` |
| **التحقق** | القائد أو co-leader أو admin |
| **عند الموافقة** | `arrayUnion(userId)` في `groups/{id}.members` + `memberCount: increment(1)` + `notifyMany()` للأعضاء |

---

### `GET/POST/PATCH/DELETE /api/groups/[id]/events`

**الملف:** `app/api/groups/[id]/events/route.js`

| Method | الصلاحية | ماذا يفعل |
|--------|---------|---------|
| GET | عضو أو admin | يجلب أحداث المجموعة من subcollection `events` مرتبة بالتاريخ |
| POST | leader/co-leader/admin | ينشئ حدثاً — body: `{ title, date, time?, description? }` |
| PATCH | leader/admin | يُعدّل حدثاً (body يحتوي `eventId`) |
| DELETE | leader/admin | يحذف حدثاً (body يحتوي `eventId`) |

**من يستدعيه:** `ResourcesSidebar.js` (تبويب Calendar)

---

### `PATCH /api/groups/[id]/messages/[msgId]/react`

**الملف:** `app/api/groups/[id]/messages/[msgId]/react/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ emoji }` — من: 👍❤️😂😮😢🔥 |
| **يرجع** | `{ ok, added }` |
| **التحقق** | عضو أو admin |
| **Collections** | toggle `arrayUnion/arrayRemove` على `messages/{msgId}.reactions.{emoji}[]` |

---

### `POST /api/groups/[id]/messages/[msgId]/report`

**الملف:** `app/api/groups/[id]/messages/[msgId]/report/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ reason }` — inappropriate / spam / harassment / misinformation / other |
| **يرجع** | `{ ok }` (201) |
| **التحقق** | عضو أو admin — مرة واحدة فقط لكل مستخدم |
| **Collections** | `addDoc` في `reports` بـ `type: "message"` |
| **إشعارات** | `notifyMany()` للقائد + co-leaders + admins |

---

### `PATCH /api/groups/[id]/pin`

**الملف:** `app/api/groups/[id]/pin/route.js`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ messageId: string }` أو `{ messageId: null }` لإلغاء التثبيت |
| **يرجع** | `{ ok }` |
| **التحقق** | القائد أو admin |
| **Collections** | يُحدّث `groups/{id}.pinnedMessage` → `{ id, content, senderName, pinnedAt }` أو `null` |

---

### `POST /api/groups/[id]/report`

**الملف:** `app/api/groups/[id]/report/route.js`

| البند | التفاصيل |
|------|---------|
| **يرجع** | `{ ok }` (201) |
| **التحقق** | عضو غير القائد — مرة واحدة فقط |
| **Collections** | `addDoc` في `reports` بـ `type: "group"` |
| **إشعارات** | `notifyMany()` لكل الأدمن → رابط `/admin?tab=reports` |

---

### `GET/POST/DELETE /api/groups/[id]/resources`

**الملف:** `app/api/groups/[id]/resources/route.js`

| Method | الصلاحية | ماذا يفعل |
|--------|---------|---------|
| GET | عضو | يجلب الموارد المعتمدة |
| POST | عضو | ينشئ مورداً بـ `status: "pending"` |
| DELETE | يحذف | — |

---

### `PATCH/DELETE /api/groups/[id]/resources/[resId]`

**الملف:** `app/api/groups/[id]/resources/[resId]/route.js`

| Method | الصلاحية | ماذا يفعل |
|--------|---------|---------|
| PATCH | القائد فقط | `{ action: "approve"\|"reject" }` — approve: +20 نقطة للرافع + إشعار. reject: -10 |
| DELETE | القائد فقط | يحذف المورد |

---

## المنشورات

---

### `GET /api/posts`

| البند | التفاصيل |
|------|---------|
| **الـ params** | `?limit=50` (max 100) |
| **التحقق** | `withPublic()` |
| **يرجع** | `{ posts: [...] }` ترتيب createdAt desc |

---

### `POST /api/posts`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ text, tag? }` |
| **التحقق** | `withAuth()` |
| **نقاط** | +5 لمنشئ المنشور |
| **ملاحظة** | `hub/page.js` يستخدم `addDoc` مباشرة بدلاً من هذا الـ route → النقاط لا تُضاف في هذه الحالة |

---

### `DELETE /api/posts/[id]`

**الملف:** `app/api/posts/[id]/route.js`

| البند | التفاصيل |
|------|---------|
| **التحقق** | صاحب المنشور أو admin |
| **يُستدعى من** | `AdminReportsTable.js` عند "Delete Content" لتقرير نوع post |

---

### `POST /api/posts/[id]/like`

| البند | التفاصيل |
|------|---------|
| **يرجع** | `{ likes: number, liked: boolean }` |
| **التحقق** | `withAuth()` |
| **Collections** | `runTransaction` على `posts/{id}.likes[]` — toggle arrayUnion/arrayRemove |
| **نقاط** | +2 لصاحب المنشور (إذا لم يكن هو المُعجِب) |

---

### `GET/POST /api/posts/[id]/comments`

| Method | البند | التفاصيل |
|--------|------|---------|
| GET | params | `?limit=100` (max 200) |
| GET | يرجع | `{ comments: [...] }` من `posts/{id}/comments` ترتيب createdAt asc |
| POST | body | `{ content, replyToCommentId? }` |
| POST | Collections | `runTransaction`: `set` في comments subcollection + `increment(1)` على `commentsCount` |
| POST | نقاط | +3 لصاحب المنشور (إذا لم يكن هو المعلِّق) |

---

### `POST /api/posts/[id]/report`

| البند | التفاصيل |
|------|---------|
| **القيود** | لا يمكن الإبلاغ عن منشورك الخاص — مرة واحدة فقط |
| **Collections** | `addDoc` في `reports` بـ `type: "post"` |
| **إشعارات** | `notifyMany()` لكل الأدمن |

---

## الملف الشخصي

---

### `GET /api/profile/[uid]`

| البند | التفاصيل |
|------|---------|
| **يرجع** | `{ uid, fullName, avatarUrl, rank, university, major, bio, socialLinks, points, createdAt, stats: { groupsCount, resourcesCount } }` |
| **التحقق** | `withAuth()` + المستخدم الهدف `status === "active"` |

---

### `GET /api/profile/stats`

| البند | التفاصيل |
|------|---------|
| **يرجع** | إحصائيات المستخدم الحالي |
| **التحقق** | `withAuth()` |

---

## الإشعارات

---

### `GET /api/notifications`

**يرجع:** قائمة إشعارات المستخدم.

### `GET/PATCH /api/notifications/[id]`

**PATCH:** يُحدّث `read: true`.

---

## الأدمن

---

### `GET /api/admin/users`

**يرجع:** كل المستخدمين. التحقق: `withAdmin()`.

---

### `PUT /api/admin/users/[uid]/approve`

| البند | التفاصيل |
|------|---------|
| **الخطوات** | 1. `verifyAdmin()`. 2. `users/{uid}` → `status: "active"`. 3. `setCustomUserClaims(uid, { role, status: "active" })`. 4. `revokeRefreshTokens(uid)` — يُجبر المستخدم على تجديد توكنه |
| **من يستدعيه** | `AdminPendingTable.js` |

---

### `POST /api/admin/users/[uid]/reject`

| البند | التفاصيل |
|------|---------|
| **الخطوات** | `users/{uid}` → `status: "rejected"` |

---

### `DELETE /api/admin/users/[uid]`

| البند | التفاصيل |
|------|---------|
| **التحقق** | `withAdmin()` |
| **يحذف** | `users/{uid}` |

---

### `PATCH/DELETE /api/admin/groups/[id]`

| Method | الـ body | ماذا يفعل |
|--------|---------|---------|
| PATCH | `{ action: "setLeader"\|"removeLeader", memberId? }` | يُحدّث `groups/{id}.leaderId` + `leaderName` |
| DELETE | — | `batch.delete`: المجموعة + messages + resources + joinRequests |

---

### `PATCH /api/admin/reports/[reportId]`

| البند | التفاصيل |
|------|---------|
| **الـ body** | `{ status: "dismissed" \| "resolved" }` |
| **التحقق** | `withAuth()` + `user.role === "admin"` |
| **Collections** | يُحدّث `status` + `reviewedAt` |
| **نقاط** | -30 لـ `report.targetUserId` عند `status === "resolved"` |

---

### `POST /api/admin/backfill-points`

| البند | التفاصيل |
|------|---------|
| **الغرض** | Migration لمرة واحدة: يحسب نقاط كل المستخدمين من النشاط التاريخي |
| **التحقق** | `verifyAdmin()` |
| **الحساب** | posts: +5 + (likes×2) + (comments×3). groups created: +15. approved resources: +20 |
| **يرجع** | `{ ok, usersUpdated, batchesCommitted, rankBreakdown }` |

---

### `POST /api/admin/sync-claims`

| البند | التفاصيل |
|------|---------|
| **الغرض** | تزامن Custom Claims في Firebase Auth لجميع المستخدمين أو مستخدم محدد |
| **التحقق** | `verifyAdmin()` |

---

## ملخص نظام النقاط

| الفعل | النقاط |
|------|-------|
| إنشاء مجموعة | +15 |
| إعجاب مستلَم على منشورك | +2 |
| تعليق مستلَم على منشورك | +3 |
| رفع مورد + موافقة عليه | +20 |
| رفض مورد رفعته | -10 |
| تقرير "resolved" ضدك | -30 |

---

✅ انتهت المرحلة 3 (مُحدَّثة 2026-05-20)
