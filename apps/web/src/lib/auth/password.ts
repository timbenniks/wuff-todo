import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
export const passwordRequest = z.object({ email }).strict();
export const passwordReset = z
  .object({
    email,
    otp: z
      .string()
      .regex(/^\d{6}$/, "Enter the six-digit code from your email."),
    password: z.string().min(8).max(128),
  })
  .strict();
export const requestPasswordPath = "email-otp/request-password-reset";
export const resetPasswordPath = "email-otp/reset-password";
