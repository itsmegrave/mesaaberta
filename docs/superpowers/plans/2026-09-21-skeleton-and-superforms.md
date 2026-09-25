# Skeleton (Cerberus) and Superforms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bits UI and the hand-rolled Tailwind design with Skeleton's stock Cerberus theme (light and dark), and handle every POST form with Superforms.

**Architecture:** A foundation task installs Skeleton and switches dark mode to a `data-mode` attribute. Bits UI and the toast are swapped for Skeleton components. A shared form layer (Zod 4 schemas with error codes, `FormMessage`, `withoutSecrets`, `refuse`) is built next, then each slice (auth, registrations and ratings, table form) is restyled and moved to Superforms together. A last task removes the temporary colour bridge and verifies both modes.

**Tech Stack:** SvelteKit 2, Svelte 5, Tailwind 4, `@skeletonlabs/skeleton` + `@skeletonlabs/skeleton-svelte` (v3), `sveltekit-superforms` 2.30 with the `zod4` adapter, Zod 4.6, Paraglide (pt-BR), Vitest (client browser project + server project), Playwright e2e against local Supabase.

**Spec:** `docs/superpowers/specs/2026-09-21-skeleton-and-superforms-design.md`

## Global Constraints

- Theme: `cerberus`, light and dark. Dark mode is `data-mode="dark"` on `<html>` plus `@custom-variant dark`.
- Fonts: keep Cinzel for the wordmark only (`font-brand`). Drop Bricolage Grotesque and Literata.
- Every POST form goes through `superForm`, except: the `/tables` filter (plain GET, restyle only) and `/logout` (a fieldless `+server.ts` POST endpoint: Superforms cannot drive it and it has no fields, validation or result to show).
- Field errors are short codes (`too_small`, `invalid_format`, `mismatch`, …), never English text. The UI turns codes into paraglide sentences.
- A password is never sent back to the browser, not even when the form is refused (`withoutSecrets`).
- Keep the rate-limit behaviour from #70: `RateLimited` becomes a 429 with `Retry-After` and a `retryAfter` value, and `handleTableForm` keeps its `guard` argument (checked after validation, before the image upload).
- Keep `safeNext`, `requireUser`, `locals.afterResponse` and the auth guards unchanged.
- Tests never touch Cloudflare: unit tests use PGlite/simulated bindings, e2e uses the local Supabase in Docker (`pnpm e2e:up`).
- Every commit message ends with these two trailer lines (add them with `--trailer`):
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet`
- Run `pnpm format` before each commit (prettier + tailwind class sorting are checked by `pnpm lint`).
- Work on branch `feat/redesign`. Commit per task. Do not `git add` anything under `docs/` except the files a step names.

## File Structure

New files:

- `src/lib/forms/zod-codes.ts`: makes Zod issues carry their code as the message.
- `src/lib/forms/message.ts`: the `FormMessage` type an action returns besides field errors.
- `src/lib/forms/server.ts` (+ `server.spec.ts`): `withoutSecrets`, `refuse`.
- `src/lib/toaster.ts`: Skeleton `createToaster` plus the `toast` helper with the old method names.
- `src/lib/tables/registration.ts`: schemas for join, leave, approve, decline, remove.
- `src/lib/tables/registration-errors.ts`: registration error code to sentence.
- `src/lib/components/ActionForm.svelte` (+ spec): a button-only form driven by `superForm`.
- `src/lib/components/CredentialsFormHarness.svelte`, `TableFormHarness.svelte`: test-only wrappers that create the `superForm` a component needs.
- `src/lib/theme/theme.svelte.spec.ts`: DOM tests for the theme helper.

Modified: `layout.css`, `app.html`, `theme.ts`, `ThemeToggle.svelte`, `Avatar.svelte`, `AccountMenu.svelte`, `+layout.svelte`, `Toaster.svelte`, `FormField.svelte`, `CredentialsForm.svelte`, `TableForm.svelte`, `PlayingCard.svelte`, `RunningCard.svelte`, all pages under `src/routes`, the schema files (`credentials.ts`, `rating.ts`, `tables/schema.ts`, `tables/form-values.ts`), the two `form-action.ts` helpers, the page servers, and their specs and e2e files.

Deleted: `src/lib/stores/toast.svelte.ts`, `toast.spec.ts`, `src/lib/theme/contrast.ts`, `bits-ui`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/literata`.

## Skeleton class cheat sheet (used from Task 3 on)

Skeleton v3 with Cerberus. Semantic colours: `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`. Paired light/dark shades use the `a-b` form (`bg-surface-100-900` is `surface-100` in light, `surface-900` in dark). Components: `btn`, `btn-icon`, `input`, `select`, `textarea`, `card`, `chip`, `badge`, `anchor`, `label-text`, `hr`. Presets: `preset-filled-primary-500`, `preset-tonal`, `preset-tonal-primary`, `preset-outlined-primary-500`, `preset-filled-warning-500`, `preset-filled-error-500`.

Old token to new class:

| Old                                                | New                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bg-celadon`                                       | `bg-surface-50-950`                                                                      |
| `text-ink`                                         | `text-surface-950-50` (drop when it is just the default text colour)                     |
| `text-ink2`                                        | `text-surface-700-300`                                                                   |
| `bg-surface` (card, input, menu)                   | `bg-surface-100-900`                                                                     |
| `border-line`, `border-petrol/15`, `border-ink/60` | `border-surface-200-800`                                                                 |
| `bg-wash`, `hover:bg-wash`                         | `bg-surface-200-800`, `hover:preset-tonal`                                               |
| `bg-petrol text-on-petrol` (button, badge)         | `preset-filled-primary-500`                                                              |
| `border-petrol` (outline button)                   | `preset-outlined-primary-500`                                                            |
| `text-lamp`                                        | `text-warning-700-300`                                                                   |
| `bg-lamp text-on-lamp`                             | `preset-filled-warning-500`                                                              |
| `text-danger`                                      | `text-error-700-300`                                                                     |
| `border-danger text-danger`                        | `preset-outlined-error-500`                                                              |
| `bg-sage`, `bg-rose`, `bg-periwinkle`              | `preset-filled-primary-500`, `preset-filled-secondary-500`, `preset-filled-tertiary-500` |
| `text-link`                                        | `anchor`                                                                                 |
| `font-display`, `font-body`                        | delete (Skeleton's base font applies)                                                    |
| `font-brand`                                       | keep (wordmark only)                                                                     |
| hand-rolled `rounded border … px-3 py-2` input     | `input` (or `select`, `textarea`)                                                        |
| hand-rolled button `rounded bg-petrol px-5 py-3 …` | `btn preset-filled-primary-500`                                                          |

---

### Task 1: Skeleton foundation and light/dark mode

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`, `src/routes/layout.css`, `src/app.html`, `src/lib/theme/theme.ts`, `src/lib/components/ThemeToggle.svelte`, `src/lib/components/ThemeToggle.svelte.spec.ts`, `e2e/theme.e2e.ts`
- Create: `src/lib/theme/theme.svelte.spec.ts`
- Replace: `src/lib/theme/theme.spec.ts`
- Delete: `src/lib/theme/contrast.ts` (after `git grep -n "theme/contrast" -- src e2e` shows only `theme.spec.ts`)

**Interfaces:**

- Produces (`src/lib/theme/theme.ts`): `type ThemeChoice = 'system' | 'light' | 'dark'`, `type Mode = 'light' | 'dark'`, `MODE_COLOURS: Record<Mode, string>`, `resolveMode(choice: ThemeChoice, systemPrefersDark: boolean): Mode`, `readChoice(): ThemeChoice`, `applyChoice(choice: ThemeChoice): void`. `applyChoice` sets `data-mode` on `<html>` (always `light` or `dark`, never removed) and updates `meta[name=theme-color]`.

- [ ] **Step 1: Install Skeleton**

```bash
pnpm add @skeletonlabs/skeleton @skeletonlabs/skeleton-svelte
node -e "console.log(require.resolve('@skeletonlabs/skeleton/themes/cerberus'))"
```

Expected: both packages listed in `package.json` `dependencies`; the second command prints a path ending in a `cerberus` css file. If it throws, list `node_modules/@skeletonlabs/skeleton/dist/themes` and use the `cerberus` file you find in the `@import` in Step 2.

- [ ] **Step 2: Rewrite `src/routes/layout.css`**

The colour tokens and the dark block below are a temporary bridge so pages not yet moved to Skeleton keep working. Task 9 deletes them.

```css
@import 'tailwindcss';
@import '@skeletonlabs/skeleton';
@import '@skeletonlabs/skeleton-svelte';
@import '@skeletonlabs/skeleton/themes/cerberus';
@import '@fontsource-variable/cinzel';

/* Dark mode is a `data-mode` on <html>: set before the first paint (src/app.html) and by the theme toggle. */
@custom-variant dark (&:where([data-mode='dark'], [data-mode='dark'] *));

:root[data-mode='light'] {
	color-scheme: light;
}
:root[data-mode='dark'] {
	color-scheme: dark;
}

@theme {
	/* Wordmark only */
	--font-brand: 'Cinzel Variable', Georgia, serif;
}

/* TEMPORARY bridge (removed in Task 9): the old colour tokens, so pages not yet on Skeleton still render. */
@theme {
	--color-celadon: #e3ebe5;
	--color-ink: #12272b;
	--color-ink2: #3b5256;
	--color-petrol: #17393f;
	--color-lamp: #925b00;
	--color-sage: #7fb7a4;
	--color-rose: #c97b84;
	--color-periwinkle: #8e9ae6;
	--color-surface: #ffffff;
	--color-on-petrol: #e3ebe5;
	--color-on-lamp: #ffffff;
	--color-danger: #991b1b;
	--color-focus: #17393f;
	--color-line: rgba(23, 57, 63, 0.16);
	--color-wash: rgba(23, 57, 63, 0.08);
	--color-lampwash: rgba(146, 91, 0, 0.1);
}

:root[data-mode='dark'] {
	--color-celadon: #0e1b1e;
	--color-ink: #e6efe9;
	--color-ink2: #a9bfb8;
	--color-petrol: #33727a;
	--color-lamp: #f0b34a;
	--color-surface: #16292d;
	--color-on-petrol: #f4f8f5;
	--color-on-lamp: #1b1300;
	--color-danger: #ff9d9d;
	--color-focus: #8fd3cb;
	--color-line: rgba(143, 211, 203, 0.2);
	--color-wash: rgba(143, 211, 203, 0.1);
	--color-lampwash: rgba(240, 179, 74, 0.13);
}

/* TEMPORARY (removed in Task 8/9): utilities of the old design. */
@utility text-link {
	@apply font-medium underline decoration-lamp decoration-2 underline-offset-4;
}

@keyframes progress-indeterminate {
	0% {
		transform: translateX(-100%);
	}
	50% {
		transform: translateX(100%);
	}
	100% {
		transform: translateX(300%);
	}
}

@utility animate-progress {
	animation: progress-indeterminate 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
```

The old `@layer base` block (html background, body size, heading font, focus ring) and the Bricolage/Literata imports are gone on purpose: Skeleton's base styles replace them.

- [ ] **Step 3: Update `src/app.html`**

Replace the `<html …>` tag, the two `theme-color` metas and the inline script. Use `#ffffff` and `#000000` for now; Step 4 computes the real colours.

```html
<html lang="%paraglide.lang%" dir="%paraglide.dir%" data-theme="cerberus" data-mode="light"></html>
```

```html
<!-- The browser's own chrome follows the mode. A manual choice replaces both, below. -->
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />

<!-- Sets light or dark before the first paint, so a dark-mode reader never sees a light flash: the
     remembered choice, else the system preference. Without JavaScript the page stays light. -->
<script nonce="%sveltekit.nonce%">
	(function () {
		var colours = { light: '#ffffff', dark: '#000000' };
		var choice = null;
		try {
			choice = localStorage.getItem('theme');
		} catch (e) {}
		var chosen = choice === 'light' || choice === 'dark';
		var mode = chosen
			? choice
			: window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';

		document.documentElement.dataset.mode = mode;
		if (!chosen) return;

		var metas = document.querySelectorAll('meta[name="theme-color"]');
		for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', colours[mode]);
	})();
</script>
```

- [ ] **Step 4: Compute the two `theme-color` values from Cerberus**

Start the dev server in the background, run the script, stop the server.

```bash
pnpm dev --port 5199 &
sleep 8
node --input-type=module <<'EOF'
import { chromium } from 'playwright';
const browser = await chromium.launch();
const out = {};
for (const mode of ['light', 'dark']) {
	const page = await browser.newPage();
	await page.addInitScript((m) => localStorage.setItem('theme', m), mode);
	await page.goto('http://localhost:5199/login');
	out[mode] = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
	});
}
console.log(out);
await browser.close();
EOF
kill %1
```

Expected: an object like `{ light: '#…', dark: '#…' }` with two different colours. Write those two hex strings into the `colours` object in `src/app.html`, into both `<meta name="theme-color">` tags (light first, dark second), and into `MODE_COLOURS` in Step 6. If the two values are equal, the mode is not being applied: check the `data-mode` attribute on `<html>` in the running page before going on.

- [ ] **Step 5: Write the failing theme tests**

`src/lib/theme/theme.spec.ts` (server project, pure logic):

```ts
import { describe, expect, it } from 'vitest';
import { resolveMode } from './theme';

describe('resolveMode', () => {
	it.each([
		['light', true, 'light'],
		['light', false, 'light'],
		['dark', true, 'dark'],
		['dark', false, 'dark']
	] as const)('a chosen %s wins over the system (dark: %s)', (choice, prefersDark, mode) => {
		expect(resolveMode(choice, prefersDark)).toBe(mode);
	});

	it('follows the system when nothing was chosen', () => {
		expect(resolveMode('system', true)).toBe('dark');
		expect(resolveMode('system', false)).toBe('light');
	});
});
```

`src/lib/theme/theme.svelte.spec.ts` (client project, DOM):

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { MODE_COLOURS, applyChoice, readChoice } from './theme';

afterEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('data-mode');
});

const mode = () => document.documentElement.dataset.mode;
const metas = () =>
	[...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

describe('applyChoice', () => {
	it('sets the mode on <html> and remembers a manual choice', () => {
		applyChoice('dark');

		expect(mode()).toBe('dark');
		expect(readChoice()).toBe('dark');
	});

	it('forgets the choice for "system" but still sets a mode from the system preference', () => {
		applyChoice('dark');
		applyChoice('system');

		expect(readChoice()).toBe('system');
		expect(localStorage.getItem('theme')).toBeNull();
		const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		expect(mode()).toBe(systemDark ? 'dark' : 'light');
	});

	it('paints the browser chrome in the chosen mode', () => {
		document.head.insertAdjacentHTML(
			'beforeend',
			'<meta name="theme-color" content="x" media="(prefers-color-scheme: light)"><meta name="theme-color" content="y" media="(prefers-color-scheme: dark)">'
		);
		applyChoice('dark');

		expect(metas().slice(-2)).toEqual([MODE_COLOURS.dark, MODE_COLOURS.dark]);
	});
});
```

- [ ] **Step 6: Run the tests to see them fail**

Run: `pnpm exec vitest run --project server src/lib/theme/theme.spec.ts`
Expected: FAIL (`resolveMode` is not exported).

- [ ] **Step 7: Rewrite `src/lib/theme/theme.ts`**

```ts
export type ThemeChoice = 'system' | 'light' | 'dark';
export type Mode = 'light' | 'dark';

/** The page background of each mode, for the browser's own chrome. Keep in step with src/app.html. */
export const MODE_COLOURS: Record<Mode, string> = {
	light: '<LIGHT_HEX from Step 4>',
	dark: '<DARK_HEX from Step 4>'
};

const KEY = 'theme';

/** The mode a choice means: a manual choice wins, "system" follows the browser. */
export function resolveMode(choice: ThemeChoice, systemPrefersDark: boolean): Mode {
	if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
	return choice;
}

/** What the reader chose and the browser remembered. Storage can be blocked, so this never throws. */
export function readChoice(): ThemeChoice {
	try {
		const stored = localStorage.getItem(KEY);
		return stored === 'light' || stored === 'dark' ? stored : 'system';
	} catch {
		return 'system';
	}
}

/**
 * Applies and remembers a choice. The page is always in one mode: `data-mode` on `<html>` is `light`
 * or `dark` (the stylesheet's `dark:` variant reads it). "system" forgets the choice and takes the
 * mode from `prefers-color-scheme`. The choice lives in localStorage, not a cookie, so it needs no
 * banner and never leaves the browser.
 */
export function applyChoice(choice: ThemeChoice) {
	try {
		if (choice === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Blocked storage: the choice still applies to this page, it just is not remembered.
	}

	const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const mode = resolveMode(choice, systemDark);
	document.documentElement.dataset.mode = mode;

	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const scheme = meta.media.includes('dark') ? 'dark' : 'light';
		meta.content = MODE_COLOURS[choice === 'system' ? scheme : mode];
	}
}
```

Replace the two `<…_HEX from Step 4>` strings with the values printed in Step 4 (they are constants of the theme, not placeholders to leave).

- [ ] **Step 8: Run the theme tests**

Run: `pnpm exec vitest run --project server src/lib/theme/theme.spec.ts && pnpm exec vitest run --project client src/lib/theme/theme.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 9: Update `ThemeToggle.svelte` and its spec**

In `onMount`, replace the media-query handler so a system change re-applies the mode while the choice is "system":

```ts
const onChange = (e: MediaQueryListEvent) => {
	if (readChoice() === 'system') {
		isDark = e.matches;
		applyChoice('system');
	}
};
```

Replace the button's classes (the old tokens are being retired):

```svelte
class="btn-icon preset-tonal size-11 shrink-0 rounded-full"
```

Then run `pnpm exec vitest run --project client src/lib/components/ThemeToggle.svelte.spec.ts`. Fix any assertion that looks at `data-theme` or a removed class so it looks at `document.documentElement.dataset.mode` (`'dark'` or `'light'`) instead. Do not weaken what the assertion proves.

- [ ] **Step 10: Rewrite `e2e/theme.e2e.ts` for the toggle button and `data-mode`**

The old file drives a `combobox` named "Tema" that no longer exists (the control is a button, `aria-label="Tema escuro"`, `aria-pressed`). Keep the helpers (`open`, `colours`, `rgb`, `luminance`, `contrast`) and replace the describe blocks with:

```ts
const toggle = (page: import('@playwright/test').Page) =>
	page.getByRole('button', { name: 'Tema escuro' });

test.describe('the mode follows the system by default', () => {
	test('a dark system gets a dark page and a light system a pale one, both readable', async ({
		browser
	}) => {
		const light = await open(browser, 'light');
		const dark = await open(browser, 'dark');
		const l = await colours(light.page);
		const d = await colours(dark.page);

		await expect(light.page.locator('html')).toHaveAttribute('data-mode', 'light');
		await expect(dark.page.locator('html')).toHaveAttribute('data-mode', 'dark');
		expect(luminance(d.background)).toBeLessThan(luminance(l.background));
		expect(contrast(d.background, d.text)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(l.background, l.text)).toBeGreaterThanOrEqual(4.5);
		expect(d.scheme).toBe('dark');
		await light.context.close();
		await dark.context.close();
	});
});

test.describe('a manual choice overrides the system', () => {
	test('light on a dark system is the same page as light on a light system', async ({
		browser
	}) => {
		const chosen = await open(browser, 'dark', 'light');
		const plain = await open(browser, 'light');

		await expect(chosen.page.locator('html')).toHaveAttribute('data-mode', 'light');
		expect((await colours(chosen.page)).background).toBe((await colours(plain.page)).background);
		await chosen.context.close();
		await plain.context.close();
	});

	test('the toggle changes the page at once and the choice survives a reload', async ({
		browser
	}) => {
		const { page, context } = await open(browser, 'light');
		const before = (await colours(page)).background;

		await toggle(page).click();
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		expect((await colours(page)).background).not.toBe(before);

		await page.reload();

		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
		await context.close();
	});

	test('paints the browser chrome in the chosen mode', async ({ browser }) => {
		const { page, context } = await open(browser, 'light', 'dark');

		const metas = await page
			.locator('meta[name="theme-color"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('content')));

		expect(metas[0]).toBe(metas[1]);
		expect(metas[0]).toBe(
			await page.evaluate(() => {
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 1;
				const ctx = canvas.getContext('2d')!;
				ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
				ctx.fillRect(0, 0, 1, 1);
				const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
				return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
			})
		);
		await context.close();
	});
});

test.describe('no flash', () => {
	test('with dark chosen, the mode is already set when the body first appears', async ({
		browser
	}) => {
		const context = await browser.newContext({ colorScheme: 'light' });
		await context.addInitScript(() => {
			localStorage.setItem('theme', 'dark');
			new MutationObserver((_, observer) => {
				if (!document.body) return;
				(window as unknown as { __modeAtBody?: string }).__modeAtBody =
					document.documentElement.dataset.mode;
				observer.disconnect();
			}).observe(document, { childList: true, subtree: true });
		});
		const page = await context.newPage();

		await page.goto('/');

		const atBody = await page.evaluate(
			() => (window as unknown as { __modeAtBody?: string }).__modeAtBody
		);
		expect(atBody).toBe('dark');
		await context.close();
	});

	test('the script that does it is in the head, before the stylesheet, and the CSP allows it', async ({
		request
	}) => {
		const response = await request.get('/');
		const html = await response.text();
		const nonce = response.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];

		expect(nonce).toBeTruthy();
		const script = html.indexOf(`<script nonce="${nonce}">`);
		expect(script).toBeGreaterThan(-1);
		expect(script).toBeLessThan(html.indexOf('rel="stylesheet"'));
	});
});
```

Delete the `'the hero table in the dark theme'` describe from this file; Task 8 re-adds it against the recoloured illustration.

- [ ] **Step 11: Delete the obsolete contrast helper and check**

```bash
git grep -n "theme/contrast\|from './contrast'" -- src e2e
git rm src/lib/theme/contrast.ts
pnpm check && pnpm lint && pnpm test:unit
```

Expected: the grep shows no user other than the old `theme.spec.ts` (already replaced); `check`, `lint` and `test:unit` pass. Fix anything they report (a spec that read the removed tokens, for example).

- [ ] **Step 12: Look at it, then commit**

Run `pnpm dev`, open `/login` in light and dark (toggle in the header). Expected: a Cerberus page background in both modes; unmigrated pages still readable through the bridge.

```bash
pnpm format
git add -A src e2e package.json pnpm-lock.yaml
git commit -m "feat: Skeleton with the Cerberus theme, light and dark by data-mode" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 2: Toast on Skeleton

**Files:**

- Create: `src/lib/toaster.ts`
- Modify: `src/lib/components/Toaster.svelte`, `src/lib/components/Toaster.svelte.spec.ts`, `src/routes/layout.svelte.spec.ts`, `src/routes/tables/[slug]/+page.svelte` (import path only)
- Delete: `src/lib/stores/toast.svelte.ts`, `src/lib/stores/toast.spec.ts`

**Interfaces:**

- Produces (`src/lib/toaster.ts`): `toaster` (Skeleton toaster), `toast: { success(message), pending(message), warning(message), error(message), info(message), dismiss(id?), clear() }`. `pending` is the amber state (a request waiting for the GM), rendered as Skeleton's `warning` type.

- [ ] **Step 1: Write the failing spec**

Replace `src/lib/components/Toaster.svelte.spec.ts`:

```ts
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Toaster from './Toaster.svelte';
import { toast } from '$lib/toaster';

afterEach(() => toast.clear());

describe('Toaster', () => {
	it('shows a message until the reader closes it', async () => {
		render(Toaster);

		toast.success('Mesa salva');

		await expect.element(page.getByText('Mesa salva')).toBeVisible();
		await page.getByRole('button', { name: 'Fechar aviso' }).click();
		await expect.element(page.getByText('Mesa salva')).not.toBeInTheDocument();
	});

	it('shows an error and a pending notice', async () => {
		render(Toaster);

		toast.error('Não deu certo');
		toast.pending('Aguardando o mestre');

		await expect.element(page.getByText('Não deu certo')).toBeVisible();
		await expect.element(page.getByText('Aguardando o mestre')).toBeVisible();
	});
});
```

Run: `pnpm exec vitest run --project client src/lib/components/Toaster.svelte.spec.ts`
Expected: FAIL (`$lib/toaster` does not exist).

- [ ] **Step 2: Create `src/lib/toaster.ts`**

```ts
import { createToaster } from '@skeletonlabs/skeleton-svelte';

export const toaster = createToaster({ placement: 'top-end' });

/** The calls the app already makes, on Skeleton's toaster. */
export const toast = {
	success: (message: string) => toaster.success({ title: message }),
	/** Amber: something is waiting on someone else, such as a request the GM has not answered. */
	pending: (message: string) => toaster.warning({ title: message }),
	warning: (message: string) => toaster.warning({ title: message }),
	error: (message: string) => toaster.error({ title: message, duration: 6000 }),
	info: (message: string) => toaster.info({ title: message }),
	dismiss: (id?: string) => toaster.dismiss(id),
	clear: () => toaster.dismiss()
};
```

- [ ] **Step 3: Rewrite `Toaster.svelte`**

```svelte
<script lang="ts">
	import { Toast } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';
	import { toaster } from '$lib/toaster';
</script>

<Toast.Group {toaster}>
	{#snippet children(toast)}
		<Toast {toast}>
			<Toast.Message>
				<Toast.Title>{toast.title}</Toast.Title>
			</Toast.Message>
			<Toast.CloseTrigger aria-label={m.toast_close()} />
		</Toast>
	{/snippet}
</Toast.Group>
```

- [ ] **Step 4: Move the imports and delete the old store**

```bash
git grep -ln "stores/toast.svelte" -- src
```

In `src/routes/layout.svelte.spec.ts` and `src/routes/tables/[slug]/+page.svelte`, change `import { toast } from '$lib/stores/toast.svelte'` to `import { toast } from '$lib/toaster'`. In the layout spec, if a test reads `toast.toasts` (the old array), replace it with a visible-text assertion: call `toast.success('x')` and expect `page.getByText('x')` visible.

```bash
git rm src/lib/stores/toast.svelte.ts src/lib/stores/toast.spec.ts
```

- [ ] **Step 5: Run and commit**

Run: `pnpm check && pnpm exec vitest run --project client src/lib/components/Toaster.svelte.spec.ts src/routes/layout.svelte.spec.ts`
Expected: PASS.

```bash
pnpm format
git add -A src
git commit -m "feat: toast on Skeleton" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 3: Avatar, account menu and progress bar on Skeleton; remove Bits UI

**Files:**

- Modify: `src/lib/components/Avatar.svelte`, `Avatar.svelte.spec.ts`, `AccountMenu.svelte`, `AccountMenu.svelte.spec.ts`, `src/routes/+layout.svelte`, `src/routes/layout.css` (drop `animate-progress`), `package.json`

**Interfaces:**

- Produces: `Avatar` props `{ src?, name?, size?, color?: 'primary' | 'secondary' | 'tertiary', class? }` (the `color` values were `sage | rose | periwinkle`; `git grep -n "<Avatar" -- src` shows no caller passes `color`).

- [ ] **Step 1: Rewrite `Avatar.svelte` on Skeleton's Avatar**

Keep the `AvatarSize` type, the `size` prop and the `sizeClass` derivation exactly as they are. Replace the imports, the colour logic and the markup:

```svelte
<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';

	type AvatarSize = 28 | 32 | 36 | 40 | 44 | 48 | 64 | 80 | 120;

	interface Props {
		src?: string | null;
		name?: string | null;
		size?: AvatarSize | number;
		color?: 'primary' | 'secondary' | 'tertiary';
		class?: string;
	}

	let { src = null, name = null, size = 36, color, class: className = '' }: Props = $props();

	const colours = {
		primary: 'preset-filled-primary-500',
		secondary: 'preset-filled-secondary-500',
		tertiary: 'preset-filled-tertiary-500'
	} as const;
	const order = ['primary', 'secondary', 'tertiary'] as const;

	const fallbackColorClass = $derived.by(() => {
		if (color) return colours[color];
		if (!name) return colours.primary;
		const code = name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0);
		return colours[order[code % order.length]];
	});

	const initial = $derived((name?.trim()?.[0] || '?').toUpperCase());

	// (sizeClass derivation: unchanged)
</script>

<Avatar
	class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold select-none {sizeClass} {className}"
>
	{#if src}
		<Avatar.Image {src} alt="" aria-hidden="true" class="size-full object-cover" />
	{/if}
	<Avatar.Fallback
		aria-hidden="true"
		class="flex size-full items-center justify-center {fallbackColorClass}"
	>
		{initial}
	</Avatar.Fallback>
</Avatar>
```

Update `Avatar.svelte.spec.ts`: every assertion on `bg-sage`, `bg-rose`, `bg-periwinkle` becomes the matching `preset-filled-primary-500`, `preset-filled-secondary-500`, `preset-filled-tertiary-500`; a test that passed `color: 'sage'` passes `'primary'` (rose to secondary, periwinkle to tertiary). Run `pnpm exec vitest run --project client src/lib/components/Avatar.svelte.spec.ts`. Expected: PASS.

- [ ] **Step 2: Rewrite `AccountMenu.svelte` on Skeleton's Popover**

Keep the props, `locale`, the four links' hrefs and messages, the `data-testid="account-user-name"`, the admin badge logic and the logout form. Change the imports, the wrapper and the classes. Define the shared row class once:

```svelte
<script lang="ts">
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let {
		name,
		avatarUrl,
		isAdmin = false,
		pendingSuggestionsCount = 0
	}: {
		name: string;
		avatarUrl: string | null;
		isAdmin?: boolean;
		pendingSuggestionsCount?: number;
	} = $props();

	const locale = getLocale();
	const item =
		'btn hover:preset-tonal flex h-11 w-full items-center justify-start gap-3 rounded-lg px-3 text-left text-base font-semibold';
</script>

<Popover positioning={{ placement: 'bottom-end', offset: { mainAxis: 8 } }}>
	<Popover.Trigger
		aria-label="{m.nav_account_menu()}: {name}"
		class="btn preset-tonal flex size-11 items-center justify-center rounded-full p-0 md:h-11 md:w-auto md:gap-2.5 md:pr-3 md:pl-1.5"
	>
		<Avatar src={avatarUrl} {name} size={32} />
		<span class="hidden max-w-[14ch] truncate md:inline">{name}</span>
		<!-- chevron svg: unchanged -->
	</Popover.Trigger>

	<Portal>
		<Popover.Positioner class="z-50!">
			<Popover.Content
				class="card border-surface-200-800 bg-surface-100-900 w-[272px] border p-2 shadow-2xl"
			>
				<!-- header: Avatar size 40 + name, unchanged apart from classes -->
				<div class="flex items-center gap-3 p-2.5 pb-3">
					<Avatar src={avatarUrl} {name} size={40} />
					<div class="min-w-0 flex-1">
						<div
							data-testid="account-user-name"
							class="truncate text-[17px] leading-tight font-bold"
						>
							{name}
						</div>
					</div>
				</div>

				<hr class="mx-2 mb-1.5" />

				<nav aria-label={m.nav_account_menu()} class="flex flex-col gap-0.5">
					<a href={localizedHref('/perfil', locale)} class={item}>
						<!-- profile svg: unchanged -->
						{m.nav_profile()}
					</a>
					<a href={localizedHref('/account/tables', locale)} class={item}>
						<!-- tables svg: unchanged -->
						{m.nav_my_tables()}
					</a>
					{#if isAdmin}
						<a href={localizedHref('/admin', locale)} class={item}>
							<!-- admin svg: unchanged -->
							{m.nav_admin()}
							{#if pendingSuggestionsCount > 0}
								<span
									class="badge preset-filled-warning-500 ml-auto min-w-6 rounded-full px-1.5 font-bold"
								>
									{pendingSuggestionsCount}
								</span>
							{/if}
						</a>
					{/if}
					<form method="POST" action="/logout" class="m-0">
						<button type="submit" class={item}>
							<!-- logout svg: unchanged -->
							{m.nav_sign_out()}
						</button>
					</form>
				</nav>
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover>
```

Every `<!-- … svg: unchanged -->` marks the existing inline `<svg>` block in the current file: keep it as it is.

- [ ] **Step 3: Update `AccountMenu.svelte.spec.ts`**

Run `pnpm exec vitest run --project client src/lib/components/AccountMenu.svelte.spec.ts`. The trigger is still a button named `Menu da conta: <name>` (whatever `m.nav_account_menu()` says); the content still contains the links and the sign-out button. Fix assertions that depended on Bits UI internals (a `role="dialog"` wrapper, `data-bits-*` attributes, or the popover being present in the DOM before opening) so that they open the menu with `page.getByRole('button', { name: … }).click()` and assert on the links and the button by role and name.

- [ ] **Step 4: Progress bar in `+layout.svelte`**

Replace the Bits import and block:

```svelte
import {Progress} from '@skeletonlabs/skeleton-svelte';
```

```svelte
{#if navigating.to}
	<Progress value={null} class="fixed inset-x-0 top-0 z-50" aria-label={m.nav_loading()}>
		<Progress.Track class="h-1">
			<Progress.Range />
		</Progress.Track>
	</Progress>
{/if}
```

Then remove the `animate-progress` utility and the `progress-indeterminate` keyframes from `layout.css` (`git grep -n "animate-progress" -- src` must show nothing afterwards).

- [ ] **Step 5: Remove Bits UI and verify**

```bash
pnpm remove bits-ui
git grep -n "bits-ui" -- src package.json
pnpm check && pnpm lint && pnpm test:unit
```

Expected: the grep prints nothing; everything passes. Skeleton's Popover and Toast position themselves with the DOM, so also confirm the CSP still holds:

```bash
pnpm e2e:up
pnpm exec playwright test e2e/security.e2e.ts --project=desktop
```

Expected: PASS with no blocked-style violation. If `security.e2e.ts` reports a blocked `style` attribute from a Skeleton component, stop and tell the user: the `style-src-attr` hash in `vite.config.ts` may need a second entry, which is a security decision, not an implementation detail.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add -A src package.json pnpm-lock.yaml
git commit -m "feat: avatar, account menu and progress bar on Skeleton, drop Bits UI" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 4: Form foundation (codes, message type, helpers, FormField)

**Files:**

- Create: `src/lib/forms/zod-codes.ts`, `src/lib/forms/message.ts`, `src/lib/forms/server.ts`, `src/lib/forms/server.spec.ts`
- Modify: `src/lib/components/FormField.svelte`

**Interfaces:**

- Produces: `FormMessage = { code: string; field?: string; retryAfter?: number }` (`src/lib/forms/message.ts`).
- Produces (`src/lib/forms/server.ts`):
  `withoutSecrets<T extends Record<string, unknown>>(form: SuperValidated<T, FormMessage>, fields: (keyof T)[]): SuperValidated<T, FormMessage>` clears each named field to `''`.
  `refuse<T extends Record<string, unknown>>(form: SuperValidated<T, FormMessage>, status: ErrorStatus, code: string, field?: string)` returns a failure. If `field` is a field of the form, the code becomes that field's error; otherwise it becomes the form message `{ code, field }`.

- [ ] **Step 1: Create `src/lib/forms/zod-codes.ts`**

```ts
import { z } from 'zod';

// A field error is a short code ("too_small", "invalid_format"), not English text: the form turns the
// code into a sentence in the reader's language. An explicit message (a refine that names its own
// code, such as 'mismatch') is kept as it is.
z.config({ customError: (issue) => (issue.code === 'custom' ? undefined : issue.code) });
```

- [ ] **Step 2: Create `src/lib/forms/message.ts`**

```ts
/**
 * What an action tells the form besides field errors. `code` picks a translated sentence; `field`
 * names a field the schema does not have (the image); `retryAfter` is the wait in seconds for a rate limit.
 */
export type FormMessage = { code: string; field?: string; retryAfter?: number };
```

- [ ] **Step 3: Write the failing test `src/lib/forms/server.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import '$lib/forms/zod-codes';
import type { FormMessage } from './message';
import { refuse, withoutSecrets } from './server';

const schema = z.object({ email: z.string().min(3), password: z.string().min(8) });
const filled = () =>
	superValidate<z.infer<typeof schema>, FormMessage>(
		{ email: 'ana@example.com', password: 'a-long-password' },
		zod4(schema)
	);

describe('zod codes', () => {
	it('reports the code of the rule that failed, not English text', async () => {
		const form = await superValidate({ email: 'a', password: 'b' }, zod4(schema));

		expect(form.valid).toBe(false);
		expect(form.errors.email).toEqual(['too_small']);
		expect(form.errors.password).toEqual(['too_small']);
	});
});

describe('withoutSecrets', () => {
	it('empties the named fields and leaves the rest', async () => {
		const form = withoutSecrets(await filled(), ['password']);

		expect(form.data).toEqual({ email: 'ana@example.com', password: '' });
	});
});

describe('refuse', () => {
	it('puts the code on the field it names, when the form has that field', async () => {
		const result = refuse(await filled(), 400, 'invalid', 'email');

		expect(result).toMatchObject({
			status: 400,
			data: { form: { errors: { email: ['invalid'] } } }
		});
	});

	it('puts the code in the form message when the field is not in the schema, or none is named', async () => {
		const image = refuse(await filled(), 400, 'not_an_image', 'image');
		const plain = refuse(await filled(), 429, 'rate_limited');

		expect(image).toMatchObject({
			status: 400,
			data: { form: { message: { code: 'not_an_image', field: 'image' } } }
		});
		expect(plain).toMatchObject({
			status: 429,
			data: { form: { message: { code: 'rate_limited' } } }
		});
	});
});
```

Run: `pnpm exec vitest run --project server src/lib/forms/server.spec.ts`
Expected: FAIL (`./server` does not exist). If the first test fails on something else (`errors.email` holds English text), `zod-codes` is not taking effect: check that the import of `$lib/forms/zod-codes` comes before the schema is used, and that `zod` and Superforms resolve one `zod/v4/core` (`pnpm why zod`).

- [ ] **Step 4: Create `src/lib/forms/server.ts`**

```ts
import { message, setError, type ErrorStatus, type SuperValidated } from 'sveltekit-superforms';
import type { FormMessage } from './message';

type Form<T extends Record<string, unknown>> = SuperValidated<T, FormMessage>;

/** Never send a secret back to the browser: not even when the form is refused. */
export function withoutSecrets<T extends Record<string, unknown>>(
	form: Form<T>,
	fields: (keyof T)[]
) {
	for (const field of fields) (form.data as Record<keyof T, unknown>)[field] = '';
	return form;
}

/**
 * Refuses a submit for a reason that is not a schema rule: the code lands on the field it names
 * (so the form shows it there), or in the form message when the field is not one the schema knows.
 */
export function refuse<T extends Record<string, unknown>>(
	form: Form<T>,
	status: ErrorStatus,
	code: string,
	field?: string
) {
	if (field && field in form.data) return setError(form, field as never, code, { status });
	return message(form, { code, field }, { status });
}
```

- [ ] **Step 5: Run and check types**

Run: `pnpm exec vitest run --project server src/lib/forms/server.spec.ts && pnpm check`
Expected: PASS. If `setError`'s `status` option is rejected by the types, drop the option and return `fail(status, { form })` (import `fail` from `sveltekit-superforms`) after `setError(form, …)`.

- [ ] **Step 6: Restyle `FormField.svelte`**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		label,
		hint,
		error,
		children
	}: { id: string; label: string; hint?: string; error?: string; children: Snippet } = $props();
</script>

<div class="min-w-0">
	<label for={id} class="label-text block font-semibold">{label}</label>
	{#if hint}<p id="{id}-hint" class="text-surface-700-300 text-sm">{hint}</p>{/if}
	<div class="mt-1">{@render children()}</div>
	{#if error}<p id="{id}-error" role="alert" class="text-error-700-300 mt-1 text-sm font-semibold">
			{error}
		</p>{/if}
</div>
```

- [ ] **Step 7: Commit**

```bash
pnpm format
git add -A src
git commit -m "feat: form foundation for Superforms (codes, message type, helpers)" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 5: Auth slice (login, sign-up, forgot and reset password)

**Files:**

- Modify: `src/lib/auth/credentials.ts`, `src/lib/auth/credentials.spec.ts`, `src/lib/components/CredentialsForm.svelte`, `CredentialsForm.svelte.spec.ts`, `ProviderButtons.svelte`, `src/routes/login/+page.server.ts`, `+page.svelte`, `src/routes/signup/+page.server.ts`, `+page.svelte`, `src/routes/forgot-password/+page.server.ts`, `+page.svelte`, `src/routes/reset-password/+page.server.ts`, `+page.svelte`
- Create: `src/lib/components/CredentialsFormHarness.svelte`

**Interfaces:**

- Consumes: `FormMessage`, `withoutSecrets` (Task 4); Skeleton classes.
- Produces (`src/lib/auth/credentials.ts`): `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH`, `credentialsSchema` (`{ email, password, next }`), `emailSchema` (`{ email }`), `newPasswordSchema` (`{ password, passwordConfirm }`, error code `mismatch` on `passwordConfirm`), `type CredentialsData = z.output<typeof credentialsSchema>`. The old `parseCredentials`, `parseEmail`, `parseNewPassword` are removed.
- Produces (`CredentialsForm.svelte`): props `{ mode: 'login' | 'signup'; superform: SuperForm<CredentialsData, FormMessage>; action?: string }`.

- [ ] **Step 1: Rewrite `src/lib/auth/credentials.ts`**

```ts
import '$lib/forms/zod-codes';
import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt, which Supabase uses for passwords, ignores everything after 72 bytes: a longer password
// would be silently shortened, so it is refused instead.
export const MAX_PASSWORD_LENGTH = 72;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
// Not trimmed: spaces are part of what the person chose.
const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

/** Sign-in and sign-up: an email and a password, and where to go afterwards. */
export const credentialsSchema = z.object({
	email,
	password,
	next: z.string().max(2000).default('')
});

/** "Forgot my password": just an email. */
export const emailSchema = z.object({ email });

/** "Choose a new password": 8 to 72 characters, typed twice the same way. */
export const newPasswordSchema = z
	.object({ password, passwordConfirm: z.string() })
	.refine((value) => value.password === value.passwordConfirm, {
		message: 'mismatch',
		path: ['passwordConfirm']
	});

export type CredentialsData = z.output<typeof credentialsSchema>;
```

- [ ] **Step 2: Keep the old tests, pointed at the new schemas**

In `src/lib/auth/credentials.spec.ts` replace the import line `import { parseCredentials, parseEmail, parseNewPassword } from './credentials';` with a local shim that has the old call shape, so every existing test keeps proving the same behaviour:

```ts
import { credentialsSchema, emailSchema, newPasswordSchema } from './credentials';

type Errors = Record<string, string>;
const errorsOf = (issues: { path: PropertyKey[]; message: string }[]) => {
	const errors: Errors = {};
	for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;
	return errors;
};

const parseCredentials = (data: FormData) => {
	const parsed = credentialsSchema.safeParse(Object.fromEntries(data));
	if (!parsed.success) return { ok: false as const, errors: errorsOf(parsed.error.issues) };
	return { ok: true as const, data: { email: parsed.data.email, password: parsed.data.password } };
};

const parseEmail = (data: FormData) => {
	const parsed = emailSchema.safeParse(Object.fromEntries(data));
	if (!parsed.success) return { ok: false as const, errors: errorsOf(parsed.error.issues) };
	return { ok: true as const, data: parsed.data };
};

const parseNewPassword = (data: FormData) => {
	const parsed = newPasswordSchema.safeParse(Object.fromEntries(data));
	if (!parsed.success) return { ok: false as const, errors: errorsOf(parsed.error.issues) };
	return { ok: true as const, data: { password: parsed.data.password } };
};
```

Run: `pnpm exec vitest run --project server src/lib/auth/credentials.spec.ts`
Expected: PASS. If a test compares the exact errors object for a bad email, the code is now `invalid_format` from Zod (`issue.code`); that is the value the old code produced too. Fix a test only if it encoded something that changed on purpose, and say so in the commit message.

- [ ] **Step 3: Rewrite `CredentialsForm.svelte`**

```svelte
<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import FormField from './FormField.svelte';
	import type { CredentialsData } from '$lib/auth/credentials';
	import type { FormMessage } from '$lib/forms/message';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		mode: 'login' | 'signup';
		superform: SuperForm<CredentialsData, FormMessage>;
		action?: string;
	};

	let { mode, superform, action }: Props = $props();
	const { form, errors, message, enhance, delayed } = superform;

	// What Supabase said, as a code from the server.
	const messages: Record<string, () => string> = {
		invalid: m.auth_error_invalid,
		unconfirmed: m.auth_error_unconfirmed,
		weak_password: m.auth_error_weak,
		rate_limited: m.auth_error_rate_limited,
		failed: m.auth_error_failed
	};
</script>

<form method="POST" {action} use:enhance class="grid max-w-sm gap-5">
	{#if $message && messages[$message.code]}
		<p role="alert" class="text-error-700-300 font-semibold">{messages[$message.code]()}</p>
	{/if}

	<input type="hidden" name="next" value={$form.next} />

	<FormField
		id="email"
		label={m.auth_email()}
		error={$errors.email ? m.auth_error_email() : undefined}
	>
		<input
			id="email"
			name="email"
			type="email"
			required
			autocomplete="email"
			bind:value={$form.email}
			class="input"
			aria-invalid={$errors.email ? 'true' : undefined}
		/>
	</FormField>

	<FormField
		id="password"
		label={m.auth_password()}
		hint={mode === 'signup' ? m.auth_password_hint() : undefined}
		error={$errors.password ? m.auth_error_password() : undefined}
	>
		<input
			id="password"
			name="password"
			type="password"
			required
			minlength="8"
			maxlength="72"
			autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
			bind:value={$form.password}
			class="input"
			aria-invalid={$errors.password ? 'true' : undefined}
		/>
	</FormField>

	<div>
		<button type="submit" class="btn preset-filled-primary-500 w-full" aria-busy={$delayed}>
			{mode === 'signup' ? m.signup_submit() : m.login_submit()}
		</button>
	</div>
</form>
```

`ProviderButtons.svelte`: swap the Google style for `preset-outlined-surface-300-700 hover:preset-tonal`, and both links' shared class for `btn w-full justify-center gap-3`, keeping the Discord blurple (`bg-[#5865F2] text-white hover:bg-[#4752c4]`, a brand colour that stays).

- [ ] **Step 4: Create the test harness and rewrite the spec**

`src/lib/components/CredentialsFormHarness.svelte` (test only; `superForm` must be created while a component initialises):

```svelte
<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import CredentialsForm from './CredentialsForm.svelte';
	import { credentialsSchema } from '$lib/auth/credentials';
	import type { FormMessage } from '$lib/forms/message';

	// Test only: the form component takes a `superForm`, which has to be created inside a component.
	type Props = {
		mode: 'login' | 'signup';
		next?: string;
		email?: string;
		message?: FormMessage;
		errors?: { email?: string[]; password?: string[] };
		action?: string;
	};
	let { mode, next = '/', email = '', message, errors, action }: Props = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(defaults({ email, password: '', next }, zod4(credentialsSchema)), {
		validators: zod4Client(credentialsSchema)
	});
	// svelte-ignore state_referenced_locally
	if (message) superform.message.set(message);
	// svelte-ignore state_referenced_locally
	if (errors) superform.errors.set(errors);
</script>

<CredentialsForm {mode} {superform} {action} />
```

Rewrite `CredentialsForm.svelte.spec.ts` so it renders `CredentialsFormHarness` instead of `CredentialsForm`, keeping each existing test, with these changes: `render(CredentialsFormHarness, { ...props, mode: 'login', action: '?/email' })`; the `next` prop becomes the harness `next`; the "result" tests pass `message: { code: result }`; the "marks the field that is wrong" test passes `errors: { email: ['invalid_format'], password: ['too_small'] }`. Add one test that a password typed and then refused is not refilled:

```ts
it('empties the password field when the server sends the form back', async () => {
	render(CredentialsFormHarness, { ...props, mode: 'login', message: { code: 'invalid' } });

	await expect.element(page.getByLabelText('Senha')).toHaveValue('');
});
```

Run: `pnpm exec vitest run --project client src/lib/components/CredentialsForm.svelte.spec.ts`
Expected: PASS. If it fails with an error from `$app/stores` or `$app/navigation` (Superforms imports them), add at the top of the spec `vi.mock('$app/stores', …)` and `vi.mock('$app/navigation', …)` returning `readable` stores for `page` (`{ url: new URL('http://localhost/'), form: null, data: {}, status: 200, error: null, params: {}, route: { id: null }, state: {} }`) and `navigating` (`null`), and no-op functions for `beforeNavigate`, `afterNavigate`, `goto`, `invalidateAll`. Keep the mock in this spec only.

- [ ] **Step 5: Login server**

`src/routes/login/+page.server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { credentialsSchema } from '$lib/auth/credentials';
import { withoutSecrets } from '$lib/forms/server';
import { signInWithEmail, type SignInResult } from '$lib/server/auth/email';
import { safeNext } from '$lib/server/auth/safe-next';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (await locals.getUser()) redirect(303, next);

	// The `error` value picks one of a few fixed messages; it is never shown itself, so it cannot be used to inject text.
	return {
		next,
		failed: url.searchParams.has('error'),
		confirmHint: url.searchParams.get('error') === 'exchange_failed',
		form: await superValidate({ next }, zod4(credentialsSchema), { errors: false })
	};
};

const STATUS = {
	invalid: 400,
	unconfirmed: 400,
	failed: 500,
	rate_limited: 429
} as const satisfies Record<Exclude<SignInResult, 'ok'>, number>;

export const actions: Actions = {
	// Email and password. Supabase checks them; a wrong email and a wrong password look the same.
	email: async ({ request, locals }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form = await superValidate(request, zod4(credentialsSchema));
		const next = safeNext(form.data.next);
		const { email, password } = form.data;
		// Only the email is handed back to refill the form, never the password.
		withoutSecrets(form, ['password']);
		if (!form.valid) return fail(400, { form });

		const result = await signInWithEmail(
			{ supabase: locals.supabase, db: locals.db, log: locals.log },
			{ email, password }
		);
		if (result !== 'ok') return message(form, { code: result }, { status: STATUS[result] });

		redirect(303, next);
	}
};
```

If `pnpm check` reports that the form's message type is `any` (so `message(form, { code: result }, …)` is not checked against `FormMessage`), annotate the variable: `const form: SuperValidated<CredentialsData, FormMessage> = await superValidate(request, zod4(credentialsSchema));` (import `type SuperValidated` from `sveltekit-superforms`, `type CredentialsData` from `$lib/auth/credentials`, and `type FormMessage` from `$lib/forms/message`). Do the same in the other actions if they report it.

- [ ] **Step 6: Login page**

`src/routes/login/+page.svelte`: change the script and the form call; restyle the classes with the cheat sheet (the hero panel becomes `bg-primary-500 text-primary-contrast-500`, the card shell `border border-surface-200-800 bg-surface-100-900`, links `anchor`, `text-lamp` heading kicker `text-warning-700-300`, the divider spans `bg-surface-300-700`). The behaviour changes are:

```svelte
<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { resolve } from '$app/paths';
	import CredentialsForm from '$lib/components/CredentialsForm.svelte';
	import ProviderButtons from '$lib/components/ProviderButtons.svelte';
	import TableIllustration from '$lib/components/TableIllustration.svelte';
	import { credentialsSchema } from '$lib/auth/credentials';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(data.form, { validators: zod4Client(credentialsSchema) });
</script>
```

```svelte
<CredentialsForm mode="login" {superform} action="?/email" />
```

(The page no longer uses the `form` prop.)

- [ ] **Step 7: Sign-up server and page**

`src/routes/signup/+page.server.ts`: same imports as login plus `signUpWithEmail`. `load` adds `form: await superValidate({ next }, zod4(credentialsSchema), { errors: false })` to its return. The action:

```ts
const STATUS = {
	weak_password: 400,
	failed: 500,
	rate_limited: 429
} as const satisfies Record<Exclude<SignUpResult, 'signed_in' | 'check_email'>, number>;

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form = await superValidate(request, zod4(credentialsSchema));
		const next = safeNext(form.data.next);
		const { email, password } = form.data;
		withoutSecrets(form, ['password']);
		if (!form.valid) return fail(400, { form });

		const result = await signUpWithEmail(
			{ supabase: locals.supabase, db: locals.db, log: locals.log },
			{ email, password, origin: url.origin, next }
		);

		if (result === 'signed_in') redirect(303, next);
		// Says the same whether or not the address already had an account.
		if (result === 'check_email') return message(form, { code: 'check_email' });

		return message(form, { code: result }, { status: STATUS[result] });
	}
};
```

`src/routes/signup/+page.svelte`: create the `superform` as in login, read `const { message } = superform;`, and replace `form?.checkEmail` with `$message?.code === 'check_email'`. Pass `{superform}` to `<CredentialsForm mode="signup" {superform} />`. Restyle with the cheat sheet.

- [ ] **Step 8: Forgot-password server and page**

Server: `load` returns `{ linkExpired: url.searchParams.has('error'), form: await superValidate(zod4(emailSchema)) }`. Action:

```ts
export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form = await superValidate(request, zod4(emailSchema));
		if (!form.valid) return fail(400, { form });

		const result = await requestPasswordReset(
			{ supabase: locals.supabase, log: locals.log },
			{ email: form.data.email, origin: url.origin }
		);

		// The same answer whether or not the address has an account.
		if (result === 'sent') return message(form, { code: 'sent' });
		return message(form, { code: result }, { status: result === 'rate_limited' ? 429 : 500 });
	}
};
```

Page: create `const { form, errors, message, enhance, delayed } = superForm(data.form, { validators: zod4Client(emailSchema) })`; show the "sent" view when `$message?.code === 'sent'`; the alert shows `m.auth_error_rate_limited()` for `rate_limited` and `m.auth_error_failed()` for any other message code; the input is `bind:value={$form.email}` with class `input`; the submit is `btn preset-filled-primary-500 w-full`; links use `anchor`.

- [ ] **Step 9: Reset-password server and page**

Server: `load` returns `{ done: url.searchParams.has('done'), form: await superValidate(zod4(newPasswordSchema)) }` after the existing session check. Action:

```ts
const STATUS = {
	weak_password: 400,
	same_password: 400,
	rate_limited: 429,
	failed: 500
} as const satisfies Record<Exclude<ChangePasswordResult, 'ok' | 'no_session'>, number>;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.supabase || !(await locals.getUser())) redirect(303, '/forgot-password?error=link');

		const form = await superValidate(request, zod4(newPasswordSchema));
		const { password } = form.data;
		// Nothing typed is handed back: not even the password's length.
		withoutSecrets(form, ['password', 'passwordConfirm']);
		if (!form.valid) return fail(400, { form });

		const result = await changePassword(
			{ supabase: locals.supabase, log: locals.log },
			{ password }
		);

		if (result === 'ok') redirect(303, '/reset-password?done=1');
		if (result === 'no_session') redirect(303, '/forgot-password?error=link');

		return message(form, { code: result }, { status: STATUS[result] });
	}
};
```

Page: same `superForm` pattern; `problem` is derived from `$message?.code` exactly as the old `form?.result` was (`weak_password` to `m.auth_error_weak()`, `same_password` to `m.auth_error_same()`, `rate_limited` to `m.auth_error_rate_limited()`, any other code to `m.auth_error_failed()`); the password error text is `m.auth_error_password()` when `$errors.password` is set, the confirm error text is `m.auth_error_mismatch()` when `$errors.passwordConfirm` is set; inputs use `bind:value={$form.password}` and `bind:value={$form.passwordConfirm}` with class `input`.

- [ ] **Step 10: Verify the slice**

Run: `pnpm check && pnpm lint && pnpm test:unit`
Expected: PASS. Then the flows, against the local stack:

```bash
pnpm e2e:up
pnpm exec playwright test e2e/login.e2e.ts e2e/auth-flows.e2e.ts
```

Expected: PASS. An e2e failure here is most likely a selector that named an old class or a text that moved; fix the selector, not the behaviour. A failure where the password field comes back filled, or a wrong password shows no message, is a real bug in Steps 5 to 9.

- [ ] **Step 11: Commit**

```bash
pnpm format
git add -A src e2e
git commit -m "feat: sign-in, sign-up and password forms on Superforms and Skeleton" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 6: Registrations and ratings (join, leave, approve, decline, remove, rate)

**Files:**

- Create: `src/lib/tables/registration.ts`, `src/lib/tables/registration-errors.ts`, `src/lib/components/ActionForm.svelte`, `src/lib/components/ActionForm.svelte.spec.ts`
- Modify: `src/lib/tables/rating.ts`, `rating.spec.ts`, `src/lib/server/registrations/form-action.ts`, `form-action.spec.ts`, `src/routes/tables/[slug]/+page.server.ts`, `+page.svelte`, `src/lib/components/PlayingCard.svelte`, `RunningCard.svelte` and their specs

**Interfaces:**

- Consumes: `FormMessage` (Task 4); `toast` (Task 2); `failFrom`, `RateLimited` (`src/lib/server/errors.ts`, unchanged).
- Produces (`src/lib/tables/registration.ts`): `actionSchema = z.object({ playerId: z.guid().optional(), next: z.string().max(2000).default('') })`, `tableActionSchema = z.object({ next })`, `playerActionSchema = actionSchema.required({ playerId: true })`.
- Produces (`src/lib/tables/rating.ts`): `ratingSchema` (`{ tableScore, gmScore, comment }`), `RatingInput` (unchanged type). `parseRatingForm` is removed.
- Produces (`registration-errors.ts`): `registrationError(code: string, retryAfter?: number): string`.
- Produces (`runRegistrationAction`): `runRegistrationAction<T extends Record<string, unknown>>(event: Event, schema: z.ZodType<T>, run: (db, actor, data: T) => Promise<{ eventIds: string[] }>)`. `Event` keeps `setHeaders?`. A refused form or a domain error answers `message(form, { code, field?, retryAfter? }, { status })`.
- Produces (`ActionForm.svelte`): props `{ action: string; playerId?: string; next?: string; class?: string; onsuccess?: () => void; onfail?: (message: FormMessage) => void; children: Snippet }`. It renders the same DOM the plain forms did: `<form method="POST" action>`, hidden `playerId` and `next` inputs when given, then the children (the button).

- [ ] **Step 1: Schemas**

`src/lib/tables/registration.ts`:

```ts
import '$lib/forms/zod-codes';
import { z } from 'zod';

const next = z.string().max(2000).default('');

/** Every button-only action: which player it is about (when it is about one), and where to come back to. */
export const actionSchema = z.object({ playerId: z.guid().optional(), next });

/** Join and leave: the table is in the address, so the form carries only where to come back to. */
export const tableActionSchema = z.object({ next });

/** Approve, decline and remove: the player the GM is acting on. */
export const playerActionSchema = actionSchema.required({ playerId: true });
```

`src/lib/tables/rating.ts`: replace the `form` const and `parseRatingForm` with an exported schema, keeping `MAX_COMMENT_LENGTH` and `RatingInput`:

```ts
import '$lib/forms/zod-codes';
import { z } from 'zod';

export const MAX_COMMENT_LENGTH = 1000;

const score = z.coerce.number().int().min(1).max(5);

export const ratingSchema = z.object({
	tableScore: score,
	gmScore: score,
	comment: z.string().trim().max(MAX_COMMENT_LENGTH).default('')
});

export type RatingInput = { tableScore: number; gmScore: number; comment: string | null };
```

`rating.spec.ts`: replace the `parseRatingForm` import with this shim so the existing tests keep their meaning:

```ts
import { ratingSchema } from './rating';

const parseRatingForm = (data: FormData) => {
	const parsed = ratingSchema.safeParse(Object.fromEntries(data));
	if (!parsed.success) {
		const errors: Record<string, string> = {};
		for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
		return { ok: false as const, errors };
	}
	const { comment, ...scores } = parsed.data;
	return { ok: true as const, data: { ...scores, comment: comment || null } };
};
```

Run: `pnpm exec vitest run --project server src/lib/tables/rating.spec.ts`
Expected: PASS.

`src/lib/tables/registration-errors.ts`:

```ts
import { m } from '$lib/paraglide/messages';
import { formatWait } from './format';

/** What went wrong with a seat action, as a sentence. The code is the one the server put in the form message. */
export function registrationError(code: string, retryAfter?: number): string {
	switch (code) {
		case 'rate_limited':
			return m.error_rate_limited({ wait: formatWait(retryAfter ?? 60) });
		case 'table_full':
			return m.table_error_full();
		case 'already_registered':
			return m.table_error_already();
		case 'forbidden':
			return m.table_error_forbidden();
		case 'too_early':
			return m.table_error_too_early();
		case 'invalid':
			return m.table_error_invalid();
		default:
			return m.table_error_other();
	}
}
```

- [ ] **Step 2: Write the failing server spec**

In `src/lib/server/registrations/form-action.spec.ts` (current version, with `RateLimited` and `setHeaders`): import `tableActionSchema` from `$lib/tables/registration`, pass it as the second argument of every call (`runRegistrationAction(event(), tableActionSchema, run)`), and change the assertions that named the old shapes:

```ts
// runs the operation ... then goes back to the page
expect(run).toHaveBeenCalledWith({ fake: 'db' }, profile, { next: '' });

// the domain-error table
expect(result).toMatchObject({ status, data: { form: { message: { code } } } });

// RateLimited
expect(result).toMatchObject({
	status: 429,
	data: { form: { message: { code: 'rate_limited', retryAfter: 90 } } }
});
expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '90' });
```

Add:

```ts
it('refuses a request whose fields are not valid, and runs nothing', async () => {
	const { event } = setup();
	const run = vi.fn();

	const result = await runRegistrationAction(
		event({ playerId: 'not-a-uuid' }),
		playerActionSchema,
		run
	);

	expect(result).toMatchObject({
		status: 400,
		data: { form: { message: { code: 'invalid' }, errors: { playerId: expect.any(Array) } } }
	});
	expect(run).not.toHaveBeenCalled();
});

it('hands the run the validated fields', async () => {
	const { event } = setup();
	const run = vi.fn().mockResolvedValue({ eventIds: [] });
	const playerId = '11111111-1111-4111-8111-111111111111';

	await runRegistrationAction(event({ playerId }), playerActionSchema, run).catch(() => {});

	expect(run).toHaveBeenCalledWith({ fake: 'db' }, expect.anything(), { playerId, next: '' });
});
```

(import `playerActionSchema` too.) Run: `pnpm exec vitest run --project server src/lib/server/registrations/form-action.spec.ts`
Expected: FAIL (the function still takes two arguments).

- [ ] **Step 3: Rewrite `runRegistrationAction`**

`src/lib/server/registrations/form-action.ts`:

```ts
import { error, redirect } from '@sveltejs/kit';
import { message, superValidate, type ErrorStatus } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';
import type { AnyDb } from '../db/client';
import type { Actor } from '../auth/policy';
import { safeNext } from '../auth/safe-next';
import { RateLimited, failFrom } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';

type Event = {
	locals: App.Locals;
	url: URL;
	request: Request;
	platform?: App.Platform;
	setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * What every join, leave, approve, decline, remove and rate action shares: an anonymous visitor goes
 * to log in; the fields are validated against `schema`; the operation runs as the signed-in player;
 * the events it wrote are dispatched after the response; then the browser goes back to the page. A
 * refused form or a domain error (a full table, a refused permission) becomes a form message the
 * page can show; anything else is a bug and surfaces.
 */
export async function runRegistrationAction<T extends Record<string, unknown>>(
	event: Event,
	schema: z.ZodType<T>,
	run: (db: AnyDb, actor: Actor | null, data: T) => Promise<{ eventIds: string[] }>
) {
	const { locals, url, request } = event;
	if (!(await locals.getUser())) {
		// The page itself, not the `?/join` action address, which only makes sense as a POST.
		redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	}
	if (!locals.db) error(503, 'Database not configured');

	const form = await superValidate(request, zod4(schema));
	if (!form.valid) return message(form, { code: 'invalid' }, { status: 400 });

	try {
		const { eventIds } = await run(locals.db, await locals.getProfile(), form.data);
		for (const id of eventIds)
			locals.afterResponse((db) => dispatchEvent(db, handlersFor(event.platform?.env), id));
	} catch (e) {
		if (e instanceof RateLimited) {
			event.setHeaders?.({ 'Retry-After': String(e.retryAfterSeconds) });
		}
		const failure = failFrom(e);
		return message(
			form,
			{
				code: failure.data.error,
				field: 'field' in failure.data ? failure.data.field : undefined,
				retryAfter: 'retryAfter' in failure.data ? failure.data.retryAfter : undefined
			},
			{ status: failure.status as ErrorStatus }
		);
	}

	// Back to where the form was: the table page, or the dashboard when it names itself in `next`.
	redirect(303, safeNext(String(form.data.next ?? ''), url.pathname));
}
```

Run: `pnpm exec vitest run --project server src/lib/server/registrations/form-action.spec.ts && pnpm check`
Expected: PASS. If `pnpm check` rejects `form.data.next` (the schema may have no `next`), read it as `(form.data as Record<string, unknown>).next`.

- [ ] **Step 4: Table page server**

`src/routes/tables/[slug]/+page.server.ts`: add imports `superValidate` and `zod4`, `ratingSchema`, `tableActionSchema`, `playerActionSchema`; drop `Invalid`, `parseRatingForm` and `playerIdOf`. In `load`, add to the returned object:

```ts
ratingForm: await superValidate(
	mine
		? { tableScore: mine.tableScore, gmScore: mine.gmScore, comment: mine.comment ?? '' }
		: {},
	zod4(ratingSchema),
	{ errors: false }
),
```

Replace the actions:

```ts
export const actions: Actions = {
	join: (event) =>
		runRegistrationAction(event, tableActionSchema, (db, actor) =>
			joinTable(db, actor, event.params.slug)
		),
	leave: (event) =>
		runRegistrationAction(event, tableActionSchema, (db, actor) =>
			leaveTable(db, actor, event.params.slug)
		),
	approve: (event) =>
		runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
			approveRegistration(db, actor, event.params.slug, playerId)
		),
	decline: (event) =>
		runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
			declineRegistration(db, actor, event.params.slug, playerId)
		),
	rate: (event) =>
		runRegistrationAction(event, ratingSchema, (db, actor, data) =>
			submitRating(db, actor, event.params.slug, {
				tableScore: data.tableScore,
				gmScore: data.gmScore,
				comment: data.comment || null
			})
		),
	remove: (event) =>
		runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
			removePlayer(db, actor, event.params.slug, playerId)
		)
};
```

- [ ] **Step 5: Write the failing `ActionForm` spec**

`src/lib/components/ActionForm.svelte.spec.ts`:

```ts
import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ActionForm from './ActionForm.svelte';

