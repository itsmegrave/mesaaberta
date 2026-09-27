# Skeleton (Cerberus) and Superforms migration

Date: 2026-09-21. Branch: `feat/redesign`.

## Goal

1. Replace Bits UI and the hand-rolled Tailwind design with the full Skeleton design system, using the stock **Cerberus** theme in light and dark.
2. Handle every POST form in the app with Superforms.

## Decisions

- **Scope:** full Skeleton design system, not only a component swap. The custom petrol/celadon/lamp tokens go away.
- **Theme:** `cerberus`, light and dark.
- **Fonts:** keep Cinzel for the wordmark only. Drop Bricolage Grotesque and Literata.
- **Delivery:** a foundation first, then one slice at a time. Each slice restyles a page and moves its forms to Superforms, so every file is touched once.
- **Exception:** the `/tables` filter is a plain GET form. It stays native (shareable URL, works without JavaScript) and is only restyled.

## 1. Skeleton foundation

- Add `@skeletonlabs/skeleton` and `@skeletonlabs/skeleton-svelte`. Import both, plus `@skeletonlabs/skeleton/themes/cerberus`, in `src/routes/layout.css`. Set `data-theme="cerberus"` on `<html>` in `src/app.html`.
- Remove the custom `@theme` tokens, the two dark-theme blocks and the `text-link` utility from `layout.css`. Components use Cerberus tokens and presets (`primary`, `surface`, `preset-*`, `btn`, `input`, `card`, `label`).
- Light and dark: keep `ThemeToggle` and `src/lib/theme/theme.ts` behavior (saved choice, otherwise follow the system). Change what they set on `<html>` to a `data-mode` attribute, with a matching Tailwind `@custom-variant dark`. Confirm the exact attribute against Skeleton's `light-dark()` colour scheme during implementation.
- Fonts: remove `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/literata`. Keep Cinzel and use it only in the wordmark.
- `src/lib/theme/theme.spec.ts` checks the old custom tokens and their contrast, so it becomes obsolete. Replace it with a test that the toggle sets and persists the mode. Update `e2e/theme.e2e.ts`.
- `TableIllustration`, `TableLogo` and `SeatRing` are recoloured to Cerberus tokens.

## 2. Components

- Bits UI to Skeleton:
  - `Avatar.svelte`: Skeleton Avatar.
  - `AccountMenu.svelte`: Skeleton Popover.
  - `src/routes/+layout.svelte`: Progress Linear.
  - Remove `bits-ui` from `package.json`.
- Toast: replace `Toaster.svelte` and `stores/toast.svelte.ts` with Skeleton Toast (`createToaster`). Existing call sites keep working.
- Presets: buttons, inputs, selects, cards and `FormField` use Skeleton presets in place of hand-rolled classes.
- `BottomTabBar` moves to Skeleton Navigation if it fits. Otherwise it stays custom, built on Cerberus tokens.

## 3. Superforms

- Schemas become Zod 4 schemas (already a dependency): the credentials parser (`src/lib/auth/credentials.ts`) and `src/lib/tables/schema.ts`. Their unit tests are ported. Adapters: `zod4` on the server, `zod4Client` on the client.
- Server: every action calls `superValidate(request, zod4(schema))` and returns `fail(400, { form })` on invalid input.
  - Supabase and rate-limit outcomes go through `message(form, …)`, keeping the existing 400/429/500 mapping.
  - The password is never sent back to the client.
  - `safeNext`, the auth guards (`requireUser`) and `afterResponse` are unchanged.
- Client: `superForm` with client-side validation. Field errors map to the existing paraglide messages inside `FormField`.
- Forms covered:
  - Login, signup, forgot password, reset password.
  - Table create and edit, including the image upload (multipart).
  - Join and rate on the table page.
  - Button-only actions: leave, approve, decline, remove, logout. Each gets a small schema (`playerId` as a uuid, plus `next`) and goes through the same `superForm` path, so all mutations validate and report pending state the same way. They keep working without JavaScript.

## 4. Testing and delivery

- Update component specs (`*.svelte.spec.ts`) and the e2e selectors for the new markup and form behavior.
- Verify with `pnpm check`, `pnpm lint`, `pnpm test:unit`, then `pnpm test:e2e` against local Supabase in Docker. Tests never touch Cloudflare.
- Everything stays on `feat/redesign` as separate commits: foundation, then one commit per slice. The Trello card gets the PR link, and the card URL goes in the PR body.

## Risks

- Cerberus contrast, especially the amber "waiting" state that used the lamp colour, has to be re-checked in both modes.
- The image upload in the table form is the least standard Superforms case (multipart with `dataType`/files), so it gets its own slice and extra tests.
- Broad e2e selector churn is expected because markup changes on every page.
