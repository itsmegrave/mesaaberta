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
