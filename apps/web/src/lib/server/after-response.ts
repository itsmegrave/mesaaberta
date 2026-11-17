import type { Handle } from '@sveltejs/kit/hooks';

/**
 * `locals.afterResponse(task)` queues work to run once the response is on its way, for things that
 * must not slow the request (a product event, the admin entry log). The web Worker opens no
 * database: a task that needs one asks the api. A failing task is logged, never thrown.
 */
export const handleAfterResponse: Handle = async ({ event, resolve }) => {
  const tasks: (() => Promise<unknown>)[] = [];
  event.locals.afterResponse = (task) => void tasks.push(task);

  const response = await resolve(event);

  if (tasks.length > 0) {
    const finishing = Promise.all(
      tasks.map((task) =>
        task().catch((error: unknown) =>
          event.locals.log?.error('request.after_response_failed', { error }),
        ),
      ),
    );
    const { waitUntil } = event.locals.host;
    if (waitUntil) waitUntil(finishing);
    else await finishing;
  }

  return response;
};
