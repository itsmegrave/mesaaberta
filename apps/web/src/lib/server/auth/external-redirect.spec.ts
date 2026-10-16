import { describe, expect, it } from 'vitest';
import { supabaseOnly } from './external-redirect';

describe('supabaseOnly', () => {
  it('allows the project origin and nothing else', () => {
    expect(supabaseOnly({ SUPABASE_URL: 'https://abc.supabase.co/' })).toEqual({
      external: ['https://abc.supabase.co'],
    });
  });

  it('allows nothing when the project is not configured', () => {
    expect(supabaseOnly(undefined)).toEqual({ external: [] });
    expect(supabaseOnly({})).toEqual({ external: [] });
  });
});
