// ══════════════════════════════════════════════════════════════════════
// /api/groups — إدارة المجموعات الأكاديمية
// ──────────────────────────────────────────────────────────────────────
// GET  /api/groups           → جميع المجموعات النشطة (صفحة Explore)
// GET  /api/groups?mine=true → مجموعاتي أنا فقط (يتطلب Auth)
// POST /api/groups           → إنشاء مجموعة جديدة (يتطلب Auth)
// ══════════════════════════════════════════════════════════════════════

import { groupsCol, usersCol, buildGroupDoc } from "@/lib/collections";
import { FieldValue, listSnap } from "@/lib/firestore";
import { withAuth, withPublic, jsonOk, jsonError, safeJson } from "@/lib/withAuth";
import { updateUserPoints } from "@/lib/rankingSystem";

/**
 * GET /api/groups
 *  ?mine=true  → مجموعاتي فقط (array-contains uid) — يتطلب Auth
 *  ?mine=false → جميع المجموعات النشطة (صفحة Explore) — عام
 *
 * الترتيب: updatedAt تنازلياً — المجموعات النشطة مؤخراً تظهر أولاً.
 */
export const GET = withPublic(async (req) => {
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "true";

  // ── Mode "mes groupes" : filtre par members array-contains uid ──
  if (mine) {
    // Auth obligatoire pour ce mode (on extrait l'uid manuellement
    // car le wrapper public ne le fait pas, et on veut garder ce route
    // public pour le mode Explore)
    const { verifyAuth } = await import("@/lib/verifyAdmin");
    const v = await verifyAuth(req);
    if (v.error) return jsonError(v.error, v.status);

    const snap = await groupsCol()
      .where("members", "array-contains", v.uid)
      .where("status", "==", "active")
      .orderBy("updatedAt", "desc")
      .get();

    return jsonOk({ groups: listSnap(snap).map(formatGroup) });
  }

  // ── Mode public : tous les groupes actifs (Explore) ──
  const snap = await groupsCol()
    .where("status", "==", "active")
    .orderBy("updatedAt", "desc")
    .get();

  return jsonOk({ groups: listSnap(snap).map(formatGroup) });
}, "GROUPS_LIST");

/**
 * formatGroup — يُصفّي بيانات المجموعة للـ API response.
 * يستبعد الحقول الداخلية غير الضرورية للعميل.
 * accessType الافتراضي: "protected" (يتطلب موافقة لانضمام).
 */
function formatGroup(g) {
  return {
    id: g.id,
    name: g.name,
    subject: g.subject,
    description: g.description,
    tags: g.tags,
    memberCount: g.memberCount,
    maxMembers: g.maxMembers,
    leaderId: g.leaderId,
    leaderName: g.leaderName,
    members: g.members,
    questions: g.questions,
    rules: g.rules,
    accessType: g.accessType || "protected",
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

/**
 * POST /api/groups — إنشاء مجموعة أكاديمية جديدة.
 * بعد الإنشاء:
 *  - يُضاف groupId لمصفوفة user.groups في Firestore.
 *  - يحصل المنشئ على +15 نقطة مساهمة (في الخلفية — لا تُعطّل عند فشله).
 */
export const POST = withAuth(async (req, _ctx, { uid, user }) => {
  const body = await safeJson(req);
  const { name, subject, description, rules, tags, questions, maxMembers, accessType } = body;
  if (!name) return jsonError("Missing name");
  if (!user) return jsonError("User not found", 404);

  const doc = await groupsCol().add(
    buildGroupDoc({
      name,
      subject,
      description,
      rules,
      tags,
      questions,
      maxMembers,
      accessType,
      leaderId: uid,
      leaderName: user.fullName,
      members: [uid],
      memberCount: 1,
      membersList: [{ uid, name: user.fullName, role: "Leader" }],
    })
  );

  // Ajouter le groupId au tableau user.groups
  const userRef = usersCol().doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.update({ groups: FieldValue.arrayUnion(doc.id) });
  } else {
    const q = await usersCol().where("uid", "==", uid).limit(1).get();
    if (!q.empty) await q.docs[0].ref.update({ groups: FieldValue.arrayUnion(doc.id) });
  }

  // ── نقاط المساهمة: +15 لإنشاء مجموعة ────────────────────────────────
  updateUserPoints(uid, 15).catch(
    (e) => console.error("[rankingSystem] group create:", e.message)
  );

  return jsonOk({ id: doc.id, success: true }, 201);
}, "GROUPS_CREATE");
