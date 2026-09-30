# API queries and form writes

## Reads and cache boundaries

The root layout creates one QueryClient per component tree and shares it through `src/lib/query/context.ts`. Server requests never share an authenticated cache. The layout clears it when the server-provided cache identity changes.

`pageQuery` seeds a resource from its authorized server load. Query keys include the resource, normalized parameters and the viewer for private resources. A newer server load reconciles with the cache; focus, reconnect and explicit invalidation refresh stale data. Authorization failures remove the affected read and refresh the route.

Read transport stays on same-origin API paths, preserves cookies and checks the viewer response header for private data. Read retries are limited; authorization and rate-limit failures are not retried. See `src/lib/query/keys.ts`, `page.svelte.ts`, `client.ts` and `src/lib/api/http.ts`.

## Form ownership during card #152

TanStack Form owns values and client validation in the catalog and approval queue. `actionForm` captures initial values once, so route reloads do not overwrite a draft. Catalog creation resets explicitly after success; other forms keep their values unless their flow chooses a reset.

TanStack Query owns the write mutation. One submit handler validates and posts native FormData to the existing SvelteKit action with the action request header. It guards concurrent submits, never retries writes, preserves values after business/transport failures and passes redirects/errors to the SvelteKit router. Pending, delayed and timeout indicators use the same shared SubmitButton as the transitional forms.

The server still checks authentication, authorization and the domain Zod schema before calling the service. The shared scalar contract rejects repeated text keys and uploaded files and echoes only explicitly allowed text fields. Arrays, numeric/boolean coercion, nested inputs and uploads need their own decoder in later migration batches; this helper is not a replacement for those domain rules.

After confirmed success, `afterWrite` invalidates the affected resource keys and the route reloads. Catalog changes invalidate catalog lookups and table views. Refresh failures do not retry the already completed write. Failure responses leave unrelated reads alone.

The `Form` wrapper renders a native form. Approval supports native POST without JavaScript. Catalog dialogs require JavaScript and mount their overlays only when open, so closed dialogs cannot block native approval buttons.

Remaining forms still use Superforms during the transition. Keep one submit owner per form and preserve each flow's validation, redirects, errors, upload behavior and leave guard as it migrates. Never attach Superforms enhancement alongside an `actionForm` submit handler.

## Inventory and validation

Run `node scripts/ui-inventory.ts` to refresh the production control inventory. [CONTRIBUTING.md](../CONTRIBUTING.md#ui-and-forms) describes shared UI conventions.

Contract tests cover allowed values, business/schema errors, repeated keys and file exclusion. Browser tests cover concurrent submit guards, drafts, failed transport, redirects and successful refreshes. The catalog E2E runs against a local test database and covers CRUD, native approval, correction after server refusal, explicit creation reset, focus and dialogs in mobile/desktop and light/dark modes.
