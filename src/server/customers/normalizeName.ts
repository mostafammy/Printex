const TASHKEEL = /[ً-ٰٟ]/g;

export function normalizeCustomerName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(TASHKEEL, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .replace(/\s+/g, " ");
}