const button = createRawSnippet(() => ({
	render: () => '<button type="submit">Sair da mesa</button>'
}));
const formOf = () => page.getByRole('button', { name: 'Sair da mesa' }).element().closest('form')!;

describe('ActionForm', () => {
	it('is a plain POST to its action, so it works without JavaScript', async () => {
		render(ActionForm, { action: '/tables/mesa?/leave', children: button });

		expect(formOf().method).toBe('post');
		expect(formOf().getAttribute('action')).toBe('/tables/mesa?/leave');
	});

	it('carries the player and where to come back to in hidden fields', async () => {
		render(ActionForm, {
			action: '?/remove',
			playerId: '11111111-1111-4111-8111-111111111111',
			next: '/account/tables',
			children: button
		});

		const field = (name: string) => formOf().querySelector<HTMLInputElement>(`input[name=${name}]`);
		expect(field('playerId')?.value).toBe('11111111-1111-4111-8111-111111111111');
		expect(field('next')?.value).toBe('/account/tables');
	});

	it('sends no hidden field it was not given', async () => {
		render(ActionForm, { action: '?/leave', children: button });

		expect(formOf().querySelector('input[name=playerId]')).toBeNull();
		expect(formOf().querySelector('input[name=next]')).toBeNull();
	});
});
```

Run: `pnpm exec vitest run --project client src/lib/components/ActionForm.svelte.spec.ts`
Expected: FAIL (component missing).

- [ ] **Step 6: Create `ActionForm.svelte`**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import type { FormMessage } from '$lib/forms/message';
	import { actionSchema } from '$lib/tables/registration';
	import { registrationError } from '$lib/tables/registration-errors';
	import { toast } from '$lib/toaster';

	type Props = {
		/** Where to post: `?/leave` on the table's own page, or the table's address plus `?/leave` from elsewhere. */
		action: string;
		playerId?: string;
		next?: string;
		class?: string;
		/** Runs when the action went through (the server answered with a redirect back to the page). */
		onsuccess?: () => void;
		/** Runs when the server refused, after the error is shown as a toast. */
		onfail?: (message: FormMessage) => void;
		children: Snippet;
	};

	let {
		action,
		playerId,
		next = '',
		class: className = '',
		onsuccess,
		onfail,
		children
	}: Props = $props();

	// A button-only form: the server validates, so the browser has nothing to check. Each form on a
	// page needs its own id.
	// svelte-ignore state_referenced_locally
	const { enhance } = superForm<{ playerId?: string; next: string }, FormMessage>(
		// svelte-ignore state_referenced_locally
		defaults({ playerId, next }, zod4(actionSchema)),
		{
			// svelte-ignore state_referenced_locally
			id: `${action}:${playerId ?? ''}`,
			resetForm: false,
			onResult({ result }) {
				if (result.type === 'redirect') onsuccess?.();
			},
			onUpdated({ form }) {
				if (form.valid || !form.message) return;
				toast.error(registrationError(form.message.code, form.message.retryAfter));
				onfail?.(form.message);
			}
		}
	);
</script>

<form method="POST" {action} use:enhance class={className}>
	{#if playerId}<input type="hidden" name="playerId" value={playerId} />{/if}
	{#if next}<input type="hidden" name="next" value={next} />{/if}
	{@render children()}
</form>
```

