import { describe, expect, it } from 'vitest';
import { keepFullAccount } from './last-account';

const full = (name: string) => ({ displayName: name, isAdmin: true });
const bare = (name: string) => ({ displayName: name, isAdmin: false, unavailable: true as const });

describe('keepFullAccount', () => {
  it('keeps showing the last full account while the profile cannot be read', () => {
    const shown = keepFullAccount<{ displayName: string; isAdmin: boolean; unavailable?: true }>();
    shown(full('Ana'), 'u1');
    expect(shown(bare('Ana'), 'u1')).toEqual(full('Ana'));
  });

  it('shows the bare account when nothing full was seen for that person', () => {
    const shown = keepFullAccount<{ displayName: string; isAdmin: boolean; unavailable?: true }>();
    shown(full('Ana'), 'u1');
    expect(shown(bare('Bia'), 'u2')).toEqual(bare('Bia'));
  });

  it('forgets the account once signed out', () => {
    const shown = keepFullAccount<{ displayName: string; isAdmin: boolean; unavailable?: true }>();
    shown(full('Ana'), 'u1');
    expect(shown(null, 'anonymous')).toBeNull();
    expect(shown(bare('Ana'), 'u1')).toEqual(bare('Ana'));
  });
});
