/**
 * Hosted Resend templates. The copy of each e-mail is written and versioned in the Resend dashboard;
 * the app only says which template to use and fills in variables. See "Hosted e-mail templates" in
 * the README for what each template must contain.
 */
export type TemplateKey = 'invite' | 'cancel' | 'joinRequested' | 'joinDeclined';

/** One optional Worker variable per template. Ids are not secrets, but they may not be set yet. */
export type TemplateEnv = {
	RESEND_TEMPLATE_INVITE?: string;
	RESEND_TEMPLATE_CANCEL?: string;
	RESEND_TEMPLATE_JOIN_REQUESTED?: string;
	RESEND_TEMPLATE_JOIN_DECLINED?: string;
};

const envNames: Record<TemplateKey, keyof TemplateEnv> = {
	invite: 'RESEND_TEMPLATE_INVITE',
	cancel: 'RESEND_TEMPLATE_CANCEL',
	joinRequested: 'RESEND_TEMPLATE_JOIN_REQUESTED',
	joinDeclined: 'RESEND_TEMPLATE_JOIN_DECLINED'
};

/** A missing or blank variable means "not configured yet": the caller sends its inline copy. */
export function templateIdFor(env: TemplateEnv, key: TemplateKey): string | undefined {
	return env[envNames[key]]?.trim() || undefined;
}

/**
 * The only values that ever reach Resend for a template. Names are upper case and avoid the ones
 * Resend reserves (`FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`, `contact`, `this`).
 * Never add an id, a token, an address or anything secret here.
 *
 * A later, optional variable (the GM's welcome message) is one line in each of the two places
 * below: `WELCOME_MESSAGE?: string` in the type and `'WELCOME_MESSAGE'` in the list. Absent values
 * are omitted, so a template gives it a fallback value in the dashboard.
 */
export const TEMPLATE_VARIABLES = [
	'RECIPIENT_NAME',
	'TABLE_TITLE',
	'TABLE_URL',
	'CONTEXT',
	'STARTS_AT',
	'FALLBACK_TEXT'
] as const;

export type TemplateVariables = {
	RECIPIENT_NAME: string;
	TABLE_TITLE: string;
	TABLE_URL: string;
	/** Which message this is; it is also the template's purpose. */
	CONTEXT: 'REQUEST' | 'CANCEL' | 'JOIN_REQUESTED' | 'JOIN_DECLINED';
	/** The session start as people say it, in the table's own time zone. */
	STARTS_AT: string;
	/** The plain-text copy. Resend refuses `text` next to a template, so it travels as a variable. */
	FALLBACK_TEXT: string;
};

/** Resend limits a string variable to 2,000 characters. */
const MAX_LENGTH = 2000;

/**
 * Resend documents variables as `{{{NAME}}}` and does not say whether values are escaped, so
 * angle brackets, which are what start a tag, are removed. Users write titles and names.
 */
const clean = (value: string) => value.replace(/[<>]/g, '').slice(0, MAX_LENGTH);

/** Picks the allowlisted variables and cleans them; anything else is dropped. */
export function templateVariables(input: TemplateVariables): TemplateVariables {
	const picked: Record<string, string> = {};
	for (const name of TEMPLATE_VARIABLES) {
		const value = (input as Record<string, string | undefined>)[name];
		if (value !== undefined) picked[name] = clean(value);
	}
	return picked as TemplateVariables;
}
