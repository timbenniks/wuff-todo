"use client";
import { useRuntime } from "./runtime";
export function useActorApi() {
  return useRuntime().api;
}
