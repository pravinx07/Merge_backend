import { z } from 'zod';

export const createBountySchema = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
    description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description is too long"),
    amount: z.coerce.number().positive("Amount must be a positive number"),
    skills: z.array(z.string()).optional(),
  }),
});

export const submitBountySchema = z.object({
  body: z.object({
    solutionLink: z.string().url("Please provide a valid URL for the solution"),
  }),
});
