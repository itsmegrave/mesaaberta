/**
 * The `next` parameter says where to go after signing in. It comes from the URL, so anything that
 * could leave this site is replaced with the fallback (an open redirect would let a phishing link
 * borrow our login).
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
	if (!next || !next.startsWith('/')) return fallback;
	// Browsers strip tabs and newlines, and read a backslash as a slash: `/\t/evil.example` and
	// `/\evil.example` both become `//evil.example`.
	if (/[\t\n\r\\]/.test(next) || next.startsWith('//')) return fallback;

	return next;
}