Run: `pnpm exec vitest run --project client src/lib/components/ActionForm.svelte.spec.ts && pnpm check`
Expected: PASS. If the spec fails inside Superforms on `$app/stores` or `$app/navigation`, use the same per-spec `vi.mock` stubs described in Task 5 Step 4. If `superForm`'s generic arguments are rejected, drop the explicit `<…>` and let it infer from `defaults(...)`.

- [ ] **Step 7: Use `ActionForm` in the cards**

`PlayingCard.svelte`, the leave form:

```svelte
<ActionForm action="{page}?/leave" {next} class="mt-4">
	<button type="submit" class="btn preset-outlined-primary-500">
		{item.status === 'pending' ? m.table_cancel_request() : m.table_leave()}
	</button>
</ActionForm>
```

`RunningCard.svelte`: the approve/decline loop and the remove form become:

```svelte
{#each [['approve', m.table_approve(), 'preset-tonal-primary'], ['decline', m.table_decline(), 'preset-tonal-error']] as [action, label, tone] (action)}
	<ActionForm action="{page}?/{action}" playerId={request.playerId} {next}>
		<button type="submit" class="btn btn-sm {tone}">{label}</button>
	</ActionForm>
{/each}
```

```svelte
<ActionForm action="{page}?/remove" playerId={player.playerId} {next}>
	<button type="submit" class="btn btn-sm preset-tonal-error">{m.table_remove()}</button>
</ActionForm>
```

