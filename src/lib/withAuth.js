// ══════════════════════════════════════════════════════════════════════
// withAuth.js — Wrappers حماية API Routes لـ TAWASSOL
// ──────────────────────────────────────────────────────────────────────
// الهدف: توحيد نظام التحقق من الهوية وصلاحيات الوصول لجميع الـ APIs.
//
// التسلسل الهرمي للـ Wrappers:
//   withPublic     — APIs عامة (معالجة أخطاء فقط)
//   withAuth       — يتطلب مستخدم مُسجَّل (أي رتبة)
//   withAdmin      — يتطلب صلاحيات الأدمن (role === "admin")
//
// كل wrapper يُغلف الآخر: withAdmin → withAuth → withErrorHandling
//
// البيانات المُمرَّرة للـ handler: { uid, user, decodedToken }
// ══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { adminAuth, db as adminDb } from "./firebaseAdmin";

/**
 * jsonOk — رد HTTP ناجح مع بيانات JSON.
 * @param {object} data   - البيانات المُعادة (الافتراضي: { ok: true })
 * @param {number} status - رمز الحالة (الافتراضي: 200)
 */
export function jsonOk(data = { ok: true }, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * jsonError — رد HTTP خطأ مع رسالة.
 * @param {string} message - رسالة الخطأ
 * @param {number} status  - رمز الحالة (الافتراضي: 400)
 */
export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// الحد الأقصى لمدة انتظار أي طلب API — بعدها يُرفض بـ 504 Gateway Timeout
const SERVER_TIMEOUT_MS = 10000;

/**
 * withTimeout — يُضيف مهلة زمنية لأي Promise.
 * يمنع تعليق طلبات الـ API عند بطء قاعدة البيانات أو الشبكة.
 *
 * @param {Promise}  promise - العملية المراد تحديد مهلتها
 * @param {number}   ms      - المهلة بالميلي ثانية
 * @param {string}   label   - اسم الـ API للـ logging
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`Server timeout (${ms}ms) on ${label}`);
      err.status = 504;
      reject(err);
    }, ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

/**
 * withErrorHandling — الـ Wrapper الأساسي لمعالجة الأخطاء العالمية.
 *
 * يُغلّف أي handler بـ:
 *  - مهلة زمنية (SERVER_TIMEOUT_MS).
 *  - Logging تلقائي مع reqId فريد لكل طلب.
 *  - ترجمة أخطاء Firebase المعروفة إلى ردود HTTP واضحة.
 *  - إعادة 204 إذا أعاد handler قيمة falsy.
 *
 * @param {Function} handler - الـ Route handler الأصلي
 * @param {string}   label   - اسم للـ logging
 */
export function withErrorHandling(handler, label = "API") {
  return async (req, ctx) => {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
      const result = await withTimeout(handler(req, ctx), SERVER_TIMEOUT_MS, label);
      if (!result) return new NextResponse(null, { status: 204 });
      return result;
    } catch (e) {
      console.error(`[${label}#${reqId} ERROR]`, e);

      // التعامل مع خطأ انتهاء صلاحية التوكن بشكل صريح
      if (e.code === "auth/id-token-expired") {
        return jsonError("Token expired. Please login again.", 401);
      }

      const status = e.status || 500;
      const msg = e.message || "Internal Server Error.";
      return jsonError(msg, status);
    }
  };
}

/**
 * withAuth — Wrapper للـ APIs التي تتطلب مستخدماً مُسجَّلاً (أي رتبة).
 *
 * خطوات التحقق:
 *  1. يستخرج JWT من header "Authorization: Bearer <token>".
 *  2. يُحقق من صحة التوكن عبر firebase-admin.
 *  3. يتأكد من وجود سجل المستخدم في Firestore.
 *  4. يُمرّر { uid, user, decodedToken } للـ handler.
 *
 * @param {Function} handler - الـ Route handler المحمي
 * @param {string}   label   - اسم للـ logging
 */
export function withAuth(handler, label = "AUTH") {
  return withErrorHandling(async (req, ctx) => {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonError("Authentication required (No Token)", 401);
      }

      const token = authHeader.split(" ")[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;

      // التحقق من وجود سجل المستخدم في Firestore (قد يكون حُذف يدوياً)
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return jsonError("User record not found in database", 401);
      }

      const user = userDoc.data();

      // تمرير بيانات الهوية للـ handler كمعامل ثالث
      return handler(req, ctx, { uid, user, decodedToken });
    } catch (error) {
      console.error("Auth Wrapper Error:", error.message);
      return jsonError("Invalid or expired session", 401);
    }
  }, label);
}

/**
 * withAdmin — Wrapper للـ APIs التي تتطلب صلاحيات الأدمن حصراً.
 *
 * يبني على withAuth ويُضيف التحقق من role === "admin" في Firestore.
 * أي مستخدم غير أدمن يحصل على 403 Forbidden.
 *
 * @param {Function} handler - الـ Route handler المحمي بصلاحيات أدمن
 * @param {string}   label   - اسم للـ logging
 */
export function withAdmin(handler, label = "ADMIN") {
  return withAuth(async (req, ctx, auth) => {
    // التحقق من الرتبة في Firestore (Custom Claims وحدها ليست كافية)
    if (auth.user.role !== "admin") {
      return jsonError("Admin privileges required", 403);
    }
    return handler(req, ctx, auth);
  }, label);
}

/**
 * withPublic — Wrapper للـ APIs العامة التي لا تتطلب تسجيل دخول.
 * يُضيف معالجة الأخطاء العالمية فقط (timeout + logging).
 *
 * @param {Function} handler - الـ Route handler العام
 * @param {string}   label   - اسم للـ logging
 */
export function withPublic(handler, label = "PUBLIC") {
  return withErrorHandling(handler, label);
}

/**
 * safeJson — يُحلل جسم الطلب كـ JSON بأمان.
 * يعيد كائناً فارغاً إذا كان الجسم فارغاً أو غير صالح (بدلاً من رمي خطأ).
 *
 * @param {Request} req - كائن الطلب الوارد
 * @returns {Promise<object>}
 */
export async function safeJson(req) {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}