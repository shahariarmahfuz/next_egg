import { z } from "zod";

export const commonSchemas = {
  id: z.string().uuid("Invalid ID format"),
  email: z.string().email("Invalid email address"),
  nonEmptyString: z.string().min(1, "Field cannot be empty"),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
};
