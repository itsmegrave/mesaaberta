# State machines

Generated from `packages/core/src/state/machines.ts` by `machines.spec.ts`. Do not edit by hand:
change a machine, then run the spec with `UPDATE_STATE_DOCS=1` to redraw this file.

Every status is written through `applyTransition` (`packages/core/src/server/state/transition.ts`),
which asks the machine for the move and updates the row only while it is still in the status it
was read in. A move missing from a diagram is refused.

## Table (mesa)

`game_tables.status`

```mermaid
stateDiagram-v2
  active --> awaiting_confirmation: SESSION_ENDED
  active --> concluded: FINISH
  active --> disabled: DISABLE
  awaiting_confirmation --> concluded: HAPPENED
  awaiting_confirmation --> active: SESSION_HELD
  awaiting_confirmation --> not_held: NOT_HELD
  awaiting_confirmation --> active: POSTPONE
  awaiting_confirmation --> concluded: FINISH
  awaiting_confirmation --> disabled: DISABLE
  not_held --> disabled: DISABLE
  draft --> active: PUBLISH
  draft --> disabled: DISABLE
  concluded --> [*]
  disabled --> [*]
```

## Table session (sessão)

`table_sessions.status`

```mermaid
stateDiagram-v2
  scheduled --> held: HELD
  scheduled --> not_held: NOT_HELD
  scheduled --> cancelled: CANCEL
  held --> [*]
  not_held --> [*]
  cancelled --> [*]
```

## Report (denúncia)

`reports.status`

```mermaid
stateDiagram-v2
  open --> reviewing: REVIEW
  open --> resolved: RESOLVE
  open --> dismissed: DISMISS
  reviewing --> resolved: RESOLVE
  reviewing --> dismissed: DISMISS
  resolved --> [*]
  dismissed --> [*]
```

## Invitation (mesa, parceiro, lugar)

`player_invitations / partner_invitations / place_host_invitations.status`

```mermaid
stateDiagram-v2
  pending --> accepted: ACCEPT
  pending --> declined: DECLINE
  pending --> cancelled: CANCEL
  pending --> expired: EXPIRE
  accepted --> [*]
  declined --> [*]
  expired --> [*]
  cancelled --> [*]
```

## Seat (vaga na mesa)

`registrations.status`

```mermaid
stateDiagram-v2
  pending --> confirmed: APPROVE
  confirmed --> [*]
```

## Session sign-up (vaga na sessão)

`table_session_signups.status`

```mermaid
stateDiagram-v2
  waiting --> going: PROMOTE
  going --> [*]
```

## Catalog entry (sistema, plataforma, tag, recurso de lugar)

`systems / platforms / tags / place_features.status`

```mermaid
stateDiagram-v2
  pending --> approved: APPROVE
  pending --> rejected: REJECT
  pending --> rejected: MERGE
  approved --> disabled: DISABLE
  approved --> rejected: MERGE
  disabled --> rejected: MERGE
  rejected --> [*]
```

## System logo (logo de sistema)

`system_logos.status`

```mermaid
stateDiagram-v2
  pending --> approved: APPROVE
  pending --> rejected: REJECT
  approved --> rejected: REJECT
  rejected --> [*]
```

## Place claim (reivindicação de lugar)

`place_claims.status`

```mermaid
stateDiagram-v2
  pending --> approved: APPROVE
  pending --> rejected: REJECT
  approved --> [*]
  rejected --> [*]
```

## Place partner link (parceiro no lugar)

`place_partner_links.status`

```mermaid
stateDiagram-v2
  pending --> approved: APPROVE
  pending --> rejected: REJECT
  pending --> cancelled: CANCEL
  approved --> removed: REMOVE
  rejected --> [*]
  cancelled --> [*]
  removed --> [*]
```

## Crowdfunding import run (importação diária)

`crowdfunding_import_runs.status`

```mermaid
stateDiagram-v2
  running --> complete: COMPLETE
  running --> partial: PARTIAL
  running --> failed: FAIL
  complete --> [*]
  partial --> [*]
  failed --> [*]
```

## Widget (enquete, popup)

`widgets.status`

```mermaid
stateDiagram-v2
  draft --> live: PUBLISH
  live --> paused: PAUSE
  live --> closed: CLOSE
  paused --> live: PUBLISH
  paused --> closed: CLOSE
  closed --> [*]
```
