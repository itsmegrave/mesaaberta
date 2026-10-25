/**
 * Where the dispatcher reports each handler run, so a long-lived process can count them (the Bun
 * worker's `/metrics`). Nothing listens by default: on Workers each isolate would only see its own
 * handful, and the logs already carry every run.
 */
export type HandlerRun = { handler: string; ok: boolean; seconds: number };

let observer: ((run: HandlerRun) => void) | undefined;

/** Called once at start-up by a process that keeps the numbers. */
export function setHandlerObserver(next: ((run: HandlerRun) => void) | undefined) {
  observer = next;
}

export function observeHandler(run: HandlerRun) {
  observer?.(run);
}
