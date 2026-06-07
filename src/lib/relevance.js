// ════════════════════════════════════════════════════════════════
// Relevance Algorithm — Discovery Engine for TAWASSOL Explore
// ────────────────────────────────────────────────────────────────
// خوارزميات نقية (Pure) لاختيار/ترتيب المجموعات حسب علاقتها بالمستخدم.
// لا تعتمد على Firebase ولا React — قابلة للاختبار بدون context.
//
// النقطة الإجمالية لكل عقدة:
//   relevanceScore = major*10 + level*4 + popularity + recency*0.5
// ════════════════════════════════════════════════════════════════

// الحد الأقصى لعدد العقد في كل رف (shelf) في صفحة Explore
const SHELF_LIMIT = 10;

/** norm — تُوحّد النص للمقارنة: lowercase + trim */
function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

/**
 * tokenize — تُقسّم النص إلى كلمات بإزالة الفواصل والمسافات والشرطات.
 * تُستخدم لمقارنة التخصصات كـ tokens منفردة بدلاً من مقارنة النص كاملاً.
 */
function tokenize(s) {
  return norm(s).split(/[\s,/\-_()]+/).filter(Boolean);
}

/**
 * majorMatchScore — تحسب عدد الكلمات المشتركة بين تخصص المستخدم وبيانات العقدة.
 * تُفحص: subject + major + tags للعقدة مقابل major المستخدم.
 * كل كلمة مشتركة (>= 3 أحرف) = نقطة إضافية.
 */
function majorMatchScore(node, user) {
  const userTokens = new Set(tokenize(user?.major));
  if (userTokens.size === 0) return 0;

  const nodeText = [
    node.subject,
    node.major,
    ...(Array.isArray(node.tags) ? node.tags : []),
  ].join(" ");
  const nodeTokens = tokenize(nodeText);

  let hits = 0;
  for (const t of nodeTokens) {
    if (t.length >= 3 && userTokens.has(t)) hits++;
  }
  return hits;
}

/**
 * levelMatchScore — تعيد 1 إذا تطابق مستوى المستخدم مع مستوى العقدة، 0 غير ذلك.
 * الأثر: 4 نقاط في الدرجة الإجمالية (ثاني أهم عامل بعد التخصص).
 */
function levelMatchScore(node, user) {
  if (!user?.level || !node.level) return 0;
  return norm(node.level) === norm(user.level) ? 1 : 0;
}

/**
 * recencyBoost — تُعطي نقاطاً إضافية للعقد النشطة مؤخراً.
 * < 24 ساعة: +3 نقاط / < 7 أيام: +2 / < 30 يوماً: +1 / أقدم: 0
 */
function recencyBoost(node) {
  const ts = toMillis(node.updatedAt) || toMillis(node.createdAt);
  if (!ts) return 0;
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  if (ageHours < 24) return 3;
  if (ageHours < 24 * 7) return 2;
  if (ageHours < 24 * 30) return 1;
  return 0;
}

/**
 * toMillis — يُحوّل أي صيغة timestamp إلى ميلي ثانية.
 * يدعم: number، string ISO، Firestore Timestamp، { seconds } من Firestore SDK.
 */
function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (v.toMillis) return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  return 0;
}

// نقطة الملاءمة الكلية: تخصص (الأقوى) + سنة + شعبية + حداثة
export function relevanceScore(node, user) {
  const major = majorMatchScore(node, user);
  const level = levelMatchScore(node, user);
  const popularity = Math.min((node.memberCount || node.members?.length || 0) / 5, 2);
  const recency = recencyBoost(node);
  return major * 10 + level * 4 + popularity + recency * 0.5;
}

// ─── Public Selectors ──────────────────────────────────────────

/**
 * المجموعات المتزامنة مع تخصص الطالب.
 * تشترط وجود تطابق حقيقي (score > 0) — لا تستخدم fallback عشوائي.
 */
export function selectMajorMatched(nodes, user, limit = SHELF_LIMIT) {
  if (!user?.major) return [];
  return nodes
    .map((n) => ({ n, s: majorMatchScore(n, user) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      return relevanceScore(b.n, user) - relevanceScore(a.n, user);
    })
    .slice(0, limit)
    .map(({ n }) => n);
}

/**
 * العقد عالية النشاط: مزيج من الشعبية (memberCount) والحداثة (updatedAt).
 */
export function selectHighFrequency(nodes, limit = SHELF_LIMIT) {
  return [...nodes]
    .map((n) => ({
      n,
      s:
        (n.memberCount || n.members?.length || 0) * 1.0 +
        recencyBoost(n) * 2,
    }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ n }) => n);
}

/**
 * استبعاد ID-set من المصفوفة (للمجموعات التي يشارك فيها الطالب).
 */
export function excludeIds(nodes, idsSet) {
  if (!idsSet || idsSet.size === 0) return nodes;
  return nodes.filter((n) => !idsSet.has(n.id));
}
