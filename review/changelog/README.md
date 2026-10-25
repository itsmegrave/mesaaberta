# Changelog review

The implementation follows the Novidades artboard in [Mesa Aberta Redesign](https://claude.ai/artifact/SNwaUfvK8acM9meDhPViYv#play-2cf4fbb95aca) and the content, layout and interaction rules in the [design system](https://claude.ai/artifact/FTZHNMrpM5F8ioUdUs5FeT).

The source export contains all 24 published Canny entries retrieved on 25 October 2026, with no next page remaining. The original text, timestamp, category and URL are preserved in `docs/changelog/canny-export.json`. The rendered text in `apps/web/src/content/changelog.json` consolidates release days, removes duplicate announcements and uses the product's gender-neutral language. It preserves the historical sequence; subsequent changes do not rewrite older entries.

Duplicate announcements merged: the two completed-table notices and two chat notices on 23 October; the overlapping image-crop announcements on 30 September. The counter correction remains its own change. The self-hosting release remains included because it was published in Canny.

After the last Canny entry (23 October), reviewed public releases through v0.49.0 include user-visible changes from PRs #346 (attendance), #357 (faster lists), #359/#360 (profile achievements), #362 (continuing tables and one rating per person), #363/#369 (navigation/footer), #366 (profile cover, bio, settings sections and upload dialog), #367/#370 (brand and chairs). They are grouped under 25 October. API migrations, private extension plumbing, observability, tests, build changes and dependency updates do not announce a new product capability and are omitted. The 24 October releases only move existing flows behind the API and have no separate product announcement.

Add one release day to the content JSON for future user-facing releases. Use `new`, `improved` or `fixed`, a short title and a plain sentence about the result. Keep it newest first; do not add internal implementation notes. The page derives counts, filters, highlights and pagination from that file, without Canny, network requests or database access. Content is escaped Svelte text, never arbitrary HTML.

Feature illustrations are captures of the actual public-profile, MessageBubble and AddPassword components, rendered locally with fictional people and messages; there are light and dark versions. Their temporary fixture route is not shipped. New entries may specify a `preview`; those without one use the shared brand illustration.

Captures show the real local app at 1440px and 390px in both themes. `capture.mjs` also verifies carousel navigation, filtering, older-day links, the old `/changelog` alias and absence of horizontal overflow or client errors. No production data is used.
