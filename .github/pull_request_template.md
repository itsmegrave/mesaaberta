## What and why

<!-- One concern per PR. Link the Trello card. -->

## Test plan

<!-- What you ran and what you checked by hand. -->

## OWASP Top 10 review

Required before merging (project rule). Tick each line, or say why it does not apply. Fix any finding before merging.

- [ ] **A01 Access control:** new api routes sit behind `adminGuard`, `userGuard` or `viewerGuard`; the service authorizes the actor on the resource; server fetches of user-given URLs go through `isSafeTarget`.
- [ ] **A02 Misconfiguration:** no new public Worker URL (`workers_dev`, `preview_urls`), CORS, debug route or relaxed CSP; errors carry no internal detail.
- [ ] **A03 Supply chain:** new or bumped dependencies are needed, locked in `bun.lock` and clean in `bun audit`; CI actions and orbs stay pinned.
- [ ] **A04 Cryptography:** secrets stay in Infisical, are compared with `sameSecret` and are stored hashed or encrypted, never logged.
- [ ] **A05 Injection:** no `sql.raw` with input, no `{@html}` outside `RichText`, path segments use `encodeURIComponent`.
- [ ] **A06 Insecure design:** new writes have rate limits; age, block and suspension rules still hold.
- [ ] **A07 Authentication:** session, token, OAuth and redirect (`safeNext`) handling unchanged or reviewed; sensitive account changes need a recent sign-in.
- [ ] **A08 Integrity:** migrations are additive (expand, migrate, contract); releases pinned by SHA; nothing deserialized from untrusted input.
- [ ] **A09 Logging and alerting:** security-relevant refusals are logged, without personal data or secrets.
- [ ] **A10 Exceptional conditions:** failures fail closed and leak no internals.

**Result:** <!-- "No findings", or each finding and how it was fixed. -->
