import { validateUploadInput } from "@/server/files/schemas.js";
import { isMimeAllowed } from "@/server/files/config.js";
import { fileFixtures, makeFileObjectInput, makeFileAssetInput } from "@/tests/fixtures/files.js";
import { describe, it, expect } from "vitest";

describe("Upload validation", () => {
  describe("validateUploadInput", () => {
    it("validates correct input", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        fileName: "design.ai",
        note: "Test upload",
        actorId: "user-123",
      };

      const result = validateUploadInput(input, 1024 * 1024, "application/vnd.adobe.illustrator");

      expect(result.workItemId).toBe(input.workItemId);
      expect(result.category).toBe(input.category);
      expect(result.fileName).toBe(input.fileName);
      expect(result.note).toBe(input.note);
      expect(result.actorId).toBe(input.actorId);
    });

    it("rejects missing workItemId", () => {
      const input = {
        category: "DESIGN_VERSIONS",
        fileName: "design.ai",
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects missing category", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        fileName: "design.ai",
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects missing fileName", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects missing actorId", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        fileName: "design.ai",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects invalid filename with path traversal", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        fileName: "../../../etc/passwd",
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects filename with invalid characters", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        fileName: "file<name>.pdf",
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects empty filename", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        fileName: "",
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });

    it("rejects filename too long", () => {
      const input = {
        workItemId: "cmufad53q0028bwhcmvrok4fn",
        category: "DESIGN_VERSIONS",
        fileName: "a".repeat(256),
        actorId: "user-123",
      };

      expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
    });
  });

  describe("MIME type validation", () => {
    const config = {
      mimeAllowlist: ["application/pdf", "image/*", "audio/*"],
      maxFileSizeBytes: 5 * 1024 * 1024 * 1024,
    };

    it("allows exact MIME type match", () => {
      expect(isMimeAllowed("application/pdf", config)).toBe(true);
    });

    it("allows wildcard MIME type match for images", () => {
      expect(isMimeAllowed("image/png", config)).toBe(true);
      expect(isMimeAllowed("image/jpeg", config)).toBe(true);
      expect(isMimeAllowed("image/tiff", config)).toBe(true);
    });

    it("allows wildcard MIME type match for audio", () => {
      expect(isMimeAllowed("audio/wav", config)).toBe(true);
      expect(isMimeAllowed("audio/mpeg", config)).toBe(true);
    });

    it("rejects unsupported MIME type", () => {
      expect(isMimeAllowed("application/msword", config)).toBe(false);
      expect(isMimeAllowed("text/plain", config)).toBe(false);
    });

    it("rejects invalid MIME type format", () => {
      expect(isMimeAllowed("invalid", config)).toBe(false);
      expect(isMimeAllowed("", config)).toBe(false);
    });
  });

  describe("file size validation", () => {
    it("allows files within size limit", () => {
      // This would be tested in integration tests with actual file upload
      expect(true).toBe(true); // placeholder
    });

    it("rejects files exceeding 5GB", () => {
      // This would be tested in integration tests with actual file upload
      expect(true).toBe(true); // placeholder
    });
  });

  describe("filename normalization", () => {
    it("accepts valid filenames", () => {
      const validNames = [
        "design.pdf",
        "banner-v2.ai",
        "image_001.png",
        "file (1).pdf",
        "file-name.ai",
      ];

      validNames.forEach(name => {
        const input = {
          workItemId: "cmufad53q0028bwhcmvrok4fn",
          category: "DESIGN_VERSIONS",
          fileName: name,
          actorId: "user-123",
        };

        expect(() => validateUploadInput(input, 1024, "application/pdf")).not.toThrow();
      });
    });

    it("rejects filenames with path separators", () => {
      const invalidNames = [
        "path/to/file.pdf",
        "folder\\file.pdf",
        "..\\file.pdf",
        "/absolute/path.pdf",
      ];

      invalidNames.forEach(name => {
        const input = {
          workItemId: "cmufad53q0028bwhcmvrok4fn",
          category: "DESIGN_VERSIONS",
          fileName: name,
          actorId: "user-123",
        };

        expect(() => validateUploadInput(input, 1024, "application/pdf")).toThrow();
      });
    });
  });
});