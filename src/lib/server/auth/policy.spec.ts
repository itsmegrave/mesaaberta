import { describe, expect, it } from 'vitest';
import { authorize, can, type Actor } from './policy';

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
