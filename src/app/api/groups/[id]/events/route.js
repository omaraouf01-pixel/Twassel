import { groupsCol } from "@/lib/collections";
import { FieldValue, adminDb } from "@/lib/firebaseAdmin";
import { withAuth, jsonOk, jsonError, safeJson } from "@/lib/withAuth";

function eventsCol(groupId) {
  return adminDb.collection("groups").doc(groupId).collection("events");
}

/** Verify caller is a member or admin of the group */
async function authorizeGroup(groupId, uid, userRole) {
  const gSnap = await groupsCol().doc(groupId).get();
  if (!gSnap.exists) return { ok: false, status: 404, msg: "Group not found" };
  const g = gSnap.data();
  const isMember = Array.isArray(g.members) && g.members.includes(uid);
  if (!isMember && userRole !== "admin")
    return { ok: false, status: 403, msg: "Group members only" };
  const isLeader =
    g.leaderId === uid ||
    (Array.isArray(g.coLeaderIds) && g.coLeaderIds.includes(uid));
  const canManage = isLeader || userRole === "admin";
  return { ok: true, g, canManage };
}

// ── GET /api/groups/[id]/events ───────────────────────────────────
export const GET = withAuth(async (_req, { params }, { uid, user }) => {
  const { id: groupId } = params;
  const check = await authorizeGroup(groupId, uid, user.role);
  if (!check.ok) return jsonError(check.msg, check.status);

  const snap = await eventsCol(groupId).get();
  const events = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return jsonOk({ events });
}, "EVENTS_GET");

// ── POST /api/groups/[id]/events ──────────────────────────────────
export const POST = withAuth(async (req, { params }, { uid, user }) => {
  const { id: groupId } = params;
  const check = await authorizeGroup(groupId, uid, user.role);
  if (!check.ok) return jsonError(check.msg, check.status);
  if (!check.canManage) return jsonError("Only leaders and admins can add events", 403);

  const body = await safeJson(req);
  const title = (body?.title || "").trim().slice(0, 100);
  const date = (body?.date || "").trim();
  if (!title || !date) return jsonError("title and date are required", 400);

  const eventDoc = {
    title,
    date,
    time: (body?.time || "").trim(),
    description: (body?.description || "").trim().slice(0, 500),
    authorId: uid,
    authorName: user.fullName || "Scholar",
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await eventsCol(groupId).add(eventDoc);
  return jsonOk({ id: ref.id, ...eventDoc }, 201);
}, "EVENTS_POST");

// ── PATCH /api/groups/[id]/events ─────────────────────────────────
export const PATCH = withAuth(async (req, { params }, { uid, user }) => {
  const { id: groupId } = params;
  const check = await authorizeGroup(groupId, uid, user.role);
  if (!check.ok) return jsonError(check.msg, check.status);
  if (!check.canManage) return jsonError("Only leaders and admins can edit events", 403);

  const body = await safeJson(req);
  const eventId = body?.eventId;
  if (!eventId) return jsonError("eventId is required", 400);

  const eventRef = eventsCol(groupId).doc(eventId);
  const snap = await eventRef.get();
  if (!snap.exists) return jsonError("Event not found", 404);

  const updates = {};
  if (body.title !== undefined) updates.title = (body.title || "").trim().slice(0, 100);
  if (body.date  !== undefined) updates.date  = (body.date  || "").trim();
  if (body.time  !== undefined) updates.time  = (body.time  || "").trim();
  if (body.description !== undefined)
    updates.description = (body.description || "").trim().slice(0, 500);

  if (updates.title === "") return jsonError("title cannot be empty", 400);
  if (updates.date  === "") return jsonError("date cannot be empty",  400);

  updates.updatedAt = FieldValue.serverTimestamp();
  await eventRef.update(updates);
  return jsonOk({ ok: true });
}, "EVENTS_PATCH");

// ── DELETE /api/groups/[id]/events ────────────────────────────────
export const DELETE = withAuth(async (req, { params }, { uid, user }) => {
  const { id: groupId } = params;
  const check = await authorizeGroup(groupId, uid, user.role);
  if (!check.ok) return jsonError(check.msg, check.status);
  if (!check.canManage) return jsonError("Only leaders and admins can delete events", 403);

  // قراءة eventId من query params (الطريقة الموثوقة) أو من body كـ fallback
  const { searchParams } = new URL(req.url);
  let eventId = searchParams.get("eventId");
  if (!eventId) {
    const body = await safeJson(req);
    eventId = body?.eventId;
  }
  if (!eventId) return jsonError("eventId is required", 400);

  const eventRef = eventsCol(groupId).doc(eventId);
  const snap = await eventRef.get();
  if (!snap.exists) return jsonError("Event not found", 404);

  await eventRef.delete();
  return jsonOk({ ok: true });
}, "EVENTS_DELETE");
