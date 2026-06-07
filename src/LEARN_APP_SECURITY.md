# LEARN_APP_SECURITY — المرحلة 5: الأمان والدوال المهمة

> مراجعة كاملة من قراءة الكود الفعلي. آخر تحديث: 2026-05-20.

---

## 1. نظام المصادقة — `lib/useAuth.js`

### البنية الكاملة: 3 Effects متسلسلة

```
app/layout.js
  └── AuthProvider (useAuth.js)
        ├── Effect 1: onIdTokenChanged       ← مراقبة الجلسة
        ├── Effect 2: user.getIdToken → onSnapshot(users/{uid}) ← جلب البيانات
        └── Effect 3: userData + pathname → router.replace()  ← التوجيه الذكي
```

---

#### Effect 1 — مراقبة الجلسة (`onIdTokenChanged`)

```js
// lib/useAuth.js:22-35
onIdTokenChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    setLoading(true); // يبقى true حتى Effect 2 ينتهي
    setUser(firebaseUser);
  } else {
    setUser(null);
    setUserData(null);
    setLoading(false);
  }
});
```

**لماذا `onIdTokenChanged` وليس `onAuthStateChanged`؟** لأنه يُطلق أيضاً عند تجديد الـ Token — يُمكّن Effect 2 من إعادة ربط الـ listener بتوكن محدّث.

---

#### Effect 2 — المستمع اللحظي + بيانات أولية + تجديد التوكن

```js
// lib/useAuth.js:39-80
user.getIdToken().then(() => { // ← يضمن أن Firestore ستعرف الجلسة قبل الـ listener
  unsub = onSnapshot(doc(db, COL.USERS, user.uid), async (snapshot) => {
    const data = snapshot.data();

    // إذا تغيرت الحالة (مثلاً pending → active بعد موافقة الأدمن)
    // اطلب توكن جديد لتزامن الـ Custom Claims مع Firestore
    if (lastStatus !== null && lastStatus !== data.status) {
      await auth.currentUser?.getIdToken(true);  // force refresh
    }
    lastStatus = data.status;
    setUserData(data);
    if (!firstFired) { firstFired = true; setLoading(false); }
  });
});
```

**لماذا `getIdToken()` قبل ربط onSnapshot؟** لأن Firestore تحتاج أن تعرف الـ JWT قبل تنفيذ أي استعلام محمي بـ Security Rules.

---

#### Effect 3 — منطق التوجيه الذكي

```js
// lib/useAuth.js:83-112
const PUBLIC_PATHS = ["/", "/auth"];

// لا مستخدم في مسار محمي → /auth
if (!userData && !PUBLIC_PATHS.includes(path)) → router.replace("/auth")

// ترتيب الفحوصات:
if (status === "onboarding" && path !== "/onboarding")           → /onboarding
else if (status === "pending" && ...)                            → /pending
else if (status === "active" && !onboarded && ...)               → /onboarding
else if (status === "active" && onboarded && (path === "/auth" || path === "/pending")) → /hub
```

**استثناء حيوي:** `if (status === "active" && onboarded && path === "/onboarding") return;`
← يسمح بالبقاء في /onboarding بعد الإنهاء مباشرةً لتجنب Race Condition مع `finalizingRef`.

---

### `mapAuthError()` — ترجمة أخطاء Firebase Auth

**الملف:** `lib/authErrors.js`

| كود Firebase | الرسالة المعروضة |
|-------------|----------------|
| `auth/invalid-credential` أو `auth/invalid-login-credentials` | "Invalid credentials." |
| `auth/user-not-found` | "No account found with these details." |
| `auth/wrong-password` | "Incorrect password." |
| `auth/email-already-in-use` | "This email is already in use." |
| `auth/weak-password` | "Password too weak (at least 6 characters)." |
| `auth/invalid-email` | "Invalid email format." |
| `auth/too-many-requests` | "Too many attempts — please wait and retry." |
| `auth/network-request-failed` + رسائل تحتوي "network"/"fetch" | "Network error — check your connection." |
| رسائل تحتوي "not found" | "Academic account not found." |
| غير معروف | الرسالة الخام أو "Authentication error." |

