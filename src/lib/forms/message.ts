/**
 * What an action tells the form besides field errors. `code` picks a translated sentence; `field`
 * names a field the schema does not have (the image); `retryAfter` is the wait in seconds for a rate limit.
 */
export type FormMessage = { code: string; field?: string; retryAfter?: number };
