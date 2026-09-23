// validation.ts — shared Zod schemas reused across create.ts, workItems.ts,
// and productTypes.ts, so each field's rule (contracts/order-entry.md,
// contracts/product-types.md) is defined exactly once.

import { z } from "zod";

export const orderPriorityValues = ["NORMAL", "URGENT"] as const;
export const orderChannelValues = [
  "WALK_IN",
  "WHATSAPP",
  "PHONE",
  "RETURNING",
  "DIRECT_TO_DESIGNER",
] as const;
export const orderModeValues = ["GROUPED", "SEPARATE"] as const;
export const dimensionUnitValues = ["MM", "CM", "M", "IN"] as const;

/** contracts/order-entry.md's `WorkItemCreateInput` — shared by createOrder, addWorkItem. */
export const workItemCreateSchema = z.object({
  productTypeId: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
  widthValue: z.number().positive(),
  heightValue: z.number().positive(),
  dimensionUnit: z.enum(dimensionUnitValues),
  material: z.string().optional(),
  finishNotes: z.string().optional(),
  requiresDesign: z.boolean(),
  requiresReview: z.boolean(),
  departmentId: z.string().min(1).optional(),
  dueDate: z.date().optional(),
  description: z.string().optional(),
});

export type WorkItemCreateInput = z.input<typeof workItemCreateSchema>;

/** contracts/product-types.md: `ProductType.name` — non-empty after trim, max 100 chars. */
export const productTypeNameSchema = z.string().trim().min(1).max(100);
