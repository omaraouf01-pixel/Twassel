import { v2 as cloudinary } from "cloudinary";
import { groupsCol, messagesCol, notificationsCol, buildNotificationDoc, reportsCol } from "@/lib/collections";
import { db, FieldValue, snapToObj } from "@/lib/firestore";
import { withAuth, jsonOk, jsonError } from "@/lib/withAuth";

// ── Cloudinary config (same as /api/upload) ───────────────────────
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Extracts the Cloudinary public_id from a secure_url.
 *
 * Example URL:
 *   https://res.cloudinary.com/<cloud>/image/upload/v1234/tawassol/groups/abc/files/myfile.pdf
 *   → public_id = "tawassol/groups/abc/files/myfile"
 *
 * The public_id is everything after "/upload/vXXX/" without the extension.
 */
function extractPublicId(url) {
  if (!url) return null;
  try {
    // Match: /upload/v<digits>/<public_id>.<ext>
    const match = url.match(/\/upload\/v\d+\/(.+)\.[^.]+$/);
    if (match) return match[1];

    // Fallback: /upload/<public_id>.<ext> (no version)
    const fallback = url.match(/\/upload\/(.+)\.[^.]+$/);
    return fallback ? fallback[1] : null;
  } catch {
    return null;
  }
}

/**
 * Destroy a Cloudinary asset. FAIL-FAST: throws on failure so the caller
 * can abort before deleting the Firestore document (which holds the only
 * URL reference to this asset).
 *
 * "not found" is treated as success — the asset is already gone.
 */
async function destroyCloudinaryAsset(url) {
  const publicId = extractPublicId(url);
  if (!publicId) {
    const err = new Error(`[CLOUDINARY] Could not extract public_id from: ${url}`);
    err.status = 500;
    throw err;
  }

  // Try image first (most common)
  const imgResult = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  if (imgResult.result === "ok" || imgResult.result === "not found") {
    // "not found" as image → try raw (PDF, doc, etc.)
    if (imgResult.result === "not found") {
      const rawResult = await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
      if (rawResult.result !== "ok" && rawResult.result !== "not found") {
        const err = new Error(`[CLOUDINARY] Failed to destroy raw asset ${publicId}: ${rawResult.result}`);
        err.status = 500;
        throw err;
      }
    }
    return; // success
  }

  // Unexpected result from Cloudinary
  const err = new Error(`[CLOUDINARY] Failed to destroy asset ${publicId}: ${imgResult.result}`);
  err.status = 500;
  throw err;
}

/**
 * PATCH /api/groups/[id]/messages/[msgId]
 * Body: { action: "approve" }
 * Leader-only: sets moderationStatus to "approved".
 */
export const PATCH = withAuth(async (req, { params }, { uid }) => {
  const gSnap = await groupsCol().doc(params.id).get();
  if (!gSnap.exists) return jsonError("Group not found", 404);
  if (gSnap.data().leaderId !== uid) return jsonError("Leader only", 403);

  const mSnap = await messagesCol().doc(params.msgId).get();
  if (!mSnap.exists) return jsonError("Message not found", 404);
  if (mSnap.data().groupId !== params.id) return jsonError("Message does not belong to this group", 403);

  await mSnap.ref.update({ moderationStatus: "approved" });
  return jsonOk({ ok: true });
}, "MSG_APPROVE");

/**
 * DELETE /api/groups/[id]/messages/[msgId]
 * Leader-only: deletes the Cloudinary asset, deletes the Firestore message,
 * and creates a rejection notification — all in one request.
 */
export const DELETE = withAuth(async (req, { params }, { uid }) => {
  // 1. Verify leader
  const gSnap = await groupsCol().doc(params.id).get();
  if (!gSnap.exists) return jsonError("Group not found", 404);
  if (gSnap.data().leaderId !== uid) return jsonError("Leader only", 403);

  // 2. Read message
  const mSnap = await messagesCol().doc(params.msgId).get();
  if (!mSnap.exists) return jsonError("Message not found", 404);
  const msg = mSnap.data();
  if (msg.groupId !== params.id) return jsonError("Message does not belong to this group", 403);

  // 3. Parse optional rejection reason from request body
  let reason = "";
  try {
    const body = await req.json();
    reason = body?.reason || "";
  } catch { /* no body or invalid JSON — that's fine */ }

  // 4. Destroy Cloudinary asset (image or file)
  const assetUrl = msg.imageUrl || msg.fileUrl;
  if (assetUrl) {
    await destroyCloudinaryAsset(assetUrl);
  }

  // 5. Batch: delete message + create notification
  const batch = db.batch();
  batch.delete(mSnap.ref);
  const notifRef = notificationsCol().doc();
  batch.set(notifRef, buildNotificationDoc({
    userId: msg.uid,
    title: "ملف أو رسالة مرفوضة",
    body: reason
      ? `تم رفض المحتوى من قبل قائد المجموعة. السبب: ${reason}`
      : "تم حذف المحتوى أو رفضه من قبل قائد المجموعة.",
    link: `/hub/chat/${params.id}`,
  }));

  // Delete all pending reports for this message as requested
  const relatedReports = await reportsCol().where("msgId", "==", params.msgId).where("status", "==", "pending").get();
  relatedReports.forEach(rDoc => {
    batch.delete(rDoc.ref);
  });

  await batch.commit();

  return jsonOk({ ok: true, destroyed: !!assetUrl });
}, "MSG_REJECT");
