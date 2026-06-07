// ══════════════════════════════════════════════════════════════════════
// /api/groups/[id] — عمليات مجموعة واحدة
// ──────────────────────────────────────────────────────────────────────
// GET    → جلب بيانات المجموعة (عام، بدون Auth)
// PATCH  → تعديل الإعدادات (للقائد فقط)
// DELETE → حذف المجموعة وكل بياناتها (للقائد أو الأدمن)
// ══════════════════════════════════════════════════════════════════════

import {
  groupsCol,
  messagesCol,
  resourcesCol,
  joinRequestsCol,
} from "@/lib/collections";
import { db, FieldValue, snapToObj } from "@/lib/firestore";
import { withAuth, withPublic, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

/**
 * GET /api/groups/[id]
 * يجلب بيانات مجموعة واحدة — عام (لا يتطلب Auth).
 * يُستخدم في صفحة الشات عند التحميل الأولي.
 */
export const GET = withAuth(async (_req, { params }, { uid }) => {
  const snap = await groupsCol().doc(params.id).get();
  if (!snap.exists) return jsonError("Group not found", 404);
  const g = snapToObj(snap);

  // Verify the caller is a member, leader, or admin before returning full data.
  // Non-members receive a minimal public profile only.
  const isMember  = Array.isArray(g.members) && g.members.includes(uid);
  const isLeader  = g.leaderId === uid;

  if (isMember || isLeader) {
    // Members get everything except the raw screening questions list.
    // questions are only needed during the join flow, not in the chat view.
    const { questions: _q, ...memberView } = g;
    return jsonOk({ ...memberView, id: snap.id });
  }

  // Non-member public view: strip all sensitive / operational fields.
  const {
    members: _m, questions: _q2, leaderId: _l,
    rules: _r, tags, name, subject, description,
    accessType, createdAt, memberCount,
  } = g;
  return jsonOk({ id: snap.id, name, subject, description, accessType, tags, createdAt, memberCount });
}, "GROUP_GET");

/**
 * PATCH /api/groups/[id] — تعديل إعدادات المجموعة (للقائد فقط).
 * الحقول المسموح بتعديلها: name, subject, description, rules, tags, questions, maxMembers.
 * أي حقل آخر في الجسم يُتجاهل (allowlist للأمان).
 */
export const PATCH = withAuth(async (req, { params }, { uid }) => {
  const ref = groupsCol().doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Group not found", 404);
  const group = snap.data();
  if (group.leaderId !== uid) return jsonError("Forbidden — leader only", 403);

  const body = await safeJson(req);
  // allowlist: فقط الحقول المسموح بها — لمنع تعديل leaderId أو members
  const ALLOWED = ["name", "subject", "description", "rules", "tags", "questions", "maxMembers"];
  const updates = {};
  for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];

  if (Object.keys(updates).length === 0) return jsonError("No valid fields");
  updates.updatedAt = FieldValue.serverTimestamp();

  await ref.update(updates);
  return jsonOk();
}, "GROUP_PATCH");

/**
 * DELETE /api/groups/[id] — حذف المجموعة وكل ما يرتبط بها.
 * مسموح للقائد أو الأدمن فقط.
 *
 * يحذف بـ Batch Write واحد:
 *  - المجموعة نفسها
 *  - جميع الرسائل (messages)
 *  - جميع الموارد (resources)
 *  - جميع طلبات الانضمام (join-requests)
 *
 * ⚠️ العملية لا رجعة منها — لا يوجد soft delete.
 */
export const DELETE = withAuth(async (_req, { params }, { uid, user }) => {
  const ref = groupsCol().doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Group not found", 404);
  const group = snap.data();

  const isLeader = group.leaderId === uid;
  const isAdmin = user?.role === "admin";
  if (!isLeader && !isAdmin) return jsonError("Forbidden", 403);

  const batch = db.batch();
  batch.delete(ref);

  // جلب جميع البيانات المرتبطة بالتوازي ثم حذفها في batch واحد
  const [msgs, ress, jrs] = await Promise.all([
    messagesCol().where("groupId", "==", params.id).get(),
    resourcesCol().where("groupId", "==", params.id).get(),
    joinRequestsCol().where("groupId", "==", params.id).get(),
  ]);
  msgs.docs.forEach((d) => batch.delete(d.ref));
  ress.docs.forEach((d) => batch.delete(d.ref));
  jrs.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
  return jsonOk();
}, "GROUP_DELETE");
