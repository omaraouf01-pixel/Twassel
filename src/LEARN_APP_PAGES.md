# LEARN_APP_PAGES — المرحلة 2: الصفحات والمكونات

> مراجعة كاملة من قراءة الكود الفعلي. آخر تحديث: 2026-05-20.

---

## الصفحات

---

### 1. `app/layout.js` — الـ Layout العالمي

**الغرض:** يُلفّ كل التطبيق بثلاثة Providers ومتعدد الطبقات.

```
html[lang=en, dir=ltr]
  └── ThemeProvider        ← dark/light mode (next-themes)
        └── LanguageProvider  ← FR/EN (localStorage)
              └── AuthProvider ← جلسة المستخدم + توجيه ذكي
                    └── children
```

**Metadata:** `title: "Twassel - A cozy place for scholars"`

---

### 2. `app/page.js` — الصفحة الرئيسية (Landing)

**الغرض:** صفحة الترحيب للزوار مع عرض 3 ميزات وأزرار تسجيل/دخول.

**من يصل إليها:** الجميع — المستخدم المسجل يُوجَّه تلقائياً.

**البيانات:** `useAuth()` فقط.

**المكونات:** `TsswalLogo`، نصوص مترجمة عبر `useTranslation()`

**الدوال الرئيسية:**

| الدالة | ماذا تفعل |
|--------|----------|
| `useEffect` (routing) | إذا كان `userData` موجوداً يوجّهه حسب role/status/onboarded |

---

### 3. `app/auth/page.js` — صفحة الدخول والتسجيل

**الغرض:** بوابة واحدة للدخول (Login) والتسجيل (Register) بطرق متعددة.

**الحالات:** `mode = "login" | "register"` — تبديل بدون انتقال صفحة.

**الدوال الرئيسية:**

| الدالة | ماذا تفعل |
|--------|----------|
| `handleAuth()` | Login: POST /api/login → يحضر الإيميل → `signInWithEmailAndPassword`. Register: POST /api/register → تسجيل دخول |
| `handleOAuthSignIn(provider)` | تسجيل دخول بـ Google/GitHub عبر `signInWithPopup`. مستخدم جديد → يفتح `oauthModal` |
| `handleOAuthComplete()` | إرسال matricule + بطاقة الهوية لـ POST /api/auth/google-register |
| `handlePhoneStart()` | OTP عبر `signInWithPhoneNumber` + reCAPTCHA غير مرئي |
| `handlePhoneVerify()` | تأكيد رمز OTP عبر `confirmation.confirm()` |

**3 نماذج:** نموذج عادي + Phone Modal (OTP) + OAuth Completion Modal.

---

### 4. `app/pending/page.js` — انتظار الموافقة

**الغرض:** يُعلم المستخدم أن حسابه قيد المراجعة.

**البيانات:** `useAuth()` — يراقب `userData.status` لإعادة التوجيه عند الموافقة.

**الدوال:** `handleLogout()` → `signOut(auth)` ثم `/auth`

---

### 5. `app/onboarding/page.js` — إكمال الملف الشخصي

**الغرض:** جمع بيانات الجامعة + التخصص + المستوى + الصورة + Bio.

**3 مراحل:** step 1 (أكاديميا) → step 2 (صورة + bio) → step 3 (نجاح → `/hub`)

**الدوال الرئيسية:**

| الدالة | ماذا تفعل |
|--------|----------|
| `handleFinalize()` | يضبط `finalizingRef.current = true` ← يرفع الصورة ← POST /api/user/setup ← `window.location.replace("/hub")` |
| `handleImageChange()` | يضبط `imageFile` و `imagePreview` |

**Race Condition محلول:** `finalizingRef` يمنع Effect توجيه `useAuth` من قاطعة الـ API calls. بدونه: المستخدم يُوجَّه لـ /hub في المنتصف بصورة فارغة.

---

### 6. `app/explore/page.js` — استكشاف المجموعات

**الغرض:** عرض كل المجموعات العامة مع فلترة ذكية وبحث نصي.

