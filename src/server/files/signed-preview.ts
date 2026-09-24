// Signed preview grants — 050-files
// Five-minute HMAC grants bound to version/purpose/authorized scope.
// Rejects expiry/tampering.

import { createHmac, timingSafeEqual } from "crypto";
import { getFilesConfig } from "./config.js";

export interface SignedPreviewGrant {
  versionId: string;
  actorId: string;
  purpose: "preview";
  expiresAt: number; // Unix timestamp (ms)
  scope: string; // "download" | "preview"
  signature: string;
}

interface GrantPayload {
  v: string; // versionId
  a: string; // actorId
  p: string; // purpose
  e: number; // expiresAt
  s: string; // scope
}

const GRANT_VERSION = "v1";
const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function getSecret(): string {
  const secret = process.env.FILES_PREVIEW_HMAC_SECRET;
  if (!secret) {
    throw new Error("FILES_PREVIEW_HMAC_SECRET not set in environment");
  }
  return secret;
}

function signPayload(payload: GrantPayload): string {
  const secret = getSecret();
  const data = `${GRANT_VERSION}.${JSON.stringify(payload)}`;
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function verifySignature(payload: GrantPayload, signature: string): boolean {
  const expected = signPayload(payload);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Create a signed preview grant.
 * @param versionId - File version ID
 * @param actorId - Actor requesting the grant
 * @param scope - "preview" or "download"
 * @param expiresInMs - Optional custom expiry (default 5 minutes)
 */
export function createPreviewGrant(
  versionId: string,
  actorId: string,
  scope: "preview" | "download" = "preview",
  expiresInMs = DEFAULT_EXPIRY_MS
): SignedPreviewGrant {
  const config = getFilesConfig();
  const maxExpiry = config.previewExpirySeconds * 1000;
  const expiresAt = Date.now() + Math.min(expiresInMs, maxExpiry);

  const payload: GrantPayload = {
    v: versionId,
    a: actorId,
    p: "preview",
    e: expiresAt,
    s: scope,
  };

  const signature = signPayload(payload);

  return {
    versionId,
    actorId,
    purpose: "preview",
    expiresAt,
    scope,
    signature,
  };
}

/**
 * Verify a preview grant.
 * Returns payload if valid, throws on expiry/tampering.
 */
export function verifyPreviewGrant(grant: SignedPreviewGrant): GrantPayload {
  const payload: GrantPayload = {
    v: grant.versionId,
    a: grant.actorId,
    p: grant.purpose,
    e: grant.expiresAt,
    s: grant.scope,
  };

  // Check expiry
  if (Date.now() > grant.expiresAt) {
    throw new Error("PREVIEW_GRANT_EXPIRED");
  }

  // Verify signature
  if (!verifySignature(payload, grant.signature)) {
    throw new Error("PREVIEW_GRANT_TAMPERED");
  }

  // Verify purpose
  if (payload.p !== "preview") {
    throw new Error("PREVIEW_GRANT_INVALID_PURPOSE");
  }

  return payload;
}

/**
 * Encode grant as URL-safe token for use in query params.
 */
export function encodeGrant(grant: SignedPreviewGrant): string {
  return Buffer.from(JSON.stringify(grant)).toString("base64url");
}

/**
 * Decode and verify grant from URL-safe token.
 */
export function decodeAndVerifyGrant(token: string): GrantPayload {
  let grant: SignedPreviewGrant;
  try {
    grant = JSON.parse(Buffer.from(token, "base64url").toString()) as SignedPreviewGrant;
  } catch {
    throw new Error("PREVIEW_GRANT_MALFORMED");
  }

  return verifyPreviewGrant(grant);
}

/**
 * Create a preview URL for a file version.
 */
export function createPreviewUrl(
  baseUrl: string,
  versionId: string,
  actorId: string,
  scope: "preview" | "download" = "preview"
): string {
  const grant = createPreviewGrant(versionId, actorId, scope);
  const token = encodeGrant(grant);
  const url = new URL(`${baseUrl}/api/files/${versionId}/preview`);
  url.searchParams.set("grant", token);
  return url.toString();
}

/**
 * Create a download URL for a file version.
 */
export function createDownloadUrl(
  baseUrl: string,
  versionId: string,
  actorId: string
): string {
  const grant = createPreviewGrant(versionId, actorId, "download");
  const token = encodeGrant(grant);
  const url = new URL(`${baseUrl}/api/files/${versionId}/download`);
  url.searchParams.set("grant", token);
  return url.toString();
}