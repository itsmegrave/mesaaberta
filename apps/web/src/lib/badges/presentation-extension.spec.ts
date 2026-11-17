import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/extensions/panels.js', () => ({
  badges: {
    supporter: { icon: 'heart', tier: 0, name: () => 'Apoiador', description: () => 'Apoia.' },
    'first-table': { icon: 'heart', tier: 0, name: () => 'Imitação', description: () => '' },
  },
}));

const { presentationOf } = await import('./presentation');

describe('presentationOf with an extension installed', () => {
  it("finds an extension badge's look", () => {
    expect(presentationOf('supporter')?.name()).toBe('Apoiador');
  });

  it('keeps the public look of a public id', () => {
    expect(presentationOf('first-table')?.name()).not.toBe('Imitação');
  });

  it('shows nothing for an unknown id or an inherited key', () => {
    expect(presentationOf('nobody')).toBeNull();
    expect(presentationOf('constructor')).toBeNull();
  });
});