Import `ActionForm from './ActionForm.svelte'` in both, delete the unused `button` const, and restyle the rest of both cards with the cheat sheet (`article` becomes `card border border-surface-200-800 bg-surface-100-900 p-4`; list rows `rounded bg-surface-200-800 p-2`; the pending badge `badge preset-filled-warning-500`; the seat badge `badge preset-filled-primary-500`; links `anchor`). Run `pnpm exec vitest run --project client src/lib/components/PlayingCard.svelte.spec.ts src/lib/components/RunningCard.svelte.spec.ts` and fix any assertion that named a removed class; the forms' method, action and hidden fields are unchanged.

- [ ] **Step 8: Table page (`+page.svelte`)**

Imports: remove `enhance` from `$app/forms`; add `superForm`, `zod4Client`, `ActionForm`, `ratingSchema`, `registrationError`, `type FormMessage`. Replace the `$effect` that toasted `form.error` and the inline alert with one derived problem shown in the same alert element, so both the JS and no-JS paths show it:

```ts
let { data, form } = $props();

// What the last seat action answered: from a submit with JavaScript (`onfail`), or from the page the server sent back without it.
let failed = $state<FormMessage | null>(null);
const problem = $derived(failed ?? form?.form?.message ?? null);
```

```svelte
{#if problem}
	<p role="alert" class="text-error-700-300 mt-4 max-w-[44ch] font-semibold">
		{registrationError(problem.code, problem.retryAfter)}
	</p>
{/if}
```

