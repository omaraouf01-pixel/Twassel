// ══════════════════════════════════════════════════════════════════════
// /api/posts/[id] — عمليات منشور واحد
// ══════════════════════════════════════════════════════════════════════

import { postsCol, reportsCol } from "@/lib/collections";
import { db } from "@/lib/firestore";
import { withAuth, jsonOk, jsonError } from "@/lib/withAuth";

/**
 * DELETE /api/posts/[id]
 * يحذف منشوراً — مسموح لصاحب المنشور أو الأدمن فقط.
 * يُستدعى من AdminReportsTable عند اتخاذ إجراء "حذف المحتوى".
 */
export const DELETE = withAuth(async (_req, { params }, { uid, user }) => {
  const ref = postsCol().doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Post not found", 404);

  const post = snap.data();
  const isAdmin = user?.role === "admin";
  // التحقق: صاحب المنشور أو الأدمن فقط يمكنه الحذف
  if (post.uid !== uid && !isAdmin) return jsonError("Forbidden", 403);

  const batch = db.batch();
  batch.delete(ref);

  const relatedReports = await reportsCol().where("postId", "==", params.id).get();
  relatedReports.forEach(rDoc => batch.delete(rDoc.ref));

  await batch.commit();
  return jsonOk();
}, "POST_DELETE");
