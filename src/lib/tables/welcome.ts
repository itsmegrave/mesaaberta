// The GM's welcome message: written once per table, e-mailed to each player who gets a seat.

export const WELCOME_MESSAGE_MAX = 1000;

/** Where the table's title goes. It stays literal in the stored text and is expanded when sending. */
export const TITLE_TOKEN = '{nome da mesa}';

/** The initial text of every new table's message. The GM edits it, or clears it to send none. */
export const DEFAULT_WELCOME_MESSAGE = `Olá, aventureiro(a)! Que alegria ter você na mesa '${TITLE_TOKEN}'! Para combinarmos os últimos detalhes e tirarmos dúvidas, fale comigo pelo WhatsApp: (##) #####-##### . Até breve!`;

/**
 * Control characters (except the line break) and the bidirectional overrides that can make text
 * read differently from how it is stored. Tabs become a space first, then go with the rest.
 */
const UNWANTED = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

/** Makes what a GM typed safe to store: one line-break style, no control characters, trimmed. */
export function cleanWelcomeMessage(value: string): string {
	return value.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(UNWANTED, '').trim();
}

/** The message as it is sent to a player, or null when there is nothing to say. */
export function expandWelcomeMessage(message: string | null, title: string): string | null {
	const cleaned = message ? cleanWelcomeMessage(message) : '';
	// A function replacer, so `$&` and friends in a title stay literal.
	return cleaned ? cleaned.replaceAll(TITLE_TOKEN, () => title) : null;
}