(`form?.form?.message` is the message of the `SuperValidated` the action returned; `pnpm check` will show the exact type. The previous inline alert and the `formatWait` import both go: `registrationError` does that mapping now.)

Replace each button-only form:

```svelte
<ActionForm action="?/leave" class="mt-3" onfail={(message) => (failed = message)}>
	<button type="submit" class="btn preset-outlined-primary-500">{m.table_leave()}</button>
</ActionForm>
```

The same for `?/leave` with `m.table_cancel_request()`, and for the GM list:

```svelte
<ActionForm action="?/remove" playerId={player.playerId} onfail={(message) => (failed = message)}>
	<button type="submit" class="btn btn-sm preset-tonal-error">{m.table_remove()}</button>
</ActionForm>
```

`?/approve` (button `btn btn-sm preset-tonal-primary`) and `?/decline` (`btn btn-sm preset-tonal-error`) follow the same shape. The join form keeps its success toasts:

```svelte
<ActionForm
	action="?/join"
	onfail={(message) => (failed = message)}
	onsuccess={() =>
		table.joinMode === 'approval'
			? toast.pending(m.toast_pending())
			: toast.success(m.toast_confirmed())}
>
	<button type="submit" class="btn preset-filled-primary-500">
		{table.joinMode === 'approval' ? m.table_join_request() : m.table_join_now()}
	</button>
</ActionForm>
```

The rating form becomes a page-level `superForm`:

```ts
// svelte-ignore state_referenced_locally
const rating = superForm(data.ratingForm, {
	validators: zod4Client(ratingSchema),
	resetForm: false,
	onResult({ result }) {
		if (result.type === 'redirect') toast.success(m.toast_rating_saved());
	},
	onUpdated({ form: updated }) {
		if (updated.valid || !updated.message) return;
		toast.error(registrationError(updated.message.code, updated.message.retryAfter));
		failed = updated.message;
	}
});
const { form: ratingValues, errors: ratingErrors, enhance: ratingEnhance } = rating;

const scoreFields = $derived([
	{ name: 'tableScore', label: m.rating_the_table() },
	{ name: 'gmScore', label: m.rating_the_gm() }
] as const);
```

```svelte
<form method="POST" action="?/rate" use:ratingEnhance class="mt-4 grid gap-6">
	{#each scoreFields as { name, label } (name)}
		<fieldset>
			<legend class="font-semibold">{label}</legend>
			<div class="mt-2 flex flex-wrap gap-3">
				{#each [1, 2, 3, 4, 5] as score (score)}
					<label class="flex items-center gap-1">
						<input type="radio" {name} value={score} required bind:group={$ratingValues[name]} />
						<span aria-label={m.rating_score_label({ score })}>{score}</span>
					</label>
				{/each}
			</div>
			{#if $ratingErrors[name]}
				<p role="alert" class="text-error-700-300 mt-1 text-sm font-semibold">
					{m.table_error_invalid()}
				</p>
			{/if}
		</fieldset>
	{/each}

	<div>
		<label for="comment" class="label-text block font-semibold">{m.rating_comment()}</label>
		<textarea
			id="comment"
			name="comment"
			rows="3"
			maxlength="1000"
			bind:value={$ratingValues.comment}
			class="textarea mt-1"></textarea>
	</div>

	<div>
		<button type="submit" class="btn preset-filled-primary-500">
			{data.myRating ? m.rating_update() : m.rating_submit()}
		</button>
	</div>
</form>
```

Restyle the rest of the page with the cheat sheet (badge `chip preset-filled-primary-500`, seats `text-warning-700-300`, the login link `btn preset-filled-primary-500`, list rows `card border border-surface-200-800 bg-surface-100-900 p-3`, `text-link` to `anchor`, the description image `rounded-container`).

- [ ] **Step 9: Verify the slice**

Run: `pnpm check && pnpm lint && pnpm test:unit`
Expected: PASS. Then against the local stack:

```bash
pnpm e2e:up
pnpm exec playwright test e2e/tables-play.e2e.ts e2e/rate-limit.e2e.ts
```

Expected: PASS. Watch the join, leave, approve, decline, remove and rate flows and the 429 message ("Você fez isso muitas vezes…"): they must still redirect back to the page, show the toast, and (without a script) show the inline alert.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add -A src e2e
git commit -m "feat: seat actions and ratings on Superforms and Skeleton" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 7: Table form (create and edit)

**Files:**

- Modify: `src/lib/tables/schema.ts`, `schema.spec.ts`, `src/lib/tables/form-values.ts`, `src/lib/server/tables/form-action.ts`, `form-action.spec.ts`, `src/lib/components/TableForm.svelte`, `TableForm.svelte.spec.ts`, `src/routes/tables/new/+page.server.ts`, `+page.svelte`, `src/routes/tables/[slug]/edit/+page.server.ts`, `+page.svelte`
- Create: `src/lib/components/TableFormHarness.svelte`

**Interfaces:**

- Consumes: `FormMessage`, `refuse` (Task 4); `ActionForm` (Task 6) for the disable button.
- Produces (`schema.ts`): `tableFormSchema` (the form fields, with `capacity` and `durationMinutes` as numbers), `toTableInput(values: z.output<typeof tableFormSchema>): TableInput`, `TABLE_LIMITS`, `TableInput` (unchanged). `parseTableForm` and `FormErrors` are removed.
- Produces (`form-values.ts`): `type TableFormValues = z.output<typeof tableFormSchema>`, `NEW_TABLE_VALUES: TableFormValues`, `errorText(code, field)` (unchanged), `formProblem(message: FormMessage | undefined): string | null`.
- Produces (`handleTableForm`): `handleTableForm(event: Event, save, guard = async () => {})` with `Event = { request, locals, url, setHeaders? }`, returning a failure whose data is `{ form }`. Failures: invalid fields → 400 field errors; `Invalid(field, code)` → `refuse(form, 400, code, field)`; `Forbidden` → message `forbidden` (403); `NotFound` → message `not_found` (404); `RateLimited` → header `Retry-After` and message `{ code: 'rate_limited', retryAfter }` (429).
- Produces (`TableForm.svelte`): props `{ superform: SuperForm<TableFormValues, FormMessage>; systems; submitLabel; imageUrl?; action? }`.

- [ ] **Step 1: Schema**

In `src/lib/tables/schema.ts`: add `import '$lib/forms/zod-codes';` at the top; rename the `const form = z.object(…)…superRefine(…)` to `export const tableFormSchema` (unchanged body); delete `FormErrors` and `parseTableForm`; add:

```ts
const RULES = { weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2' } as const;
```

(keep it where it is, above the schema) and:

```ts
/** The validated form as what the domain wants: a repeat rule instead of a word, no empty strings. */
export function toTableInput(values: z.output<typeof tableFormSchema>): TableInput {
	const { repeat, until, extraInfo, ...rest } = values;
	const campaign = rest.kind === 'campaign';

	return {
		...rest,
		extraInfo: extraInfo || null,
		recurrence: campaign ? RULES[repeat as keyof typeof RULES] : null,
		untilLocalDate: campaign && until ? until : null
	};
}
```

In `schema.spec.ts` replace `import { parseTableForm } from './schema';` with:

```ts
import { tableFormSchema, toTableInput } from './schema';

const parseTableForm = (data: FormData) => {
	const parsed = tableFormSchema.safeParse(Object.fromEntries(data));
	if (parsed.success) return { ok: true as const, data: toTableInput(parsed.data) };

	const errors: Record<string, string> = {};
	for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
	return { ok: false as const, errors };
};
```

Run: `pnpm exec vitest run --project server src/lib/tables/schema.spec.ts`
Expected: PASS (every existing case keeps its meaning: errors are still `issue.code` for schema rules and the explicit code for the refines).

- [ ] **Step 2: `form-values.ts`**

Replace `FormValues` and `NEW_TABLE_VALUES`, keep `errorText`, add `formProblem`:

```ts
import type { z } from 'zod';
import type { FormMessage } from '$lib/forms/message';
import { m } from '$lib/paraglide/messages';
import { formatWait } from './format';
import type { tableFormSchema } from './schema';

/** What the form holds: the schema's values, with the numbers as numbers. */
export type TableFormValues = z.output<typeof tableFormSchema>;

export const NEW_TABLE_VALUES: TableFormValues = {
	systemSlug: '',
	title: '',
	description: '',
	extraInfo: '',
	kind: 'one_shot',
	capacity: 5,
	startsAtLocal: '',
	timezone: 'America/Sao_Paulo',
	durationMinutes: 240,
	repeat: 'weekly',
	until: '',
	joinMode: 'auto'
};

/** The sentence for a problem that is about the whole form, not one field; null when there is none. */
export function formProblem(message: FormMessage | undefined): string | null {
	if (!message || message.field) return null;
	if (message.code === 'forbidden') return m.form_error_forbidden();
	if (message.code === 'rate_limited') {
		return m.error_rate_limited({ wait: formatWait(message.retryAfter ?? 60) });
	}
	return m.form_error_unavailable();
}
```

(The existing `errorText` function follows, unchanged.)

- [ ] **Step 3: Write the failing `handleTableForm` spec changes**

`src/lib/server/tables/form-action.spec.ts` keeps `setup`, `request`, `run`, `guard` and `setHeaders` as they are. Change the expectations that named the old failure shape:

```ts
// answers 400 with every field error and gives the typed values back
expect(result).toMatchObject({
	status: 400,
	data: {
		form: {
			errors: { title: expect.any(Array), capacity: expect.any(Array) },
			data: { title: 'x' }
		}
	}
});

// refuses a non-image
expect(result).toMatchObject({
	status: 400,
	data: { form: { message: { code: 'not_an_image', field: 'image' } } }
});

// does not save the table when the upload fails
expect(result).toMatchObject({
	status: 400,
	data: { form: { message: { code: 'upload_failed', field: 'image' } } }
});

// refused permission, keeping what was typed
expect(result).toMatchObject({
	status: 403,
	data: { form: { message: { code: 'forbidden' }, data: { title: 'Mesa Nova' } } }
});

// RateLimited from save
expect(result).toMatchObject({
	status: 429,
	data: {
		form: { message: { code: 'rate_limited', retryAfter: 900 }, data: { title: 'Mesa Nova' } }
	}
});
expect(s.setHeaders).toHaveBeenCalledWith({ 'Retry-After': '900' });

// RateLimited from the guard
expect(result).toMatchObject({
	status: 429,
	data: { form: { message: { code: 'rate_limited', retryAfter: 60 } } }
});
```

