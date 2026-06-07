// ══════════════════════════════════════════════════════════════════════
// /api/groups/[id]/resources — الملفات والموارد الأكاديمية للعقدة
// ──────────────────────────────────────────────────────────────────────
// GET  → قائمة الموارد (للأعضاء فقط)
// POST → رفع مورد جديد مع نظام مراجعة:
//         - القائد أو الأدمن: يُضاف مباشرةً (status: approved)
//         - الأعضاء العاديون: يُضاف كـ pending ويُنبّه القائد
// ══════════════════════════════════════════════════════════════════════

import { groupsCol, resourcesCol, buildResourceDoc } from "@/lib/collections";
import { listSnap } from "@/lib/firestore";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";
import { notifyUser } from "@/lib/serverNotify";

/** ensureMember — يتحقق من العضوية ويُعيد معلومات صلاحية المستخدم */
async function ensureMember(uid, user, groupId) {
  const gSnap = await groupsCol().doc(groupId).get();
  if (!gSnap.exists) return { error: "Group not found", status: 404 };
  const group = gSnap.data();
  const isAdmin = user?.role === "admin";
  const isMember = (group.members || []).includes(uid);
  if (!isMember && !isAdmin) return { error: "Forbidden", status: 403 };
  return { group, isAdmin, isLeader: group.leaderId === uid };
}

/**
 * GET /api/groups/[id]/resources
 * يجلب موارد العقدة مرتّبة من الأحدث — للأعضاء فقط.
 */
export const GET = withAuth(async (_req, { params }, { uid, user }) => {
  const ctx = await ensureMember(uid, user, params.id);
  if (ctx.error) return jsonError(ctx.error, ctx.status);

  const snap = await resourcesCol()
    .where("groupId", "==", params.id)
    .orderBy("createdAt", "desc")
    .get();

  const resources = listSnap(snap).map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    uid: r.uid,
    uploader: r.uploader,
    status: r.status,
    createdAt: r.createdAt,
  }));
  return jsonOk({ resources });
}, "RESOURCES_GET");

// POST /api/groups/[id]/resources
export const POST = withAuth(async (req, { params }, { uid, user }) => {
  const body = await safeJson(req);
  const { name, url } = body;
  if (!name || !url) return jsonError("Missing name or url");

  const ctx = await ensureMember(uid, user, params.id);
  if (ctx.error) return jsonError(ctx.error, ctx.status);

  const status = ctx.isLeader || ctx.isAdmin ? "approved" : "pending";

  const ref = await resourcesCol().add(
    buildResourceDoc({
      groupId: params.id,
      name,
      url,
      uid,
      uploader: user?.fullName || "Étudiant",
      status,
    })
  );

  // Review Alert — notify the group leader when a student uploads a pending file.
  if (status === "pending" && ctx.group?.leaderId && ctx.group.leaderId !== uid) {
    notifyUser({
      userId: ctx.group.leaderId,
      type: "review",
      title: "New file to review",
      body: `Please check the node — ${user?.fullName || "a student"} uploaded "${name}".`,
      link: `/hub/chat/${params.id}`,
    });
  }

  return jsonOk({ id: ref.id, status }, 201);
}, "RESOURCES_POST");
