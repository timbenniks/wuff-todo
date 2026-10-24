"use client";
import { useRef, useState } from "react";
import { useActorApi } from "../../actor-api";
import { ApiError } from "../../api";
type Request = {
  action: string;
  input: Record<string, unknown>;
  operationId: string;
};
export function useReminderRequest(userId: string) {
  const api = useActorApi();
  const pending = useRef<Request | null>(null);
  const inFlight = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  async function send<T>(request: Request): Promise<T> {
    if (inFlight.current) throw Error("A reminder change is already saving.");
    inFlight.current = true;
    try {
      const result = await api<T>(
        "/api/v1/reminders",
        "POST",
        {
          action: request.action,
          input: { ...request.input, operationId: request.operationId },
        },
        userId,
      );
      pending.current = null;
      setUncertain(false);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
      } else {
        pending.current = request;
        setUncertain(true);
      }
      throw e;
    } finally {
      inFlight.current = false;
    }
  }
  async function request<T>(
    action: string,
    input: Record<string, unknown>,
  ): Promise<T> {
    if (pending.current)
      throw Error("Retry the same request before changing this preference.");
    return send<T>({ action, input, operationId: crypto.randomUUID() });
  }
  return Object.assign(request, {
    uncertain,
    retry: <T>() => {
      if (!pending.current)
        return Promise.reject<T>(Error("There is no request to retry."));
      return send<T>(pending.current);
    },
  });
}