Add one case for a named domain error on a schema field:

```ts
it('puts a domain problem on the field it names', async () => {
	const s = setup();
	s.save.mockRejectedValueOnce(new Invalid('systemSlug'));

	const result = await run(request(), s);

	expect(result).toMatchObject({
		status: 400,
		data: { form: { errors: { systemSlug: ['invalid'] } } }
	});
});
```

(import `Invalid` from `../errors`.) The success, anonymous-visitor, upload and guard-ordering tests are unchanged. Run: `pnpm exec vitest run --project server src/lib/server/tables/form-action.spec.ts`
Expected: FAIL (the helper still returns the old shape).

- [ ] **Step 4: Rewrite `handleTableForm`**

`src/lib/server/tables/form-action.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { refuse } from '$lib/forms/server';
import { tableFormSchema, toTableInput, type TableInput } from '$lib/tables/schema';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { IMAGE_BUCKET, prepareImage, storeImage } from '../images';

type Event = {
	request: Request;
	locals: App.Locals;
	url: URL;
	setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * What the create and the edit form actions share: check who is asking, validate the form, store
 * the image if there is one, then run `save`. Whatever `save` returns is where to go next.
 * `guard` runs once the form is valid and before the image is stored: it throws to refuse a request
 * (a rate limit) that should not cost an upload.
 *
 * Every failure answers with the values the person typed, so nothing is lost. The permission
 * itself is checked by `save` (through the policy), not here. The image is read from the request
 * itself, not from the schema: a file is not something the form can hand back.
 */
export async function handleTableForm(
	{ request, locals, url, setHeaders }: Event,
	save: (input: TableInput, imagePath?: string) => Promise<{ slug: string }>,
	guard: () => Promise<void> = async () => {}
) {
	if (!(await locals.getUser())) {
		redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const data = await request.formData();
	const form = await superValidate(data, zod4(tableFormSchema));
	if (!form.valid) return fail(400, { form });

	let slug: string;
	try {
		await guard();
		const image = data.get('image');
		let imagePath: string | undefined;

		if (image instanceof File && image.size > 0) {
			const prepared = await prepareImage(image);
			const storage = locals.supabase?.storage.from(IMAGE_BUCKET);
			if (!storage) throw new Invalid('image', 'upload_failed');
			imagePath = await storeImage(storage, prepared);
		}

		({ slug } = await save(toTableInput(form.data), imagePath));
	} catch (error) {
		if (error instanceof Invalid) return refuse(form, 400, error.message, error.field);
		if (error instanceof Forbidden) return message(form, { code: 'forbidden' }, { status: 403 });
		if (error instanceof NotFound) return message(form, { code: 'not_found' }, { status: 404 });
		if (error instanceof RateLimited) {
			setHeaders?.({ 'Retry-After': String(error.retryAfterSeconds) });
			return message(
				form,
				{ code: 'rate_limited', retryAfter: error.retryAfterSeconds },
				{ status: 429 }
			);
		}
		throw error;
	}

	redirect(303, `/tables/${slug}`);
}
```

Run: `pnpm exec vitest run --project server src/lib/server/tables/form-action.spec.ts && pnpm check`
Expected: PASS. The image errors carry `field: 'image'` in the message because `image` is not a schema field: that is what the `refuse` helper does.

- [ ] **Step 5: Page servers**

`src/routes/tables/new/+page.server.ts`: keep everything (including the `guard` for `TABLE_CREATION_LIMIT`), and change `load` to return the form:

```ts
return {
	form: await superValidate(NEW_TABLE_VALUES, zod4(tableFormSchema), { errors: false }),
	systems: systems.map(({ name, slug }) => ({ name, slug }))
};
```

(add imports `superValidate`, `zod4`, `tableFormSchema`; the action body is unchanged: `handleTableForm(event, save, guard)`.)

`src/routes/tables/[slug]/edit/+page.server.ts`: in `load`, drop the string conversions and return the form:

```ts
return {
	slug,
	status,
	form: await superValidate(values, zod4(tableFormSchema), { errors: false }),
	imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath),
	systems: systems.map(({ name, slug }) => ({ name, slug }))
};
```

The `save` action is unchanged (`handleTableForm(event, …)`); `disable` is unchanged.

- [ ] **Step 6: Rewrite `TableForm.svelte` on a `superForm`**

Keep the four numbered sections, the preview panel and the ids, labels, `min`/`max` attributes and messages exactly as they are now. Replace the script and every place that read `values`, `errors` or a local `$state` copy:

```svelte
<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import FormField from './FormField.svelte';
	import type { FormMessage } from '$lib/forms/message';
	import { errorText, formProblem, type TableFormValues } from '$lib/tables/form-values';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		superform: SuperForm<TableFormValues, FormMessage>;
		systems: { name: string; slug: string }[];
		submitLabel: string;
		imageUrl?: string | null;
		/** Where to post, when not the page's own default action (e.g. `?/save`). */
		action?: string;
	};

	let { superform, systems, submitLabel, imageUrl = null, action }: Props = $props();
	const { form, errors, message, enhance, delayed } = superform;

	const timezones = Intl.supportedValuesOf('timeZone');
	const previewSystem = $derived(
		systems.find((system) => system.slug === $form.systemSlug)?.name ?? 'Sistema'
	);

	// A field's problem is a code; the image's comes in the form message, because it is not a schema field.
	const err = (field: keyof TableFormValues) =>
		$errors[field]?.[0] ? errorText($errors[field][0], field) : undefined;
	const imageError = $derived(
		$message?.field === 'image' ? errorText($message.code, 'image') : undefined
	);
	const invalid = (field: keyof TableFormValues) => ($errors[field]?.[0] ? 'true' : undefined);
	const problem = $derived(formProblem($message));
	const hasErrors = $derived(
		Object.values($errors).some((list) => Array.isArray(list) && list.length > 0) || !!imageError
	);
</script>
```

Markup changes, all mechanical:

- `<form method="POST" {action} enctype="multipart/form-data" use:enhance class="…">`.
- The summary line: `{#if hasErrors}<p role="alert" class="font-semibold text-error-700-300">{m.form_summary()}</p>{/if}` and, right below it, `{#if problem}<p role="alert" class="font-semibold text-error-700-300">{problem}</p>{/if}`.
- Every input binds to the store instead of a `value` attribute: `bind:value={$form.systemSlug}` on the select, `bind:value={$form.title}`, `bind:value={$form.description}` on its textarea (no more children text), `bind:value={$form.extraInfo}`, `bind:value={$form.startsAtLocal}`, `bind:value={$form.timezone}` on the timezone select (drop the per-option `selected`), `bind:value={$form.durationMinutes}`, `bind:value={$form.until}`, `bind:value={$form.repeat}` on the repeat select (drop the per-option `selected`), `bind:value={$form.capacity}`.
- Radios: `bind:group={$form.kind}` and `bind:group={$form.joinMode}` (drop `checked`).
- The campaign block: `{#if $form.kind === 'campaign'}`.
- The preview: `{$form.title || 'Título da sua mesa'}` and `{$form.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()} · {$form.capacity || '0'} vagas`.
- The image field: `error={imageError}` and `aria-invalid={imageError ? 'true' : undefined}`; the input stays a plain `type="file"` outside the store (Superforms sends it because the form is multipart).
- Classes from the cheat sheet: inputs `input`, selects `select`, textareas `textarea`, section shells `card border border-surface-200-800 bg-surface-100-900 p-5 sm:p-7`, step numbers `text-warning-700-300`, the submit `btn preset-filled-primary-500` with `aria-busy={$delayed}`, the preview panel `card preset-filled-primary-500 p-5 lg:sticky lg:top-6` with its inner tile `rounded-2xl bg-surface-950/10 p-4` and its text classes reduced to `text-sm opacity-90`.

- [ ] **Step 7: Harness and spec**

`src/lib/components/TableFormHarness.svelte` (test only):

```svelte
<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import TableForm from './TableForm.svelte';
	import type { FormMessage } from '$lib/forms/message';
	import { NEW_TABLE_VALUES, type TableFormValues } from '$lib/tables/form-values';
	import { tableFormSchema } from '$lib/tables/schema';

	// Test only: the form component takes a `superForm`, which has to be created inside a component.
	type Props = {
		systems: { name: string; slug: string }[];
		submitLabel: string;
		values?: Partial<TableFormValues>;
		errors?: Record<string, string[]>;
		message?: FormMessage;
		imageUrl?: string | null;
		action?: string;
	};
	let { systems, submitLabel, values = {}, errors, message, imageUrl, action }: Props = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(defaults({ ...NEW_TABLE_VALUES, ...values }, zod4(tableFormSchema)), {
		validators: zod4Client(tableFormSchema)
	});
	// svelte-ignore state_referenced_locally
	if (errors) superform.errors.set(errors);
	// svelte-ignore state_referenced_locally
	if (message) superform.message.set(message);
</script>

<TableForm {superform} {systems} {submitLabel} {imageUrl} {action} />
```

Rewrite `TableForm.svelte.spec.ts` to render `TableFormHarness`. Keep every existing test as it is, changing only how props go in: `render(TableFormHarness, { systems, submitLabel: 'Abrir mesa' })`; the "keeps what was typed" test becomes

```ts
render(TableFormHarness, {
	...props,
	values: { title: 'ab' },
	errors: { title: ['too_small'], capacity: ['invalid_type'] }
});
```

with the same assertions. Add three tests:

```ts
it('shows the image problem next to the image field, from the form message', async () => {
	render(TableFormHarness, { ...props, message: { code: 'not_an_image', field: 'image' } });

	await expect.element(page.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeVisible();
	await expect.element(page.getByLabelText('Imagem')).toHaveAttribute('aria-invalid', 'true');
});

it('says a refused permission at the top of the form', async () => {
	render(TableFormHarness, { ...props, message: { code: 'forbidden' } });

	await expect.element(page.getByText('Você não tem permissão para fazer isso.')).toBeVisible();
});

it('says how long to wait when the person did this too often', async () => {
	render(TableFormHarness, { ...props, message: { code: 'rate_limited', retryAfter: 900 } });

	await expect.element(page.getByRole('alert')).toHaveTextContent(/Tente de novo em/);
});
```

Run: `pnpm exec vitest run --project client src/lib/components/TableForm.svelte.spec.ts`
Expected: PASS. (Use the same `vi.mock` fallback as Task 5 Step 4 if Superforms needs `$app` stubs.)

- [ ] **Step 8: Pages**

`src/routes/tables/new/+page.svelte`:

```svelte
<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import TableForm from '$lib/components/TableForm.svelte';
	import { m } from '$lib/paraglide/messages';
	import { tableFormSchema } from '$lib/tables/schema';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(data.form, { validators: zod4Client(tableFormSchema) });
</script>

<svelte:head>
	<title>{m.form_new_title()}</title>
</svelte:head>

<section class="py-10 md:py-16">
	<h1 class="h1">{m.form_new_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.form_new_lede()}</p>

	<TableForm {superform} systems={data.systems} submitLabel={m.form_submit_new()} />
</section>
```

`src/routes/tables/[slug]/edit/+page.svelte`: the same `superForm` setup, the `TableForm` gets `{superform}`, `systems`, `imageUrl={data.imageUrl}`, `action="?/save"`, `submitLabel={m.form_submit_edit()}`; delete the page's own `form?.error` alert (the form shows it now); the disable form becomes:

```svelte
{#if data.status === 'active'}
	<div class="border-surface-200-800 mt-12 max-w-2xl border-t pt-6">
		<p class="mb-3">{m.form_disable_hint()}</p>
		<ActionForm action="?/disable">
			<button type="submit" class="btn preset-outlined-error-500">{m.form_disable()}</button>
		</ActionForm>
	</div>
{/if}
```

(import `ActionForm`); links `text-link` to `anchor`; headings keep their sizes with `h1` if Skeleton's `h1` class matches the other pages, otherwise keep the existing `text-4xl font-semibold tracking-tight md:text-6xl` and only drop `font-display`. Use the same heading class on every page you touch in this task so they stay consistent.

- [ ] **Step 9: Verify the slice**

Run: `pnpm check && pnpm lint && pnpm test:unit`
Expected: PASS. Then against the local stack:

```bash
pnpm e2e:up
pnpm exec playwright test e2e/tables-manage.e2e.ts e2e/manage-tables.e2e.ts e2e/rate-limit.e2e.ts
```

Expected: PASS. The image upload is the case that needs the most attention: the e2e specs that create a table with an image must still store it. If they fail because the image never arrives, Superforms is re-building the `FormData` without the file input: set `dataType: 'form'` explicitly in `superForm(...)` on both table pages, and if that still drops the file, add `onSubmit({ formData })` that re-appends `document.querySelector<HTMLInputElement>('input[name=image]')?.files?.[0]` when `formData.get('image')` is empty. Do not move on with the upload broken.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add -A src e2e
git commit -m "feat: table form on Superforms and Skeleton" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 8: Restyle the remaining screens and illustrations

**Files:**

