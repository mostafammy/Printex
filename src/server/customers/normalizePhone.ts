import { err, ok, type Result } from "~/server/core/result";
import type { DomainError } from "~/server/core/errors";

const PHONE_PATTERN = /^01[0125]\d{8}$/;

export function normalizePhone(raw: string): Result<string, DomainError> {
  const compact = raw.replace(/[\s-]/g, "");
  const local = compact.startsWith("+20")
    ? `0${compact.slice(3)}`
    : compact.startsWith("0020")
      ? `0${compact.slice(4)}`
      : compact;

  if (!PHONE_PATTERN.test(local)) {
    return err({
      code: "VALIDATION",
      message: "Invalid Egyptian mobile phone number",
      details: { field: "phone" },
    });
  }

  return ok(`+20${local.slice(1)}`);
}
