// ══════════════════════════════════════════════════════════════════════
// DELETE /api/groups/[id]/members/[uid] — طرد عضو من المجموعة
// ──────────────────────────────────────────────────────────────────────
// الصلاحية: القائد الأساسي (leaderId) أو مشرف مساعد (coLeaderIds)
//
// القيود:
//  - لا يمكن طرد القائد الأساسي (leaderId) بأي حال.
//  - المشرف المساعد لا يمكنه طرد مشرف مساعد آخر.
//
// يُحدّث: members + membersList + coLeaderIds + memberCount في Firestore.
// ══════════════════════════════════════════════════════════════════════

import { groupsCol } from "@/lib/collections";
import { FieldValue } from "@/lib/firestore";
import { withAuth, jsonOk, jsonError } from "@/lib/withAuth";
export const DELETE = withAuth(async (_req, { params }, { uid }) => {
  const ref = groupsCol().doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Group not found", 404);
  const group = snap.data();

  const isPrimaryLeader = group.leaderId === uid;
  const isCoLeader = (group.coLeaderIds || []).includes(uid);

  if (!isPrimaryLeader && !isCoLeader) {
    return jsonError("Forbidden — leaders only", 403);
  }

  // لا يمكن طرد القائد الأساسي بأي حال
  if (params.uid === group.leaderId) {
    return jsonError("Cannot remove the primary leader");
  }

  // المشرف المساعد لا يمكنه طرد مشرف مساعد آخر
  if (!isPrimaryLeader && (group.coLeaderIds || []).includes(params.uid)) {
    return jsonError("Co-leaders cannot remove other co-leaders", 403);
  }

  const newMembers = (group.members || []).filter((m) => m !== params.uid);
  const newMembersList = (group.membersList || []).filter((m) => m.uid !== params.uid);
  const newCoLeaderIds = (group.coLeaderIds || []).filter((id) => id !== params.uid);

  await ref.update({
    members: newMembers,
    membersList: newMembersList,
    coLeaderIds: newCoLeaderIds,
    memberCount: newMembers.length,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return jsonOk();
}, "MEMBER_KICK");
