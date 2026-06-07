"use client";

// ══════════════════════════════════════════════════════════════════════
// apiClient.js — Wrapper fetch موحّد لجميع طلبات الـ API
// ──────────────────────────────────────────────────────────────────────
// يُضيف تلقائياً:
//  • JWT Token من Firebase Auth في كل طلب (Authorization: Bearer)
//  • مهلة زمنية (15 ثانية) عبر AbortController لإلغاء الطلبات المعلّقة
//  • إعادة المحاولة التلقائية (retry) بتوكن جديد عند 401/403
//
// الاستخدام:
//   await api("/api/posts")
//   await api("/api/posts", { method: "POST", body: { text: "Hi" } })
//   await api("/api/posts", { timeout: 30000 })         // تجاوز المهلة الافتراضية
//   await api("/api/posts", { forceRefresh: true })     // إجبار تحديث التوكن
// ══════════════════════════════════════════════════════════════════════

import { auth } from "./firebase";

// المهلة الافتراضية: 15 ثانية — بعدها يُلغى الطلب ويرى المستخدم رسالة خطأ
const DEFAULT_TIMEOUT = 15000;

/**
 * api — دالة fetch المُعززة الرئيسية للتطبيق.
 *
 * @param {string} path           - مسار الـ API (مثل "/api/posts")
 * @param {object} options        - خيارات إضافية:
 *   @param {string}  method       - HTTP method (الافتراضي: GET)
 *   @param {object|FormData} body - جسم الطلب (يُحوَّل لـ JSON تلقائياً إن لم يكن FormData)
 *   @param {number}  timeout      - مهلة مخصصة بالميلي ثانية
 *   @param {boolean} forceRefresh - يُجبر تحديث التوكن من Firebase
 *   @param {object}  headers      - headers إضافية
 * @returns {Promise<object>} - البيانات المُعادة من الـ API
 * @throws {Error} - مع .status و .data عند الفشل
 */
export async function api(path, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    const e = new Error("Not signed in");
    e.status = 401;
    throw e;
  }

  // الخطوة 1: جلب JWT Token (من الـ cache أو تحديث جديد)
  let token;
  try {
    token = await user.getIdToken(!!options.forceRefresh);
  } catch (e) {
    const err = new Error("Token indisponible : " + e.message);
    err.status = 401;
    throw err;
  }

  // الخطوة 2: إعداد AbortController لإلغاء الطلبات الزومبي (المعلّقة)
  const controller = new AbortController();
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // FormData لا يحتاج Content-Type — المتصفح يُضيفه تلقائياً مع الـ boundary
  const isFormData = options.body instanceof FormData;

  let res, data;
  try {
    res = await fetch(path, {
      method: options.method || "GET",
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      body: isFormData
        ? options.body
        : options.body
        ? JSON.stringify(options.body)
        : undefined,
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error(`Délai dépassé (${timeoutMs / 1000}s). Vérifiez votre connexion.`);
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    // ضمان تحرير الـ timer في جميع الحالات (نجاح أو فشل)
    clearTimeout(timeoutId);
  }

  // الخطوة 3: إعادة المحاولة بتوكن جديد عند 401/403
  // — يحدث عند ترقية المستخدم لأدمن أو تعيين Custom Claims حديثة
  if ((res.status === 401 || res.status === 403) && !options.forceRefresh && !options._retried) {
    return api(path, { ...options, forceRefresh: true, _retried: true });
  }

  // الخطوة 4: رمي خطأ واضح لأي استجابة HTTP غير ناجحة
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * refreshIdToken — يُجبر تحديث JWT Token من Firebase.
 * مفيد بعد ترقية المستخدم لأدمن لتحديث Custom Claims فوراً.
 *
 * @returns {Promise<string|null>} - التوكن الجديد أو null إذا لم يكن مسجَّلاً
 */
export async function refreshIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(true);
}
