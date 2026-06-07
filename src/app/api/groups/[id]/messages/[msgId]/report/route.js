// POST /api/groups/[id]/messages/[msgId]/report — الإبلاغ عن رسالة
import { groupsCol, messagesCol, reportsCol, usersCol } from "@/lib/collections";
import { notifyMany } from "@/lib/serverNotify";
import { FieldValue } from "@/lib/firebaseAdmin";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

const VALID_REASONS = ["inappropriate", "spam", "harassment", "misinformation", "other"];

export const POST = withAuth(async (req, { params }, { uid, user }) => {
  const { id: groupId, msgId } = params;

  const groupSnap = await groupsCol().doc(groupId).get();
  if (!groupSnap.exists) return jsonError("Group not found", 404);
  const group = groupSnap.data();

  const msgSnap = await messagesCol().doc(msgId).get();
  if (!msgSnap.exists) return jsonError("Message not found", 404);
  const msg = msgSnap.data();
  if (msg.groupId !== groupId) return jsonError("Message not in this group", 403);
  if ((msg.authorId || msg.senderId) === uid) return jsonError("Cannot report your own message", 400);

  const body = await safeJson(req);
  const reason = body?.reason;
  if (!VALID_REASONS.includes(reason)) return jsonError("Invalid reason", 400);

  // منع الإبلاغ المكرر
  const existing = await reportsCol()
    .where("type", "==", "message")
    .where("msgId", "==", msgId)
    .where("reporterId", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) return jsonError("Already reported", 409);

  await reportsCol().add({
    type: "message",
    status: "pending",
    reason,
    msgId,
    groupId,
    groupName: group.name || "Unknown",
    messageText: msg.text || "",
    targetUserId: msg.authorId || msg.senderId || null,
    authorName: msg.authorName || msg.senderName || "Unknown",
    reporterId: uid,
    reporterName: user.fullName || "Unknown",
    createdAt: FieldValue.serverTimestamp(),
  });

  const adminsSnap = await usersCol().where("role", "==", "admin").get();
  const adminIds = adminsSnap.docs.map(d => d.id);
  
  const leaderId = group.leaderId;
  const coLeaderIds = Array.isArray(group.coLeaderIds) ? group.coLeaderIds : [];
  const recipients = [...adminIds, leaderId, ...coLeaderIds].filter(Boolean);

  await notifyMany({
    userIds: recipients,
    title: "بلاغ جديد عن رسالة",
    body: `قام ${user.fullName || "شخص ما"} بالإبلاغ عن رسالة في "${group.name || "مجموعة"}" بسبب: ${reason}`,
    link: `/hub/group/${groupId}`,
    type: "review"
  });

  return jsonOk({ ok: true }, 201);
}, "MSG_REPORT");
