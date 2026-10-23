"use client";
import { useRef } from "react";
import { api } from "@/lib/api";
export function useReminderRequest(userId: string) {
  const pending = useRef<{ key: string; operationId: string } | null>(null);
  return async function request<T>(
    action: string,
    input: Record<string, unknown>,
  ): Promise<T> {
    const key = JSON.stringify({ action, input });
    if (pending.current?.key !== key)
      pending.current = { key, operationId: crypto.randomUUID() };
    const result = await api<T>(
      "/api/v1/reminders",
      "POST",
      { action, input: { ...input, operationId: pending.current.operationId } },
      userId,
    );
    pending.current = null;
    return result;
  };
}
