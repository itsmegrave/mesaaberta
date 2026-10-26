# Contributing

Thanks for helping. Bug reports, fixes, features and translations are all welcome.

## Workflow

- One issue, one small pull request that closes it.
- Conventional commits, one concern per commit.
- The PR should build green (`bun run lint`, `bun run check`, `bun run test`; and `bun run test:integration` when you touch anything that depends on database concurrency, see the README) and include a short test plan.
- Tests describe behavior, not wording. Each test should name the break it catches.

- To see a change as a signed-in member, GM or admin, use the dev login (README, "Dev login"): `bun run dev:up`, `bun run dev:local`, then `/dev/login?as=gm`. It is for `vite dev` only; never import `src/lib/server/dev` from anywhere but `hooks.server.ts`.

See the [README](README.md) for setup and scripts.

## Changelog

User-facing releases are recorded in `apps/web/src/content/changelog.json` and published at `/changelog` (linked under Suporte in the footer). Add changes to the release day, newest first, with a short title and one plain sentence about what changed for the person using the app. Use pt-BR, sentence case and gender-neutral roles (quem mestra, quem joga). Categories are `new`, `improved` and `fixed`; optional links point to the relevant page or instructions. Internal changes, dependency updates and admin-only work stay in GitHub.

Keep one entry per day. The page derives highlights, category counts and pagination from the content. The newest three days are the highlights; give one a `preview` (`chat` or `password`, light and dark captures in `apps/web/static/changelog/`) to show a capture instead of the table illustration. Content is rendered as escaped text, never HTML.

## Code style

Tabs for indentation and semicolons at the end of statements (YAML is the one exception and uses spaces). Prettier is the only formatter: `prettier.config.js` sets the rules and `.editorconfig` tells editors the same. ESLint checks code quality and never formatting.

- `bun run format` rewrites every file to the style.
- `bun run lint:fix` does the same and applies ESLint's automatic fixes.
- `bun run lint` (Prettier check, then ESLint) is what CI runs, and a badly formatted file fails it.

In VS Code, install the recommended extensions when prompted (`.vscode/extensions.json`) and files are formatted on save. Any other editor needs the Prettier plugin and EditorConfig support.

When you must disable an ESLint rule, say why on the same line: `// eslint-disable-next-line rule -- reason`.

## UI and forms

Prefer Skeleton primitives and the shared `MAForm`, `FormField`, `TextInput` and `MAButton` components (`src/lib/components/ui/`). A submit button is `<MAButton type="submit" controller={form}>`: it is busy, `aria-disabled` and spinner-bearing while the form sends, never disabled before the first attempt. Use `MATextArea` for plain multiline text. Basic controls use semantic HTML inside their wrappers because Skeleton does not provide standalone Button, TextInput or Form components; a wrapper named like an HTML element or a Skeleton component takes the MA prefix. Use theme tokens and Tailwind's 4px spacing grid; document calculated layout exceptions.

The app requires JavaScript. Do not build no-JS fallbacks: no `<noscript>` buttons, no native inputs shown before mount, and filters can apply on change. What stays is the server side: forms still submit to SvelteKit actions through `MAForm` and the shared actionForm, and server authorization and validation remain authoritative.

New form migrations use TanStack Form for values/validation and TanStack Query for mutations/cache. The catalog, approval queue and notification actions are migrated flows. `src/lib/forms/action-form.svelte.ts` supplies a single submit handler, validation errors, pending/delayed/timeout states and failure-safe drafts. Pass the affected cache domain explicitly for Query-backed reads; route-only data such as notifications reloads through SvelteKit. Pair it with `MAForm` and the existing SvelteKit action; do not add a second enhancement handler or automatic write retries. Server authorization and Zod validation remain authoritative.

### Native form elements that stay

Raw `<input>`, `<select>`, `<textarea>`, `<button>` and `<form>` appear only in these cases; anything else should use the shared controls:

- **Wrappers.** `MAForm`, `MAButton`, `ActionForm`, `PostButton`, `TextInput`, `MATextArea` and the test harnesses under `src/lib/forms` and `src/lib/query`.
- **Hidden inputs** that carry ids or `next` values for a native POST (catalog, moderation, report, notification, session and admin Instagram actions) and the serialized value of rich controls (`RichTextField`, `SearchSelect`, `DateTimeField`, `ChatHeader`, `ProfileForm`). They have no visual and carry the value to the SvelteKit action.
- **Radio groups and checkboxes** in `ui/RadioCards` (`TableForm`'s choices), `ui/CheckboxPills` (a partner's kinds), `ImageUpload`, `SessionConfirmation` (who showed up) and `/admin/notifications`: native radios and checkboxes keep keyboard behavior and native form values, and Skeleton has no standalone radio group or checkbox.
- **No native `<select>`.** Pickers, including `ProfileForm`'s age range, gender and timezone, use `SearchSelect` (Skeleton's Combobox), which submits its picks as hidden inputs.

Plan and status: [docs/tanstack-form-ui-migration-plan.md](docs/tanstack-form-ui-migration-plan.md).

`validateStringForm` handles only allowlisted scalar text fields. Arrays, numbers, booleans and files need explicit domain decoders before using it in other flows. Never allowlist passwords or files for echoing in action responses. Use `validateFormData` with explicit defaults and array/boolean/file fields for compound forms. Strip files with `responseForm` and passwords with `withoutSecrets` before returning any action response.