---

## 2. حماية API Routes

### `withAuth()` — `lib/withAuth.js:67`

```
الخوارزمية:
1. قراءة header: "Authorization: Bearer <token>"
   → إذا غائب: 401 "Authentication required (No Token)"

2. adminAuth.verifyIdToken(token)
   → يتحقق من التوقيع + انتهاء الصلاحية
   → إذا فشل: 401 "Invalid or expired session"

3. adminDb.collection("users").doc(uid).get()
   → يتأكد من وجود الحساب في Firestore
   → إذا غائب: 401 "User record not found"

4. تمرير { uid, user, decodedToken } للـ handler
```

**Timeout:** `withErrorHandling` يُشغّل كل handler مع `withTimeout(10000ms)` → 504 عند التجاوز.

---

### `withAdmin()` — `lib/withAuth.js:99`

```js
// يُشغّل withAuth أولاً ثم:
if (auth.user.role !== "admin") return jsonError("Admin privileges required", 403);
```

الفرق عن `verifyAdmin`: يتحقق **فقط من Firestore** — لا يستخدم Custom Claims Fast-Path.

---

### `verifyAdmin()` — `lib/verifyAdmin.js:81`

**خوارزمية ذكية ثنائية المسار:**

```
1. extractIdentity(request):
   - يستخرج JWT من header
   - يتحقق أن الـ string هو JWT حقيقي (3 segments + طول > 100)
   - adminAuth.verifyIdToken(token) → { uid, claims }

2. Fast Path: إذا claims.admin === true → موافقة فورية بدون Firestore (أسرع)

3. Fallback (لا claim): يقرأ Firestore ويتحقق من role === "admin"
   + Auto-sync: يضع Custom Claim في الخلفية للطلبات القادمة
```

**مقارنة `withAdmin` vs `verifyAdmin`:**

| | `withAdmin` | `verifyAdmin` |
|--|------------|--------------|
| **يتحقق من** | Firestore فقط | Claims (fast) ثم Firestore (fallback) |
| **يُستخدم في** | معظم routes الأدمن | routes تحتاج سرعة + ترقية يدوية |
| **من يستدعيه** | `/api/admin/**` عبر `withAdmin()` | `verifyAdmin(req)` يدوياً + `GET /api/groups?mine=true` |

---

### `api()` — `lib/apiClient.js`

**Wrapper للاستدعاءات من العميل:**

```
1. auth.currentUser.getIdToken(forceRefresh?) → token من cache أو مجدَّد

2. AbortController + timeout 15s → يقطع الطلبات المعلقة

3. fetch مع:
   - Authorization: Bearer <token>
   - Content-Type: application/json (إلا FormData)

4. Auto-retry على 401/403:
   يُعيد الطلب مرة واحدة بـ forceRefresh=true
   (لحالة Custom Claims حديثة لم تنتشر بعد)

5. !res.ok → throw Error مع status + data
```

---

## 3. نظام الصلاحيات

### التحقق من عضوية الدردشة

```js
// app/hub/chat/[id]/page.js:59-67
// يُنفَّذ داخل onSnapshot → يُعاد التحقق في كل تغيير
const isMember = Array.isArray(data.members) && data.members.includes(user.uid);
const isAdmin  = userData.role === "admin";
const isLeader = data.leaderId === user.uid;

if (!isMember && !isAdmin && !isLeader) {
  setError("forbidden");
  return;
}
```

**لماذا داخل onSnapshot؟** إذا طُرد العضو أثناء الجلسة، يرى صفحة "forbidden" فوراً بدون إعادة تحميل.

---

### خريطة الصلاحيات الكاملة