**البيانات:**
- `useAllGroups()` — `isPublic: true`, limit 30 (real-time)
- `selectMajorMatched()` من `lib/relevance.js` — رف ذكي بالتخصص
- `selectHighFrequency()` من `lib/relevance.js` — رف Trending
- GET /api/user/pending-requests — الطلبات المعلقة

**المكونات:** `Sidebar`, `DiscoveryGrid`, `NodeShelf` (explore/), `JoinNodeModal` (explore/)

**الدوال الرئيسية:**

| الدالة | ماذا تفعل |
|--------|----------|
| `filteredNodes` (useMemo) | يفلتر حسب searchQuery + university + major + level |
| `majorMatched` (useMemo) | `selectMajorMatched(groups, userData)` |
| `highFrequency` (useMemo) | `selectHighFrequency(groups)` |
| `refreshPending()` | GET /api/user/pending-requests |

---

### 7. `app/hub/page.js` — الصفحة الرئيسية (Feed)

**الغرض:** عرض منشورات + كتابة منشور + تعليقات + إعجابات + بحث.

**البيانات:**
- `onSnapshot` على `posts` — آخر 25 منشوراً (desc)
- `onSnapshot` على `groups` — للـ Sidebar
- GET /api/posts/[id]/comments عند فتح تعليقات لأول مرة

**المكونات:** `Sidebar`, `SearchBar`, `NotificationCenter`, `ReportModal`

**الدوال الرئيسية:**

| الدالة | ماذا تفعل |
|--------|----------|
| `handleCreatePost()` | رفع الملف لـ /api/upload (اختياري) ثم `addDoc` مباشرة في `posts` |
| `handleLike(postId)` | Optimistic toggle + POST /api/posts/[id]/like |
| `toggleComments(postId)` | يجلب التعليقات مرة واحدة فقط (cache محلي) |
| `handleCommentSubmit(postId)` | Optimistic UI + POST /api/posts/[id]/comments + دعم الرد |

**ملاحظة:** المنشورات تُكتب مباشرة بـ `addDoc` — لذا نقاط +5 لا تُضاف إلا إذا استُخدم `POST /api/posts`.

---

### 8. `app/hub/chat/[id]/page.js` — صفحة الدردشة

**الغرض:** دردشة جماعية حية داخل مجموعة.

**فحص الصلاحيات (لحظي عبر onSnapshot):**
```js
// chat/[id]/page.js:59-67
const isMember = Array.isArray(data.members) && data.members.includes(user.uid);
const isAdmin  = userData.role === "admin";
const isLeader = data.leaderId === user.uid;
if (!isMember && !isAdmin && !isLeader) → setError("forbidden")
```

**Query Params:** `?from=admin` (رجوع للأدمن) + `?reports=1` (يفتح OverseerPanel على تبويب reports)

**البيانات:**
- `onSnapshot` على `groups/{id}` — بيانات المجموعة + فحص عضوية لحظي
- `useChat({ groupId, user, userData, group })` — رسائل + إرسال + إشراف
- `onSnapshot` على `groups` حيث `members array-contains uid` — للـ Sidebar

**المكونات:** `ChatHeader`, `MessageList`, `MessageInput`, `ActiveNodesSidebar`, `OverseerPanel`, `PinnedMessageBanner`, `GroupInfoPanel`

**Reply Flow:** `replyTo` state يُمرَّر من `MessageList` → `MessageInput`. زر X يُنظّف `onClearReply`.

---

### 9. `app/groups/create/page.js` — إنشاء مجموعة

**البيانات:** POST /api/groups فقط.

**نوع الوصول:** `open` (بدون أسئلة) أو `protected` (3 أسئلة لكل متقدم).

**الدوال:** `handleSubmit()` → POST /api/groups → `router.push("/hub/chat/{id}")`

---

### 10. `app/groups/join/page.js` — الانضمام

**البيانات:** `useAllGroups()` + onSnapshot لمجموعاتي + GET /api/user/pending-requests.

**المكونات:** `Sidebar`, `JoinNodeModal` (explore/), FilterDropdown

---

