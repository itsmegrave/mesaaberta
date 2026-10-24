# Project instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the project workflow, code style, translations and UI conventions.

## UI libraries and components

- Prefer the project's existing Skeleton Svelte components and wrappers whenever they provide the control or interaction. Use TanStack Query for client-side server state, TanStack Table for interactive tables, and TanStack Form for form state and validation. Superforms has been removed; use the shared actionForm contract for native POST and Query mutations.
- Use shared Button, SubmitButton, TextInput, TextArea, SelectInput, FormField and Form components and shared TanStack Form/Query integration for forms. Reuse or extend existing wrappers before adding new ones. When Skeleton has no standalone primitive, keep the semantic HTML inside the shared wrapper instead of repeating control markup and styling across screens. TanStack Table is for data tables.
- Keep semantic HTML for document structure and use native form elements when these libraries do not provide an equivalent, progressive enhancement requires them, or a documented accessibility or CSP constraint requires them. Basic buttons and fields may use semantic HTML styled with Skeleton's shared classes when there is no standalone component.
- Before adding a custom control, inspect the installed library components and existing project wrappers. Preserve keyboard behavior, labels, validation, focus states and responsive behavior.

## Spacing and visual consistency

- Use Tailwind's 4px spacing grid and existing theme tokens for spacing, sizing, radius, borders and color. Avoid arbitrary values and one-off values; add a named token only when the design needs a value the existing scale cannot express.
- Calculated layout values and precise illustration geometry may use arbitrary values when needed; leave a short code comment explaining non-obvious cases.
- When changing a screen or component, review its mobile and desktop padding, gaps, border weight and color, radius, and focus treatment for consistency with nearby UI.

## API ownership

- Implement every new endpoint for domain reads or writes in `apps/api`, backed by shared services in `packages/core`.
- Web form actions and loaders consume the authenticated API contract. New features must use the required API transport, without a migration flag or a local database fallback; unavailable API calls fail as service errors.
- Existing endpoints keep their current migration behavior until explicitly migrated. Tests for new flows run the API alongside the web app.
