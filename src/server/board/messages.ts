/**
 * Move refusal codes and Arabic localized user messages.
 * (specs/017-press-floor-board/data-model.md §3.4, contracts/board-server.md §3, plan.md S1)
 */

export type MoveRefusalCode =
  | "NOT_OFFERED"
  | "FORBIDDEN"
  | "STALE_STATE"
  | "GUARD_FAILED"
  | "VALIDATION"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL";

export const MOVE_REFUSAL_MESSAGES_AR: Readonly<Record<MoveRefusalCode, string>> = {
  NOT_OFFERED: "هذا النقل غير متاح لأمر العمل في حالته الحالية.",
  FORBIDDEN: "ليس لديك الصلاحية لتنفيذ هذا الإجراء.",
  STALE_STATE: "تغيرت حالة أمر العمل بواسطة زميل آخر. تم تحديث موقع البطاقة.",
  GUARD_FAILED: "لم يتم استيفاء الشروط المطلوبة لإتمام عملية النقل.",
  VALIDATION: "البيانات المدخلة في النموذج غير مكتملة أو غير صالحة.",
  DEPENDENCY_UNAVAILABLE: "الخدمة أو المرحلة التابعة غير متوفرة حالياً في النظام.",
  INTERNAL: "حدث خطأ غير متوقع أثناء معالجة النقل. يرجى المحاولة مرة أخرى.",
};

export function getRefusalMessageAr(
  code: MoveRefusalCode,
  fallbackMessage?: string,
): string {
  if (fallbackMessage && fallbackMessage.trim().length > 0) {
    return fallbackMessage;
  }
  return MOVE_REFUSAL_MESSAGES_AR[code] ?? MOVE_REFUSAL_MESSAGES_AR.INTERNAL;
}