| العملية | student | leader | co-leader | admin |
|---------|---------|--------|-----------|-------|
| قراءة الرسائل | ✅ (عضو) | ✅ | ✅ | ✅ |
| إرسال رسالة | ✅ | ✅ | ✅ | ✅ |
| إرسال ملف | ✅ (pending) | ✅ | ✅ | ✅ |
| تثبيت رسالة | ❌ | ✅ | ❌ | ✅ |
| طرد عضو | ❌ | ✅ | ✅ (لا يطرد co-leader) | ✅ |
| ترقية/تخفيض | ❌ | ✅ | ❌ | ❌ |
| الموافقة على موارد | ❌ | ✅ | ❌ | ✅ |
| قبول/رفض طلبات | ❌ | ✅ | ✅ | ✅ |
| حذف المجموعة | ❌ | ❌ | ❌ | ✅ |
| الإبلاغ عن مجموعة | ✅ (غير القائد) | ❌ | ❌ | ❌ |

---

### ما يحدث عند الوصول غير المصرح به

| السيناريو | الاستجابة |
|----------|----------|
| لا توكن في الـ header | `401 "Authentication required (No Token)"` |
| توكن منتهي أو مزوّر | `401 "Invalid or expired session"` |
| حساب غير موجود في Firestore | `401 "User record not found in database"` |
| مستخدم موجود لكن ليس أدمناً → admin route | `403 "Admin privileges required"` |
| مستخدم غير عضو يحاول فتح دردشة | UI: `setError("forbidden")` → صفحة خطأ |
| Firestore Permission Denied | UI: `setError("forbidden")` من onSnapshot error handler |
| Timeout (> 10s في الـ API) | `504 "Server timeout"` |

---

## 4. نقاط حرجة في الكود (Gotchas)

### Race Condition في Onboarding

**المشكلة:** عند انتهاء `handleFinalize()` → `users/{uid}.onboarded = true` → `onSnapshot` في `useAuth` يرى التغيير → Effect 3 يُشغّل `router.replace("/hub")` **قبل** أن ينتهي الـ `window.location.replace` في `handleFinalize`.

**الحل — `finalizingRef`:**
```js
// app/onboarding/page.js
const finalizingRef = useRef(false);

const handleFinalize = async () => {
  finalizingRef.current = true;    // ← يُعطّل توجيه useAuth
  // ... API calls ...
  window.location.replace("/hub"); // ← انتقال صارم بعد الإنهاء
};

// في useEffect التوجيه داخل onboarding:
if (finalizingRef.current) return; // ← يتجاهل الـ snapshot أثناء الحفظ
```

**لا تزيل `finalizingRef`** — بدونه يُوجَّه المستخدم في المنتصف بصورة فارغة.

---

### تزامن التوكن بعد موافقة الأدمن

**المشكلة:** الأدمن يُحدّث `status: "active"` في Firestore — لكن التوكن الحالي للمستخدم لا يزال يحمل `status: "pending"` في Custom Claims → Firestore Security Rules قد ترفض بعض الطلبات.

**الحل — `getIdToken(true)` في Effect 2:**
```js
// lib/useAuth.js:61-67
if (lastStatus !== null && lastStatus !== data.status) {
  await auth.currentUser?.getIdToken(true);  // force refresh → توكن جديد مع claims محدّثة
}
```

**+ في جانب الأدمن:** `adminAuth.revokeRefreshTokens(uid)` يُبطل التوكن القديم فوراً.

---

### حلقات Re-renders من `onSnapshot`

**المشكلة:** وضع `onSnapshot` داخل `useEffect` مع dependency يتغير بكل render → subscription تُعاد في كل render → تسريب ذاكرة.

