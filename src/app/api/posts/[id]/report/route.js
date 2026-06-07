// POST /api/posts/[id]/report — الإبلاغ عن منشور
import { postsCol, reportsCol, usersCol } from "@/lib/collections";
import { notifyMany } from "@/lib/serverNotify";
import { FieldValue } from "@/lib/firebaseAdmin";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

const VALID_REASONS = ["inappropriate", "spam", "harassment", "misinformation", "other"];

export const POST = withAuth(async (req, { params }, { uid, user }) => {
  const postId = params.id;

  const postSnap = await postsCol().doc(postId).get();
  if (!postSnap.exists) return jsonError("Post not found", 404);

  const post = postSnap.data();
  if (post.uid === uid) return jsonError("Cannot report your own post", 400);

  const body = await safeJson(req);
  const reason = body?.reason;
  if (!VALID_REASONS.includes(reason)) return jsonError("Invalid reason", 400);

  // منع الإبلاغ المكرر من نفس المستخدم على نفس المنشور
  const existing = await reportsCol()
    .where("type", "==", "post")
    .where("postId", "==", postId)
    .where("reporterId", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) return jsonError("Already reported", 409);

  await reportsCol().add({
    type: "post",
    status: "pending",
    reason,
    postId,
    postText: post.content || "",
    targetUserId: post.uid || null,
    authorName: post.authorName || "Unknown",
    reporterId: uid,
    reporterName: user.fullName || "Unknown",
    createdAt: FieldValue.serverTimestamp(),
  });

  const adminsSnap = await usersCol().where("role", "==", "admin").get();
  const adminIds = adminsSnap.docs.map(d => d.id);
  await notifyMany({
    userIds: adminIds,
    title: "بلاغ جديد عن منشور",
    body: `قام ${user.fullName || "شخص ما"} بالإبلاغ عن منشور بسبب: ${reason}`,
    link: "/admin?tab=reports",
    type: "review"
  });

  return jsonOk({ ok: true }, 201);
}, "POST_REPORT");
