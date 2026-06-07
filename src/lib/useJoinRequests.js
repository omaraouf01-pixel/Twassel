// ══════════════════════════════════════════════════════════════════════
// useJoinRequests — Hook لمتابعة طلبات الانضمام المعلّقة (للقائد فقط)
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { firestore as db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { COL } from "./collectionNames";

/**
 * useJoinRequests — يستمع لحظياً لطلبات الانضمام المعلّقة لمجموعة محددة.
 *
 * يعمل فقط إذا كان isLeader = true (حماية إضافية على جانب العميل).
 * قواعد Firestore تمنع الأعضاء العاديين من قراءة هذه البيانات.
 *
 * @param {string}  groupId  - معرّف المجموعة
 * @param {boolean} isLeader - هل المستخدم الحالي قائد هذه المجموعة
 * @returns {{ requests: Array, pendingCount: number }}
 */
export function useJoinRequests(groupId, isLeader) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // 1. حماية: إذا لم يكن هناك معرف مجموعة أو لم يكن المستخدم قائداً، لا تفعل شيئاً
    if (!groupId || !isLeader) {
      setRequests([]);
      return;
    }

    // 2. بناء الاستعلام من Firestore مباشرة
    const q = query(
      collection(db, COL.JOIN_REQUESTS),
      where("groupId", "==", groupId),
      where("status", "==", "pending")
    );

    // 3. الاستماع اللحظي (Real-time)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRequests(data);
    }, (error) => {
      console.error("❌ خطأ Firestore:", error);
    });

    return () => unsubscribe();
  }, [groupId, isLeader]);

  return { requests, pendingCount: requests.length };
}