```js
// ❌ خطأ — userData object جديد في كل render
useEffect(() => {
  const unsub = onSnapshot(...);
  return () => unsub();
}, [userData]);  // ← يتغير مع كل snapshot

// ✅ صح — قيمة primitive ثابتة
useEffect(() => {
  const unsub = onSnapshot(...);
  return () => unsub();
}, [userData?.uid]);  // ← uid string لا يتغير إلا عند تسجيل دخول/خروج
```

**في `useMyGroups.js` و `useAllGroups.js`:** `mountedRef.current` يمنع `setState` بعد unmount.

---

### moderationStatus في الدردشة المحمية

**المشكلة:** في المجموعات المحمية (`accessType: "protected"`)، ملفات الأعضاء العاديين تظهر بـ `moderationStatus: "pending"` وتحتاج موافقة القائد — لكن الأعضاء الآخرين لا يجب أن يروها قبل الموافقة.

**منطق الفلترة في `useChat.js`:**
```js
// lib/useChat.js:266-271
filtered = merged.filter((m) => {
  if (!m.fileUrl) return true;                        // النصوص دائماً مرئية
  if (m.moderationStatus === "approved") return true; // ملفات معتمدة
  if (canOverseer) return true;                       // المشرف يرى المعلّق
  if (m.uid === user?.uid) return true;               // صاحب الملف يرى ملفه
  return !isProtected;                               // المجموعة المفتوحة تظهر المعلّق
});
```

---

### getIdToken قبل onSnapshot في Effect 2

```js
// lib/useAuth.js:47
user.getIdToken().then(() => {
  unsub = onSnapshot(...);
});
```

**لماذا؟** Firestore تحتاج أن "تعرف" الـ JWT قبل قبول أي listener. بدون هذا، قد يفشل أول snapshot بـ `permission-denied` حتى لو كان المستخدم مسجلاً.

---

## 5. طبقات الأمان — الملخص

```
الطبقة 1 (Client-side)
  ├── useAuth.js Effect 3 → يُوجّه للصفحة المناسبة
  ├── chat/[id]/page.js → onSnapshot يتحقق من members[] لحظياً
  └── MessageInput.js → isMuted + isUniversityAnnouncement

الطبقة 2 (API Layer)
  ├── lib/apiClient.js → JWT في كل طلب + auto-retry 401/403
  ├── lib/withAuth.js → withAuth() / withAdmin() / withPublic() + timeout 10s
  └── lib/verifyAdmin.js → verifyAdmin() / verifyAuth() (Fast-path Claims + Fallback)

الطبقة 3 (Firestore Security Rules)
  └── firestore.rules — الحماية النهائية (غير موجودة في الـ repo)
      تعتمد على Custom Claims من Firebase Auth
```

---

## 6. نقاط ضعف معروفة

| الثغرة | التفاصيل | التوصية |
|--------|---------|--------|
| **Upload بدون JWT** في MessageInput | `uploadFile()` يستخدم `fetch` مباشرة بدون Bearer Token! لكن الـ API route يتطلب `withAuth()` — قد يفشل إذا انتهى التوكن أثناء الرفع | استخدام `apiClient.api()` بدلاً من fetch مباشرة |
| **Post بدون نقاط** | `hub/page.js` يستخدم `addDoc` مباشرة → نقاط +5 لا تُضاف | توحيد الكتابة عبر `/api/posts` |
| **withPublic بدون auth** | GET /api/groups بدون `?mine=true` عام كلياً — أي شخص يمكنه جلب كل المجموعات النشطة | مقبول إذا كانت البيانات عامة |
| **`withAdmin` vs `verifyAdmin`** | بعض routes admin تستخدم `withAdmin()` وأخرى تستخدم `verifyAdmin()` يدوياً — تناسق غير كامل | توحيد النمط في كل `/api/admin/**` |
| **لا Firestore Security Rules** | الملف غير موجود في الـ repo → أي تعديل مباشر على Firestore بدون API route ممكن | إضافة قواعد صارمة |

---

✅ انتهت المرحلة 5 (مُحدَّثة 2026-05-20)
