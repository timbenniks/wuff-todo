import {
  empireModules,
  AppError,
  type Actor,
  type EmpireAppId,
} from "@wuff/contracts";
import { platformNativeOperations } from "@/platform/native";
import { todoNativeOperations, afterTodoNativeAction } from "./todo/native";
import { totakeNativeOperations } from "./totake/native";
export type NativeOperation = (actor: Actor, input: unknown) => unknown;
export function composeNativeOperations(
  contributions: readonly Record<string, NativeOperation>[],
) {
  const operations: Record<string, NativeOperation> = Object.create(null);
  for (const contribution of contributions)
    for (const [name, operation] of Object.entries(contribution)) {
      if (Object.hasOwn(operations, name))
        throw new Error("Duplicate native operation: " + name);
      operations[name] = operation;
    }
  return operations;
}
const modules = {
  todo: {
    operations: todoNativeOperations,
    afterAction: afterTodoNativeAction,
  },
  totake: {
    operations: totakeNativeOperations,
    afterAction: (_action: string) => [],
  },
} satisfies Record<
  EmpireAppId,
  {
    operations: Record<string, NativeOperation>;
    afterAction: (action: string) => (() => Promise<unknown>)[];
  }
>;
const operations = composeNativeOperations([
  platformNativeOperations,
  ...empireModules.map((module) => modules[module.id].operations),
]);
export function nativeOperation(action: string) {
  const operation = operations[action];
  if (!operation)
    throw new AppError("not_found", "Unknown mobile operation.", 404);
  return operation;
}
export function nativeBackgroundJobs(action: string) {
  return empireModules.flatMap((module) =>
    modules[module.id].afterAction(action),
  );
}
