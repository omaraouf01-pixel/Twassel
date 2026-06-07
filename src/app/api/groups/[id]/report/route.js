// POST /api/groups/[id]/report — الإبلاغ عن مجموعة
import { groupsCol, reportsCol, usersCol } from "@/lib/collections";
import { notifyMany } from "@/lib/serverNotify";
import { FieldValue } from "@/lib/firebaseAdmin";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

const VALID_REASONS = ["inappropriate", "spam", "harassment", "misinformation", "other"];

export const POST = withAuth(async (req, { params }, { uid, user }) => {
  const groupId = params.id;

  const groupSnap = await groupsCol().doc(groupId).get();
  if (!groupSnap.exists) return jsonError("Group not found", 404);

  const group = groupSnap.data();
  if (group.leaderId === uid) return jsonError("Cannot report your own group", 400);

  const body = await safeJson(req);
  const reason = body?.reason;
  if (!VALID_REASONS.includes(reason)) return jsonError("Invalid reason", 400);

  // منع الإبلاغ المكرر من نفس المستخدم على نفس المجموعة
  const existing = await reportsCol()
    .where("type", "==", "group")
    .where("groupId", "==", groupId)
    .where("reporterId", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) return jsonError("Already reported", 409);

  await reportsCol().add({
    type: "group",
    status: "pending",
    reason,
    groupId,
    groupName: group.name || "Unknown",
    targetUserId: group.leaderId || null,
    authorName: group.leaderName || "Unknown",
    reporterId: uid,
    reporterName: user.fullName || "Unknown",
    createdAt: FieldValue.serverTimestamp(),
  });

  const adminsSnap = await usersCol().where("role", "==", "admin").get();
  const adminIds = adminsSnap.docs.map(d => d.id);
  await notifyMany({
    userIds: adminIds,
    title: "بلاغ جديد عن مجموعة",
    body: `قام ${user.fullName || "شخص ما"} بالإبلاغ عن المجموعة "${group.name || "مجهولة"}" بسبب: ${reason}`,
    link: "/admin?tab=reports",
    type: "review"
  });

  return jsonOk({ ok: true }, 201);
}, "GROUP_REPORT");
