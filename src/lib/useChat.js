"use client";

// ════════════════════════════════════════════════════════════════
// TAWASSOL — Real-time Chat Engine (useChat)
// ────────────────────────────────────────────────────────────────
// محرك المزامنة اللحظية الموحّد لشات العقدة الأكاديمية:
//  • مستمع رسائل (onSnapshot) مرتّب زمنياً تصاعدياً + تجميع.
//  • Optimistic UI لإرسال الرسائل قبل تأكيد السيرفر.
//  • مستمعات إدارية للمشرف فقط: طلبات الانضمام + الملفات المعلّقة.
//  • تنظيف كامل لكل القنوات عند مغادرة الشات (cleanup).
// ════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  getDocs,
  serverTimestamp,
  limitToLast,
  endBefore,
} from "firebase/firestore";
import { firestore as db } from "./firebase";
import { COL } from "./collectionNames";

// الحد الزمني لتجميع الرسائل المتتالية لنفس المرسل (5 دقائق)
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

/**
 * toDate — يُحوّل أي صيغة timestamp إلى Date JavaScript.
 * يدعم: Firestore Timestamp، { seconds }، Date، أو string.
 * يُستخدم لتوحيد المقارنة الزمنية بين رسائل السيرفر والـ Optimistic.
 */
function toDate(ts) {
  if (!ts) return new Date();
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (ts?.seconds) return new Date(ts.seconds * 1000);
  return ts instanceof Date ? ts : new Date(ts);
}

/**
 * applyGrouping — يُضيف خاصية _grouped لكل رسالة.
 * رسالة مُجمَّعة (_grouped: true) تخفي صورة المرسل والاسم في الواجهة،
 * مما يُعطي مظهر محادثة سلس مثل Slack/Discord.
 *
 * شرط التجميع: نفس المرسل + الوقت أقل من GROUPING_WINDOW_MS عن السابقة.
 */
function applyGrouping(list) {
  return list.map((m, i) => {
    const prev = list[i - 1];
    const sameUser = prev && prev.uid === m.uid;
    const recent = prev && m.createdAt - prev.createdAt < GROUPING_WINDOW_MS;
    return { ...m, _grouped: !!(sameUser && recent) };
  });
}

/**
 * useChat — الـ Hook الرئيسي لمحرك الشات اللحظي.
 *
 * @param {string} groupId  - معرّف المجموعة
 * @param {object} user     - كائن Firebase Auth (للـ uid)
 * @param {object} userData - بيانات Firestore للمستخدم (role, fullName...)
 * @param {object} group    - بيانات Firestore للمجموعة (leaderId, accessType...)
 *
 * @returns {{
 *   messages: Array,       - الرسائل النهائية (مُدمجة + مُجمَّعة + مُصفاة)
 *   loading: boolean,      - true حتى وصول أول snapshot
 *   error: string|null,    - رسالة الخطأ إن وجدت
 *   sendMessage: Function, - دالة الإرسال (Optimistic)
 *   hasMore: boolean,      - هل توجد رسائل أقدم قابلة للتحميل
 *   loadMore: Function,    - تحميل الصفحة السابقة من الرسائل
 *   joinRequests: Array,   - طلبات الانضمام المعلّقة (للمشرف فقط)
 *   pendingFiles: Array,   - الملفات في انتظار المراجعة (للمشرف فقط)
 *   pendingCount: number,  - مجموع العناصر المعلّقة (للشارة)
 *   canOverseer: boolean,  - هل للمستخدم صلاحيات إشراف (قائد أو أدمن)
 * }}
 */
