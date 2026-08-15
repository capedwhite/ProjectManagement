import { z } from "zod";

// ─── Login ───────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Signup ──────────────────────────────────────────────────────────
export const signupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

export type SignupFormData = z.infer<typeof signupSchema>;

// ─── Create / Edit Project ───────────────────────────────────────────
export const createProjectSchema = z.object({
  title: z
    .string()
    .min(1, "Project title is required")
    .max(100, "Title must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .or(z.literal("")),
});

export type CreateProjectFormData = z.infer<typeof createProjectSchema>;

export const editProjectSchema = z.object({
  title: z
    .string()
    .min(1, "Project title is required")
    .max(100, "Title must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .or(z.literal("")),
});

export type EditProjectFormData = z.infer<typeof editProjectSchema>;

// ─── Task ────────────────────────────────────────────────────────────
export const taskSchema = z.object({
  title: z
    .string()
    .min(1, "Task title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z
    .string()
    .max(2000, "Description must be 2000 characters or less")
    .optional()
    .or(z.literal("")),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z
    .string()
    .optional()
    .or(z.literal("")),
  assigneeId: z
    .string()
    .optional()
    .or(z.literal("")),
  assigneeIds: z
    .array(z.union([z.number(), z.string()]))
    .optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;
