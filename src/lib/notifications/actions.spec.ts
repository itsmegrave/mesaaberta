import { describe, expect, it } from 'vitest';
import { notificationActionSchema } from './actions';

describe('notificationActionSchema', () => {
  it('takes a notification id and where to come back to', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(notificationActionSchema.parse({ id, next: '/tables' })).toEqual({
      id,
      next: '/tables',
    });
  });

  it('needs no id for read all, and no next', () => {
    expect(notificationActionSchema.parse({})).toEqual({ next: '' });
  });

  it('refuses an id that is not one', () => {
    expect(notificationActionSchema.safeParse({ id: 'n1' }).success).toBe(false);
  });
});
