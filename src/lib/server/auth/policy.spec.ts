import { describe, expect, it } from 'vitest';
import { authorize, can, joinBlocker, rateBlocker, type Actor } from './policy';

const member: Actor = { id: 'member', role: 'member', status: 'active' };
const otherMember: Actor = { id: 'other', role: 'member', status: 'active' };
const gm: Actor = { id: 'gm', role: 'member', status: 'active' };
const admin: Actor = { id: 'admin', role: 'admin', status: 'active' };
const suspendedMember: Actor = { id: 'member', role: 'member', status: 'suspended' };
const suspendedGm: Actor = { id: 'gm', role: 'member', status: 'suspended' };
const suspendedAdmin: Actor = { id: 'admin', role: 'admin', status: 'suspended' };

const table = { gmId: 'gm' };

describe('can', () => {
	describe('table:create', () => {
		it.each([
			['a member', member, true],
			['an admin', admin, true],
			['an anonymous visitor', null, false],
			['a suspended member', suspendedMember, false],
			['a suspended admin', suspendedAdmin, false]
		])('for %s: %s', (_who, who, allowed) => {
			expect(can(who, 'table:create')).toBe(allowed);
		});
	});

	describe('admin:access', () => {
		it.each([
			['an admin', admin, true],
			['a member', member, false],
			['an anonymous visitor', null, false],
			['a suspended admin', suspendedAdmin, false]
		])('for %s: %s', (_who, who, allowed) => {
			expect(can(who, 'admin:access')).toBe(allowed);
		});
	});

	describe.each(['table:edit', 'table:disable'] as const)('%s', (action) => {
		it.each([
			['the GM of that table', gm, true],
			['an admin, who is not its GM', admin, true],
			['another member', otherMember, false],
			['a member who is not the GM, even with the same role', member, false],
			['an anonymous visitor', null, false],
			['the GM once suspended', suspendedGm, false],
			['an admin once suspended', suspendedAdmin, false]
		])('%s: %s', (_who, who, allowed) => {
			expect(can(who, action, table)).toBe(allowed);
		});

		it('is decided by the table it is asked about, not by who else owns tables', () => {
			expect(can(gm, action, { gmId: 'someone-else' })).toBe(false);
			expect(can(gm, action, { gmId: 'gm' })).toBe(true);
		});
	});

	it('denies an action it does not know, whoever asks', () => {
		const loose = can as (actor: Actor | null, action: string, resource?: unknown) => boolean;

		for (const who of [null, member, gm, admin]) {
			expect(loose(who, 'table:teleport', table)).toBe(false);
			expect(loose(who, 'constructor', table)).toBe(false);
		}
	});

	it('denies an edit when it is not told which table', () => {
		// A route that forgot the resource must not be waved through.
		expect(can(admin, 'table:edit', undefined as never)).toBe(false);
		expect(can(gm, 'table:disable', undefined as never)).toBe(false);
	});
});

describe('authorize', () => {
	it('does nothing when the action is allowed', () => {
		expect(() => authorize(gm, 'table:edit', table)).not.toThrow();
	});

	it('throws Forbidden when it is not, naming the action but nothing about the actor', () => {
		expect(() => authorize(otherMember, 'table:edit', table)).toThrowError(
			expect.objectContaining({ name: 'Forbidden', message: 'table:edit' })
		);
	});

	it('throws Forbidden for an anonymous visitor as well', () => {
		expect(() => authorize(null, 'table:create')).toThrowError(
			expect.objectContaining({ name: 'Forbidden' })
		);
	});
});

describe('table:join', () => {
	const open = {
		gmId: 'gm',
		tableStatus: 'active' as const,
		seatsLeft: 2,
		alreadyRegistered: false
	};

	it.each([
		['another member', otherMember, true],
		['an admin, who is not the GM', admin, true],
		['the GM of that table', gm, false],
		['an anonymous visitor', null, false],
		['a suspended member', suspendedMember, false]
	])('%s: %s', (_who, who, allowed) => {
		expect(can(who, 'table:join', open)).toBe(allowed);
	});

	it.each([
		['the table is disabled', { ...open, tableStatus: 'disabled' as const }, 'inactive'],
		['there is no seat left', { ...open, seatsLeft: 0 }, 'full'],
		['the player already has a registration', { ...open, alreadyRegistered: true }, 'registered']
	])('is refused when %s, and says why', (_what, facts, reason) => {
		expect(can(otherMember, 'table:join', facts)).toBe(false);
		expect(joinBlocker(otherMember, facts)).toBe(reason);
	});

	it('says nothing about the table to someone who may not join anyway', () => {
		expect(joinBlocker(gm, { ...open, seatsLeft: 0 })).toBe('forbidden');
		expect(joinBlocker(null, { ...open, tableStatus: 'disabled' })).toBe('forbidden');
	});

	it('has no blocker when the player may join', () => {
		expect(joinBlocker(otherMember, open)).toBeNull();
	});

	it('refuses a join it is given no facts for', () => {
		expect(can(otherMember, 'table:join', undefined as never)).toBe(false);
	});
});

describe('registration:manage (approve, decline, remove)', () => {
	it.each([
		['the GM of that table', gm, true],
		['an admin', admin, true],
		['another member', otherMember, false],
		['a member who has a registration there', member, false],
		['an anonymous visitor', null, false],
		['the GM once suspended', suspendedGm, false]
	])('%s: %s', (_who, who, allowed) => {
		expect(can(who, 'registration:manage', { gmId: 'gm' })).toBe(allowed);
	});
});

describe('registration:leave', () => {
	it("lets a player leave their own registration, and nobody else's", () => {
		expect(can(member, 'registration:leave', { playerId: 'member' })).toBe(true);
		expect(can(otherMember, 'registration:leave', { playerId: 'member' })).toBe(false);
		expect(can(admin, 'registration:leave', { playerId: 'member' })).toBe(false); // an admin removes instead
	});

	it('is refused for anonymous visitors and suspended accounts', () => {
		expect(can(null, 'registration:leave', { playerId: 'member' })).toBe(false);
		expect(can(suspendedMember, 'registration:leave', { playerId: 'member' })).toBe(false);
	});
});

describe('table:rate', () => {
	const ready = { gmId: 'gm', registration: 'confirmed' as const, firstSessionEnded: true };

	it.each([
		['a player with a confirmed seat', member, true],
		['the GM of the table', gm, false],
		['an anonymous visitor', null, false],
		['a suspended player', suspendedMember, false]
	])('%s: %s', (_who, who, allowed) => {
		expect(can(who, 'table:rate', ready)).toBe(allowed);
	});

	it.each([
		[
			'has only asked for a seat (pending)',
			{ ...ready, registration: 'pending' as const },
			'not_registered'
		],
		['has no place at the table', { ...ready, registration: null }, 'not_registered'],
		[
			'played nothing yet: the first session has not ended',
			{ ...ready, firstSessionEnded: false },
			'too_early'
		]
	])('is refused for a player who %s, and says why', (_what, facts, reason) => {
		expect(can(member, 'table:rate', facts)).toBe(false);
		expect(rateBlocker(member, facts)).toBe(reason);
	});

	it('says nothing about the table to someone who may not rate anyway', () => {
		expect(rateBlocker(gm, { ...ready, firstSessionEnded: false })).toBe('forbidden');
		expect(rateBlocker(null, ready)).toBe('forbidden');
	});

	it('has no blocker when the player may rate', () => {
		expect(rateBlocker(member, ready)).toBeNull();
	});

	it('refuses a rating it is given no facts for', () => {
		expect(can(member, 'table:rate', undefined as never)).toBe(false);
	});
});