- Modify: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/+error.svelte`, `src/routes/tables/+page.svelte`, `src/routes/account/tables/+page.svelte`, `src/lib/components/TableCard.svelte`, `BottomTabBar.svelte`, `TableIllustration.svelte`, `TableLogo.svelte`, `SeatRing.svelte`, and their specs, `e2e/theme.e2e.ts`, `e2e/landing.e2e.ts`, `e2e/home.e2e.ts`, `e2e/tables.e2e.ts` where a selector names an old class

**Interfaces:**

- Consumes: the cheat sheet at the top of this plan. No new interfaces.

Done means: this command prints nothing.

```bash
git grep -nE "(bg|text|border|ring|fill|stroke|decoration|from|to)-(petrol|celadon|lamp|lampwash|sage|rose|periwinkle|ink2?|line|wash|danger|focus|on-petrol|on-lamp)\b|\btext-link\b|\bfont-(display|body)\b|bg-surface\b|border-surface\b" -- 'src/**/*.svelte' 'e2e/**/*.ts'
```

(`text-surface-…` and `bg-surface-100-900` do not match: `bg-surface\b` only matches the bare old token.)

- [ ] **Step 1: Header, footer and bottom tab bar**

`+layout.svelte`: apply the cheat sheet. Concretely: the skip link `focus:bg-surface-100-900 focus:text-surface-950-50`; nav links `btn hover:preset-tonal hidden h-11 rounded-xl px-3.5 font-semibold md:flex`; the "Abrir mesa" link `btn preset-filled-primary-500 hidden h-11 gap-2.5 rounded-xl px-4 md:inline-flex`; the sign-in link `btn preset-outlined-primary-500 h-11 rounded-xl px-4`; the brand link drops `text-ink`; the footer's border `border-surface-200-800`, its paragraph `text-surface-700-300`, links `anchor`; the wordmark keeps `font-brand`.

`BottomTabBar.svelte` stays custom markup on Skeleton tokens (its existing spec pins the `nav` name and the link roles; Skeleton's Navigation bar would change both for no gain): the `nav` becomes `border-surface-200-800 bg-surface-100-900`; the inactive tab `text-surface-700-300 hover:text-surface-950-50`, the active one `text-surface-950-50`; the active pill `bg-surface-200-800`; the "Abrir mesa" pill `preset-filled-primary-500` with the active ring `ring-2 ring-warning-500`; drop `font-display`.

- [ ] **Step 2: Cards, list and dashboard pages**

Apply the cheat sheet to `TableCard.svelte`, `src/routes/tables/+page.svelte` (the GET filter keeps `method="GET"`; its select becomes `select`, its button `btn preset-filled-primary-500`), `src/routes/account/tables/+page.svelte`, `src/routes/+error.svelte`, and `src/routes/+page.svelte` (landing: hero panel `bg-primary-500 text-primary-contrast-500`, the blocks `card border border-surface-200-800 bg-surface-100-900`, CTAs `btn preset-filled-primary-500` and `btn preset-outlined-primary-500`, `text-lamp` accents `text-warning-700-300`). Chips and status badges use `chip`/`badge` with a preset from the cheat sheet. Where a card uses the amber "waiting" or "seats left" colour, use `warning`.

- [ ] **Step 2b: Run each touched component spec after its file**

```bash
pnpm exec vitest run --project client src/lib/components/TableCard.svelte.spec.ts src/lib/components/BottomTabBar.svelte.spec.ts src/routes/layout.svelte.spec.ts
```

Expected: PASS. A failing assertion that names an old class is updated to the new class; one that names a role, label or text is a real regression: fix the markup.

- [ ] **Step 3: Illustrations recoloured to Cerberus tokens**

`TableLogo.svelte`:

```svelte
<svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" class="shrink-0 {className}">
	<circle cx="17" cy="17" r="10.5" class="fill-primary-500" />
	<circle cx="17" cy="4.6" r="3.4" class="fill-success-500" />
	<circle cx="28.6" cy="22" r="3.4" class="fill-error-500" />
	<circle cx="6.4" cy="24" r="3.4" class="fill-tertiary-500" />
	<circle
		cx="28"
		cy="9"
		r="2.8"
		fill="none"
		class="stroke-warning-500"
		stroke-width="1.6"
		stroke-dasharray="2.6 2.6"
	/>
</svg>
```

`SeatRing.svelte`: replace the palette and the two fills:

```ts
const SEAT_COLORS = [
	'var(--color-success-500)',
	'var(--color-error-500)',
	'var(--color-tertiary-500)',
	'var(--color-warning-500)',
	'var(--color-secondary-500)',
	'var(--color-primary-500)'
];
```

```svelte
<circle cx="50" cy="50" r="20" class="fill-surface-950/25" />
```

```svelte
<circle
	cx={seat.cx}
	cy={seat.cy}
	r={seatRadius}
	class="fill-warning-500/20 stroke-warning-500"
	stroke-width="2"
	stroke-dasharray="3 3"
/>
```

`TableIllustration.svelte`: replace every hard-coded hex or old token with the nearest Cerberus token by the same rule (the table itself `fill-primary-500`; the three players `fill-success-500`, `fill-error-500`, `fill-tertiary-500`; the empty seat `fill-warning-500/20 stroke-warning-500`; highlights `fill-primary-contrast-500/20`). Run `git grep -n "fill=\"#\|stroke=\"#" -- src/lib/components/TableIllustration.svelte` first: each hit is a colour to convert. Then run the specs: `pnpm exec vitest run --project client src/lib/components/SeatRing.svelte.spec.ts` and update assertions on the old fill colours (`#7fb7a4`, `rgba(240,179,74,0.16)`, …) to the class or `var(--color-…)` value now used.

- [ ] **Step 4: Put the hero-table dark-mode e2e back, against the new colours**

Append to `e2e/theme.e2e.ts`:

```ts
test.describe('the hero table in the dark mode', () => {
	test('the empty seat still stands out from the page', async ({ browser }) => {
		const { page, context } = await open(browser, 'dark');

		const seat = await page
			.locator('svg circle[stroke-dasharray]')
			.first()
			.evaluate((el) => getComputedStyle(el).stroke);
		const background = (await colours(page)).background;

		expect(contrast(seat, background)).toBeGreaterThanOrEqual(3);
		await context.close();
	});

	test('recolours with the mode instead of keeping the light palette', async ({ browser }) => {
		const light = await open(browser, 'light');
		const dark = await open(browser, 'dark');
		const fill = (page: import('@playwright/test').Page) =>
			page
				.locator('svg circle.fill-primary-500')
				.first()
				.evaluate((el) => getComputedStyle(el).fill);

		expect(await fill(dark.page)).not.toBe(await fill(light.page));
		await light.context.close();
		await dark.context.close();
	});
});
```

If the second test finds no such circle, the class that the landing illustration puts on its table circle is different: use the class you set in Step 3.

- [ ] **Step 5: Verify done and look at it**

```bash
git grep -nE "(bg|text|border|ring|fill|stroke|decoration|from|to)-(petrol|celadon|lamp|lampwash|sage|rose|periwinkle|ink2?|line|wash|danger|focus|on-petrol|on-lamp)\b|\btext-link\b|\bfont-(display|body)\b|bg-surface\b|border-surface\b" -- 'src/**/*.svelte' 'e2e/**/*.ts'
pnpm check && pnpm lint && pnpm test:unit
```

Expected: the grep prints nothing; the rest pass. Then run `pnpm dev` and open `/`, `/tables`, `/tables/<a table>`, `/account/tables`, `/tables/new`, `/login` in light and dark, at desktop and phone width (Chrome devtools, 390px). Look for: text you cannot read on its background (especially the amber "waiting" badge and the seats-left text), a page that is still the old petrol green, a control with no visible focus ring, and horizontal scrolling on the phone. Fix what you see before committing.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add -A src e2e
git commit -m "feat: restyle the remaining screens and illustrations with Cerberus" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

---

### Task 9: Remove the bridge, drop the old fonts, verify both modes

**Files:**

- Modify: `src/routes/layout.css`, `package.json`, `pnpm-lock.yaml`, `README.md` or `CONTRIBUTING.md` if either names Bits UI or the old tokens

- [ ] **Step 1: Delete the temporary bridge from `layout.css`**

Remove the second `@theme` block (all `--color-celadon` … `--color-lampwash`), the `:root[data-mode='dark']` token block, and the `text-link` utility. What remains:

```css
@import 'tailwindcss';
@import '@skeletonlabs/skeleton';
@import '@skeletonlabs/skeleton-svelte';
@import '@skeletonlabs/skeleton/themes/cerberus';
@import '@fontsource-variable/cinzel';

/* Dark mode is a `data-mode` on <html>: set before the first paint (src/app.html) and by the theme toggle. */
@custom-variant dark (&:where([data-mode='dark'], [data-mode='dark'] *));

:root[data-mode='light'] {
	color-scheme: light;
}
:root[data-mode='dark'] {
	color-scheme: dark;
}

@theme {
	/* Wordmark only */
	--font-brand: 'Cinzel Variable', Georgia, serif;
}
```

- [ ] **Step 2: Remove the fonts and look for leftovers**

```bash
pnpm remove @fontsource-variable/bricolage-grotesque @fontsource-variable/literata
git grep -nE "bricolage|literata|bits-ui|Bits UI|petrol|celadon|--color-(lamp|ink|sage|rose|periwinkle)" -- . ':!pnpm-lock.yaml' ':!docs/superpowers' ':!node_modules'
```

Expected: the grep prints nothing (or only prose in the README/CONTRIBUTING that you update to say Skeleton and Cerberus). Fix each hit.

- [ ] **Step 3: Both modes, both widths, by eye**

Write a screenshot script in the scratchpad directory and run it from the project root (so `playwright` resolves):

```bash
pnpm dev --port 5199 &
sleep 8
node --input-type=module <<'EOF'
import { chromium } from 'playwright';
const dir = '/private/tmp/claude-501/-Users-grave-workspace-mesaaberta/f7ba45ec-c950-468b-b0ba-06209a5025bd/scratchpad';
const browser = await chromium.launch();
for (const mode of ['light', 'dark']) {
	for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
		const context = await browser.newContext({ viewport });
		await context.addInitScript((m) => localStorage.setItem('theme', m), mode);
		const page = await context.newPage();
		for (const path of ['/', '/login', '/signup', '/forgot-password']) {
			await page.goto('http://localhost:5199' + path);
			await page.screenshot({ path: `${dir}/${mode}-${name}-${path.replace(/\W+/g, '_') || 'home'}.png`, fullPage: true });
		}
		await context.close();
	}
}
await browser.close();
EOF
kill %1
```

Read the PNGs (Read tool) and check: readable text, visible focus states in both modes, the amber states legible, no page that is still the old palette, no horizontal scroll on the phone. The signed-in pages (`/tables`, a table, `/account/tables`, the forms) need a session: view them in a real browser against the local stack, or use the existing `e2e/support/users.ts` helpers in a throwaway Playwright script. Fix what is wrong, then re-run.

- [ ] **Step 4: Full verification**

```bash
pnpm check && pnpm lint && pnpm test:unit
pnpm e2e:up
pnpm test:e2e
```

Expected: all pass. Report the exact counts. Any e2e failure is investigated, not skipped: read the failure, decide whether the test or the app is wrong, and fix that one.

- [ ] **Step 5: Commit, then finish the branch**

```bash
pnpm format
git add -A src package.json pnpm-lock.yaml README.md CONTRIBUTING.md
git commit -m "chore: remove the old colour tokens and fonts" \
  --trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" \
  --trailer "Claude-Session: https://claude.ai/code/session_01K88qK1eH4WusmoEXHgmFet"
```

Then use superpowers:finishing-a-development-branch. The PR body carries the Trello card URL, and the PR URL goes back on the card.

---

## Self-review

**Spec coverage.**

| Spec requirement                                                                                                    | Task                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Skeleton packages, Cerberus import, `data-theme="cerberus"`                                                         | 1                                                                            |
| Remove custom tokens, dark blocks, `text-link`                                                                      | 1 (bridge), 8, 9                                                             |
| Light/dark through `data-mode` + `dark:` variant, toggle and `theme.ts` kept                                        | 1                                                                            |
| Cinzel wordmark only; drop Bricolage and Literata                                                                   | 1, 9                                                                         |
| `theme.spec.ts` replaced, `theme.e2e.ts` updated                                                                    | 1                                                                            |
| Illustration, logo, SeatRing recoloured                                                                             | 8                                                                            |
| Avatar, Popover, Progress to Skeleton; `bits-ui` removed                                                            | 3                                                                            |
| Toast to Skeleton, call sites kept                                                                                  | 2                                                                            |
| Skeleton presets replace hand-rolled classes; `BottomTabBar` on tokens                                              | 4 (FormField), 5, 6, 7, 8                                                    |
| Zod 4 schemas, `zod4`/`zod4Client`, ported tests                                                                    | 5, 6, 7                                                                      |
| `superValidate` + `fail`/`message` server side; 400/429/500 mapping kept; password never returned; guards untouched | 5, 6, 7                                                                      |
| Client `superForm` with validators; errors mapped to paraglide in the form                                          | 5, 6, 7                                                                      |
| Login, signup, forgot, reset                                                                                        | 5                                                                            |
| Table create/edit incl. image                                                                                       | 7                                                                            |
| Join, rate                                                                                                          | 6                                                                            |
| Leave, approve, decline, remove                                                                                     | 6 (`ActionForm`)                                                             |
| Logout                                                                                                              | Deviation, stated in Global Constraints: stays a fieldless `+server.ts` POST |
| `/tables` GET filter stays native                                                                                   | 8                                                                            |
| Rate-limit behaviour from #70 kept                                                                                  | 6, 7                                                                         |
| Verification order (`check`, `lint`, unit, e2e) and commits per slice                                               | every task, 9                                                                |
| Risks: contrast, upload, e2e churn                                                                                  | 8 (eyes-on check), 7 (upload step), 5/6/7/9 (e2e)                            |

**Placeholder scan.** The only deliberate fill-ins are the two hex values in Task 1 Step 7, produced by the command in Step 4 in the same task. The `<!-- … svg: unchanged -->` markers in Task 3 point at existing markup that is kept.

**Type consistency.** `FormMessage` (`code`, `field?`, `retryAfter?`) is defined in Task 4 and used unchanged in Tasks 5 to 7. `withoutSecrets(form, fields)` and `refuse(form, status, code, field?)` keep the same signatures where used. `runRegistrationAction(event, schema, run)` and the `ActionForm` props match between Tasks 6 and 7 (the disable button). `TableFormValues` and `NEW_TABLE_VALUES` are defined in Task 7 Step 2 and used by the harness and pages in Steps 7 and 8. `registrationError(code, retryAfter?)` is used with those arguments in `ActionForm` and the table page.
