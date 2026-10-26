/**
 * What an action tells the form besides field errors. `code` picks a translated sentence; `field`
 * names a field the schema does not have (the image); `retryAfter` is the wait in seconds for a rate limit;
 * `href` is a page the sentence points to (the place someone tried to send again).
 */
export type FormMessage = { code: string; field?: string; retryAfter?: number; href?: string };
