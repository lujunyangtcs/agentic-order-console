/** Simulated network. P1 adds failure injection driven by the dev panel. */
const BASE_MS = 180
const JITTER_MS = 220

export function delay(ms = BASE_MS + Math.random() * JITTER_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function respond<T>(value: T, ms?: number): Promise<T> {
  await delay(ms)
  return value
}

export function notImplemented(name: string): never {
  throw new Error(
    `[mock] ${name} is not implemented yet. Fixtures land in P1 — see plan §10.`,
  )
}
