# Project rules

Read [CONTRIBUTING.md](CONTRIBUTING.md) first: workflow, code style, translations and internal links all apply to agents too.

## UI and forms

Use Skeleton primitives and existing shared controls. Form migrations use TanStack Form and Query through the shared action integration; preserve SvelteKit actions, server authorization/validation, drafts and native POST where supported. Follow the UI/form contract in CONTRIBUTING.

## Pagination

- Paginated lists take the page number from `?page=N` (the first page has no parameter). A value that isn't a positive whole number reads as page 1, and a page past the last answers 404.