### 11. `app/profile/page.js` — ملفي الشخصي

**البيانات:** `useAuth()` + `onSnapshot` على groups + GET /api/profile/stats

**الدوال:**
- `handleSave()` — رفع صورة جديدة لـ /api/upload (إن تغيرت) + PUT /api/profile
- `formatJoinDate()` — تحويل Timestamp/string لتاريخ مقروء

---

### 12. `app/profile/[uid]/page.js` — ملف مستخدم آخر

**البيانات:** GET /api/profile/[uid] + `onSnapshot` على groups.

---

### 13. `app/admin/page.js` — لوحة الإدارة

**من يصل إليها:** `role === "admin"` فقط.

**البيانات (real-time):**
- `onSnapshot` على `users` (ترتيب createdAt desc)
- `onSnapshot` على `groups`
- `onSnapshot` على `reports` نوع post أو group

**التبويبات:** pending | users | groups | reports
- يفتح تلقائياً على **reports** إذا جاء من إشعار (`?tab=reports` في URL)

**المكونات:** `AdminPendingTable`, `AdminUsersTable`, `AdminGroupsTable`, `AdminReportsTable`, `IDCardModal`, `UserProfileModal`

---

## المكونات

---

### `Sidebar.js`

**الوظيفة:** شريط التنقل الجانبي الثابت (يُخفى عند عرض < 768px عبر `window.resize`).

**Props:** `currentUser` (userData), `groups` (array)

**يحسب داخلياً:**
```js
const myGroups = groups.filter(g => g.members.includes(uid) || g.leaderId === uid);
const officialGroups = myGroups.filter(g => g.isOfficial === true);  // Academic Hubs
const regularGroups  = myGroups.filter(g => !g.isOfficial);          // My Communities
```

**يحتوي على:**
- روابط تنقل (Hub / Explore / Profile) مترجمة بـ `useTranslation()`
- قسم "Academic Hubs" (مجتمعات رسمية بأيقونة BadgeCheck)
- قسم "My Communities" + زر + لإنشاء مجموعة جديدة
- `NotificationCenter` في الـ header
- `SettingsMenu` في الـ footer
- زر "Admin Panel" / "Back to Hub" للأدمن
- بطاقة المستخدم (اسم + تخصص + صورة) تنقل لـ /profile
- زر Logout

**لغة:** يستخدم `useLang()` + `useTranslation()` — زر EN/FR في footer

---

### `NotificationCenter.js`

**الوظيفة:** جرس الإشعارات مع قائمة منسدلة وعداد غير المقروءة.

**Props:** لا يحتاج props — `useAuth()` داخلياً.

**البيانات:** `onSnapshot` على `notifications` حيث `userId == user.uid`

**الدوال:**
- `markAllAsRead()` — `writeBatch` يُحدّث كل الإشعارات
- `markAsRead(id)` — `updateDoc` على notification واحدة

---

### `SearchBar.js`

**الوظيفة:** بحث عالمي مع debounce 300ms ونتائج منسدلة.

**Props:** `placeholder` (اختياري)

**البيانات:** GET /api/search?q=... عند 2+ حرف

**يعرض:** نتائج مجموعات + أشخاص + منشورات بـ UI منسدل

---

### `SelectionModal.js`

**الوظيفة:** modal اختيار عنصر من قائمة مع بحث داخلي + lock scroll.

**Props:** `isOpen, onClose, title, options (string[]), onSelect(val), selectedValue`

**يُستخدم في:** onboarding, groups/create, profile

---

### `UserBadge.js`

**الوظيفة:** شارة الرتبة الأكاديمية بأيقونة + لون.

**Props:** `rank` (string), `size ("sm" | "md")`

**الرتب:** مُبادِر / مُساهِم / باحِث / مَرجِع — كل منها لون + أيقونة مختلفة.

---

### `ThemeProvider.js`

**الوظيفة:** يُلفّ التطبيق بـ `ThemeProvider` من `next-themes` لدعم dark/light mode.

---

### `chat/MessageInput.js`

**الوظيفة:** حقل إدخال الرسائل مع ملفات + إيموجي + ردود.

