# LEARN_APP_EXERCISES — المرحلة 4: مسارات العمليات

> يصف هذا الملف **تسلسل الدوال** لكل عملية رئيسية مع الملفات والأسطر الدقيقة.
> مراجعة كاملة من الكود الفعلي. آخر تحديث: 2026-05-20.

---

## 1. إنشاء حساب جديد (Signup)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleAuth()` | `app/auth/page.js` | يجمع fullName + matricule + password + studentCardFile |
| 2 | `POST /api/register` | `app/api/register/route.js` | يرفع بطاقة الهوية لـ Cloudinary + `adminAuth.createUser()` + `buildUserDoc()` → `users/{uid}` بـ `status: "pending"` |
| 3 | `signInWithEmailAndPassword()` | Firebase SDK (داخل `handleAuth`) | تسجيل الدخول الفوري |
| 4 | `useAuth` Effect 2 — `onSnapshot` | `lib/useAuth.js:48` | يقرأ `users/{uid}` ويرى `status: "pending"` |
| 5 | `useAuth` Effect 3 — توجيه | `lib/useAuth.js:83` | يُوجّه المستخدم لـ `/pending` |

**Collections المتأثرة:** `users` (create)

---

## 2. تسجيل الدخول (Login)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleAuth()` | `app/auth/page.js` | يرسل `matricule` لـ POST /api/login |
| 2 | `POST /api/login` | `app/api/login/route.js` | يبحث بالـ matricule ويُعيد الإيميل |
| 3 | `signInWithEmailAndPassword(auth, email, password)` | Firebase SDK | تسجيل الدخول الفعلي |
| 4 | `onIdTokenChanged` | `lib/useAuth.js:23` | يرى `firebaseUser` → `setUser(user)` + `setLoading(true)` |
| 5 | `onSnapshot(users/{uid})` | `lib/useAuth.js:48` | يجلب البيانات → `setUserData(data)` + `setLoading(false)` |
| 6 | Effect 3 — توجيه | `lib/useAuth.js:83` | يُوجّه حسب status + onboarded + role |

**قرارات التوجيه:**
- `status: "pending"` → `/pending`
- `status: "active"` + `!onboarded` → `/onboarding`
- `status: "active"` + `onboarded` + `role: "admin"` → `/admin`
- `status: "active"` + `onboarded` → `/hub`

---

## 3. تسجيل الدخول بـ OAuth (Google/GitHub)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleOAuthSignIn(provider)` | `app/auth/page.js` | `signInWithPopup(auth, provider)` |
| 2 | فحص `isNewUser` | Firebase SDK | إذا كان مستخدماً جديداً: يفتح `oauthModal` |
| 3 | `handleOAuthComplete()` | `app/auth/page.js` | POST /api/auth/google-register (matricule + بطاقة) |
| 4 | `useAuth` onSnapshot | `lib/useAuth.js` | نفس مسار Login من الخطوة 5 |

---

## 4. موافقة الأدمن على مستخدم

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | زر "Approve" | `components/admin/AdminPendingTable.js` | POST /api/admin/users/[uid]/approve |
| 2 | `verifyAdmin(req)` | `lib/verifyAdmin.js` | Fast-path claims أو Firestore fallback |
| 3 | تحديث Firestore | `app/api/admin/users/[uid]/approve/route.js` | `users/{uid}` → `status: "active"` |
| 4 | `setCustomUserClaims` | Firebase Admin | يضع `{ role, status: "active" }` في Custom Claims |
| 5 | `revokeRefreshTokens(uid)` | Firebase Admin | يُبطل التوكن القديم → يُجبر على تجديده |
| 6 | `onSnapshot` على جانب المستخدم | `lib/useAuth.js:61` | يرى `status: "active"` → يطلب `getIdToken(true)` → يُوجّه لـ `/onboarding` |

**ملاحظة حيوية:** الخطوة 5 إلزامية — بدونها يحتفظ المستخدم بتوكن قديم يحمل `status: "pending"` في Claims.

---

