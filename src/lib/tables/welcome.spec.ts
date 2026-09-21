import { describe, expect, it } from 'vitest';
import {
	DEFAULT_WELCOME_MESSAGE,
	TITLE_TOKEN,
	cleanWelcomeMessage,
	expandWelcomeMessage
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
			'Olá!\nAté breve, aventureiro(a).'
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
			expandWelcomeMessage(`Bem-vindo à ${TITLE_TOKEN}! ${TITLE_TOKEN}`, 'Mesa do Dragão')
		).toBe('Bem-vindo à Mesa do Dragão! Mesa do Dragão');
	});

	it('is nothing at all for an empty, blank or missing message', () => {
		expect(expandWelcomeMessage(null, 'Mesa')).toBeNull();
		expect(expandWelcomeMessage('', 'Mesa')).toBeNull();
		expect(expandWelcomeMessage('   \n ', 'Mesa')).toBeNull();
	});

	it('does not treat a title with $ patterns as a replacement pattern', () => {
		expect(expandWelcomeMessage(`Olá ${TITLE_TOKEN}`, "R$& '$`")).toBe("Olá R$& '$`");
	});
});
