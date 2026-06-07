import { withAuth, jsonOk } from "@/lib/withAuth";
import { usersCol, groupsCol, postsCol } from "@/lib/collections";

/**
 * GET /api/search?q=<query>
 *
 * يبحث في 3 مجموعات: users (اسم + رقم جامعي)، groups (اسم)، posts (محتوى).
 * يستخدم range prefix match لـ Firestore ( trick).
 *
 * ⚠️ يتطلب composite indexes في Firestore Console:
 *   - users: (status ASC, fullName ASC)
 *   - users: (status ASC, matricule ASC)
 *   - groups: (status ASC, name ASC)
 *   إذا لم تكن موجودة، Firestore ترسل رابط إنشاء الـ index في رسالة الخطأ.
 */
export const GET = withAuth(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return jsonOk({ users: [], groups: [], posts: [] });
  }

  const end = q + "";
  const LIMIT = 5;

  // ── تشغيل الاستعلامات بالتوازي ──────────────────────────────
  const [nameSnap, matriculeSnap, groupSnap, postSnap] = await Promise.all([
    // بحث بالاسم الكامل (prefix)
    usersCol()
      .where("status", "==", "active")
      .where("fullName", ">=", q)
      .where("fullName", "<=", end)
      .limit(LIMIT)
      .get(),

    // بحث بالرقم الجامعي (prefix)
    usersCol()
      .where("status", "==", "active")
      .where("matricule", ">=", q)
      .where("matricule", "<=", end)
      .limit(LIMIT)
      .get(),

    // بحث بالاسم في المجموعات (prefix)
    groupsCol()
      .where("status", "==", "active")
      .where("name", ">=", q)
      .where("name", "<=", end)
      .limit(LIMIT)
      .get(),

    // prefix match على محتوى المنشور — لا يحتاج composite index لأنه بدون orderBy
    // ⚠️ لا يدعم البحث داخل النص (full-text) — للتوسع مستقبلاً استخدم Algolia أو Typesense
    postsCol()
      .where("content", ">=", q)
      .where("content", "<=", q + "")
      .limit(30)
      .get(),
  ]);

  // ── دمج نتائج البحث عن المستخدمين وإزالة التكرار ────────────
  const userMap = new Map();
  for (const snap of [nameSnap, matriculeSnap]) {
    for (const d of snap.docs) {
      if (userMap.has(d.id)) continue;
      const data = d.data();
      userMap.set(d.id, {
        id: d.id,
        uid: data.uid || d.id,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl || null,
        department: data.department || null,
        matricule: data.matricule || null,
      });
    }
  }
  const users = [...userMap.values()].slice(0, LIMIT);

  // ── المجموعات ────────────────────────────────────────────────
  const groups = groupSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      subject: data.subject || null,
      memberCount: data.memberCount || 0,
      tags: data.tags || [],
    };
  });

  // ── المنشورات: نتائج prefix match مباشرة من Firestore ────────
  const posts = postSnap.docs.slice(0, LIMIT).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      content: (data.content || "").slice(0, 130),
      authorName: data.authorName || "مجهول",
      groupId: data.groupId || null,
      authorId: data.authorId || null,
    };
  });

  return jsonOk({ users, groups, posts });
}, "SEARCH");
