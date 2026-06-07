"use client";

// ══════════════════════════════════════════════════════════════════════
// LanguageContext — نظام إدارة اللغة (فرنسي / إنجليزي)
// ──────────────────────────────────────────────────────────────────────
// يُوفّر Context عالمياً لحالة اللغة المحفوظة في localStorage.
// القيمة الافتراضية: "en"، ويُدعم "fr" كلغة بديلة.
// كل مكوّن يريد اللغة الحالية يستخدم useLang() بدلاً من قراءة localStorage مباشرة.
// ══════════════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect } from "react";

const LanguageContext = createContext({ lang: "en", setLang: () => {} });

/**
 * LanguageProvider — مُزوّد السياق العالمي للغة.
 *
 * الوظيفة:
 *  - يحمّل اللغة المحفوظة سابقاً من localStorage عند أول تصيير (CSR فقط).
 *  - يُصدّر { lang, setLang } لجميع المكوّنات الفرعية عبر useLang().
 *
 * يجب تغليف التطبيق بالكامل بهذا المُزوّد في layout.js.
 */
export function LanguageProvider({ children }) {
  // الحالة الأولية: "en" — يُعدَّل من localStorage بعد التحميل الأول
  const [lang, setLangState] = useState("en");

  // استرجاع اللغة المحفوظة بعد وصول المكوّن إلى DOM (تجنّب خطأ hydration)
  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "fr" || saved === "en") setLangState(saved);
  }, []);

  /**
   * setLang — يُغيّر اللغة ويحفظها في localStorage للاستمرارية بين الجلسات.
   * @param {"fr"|"en"} l - اللغة المطلوبة
   */
  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * useLang — Hook للوصول إلى حالة اللغة من أي مكوّن.
 * @returns {{ lang: "fr"|"en", setLang: (l: string) => void }}
 */
export const useLang = () => useContext(LanguageContext);