## 5. إتمام الـ Onboarding

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | المستخدم يملأ 3 خطوات | `app/onboarding/page.js` | جامعة + تخصص + مستوى + صورة + bio |
| 2 | `handleFinalize()` | `app/onboarding/page.js` | `finalizingRef.current = true` ← يمنع race condition |
| 3 | POST /api/upload | `app/api/upload/route.js` | يرفع صورة الملف لـ Cloudinary → يُعيد URL |
| 4 | `POST /api/user/setup` | `app/api/user/setup/route.js` | يُحدّث `users/{uid}` → `{ onboarded: true, university, major, level... }` |
| 5 | `autoJoinOfficialCommunities()` | داخل route.js | transaction: ينشئ/يُضيف المستخدم لـ 3 مجموعات رسمية (جامعة + تخصص + سنة) |
| 6 | `window.location.replace("/hub")` | `app/onboarding/page.js` | انتقال صارم (بدون history entry) — بعد نجاح الخطوة 4 |

**Collections:** `users/{uid}` (update) + `groups` (upsert 3 مجموعات)

---

## 6. إنشاء مجموعة

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | المستخدم يملأ النموذج | `app/groups/create/page.js` | اسم + وصف + جامعة + تخصص + مستوى + نوع وصول + أسئلة |
| 2 | `handleSubmit()` | `app/groups/create/page.js` | POST /api/groups |
| 3 | `withAuth()` | `lib/withAuth.js:67` | verifyIdToken + getDoc users |
| 4 | `buildGroupDoc()` + `addDoc` | `app/api/groups/route.js:71` | ينشئ المجموعة بـ `leaderId: uid, members: [uid], memberCount: 1` |
| 5 | `arrayUnion(groupId)` | ← | يُضيف في `users/{uid}.groups` |
| 6 | `updateUserPoints(uid, 15)` | `lib/rankingSystem.js` | +15 نقطة (غير متزامن) |
| 7 | `router.push("/hub/chat/{id}")` | `app/groups/create/page.js` | انتقال للدردشة |

---

## 7. الانضمام لمجموعة

### أ) مجموعة مفتوحة (`accessType: "open"`)

| # | الخطوة | الملف |
|---|--------|-------|
| 1 | `setSelectedNode(group)` | `app/explore/page.js` أو `app/groups/join/page.js` |
| 2 | زر "Join" في `JoinNodeModal` | `components/explore/JoinNodeModal.js` |
| 3 | POST /api/groups/[id]/join-requests | `app/api/groups/[id]/join-requests/route.js` |
| 4 | `accessType === "open"` → `arrayUnion(uid)` في `members` + `increment(1)` | ← |
| 5 | يُعاد `{ status: "joined" }` — الدخول فوري | ← |

### ب) مجموعة محمية (`accessType: "protected"`)

| # | الخطوة | الملف |
|---|--------|-------|
| 1-2 | كما سبق + المستخدم يُجيب على أسئلة القبول | ← |
| 3 | POST /api/groups/[id]/join-requests | `app/api/groups/[id]/join-requests/route.js:48` |
| 4 | `buildJoinRequestDoc()` → `addDoc` في `join-requests` بـ `status: "pending"` | ← |
| 5 | القائد يرى الطلب في OverseerPanel | `chat/OverseerPanel.js` |
| 6 | زر Approve/Reject → PATCH /api/groups/[id]/join-requests/[reqId] | ← |
| 7 | عند الموافقة: `arrayUnion(uid)` في `members` + `increment(1)` + `notifyMany()` | route.js |

---

## 8. إرسال رسالة في الدردشة

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | المستخدم يكتب | `components/chat/MessageInput.js` | يضبط `content` state في textarea |
| 2 | يضغط Enter أو زر Send | ← | يستدعي `handleSendMessage(e)` |
| 3 | يتحقق من `isMuted` و `content.trim()` | `MessageInput.js:108` | يمنع الإرسال إن كان مكتوم |
| 4 | `sendMessage({ content, ... })` | `MessageInput.js:139` | يستدعي الدالة من `useChat` |
| 5 | **Optimistic UI** | `lib/useChat.js:211` | ينشئ رسالة مؤقتة بـ `tempId` ويضيفها لـ `optimistic` state فوراً |
| 6 | `addDoc(collection(db, COL.MESSAGES), {...})` | `lib/useChat.js:232` | يكتب في Firestore |
| 7 | `onSnapshot` يستقبل الرسالة الحقيقية | `lib/useChat.js:85` | يُزيل الـ optimistic المطابقة ويُضيف الحقيقية |

