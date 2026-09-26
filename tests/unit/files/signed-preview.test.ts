import { createPreviewGrant, verifyPreviewGrant, encodeGrant, decodeAndVerifyGrant, createPreviewUrl, createDownloadUrl } from "@/server/files/signed-preview.js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Set HMAC secret before any tests run
beforeEach(() => {
  process.env.FILES_PREVIEW_HMAC_SECRET = "test-secret-for-dev-32-chars-minimum!!";
});

describe("Signed preview grants", () => {
  describe("createPreviewGrant", () => {
    it("creates a valid grant with correct structure", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview", 300000);

      expect(grant).toBeDefined();
      expect(grant.versionId).toBe("version-123");
      expect(grant.actorId).toBe("actor-456");
      expect(grant.purpose).toBe("preview");
      expect(grant.scope).toBe("preview");
      expect(grant.signature).toBeDefined();
      expect(typeof grant.expiresAt).toBe("number");
      expect(grant.expiresAt).toBeGreaterThan(Date.now());
      expect(grant.expiresAt - Date.now()).toBeLessThanOrEqual(300000);
    });

    it("creates grant with custom expiry", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "download", 60000);

      expect(grant.scope).toBe("download");
      expect(grant.expiresAt - Date.now()).toBeLessThanOrEqual(60000);
    });

    it("respects configured max expiry", () => {
      // Config default is 300 seconds
      const grant = createPreviewGrant("version-123", "actor-456", "preview", 600000); // 10 minutes requested

      // Should be capped at config max (5 minutes = 300 seconds)
      expect(grant.expiresAt - Date.now()).toBeLessThanOrEqual(300000);
    });
  });

  describe("verifyPreviewGrant", () => {
    it("verifies a valid grant", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const payload = verifyPreviewGrant(grant);

      expect(payload).toBeDefined();
      expect(payload.v).toBe("version-123");
      expect(payload.a).toBe("actor-456");
      expect(payload.p).toBe("preview");
      expect(payload.s).toBe("preview");
    });

    it("throws on expired grant", () => {
      vi.useFakeTimers();
      const grant = createPreviewGrant("version-123", "actor-456", "preview", 1000); // 1s expiry

      // Advance past expiry
      vi.advanceTimersByTime(1100);

      expect(() => verifyPreviewGrant(grant)).toThrow("PREVIEW_GRANT_EXPIRED");
      vi.useRealTimers();
    });

    it("throws on tampered signature", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      // Tamper with signature — modify middle character
      const si = Math.floor(grant.signature.length / 2);
      const tamperedGrant = { ...grant, signature: grant.signature.slice(0, si) + (grant.signature[si] === "A" ? "B" : "A") + grant.signature.slice(si + 1) };

      expect(() => verifyPreviewGrant(tamperedGrant)).toThrow("PREVIEW_GRANT_TAMPERED");
    });

    it("throws on tampered versionId", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const tamperedGrant = { ...grant, versionId: "version-999" };

      expect(() => verifyPreviewGrant(tamperedGrant)).toThrow("PREVIEW_GRANT_TAMPERED");
    });

    it("throws on tampered actorId", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const tamperedGrant = { ...grant, actorId: "actor-999" };

      expect(() => verifyPreviewGrant(tamperedGrant)).toThrow("PREVIEW_GRANT_TAMPERED");
    });

    it("throws on tampered expiry", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const tamperedGrant = { ...grant, expiresAt: Date.now() + 86400000 }; // 24 hours

      expect(() => verifyPreviewGrant(tamperedGrant)).toThrow("PREVIEW_GRANT_TAMPERED");
    });

    it("throws on tampered scope", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const tamperedGrant = { ...grant, scope: "malicious" };

      expect(() => verifyPreviewGrant(tamperedGrant)).toThrow("PREVIEW_GRANT_TAMPERED");
    });

    it("throws on wrong purpose", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "download");

      // Manually create grant with wrong purpose
      const tamperedGrant = {
        ...grant,
        purpose: "malicious" as any,
      };

      // Changing purpose invalidates the signature → PREVIEW_GRANT_TAMPERED
      expect(() => verifyPreviewGrant(tamperedGrant)).toThrow("PREVIEW_GRANT_TAMPERED");
    });

    it("rejects malformed grant", () => {
      const malformedGrant = {
        versionId: "version-123",
        actorId: "actor-456",
        // missing fields
      };

      expect(() => verifyPreviewGrant(malformedGrant as any)).toThrow();
    });
  });

  describe("encodeGrant / decodeAndVerifyGrant", () => {
    it("encodes and decodes grant correctly", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const token = encodeGrant(grant);
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);

      const payload = decodeAndVerifyGrant(token);

      expect(payload.v).toBe("version-123");
      expect(payload.a).toBe("actor-456");
      expect(payload.p).toBe("preview");
      expect(payload.s).toBe("preview");
    });

    it("rejects tampered token", () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const grant = createPreviewGrant("version-123", "actor-456", "preview");
      const token = encodeGrant(grant);

      // Tamper with token — modify middle character to avoid padding issues
      const i = Math.floor(token.length / 2);
      const tamperedToken = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);

      expect(() => decodeAndVerifyGrant(tamperedToken)).toThrow();
      vi.useRealTimers();
    });

    it("rejects expired token", () => {
      vi.useFakeTimers();
      const grant = createPreviewGrant("version-123", "actor-456", "preview", 1000);

      vi.advanceTimersByTime(1100);

      const token = encodeGrant(grant);

      expect(() => decodeAndVerifyGrant(token)).toThrow("PREVIEW_GRANT_EXPIRED");
      vi.useRealTimers();
    });

    it("rejects malformed token", () => {
      const malformedToken = "not.a.valid.token";

      expect(() => decodeAndVerifyGrant(malformedToken)).toThrow("PREVIEW_GRANT_MALFORMED");
    });
  });

  describe("createPreviewUrl / createDownloadUrl", () => {
    it("creates preview URL with grant token", () => {
      const url = createPreviewUrl("http://localhost:3000", "version-123", "actor-456");

      expect(url).toContain("/api/files/version-123/preview");
      expect(url).toContain("grant=");
    });

    it("creates download URL with grant token", () => {
      const url = createDownloadUrl("http://localhost:3000", "version-123", "actor-456");

      expect(url).toContain("/api/files/version-123/download");
      expect(url).toContain("grant=");
    });

    it("includes proper grant in URL", () => {
      const url = createPreviewUrl("http://localhost:3000", "version-123", "actor-456");

      const urlObj = new URL(url);
      const grantParam = urlObj.searchParams.get("grant");

      expect(grantParam).toBeDefined();

      // Verify the grant in URL is valid
      const payload = decodeAndVerifyGrant(grantParam!);
      expect(payload.v).toBe("version-123");
    });
  });

  describe("Clock skew tolerance", () => {
    it("handles small clock skew", () => {
      // Grant created with slight future expiry
      const grant = createPreviewGrant("version-123", "actor-456", "preview", 300000);

      // Should still be valid immediately
      const payload = verifyPreviewGrant(grant);
      expect(payload).toBeDefined();
    });

    it("rejects grant that expires in the past due to clock skew", () => {
      // Create a grant that's already expired
      const grant = createPreviewGrant("version-123", "actor-456", "preview", -1000); // Already expired

      expect(() => verifyPreviewGrant(grant)).toThrow("PREVIEW_GRANT_EXPIRED");
    });
  });

  describe("Grant scope binding", () => {
    it("binds grant to specific version and actor", () => {
      const grant = createPreviewGrant("version-123", "actor-456", "preview");

      const payload = verifyPreviewGrant(grant);

      // Should not be usable for different version
      expect(payload.v).toBe("version-123");

      // Should not be usable by different actor
      expect(payload.a).toBe("actor-456");
    });

    it("distinguishes preview vs download scope", () => {
      const previewGrant = createPreviewGrant("version-123", "actor-456", "preview");
      const downloadGrant = createPreviewGrant("version-123", "actor-456", "download");

      const previewPayload = verifyPreviewGrant(previewGrant);
      const downloadPayload = verifyPreviewGrant(downloadGrant);

      expect(previewPayload.s).toBe("preview");
      expect(downloadPayload.s).toBe("download");
    });
  });
});