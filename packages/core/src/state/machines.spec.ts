import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toMermaid, statesOf } from './machine';
import { STATUS_MACHINES } from './machines';

const docPath = resolve(import.meta.dirname, './machines.md');

const doc = () =>
  [
    '# State machines',
    '',
    'Generated from `packages/core/src/state/machines.ts` by `machines.spec.ts`. Do not edit by hand:',
    'change a machine, then run the spec with `UPDATE_STATE_DOCS=1` to redraw this file.',
    '',
    'Every status is written through `applyTransition` (`packages/core/src/server/state/transition.ts`),',
    'which asks the machine for the move and updates the row only while it is still in the status it',
    'was read in. A move missing from a diagram is refused.',
    ...STATUS_MACHINES.flatMap(({ title, column, machine }) => [
      '',
      `## ${title}`,
      '',
      `\`${column}\``,
      '',
      '```mermaid',
      toMermaid(machine),
      '```',
    ]),
    '',
  ].join('\n');

describe('status machines', () => {
  it.each(STATUS_MACHINES)(
    '$title has one state per value of its column',
    ({ machine, values }) => {
      expect([...statesOf(machine)].sort()).toEqual([...values].sort());
    },
  );

  it('match machines.md (UPDATE_STATE_DOCS=1 redraws it)', () => {
    if (process.env.UPDATE_STATE_DOCS) writeFileSync(docPath, doc());
    expect(readFileSync(docPath, 'utf8')).toBe(doc());
  });
});
