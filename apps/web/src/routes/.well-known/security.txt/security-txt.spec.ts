import { describe, expect, it } from 'vitest';
import { securityTxt } from './security-txt';

describe('security.txt', () => {
  const text = securityTxt(
    'https://mesaaberta.app',
    'contato@mesaaberta.app',
    Date.parse('2026-11-18T13:00:00Z'),
  );

  it('names the contact and its canonical address', () => {
    expect(text).toContain('Contact: mailto:contato@mesaaberta.app\n');
    expect(text).toContain('Canonical: https://mesaaberta.app/.well-known/security.txt\n');
  });

  it('expires less than a year away, at the start of a day', () => {
    expect(text).toContain('Expires: 2027-05-17T00:00:00.000Z\n');
  });
});