**Props:** `groupId, group, sendMessage, replyTo, onClearReply`

**حالات خاصة:**
- `isMuted`: `group.isReadOnly` + ليس القائد/الأدمن → يُعرض نص "silenced"
- `isUniversityAnnouncement`: `group.officialType === "university"` + ليس أدمن → يُعرض banner إعلانات بدلاً من حقل الإدخال

**الدوال:**
- `handlePickFile()` — يتحقق الحجم ≤ 25MB
- `uploadFile(file)` — POST /api/upload مباشرة بـ `fetch` (لا `apiClient`)
- `handleSendMessage()` — رفع الملف (إن وجد) → `sendMessage()` من useChat
- `handleEmojiClick()` — يدرج إيموجي في موضع cursor الـ textarea

---

### `chat/MessageList.js`

**الوظيفة:** قائمة رسائل real-time مع auto-scroll + context menu + reactions + reply.

**Props:** `messages[], currentUser, groupLeaderId, groupId, canPin, onDeleteMessage, onReply, ...` (forwardRef للـ scroll)

**الدوال:** `parseReactions()`, `formatTime()`

---

### `chat/OverseerPanel.js`

**الوظيفة:** لوحة إشراف للـ leader/admin.

**التبويبات:** requests | files | settings

**البيانات:**
- `joinRequests` من `useChat` (في الـ canOverseer path)
- `pendingFiles` من `useChat` (رسائل بـ `moderationStatus: "pending"`)

---

### `chat/ResourcesSidebar.js`

**الوظيفة:** شريط جانبي للملفات والرزنامة.

**التبويبات:** all | media | files | links / calendar (عبر `CalendarSidebar`)

---

### `chat/MemberListDrawer.js`

**الوظيفة:** درج قائمة الأعضاء مع صلاحيات الطرد والترقية.

**الدوال:**
- طرد عضو → DELETE /api/groups/[id]/members/[uid]
- تغيير دور → PATCH /api/groups/[id]/members/[uid]/role
- `isOnline()` — يتحقق من `lastSeen` خلال آخر 3 دقائق

---

### `chat/PinnedMessageBanner.js`

**الوظيفة:** يعرض الرسالة المثبّتة في أعلى الدردشة.

**البيانات:** `group.pinnedMessage` → `{ id, content, senderName, pinnedAt }`

---

### `admin/AdminReportsTable.js`

**الوظيفة:** عرض التقارير (post/group) بـ card-based UI مع فلترة حسب النوع.

**Props:** `reports[]`

**الدوال:**
- `handleDismiss(report)` → PATCH /api/admin/reports/[id] `{status: "dismissed"}`
- `handleDeleteContent(report)` → حوار تأكيد ConfirmDialog → DELETE /api/posts/[id] أو DELETE /api/admin/groups/[id] → ثم PATCH status: "resolved"

**يعرض:** `ConfirmDialog` modal قبل الحذف النهائي.

---

### `admin/AdminUsersTable.js`

**الوظيفة:** جدول المستخدمين النشطين مع ترتيب بالنقاط.

**الدوال:** `handleDelete()` → DELETE /api/admin/users/[uid], `toggleSort()` للترتيب asc/desc

---

### `admin/AdminGroupsTable.js`

**الوظيفة:** جدول المجموعات مع حذف + طرد أعضاء + تبديل official.

**الدوال:** حذف → DELETE /api/admin/groups/[id]

---

### `admin/AdminPendingTable.js`

**الوظيفة:** جدول المستخدمين بحالة pending.

**الدوال:** Approve → POST /api/admin/users/[uid]/approve | Reject → POST /api/admin/users/[uid]/reject

---

### `admin/UserProfileModal.js`

**الوظيفة:** modal يعرض ملف شخصي كامل (email + matricule + جامعة + رتبة + روابط).

---

### `admin/IDCardModal.js`

**الوظيفة:** modal يعرض صورة بطاقة الهوية الطالبية للمراجعة.

---

✅ انتهت المرحلة 2 (مُحدَّثة 2026-05-20)
