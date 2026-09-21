import { describe, expect, it } from 'vitest';
import {
	TEMPLATE_VARIABLES,
	templateIdFor,
	templateVariables,
	type TemplateVariables
} from './templates';

const variables: TemplateVariables = {
	RECIPIENT_NAME: 'Ana',
	TABLE_TITLE: 'Mesa do Dragão',
	TABLE_URL: 'https://mesaaberta.app/tables/mesa',
	CONTEXT: 'REQUEST',
	STARTS_AT: 'sábado, 10 de outubro, 19:00 GMT-3',
	FALLBACK_TEXT: 'Você tem uma vaga confirmada.'
};

describe('template ids', () => {
	it('reads each id from its own Worker variable', () => {
		const env = {
			RESEND_TEMPLATE_INVITE: 'tpl-invite',
			RESEND_TEMPLATE_CANCEL: 'tpl-cancel',
			RESEND_TEMPLATE_JOIN_REQUESTED: 'tpl-requested',
			RESEND_TEMPLATE_JOIN_DECLINED: 'tpl-declined'
		};

		expect(templateIdFor(env, 'invite')).toBe('tpl-invite');
		expect(templateIdFor(env, 'cancel')).toBe('tpl-cancel');
		expect(templateIdFor(env, 'joinRequested')).toBe('tpl-requested');
		expect(templateIdFor(env, 'joinDeclined')).toBe('tpl-declined');
	});

	it('treats a missing, empty or blank variable as not configured', () => {
		expect(templateIdFor({}, 'invite')).toBeUndefined();
		expect(templateIdFor({ RESEND_TEMPLATE_INVITE: '' }, 'invite')).toBeUndefined();
		expect(templateIdFor({ RESEND_TEMPLATE_INVITE: '  ' }, 'invite')).toBeUndefined();
		expect(templateIdFor({ RESEND_TEMPLATE_INVITE: ' tpl-invite ' }, 'invite')).toBe('tpl-invite');
	});
});

describe('template variables', () => {
	it('allows exactly these names, none of them reserved by Resend', () => {
		expect([...TEMPLATE_VARIABLES]).toEqual([
			'RECIPIENT_NAME',
			'TABLE_TITLE',
			'TABLE_URL',
			'CONTEXT',
			'STARTS_AT',
			'FALLBACK_TEXT'
		]);
		const reserved = ['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'UNSUBSCRIBE_URL', 'contact', 'this'];
		expect(TEMPLATE_VARIABLES.filter((name) => reserved.includes(name))).toEqual([]);
	});

	it('passes the allowlisted variables through', () => {
		expect(templateVariables(variables)).toEqual(variables);
	});

	it('drops anything that is not on the allowlist, such as ids, tokens and addresses', () => {
		const smuggled = {
			...variables,
			id: '00000000-0000-4000-8000-000000000814',
			playerId: '00000000-0000-4000-8000-000000000812',
			EMAIL: 'ana@example.com',
			token: 'secret',
			RESEND_API_KEY: 're_secret'
		} as TemplateVariables;

		expect(Object.keys(templateVariables(smuggled)).sort()).toEqual([...TEMPLATE_VARIABLES].sort());
	});

	it('omits an optional variable that is absent instead of sending it empty', () => {
		const withUndefined = { ...variables, WELCOME_MESSAGE: undefined } as TemplateVariables;

		expect(templateVariables(withUndefined)).not.toHaveProperty('WELCOME_MESSAGE');
	});

	it('removes angle brackets, because the triple-brace variables are not documented as escaped', () => {
		const result = templateVariables({
			...variables,
			TABLE_TITLE: 'D&D <img src=x onerror=alert(1)> <b>4</b>'
		});

		expect(result.TABLE_TITLE).toBe('D&D img src=x onerror=alert(1) b4/b');
	});

	it('keeps every string within Resend’s 2,000 character limit', () => {
		const result = templateVariables({ ...variables, FALLBACK_TEXT: 'a'.repeat(5000) });

		expect(result.FALLBACK_TEXT).toHaveLength(2000);
	});
});
