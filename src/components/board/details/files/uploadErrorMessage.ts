/**
 * Turns 050's upload route errors into something actionable on the shop floor.
 * (specs/017-press-floor-board)
 */

/**
 * The `{ error }` codes `/api/files/upload` can return, with their Arabic text.
 *
 * Only codes the route or the service can actually emit are listed. Anything
 * else falls through to the status map, then to the server's own message, then
 * to a generic line — so adding a code here is a deliberate act of translation,
 * not a guess.
 */
const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: "بيانات الملف غير صالحة. تحقق من التصنيف واسم الملف",
  FORBIDDEN: "ليس لديك صلاحية لرفع ملفات لهذا الصنف",
  SIZE_EXCEEDED: "حجم الملف أكبر من الحد المسموح",
  MIME_UNSUPPORTED:
    "نوع الملف غير مدعوم. المسموح: PDF، صور، AI، PSD، ملفات صوتية",
  INCOMPLETE_UPLOAD: "انقطع رفع الملف. حاول مرة أخرى",
  CONCURRENT_VERSION_CONFLICT: "تم رفع إصدار آخر في نفس اللحظة. حاول مرة أخرى",
  NOT_FOUND: "الملف غير موجود",
  FILE_NOT_FOUND: "الملف غير موجود",
};

/** Fallbacks keyed by bare status, for failures that carry no `error` code. */
const MESSAGES_BY_STATUS: Readonly<Record<number, string>> = {
  400: "بيانات الملف غير صالحة",
  401: "انتهت الجلسة. سجّل الدخول وحاول مرة أخرى",
  403: "ليس لديك صلاحية لرفع ملفات لهذا الصنف",
  404: "بطاقة العمل غير موجودة",
  409: "تم رفع إصدار آخر في نفس اللحظة. حاول مرة أخرى",
  413: "حجم الملف أكبر من الحد المسموح",
  415: "نوع الملف غير مدعوم",
};

const GENERIC = "تعذر رفع الملف. حاول مرة أخرى";
const SERVER_ERROR = "تعذر رفع الملف بسبب خطأ في الخادم. حاول مرة أخرى";

interface UploadErrorPayload {
  readonly error?: string;
  readonly message?: string;
}

function serverMessage(payload: UploadErrorPayload | null): string | null {
  const trimmed = payload?.message?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/**
 * A recognized `error` code beats the server's `message`, even though the
 * server's is more specific: 050's route messages are written in English, and
 * showing "File size 7 exceeds maximum allowed 5" to someone working the press
 * is a worse outcome than a plain Arabic line they can act on. The server's
 * message is still the fallback for any code not translated above, which is
 * where a specific one earns its keep.
 */
export function uploadErrorMessage(
  status: number,
  payload: UploadErrorPayload | null,
): string {
  const code = payload?.error ?? "";
  const byCode = MESSAGES_BY_CODE[code];
  if (byCode) return byCode;

  const byStatus = MESSAGES_BY_STATUS[status];
  if (byStatus) return byStatus;

  const own = serverMessage(payload);
  if (own) return own;

  if (status >= 500) return SERVER_ERROR;

  return GENERIC;
}
