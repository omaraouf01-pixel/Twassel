// ══════════════════════════════════════════════════════════════════════
// /api/notifications — إدارة الإشعارات
// ──────────────────────────────────────────────────────────────────────
// GET   /api/notifications — يجلب آخر 50 إشعاراً للمستخدم الحالي
// POST  /api/notifications — ينشئ إشعاراً لمستخدم محدد (userId)
// PATCH /api/notifications — يُعلّم جميع إشعاراتي كـ "مقروءة" (Batch Update)
// ══════════════════════════════════════════════════════════════════════

import { notificationsCol, buildNotificationDoc } from "@/lib/collections";
import { db, snapToObj, listSnap } from "@/lib/firestore";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

/**
 * GET /api/notifications
 * يجلب آخر 50 إشعاراً للمستخدم المسجّل، مرتّبة من الأحدث للأقدم.
 */
export const GET = withAuth(async (_req, _ctx, { uid }) => {
  const snap = await notificationsCol()
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return jsonOk({ notifications: listSnap(snap) });
}, "NOTIF_LIST");

/**
 * POST /api/notifications
 * ينشئ إشعاراً لأي مستخدم (userId في الجسم).
 * يُستخدم من lib/notify.js (جانب العميل) لإرسال إشعارات بين المستخدمين.
 * Body: { userId, title, body?, link? }
 */
export const POST = withAuth(async (req) => {
  const body = await safeJson(req);
  const { userId, title, link } = body;
  const notifBody = body.body || "";
  if (!userId || !title) return jsonError("Missing userId or title");

  const ref = await notificationsCol().add(
    buildNotificationDoc({ userId, title, body: notifBody, link })
  );
  const fresh = await ref.get();
  return jsonOk(snapToObj(fresh), 201);
}, "NOTIF_CREATE");

/**
 * PATCH /api/notifications — يُعلّم جميع الإشعارات غير المقروءة كـ "مقروءة".
 * يستخدم Firestore Batch Write لتحديث جميع الإشعارات في عملية واحدة (أكفأ من الحلقة).
 */
export const PATCH = withAuth(async (_req, _ctx, { uid }) => {
  const snap = await notificationsCol()
    .where("userId", "==", uid)
    .where("read", "==", false)
    .get();

  if (snap.empty) return jsonOk();

  // Batch Update: تحديث جميع الإشعارات في رحلة واحدة لـ Firestore
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
  return jsonOk();
}, "NOTIF_MARK_ALL");
