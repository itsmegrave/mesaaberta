import type { Handler } from './types';

/**
 * Every handler that reacts to domain events. Each is idempotent (see `Handler`), so the sweeper
 * can retry it safely. Nothing reacts yet: later slices add the calendar invites (#13) and the
 * analytics forwarding (#20) here. Events are recorded and kept as the audit log either way.
 */
export const handlers: readonly Handler[] = [];
