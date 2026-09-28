/**
 * Station targets configuration loader and validator.
 * (specs/017-press-floor-board/data-model.md §1.3, research.md R10, plan.md S1)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as yaml from "yaml";
import { z } from "zod";

const TargetSchema = z.object({
  normal: z.number().int().nonnegative(),
  urgent: z.number().int().nonnegative(),
});

export const StationTargetsSchema = z.object({
  stationTargets: z.object({
    reception: TargetSchema,
    design: TargetSchema,
    review: TargetSchema,
    pricing: TargetSchema,
    production: TargetSchema,
    collection: TargetSchema,
    delivered: TargetSchema,
  }),
});

export type StationTargets = z.infer<typeof StationTargetsSchema>["stationTargets"];

export const DEFAULT_STATION_TARGETS: StationTargets = {
  reception: { normal: 30, urgent: 10 },
  design: { normal: 1440, urgent: 240 },
  review: { normal: 240, urgent: 60 },
  pricing: { normal: 240, urgent: 60 },
  production: { normal: 2880, urgent: 480 },
  collection: { normal: 1440, urgent: 240 },
  delivered: { normal: 0, urgent: 0 },
};

let cachedTargets: StationTargets | null = null;

export function loadStationTargetsConfig(configPath?: string): StationTargets {
  if (cachedTargets && !configPath) {
    return cachedTargets;
  }

  const resolvedPath =
    configPath ??
    process.env.BOARD_CONFIG_PATH ??
    resolve(process.cwd(), "config", "017-board.yaml");

  if (!existsSync(resolvedPath)) {
    return DEFAULT_STATION_TARGETS;
  }

  try {
    const rawContent = readFileSync(resolvedPath, "utf-8");
    const parsedYaml: unknown = yaml.parse(rawContent);
    const validated = StationTargetsSchema.parse(parsedYaml);
    if (!configPath) {
      cachedTargets = validated.stationTargets;
    }
    return validated.stationTargets;
  } catch (error) {
    console.warn(`[017-board] Failed to parse config at ${resolvedPath}, using defaults:`, error);
    return DEFAULT_STATION_TARGETS;
  }
}

export function resetStationTargetsConfigCache(): void {
  cachedTargets = null;
}
