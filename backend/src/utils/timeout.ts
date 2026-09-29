/**
 * Promise helpers used by provider clients (AI, storage, mock chain).
 */

/**
 * Rejects with `onTimeout`'s error when `promise` outlives `timeoutMs`.
 * The underlying work is not cancellable, but the caller stops waiting and the
 * late result is discarded — which is what we need for provider calls.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