Multiline text a person writes for others to read (a table's description, the welcome message, an announcement) uses `RichTextField` and is shown with `RichText`. It is stored as the small HTML subset of `src/lib/text/rich.ts` (paragraphs, headings, bold, italic, underline, strikethrough, lists, quotes, code, dividers and http/https/mailto links; no images, colours or alignment, because the CSP blocks inline `style`). Validate it with `richText(max)` from `#lib/text/rich-schema`, whose limit counts what a reader sees, and show it only through `RichText`, the one place `{@html}` is allowed. Calendar, Instagram and the plain-text e-mail copy use `toPlainText`. Chat messages and rating comments use the plain-text `MATextArea` wrapper.

Review migrated controls for accessibility and mobile/desktop and light/dark visual coverage.

## Icons

Icons come from [Iconify](https://iconify.design) as one Svelte component per icon, following the [SVG + CSS for Svelte](https://iconify.design/docs/usage/svg-css/svelte/) docs: Reicon (`@iconify-svelte/reicon`) and Game Icons (`@iconify-svelte/game-icons`). Use them by name: `<Icon name="wrench" />` (`#lib/components/ui/Icon.svelte`).

To add one, import it in `src/lib/icons/registry.ts` and add it to `ICONS` ([browse Reicon](https://icon-sets.iconify.design/reicon/), [Game Icons](https://icon-sets.iconify.design/game-icons/)). UI glyphs use Reicon's Filled weight (the `-filled` names), so they sit with the solid Game Icons; line-only glyphs (arrows, `xmark`, `check`, chevrons, `add`, `minus` and the rich-text toolbar) keep the plain names. The Game Icons are for navigation, roles and messaging. Game Icons names carry the `game-icons:` prefix, and navigation, roles and messaging use them: `tavern-sign` (Mesas), `dice-twenty-faces-twenty` (Abrir mesa), `tabletop-players` (Minhas mesas), `black-knight-helm` (Admin), `meeple` (people), `dungeon-gate` (Entrar only), `bar-stool` (Pedir vaga), `exit-door` (Sair), `scroll-quill` (every messaging icon, no speech bubbles) and `house` (Início in breadcrumbs). Loading states use the shared `Spinner` (`svg-spinners:tadpole`), with reduced-motion support. Run `bun run icons` after changing the registry or upgrading icon packages. It embeds their SVG geometry so rendering works without CSS path support or external requests.

## Translations

The site is written in Brazilian Portuguese (`pt-BR`, the base language), and only that language is served today. All user-facing text lives in `messages/<locale>.json`, one flat file per language, so translating never touches components. English is planned in [#31](https://github.com/itsmegrave/mesaaberta/issues/31).

Translations are managed on Crowdin: [`crowdin.yml`](crowdin.yml) points it at `messages/pt-BR.json`, and Crowdin opens a pull request with new and changed translations. Editing the JSON files directly still works.

**Fix a message:** edit its value in `messages/pt-BR.json`. Keep the keys and any `{placeholders}` exactly as they are.

Every value is an [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) string, read by `@inlang/plugin-icu1`, so translation platforms can edit the files directly. Plurals look like `{count, plural, =0 {Nenhuma mesa} =1 {1 mesa} other {{count} mesas}}`; inside a plural `#` and `{count}` mean the same number. A translation may use its own language's plural forms (`one`, `few`, `many`, `other`) instead of the exact `=0`/`=1` matches. To write a literal `{` or `}`, wrap it in apostrophes (`'{'`). Roles stay gender-neutral (quem mestra, quem joga, Participantes); a test fails on gendered roles in pt-BR such as "o mestre", "Mestre:" or "jogadores".

**Add a language** (for example `en`):

1. Copy `messages/pt-BR.json` to `messages/en.json` and translate every value.
2. Add `"en"` to `locales` in `project.inlang/settings.json`.
3. Run `bun run test`. A test fails if your file is missing a key, changes a placeholder, isn't valid ICU or uses a plural form the language doesn't have.
4. There is no language switch yet, because only one language is served. It ships with the second language (see #31).

Languages share the same stable URLs. Paraglide selects translated text from the language preference cookie and base locale; never add locale prefixes to resource paths. Proper nouns (Mesa Aberta, Lenindragons, GitHub) stay as they are.

## Internal links

Use plain canonical paths for internal links: `/t` (tables), `/p` (partners), `/cf` (crowdfunding), `/m` (messages), `/n` (notifications), `/u/tables` (dashboard), and `/u/profile/edit` (account settings). Public profiles remain `/u/:username`. Private export and provider linking use `/u/profile/export` and `/u/profile/connect/:provider`, within the already reserved `profile` namespace. Account onboarding is `/u/profile/setup`; password recovery uses `/forgot` and `/reset`.

`@mesaaberta/core/routes` centralizes legacy aliases and shared outbound URL builders (e-mail, calendar and notifications). Ordinary links do not need a locale or routing wrapper. Legacy GET/HEAD URLs redirect permanently with their search parameters; legacy mutations reroute to the same canonical action, preserving the method and body. Keep API, admin, authentication callback and internal probe paths compatible. Reserve new static `/u` namespaces in `profile/username.ts` before adding them, and put authentication checks on private leaves rather than on all `/u` routes.
