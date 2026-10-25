import { describe, expect, it, vi } from 'vitest';
import { plainClick } from './plain-click';

// Node has no MouseEvent; the helper reads only the modifier keys and preventDefault.
const click = (
  keys: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
) => {
  const event = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...keys };
  return Object.assign(event, { preventDefault: vi.fn() }) as unknown as MouseEvent;
};

describe('plainClick', () => {
  it('runs the handler instead of following the link on a plain click', () => {
    const handler = vi.fn();
    const event = click();

    plainClick(handler)(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const)(
    'leaves a click with %s to the browser (a new tab or window)',
    (key) => {
      const handler = vi.fn();
      const event = click({ [key]: true });

      plainClick(handler)(event);

      expect(handler).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    },
  );

  it('is an ordinary link without a handler', () => {
    const event = click();

    plainClick()(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