**moderationStatus:** إذا كان المرسل **ليس** leader/admin وأرسل ملفاً → `moderationStatus: "pending"` (يحتاج موافقة القائد).

---

## 9. رفع مرفق في الدردشة

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handlePickFile(e)` | `MessageInput.js:76` | يتحقق الحجم ≤ 25MB → `setPendingFile({file, name, type, size})` |
| 2 | `handleSendMessage(e)` | `MessageInput.js:119` | يرى `pendingFile` → يبدأ الرفع |
| 3 | `uploadFile(pendingFile.file)` | `MessageInput.js:93` | POST /api/upload بـ `folder: tawassol/groups/{groupId}` مباشرة بـ `fetch` |
| 4 | `sendMessage({ ..., fileUrl, fileName, fileType, fileSize })` | `lib/useChat.js:196` | يُنشئ رسالة مع بيانات الملف |

**تحذير:** الملف يُرفع لـ Cloudinary أولاً — إذا نجح الرفع وفشل `addDoc` يبقى الملف على Cloudinary بدون رسالة.

---

## 10. إنشاء منشور (Post)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | المستخدم يكتب نصاً + ملف اختياري | `app/hub/page.js` | يضبط `postText` و `postFile` |
| 2 | `handleCreatePost()` | `app/hub/page.js` | إذا كان هناك ملف → POST /api/upload أولاً |
| 3 | `addDoc(postsRef, {...})` | `app/hub/page.js` | يكتب مباشرة في `posts` — **لا يمر بـ API route** |

**ملاحظة:** نقاط +5 لمنشئ المنشور موجودة **فقط** في `POST /api/posts` — الصفحة تستخدم `addDoc` مباشرة فلا تُضاف النقاط.

---

## 11. الإعجاب بمنشور

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleLike(postId)` | `app/hub/page.js` | Optimistic toggle: يعكس الحالة في الـ UI فوراً |
| 2 | POST /api/posts/[id]/like | `app/api/posts/[id]/like/route.js` | `withAuth()` |
| 3 | `runTransaction` | ← | toggle `arrayUnion/arrayRemove` على `likes[]` |
| 4 | `updateUserPoints(ownerId, 2)` | ← | +2 لصاحب المنشور (إذا لم يكن هو نفسه) |

---

## 12. إضافة تعليق

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleCommentSubmit(postId)` | `app/hub/page.js` | يضيف التعليق للـ cache المحلي (Optimistic UI) |
| 2 | POST /api/posts/[id]/comments | `app/api/posts/[id]/comments/route.js` | `withAuth()` |
| 3 | `runTransaction` | ← | `set` في subcollection + `increment(1)` على `commentsCount` |
| 4 | `updateUserPoints(ownerId, 3)` | ← | +3 لصاحب المنشور |

**دعم الردود:** `replyToCommentId` في الـ body.

---

## 13. الإبلاغ عن محتوى

### أ) رسالة في الدردشة

| # | الخطوة | الملف |
|---|--------|-------|
| 1 | Context menu → "Report" | `components/chat/MessageList.js` |
| 2 | POST /api/groups/[id]/messages/[msgId]/report | route.js |
| 3 | `addDoc` في `reports` بـ `type: "message"` + `notifyMany()` للقائد + co-leaders + admins | ← |

### ب) منشور

| # | الخطوة | الملف |
|---|--------|-------|
| 1 | زر Report في `ReportModal` | `app/hub/page.js` |
| 2 | POST /api/posts/[id]/report | route.js |
| 3 | `addDoc` في `reports` بـ `type: "post"` + `notifyMany()` لكل الأدمن | ← |

### ج) مجموعة

| # | الخطوة | الملف |
|---|--------|-------|
| 1 | زر إبلاغ في صفحة الدردشة | `app/hub/chat/[id]/page.js` |
| 2 | POST /api/groups/[id]/report | route.js |
| 3 | `addDoc` في `reports` بـ `type: "group"` + `notifyMany()` لكل الأدمن | ← |

**قيود مشتركة:** مرة واحدة لكل مستخدم — لا يمكن الإبلاغ عن محتواك الخاص (في المنشورات).

---

## 14. الإشراف على تقرير (الأدمن)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleDismiss(report)` | `components/admin/AdminReportsTable.js:176` | PATCH /api/admin/reports/[id] → `{ status: "dismissed" }` |
| 2 | `handleDeleteContent(report)` | `AdminReportsTable.js:192` | يفتح `ConfirmDialog` modal |
| 3 | `confirmDelete()` | `AdminReportsTable.js:196` | **نوع post:** DELETE /api/posts/[id]. **نوع group:** DELETE /api/admin/groups/[id] |
| 4 | ← | ← | ثم PATCH /api/admin/reports/[id] → `{ status: "resolved" }` |
| 5 | `updateUserPoints(targetUserId, -30)` | `app/api/admin/reports/[reportId]/route.js` | -30 نقطة للمُبلَّغ عنه |

