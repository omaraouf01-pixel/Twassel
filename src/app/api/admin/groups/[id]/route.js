import { NextResponse } from "next/server";
import { groupsCol, messagesCol, resourcesCol, joinRequestsCol, usersCol, reportsCol } from "@/lib/collections";
import { db, FieldValue } from "@/lib/firestore";
import { verifyAdmin } from "@/lib/verifyAdmin";

// PATCH /api/admin/groups/[id] — change or remove group leader
export async function PATCH(request, { params }) {
  const v = await verifyAdmin(request);
  if (v.error) return NextResponse.json({ error: v.error }, { status: v.status });

  try {
    const groupId = params.id;
    const body = await request.json();
    const { action, memberId } = typeof body === "string" ? JSON.parse(body) : body;
    console.log("[PATCH group] groupId:", groupId, "action:", action, "memberId:", memberId);

    const groupRef = groupsCol().doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (action === "setLeader") {
      if (!memberId) {
        return NextResponse.json({ error: "memberId is required" }, { status: 400 });
      }
      const gData = groupSnap.data();
      const members = Array.isArray(gData.members) ? gData.members : [];
      const membersList = Array.isArray(gData.membersList) ? gData.membersList : [];
      const inMembers = members.includes(memberId);
      const inMembersList = membersList.some((m) => (typeof m === "string" ? m : m?.uid) === memberId);
      if (!inMembers && !inMembersList) {
        return NextResponse.json({ error: "User is not a member of this group" }, { status: 400 });
      }
      const memberSnap = await usersCol().doc(memberId).get();
      if (!memberSnap.exists) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }
      const leaderName = memberSnap.data().fullName || "Unknown";
      await groupRef.update({ leaderId: memberId, leaderName, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, leaderName });
    }

    if (action === "removeLeader") {
      await groupRef.update({ leaderId: null, leaderName: null, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action. Use 'setLeader' or 'removeLeader'." }, { status: 400 });
  } catch (e) {
    console.error("[PATCH group] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/groups/[id]
export async function DELETE(request, { params }) {
  const v = await verifyAdmin(request);
  if (v.error) return NextResponse.json({ error: v.error }, { status: v.status });

  try {
    const groupId = params.id;
    const batch = db.batch();

    // 1. Supprimer le groupe (les requêtes en attente sont embarquées et seront supprimées avec)
    batch.delete(groupsCol().doc(groupId));

    // 2. Supprimer les messages
    const msgSnap = await messagesCol().where("groupId", "==", groupId).get();
    msgSnap.docs.forEach((d) => batch.delete(d.ref));

    // 3. Supprimer les ressources
    const resSnap = await resourcesCol().where("groupId", "==", groupId).get();
    resSnap.docs.forEach((d) => batch.delete(d.ref));

    // 4. Nettoyer l'ancienne collection joinRequests au cas où
    const jrSnap = await joinRequestsCol().where("groupId", "==", groupId).get();
    jrSnap.docs.forEach((d) => batch.delete(d.ref));

    // 5. Supprimer tous les signalements liés au groupe (messages inclus)
    const repSnap = await reportsCol().where("groupId", "==", groupId).get();
    repSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    return NextResponse.json({ ok: true, message: "Groupe supprimé avec succès." });
  } catch (e) {
    console.error("Erreur lors de la suppression:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}