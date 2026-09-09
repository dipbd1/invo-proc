import { z } from "zod";

export const TAX_CODES = ["T10", "T08"] as const;
export type TaxCode = (typeof TAX_CODES)[number];

export const TAX_RATES: Record<TaxCode, number> = {
  T10: 0.1,
  T08: 0.08,
};

export const partnerSchema = z.object({
  partner_code: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  registration_no: z.string(),
});
export type Partner = z.infer<typeof partnerSchema>;

export const extractedLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().nullable(),
  unit: z.string().min(1),
  unit_price: z.number().int().nullable(),
  amount: z.number().int(),
  tax_rate_percent: z.number(),
});
export type ExtractedLine = z.infer<typeof extractedLineSchema>;

export const extractionSchema = z.object({
  supplier_name_raw: z.string(),
  registration_no_raw: z.string().nullable(),
  invoice_number: z.string().min(1),
  issue_date: z.string(),
  due_date: z.string().nullable(),
  currency: z.string(),
  lines: z.array(extractedLineSchema).min(1),
  printed_subtotal: z.number().int().nullable(),
  printed_tax_amount: z.number().int().nullable(),
  printed_total: z.number().int().nullable(),
  has_handwriting: z.boolean(),
  uncertain_fields: z.array(z.string()),
});
export type Extraction = z.infer<typeof extractionSchema>;

export const invoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().nullable(),
  unit: z.string().min(1),
  unit_price: z.number().int().nullable(),
  amount: z.number().int(),
  tax_code: z.enum(TAX_CODES),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const registerInvoiceSchema = z.object({
  partner_code: z.string().min(1),
  invoice_number: z.string().min(1),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.literal("JPY"),
  lines: z.array(invoiceLineSchema).min(1),
  subtotal: z.number().int(),
  tax_amount: z.number().int(),
  total_amount: z.number().int(),
});
export type RegisterInvoice = z.infer<typeof registerInvoiceSchema>;

export const checkSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  message: z.string(),
});
export type Check = z.infer<typeof checkSchema>;

export const queueStatusSchema = z.enum([
  "extracted",
  "needs_review",
  "ready",
  "posted",
  "api_error",
]);
export type QueueStatus = z.infer<typeof queueStatusSchema>;

export const queueItemSchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  sourceName: z.string(),
  status: queueStatusSchema,
  extraction: extractionSchema,
  payload: registerInvoiceSchema.nullable(),
  checks: z.array(checkSchema),
  accountingId: z.string().nullable(),
  apiError: z.unknown().nullable(),
  updatedAt: z.string(),
});
export type QueueItem = z.infer<typeof queueItemSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const envelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().nullable(),
  error: apiErrorSchema.nullable(),
});
