import { describe, expect, it } from 'vitest';
import { linkifyBody } from './linkify';

describe('linkifyBody', () => {
  it('splits text around a web link and keeps every character', () => {
    const parts = linkifyBody('veja https://example.com/mesa?x=1 hoje');
    expect(parts).toEqual([
      { kind: 'text', text: 'veja ' },
      { kind: 'link', text: 'https://example.com/mesa?x=1', href: 'https://example.com/mesa?x=1' },
      { kind: 'text', text: ' hoje' },
    ]);
  });

  it('leaves a body without links as one text part', () => {
    expect(linkifyBody('oi\ntudo bem?')).toEqual([{ kind: 'text', text: 'oi\ntudo bem?' }]);
  });

  it('never links a javascript: address', () => {
    const parts = linkifyBody('javascript:alert(1)');
    expect(parts.every((part) => part.kind === 'text')).toBe(true);
    expect(parts.map((part) => part.kind === 'text' && part.text).join('')).toBe(
      'javascript:alert(1)',
    );
  });

  it('does not link an email address', () => {
    expect(linkifyBody('a@b.com').every((part) => part.kind === 'text')).toBe(true);
  });

  it('links a bare domain over http(s) only', () => {
    const parts = linkifyBody('entre em mesaaberta.app');
    const link = parts.find((part) => part.kind === 'link');
    expect(link && link.kind === 'link' && link.href).toMatch(/^https?:\/\//);
  });
});