export function useChat({ groupId, user, userData, group } = {}) {
  // canOverseer: يُحدّد من يرى لوحة الإشراف وطلبات الانضمام والملفات المعلّقة
  const isLeader = !!(group?.leaderId && user?.uid && group.leaderId === user.uid);
  const isAdmin = userData?.role === "admin";
  const canOverseer = isLeader || isAdmin;

  const [serverMessages, setServerMessages] = useState([]);
  const [optimistic, setOptimistic] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // مفاتيح الرسائل المرسلة مؤقتاً — للمطابقة عند وصول النسخة الحقيقية
  const sentKeys = useRef(new Map()); // key -> tempId
  // أقدم DocumentSnapshot في العرض الحالي — يُستخدم في endBefore عند التحميل المسبق
  const oldestDocRef = useRef(null);

  // ── 1) مستمع الرسائل ───────────────────────────────────────
  // 🛡️ حارس: ننتظر اكتمال الـ Auth + userData قبل ربط أي listener.
  // userData لا يُملأ إلا بعد نجاح getIdToken() في useAuth → ضمان جاهزية التوكن.
  useEffect(() => {
    if (!groupId || !user?.uid || !userData) {
      setServerMessages([]);
      setHasMore(false);
      oldestDocRef.current = null;
      setLoading(false);
      return;
    }

    oldestDocRef.current = null;

    const q = query(
      collection(db, COL.MESSAGES),
      where("groupId", "==", groupId),
      orderBy("createdAt", "asc"),
      limitToLast(50),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: toDate(data.createdAt),
          };
        });

        if (snap.docs.length > 0) oldestDocRef.current = snap.docs[0];
        setHasMore(snap.docs.length === 50);

        // إزالة أي optimistic تأكّد وصوله من السيرفر (مطابقة uid + content)
        setOptimistic((prev) =>
          prev.filter((o) => {
            const matched = raw.some(
              (r) =>
                r.uid === o.uid &&
                (r.content || "") === (o.content || "") &&
                (r.fileUrl || null) === (o.fileUrl || null),
            );
            if (matched) sentKeys.current.delete(o.id);
            return !matched;
          }),
        );

        setServerMessages(raw);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("[useChat] messages listener failed:", err);
        setError(err?.message || "messages-failed");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [groupId, user?.uid, !!userData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1b) تحميل رسائل أقدم (pagination) ──────────────────────
  const loadMore = useCallback(async () => {
    if (!oldestDocRef.current || !groupId) return;
    const q = query(
      collection(db, COL.MESSAGES),
      where("groupId", "==", groupId),
      orderBy("createdAt", "asc"),
      endBefore(oldestDocRef.current),
      limitToLast(50),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      setHasMore(false);
      return;
    }
    const older = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: toDate(data.createdAt) };
    });
    oldestDocRef.current = snap.docs[0];
    setHasMore(snap.docs.length === 50);
    setServerMessages((prev) => [...older, ...prev]);
  }, [groupId]);

  // ── 2) مستمع طلبات الانضمام (للمشرف فقط) ──────────────────
  useEffect(() => {
    if (!groupId || !canOverseer) {
      setJoinRequests([]);
      return;
    }
    const q = query(
      collection(db, COL.JOIN_REQUESTS),
      where("groupId", "==", groupId),
      where("status", "==", "pending"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setJoinRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("[useChat] join-requests listener failed:", err),
    );
    return () => unsub();
  }, [groupId, canOverseer]);

  // ── 3) مستمع الملفات المعلّقة (للمشرف فقط) ────────────────
  useEffect(() => {
    if (!groupId || !canOverseer) {
      setPendingFiles([]);
      return;
    }
    const q = query(
      collection(db, COL.MESSAGES),
      where("groupId", "==", groupId),
      where("moderationStatus", "==", "pending"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const files = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.fileUrl);
        setPendingFiles(files);
      },
      (err) => console.error("[useChat] pending-files listener failed:", err),
    );
    return () => unsub();
  }, [groupId, canOverseer]);

  // ── 4) إرسال رسالة (Optimistic UI) ─────────────────────────
  const sendMessage = useCallback(
    async ({
      content = "",
      fileUrl = null,
      fileName = null,
      fileType = null,
      fileSize = null,
    } = {}) => {
      const trimmed = (content || "").trim();
      if (!trimmed && !fileUrl) return;
      if (!user?.uid || !groupId) return;

      const isAuthorized = isLeader || isAdmin;
      const moderationStatus = fileUrl && !isAuthorized ? "pending" : "approved";

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localMsg = {
        id: tempId,
        _optimistic: true,
        uid: user.uid,
        groupId,
        content: trimmed,
        senderName: userData?.fullName || "Scholar",
        role: userData?.role || "student",
        fileUrl,
        fileName,
        fileType,
        fileSize,
        moderationStatus,
        createdAt: new Date(),
      };

      sentKeys.current.set(tempId, true);
      setOptimistic((prev) => [...prev, localMsg]);

      try {
        await addDoc(collection(db, COL.MESSAGES), {
          groupId,
          uid: user.uid,
          content: trimmed,
          senderName: userData?.fullName || "Scholar",
          role: userData?.role || "student",
          fileUrl,
          fileName,
          fileType,
          fileSize,
          moderationStatus,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("[useChat] send failed:", err);
        setOptimistic((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _failed: true } : m)),
        );
        throw err;
      }
    },
    [groupId, user?.uid, userData?.fullName, userData?.role, isLeader, isAdmin],
  );

  // ── 5) دمج رسائل السيرفر مع المؤقتة + تجميع + فلترة ذكية ──
  //   • في العقدة "المحمية": لا تظهر الملفات المعلّقة للأعضاء العاديين.
  //   • المشرف/الأدمن يرى كل شيء (مع شارة Pending Review).
  //   • صاحب الرسالة يرى ملفه دائماً (تجربة Optimistic).
  const isProtected = group?.accessType === "protected";
  const messages = useMemo(() => {
    const merged = [...serverMessages, ...optimistic].sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    const filtered = merged.filter((m) => {
      if (!m.fileUrl) return true;                           // النصوص دائماً
      if (m.moderationStatus === "approved") return true;    // الملفات المعتمدة
      if (canOverseer) return true;                          // المشرف يرى المعلّق
      if (m.uid === user?.uid) return true;                  // صاحب الملف نفسه
      return !isProtected;                                   // العقدة المفتوحة تظهر المعلّق
    });

    return applyGrouping(filtered);
  }, [serverMessages, optimistic, canOverseer, isProtected, user?.uid]);

  return {
    // رسائل
    messages,
    loading,
    error,
    sendMessage,
    hasMore,
    loadMore,

    // لوحة الإشراف
    joinRequests,
    pendingFiles,
    pendingCount: joinRequests.length + pendingFiles.length,
    canOverseer,
  };
}

export default useChat;
