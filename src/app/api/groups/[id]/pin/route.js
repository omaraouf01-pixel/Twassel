// ══════════════════════════════════════════════════════════════════════
// PATCH /api/groups/[id]/pin — تثبيت/إلغاء تثبيت رسالة في العقدة
// ──────────────────────────────────────────────────────────────────────
// يُخزّن الرسالة المثبّتة في حقل group.pinnedMessage:
//   { id, content, senderName, pinnedAt }
//
// يسمح للقائد أو الأدمن فقط.
// إلغاء التثبيت: أرسل messageId: null
// ══════════════════════════════════════════════════════════════════════

import { groupsCol, messagesCol } from "@/lib/collections";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

/**
 * PATCH /api/groups/[id]/pin
 * Body: { messageId: string } — يُثبّت رسالة
 * Body: { messageId: null }   — يُلغي التثبيت
 * مسموح للقائد أو الأدمن فقط.
 */
export const PATCH = withAuth(async (req, { params }, { uid, user }) => {
  const gSnap = await groupsCol().doc(params.id).get();
  if (!gSnap.exists) return jsonError("Group not found", 404);

  const g = gSnap.data();
  const isLeader = g.leaderId === uid;
  const isAdmin = user.role === "admin";
  if (!isLeader && !isAdmin) return jsonError("Leader or admin only", 403);

  const body = await safeJson(req);
  const messageId = body?.messageId ?? null;

  if (messageId) {
    const mSnap = await messagesCol().doc(messageId).get();
    if (!mSnap.exists) return jsonError("Message not found", 404);
    if (mSnap.data().groupId !== params.id)
      return jsonError("Message does not belong to this group", 403);

    const msg = mSnap.data();
    await gSnap.ref.update({
      pinnedMessage: {
        id: messageId,
        content: msg.content || msg.text || "",
        senderName: msg.senderName || msg.authorName || "Scholar",
        pinnedAt: new Date().toISOString(),
      },
    });
  } else {
    await gSnap.ref.update({ pinnedMessage: null });
  }

  return jsonOk({ ok: true });
}, "GROUP_PIN");
