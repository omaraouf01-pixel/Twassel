// ══════════════════════════════════════════════════════════════════════
// /api/admin/users — إدارة المستخدمين (للأدمن فقط)
// ──────────────────────────────────────────────────────────────────────
// GET  → قائمة كل المستخدمين مرتّبة من الأحدث
// POST → إنشاء حساب طالب جديد مباشرة من لوحة الأدمن
//         (بدون رفع بطاقة طالب — الحساب يُفعَّل مباشرةً)
// ══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { usersCol, buildUserDoc } from "@/lib/collections";
import { listSnap, adminAuth } from "@/lib/firestore";
import { verifyAdmin } from "@/lib/verifyAdmin";

/**
 * GET /api/admin/users
 * يجلب قائمة كل المستخدمين (جميع الحالات) مرتّبة من الأحدث.
 * يُصدّر الحقول الضرورية فقط لواجهة الأدمن.
 */
export async function GET(request) {
  const v = await verifyAdmin(request);
  if (v.error) return NextResponse.json({ error: v.error }, { status: v.status });

  const snap = await usersCol().orderBy("createdAt", "desc").get();
  const users = listSnap(snap);

  const formatted = users.map((u) => ({
    id: u.uid || u.id,
    uid: u.uid,
    name: u.fullName,
    fullName: u.fullName,
    matricule: u.matricule,
    email: u.email,
    role: u.role,
    status: u.status,
    groups: u.groups,
    onboarded: u.onboarded,
    studentCardUrl: u.studentCardUrl,
    idCardUrl: u.studentCardUrl,
    avatarUrl: u.avatarUrl,
    university: u.university,
    department: u.department,
    bio: u.bio,
    createdAt: u.createdAt,
    createdByAdmin: u.createdByAdmin,
  }));
  return NextResponse.json({ users: formatted });
}

// POST /api/admin/users — admin crée un nouvel étudiant
export async function POST(request) {
  const v = await verifyAdmin(request);
  if (v.error) return NextResponse.json({ error: v.error }, { status: v.status });

  const { name, matricule, email, password, role = "student" } = await request.json();
  if (!name || !matricule || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  let createdUid = null;
  try {
    const col = usersCol();

    // Unicité (matricule, email)
    const [byMat, byEmail] = await Promise.all([
      col.where("matricule", "==", matricule).limit(1).get(),
      col.where("email", "==", email).limit(1).get(),
    ]);
    if (!byMat.empty) {
      return NextResponse.json({ error: "Ce matricule est déjà utilisé." }, { status: 409 });
    }
    if (!byEmail.empty) {
      return NextResponse.json({ error: "Ce email est déjà utilisé." }, { status: 409 });
    }

    // ── Création silencieuse Firebase Auth (côté serveur) ──
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });
    createdUid = userRecord.uid;

    await col.doc(createdUid).set(
      buildUserDoc({
        uid: createdUid,
        fullName: name,
        matricule,
        email,
        role,
        status: "active",
        groups: [],
        createdByAdmin: true,
      })
    );

    return NextResponse.json({ uid: createdUid }, { status: 201 });
  } catch (e) {
    // Rollback Auth si Firestore échoue
    if (createdUid) {
      try { await adminAuth.deleteUser(createdUid); } catch {}
    }
    if (e.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }
    if (e.code === "auth/invalid-email") {
      return NextResponse.json({ error: "Format d'email invalide." }, { status: 400 });
    }
    if (e.code === "auth/invalid-password") {
      return NextResponse.json({ error: "Mot de passe trop faible (min 6)." }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
