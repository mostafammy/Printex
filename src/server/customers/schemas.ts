import { z } from "zod";

export const customerPhoneInput = z.string().trim().min(1);

export const customerAddressInput = z.object({
  label: z.string().trim().max(100).optional(),
  value: z.string().trim().min(1).max(2000),
  isDefault: z.boolean().optional(),
});

export const customerInput = z.object({
  name: z.string().trim().min(1).max(200),
  primaryPhone: customerPhoneInput,
  alternatePhones: z.array(customerPhoneInput).max(20).optional(),
  nationalId: z.string().trim().max(50).optional(),
  addresses: z.array(customerAddressInput).max(20).optional(),
  notes: z.string().trim().max(5000).optional(),
  classificationId: z.string().cuid().optional(),
});

export const customerSearchQuery = z.object({
  text: z.string().trim().max(200),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type CustomerInput = z.infer<typeof customerInput>;
export type CustomerSearchQuery = z.infer<typeof customerSearchQuery>;
