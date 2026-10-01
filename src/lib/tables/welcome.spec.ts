import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WELCOME_MESSAGE,
  TITLE_TOKEN,
  cleanWelcomeMessage,
  expandWelcomeMessage,
} from './welcome';

describe('DEFAULT_WELCOME_MESSAGE', () => {
  it('is the friendly text from the card, with the table name as a token', () => {
    expect(DEFAULT_WELCOME_MESSAGE).toContain(TITLE_TOKEN);
    expect(DEFAULT_WELCOME_MESSAGE).toContain('WhatsApp');
  });
});

describe('cleanWelcomeMessage', () => {
  it('trims, keeps line breaks and accents, and normalises Windows line endings', () => {
    expect(cleanWelcomeMessage('  Olá!\r\nAté breve, aventureiro(a).  ')).toBe(
      'Olá!\nAté breve, aventureiro(a).',
    );
  });

  it('strips control characters but not new lines or tabs turned into spaces', () => {
    expect(cleanWelcomeMessage('a\u0000b\u0007c\u001bd\u007fe\u0085f\u202eg')).toBe('abcdefg');
    expect(cleanWelcomeMessage('a\tb')).toBe('a b');
  });
});

describe('expandWelcomeMessage', () => {
  it('puts the real table title where the token is, every time', () => {
    expect(
      expandWelcomeMessage(`<p>Bem-vindo à ${TITLE_TOKEN}! ${TITLE_TOKEN}</p>`, 'Mesa do Dragão'),
    ).toBe('<p>Bem-vindo à Mesa do Dragão! Mesa do Dragão</p>');
  });

  it('escapes the title, so a GM cannot put markup in the e-mail through it', () => {
    expect(expandWelcomeMessage(`<p>${TITLE_TOKEN}</p>`, '<b>Mesa</b> & cia')).toBe(
      '<p>&lt;b&gt;Mesa&lt;/b&gt; &amp; cia</p>',
    );
  });

  it('cleans a message that was stored before it was checked', () => {
    expect(expandWelcomeMessage('<p>oi<script>x()</script></p>', 'Mesa')).toBe('<p>oi</p>');
  });

  it('is nothing at all for an empty, blank or missing message', () => {
    expect(expandWelcomeMessage(null, 'Mesa')).toBeNull();
    expect(expandWelcomeMessage('', 'Mesa')).toBeNull();
    expect(expandWelcomeMessage('   \n ', 'Mesa')).toBeNull();
    expect(expandWelcomeMessage('<p></p>', 'Mesa')).toBeNull();
  });

  it('does not treat a title with $ patterns as a replacement pattern', () => {
    expect(expandWelcomeMessage(`<p>Olá ${TITLE_TOKEN}</p>`, 'R$& $`')).toBe(
      '<p>Olá R$&amp; $`</p>',
    );
  });
});
