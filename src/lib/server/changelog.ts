import { parseEntries } from '$lib/changelog/entries';
import { ENTRY_FILES } from '$lib/changelog/entries.generated';

// The entries are part of the code, so there is no CMS and nothing to fetch. They come from the
// module `pnpm changelog` generates, not from import.meta.glob, because the Cron Trigger's Worker
// (which announces new entries) is bundled by wrangler without Vite. A broken entry fails here.

/** Every entry, drafts included, newest first. */
export const changelog = parseEntries(ENTRY_FILES);