---

## 15. طرد عضو من مجموعة

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | زر "Kick" | `chat/MemberListDrawer.js` أو `chat/OverseerPanel.js` | DELETE /api/groups/[id]/members/[uid] |
| 2 | التحقق من الصلاحية | route.js | القائد أو co-leader — مع القيود: لا يطرد القائد أو co-leader آخر |
| 3 | `arrayRemove(uid)` | ← | من `members[]` + `membersList[]` + `coLeaderIds[]` |
| 4 | `memberCount: increment(-1)` | ← | ← |

---

## 16. تغيير دور عضو (promote/demote)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | زر "Promote"/"Demote" | `chat/MemberListDrawer.js` | PATCH /api/groups/[id]/members/[uid]/role |
| 2 | التحقق | route.js | القائد الأساسي فقط (`group.leaderId === callerUid`) |
| 3 | promote | ← | `arrayUnion(targetUid)` في `coLeaderIds` + `membersList[].role = "Co-Leader"` |
| 4 | demote | ← | `arrayRemove` من `coLeaderIds` + `role = "Scholar"` |

---

## 17. حذف مجموعة (من الأدمن)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | `handleDelete(groupId)` | `components/admin/AdminGroupsTable.js` | DELETE /api/admin/groups/[id] |
| 2 | `verifyAdmin()` | `lib/verifyAdmin.js` | ← |
| 3 | `batch.delete(groupRef)` | route.js | يحذف وثيقة المجموعة |
| 4 | حذف الرسائل | ← | `batch.delete` كل `messages` حيث `groupId == id` |
| 5 | حذف الموارد | ← | `batch.delete` كل `resources` حيث `groupId == id` |
| 6 | حذف طلبات الانضمام | ← | `batch.delete` كل `joinRequests` حيث `groupId == id` |
| 7 | `batch.commit()` | ← | عملية atomic — إما كلها أو لا شيء |

---

## 18. تثبيت رسالة (Pin)

| # | الدالة / الخطوة | الملف | ماذا تفعل |
|---|----------------|-------|----------|
| 1 | Context menu → "Pin" | `chat/MessageList.js` | PATCH /api/groups/[id]/pin |
| 2 | `withAuth()` + `canPin` check | route.js | القائد أو admin فقط |
| 3 | `groups/{id}.pinnedMessage = { id, content, senderName, pinnedAt }` | ← | ← |
| 4 | `PinnedMessageBanner` يرى التغيير | `chat/PinnedMessageBanner.js` | onSnapshot على `groups/{id}` يحدّث الـ UI فوراً |

---

## ملخص Collections حسب العمليات

| Collection | عمليات الكتابة الرئيسية |
|-----------|----------------------|
| `users` | Signup (create) · Admin approve (update status) · Onboarding (update) · Create group (update groups[]) · Points (update points/rank) |
| `groups` | Create · Join (update members) · Kick member · Delete (admin batch) · Change role · Pin message · Promote/Demote |
| `join-requests` | Join protected (create) · Approve/Reject (update) · Delete group (batch delete) |
| `posts` | Create (addDoc مباشر) · Like (update likes[]) · Comment (update commentsCount) · Delete |
| `posts/{id}/comments` | Add comment (create subcollection) |
| `messages` | Send (addDoc مباشر من useChat) · Upload attachment |
| `reports` | Report message/post/group (create) · Admin review (update status) |
| `notifications` | Admin approve · Resource approved/rejected · New member · @mention |
| `resources` | Upload (create) · Approve/Reject (update status) · Delete (batch) |
| `groups/{id}/events` | Create/Edit/Delete events (subcollection) |

---

✅ انتهت المرحلة 4 (مُحدَّثة 2026-05-20)
