import { usersCol } from "./collections";
import { snapToObj, adminAuth } from "./firestore";

/**
 * ════════════════════════════════════════════════════════════════
 *  Authentification serveur — TSSWAL
 * ════════════════════════════════════════════════════════════════
 *  Header attendu : "Authorization: Bearer <ID_TOKEN>"
 *
 *  Étapes :
 *   1. Vérifier l'ID Token via firebase-admin (signature + expiration)
 *   2. Lire les Custom Claims (admin: true) → autorisation rapide
 *   3. Si pas de claim, FALLBACK : lire Firestore pour le rôle (real-time)
 *      → garantit qu'on n'est jamais bloqué si les claims ne sont pas encore
 *        propagés (ex: admin promu via Console juste avant le request).
 *
 *  Compatibilité :
 *   - Si le client envoie encore un UID brut (ancien apiClient), on tente
 *     un fallback : lookup direct par UID dans Firestore.
 *   - Cela permet une migration progressive sans casser l'app.
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Récupère le user document Firestore par UID.
 * Cherche d'abord par doc ID = uid (cas standard), sinon par champ `uid`.
 */
export async function getUserByUid(uid) {
  if (!uid) return null;
  const direct = await usersCol().doc(uid).get();
  if (direct.exists) return snapToObj(direct);

  const snap = await usersCol().where("uid", "==", uid).limit(1).get();
  if (snap.empty) return null;
  return snapToObj(snap.docs[0]);
}

/**
 * Extrait l'UID + Custom Claims de l'header Authorization.
 *
 * Stratégie :
 *  1. Si la chaîne ressemble à un ID Token JWT (3 parties séparées par '.'),
 *     on la vérifie via adminAuth.verifyIdToken() → renvoie {uid, claims}
 *  2. Sinon (chaîne courte = UID brut), on l'accepte mais SANS claims
 *     (mode legacy — l'autorisation passera obligatoirement par Firestore).
 *
 *  Retourne : { uid, claims } ou { error, status }.
 */
async function extractIdentity(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Missing token", status: 401 };

  // Détection JWT (3 segments base64 séparés par '.')
  const isJwt = token.split(".").length === 3 && token.length > 100;

  if (isJwt) {
    try {
      // checkRevoked: false → plus rapide. Mettre à true si vous bloquez des comptes.
      const decoded = await adminAuth.verifyIdToken(token, false);
      return { uid: decoded.uid, claims: decoded };
    } catch (e) {
      // Token expiré, signature invalide, etc.
      return { error: "Invalid or expired token: " + (e.code || e.message), status: 401 };
    }
  }

  return { error: "Invalid token format", status: 401 };
}

/**
 * Vérifie qu'on a un admin authentifié.
 *
 * Logique :
 *  ✅ Si claims.admin === true → OK immédiatement (rapide, pas de Firestore)
 *  ✅ Sinon : lookup Firestore (real-time) et vérifie role === "admin"
 *
 *  Cela garantit qu'un admin promu MANUELLEMENT dans Firestore
 *  (sans setCustomUserClaims) est quand même reconnu — pas de 403 abusif.
 */
export async function verifyAdmin(request) {
  const id = await extractIdentity(request);
  if (id.error) return id;

  // ── Fast path : custom claim ──
  if (id.claims?.admin === true) {
    return { uid: id.uid, claims: id.claims, source: "claims" };
  }

  // ── Real-time Firestore check (autorité finale) ──
  try {
    const user = await getUserByUid(id.uid);
    if (!user) return { error: "User not found", status: 404 };
    if (user.role !== "admin") return { error: "Forbidden — admin only", status: 403 };

    // Auto-sync : si l'utilisateur est admin dans Firestore mais n'a pas de claim,
    // on lui en pose un en arrière-plan pour les prochains requests (idempotent).
    if (id.claims && !id.claims.admin) {
      adminAuth.setCustomUserClaims(id.uid, { admin: true, role: "admin" }).catch((e) => {
        console.warn("[verifyAdmin] auto-claim failed:", e.message);
      });
    }

    return { uid: id.uid, user, source: "firestore" };
  } catch (e) {
    return { error: "Auth error: " + e.message, status: 401 };
  }
}

/**
 * Vérifie un user authentifié (n'importe quel rôle).
 */
export async function verifyAuth(request) {
  const id = await extractIdentity(request);
  if (id.error) return id;

  try {
    const user = await getUserByUid(id.uid);
    if (!user) return { error: "User not found", status: 404 };
    return { uid: id.uid, user, claims: id.claims };
  } catch (e) {
    return { error: "Auth error: " + e.message, status: 401 };
  }
}
