// Read-only: same production parsers and guarded fetches; no database, events or image uploads.
import { sourceAdapters } from '../src/lib/server/crowdfunding/import/sources.ts';
import { sourceReader } from '../src/lib/server/crowdfunding/import/source-fetch.ts';
const requested = process.argv[2] ?? 'all';
if (!['all', 'catarse', 'meeplestarter'].includes(requested))
  throw new Error('Use: bun run crowdfunding:dry-run [all|catarse|meeplestarter]');
let failed = false;
for (const source of sourceAdapters.filter((s) => requested === 'all' || requested === s.source)) {
  const now = new Date(),
    deadline = Date.now() + 4 * 60_000;
  let page = 1,
    readCount = 0,
    accepted = 0,
    skipped = 0;
  const read = async (url: string) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('source_timeout');
    return sourceReader(source.source, { timeoutMs: Math.min(15_000, remaining) })(url);
  };
  try {
    for (let pages = 0; pages < 20; pages++) {
      const listing = await source.list(page, read);
      for (const url of listing.urls) {
        if (readCount >= 150) throw new Error('source_detail_limit');
        const c = await source.detail(url, now, read);
        readCount++;
        if (c) {
          accepted++;
          console.log(JSON.stringify({ outcome: 'would_import', ...c }));
        } else skipped++;
      }
      if (listing.nextPage === null) break;
      page = listing.nextPage;
    }
    console.log(
      JSON.stringify({ source: source.source, outcome: 'dry_run', accepted, skipped, readCount }),
    );
  } catch (error) {
    failed = true;
    console.error(
      JSON.stringify({
        source: source.source,
        outcome: 'failed',
        code: error instanceof Error ? error.message : 'source_failure',
        accepted,
        skipped,
        readCount,
      }),
    );
  }
}
if (failed) process.exitCode = 1;
