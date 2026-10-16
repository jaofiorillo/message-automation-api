import { z } from 'zod';

// Folder paths like ManyChat's cms paths: "/" or "/promo/black-friday".
export const flowPathSchema = z
  .string()
  .regex(/^\/(?:[\w-]+(?:\/[\w-]+)*)?$/, 'Invalid folder path');

export const createFlowSchema = z.object({
  name: z.string().trim().min(1).max(100),
  path: flowPathSchema.default('/'),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
