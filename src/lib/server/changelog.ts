import { parseEntries } from '$lib/changelog/entries';

// Read at build time and bundled with the worker: the entries are part of the code, so there is no
// CMS and nothing to fetch. A broken entry fails the build here, not a visitor's request.
const files = import.meta.glob<string>('/src/content/changelog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every entry, drafts included, newest first. */
export const changelog = parseEntries(files);
