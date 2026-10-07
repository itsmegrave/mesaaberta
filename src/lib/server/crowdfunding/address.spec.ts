import { describe, expect, it } from 'vitest';
import { isPublicAddress } from './address';

describe('isPublicAddress', () => {
  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '2a00:1450:4001:81b::200e'])(
    'allows the public address %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
  ])('refuses the private or reserved IPv4 %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it('allows the neighbours of a private range', () => {
    expect(isPublicAddress('172.15.0.1')).toBe(true);
    expect(isPublicAddress('172.32.0.1')).toBe(true);
    expect(isPublicAddress('100.63.0.1')).toBe(true);
  });

  it.each(['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1'])(
    'refuses the private or reserved IPv6 %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(false);
    },
  );

  it('judges an IPv4 address wrapped in IPv6 as the IPv4 address', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('::ffff:169.254.169.254')).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
    expect(isPublicAddress('64:ff9b::7f00:1')).toBe(false);
  });

  it('refuses what is not an address', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('999.1.1.1')).toBe(false);
    expect(isPublicAddress('1.2.3')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
    expect(isPublicAddress('1::2::3')).toBe(false);
  });
});
