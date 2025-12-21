/**
 * Add timeout to a promise
 * @param promise - The promise to add timeout to
 * @param timeoutMs - Timeout in milliseconds (default: 15000 = 15 seconds)
 * @returns Promise that rejects if timeout is reached
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])
}








