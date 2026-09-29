# API queries

Implementation of [Trello #141](https://trello.com/c/g77W7kei). This migration is independent of the notification work.

## Ownership

SvelteKit server loads still authorize requests and render the initial page, including when JavaScript is disabled. Shared readers in `src/lib/server/reads` return the same DTOs to the loaders and the allowlisted `/api/query/[resource]` endpoint. Loaders fetch into a short-lived QueryClient, serialize only their read DTO plus a seed, and clear that client. The root layout creates one client per component tree; there is no process-global authenticated cache.

`pageQuery` hydrates each key from that seed using `initialData`/`initialDataUpdatedAt`. Its field allowlist excludes inherited layout data and Superforms state from public caches. A newer loader response reconciles an existing key. The first mount does not duplicate the loader request. Stale reads refetch on focus, reconnect, explicit retry, and confirmed action invalidation. This is **not realtime**: there is no polling, subscription, or cross-tab broadcast.

| Read                                                          | Query resource/key scope                          | Policy                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Home preview                                                  | `preview`, public                                 | 15s stale time                                                                                  |
| Table list and filter catalogs                                | `tables`, public + canonical filters              | 15s; multi-select order deduplicated                                                            |
| Table detail, viewer permissions, registration and own rating | `detail`, authenticated identity/anonymous + slug | 15s; entire mixed DTO private to its viewer                                                     |
| Player/GM dashboard                                           | `dashboard`, identity                             | 15s; authentication rechecked                                                                   |
| GM management                                                 | `manage`, identity + slug                         | 15s; ownership/admin policy rechecked                                                           |
| New table catalog                                             | `catalog`, identity                               | 5min; includes own pending suggestions                                                          |
| Edit table catalog                                            | `editCatalog`, identity + slug                    | 15s; also includes the table's pending picks                                                    |
| Header profile summary/avatar                                 | `account`, identity                               | 15s; notification data remains loader-owned                                                     |
| Username availability                                         | `username`, identity + normalized username        | 400ms debounce; no retained availability cache or automatic retries                             |
| CEP                                                           | `cep`, normalized postal code                     | 400ms debounce; successful addresses fresh for 24h; outages throw, missing addresses stay stale |

The whole detail DTO is viewer-scoped because it mixes public table information with join details and viewer permissions. Keeping one authorized read avoids mismatched snapshots; it deliberately sacrifices sharing the public portion between identities. Form catalogs are also private because pending suggestions are not public.

## HTTP and privacy

The HTTP helper accepts same-origin paths, includes cookies, propagates AbortSignal and rejects malformed/non-JSON responses. Page DTOs use `devalue` to preserve Dates. Lookup DTOs are validated with Zod. API errors expose status, not internal error details. Private responses carry the verified server identity; the client rejects an answer from another account before caching it. Client query keys never authorize a request.

All query endpoint responses use `private, no-store`. Every refetch calls the same server policy as the page. Denial/not-found removes the affected query and reruns server loads. The root clears its cache when the loader's authenticated identity changes; account deletion clears it immediately. A cookie change in another tab is detected on the next private refetch/navigation. No persistent cache is used.

## Forms and mutations

Superforms continues to own validation, submission, pending state, multipart uploads, action results and redirects. Do not wrap its POST in `createMutation`: that would give one submission two owners. Successful callbacks call `afterWrite` to invalidate dependent query families:

- Table create/edit/disable, join/leave, approve/decline/remove and ratings: preview, list, detail, dashboard, management and form catalogs.
- Profile/avatar changes: account summary plus table views and catalogs where the identity is displayed.
- Logout/account switch: cache cleared at the root; account deletion clears immediately.

Failed actions do not invalidate queries. Existing Superforms route invalidation remains for server-owned form state and redirects. Background reads never hydrate an editable form. There are no optimistic capacity/permission updates and no automatic write retries. Use `createMutation` for a future browser-owned JSON write only if it has no existing Superforms owner.

## ViaCEP

The browser calls authenticated `/api/location/cep`, never ViaCEP directly. The endpoint normalizes the CEP, limits requests per account (60/minute using the existing locked attempt counter), and uses the existing `postal_codes` cache/provider service with a three-second provider timeout. The component cancels obsolete requests, ignores late answers, and fills only an empty or previously auto-filled area. Manual areas survive lookups; changing CEP clears only the previous auto-fill. The authoritative save-time validation/cache remains in `withLocation`; an outage still permits a manually supplied area.

## Deliberately server-owned

Auth/session cookies, Supabase Storage, feature flags, administrator reads/actions, Superforms validation, table writes, provider calls, Resend, outbox dispatch and scheduled jobs stay on the server. Existing notification flows and version banners are outside this ticket. No new database migration is required.

## Verification

Run `pnpm lint`, `pnpm check`, `pnpm test:unit`, `pnpm test:e2e` with the local Supabase stack, and `pnpm test:integration` with a disposable Postgres. Regression tests cover DTO boundaries, identity mismatches, key isolation, status handling, invalidation, SSR seeding without duplicate fetches, focus/reconnect, lookup cancellation and CEP endpoint throttling.

Manual review: navigate between filtered lists and details; create/edit a table with pending suggestions; join/leave and moderate; rate a completed session; change profile/avatar; log out then sign in as another user; simulate offline/expired sessions; type CEPs rapidly and preserve a manually edited region. Check the same server form flows with JavaScript disabled. Coordinate conflicts with the separate table-edit PR #134 before merging.
