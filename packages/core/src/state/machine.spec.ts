import { describe, expect, it } from 'vitest';
import { TABLE_STATUSES } from '@mesaaberta/db/table-status';
import { REPORT_STATUSES } from '../moderation/reports';
import { reportMachine } from '../moderation/report-machine';
import { tableLifecycle } from '../tables/lifecycle-machine';
import { allowedEvents, finalStates, next, statesOf, toMermaid, transitionsOf } from './machine';

// Each machine names exactly the values its column can hold, so no status is left without rules.
const machines = [
  { machine: tableLifecycle, values: TABLE_STATUSES },
  { machine: reportMachine, values: REPORT_STATUSES },
];

describe('status machines', () => {
  it.each(machines)('$machine.id has one state per database value', ({ machine, values }) => {
    expect([...statesOf(machine)].sort()).toEqual([...values].sort());
  });

  it('answers a move, or null when it does not exist', () => {
    expect(next(reportMachine, 'open', 'REVIEW')).toBe('reviewing');
    expect(next(reportMachine, 'resolved', 'REVIEW')).toBeNull();
    expect(next(reportMachine, 'open', 'NOPE')).toBeNull();
  });

  it('lists the moves open from a state', () => {
    expect(allowedEvents(reportMachine, 'open')).toEqual(['REVIEW', 'RESOLVE', 'DISMISS']);
    expect(allowedEvents(reportMachine, 'reviewing')).toEqual(['RESOLVE', 'DISMISS']);
    expect(allowedEvents(reportMachine, 'dismissed')).toEqual([]);
  });

  it('knows the final states', () => {
    expect(finalStates(reportMachine)).toEqual(['resolved', 'dismissed']);
  });

  it('lists every move and draws them', () => {
    expect(transitionsOf(reportMachine)).toContainEqual(['reviewing', 'DISMISS', 'dismissed']);
    expect(toMermaid(reportMachine)).toBe(
      [
        'stateDiagram-v2',
        '  open --> reviewing: REVIEW',
        '  open --> resolved: RESOLVE',
        '  open --> dismissed: DISMISS',
        '  reviewing --> resolved: RESOLVE',
        '  reviewing --> dismissed: DISMISS',
        '  resolved --> [*]',
        '  dismissed --> [*]',
      ].join('\n'),
    );
  });
});
