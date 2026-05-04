import { z } from "zod"

export const ChecklistItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  checked: z.boolean(),
})

export const StopResultSchema = z.object({
  hazardId: z.string().uuid(),
  status: z.enum(["pending", "reviewed", "saved"]),
  approachedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
})

export const SessionPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  checklist: z.array(ChecklistItemSchema).max(20),
  stopResults: z.array(StopResultSchema).max(200),
})

export type ChecklistItemPayload = z.infer<typeof ChecklistItemSchema>
export type StopResultPayload = z.infer<typeof StopResultSchema>
export type SessionPayload = z.infer<typeof SessionPayloadSchema>
