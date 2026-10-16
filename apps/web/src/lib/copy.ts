// Waffles' voice: a little wordplay in greetings, feedback and guidance.
// Keep action names, permission details and user-written content unambiguous.
export function wuffError(message: string) {
  return /^(Ruff|Paws|That’s a long tail)/.test(message)
    ? message
    : `Ruff patch! ${message}`;
}
