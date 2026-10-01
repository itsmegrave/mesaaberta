# Project rules

Read [CONTRIBUTING.md](CONTRIBUTING.md) first: workflow, code style, translations and internal links all apply to agents too.

## UI and forms

Use Skeleton primitives and existing shared controls. Form migrations use TanStack Form and Query through the shared action integration; preserve SvelteKit actions, server authorization/validation, drafts and native POST where supported. Superforms remains transitional until card #152 is complete. Follow the UI/form contract in CONTRIBUTING.

## Changelog

- Every change that ships a new feature or fixes a bug people can notice adds or updates an entry in `src/content/changelog/`, as described in [CONTRIBUTING.md](CONTRIBUTING.md#changelog). Chores (`chore:` commits), admin-only changes, refactors, tests, tooling and dependency bumps don't.
- Write the entry's title, summary and items with the UW (UX writing) agent, like any other user-facing copy. Give it the change from the player's or GM's point of view, not the diff.
- Use `draft: true` only to preview an entry that shouldn't go out with the merge; a merged entry is normally published.

## Pagination

- Paginated lists take the page number from `?page=N` (the first page has no parameter). A value that isn't a positive whole number reads as page 1, and a page past the last answers 404.
