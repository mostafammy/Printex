import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import type { JsonObject } from "@prisma/client/runtime/library";

export interface FilesConfig {
  mimeAllowlist: string[];
  maxFileSizeBytes: number;
  departments: Array<{ name: string; code: string }>;
  previewExpirySeconds: number;
}

let cachedConfig: FilesConfig | null = null;

export function loadFilesConfig(configPath?: string): FilesConfig {
  if (cachedConfig) return cachedConfig;

  const resolvedPath = configPath ?? process.env.FILES_CONFIG_PATH ?? path.resolve(process.cwd(), "config", "050-files.yaml");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  const parsed = yaml.parse(fileContent) as FilesConfig;

  // Validate required fields
  if (!Array.isArray(parsed.mimeAllowlist) || parsed.mimeAllowlist.length === 0) {
    throw new Error("Config: mimeAllowlist must be a non-empty array");
  }
  if (!Number.isInteger(parsed.maxFileSizeBytes) || parsed.maxFileSizeBytes < 1) {
    throw new Error("Config: maxFileSizeBytes must be a positive integer");
  }
  if (!Array.isArray(parsed.departments) || parsed.departments.length === 0) {
    throw new Error("Config: departments must be a non-empty array");
  }
  if (!Number.isInteger(parsed.previewExpirySeconds) || parsed.previewExpirySeconds < 60) {
    throw new Error("Config: previewExpirySeconds must be >= 60");
  }

  // Validate department objects
  for (const dept of parsed.departments) {
    if (!dept.name || !dept.code) {
      throw new Error("Config: each department must have name and code");
    }
  }

  cachedConfig = parsed;
  return cachedConfig;
}

export function getFilesConfig(): FilesConfig {
  if (!cachedConfig) {
    return loadFilesConfig();
  }
  return cachedConfig;
}

export function resetFilesConfig(): void {
  cachedConfig = null;
}

// Helper to check if a MIME type matches the allowlist (supports wildcards like "image/*")
export function isMimeAllowed(mimeType: string, config?: Pick<FilesConfig, "mimeAllowlist">): boolean {
  const cfg = config ?? getFilesConfig();
  return cfg.mimeAllowlist.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1); // "image/"
      return mimeType.startsWith(prefix);
    }
    return mimeType === pattern;
  });
}

// Helper to get department by code
export function getDepartmentByCode(code: string, config?: FilesConfig): { name: string; code: string } | undefined {
  const cfg = config ?? getFilesConfig();
  return cfg.departments.find((d) => d.code === code);
}