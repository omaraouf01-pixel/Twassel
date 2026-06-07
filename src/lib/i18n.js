// ══════════════════════════════════════════════════════════════════════
// i18n — نظام الترجمة الثنائي للغة (فرنسي / إنجليزي)
// ──────────────────────────────────────────────────────────────────────
// كل مفتاح في قاموس translations يحمل قيمة لكلتا اللغتين:
//   "key": { fr: "النص الفرنسي", en: "النص الإنجليزي" }
//
// الاستخدام داخل المكوّنات:
//   const { t } = useTranslation();
//   t("nav.hub")                      → "The Hub" أو "Le Hub"
//   t("admin.confirm_delete_group", { name: "Math" }) → يستبدل {name} بـ "Math"
// ══════════════════════════════════════════════════════════════════════

import { useLang } from "./LanguageContext";

export const translations = {
  // ─── Sidebar ─────────────────────────────────────────────────────
  "nav.hub":                    { fr: "Le Hub",               en: "The Hub" },
  "nav.explore":                { fr: "Explorer",             en: "Explore" },
  "nav.nodes":                  { fr: "Nœuds",                en: "Nodes" },
  "nav.profile":                { fr: "Profil",               en: "Profile" },
  "sidebar.communities":        { fr: "Mes Communautés",      en: "My Communities" },
  "sidebar.no_clusters":        { fr: "Aucun cluster actif.", en: "No active clusters detected." },
  "sidebar.system_control":     { fr: "Contrôle Système",     en: "System Control" },
  "sidebar.overseer":           { fr: "Superviseur",          en: "Overseer" },
  "sidebar.member":             { fr: "Membre",               en: "Member" },
  "sidebar.back_hub":           { fr: "Retour au Hub",        en: "Back to Hub" },
  "sidebar.admin_panel":        { fr: "Panneau Admin",        en: "Admin Panel" },
  "sidebar.terminate":          { fr: "Terminer la session",  en: "Terminate session" },

  // ─── Settings Menu ───────────────────────────────────────────────
  "settings.title":             { fr: "Options du Compte",          en: "Account Options" },
  "settings.night_mode":        { fr: "Mode Nuit",                  en: "Night Mode" },
  "settings.night_hint":        { fr: "Érudit Nocturne",            en: "Night Scholar" },
  "settings.daylight":          { fr: "Lumière du Jour",            en: "Daylight" },
  "settings.security":          { fr: "Sécurité",                   en: "Security" },
  "settings.security_hint":     { fr: "Envoyer un lien de réinitialisation", en: "Send a reset link to your email" },
  "settings.privacy":           { fr: "Confidentialité",            en: "Privacy Level" },
  "settings.privacy_hint":      { fr: "Choisissez qui voit votre profil", en: "Choose who can see your profile" },
  "settings.logout":            { fr: "Se déconnecter",             en: "Log out" },
  "settings.logout_error":      { fr: "Impossible de se déconnecter.", en: "Could not log out." },

  // ─── Landing page ────────────────────────────────────────────────
  "landing.loading":            { fr: "Synchronisation...",         en: "Synchronizing Sanctuary..." },
  "landing.tagline":            { fr: "Bienvenue dans le futur de l'apprentissage", en: "Welcome to the future of learning" },
  "landing.hero1":              { fr: "Là où",                      en: "Where" },
  "landing.hero2":              { fr: "Le Savoir",                  en: "Knowledge" },
  "landing.hero3":              { fr: "Se Synchronise",             en: "Synchronizes" },
  "landing.description":        { fr: "Twassel est un écosystème académique conçu pour les étudiants afin de partager le savoir et d'évoluer ensemble.", en: "Twassel is a sophisticated academic ecosystem designed for scholars to share knowledge and grow together." },
  "landing.join":               { fr: "Nous Rejoindre",             en: "Join Us" },
  "landing.signin":             { fr: "Se Connecter",               en: "Sign In" },
  "landing.explore":            { fr: "Explorer la Plateforme",     en: "Explore Platform" },
  "landing.feature1_title":     { fr: "Groupes Académiques",        en: "Academic Groups" },
  "landing.feature1_desc":      { fr: "Créer et rejoindre des groupes d'étude", en: "Create and join study groups" },
  "landing.feature2_title":     { fr: "Collaborer",                 en: "Collaborate" },
  "landing.feature2_desc":      { fr: "Partager ressources et connaissances", en: "Share resources and knowledge" },
  "landing.feature3_title":     { fr: "Grandir Ensemble",           en: "Grow Together" },
  "landing.feature3_desc":      { fr: "Suivre les progrès et atteindre les objectifs", en: "Track progress and achieve goals" },

  // ─── Pending page ────────────────────────────────────────────────
  "pending.portal":             { fr: "Portail d'Accès",            en: "Gateway Portal" },
  "pending.title":              { fr: "Votre compte est en cours d'examen", en: "Your account is under review" },
  "pending.desc":               { fr: "Notre équipe examine votre carte étudiant. Votre compte sera activé dans les 24 heures.", en: "Our team is reviewing your student card. Your account will be activated within 24 hours." },
  "pending.status":             { fr: "En attente",                 en: "Pending" },
  "pending.logout":             { fr: "Se déconnecter",             en: "Log out" },
  "pending.footer":             { fr: "Réseau Universitaire d'Oran · Twassel", en: "Oran University Network · Twassel" },

  // ─── Profile page ────────────────────────────────────────────────
  "profile.node_label":         { fr: "Nœud Académique",           en: "Academic Node" },
  "profile.title":              { fr: "Mon Profil Académique",      en: "My Academic Profile" },
  "profile.edit_btn":           { fr: "Modifier le Profil",         en: "Edit Profile" },
  "profile.nodes_joined":       { fr: "Nœuds Rejoints",            en: "Nodes Joined" },
  "profile.resources":          { fr: "Ressources",                 en: "Resources" },
  "profile.joined":             { fr: "Rejoint",                    en: "Joined" },
  "profile.bio_label":          { fr: "Bio Académique",             en: "Academic Bio" },
  "profile.bio_edit":           { fr: "Modifier",                   en: "Edit" },
  "profile.bio_empty":          { fr: "Pas encore de bio. Ajoutez une note sur vos intérêts de recherche.", en: "No bio yet. Add a short note about your research interests, projects, and what you're studying." },
  "profile.links_label":        { fr: "Liens Professionnels",       en: "Professional Links" },
  "profile.links_empty":        { fr: "Ajoutez GitHub, LinkedIn ou un portfolio pour montrer vos travaux.", en: "Add GitHub, LinkedIn, or a portfolio link to showcase your work." },
  "profile.year_empty":         { fr: "Année non spécifiée",        en: "Year not specified" },
  "profile.modal_title":        { fr: "Modifier le Profil",         en: "Edit Profile" },
  "profile.modal_subtitle":     { fr: "Mon Profil Académique",      en: "My Academic Profile" },
  "profile.field_name":         { fr: "Nom complet",                en: "Full name" },
  "profile.field_major":        { fr: "Filière",                    en: "Major" },
  "profile.field_year":         { fr: "Année académique",           en: "Academic Year" },
  "profile.field_bio":          { fr: "Bio",                        en: "Bio" },
  "profile.field_links":        { fr: "Liens professionnels",       en: "Professional links" },
  "profile.year_placeholder":   { fr: "— Sélectionner l'année —",   en: "— Select year —" },
  "profile.cancel":             { fr: "Annuler",                    en: "Cancel" },
  "profile.save":               { fr: "Enregistrer",                en: "Save changes" },
  "profile.saving":             { fr: "Enregistrement…",            en: "Saving…" },
  "profile.name_placeholder":   { fr: "Votre nom complet",          en: "Enter your full name" },
  "profile.bio_placeholder":    { fr: "Parlez de vos intérêts académiques…", en: "Tell us about your academic interests…" },
  "profile.error_name":         { fr: "Le nom doit comporter au moins 2 caractères.", en: "Full name must be at least 2 characters." },
  "profile.error_bio":          { fr: "La bio doit contenir 500 caractères ou moins.", en: "Bio must be 500 characters or less." },
  "profile.error_network":      { fr: "Erreur réseau. Vérifiez votre connexion.", en: "Network error. Check your connection." },
  "profile.error_save":         { fr: "Impossible d'enregistrer.",   en: "Could not save" },

  // ─── Hub page ────────────────────────────────────────────────────
  "hub.first_comment":          { fr: "Soyez le premier à commenter.", en: "Be the first to comment." },
  "hub.no_posts":               { fr: "Aucune publication pour l'instant.", en: "No posts yet." },
  "hub.placeholder":            { fr: "Partagez une idée académique…", en: "Share an academic thought…" },
  "hub.post_btn":               { fr: "Publier",                    en: "Post" },
  "hub.search":                 { fr: "Rechercher…",                en: "Search…" },
  "hub.comments":               { fr: "commentaires",               en: "comments" },
  "hub.reply_placeholder":      { fr: "Répondre…",                  en: "Reply…" },
  "hub.label":                  { fr: "Le Carrefour",               en: "The Hub" },
  "hub.subtitle":               { fr: "Flux académique en direct",  en: "Live academic feed" },

  // ─── Explore page ────────────────────────────────────────────────
  "explore.label":              { fr: "Réseau de Connaissances",    en: "Knowledge Network" },
  "explore.title":              { fr: "Explorer les Nœuds",         en: "Explore Nodes" },
  "explore.search":             { fr: "Rechercher des nœuds académiques…", en: "Search academic nodes…" },
  "explore.filters":            { fr: "Filtres",                    en: "Filters" },
  "explore.reset":              { fr: "Réinitialiser",              en: "Reset" },
  "explore.university":         { fr: "Université",                 en: "University" },
  "explore.major":              { fr: "Filière",                    en: "Major" },
  "explore.level":              { fr: "Niveau",                     en: "Level" },
  "explore.no_results":         { fr: "Aucun nœud trouvé.",         en: "No nodes found." },
  "explore.matched":            { fr: "Correspondant à votre filière", en: "Matched to your major" },
  "explore.trending":           { fr: "Les plus actifs",            en: "High frequency" },
  "explore.all":                { fr: "Tout",                       en: "All" },

  // ─── Create Group page ───────────────────────────────────────────
  "create.title":               { fr: "Créer un Nœud",             en: "Create a Node" },
  "create.search":              { fr: "Rechercher…",                en: "Search..." },
  "create.select":              { fr: "Sélectionner",               en: "Select" },

  // ─── NotificationCenter ──────────────────────────────────────────
  "notif.just_now":             { fr: "à l'instant",               en: "just now" },
  "notif.empty":                { fr: "Aucune notification.",       en: "No notifications." },
  "notif.mark_all":             { fr: "Tout marquer lu",            en: "Mark all read" },
  "notif.title":                { fr: "Notifications",              en: "Notifications" },

  // ─── Common ──────────────────────────────────────────────────────
  "common.loading":             { fr: "Chargement…",               en: "Loading…" },
  "common.error":               { fr: "Une erreur est survenue.",   en: "Something went wrong." },
  "common.cancel":              { fr: "Annuler",                   en: "Cancel" },
  "common.save":                { fr: "Enregistrer",               en: "Save" },
  "common.close":               { fr: "Fermer",                    en: "Close" },

  // ─── Report Modal ────────────────────────────────────────────────
  "report.title_post":          { fr: "Signaler un post",          en: "Report Post" },
  "report.title_group":         { fr: "Signaler un groupe",        en: "Report Group" },
  "report.title_message":       { fr: "Signaler un message",       en: "Report Message" },
  "report.reason_prompt":       { fr: "Choisissez un motif :",     en: "Select a reason:" },
  "report.reason_inappropriate":{ fr: "Contenu inapproprié",       en: "Inappropriate Content" },
  "report.reason_spam":         { fr: "Spam ou publicité",         en: "Spam or Advertisement" },
  "report.reason_harassment":   { fr: "Harcèlement ou abus",       en: "Harassment or Abuse" },
  "report.reason_misinformation":{ fr: "Désinformation",           en: "Misinformation" },
  "report.reason_other":        { fr: "Autre raison",              en: "Other Reason" },
  "report.success":             { fr: "Votre signalement a été envoyé. Un modérateur l'examinera bientôt.", en: "Your report was submitted successfully. A moderator will review it soon." },
  "report.ok":                  { fr: "OK",                        en: "OK" },
  "report.submit":              { fr: "Signaler",                  en: "Report" },
  "report.error":               { fr: "Échec du signalement, réessayez.", en: "Report failed, please try again." },
  "hub.report_post":            { fr: "Signaler le post",          en: "Report Post" },

  // ─── Admin Reports ───────────────────────────────────────────────
  "admin.tab_reports":          { fr: "Signalements",              en: "Reports" },
  "admin.filter_all":           { fr: "Tout",                      en: "All" },
  "admin.filter_posts":         { fr: "Posts",                     en: "Posts" },
  "admin.filter_groups":        { fr: "Groupes",                   en: "Groups" },
  "admin.filter_messages":      { fr: "Messages",                  en: "Messages" },
  "admin.type_post":            { fr: "Post",                      en: "Post" },
  "admin.type_group":           { fr: "Groupe",                    en: "Group" },
  "admin.type_message":         { fr: "Message",                   en: "Message" },
  "admin.reported_by":          { fr: "Signalé par :",             en: "Reported by:" },
  "admin.content_by":           { fr: "· Contenu de :",            en: "· Content by:" },
  "admin.dismiss":              { fr: "Rejeter",                   en: "Dismiss" },
  "admin.delete_content":       { fr: "Supprimer le contenu",      en: "Delete Content" },
  "admin.confirm_cancel":       { fr: "Annuler",                   en: "Cancel" },
  "admin.confirm_delete":       { fr: "Confirmer la suppression",  en: "Confirm Delete" },
  "admin.error_dismiss":        { fr: "Échec du rejet",            en: "Dismiss failed" },
  "admin.error_delete":         { fr: "Échec de la suppression",   en: "Delete failed" },
  "admin.toast_dismissed":      { fr: "Signalement rejeté",        en: "Report dismissed" },
  "admin.toast_deleted":        { fr: "Message supprimé",          en: "Message deleted" },
  "admin.toast_error":          { fr: "Une erreur est survenue",   en: "An error occurred" },
  "admin.dismiss_report":       { fr: "Rejeter le signalement",    en: "Dismiss Report" },
  "admin.delete_message":       { fr: "Supprimer le message",      en: "Delete Message" },
  "admin.no_reports":           { fr: "Aucun signalement en attente", en: "No pending reports" },
  "admin.confirm_delete_post":  { fr: "Ce post sera supprimé définitivement. Confirmer ?", en: "This post will be permanently deleted. Are you sure?" },
  "admin.confirm_delete_group": { fr: "Le groupe \"{name}\" et tous ses messages seront supprimés. Confirmer ?", en: "The group \"{name}\" and all its messages will be permanently deleted. Are you sure?" },
};

/**
 * useTranslation — Hook رئيسي للترجمة.
 *
 * يعيد دالة t() تستخرج النص المترجم من القاموس بناءً على اللغة الحالية.
 *
 * سلوك الدالة t(key, vars?):
 *  1. تبحث عن key في translations بلغة المستخدم الحالية.
 *  2. إذا لم تجد ترجمة بهذه اللغة، ترجع للإنجليزية كـ fallback.
 *  3. إذا لم يوجد المفتاح أصلاً، ترجع المفتاح نفسه (سهل اكتشاف الترجمات الناقصة).
 *  4. إذا أُعطيت vars (كائن)، تستبدل {k} بقيمة v في النص.
 *
 * @returns {{ t: (key: string, vars?: Record<string,string>) => string, lang: "fr"|"en" }}
 */
export function useTranslation() {
  const { lang } = useLang();
  const t = (key, vars) => {
    // يرجع ترجمة اللغة الحالية، أو الإنجليزية، أو المفتاح نفسه إذا لم يوجد
    let str = translations[key]?.[lang] ?? translations[key]?.["en"] ?? key;
    // استبدال المتغيرات الديناميكية مثل {name} في النصوص
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, v);
      }
    }
    return str;
  };
  return { t, lang };
}
