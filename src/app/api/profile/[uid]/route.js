import { usersCol, groupsCol, resourcesCol } from "@/lib/collections";
import { withAuth, jsonOk, jsonError } from "@/lib/withAuth";

export const GET = withAuth(async (_req, { params }, _auth) => {
  const { uid } = params;
  if (!uid) return jsonError("uid is required", 400);

  const userDoc = await usersCol().doc(uid).get();
  if (!userDoc.exists) return jsonError("User not found", 404);

  const u = userDoc.data();

  if (u.status !== "active") return jsonError("Account not available", 403);

  const [groupsSnap, resourcesSnap] = await Promise.all([
    groupsCol().where("members", "array-contains", uid).count().get(),
    resourcesCol().where("uploadedBy", "==", uid).count().get(),
  ]);

  return jsonOk({
    uid: u.uid,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl || null,
    rank: u.rank || "مُبادِر",
    university: u.university || null,
    academicYear: u.academicYear || u.level || null,
    major: u.major || null,
    department: u.department || null,
    bio: u.bio || null,
    socialLinks: u.socialLinks || {},
    points: u.points || 0,
    createdAt: u.createdAt?._seconds
      ? u.createdAt._seconds * 1000
      : u.createdAt?.toMillis?.() || null,
    stats: {
      groupsCount: groupsSnap.data().count,
      resourcesCount: resourcesSnap.data().count,
    },
  });
}, "profile/[uid]");
