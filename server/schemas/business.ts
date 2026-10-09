import { z } from "zod";
const optionalText = z.string().trim().max(4000).optional().nullable();
export const clientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  company_name: optionalText,
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase())
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  address: optionalText,
  notes: optionalText,
});
const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive().max(100000),
  unit_price_minor: z.number().int().nonnegative().max(1_000_000_000),
});
export const quotationSchema = z
  .object({
    client_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: optionalText,
    items: z.array(itemSchema).min(1).max(100),
    discount_type: z.enum(["none", "fixed", "percentage"]).default("none"),
    discount_value: z.number().nonnegative().max(1_000_000_000).default(0),
    issue_date: z.string().date().optional(),
    valid_until: z.string().date().optional().nullable(),
    terms: optionalText,
    notes: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.discount_type === "percentage" && v.discount_value > 100)
      ctx.addIssue({
        code: "custom",
        path: ["discount_value"],
        message: "Percentage discount cannot exceed 100.",
      });
  });
export const orderSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: optionalText,
  requirements: z.string().max(10000).default(""),
  agreed_amount_minor: z.number().int().nonnegative().max(1_000_000_000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  order_date: z.string().date().optional(),
  due_date: z.string().date().optional().nullable(),
});
export const orderStatusSchema = z.object({
  status: z.enum([
    "new",
    "confirmed",
    "in_progress",
    "client_review",
    "revisions",
    "ready_for_delivery",
    "delivered",
    "on_hold",
    "cancelled",
    "closed",
  ]),
});
export const paymentSchema = z.object({
  amount_minor: z.number().int().positive().max(1_000_000_000),
  payment_date: z.string().date().optional(),
  payment_method: z.string().trim().max(60).optional(),
  reference: z.string().trim().max(200).optional(),
  notes: optionalText,
});
export const taskSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: optionalText,
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .default("pending"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  due_date: z.string().date().optional().nullable(),
});
export const taskStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});
