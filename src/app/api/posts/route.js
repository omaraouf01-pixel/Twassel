import { postsCol, buildPostDoc } from "@/lib/collections";
import { snapToObj, listSnap } from "@/lib/firestore";
import { withAuth, withPublic, jsonOk, jsonError, safeJson } from "@/lib/withAuth";
import { updateUserPoints } from "@/lib/rankingSystem";

// GET /api/posts?limit=50
export const GET = withPublic(async (req) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
  const snap = await postsCol().orderBy("createdAt", "desc").limit(limit).get();
  return jsonOk({ posts: listSnap(snap) });
}, "POSTS_LIST");

// POST /api/posts
export const POST = withAuth(async (req, _ctx, { uid, user }) => {
  const body = await safeJson(req);
  const text = (body.text || "").trim();
  const tag = body.tag || "General";
  const fileUrl = body.fileUrl || null;
  const fileName = body.fileName || null;
  if (!text && !fileUrl) return jsonError("Texte requis");
  if (text.length > 2000) return jsonError("Texte trop long (max 2000)");
  if (!user) return jsonError("User not found", 404);

  const ref = await postsCol().add(
    buildPostDoc({
      authorId: uid,
      authorName: user.fullName,
      authorRole: user.department || "Scholar",
      authorAvatar: user.avatarUrl || null,
      content: text || " ",
      fileUrl,
      fileName,
      tag,
    })
  );
  // ── نقاط المساهمة: +5 لإنشاء منشور ──────────────────────────────────
  updateUserPoints(uid, 5).catch(
    (e) => console.error("[rankingSystem] post create:", e.message)
  );

  const fresh = await ref.get();
  return jsonOk(snapToObj(fresh), 201);
}, "POSTS_CREATE");
