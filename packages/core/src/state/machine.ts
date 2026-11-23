// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine, getNextSnapshot, type AnyStateMachine } from 'xstate';

/**
 * The status machines (drawn in `machines.md`) are plain XState v5 machines used as
 * transition tables: one state per value of the status column, one event per move. Nothing runs
 * them as actors; these helpers only ask them which move exists. The database update that applies
 * a move still checks the current status (`applyTransition`), so two moves at once cannot both win.
 */

/**
 * XState's `createMachine`, for status machines defined outside this package: the private package
 * builds its own (Instagram posts) without depending on xstate itself.
 */
export const defineStatusMachine = createMachine;

const snapshotAt = (machine: AnyStateMachine, from: string) =>
  machine.resolveState({ value: from, context: machine.config.context ?? undefined });

/** The status `event` takes a row in `from` to, or null when that move does not exist. */
export function next<S extends string>(machine: AnyStateMachine, from: S, event: string): S | null {
  const snapshot = snapshotAt(machine, from);
  if (!snapshot.can({ type: event })) return null;
  return getNextSnapshot(machine, snapshot, { type: event }).value as S;
}

/** The moves open from `from`, in the order the machine lists them: the buttons worth showing. */
export function allowedEvents(machine: AnyStateMachine, from: string): string[] {
  const snapshot = snapshotAt(machine, from);
  return eventsOf(machine).filter((type) => snapshot.can({ type }));
}

/** Every state of the machine, in the order it declares them. */
export const statesOf = (machine: AnyStateMachine): string[] => Object.keys(machine.root.states);

/** The states no move leaves. */
export const finalStates = (machine: AnyStateMachine): string[] =>
  statesOf(machine).filter((state) => Object.keys(machine.root.states[state].on).length === 0);

function eventsOf(machine: AnyStateMachine): string[] {
  const seen = new Set<string>();
  for (const state of Object.values(machine.root.states))
    for (const type of Object.keys(state.on)) seen.add(type);
  return [...seen];
}

/** Every move as `[from, event, to]`, for specs and the generated diagrams. */
export function transitionsOf(machine: AnyStateMachine): [string, string, string][] {
  const moves: [string, string, string][] = [];
  for (const [from, state] of Object.entries(machine.root.states))
    for (const [event, transitions] of Object.entries(state.on))
      for (const transition of transitions)
        for (const target of transition.target ?? []) moves.push([from, event, target.key]);
  return moves;
}

/** The machine as a Mermaid state diagram. */
export function toMermaid(machine: AnyStateMachine): string {
  const lines = ['stateDiagram-v2'];
  for (const [from, event, to] of transitionsOf(machine))
    lines.push(`  ${from} --> ${to}: ${event}`);
  for (const state of finalStates(machine))
    if (transitionsOf(machine).some(([, , to]) => to === state)) lines.push(`  ${state} --> [*]`);
  return lines.join('\n');
}
