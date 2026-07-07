// Exhaustiveness guard for discriminated unions. Put it in the `default:` of a
// switch, or after an if-chain that has handled every variant: if a new union
// member is added later, the call becomes a compile error (the argument is no
// longer `never`), so the new case can't be silently ignored. Throws at runtime
// as a last resort for un-typed data (e.g. a value read from an old backup).
export function assertNever(value: never, context = 'value'): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`)
}
